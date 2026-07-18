/**
 * FM After-Hours Dispatch System - Backend API
 * Main entry point
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { db } from './db/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { initializeScheduler } from './jobs/scheduler.js';

// Routes
import authRoutes from './routes/auth.js';
import buildingsRoutes from './routes/buildings.js';
import tenantsRoutes from './routes/tenants.js';
import serviceProvidersRoutes from './routes/serviceProviders.js';
import pmCompaniesRoutes from './routes/pmCompanies.js';
import incidentsRoutes from './routes/incidents.js';
import reportsRoutes from './routes/reports.js';
import spReportRoutes from './routes/spReport.js';
import webhooksRoutes from './routes/webhooks.js';
import cockpitRoutes from './routes/cockpit.js';
import saAuthRoutes from './routes/saAuth.js';
import saCompaniesRoutes from './routes/saCompanies.js';
import saAuditLogsRoutes from './routes/saAuditLogs.js';
import saSettingsRoutes from './routes/saSettings.js';
import saDashboardRoutes from './routes/saDashboard.js';
import saBillingRoutes from './routes/saBilling.js';
import saTrialsRoutes from './routes/saTrials.js';
import saSystemHealthRoutes from './routes/saSystemHealth.js';
import saExportRoutes from './routes/saExport.js';
import saUsageRoutes from './routes/saUsage.js';
import saSupportRoutes from './routes/saSupport.js';
import saUsersRoutes from './routes/saUsers.js';
import saFeatureFlagsRoutes from './routes/saFeatureFlags.js';
import saGdprRoutes from './routes/saGdpr.js';
import saEntitlementsRoutes from './routes/saEntitlements.js';
import customerEntitlementsRoutes from './routes/customerEntitlements.js';
import employeesRoutes from './routes/employees.js';
import oncallRoutes from './routes/oncall.js';
import settingsRoutes from './routes/settings.js';
import registerRoutes from './routes/register.js';
import passwordResetRoutes from './routes/passwordReset.js';
import emailVerificationRoutes from './routes/emailVerification.js';
import signupVerificationRoutes from './routes/signupVerification.js';
import billingRoutes from './routes/billing.js';
import stripeWebhookRoutes from './routes/stripeWebhook.js';
import gdprRoutes from './routes/gdpr.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Trust nginx's X-Forwarded-For (this app always runs behind the reverse
// proxy in every real deployment). Without this, express-rate-limit throws
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR on every request instead of rate-limiting
// by real client IP — discovered live July 18 once external Twilio webhook
// traffic first hit this server. `1` = trust exactly one hop (nginx).
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));

// CORS
app.use(cors({
  origin: (origin, callback) => {
    if (config.nodeEnv === 'production') return callback(null, process.env.FRONTEND_URL);
    // Allow local dev hosts on common ports (5173/5174/5175) and backend
    if (!origin) return callback(null, true);
    const allowed = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5180', 'http://localhost:3000', 'http://localhost:4000'];
    return callback(null, allowed.includes(origin));
  },
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.nodeEnv === 'development' ? 1000 : 100, // Higher limit in dev
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Stripe webhook (needs raw body - must be before express.json())
app.use('/api/stripe-webhook', stripeWebhookRoutes);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', async (req, res) => {
  const dbHealthy = await db.healthCheck();
  res.json({
    status: dbHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    database: dbHealthy ? 'connected' : 'disconnected',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/buildings', buildingsRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/service-providers', serviceProvidersRoutes);
app.use('/api/pm-companies', pmCompaniesRoutes);
app.use('/api/incidents', incidentsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/sp-report', spReportRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/cockpit', cockpitRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/oncall', oncallRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/register', registerRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/email-verification', emailVerificationRoutes);
app.use('/api/signup-verification', signupVerificationRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/gdpr', gdprRoutes);

// Super Admin Routes
app.use('/sa/auth', saAuthRoutes);
app.use('/sa/companies', saCompaniesRoutes);
app.use('/sa/audit-logs', saAuditLogsRoutes);
app.use('/sa/settings', saSettingsRoutes);
app.use('/sa/dashboard', saDashboardRoutes);
app.use('/sa/billing', saBillingRoutes);
app.use('/sa/trials', saTrialsRoutes);
app.use('/sa/system-health', saSystemHealthRoutes);
app.use('/sa/export', saExportRoutes);
app.use('/sa/usage', saUsageRoutes);
app.use('/sa/support', saSupportRoutes);
app.use('/sa/users', saUsersRoutes);
app.use('/sa/feature-flags', saFeatureFlagsRoutes);
app.use('/sa/gdpr', saGdprRoutes);
app.use('/sa/entitlements', saEntitlementsRoutes);

// Customer Entitlements (mounted at /api for customer-facing endpoints)
app.use('/api', customerEntitlementsRoutes);

// SP Report public page (redirect to frontend)
app.get('/report/:token', (req, res) => {
  const { token } = req.params;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${frontendUrl}/report/${token}`);
});

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
async function start() {
  try {
    // Check database connection
    const dbHealthy = await db.healthCheck();
    if (!dbHealthy) {
      // Allow starting the server in development mode without a running DB when
      // the developer explicitly sets FORCE_START_WITHOUT_DB=1. This is a
      // convenience for UI work where installing a DB is not desired.
      if (config.nodeEnv === 'development' && process.env.FORCE_START_WITHOUT_DB === '1') {
        logger.warn('Database connection failed, continuing in development mode (FORCE_START_WITHOUT_DB=1)');
      } else {
        logger.error('Database connection failed');
        process.exit(1);
      }
    } else {
      logger.info('Database connected');

      // Initialize scheduler
      initializeScheduler();
    }

    // Start listening
    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    logger.error('Server startup failed', { error: error.message });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await db.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await db.end();
  process.exit(0);
});

start();

export default app;
