import { Schema, model, Model } from 'mongoose'; // v7.0.0
import validator from 'validator'; // v13.11.0
import { fieldEncryption } from 'mongoose-field-encryption'; // v4.0.0
import { 
  ILead, 
  ILeadDocument, 
  InsuranceVertical, 
  LeadStatus 
} from '../interfaces/lead.interface';

// Enhanced email validation with business rules
const validateEmail = (email: string): boolean => {
  return validator.isEmail(email) && 
         email.length <= 255 &&
         !email.endsWith('.test') &&
         !email.endsWith('.invalid');
};

// Enhanced phone validation with format checking
const validatePhone = (phone: string): boolean => {
  return validator.isMobilePhone(phone, 'en-US') &&
         phone.replace(/\D/g, '').length === 10;
};

// Lead schema definition with enhanced security and validation
const leadSchema = new Schema<ILeadDocument>({
  vertical: {
    type: String,
    enum: Object.values(InsuranceVertical),
    required: [true, 'Insurance vertical is required'],
    index: true
  },
  contact_info: {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: 50,
      encrypt: true
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: 50,
      encrypt: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      validate: [validateEmail, 'Invalid email format'],
      lowercase: true,
      encrypt: true,
      index: true
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      validate: [validatePhone, 'Invalid phone format'],
      encrypt: true
    },
    address: {
      street: {
        type: String,
        required: [true, 'Street address is required'],
        encrypt: true
      },
      unit: String,
      city: {
        type: String,
        required: [true, 'City is required']
      },
      state: {
        type: String,
        required: [true, 'State is required'],
        uppercase: true,
        minlength: 2,
        maxlength: 2
      },
      zip: {
        type: String,
        required: [true, 'ZIP code is required'],
        validate: {
          validator: (v: string) => /^\d{5}(-\d{4})?$/.test(v),
          message: 'Invalid ZIP code format'
        }
      }
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required'],
      encrypt: true
    },
    ssn: {
      type: String,
      validate: {
        validator: (v: string) => !v || /^\d{9}$/.test(v),
        message: 'Invalid SSN format'
      },
      encrypt: true
    }
  },
  vertical_data: {
    vertical: {
      type: String,
      enum: Object.values(InsuranceVertical),
      required: true
    },
    data: {
      type: Schema.Types.Mixed,
      required: [true, 'Vertical-specific data is required']
    },
    validationResults: {
      type: Map,
      of: Boolean,
      default: {}
    },
    enrichmentData: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {}
    }
  },
  traffic_source: {
    type: String,
    required: [true, 'Traffic source is required'],
    trim: true
  },
  ml_score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    index: true
  },
  status: {
    type: String,
    enum: Object.values(LeadStatus),
    default: LeadStatus.CREATED,
    index: true
  },
  validation_history: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: Object.values(LeadStatus)
    },
    message: String
  }],
  encryption_status: {
    pii: {
      type: Boolean,
      default: false
    },
    sensitive: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  collection: 'leads',
  validateBeforeSave: true,
  optimisticConcurrency: true,
  strict: true,
  useNestedStrict: true
});

// Configure field-level encryption
leadSchema.plugin(fieldEncryption, {
  fields: ['contact_info.firstName', 'contact_info.lastName', 'contact_info.email', 
           'contact_info.phone', 'contact_info.address.street', 'contact_info.dateOfBirth', 
           'contact_info.ssn'],
  secret: process.env.ENCRYPTION_KEY || 'default-key-for-development',
  saltGenerator: function(secret: string) {
    return "1234567890123456"; // Should be properly implemented in production
  }
});

// Indexes for performance optimization
leadSchema.index({ vertical: 1, created_at: -1 });
leadSchema.index({ ml_score: -1 });
leadSchema.index({ 'validation_history.timestamp': -1 });
leadSchema.index({ 'contact_info.email': 1 }, { unique: true, sparse: true });

// Pre-save middleware for validation and processing
leadSchema.pre('save', async function(next) {
  if (this.isNew) {
    this.validation_history.push({
      timestamp: new Date(),
      status: LeadStatus.CREATED
    });
  }

  // Update encryption status
  this.encryption_status = {
    pii: true,
    sensitive: true
  };

  next();
});

// Secure JSON serialization
leadSchema.methods.toJSON = function() {
  const obj = this.toObject();
  
  // Remove sensitive fields
  delete obj.contact_info.ssn;
  delete obj.encryption_status;
  
  // Mask PII data for non-authorized contexts
  if (!this._shouldShowPII) {
    obj.contact_info.email = obj.contact_info.email.replace(/(?<=.{3}).(?=.*@)/g, '*');
    obj.contact_info.phone = obj.contact_info.phone.replace(/\d(?=\d{4})/g, '*');
  }
  
  return obj;
};

// Create and export the model
const Lead: Model<ILeadDocument> = model<ILeadDocument>('Lead', leadSchema);

export default Lead;