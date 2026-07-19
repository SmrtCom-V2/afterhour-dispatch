/**
 * FM After-Hours Dispatch System - Backend API
 * Main entry point
 */

// Must be imported before any route files — patches Express's router so an
// async handler's rejected promise reaches errorHandler instead of hanging
// the request forever. Several Super Admin routes have no manual try/catch
// (an audit found ~15 route files with zero try blocks across dozens of
// handlers); this is the one-line fix that covers all of them at once
// instead of hand-adding try/catch to every handler.
import 'express-async-errors';
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
import { authenticateToken } from './middleware/auth.js';
import { requireActiveSubscription } from './middleware/requireActiveSubscription.js';
import { initializeScheduler } from './jobs/scheduler.js';
import { sendOpsAlert } from './utils/opsAlert.js';

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
import deviceTokensRoutes from './routes/deviceTokens.js';
import ownerVisitReportRoutes from './routes/ownerVisitReport.js';

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

// Stricter limiter for credential/account-abuse endpoints (login,
// password reset, registration/email-check) — the shared limiter above
// is sized for normal dashboard traffic and far too loose to stop
// brute-forcing or email enumeration on these specifically.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.nodeEnv === 'development' ? 1000 : 10,
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

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
app.use('/api/auth/login', authLimiter);
app.use('/api/password-reset', authLimiter);
app.use('/api/register', authLimiter);
app.use('/api/auth', authRoutes);
// Core product routes — require an active (trial or paid) subscription.
// Billing/settings/auth/webhooks/cockpit/sp-report stay exempt: a blocked
// customer still needs to log in, see why, and pay; external SPs and Twilio
// hit sp-report/webhooks unauthenticated; cockpit is a token-authed page
// used mid-emergency, not tied to the logged-in company's billing state.
app.use('/api/buildings', authenticateToken, requireActiveSubscription, buildingsRoutes);
app.use('/api/tenants', authenticateToken, requireActiveSubscription, tenantsRoutes);
app.use('/api/service-providers', authenticateToken, requireActiveSubscription, serviceProvidersRoutes);
app.use('/api/pm-companies', authenticateToken, requireActiveSubscription, pmCompaniesRoutes);
app.use('/api/incidents', authenticateToken, requireActiveSubscription, incidentsRoutes);
app.use('/api/reports', authenticateToken, requireActiveSubscription, reportsRoutes);
app.use('/api/employees', authenticateToken, requireActiveSubscription, employeesRoutes);
app.use('/api/oncall', authenticateToken, requireActiveSubscription, oncallRoutes);
app.use('/api/sp-report', spReportRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/cockpit', cockpitRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/register', registerRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/email-verification', emailVerificationRoutes);
app.use('/api/signup-verification', signupVerificationRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/gdpr', gdprRoutes);
app.use('/api/device-tokens', deviceTokensRoutes);
app.use('/api/owner-visit-report', ownerVisitReportRoutes);

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

// Crash alerting — without this, a crash at 3am is silent until a
// customer complains. pm2 restarts the process either way; this just
// makes sure a human finds out it happened.
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  sendOpsAlert('uncaught_exception', `Backend crashed: ${error.message}`).finally(() => {
    process.exit(1);
  });
});

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  logger.error('Unhandled promise rejection', { error: message });
  sendOpsAlert('unhandled_rejection', `Unhandled rejection: ${message}`);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await db.end();
  process.exit(0);
});

start();

export default app;
