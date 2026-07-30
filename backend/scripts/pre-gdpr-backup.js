#!/usr/bin/env node
/**
 * Pre-GDPR-deletion backup.
 *
 * Run this ON THE SERVER before approving any GDPR deletion request via
 * POST /sa/gdpr/deletion-requests/:id/approve — that route refuses to run
 * (412 Precondition Failed) unless this script has written a marker file
 * within the last 30 minutes.
 *
 * Usage (on EC2, from /home/ubuntu/afterhour-backend):
 *   node scripts/pre-gdpr-backup.js
 *
 * What it does:
 *   1. Reads DATABASE_URL from the running process's .env (same source the
 *      app itself uses — never hardcode credentials here).
 *   2. Runs pg_dump to a timestamped .sql file in ../backups (matches the
 *      existing nightly backup.sh convention: fm_afterhours_backup_*.sql).
 *   3. Writes a JSON marker (.gdpr-backup-marker.json) recording the backup
 *      file path + timestamp, which saGdpr.js checks before executing.
 *
 * After running this, ALSO copy the resulting file down to
 * C:\Users\The boss\RBY.inc\projects\smrtcom\After hour\db-backups\ per the
 * standing data-protection rule (scp it down manually — this script only
 * handles the server side).
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const BACKUP_DIR = path.join(__dirname, '../../backups');
const MARKER_PATH = path.join(__dirname, '../.gdpr-backup-marker.json');

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set — cannot back up. Aborting.');
    process.exit(1);
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const ts = timestamp();
  const outFile = path.join(BACKUP_DIR, `fm_afterhours_gdpr_backup_${ts}.sql`);

  console.log(`Running pg_dump -> ${outFile}`);
  try {
    // pg_dump reads the connection string directly; nothing is echoed here.
    execSync(`pg_dump "${dbUrl}" > "${outFile}"`, { stdio: ['ignore', 'ignore', 'inherit'] });
  } catch (err) {
    console.error('pg_dump failed:', err.message);
    // Clean up an empty/partial file so a failed backup can't look like a
    // real one.
    if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
    process.exit(1);
  }

  const stats = fs.statSync(outFile);
  if (stats.size === 0) {
    console.error('pg_dump produced an empty file — treating as failure.');
    fs.unlinkSync(outFile);
    process.exit(1);
  }

  const marker = {
    file: outFile,
    sizeBytes: stats.size,
    takenAt: new Date().toISOString(),
  };
  fs.writeFileSync(MARKER_PATH, JSON.stringify(marker, null, 2));

  console.log(`Backup OK: ${outFile} (${stats.size} bytes)`);
  console.log(`Marker written: ${MARKER_PATH}`);
  console.log('');
  console.log('REMINDER: copy this file down to the local db-backups folder:');
  console.log(`  scp -i ~/.ssh/smrtcom-deploy.pem ubuntu@18.158.137.108:${outFile} \\`);
  console.log(`    "C:\\Users\\The boss\\RBY.inc\\projects\\smrtcom\\After hour\\db-backups\\"`);
}

main();
