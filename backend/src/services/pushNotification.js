/**
 * Push notification sender (Firebase Cloud Messaging), used by
 * notificationChannel.js's 'push' channel. Requires FIREBASE_SERVICE_ACCOUNT
 * (JSON, base64-encoded) in .env — silently no-ops if not configured, same
 * pattern as the Twilio/Stripe "not configured" guards elsewhere.
 */

import { logger } from '../utils/logger.js';
import { db } from '../db/index.js';

let firebaseApp = null;
let initAttempted = false;

async function getFirebaseApp() {
  if (initAttempted) return firebaseApp;
  initAttempted = true;

  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!encoded) {
    logger.warn('FIREBASE_SERVICE_ACCOUNT not configured — push notifications disabled');
    return null;
  }

  try {
    const admin = await import('firebase-admin');
    const serviceAccount = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
    firebaseApp = admin.default.initializeApp({
      credential: admin.default.cert(serviceAccount),
    });
    logger.info('Firebase Admin SDK initialized');
    return firebaseApp;
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK', { error: error.message });
    return null;
  }
}

/**
 * Sends a push to every device registered for the given fm_admin. Returns
 * true if at least one device received it. A person can have multiple
 * devices (phone + tablet); this fans out to all of them, not just one.
 */
export async function sendPushToAdmin(adminId, { title, body, data = {} }) {
  const app = await getFirebaseApp();
  if (!app) return false;

  const tokens = await db.query('SELECT fcm_token, platform FROM device_token WHERE fm_admin_id = $1', [adminId]);
  if (tokens.rows.length === 0) {
    logger.info('sendPushToAdmin: no registered devices', { adminId });
    return false;
  }

  let anySent = false;
  const { getMessaging } = await import('firebase-admin/messaging');

  for (const row of tokens.rows) {
    try {
      // Blocker (2026-08-08 Go/No-Go audit): android.priority='high' was sent
      // unconditionally, including to iOS-registered tokens — FCM silently
      // ignores that block for iOS, so a backgrounded iPhone never got the
      // high-priority wake used for emergency alerts. apns-priority 10 +
      // content-available is the iOS equivalent (required for background delivery).
      const priorityConfig = row.platform === 'ios'
        ? { apns: { headers: { 'apns-priority': '10' }, payload: { aps: { 'content-available': 1 } } } }
        : { android: { priority: 'high' } };

      await getMessaging(app).send({
        token: row.fcm_token,
        notification: { title, body },
        data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
        ...priorityConfig,
      });
      anySent = true;
    } catch (error) {
      logger.error('Push send failed for one device', { adminId, error: error.message });
      // A stale/uninstalled-app token fails with 'messaging/registration-token-not-registered'
      // — clean it up so future sends don't keep trying a dead token.
      if (error.code === 'messaging/registration-token-not-registered') {
        await db.query('DELETE FROM device_token WHERE fcm_token = $1', [row.fcm_token]).catch(() => {});
      }
    }
  }

  return anySent;
}
