/**
 * Correlation ID middleware — assigns one ID per incoming request, echoed
 * back as X-Request-Id and attached to req.id so every log line emitted
 * while handling this request can be tied together and to the client-visible
 * response header. Accepts an inbound X-Request-Id (e.g. forwarded by nginx
 * or another internal service) instead of always minting a fresh one, so a
 * single logical request crossing service boundaries keeps one ID end to end.
 */
import { randomUUID } from 'crypto';

export function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

export default requestId;
