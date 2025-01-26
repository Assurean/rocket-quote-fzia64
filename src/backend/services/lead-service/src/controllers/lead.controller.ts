import { Request, Response } from 'express'; // ^4.18.0
import { Counter, Histogram, Gauge } from 'prom-client'; // ^14.2.0
import { validationResult } from 'express-validator'; // ^7.0.0
import { StatusCodes } from 'http-status-codes'; // ^2.3.0

import { LeadService } from '../services/lead.service';
import { 
  ILead, 
  LeadStatus, 
  InsuranceVertical, 
  LeadValidationError 
} from '../interfaces/lead.interface';
import { validateLead, ValidationResult } from '../utils/validation';

// Constants for request handling
const REQUEST_TIMEOUT_MS = 5000;
const MAX_PAGE_SIZE = 100;
const MAX_CONCURRENT_REQUESTS = 1000;
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 100;

export class LeadController {
  private readonly _leadService: LeadService;
  private readonly _requestCounter: Counter;
  private readonly _requestLatency: Histogram;
  private readonly _concurrentRequests: Gauge;
  private readonly _logger: any;

  constructor(leadService: LeadService, logger: any) {
    this._leadService = leadService;
    this._logger = logger;

    // Initialize metrics
    this._requestCounter = new Counter({
      name: 'lead_requests_total',
      help: 'Total number of lead requests',
      labelNames: ['method', 'endpoint', 'status']
    });

    this._requestLatency = new Histogram({
      name: 'lead_request_duration_seconds',
      help: 'Lead request duration in seconds',
      labelNames: ['method', 'endpoint'],
      buckets: [0.1, 0.3, 0.5, 1, 2, 5]
    });

    this._concurrentRequests = new Gauge({
      name: 'lead_concurrent_requests',
      help: 'Number of concurrent lead requests'
    });
  }

  /**
   * Creates a new lead with comprehensive validation
   */
  public async createLead(req: Request, res: Response): Promise<Response> {
    const timer = this._requestLatency.startTimer();
    this._concurrentRequests.inc();

    try {
      // Validate request body
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        this._requestCounter.inc({ method: 'POST', endpoint: '/leads', status: 400 });
        return res.status(StatusCodes.BAD_REQUEST).json({ errors: errors.array() });
      }

      // Validate lead data
      const validationResult = await validateLead(req.body);
      if (!validationResult.isValid) {
        this._requestCounter.inc({ method: 'POST', endpoint: '/leads', status: 400 });
        return res.status(StatusCodes.BAD_REQUEST).json({
          errors: validationResult.contactValidation.errors.concat(validationResult.verticalValidation.errors)
        });
      }

      // Create lead
      const lead = await this._leadService.createLead(req.body);
      
      this._requestCounter.inc({ method: 'POST', endpoint: '/leads', status: 201 });
      return res.status(StatusCodes.CREATED).json(lead);

    } catch (error) {
      this._logger.error('Lead creation failed', { error });
      this._requestCounter.inc({ method: 'POST', endpoint: '/leads', status: 500 });
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: 'Lead creation failed',
        error: error.message
      });

    } finally {
      timer();
      this._concurrentRequests.dec();
    }
  }

  /**
   * Retrieves a lead by ID with security checks
   */
  public async getLead(req: Request, res: Response): Promise<Response> {
    const timer = this._requestLatency.startTimer();
    this._concurrentRequests.inc();

    try {
      const { id } = req.params;
      const lead = await this._leadService.findLeadById(id);

      if (!lead) {
        this._requestCounter.inc({ method: 'GET', endpoint: '/leads/:id', status: 404 });
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Lead not found' });
      }

      this._requestCounter.inc({ method: 'GET', endpoint: '/leads/:id', status: 200 });
      return res.status(StatusCodes.OK).json(lead);

    } catch (error) {
      this._logger.error('Lead retrieval failed', { error });
      this._requestCounter.inc({ method: 'GET', endpoint: '/leads/:id', status: 500 });
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: 'Lead retrieval failed',
        error: error.message
      });

    } finally {
      timer();
      this._concurrentRequests.dec();
    }
  }

  /**
   * Updates lead status with validation
   */
  public async updateLeadStatus(req: Request, res: Response): Promise<Response> {
    const timer = this._requestLatency.startTimer();
    this._concurrentRequests.inc();

    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!Object.values(LeadStatus).includes(status)) {
        this._requestCounter.inc({ method: 'PATCH', endpoint: '/leads/:id/status', status: 400 });
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid lead status' });
      }

      const updatedLead = await this._leadService.updateLeadStatus(id, status);
      if (!updatedLead) {
        this._requestCounter.inc({ method: 'PATCH', endpoint: '/leads/:id/status', status: 404 });
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Lead not found' });
      }

      this._requestCounter.inc({ method: 'PATCH', endpoint: '/leads/:id/status', status: 200 });
      return res.status(StatusCodes.OK).json(updatedLead);

    } catch (error) {
      this._logger.error('Lead status update failed', { error });
      this._requestCounter.inc({ method: 'PATCH', endpoint: '/leads/:id/status', status: 500 });
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: 'Lead status update failed',
        error: error.message
      });

    } finally {
      timer();
      this._concurrentRequests.dec();
    }
  }

  /**
   * Searches leads with filters and pagination
   */
  public async searchLeads(req: Request, res: Response): Promise<Response> {
    const timer = this._requestLatency.startTimer();
    this._concurrentRequests.inc();

    try {
      const { 
        vertical, 
        status, 
        minScore, 
        maxScore, 
        startDate, 
        endDate,
        page = 1,
        limit = 20
      } = req.query;

      // Validate pagination
      const pageSize = Math.min(Number(limit), MAX_PAGE_SIZE);
      const skip = (Number(page) - 1) * pageSize;

      // Build filters
      const filters: any = {};
      if (vertical) filters.vertical = vertical;
      if (status) filters.status = status;
      if (minScore || maxScore) {
        filters.ml_score = {};
        if (minScore) filters.ml_score.$gte = Number(minScore);
        if (maxScore) filters.ml_score.$lte = Number(maxScore);
      }
      if (startDate || endDate) {
        filters.created_at = {};
        if (startDate) filters.created_at.$gte = new Date(startDate as string);
        if (endDate) filters.created_at.$lte = new Date(endDate as string);
      }

      const [leads, total] = await Promise.all([
        this._leadService.findLeadsByFilters(filters, skip, pageSize),
        this._leadService.countLeadsByFilters(filters)
      ]);

      this._requestCounter.inc({ method: 'GET', endpoint: '/leads', status: 200 });
      return res.status(StatusCodes.OK).json({
        leads,
        pagination: {
          page: Number(page),
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      });

    } catch (error) {
      this._logger.error('Lead search failed', { error });
      this._requestCounter.inc({ method: 'GET', endpoint: '/leads', status: 500 });
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: 'Lead search failed',
        error: error.message
      });

    } finally {
      timer();
      this._concurrentRequests.dec();
    }
  }
}

export default LeadController;