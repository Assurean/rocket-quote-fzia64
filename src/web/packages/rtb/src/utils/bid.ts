import Big from 'big.js'; // ^6.2.1 - For precise decimal calculations

// Interfaces
export interface Bid {
  id: string;
  advertiserId: string;
  amount: number;
  targetUrl: string;
  creativeHtml: string;
  expiresAt: number; // Unix timestamp
  metadata: Record<string, unknown>;
  currency: string;
  locale: string;
  securityMetadata: {
    signature?: string;
    certificateId?: string;
    encryptionVersion?: string;
    securityFlags?: string[];
  };
}

export interface BidOptimizationConfig {
  minBidAmount: number;
  maxBidAmount: number;
  defaultMarkup: number;
  qualityMultiplier: number;
  cacheDuration: number;
  roundingStrategy: {
    precision: number;
    mode: 'floor' | 'ceil' | 'round';
  };
  securityRules: {
    requireSignature: boolean;
    allowedDomains: string[];
    maxBidAge: number;
  };
  allowedProtocols: string[];
}

// Constants
const BID_CACHE = new Map<string, { value: number; timestamp: number }>();
const ALLOWED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD'];
const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const HTML_SANITIZE_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;

/**
 * Validates a bid object against required criteria with enhanced security checks
 * @param bid - The bid object to validate
 * @returns boolean indicating whether the bid is valid
 */
export const validateBid = (bid: Bid): boolean => {
  try {
    // Check if bid object exists and has required properties
    if (!bid || typeof bid !== 'object') {
      return false;
    }

    // Validate required string properties
    const requiredStrings = ['id', 'advertiserId', 'targetUrl', 'creativeHtml', 'currency', 'locale'];
    if (!requiredStrings.every(prop => typeof bid[prop as keyof Bid] === 'string')) {
      return false;
    }

    // Validate amount
    if (typeof bid.amount !== 'number' || bid.amount <= 0) {
      return false;
    }

    // Validate currency
    if (!ALLOWED_CURRENCIES.includes(bid.currency)) {
      return false;
    }

    // Validate expiration
    const now = Date.now();
    if (!bid.expiresAt || bid.expiresAt <= now) {
      return false;
    }

    // Validate target URL
    if (!URL_REGEX.test(bid.targetUrl)) {
      return false;
    }

    // Validate creative HTML (basic sanitization check)
    if (HTML_SANITIZE_REGEX.test(bid.creativeHtml)) {
      return false;
    }

    // Validate metadata
    if (!bid.metadata || typeof bid.metadata !== 'object') {
      return false;
    }

    // Validate security metadata
    if (!bid.securityMetadata || typeof bid.securityMetadata !== 'object') {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Bid validation error:', error);
    return false;
  }
};

/**
 * Formats a bid amount with enhanced internationalization support
 * @param amount - The numeric amount to format
 * @param locale - The locale to use for formatting
 * @param formatOptions - Optional formatting configuration
 * @returns Formatted bid amount string
 */
export const formatBidAmount = (
  amount: number,
  locale: string,
  formatOptions: Intl.NumberFormatOptions = {}
): string => {
  try {
    // Validate input
    if (amount < 0) {
      throw new Error('Bid amount cannot be negative');
    }

    // Convert to Big number for precision
    const bigAmount = new Big(amount);

    // Apply default formatting options
    const options: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...formatOptions
    };

    // Format the amount using Intl
    const formatter = new Intl.NumberFormat(locale, options);
    return formatter.format(bigAmount.toNumber());
  } catch (error) {
    console.error('Bid amount formatting error:', error);
    return amount.toString();
  }
};

/**
 * Calculates the optimal bid amount with enhanced optimization and caching
 * @param leadScore - Quality score of the lead (0-1)
 * @param config - Bid optimization configuration
 * @param marketConditions - Current market conditions
 * @returns Calculated optimal bid amount
 */
export const calculateOptimalBid = (
  leadScore: number,
  config: BidOptimizationConfig,
  marketConditions: {
    demandMultiplier: number;
    competitionFactor: number;
    timeOfDayAdjustment: number;
  }
): number => {
  try {
    // Validate lead score
    if (leadScore < 0 || leadScore > 1) {
      throw new Error('Lead score must be between 0 and 1');
    }

    // Generate cache key
    const cacheKey = `${leadScore}-${JSON.stringify(config)}-${JSON.stringify(marketConditions)}`;

    // Check cache
    const cached = BID_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < config.cacheDuration) {
      return cached.value;
    }

    // Calculate base bid
    let baseBid = new Big(config.minBidAmount)
      .plus(
        new Big(config.maxBidAmount)
          .minus(config.minBidAmount)
          .times(leadScore)
      );

    // Apply quality multiplier
    baseBid = baseBid.times(config.qualityMultiplier);

    // Apply market conditions
    baseBid = baseBid
      .times(marketConditions.demandMultiplier)
      .times(marketConditions.competitionFactor)
      .times(marketConditions.timeOfDayAdjustment);

    // Apply markup
    baseBid = baseBid.times(1 + config.defaultMarkup);

    // Apply rounding strategy
    let finalBid: number;
    switch (config.roundingStrategy.mode) {
      case 'floor':
        finalBid = baseBid.round(config.roundingStrategy.precision, Big.roundDown).toNumber();
        break;
      case 'ceil':
        finalBid = baseBid.round(config.roundingStrategy.precision, Big.roundUp).toNumber();
        break;
      default:
        finalBid = baseBid.round(config.roundingStrategy.precision, Big.roundHalfUp).toNumber();
    }

    // Ensure bid is within bounds
    finalBid = Math.max(config.minBidAmount, Math.min(config.maxBidAmount, finalBid));

    // Cache result
    BID_CACHE.set(cacheKey, { value: finalBid, timestamp: Date.now() });

    return finalBid;
  } catch (error) {
    console.error('Optimal bid calculation error:', error);
    return config.minBidAmount;
  }
};