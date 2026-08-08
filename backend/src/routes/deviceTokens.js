/**
 * Device Token Registration
 * The mobile companion app registers its FCM token here after login so
 * notifyHuman()'s push channel (notificationChannel.js) has somewhere to
 * send to. One admin can have multiple devices; re-registering the same
 * token just bumps last_seen_at instead of erroring.
 */

import { Router } from 'express';
import { db } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.use(authenticateToken);

// POST /api/device-tokens — register or refresh this device's FCM token
router.post('/', async (req, res) => {
  try {
    const { fcmToken, platform } = req.body;
    if (!fcmToken) {
      return res.status(400).json({ error: 'fcmToken is required' });
    }

    await db.query(
      `INSERT INTO device_token (fm_admin_id, fcm_token, platform, last_seen_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (fcm_token) DO UPDATE SET fm_admin_id = $1, platform = $3, last_seen_at = NOW()`,
      [req.user.id, fcmToken, platform || 'android'],
    );

    logger.info('Device token registered', { adminId: req.user.id, platform: platform || 'android' });
    res.json({ success: true });
  } catch (error) {
    logger.error('Device token registration failed', { error: error.message });
    res.status(500).json({ error: 'Failed to register device token' });
  }
});

// DELETE /api/device-tokens/:token — unregister on logout, so a logged-out
// device stops receiving pushes meant for whoever's logged in now.
router.delete('/:token', async (req, res) => {
  try {
    await db.query('DELETE FROM device_token WHERE fcm_token = $1 AND fm_admin_id = $2', [
      req.params.token,
      req.user.id,
    ]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Device token removal failed', { error: error.message });
    res.status(500).json({ error: 'Failed to remove device token' });
  }
});

export default router;
