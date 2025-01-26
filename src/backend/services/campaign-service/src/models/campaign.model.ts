/**
 * @fileoverview Campaign model definition for the Multi-Vertical Insurance Lead Generation Platform.
 * Implements comprehensive schema validation, indexing, and middleware for campaign management.
 * @version 1.0.0
 */

import { Schema, model } from 'mongoose'; // v7.5.0
import { ICampaignDocument } from '../interfaces/campaign.interface';

/**
 * Mongoose schema definition for campaigns with comprehensive validation and indexing
 */
const CampaignSchema = new Schema<ICampaignDocument>({
  buyerId: {
    type: String,
    required: [true, 'Buyer ID is required'],
    index: true,
    trim: true,
  },
  name: {
    type: String,
    required: [true, 'Campaign name is required'],
    trim: true,
    maxlength: [100, 'Campaign name cannot exceed 100 characters'],
    validate: {
      validator: (v: string) => v.length >= 3,
      message: 'Campaign name must be at least 3 characters long'
    }
  },
  vertical: {
    type: String,
    required: [true, 'Insurance vertical is required'],
    enum: {
      values: ['AUTO', 'HOME', 'HEALTH', 'LIFE', 'RENTERS', 'COMMERCIAL'],
      message: '{VALUE} is not a supported insurance vertical'
    },
    index: true,
    uppercase: true
  },
  filters: {
    type: Object,
    required: [true, 'Campaign filters are required'],
    default: {},
    validate: {
      validator: function(v: any) {
        if (!v.rules || !Array.isArray(v.rules) || v.rules.length === 0) {
          return false;
        }
        if (!v.matchType || !['ALL', 'ANY'].includes(v.matchType)) {
          return false;
        }
        return v.rules.every((rule: any) => 
          rule.field && 
          rule.operator && 
          ['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN', 'IN', 'NOT_IN', 'CONTAINS', 'NOT_CONTAINS'].includes(rule.operator) &&
          rule.value !== undefined
        );
      },
      message: 'Invalid filter configuration'
    }
  },
  maxCpl: {
    type: Number,
    required: [true, 'Maximum CPL is required'],
    min: [0, 'Maximum CPL cannot be negative'],
    validate: {
      validator: function(v: number) {
        return v <= this.dailyBudget;
      },
      message: 'Max CPL must not exceed daily budget'
    }
  },
  dailyBudget: {
    type: Number,
    required: [true, 'Daily budget is required'],
    min: [0, 'Daily budget cannot be negative']
  },
  status: {
    type: String,
    required: true,
    enum: {
      values: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'DELETED'],
      message: '{VALUE} is not a valid campaign status'
    },
    default: 'DRAFT',
    index: true,
    uppercase: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  versionKey: 'version'
});

/**
 * Compound index for unique campaign names per buyer
 */
CampaignSchema.index(
  { buyerId: 1, name: 1 },
  { 
    unique: true,
    name: 'idx_buyer_campaign_name',
    background: true,
    partialFilterExpression: { status: { $ne: 'DELETED' } }
  }
);

/**
 * Index for efficient campaign matching
 */
CampaignSchema.index(
  { vertical: 1, status: 1, maxCpl: -1 },
  { 
    name: 'idx_campaign_matching',
    background: true
  }
);

/**
 * Index for campaign archival (expires after 2 years)
 */
CampaignSchema.index(
  { createdAt: -1 },
  { 
    name: 'idx_campaign_created',
    background: true,
    expireAfterSeconds: 63072000 // 2 years
  }
);

/**
 * Pre-save middleware for campaign validation and updates
 */
CampaignSchema.pre('save', async function(next) {
  try {
    this.updatedAt = new Date();

    // Validate daily budget and maxCpl relationship
    if (this.maxCpl > this.dailyBudget) {
      throw new Error('Maximum CPL cannot exceed daily budget');
    }

    // Check for unique campaign name within buyer scope if name is modified
    if (this.isModified('name')) {
      const existingCampaign = await this.constructor.findOne({
        buyerId: this.buyerId,
        name: this.name,
        _id: { $ne: this._id },
        status: { $ne: 'DELETED' }
      });
      if (existingCampaign) {
        throw new Error('Campaign name must be unique within buyer scope');
      }
    }

    // Validate status transitions
    if (this.isModified('status')) {
      const validTransitions: { [key: string]: string[] } = {
        'DRAFT': ['ACTIVE', 'DELETED'],
        'ACTIVE': ['PAUSED', 'COMPLETED', 'DELETED'],
        'PAUSED': ['ACTIVE', 'COMPLETED', 'DELETED'],
        'COMPLETED': ['DELETED'],
        'DELETED': []
      };

      const oldStatus = this.get('status', String, { getters: false });
      if (!validTransitions[oldStatus]?.includes(this.status)) {
        throw new Error(`Invalid status transition from ${oldStatus} to ${this.status}`);
      }
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

/**
 * Static method to find campaigns by buyer ID
 */
CampaignSchema.static('findByBuyerId', function(buyerId: string) {
  return this.find({ 
    buyerId,
    status: { $ne: 'DELETED' }
  }).sort({ createdAt: -1 });
});

/**
 * Static method to find active campaigns by vertical
 */
CampaignSchema.static('findActiveByVertical', function(vertical: string) {
  return this.find({
    vertical,
    status: 'ACTIVE'
  }).sort({ maxCpl: -1 });
});

/**
 * Static method to update campaign status
 */
CampaignSchema.static('updateStatus', async function(campaignId: string, status: string) {
  const campaign = await this.findById(campaignId);
  if (!campaign) {
    throw new Error('Campaign not found');
  }
  campaign.status = status;
  return campaign.save();
});

// Export the campaign model with type safety
export const Campaign = model<ICampaignDocument>('Campaign', CampaignSchema);

// Export the schema for testing and extension
export { CampaignSchema };