/**
 * @fileoverview Campaign routes configuration with comprehensive security, validation,
 * and documentation for the Multi-Vertical Insurance Lead Generation Platform.
 * @version 1.0.0
 */

import { Router } from 'express'; // v4.18.2
import { Container } from 'inversify'; // v6.0.1
import { authenticate } from 'passport-jwt'; // v4.0.1
import { body, param, query, validationResult } from 'express-validator'; // v7.0.0
import { rateLimit } from 'express-rate-limit'; // v6.7.0
import { OpenAPI } from 'swagger-jsdoc'; // v6.2.8

import { CampaignController } from '../controllers/campaign.controller';
import { InsuranceVertical, CampaignStatus } from '../interfaces/campaign.interface';

// Dependency injection type definitions
const TYPES = {
  CampaignController: Symbol.for('CampaignController')
};

// API versioning
const API_VERSION = 'v1';

// Rate limiting configuration
const campaignRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests from this IP, please try again later'
});

/**
 * Configures and returns the campaign router with comprehensive security and validation
 */
export default function configureCampaignRoutes(container: Container): Router {
  const router = Router();
  const campaignController = container.get<CampaignController>(TYPES.CampaignController);

  // Common validation middleware
  const validateRequest = (req: any, res: any, next: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  };

  /**
   * @openapi
   * /api/v1/campaigns:
   *   post:
   *     summary: Create a new campaign
   *     security:
   *       - BearerAuth: []
   */
  router.post(
    `/${API_VERSION}/campaigns`,
    authenticate('jwt', { session: false }),
    campaignRateLimiter,
    [
      body('buyerId').isString().notEmpty(),
      body('name').isString().isLength({ min: 3, max: 100 }),
      body('vertical').isIn(Object.values(InsuranceVertical)),
      body('filters.rules').isArray().notEmpty(),
      body('filters.matchType').isIn(['ALL', 'ANY']),
      body('maxCpl').isFloat({ min: 0 }),
      body('dailyBudget').isFloat({ min: 0 })
    ],
    validateRequest,
    campaignController.createCampaign
  );

  /**
   * @openapi
   * /api/v1/campaigns/{id}:
   *   put:
   *     summary: Update an existing campaign
   *     security:
   *       - BearerAuth: []
   */
  router.put(
    `/${API_VERSION}/campaigns/:id`,
    authenticate('jwt', { session: false }),
    campaignRateLimiter,
    [
      param('id').isMongoId(),
      body('name').optional().isString().isLength({ min: 3, max: 100 }),
      body('filters').optional().isObject(),
      body('maxCpl').optional().isFloat({ min: 0 }),
      body('dailyBudget').optional().isFloat({ min: 0 }),
      body('status').optional().isIn(Object.values(CampaignStatus))
    ],
    validateRequest,
    campaignController.updateCampaign
  );

  /**
   * @openapi
   * /api/v1/campaigns:
   *   get:
   *     summary: List campaigns with filtering and pagination
   *     security:
   *       - BearerAuth: []
   */
  router.get(
    `/${API_VERSION}/campaigns`,
    authenticate('jwt', { session: false }),
    [
      query('buyerId').optional().isString(),
      query('vertical').optional().isIn(Object.values(InsuranceVertical)),
      query('status').optional().isArray(),
      query('page').optional().isInt({ min: 1 }),
      query('pageSize').optional().isInt({ min: 1, max: 100 }),
      query('sortBy').optional().isString(),
      query('sortOrder').optional().isIn(['asc', 'desc'])
    ],
    validateRequest,
    campaignController.listCampaigns
  );

  /**
   * @openapi
   * /api/v1/campaigns/{id}:
   *   get:
   *     summary: Get campaign by ID
   *     security:
   *       - BearerAuth: []
   */
  router.get(
    `/${API_VERSION}/campaigns/:id`,
    authenticate('jwt', { session: false }),
    [param('id').isMongoId()],
    validateRequest,
    campaignController.getCampaign
  );

  /**
   * @openapi
   * /api/v1/campaigns/{id}:
   *   delete:
   *     summary: Delete campaign by ID
   *     security:
   *       - BearerAuth: []
   */
  router.delete(
    `/${API_VERSION}/campaigns/:id`,
    authenticate('jwt', { session: false }),
    campaignRateLimiter,
    [param('id').isMongoId()],
    validateRequest,
    campaignController.deleteCampaign
  );

  // Error handling middleware
  router.use((err: any, req: any, res: any, next: any) => {
    console.error(err.stack);
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });

  return router;
}