import { injectable, inject } from 'inversify';
import { Model } from 'mongoose';
import { RedisClient } from 'redis';
import { Producer } from 'kafka-node';
import axios from 'axios';
import { Counter, Histogram } from 'prom-client';
import { Tracer, Span } from '@opentelemetry/api';
import CircuitBreaker from 'opossum';

import { 
  ILead, 
  ILeadDocument, 
  InsuranceVertical, 
  LeadStatus 
} from '../interfaces/lead.interface';
import Lead from '../models/lead.model';

// Constants
const VALIDATION_TIMEOUT_MS = 500;
const SCORING_TIMEOUT_MS = 500;
const CACHE_TTL_SECONDS = 300;
const MAX_RETRY_ATTEMPTS = 3;
const CIRCUIT_BREAKER_THRESHOLD = 0.5;
const CIRCUIT_BREAKER_RESET_TIMEOUT = 30000;
const BATCH_SIZE = 100;
const MAX_CONCURRENT_REQUESTS = 50;

@injectable()
export class LeadService {
  private readonly _leadModel: Model<ILeadDocument>;
  private readonly _cache: RedisClient;
  private readonly _eventProducer: Producer;
  private readonly _tracer: Tracer;
  
  // Metrics
  private readonly _leadCounter: Counter;
  private readonly _processingLatency: Histogram;
  private readonly _validationErrors: Counter;
  private readonly _scoringErrors: Counter;
  
  // Circuit Breakers
  private readonly _validationBreaker: CircuitBreaker;
  private readonly _scoringBreaker: CircuitBreaker;

  constructor(
    @inject('LeadModel') leadModel: Model<ILeadDocument>,
    @inject('RedisClient') cache: RedisClient,
    @inject('KafkaProducer') eventProducer: Producer,
    @inject('Tracer') tracer: Tracer
  ) {
    this._leadModel = leadModel;
    this._cache = cache;
    this._eventProducer = eventProducer;
    this._tracer = tracer;

    // Initialize metrics
    this._leadCounter = new Counter({
      name: 'leads_processed_total',
      help: 'Total number of leads processed',
      labelNames: ['vertical', 'status']
    });

    this._processingLatency = new Histogram({
      name: 'lead_processing_duration_seconds',
      help: 'Lead processing duration in seconds',
      buckets: [0.1, 0.3, 0.5, 1, 2]
    });

    this._validationErrors = new Counter({
      name: 'validation_errors_total',
      help: 'Total number of validation errors',
      labelNames: ['type']
    });

    this._scoringErrors = new Counter({
      name: 'scoring_errors_total',
      help: 'Total number of scoring errors',
      labelNames: ['type']
    });

    // Initialize circuit breakers
    this._validationBreaker = new CircuitBreaker(this.validateLead, {
      timeout: VALIDATION_TIMEOUT_MS,
      errorThresholdPercentage: CIRCUIT_BREAKER_THRESHOLD * 100,
      resetTimeout: CIRCUIT_BREAKER_RESET_TIMEOUT
    });

    this._scoringBreaker = new CircuitBreaker(this.scoreLead, {
      timeout: SCORING_TIMEOUT_MS,
      errorThresholdPercentage: CIRCUIT_BREAKER_THRESHOLD * 100,
      resetTimeout: CIRCUIT_BREAKER_RESET_TIMEOUT
    });
  }

  /**
   * Creates a new lead with validation and scoring
   */
  public async createLead(leadData: ILead): Promise<ILeadDocument> {
    const span = this._tracer.startSpan('createLead');
    const timer = this._processingLatency.startTimer();

    try {
      span.setAttribute('vertical', leadData.vertical);
      
      // Create initial lead document
      const lead = new this._leadModel({
        ...leadData,
        status: LeadStatus.CREATED
      });

      // Parallel validation and scoring
      const [validationResult, mlScore] = await Promise.all([
        this._validationBreaker.fire(lead),
        this._scoringBreaker.fire(lead)
      ]);

      // Update lead with results
      lead.status = validationResult.isValid ? LeadStatus.VALIDATED : LeadStatus.REJECTED;
      lead.ml_score = mlScore;
      lead.validation_history.push({
        timestamp: new Date(),
        status: lead.status,
        message: validationResult.message
      });

      // Save lead with optimistic locking
      const savedLead = await lead.save();

      // Emit lead event
      await this.emitLeadEvent(savedLead);

      // Update metrics
      this._leadCounter.inc({ vertical: leadData.vertical, status: savedLead.status });
      timer();

      return savedLead;

    } catch (error) {
      span.setStatus({ code: 1, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Validates lead data through validation service
   */
  private async validateLead(lead: ILead): Promise<any> {
    const cacheKey = `validation:${lead.id}`;
    
    // Check cache first
    const cachedResult = await this._cache.get(cacheKey);
    if (cachedResult) {
      return JSON.parse(cachedResult);
    }

    try {
      const response = await axios.post('/api/validation', {
        vertical: lead.vertical,
        contact: lead.contact_info,
        verticalData: lead.vertical_data
      }, {
        timeout: VALIDATION_TIMEOUT_MS
      });

      // Cache successful result
      await this._cache.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(response.data));
      
      return response.data;

    } catch (error) {
      this._validationErrors.inc({ type: error.code || 'unknown' });
      throw error;
    }
  }

  /**
   * Scores lead using ML service
   */
  private async scoreLead(lead: ILead): Promise<number> {
    const cacheKey = `score:${lead.id}`;
    
    // Check cache first
    const cachedScore = await this._cache.get(cacheKey);
    if (cachedScore) {
      return parseFloat(cachedScore);
    }

    try {
      const response = await axios.post('/api/scoring', {
        vertical: lead.vertical,
        data: {
          contact: lead.contact_info,
          vertical: lead.vertical_data
        }
      }, {
        timeout: SCORING_TIMEOUT_MS
      });

      const score = response.data.score;

      // Cache successful score
      await this._cache.setex(cacheKey, CACHE_TTL_SECONDS, score.toString());
      
      return score;

    } catch (error) {
      this._scoringErrors.inc({ type: error.code || 'unknown' });
      throw error;
    }
  }

  /**
   * Emits lead event to Kafka
   */
  private async emitLeadEvent(lead: ILeadDocument): Promise<void> {
    const event = {
      type: 'LEAD_CREATED',
      payload: {
        id: lead.id,
        vertical: lead.vertical,
        status: lead.status,
        ml_score: lead.ml_score,
        created_at: lead.created_at
      }
    };

    await this._eventProducer.send({
      topic: 'leads',
      messages: [{ value: JSON.stringify(event) }],
      attributes: 1 // Use compression
    });
  }

  /**
   * Health check method
   */
  public async healthCheck(): Promise<boolean> {
    const isDbHealthy = await this._leadModel.db.db.admin().ping();
    const isCacheHealthy = await this._cache.ping();
    const isValidationHealthy = !this._validationBreaker.opened;
    const isScoringHealthy = !this._scoringBreaker.opened;

    return isDbHealthy && isCacheHealthy && isValidationHealthy && isScoringHealthy;
  }
}

export default LeadService;