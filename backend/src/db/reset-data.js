/**
 * Reset all data in the database
 * Keeps schema, packages, and features intact
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function resetData() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Resetting database data...');

    // Delete in order respecting foreign keys (children first)
    const tables = [
      'sp_report_attachment',
      'sp_report',
      'dispatch_attempt',
      'incident_timeline',
      'incident',
      'call',
      'morning_report',
      'building_service_provider',
      'tenant',
      'building',
      'service_provider',
      'pm_company',
      'on_call_schedule',
      'fm_employee',
      'support_notes',
      'audit_log',
      'sa_audit_log',
      'company_events',
      'company_addons',
      'entitlement_audit_events',
      'fm_admin',
      'fm_company',
    ];

    for (const table of tables) {
      try {
        await pool.query(`TRUNCATE TABLE ${table} CASCADE`);
        console.log(`  Cleared: ${table}`);
      } catch (err) {
        // Table might not exist, skip
        if (!err.message.includes('does not exist')) {
          console.warn(`  Warning: ${table} - ${err.message}`);
        }
      }
    }

    console.log('\n✅ All data deleted successfully!');
    console.log('\nTo re-seed demo data, run: npm run db:seed');

  } catch (error) {
    console.error('Reset failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetData();
