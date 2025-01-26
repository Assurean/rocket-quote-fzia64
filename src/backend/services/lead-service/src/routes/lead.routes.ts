import { Router } from 'express'; // ^4.18.0
import { body, param, query, ValidationChain } from 'express-validator'; // ^7.0.0
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.0.0
import rateLimit from 'express-rate-limit'; // ^6.7.0
import { LeadController } from '../controllers/lead.controller';
import { InsuranceVertical, LeadStatus } from '../interfaces/lead.interface';

// Route prefix constant
const LEAD_ROUTES_PREFIX = '/api/v1/leads';

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

/**
 * Lead ID validation chain
 */
const validateLeadId: ValidationChain = param('id')
  .exists()
  .withMessage('Lead ID is required')
  .isUUID()
  .withMessage('Invalid lead ID format')
  .trim();

/**
 * Create lead validation chain
 */
const validateCreateLead: ValidationChain[] = [
  body('vertical')
    .isIn(Object.values(InsuranceVertical))
    .withMessage('Invalid insurance vertical'),
  body('contact_info')
    .isObject()
    .withMessage('Contact information is required'),
  body('contact_info.firstName')
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('contact_info.lastName')
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('contact_info.email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
  body('contact_info.phone')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format'),
  body('contact_info.address')
    .isObject()
    .withMessage('Address is required'),
  body('vertical_data')
    .isObject()
    .withMessage('Vertical-specific data is required'),
  body('traffic_source')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Traffic source is required')
];

/**
 * Update lead status validation chain
 */
const validateUpdateStatus: ValidationChain[] = [
  validateLeadId,
  body('status')
    .isIn(Object.values(LeadStatus))
    .withMessage('Invalid lead status')
];

/**
 * Search leads validation chain
 */
const validateSearchLeads: ValidationChain[] = [
  query('vertical')
    .optional()
    .isIn(Object.values(InsuranceVertical))
    .withMessage('Invalid insurance vertical'),
  query('status')
    .optional()
    .isIn(Object.values(LeadStatus))
    .withMessage('Invalid lead status'),
  query('minScore')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Min score must be between 0 and 100'),
  query('maxScore')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Max score must be between 0 and 100'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

/**
 * Configure and export lead routes
 */
export function configureLeadRoutes(leadController: LeadController): Router {
  const router = Router();

  // Apply security middleware
  router.use(helmet());
  router.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400 // 24 hours
  }));

  // Apply rate limiting
  const limiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW,
    max: RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests, please try again later'
  });
  router.use(limiter);

  // Health check endpoint
  router.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
  });

  // Lead endpoints with validation
  router.post('/',
    validateCreateLead,
    leadController.createLead.bind(leadController)
  );

  router.get('/:id',
    validateLeadId,
    leadController.getLead.bind(leadController)
  );

  router.patch('/:id/status',
    validateUpdateStatus,
    leadController.updateLeadStatus.bind(leadController)
  );

  router.get('/',
    validateSearchLeads,
    leadController.searchLeads.bind(leadController)
  );

  return router;
}

// Export configured router
export const leadRouter = configureLeadRoutes(new LeadController(
  // Dependencies will be injected by the DI container
  null as any, // leadService
  null as any  // logger
));

export default leadRouter;