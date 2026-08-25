import { jest } from '@jest/globals';
import { createTransporter, isGmailOAuth2Configured } from '../utils/email.js';

// Unit tests for transporter-selection logic in utils/email.js. These do
// NOT hit real Gmail/SMTP — nodemailer's createTransport() only assembles
// a transport object and lazily refreshes OAuth2 tokens on first send, so
// no network call happens just from calling createTransporter(). We assert
// on the assembled config, not on an actual token exchange.

const GMAIL_VARS = [
  'GMAIL_OAUTH_USER',
  'GMAIL_OAUTH_CLIENT_ID',
  'GMAIL_OAUTH_CLIENT_SECRET',
  'GMAIL_OAUTH_REFRESH_TOKEN',
];
const SMTP_VARS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS'];

function snapshotEnv(keys) {
  const snap = {};
  for (const key of keys) snap[key] = process.env[key];
  return snap;
}

function restoreEnv(snap) {
  for (const [key, value] of Object.entries(snap)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearEnv(keys) {
  for (const key of keys) delete process.env[key];
}

describe('isGmailOAuth2Configured', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = snapshotEnv(GMAIL_VARS);
    clearEnv(GMAIL_VARS);
  });

  afterEach(() => {
    restoreEnv(originalEnv);
  });

  it('is false when no GMAIL_OAUTH_* vars are set', () => {
    expect(isGmailOAuth2Configured()).toBe(false);
  });

  it('is false when only some GMAIL_OAUTH_* vars are set (partial config)', () => {
    process.env.GMAIL_OAUTH_USER = 'admin@smrtcom.com';
    process.env.GMAIL_OAUTH_CLIENT_ID = 'client-id';
    // client secret + refresh token intentionally left unset
    expect(isGmailOAuth2Configured()).toBe(false);
  });

  it('is true only when all four GMAIL_OAUTH_* vars are set', () => {
    process.env.GMAIL_OAUTH_USER = 'admin@smrtcom.com';
    process.env.GMAIL_OAUTH_CLIENT_ID = 'client-id';
    process.env.GMAIL_OAUTH_CLIENT_SECRET = 'client-secret';
    process.env.GMAIL_OAUTH_REFRESH_TOKEN = 'refresh-token';
    expect(isGmailOAuth2Configured()).toBe(true);
  });
});

describe('createTransporter', () => {
  let originalGmailEnv;
  let originalSmtpEnv;
  let originalNodeEnv;

  beforeEach(() => {
    originalGmailEnv = snapshotEnv(GMAIL_VARS);
    originalSmtpEnv = snapshotEnv(SMTP_VARS);
    originalNodeEnv = process.env.NODE_ENV;
    clearEnv(GMAIL_VARS);
    clearEnv(SMTP_VARS);
  });

  afterEach(() => {
    restoreEnv(originalGmailEnv);
    restoreEnv(originalSmtpEnv);
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('builds a Gmail OAuth2 transport when all GMAIL_OAUTH_* vars are set, even if SMTP_HOST is also set', () => {
    process.env.GMAIL_OAUTH_USER = 'admin@smrtcom.com';
    process.env.GMAIL_OAUTH_CLIENT_ID = 'client-id';
    process.env.GMAIL_OAUTH_CLIENT_SECRET = 'client-secret';
    process.env.GMAIL_OAUTH_REFRESH_TOKEN = 'refresh-token';
    process.env.SMTP_HOST = 'smtp.example.com'; // should be ignored — OAuth2 takes priority

    const transporter = createTransporter();

    expect(transporter).not.toBeNull();
    expect(transporter.options.service).toBe('gmail');
    expect(transporter.options.auth.type).toBe('OAuth2');
    expect(transporter.options.auth.user).toBe('admin@smrtcom.com');
    expect(transporter.options.auth.clientId).toBe('client-id');
    expect(transporter.options.auth.clientSecret).toBe('client-secret');
    expect(transporter.options.auth.refreshToken).toBe('refresh-token');
  });

  it('falls back to SMTP when GMAIL_OAUTH_* is unset but SMTP_HOST is set', () => {
    process.env.SMTP_HOST = 'smtp.resend.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_SECURE = 'true';
    process.env.SMTP_USER = 'resend';
    process.env.SMTP_PASS = 'secret';

    const transporter = createTransporter();

    expect(transporter).not.toBeNull();
    expect(transporter.options.host).toBe('smtp.resend.com');
    expect(transporter.options.port).toBe(465);
    expect(transporter.options.secure).toBe(true);
    expect(transporter.options.auth.user).toBe('resend');
    expect(transporter.options.auth.pass).toBe('secret');
  });

  it('returns null when neither Gmail OAuth2 nor SMTP is configured (non-development)', () => {
    process.env.NODE_ENV = 'production';
    expect(createTransporter()).toBeNull();
  });

  it('returns null (with a warning) when neither is configured in development', () => {
    process.env.NODE_ENV = 'development';
    expect(createTransporter()).toBeNull();
  });

  it('defaults SMTP port to 587 when SMTP_PORT is unset', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    const transporter = createTransporter();
    expect(transporter.options.port).toBe(587);
  });
});
