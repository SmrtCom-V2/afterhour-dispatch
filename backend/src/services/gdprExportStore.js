/**
 * Where completed GDPR data-export JSON files live on disk.
 *
 * Deliberately NOT under backend/uploads — that directory is served
 * publicly via `express.static('/uploads', ...)` in index.js, and a GDPR
 * export is a full dump of one person's PII. It must only be reachable
 * through the authenticated route (GET /api/gdpr/download-export/:id in
 * gdpr.js), which checks the requester owns the request before streaming
 * the file — never by guessing/knowing a static URL.
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const GDPR_EXPORT_DIR = path.join(__dirname, '../../private-gdpr-exports');
