/**
 * @fileoverview Enhanced campaign controller implementation with comprehensive security,
 * monitoring, and error handling for the Multi-Vertical Insurance Lead Generation Platform.
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { injectable } from 'inversify'; // v6.0.1
import { controller, httpPost, httpPut, httpGet, httpDelete, middleware } from 'inversify-express-utils'; // v6.4.3
import { Logger } from 'winston'; // v3.10.0
import { MetricsService } from '@opentelemetry/metrics'; // v1.0.0
import { ValidationMiddleware } from 'express-validator'; // v7.0.0
import { RateLimitMiddleware } from 'express-rate-limit'; // v6.7.0

import { CampaignService } from '../services/campaign.service';
import {
  ICreateCampaignRequest,
  IUpdateCampaignRequest,
  IListCampaignsRequest,
  ICampaign
} from '../interfaces/campaign.interface';

const CACHE_CONTROL = 'public, max-age=300'; // 5 minutes cache

@controller('/api/v1/campaigns')
@injectable()
export class CampaignController {
  constructor(
    private readonly campaignService: CampaignService,
    private readonly logger: Logger,
    private readonly metrics: MetricsService,
    private readonly validator: ValidationMiddleware,
    private readonly rateLimiter: RateLimitMiddleware
  ) {}

  /**
   * Creates a new campaign with validation and rate limiting
   */
  @httpPost('/')
  @middleware([ValidationMiddleware, RateLimitMiddleware])
  public async createCampaign(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || '';

    try {
      this.logger.info('Creating campaign', {
        requestId,
        buyerId: req.body.buyerId
      });

      const campaign = await this.campaignService.createCampaign(
        req.body as ICreateCampaignRequest
      );

      // Record metrics
      this.metrics.recordValue('campaign.create.latency', Date.now() - startTime, {
        vertical: campaign.vertical,
        buyerId: campaign.buyerId
      });

      return res
        .status(201)
        .header('Cache-Control', CACHE_CONTROL)
        .json(campaign);
    } catch (error) {
      this.logger.error('Campaign creation failed', {
        requestId,
        error,
        body: req.body
      });
      return next(error);
    }
  }

  /**
   * Updates an existing campaign with validation
   */
  @httpPut('/:id')
  @middleware([ValidationMiddleware])
  public async updateCampaign(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || '';
    const campaignId = req.params.id;

    try {
      this.logger.info('Updating campaign', {
        requestId,
        campaignId
      });

      const updateRequest: IUpdateCampaignRequest = {
        id: campaignId,
        ...req.body
      };

      const campaign = await this.campaignService.updateCampaign(updateRequest);

      // Record metrics
      this.metrics.recordValue('campaign.update.latency', Date.now() - startTime, {
        campaignId,
        buyerId: campaign.buyerId
      });

      return res
        .status(200)
        .header('Cache-Control', CACHE_CONTROL)
        .json(campaign);
    } catch (error) {
      this.logger.error('Campaign update failed', {
        requestId,
        campaignId,
        error,
        body: req.body
      });
      return next(error);
    }
  }

  /**
   * Lists campaigns with pagination and filtering
   */
  @httpGet('/')
  public async listCampaigns(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || '';

    try {
      const listRequest: IListCampaignsRequest = {
        buyerId: req.query.buyerId as string,
        vertical: req.query.vertical as any,
        status: req.query.status as any[],
        page: parseInt(req.query.page as string) || 1,
        pageSize: parseInt(req.query.pageSize as string) || 10,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as 'asc' | 'desc'
      };

      this.logger.info('Listing campaigns', {
        requestId,
        ...listRequest
      });

      const result = await this.campaignService.listCampaigns(listRequest);

      // Record metrics
      this.metrics.recordValue('campaign.list.latency', Date.now() - startTime, {
        buyerId: listRequest.buyerId,
        resultCount: result.campaigns.length
      });

      return res
        .status(200)
        .header('Cache-Control', CACHE_CONTROL)
        .json(result);
    } catch (error) {
      this.logger.error('Campaign listing failed', {
        requestId,
        error,
        query: req.query
      });
      return next(error);
    }
  }

  /**
   * Retrieves a specific campaign by ID
   */
  @httpGet('/:id')
  public async getCampaign(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || '';
    const campaignId = req.params.id;

    try {
      this.logger.info('Retrieving campaign', {
        requestId,
        campaignId
      });

      const campaign = await this.campaignService.getCampaignById(campaignId);

      if (!campaign) {
        return res.status(404).json({
          message: 'Campaign not found'
        });
      }

      // Record metrics
      this.metrics.recordValue('campaign.get.latency', Date.now() - startTime, {
        campaignId,
        buyerId: campaign.buyerId
      });

      return res
        .status(200)
        .header('Cache-Control', CACHE_CONTROL)
        .json(campaign);
    } catch (error) {
      this.logger.error('Campaign retrieval failed', {
        requestId,
        campaignId,
        error
      });
      return next(error);
    }
  }

  /**
   * Deletes a campaign by ID
   */
  @httpDelete('/:id')
  public async deleteCampaign(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || '';
    const campaignId = req.params.id;

    try {
      this.logger.info('Deleting campaign', {
        requestId,
        campaignId
      });

      await this.campaignService.deleteCampaign(campaignId);

      // Record metrics
      this.metrics.recordValue('campaign.delete.latency', Date.now() - startTime, {
        campaignId
      });

      return res.status(204).send();
    } catch (error) {
      this.logger.error('Campaign deletion failed', {
        requestId,
        campaignId,
        error
      });
      return next(error);
    }
  }
}