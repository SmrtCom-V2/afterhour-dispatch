import dotenv from 'dotenv';
dotenv.config();

// A missing JWT_SECRET must never silently fall back to a public default —
// that would make every JWT (including super-admin) forgeable using a
// string visible in source control. Fail startup instead of serving traffic
// under a broken security guarantee.
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required and must not be empty.');
}

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // Telephony (provider-agnostic)
  telephony: {
    provider: process.env.TELEPHONY_PROVIDER || 'twilio',
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    },
  },

  // Voice AI (provider-agnostic)
  voiceAi: {
    provider: process.env.VOICE_AI_PROVIDER || 'openai',
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },
  },

  // Email
  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
  },

  // Storage
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    localPath: process.env.STORAGE_PATH || './uploads',
    s3: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION,
    },
  },

  // App-specific
  app: {
    url: process.env.APP_URL || 'http://localhost:3005',
    defaultAiConfidenceThreshold: parseInt(process.env.DEFAULT_AI_CONFIDENCE_THRESHOLD || '80', 10),
    spCallTimeoutSeconds: parseInt(process.env.SP_CALL_TIMEOUT_SECONDS || '120', 10),
    spSmsTimeoutSeconds: parseInt(process.env.SP_SMS_TIMEOUT_SECONDS || '600', 10),
    morningReportHour: parseInt(process.env.MORNING_REPORT_HOUR || '7', 10),
    spReportDeadlineHour: parseInt(process.env.SP_REPORT_DEADLINE_HOUR || '9', 10),
  },

  // Emergency classification rules (hard-coded MVP defaults)
  emergencyRules: {
    hardEmergencies: [
      'water_leak',
      'fire',
      'smoke',
      'gas_smell',
      'total_power_outage',
    ],
    notEmergencies: [
      'lockout', // Unless FM overrides
    ],
  },
};

export default config;
