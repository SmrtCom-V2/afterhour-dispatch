/**
 * External health check for both backend processes on this box (smrtcom-api
 * port 3333, afterhour-api port 3005). Run via cron every 5 minutes, outside
 * either Node process — so it still fires if a process is fully down (OOM
 * killed, pm2 gave up restarting, etc.), which in-process crash handlers
 * (see opsAlert.js usage in index.js) can't catch by definition.
 *
 * Reuses the same sendOpsAlert/Twilio voice-call mechanism already wired
 * into afterhour-backend, rather than duplicating alert logic in bash.
 */

import { execSync } from 'child_process';
import { sendOpsAlert } from '../src/utils/opsAlert.js';

const TARGETS = [
  { name: 'smrtcom-api', pm2Name: 'smrtcom-api', healthUrl: 'http://localhost:3333/' },
  { name: 'afterhour-api', pm2Name: 'afterhour-api', healthUrl: 'http://localhost:3005/health' },
];

function getPm2Status(pm2Name) {
  try {
    const raw = execSync('pm2 jlist', { encoding: 'utf8', timeout: 5000 });
    const list = JSON.parse(raw);
    const proc = list.find(p => p.name === pm2Name);
    return proc ? proc.pm2_env.status : 'missing';
  } catch {
    return 'unknown';
  }
}

function checkHttp(url) {
  try {
    const body = execSync(`curl -s --max-time 5 ${url}`, { encoding: 'utf8', timeout: 8000 }).trim();
    const httpCode = execSync(`curl -s -o /dev/null -w "%{http_code}" --max-time 5 ${url}`, { encoding: 'utf8', timeout: 8000 }).trim();
    return { httpCode, body };
  } catch {
    return { httpCode: '000', body: '' };
  }
}

async function main() {
  for (const target of TARGETS) {
    const pm2Status = getPm2Status(target.pm2Name);
    const { httpCode, body } = checkHttp(target.healthUrl);

    let dbDegraded = false;
    try {
      const parsed = JSON.parse(body);
      dbDegraded = parsed.status === 'degraded' || parsed.database === 'disconnected';
    } catch {
      // non-JSON or empty body — httpCode check below already covers this
    }

    if (pm2Status !== 'online') {
      await sendOpsAlert(`${target.name}_pm2_down`, `${target.name} is not running (pm2 status: ${pm2Status})`);
    } else if (httpCode !== '200') {
      await sendOpsAlert(`${target.name}_http_down`, `${target.name} not responding to health check (http ${httpCode})`);
    } else if (dbDegraded) {
      await sendOpsAlert(`${target.name}_db_degraded`, `${target.name} is up but database connection is down`);
    }
  }
}

main().catch((err) => {
  console.error('external-healthcheck failed:', err.message);
  process.exit(1);
});
