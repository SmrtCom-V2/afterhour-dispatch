/**
 * Database Seed Script
 * Creates demo data for development/testing
 */

import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Seeding database...');

    // Create FM Company
    const fmCompanyResult = await pool.query(
      `INSERT INTO fm_company (
         name, phone_number, ai_confidence_threshold, fm_oncall_phone, fm_oncall_name,
         status, trial_start_at, trial_end_at, owner_email, seats_limit, seats_used
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW() + INTERVAL '14 days', $7, $8, $9)
       ON CONFLICT (phone_number) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['Demo FM Company', '+49123456789', 80, '+49987654321', 'FM On-Call Manager', 'trial', 'ap@demo.com', 25, 3]
    );
    const fmCompanyId = fmCompanyResult.rows[0].id;
    console.log('Created FM Company:', fmCompanyId);

    // Create FM Admin
    const passwordHash = await bcrypt.hash('1234demo', 10);
    await pool.query(
      `INSERT INTO fm_admin (fm_company_id, email, password_hash, name, is_admin, is_platform_admin, is_super_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         is_admin = EXCLUDED.is_admin,
         is_platform_admin = EXCLUDED.is_platform_admin,
         is_super_admin = EXCLUDED.is_super_admin`,
      [fmCompanyId, 'ap@demo.com', passwordHash, 'Demo Admin', true, true, true]
    );
    console.log('Created FM Admin: ap@demo.com / 1234demo');

    // Create second FM Admin for impersonation tests
    const passwordHash2 = await bcrypt.hash('1234demo', 10);
    await pool.query(
      `INSERT INTO fm_admin (fm_company_id, email, password_hash, name, is_admin, is_platform_admin, is_super_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         is_admin = EXCLUDED.is_admin,
         is_platform_admin = EXCLUDED.is_platform_admin,
         is_super_admin = EXCLUDED.is_super_admin`,
      [fmCompanyId, 'other-admin@demo.com', passwordHash2, 'Other Admin', true, false, false]
    );
    console.log('Created FM Admin: other-admin@demo.com / 1234demo');

    // Ensure super admin email is in allowlist for local/dev
    await pool.query(`INSERT INTO super_admin_allowlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, ['ap@demo.com']);
    console.log('Added ap@demo.com to super admin allowlist');

    // Create PM Companies with service phone and full details
    const pmCompanyResult = await pool.query(
      `INSERT INTO pm_company (
         fm_company_id, name, contact_email, contact_phone, contact_name,
         service_phone, address, city, postal_code, status,
         ai_confidence_threshold, afterhours_start, afterhours_end
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        fmCompanyId,
        'Demo Property Management',
        'pm@demo.com',
        '+49111222333',
        'Peter Manager',
        '+49800123456', // Service phone - tenants call this
        'Berliner Str. 100',
        'Berlin',
        '10115',
        'active',
        80,
        '18:00',
        '07:00'
      ]
    );
    const pmCompanyId = pmCompanyResult.rows[0].id;
    console.log('Created PM Company:', pmCompanyId);

    // Create second PM Company
    const pmCompanyResult2 = await pool.query(
      `INSERT INTO pm_company (
         fm_company_id, name, contact_email, contact_phone, contact_name,
         service_phone, address, city, postal_code, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        fmCompanyId,
        'City Apartments GmbH',
        'info@cityapartments.de',
        '+49222333444',
        'Maria Verwaltung',
        '+49800654321',
        'Münchner Str. 50',
        'Munich',
        '80331',
        'active'
      ]
    );
    const pmCompany2Id = pmCompanyResult2.rows[0].id;
    console.log('Created PM Company 2:', pmCompany2Id);

    // Create Buildings
    const buildingResult = await pool.query(
      `INSERT INTO building (pm_company_id, name, address, city, afterhours_start, afterhours_end)
       VALUES
         ($1, 'Hauptstraße 10', 'Hauptstraße 10, 10115 Berlin', 'Berlin', '18:00', '07:00'),
         ($1, 'Parkweg 5', 'Parkweg 5, 10115 Berlin', 'Berlin', '18:00', '07:00')
       RETURNING id, name`,
      [pmCompanyId]
    );
    console.log('Created Buildings:', buildingResult.rows.map(b => b.name).join(', '));

    const building1Id = buildingResult.rows[0].id;
    const building2Id = buildingResult.rows[1].id;

    // Create Tenants
    await pool.query(
      `INSERT INTO tenant (building_id, name, phone, unit, status)
       VALUES
         ($1, 'Max Mustermann', '+49170111222', '1A', 'active'),
         ($1, 'Erika Musterfrau', '+49170333444', '2B', 'active'),
         ($2, 'Hans Schmidt', '+49170555666', '3A', 'active')`,
      [building1Id, building2Id]
    );
    console.log('Created Tenants');

    // Create Service Providers
    const spResult = await pool.query(
      `INSERT INTO service_provider (fm_company_id, company_name, contact_name, phone, email, trade, status)
       VALUES
         ($1, 'Schnell Klempner GmbH', 'Peter Rohre', '+49160111111', 'peter@klempner.de', 'plumber', 'active'),
         ($1, 'Elektro Fix', 'Lisa Strom', '+49160222222', 'lisa@elektro.de', 'electrician', 'active'),
         ($1, 'Schlüsseldienst 24/7', 'Tom Schlüssel', '+49160333333', 'tom@schlussel.de', 'locksmith', 'active'),
         ($1, 'Allround Service', 'Maria Alles', '+49160444444', 'maria@allround.de', 'general', 'active')
       RETURNING id, trade`,
      [fmCompanyId]
    );
    console.log('Created Service Providers');

    // Assign SPs to Buildings
    for (const sp of spResult.rows) {
      await pool.query(
        `INSERT INTO building_service_provider (building_id, service_provider_id, priority)
         VALUES ($1, $2, 1), ($3, $2, 1)
         ON CONFLICT DO NOTHING`,
        [building1Id, sp.id, building2Id]
      );
    }
    console.log('Assigned Service Providers to Buildings');

    // Create sample incident
    const callResult = await pool.query(
      `INSERT INTO call (fm_company_id, caller_phone, language)
       VALUES ($1, '+49170111222', 'de')
       RETURNING id`,
      [fmCompanyId]
    );

    await pool.query(
      `INSERT INTO incident (
         call_id, building_id,
         tenant_name_given, tenant_phone_given, tenant_address_given,
         verification_status, issue_category, issue_description,
         guided_answers, ai_confidence, is_emergency, decision, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        callResult.rows[0].id,
        building1Id,
        'Max Mustermann',
        '+49170111222',
        'Hauptstraße 10',
        'verified',
        'water_leak',
        'Water leaking from bathroom ceiling',
        JSON.stringify({ problem: 'Water dripping from ceiling', danger_type: 'water', immediate_danger: 'no' }),
        92,
        true,
        'emergency_dispatch',
        'closed',
      ]
    );
    console.log('Created sample incident');

    // Create FM Employees
    const employeeResult = await pool.query(
      `INSERT INTO fm_employee (fm_company_id, name, email, phone, role, is_active, can_be_oncall)
       VALUES
         ($1, 'Klaus Dienstleiter', 'klaus@fmcompany.de', '+49151111111', 'manager', true, true),
         ($1, 'Anna Bereitschaft', 'anna@fmcompany.de', '+49151222222', 'dispatcher', true, true),
         ($1, 'Tom Techniker', 'tom@fmcompany.de', '+49151333333', 'technician', true, true),
         ($1, 'Sarah Support', 'sarah@fmcompany.de', '+49151444444', 'dispatcher', true, false)
       RETURNING id, name`,
      [fmCompanyId]
    );
    console.log('Created FM Employees:', employeeResult.rows.map(e => e.name).join(', '));

    const employee1Id = employeeResult.rows[0].id;
    const employee2Id = employeeResult.rows[1].id;
    const employee3Id = employeeResult.rows[2].id;

    // Create On-Call Schedules
    // Klaus: Mon-Wed evenings
    await pool.query(
      `INSERT INTO on_call_schedule (fm_company_id, fm_employee_id, schedule_type, day_of_week, start_time, end_time)
       VALUES
         ($1, $2, 'recurring', 1, '18:00', '07:00'),
         ($1, $2, 'recurring', 2, '18:00', '07:00'),
         ($1, $2, 'recurring', 3, '18:00', '07:00')`,
      [fmCompanyId, employee1Id]
    );

    // Anna: Thu-Fri evenings
    await pool.query(
      `INSERT INTO on_call_schedule (fm_company_id, fm_employee_id, schedule_type, day_of_week, start_time, end_time)
       VALUES
         ($1, $2, 'recurring', 4, '18:00', '07:00'),
         ($1, $2, 'recurring', 5, '18:00', '07:00')`,
      [fmCompanyId, employee2Id]
    );

    // Tom: Weekends
    await pool.query(
      `INSERT INTO on_call_schedule (fm_company_id, fm_employee_id, schedule_type, day_of_week, start_time, end_time)
       VALUES
         ($1, $2, 'recurring', 6, '00:00', '23:59'),
         ($1, $2, 'recurring', 0, '00:00', '23:59')`,
      [fmCompanyId, employee3Id]
    );
    console.log('Created On-Call Schedules');

    console.log('\n✅ Seed completed successfully!');
    console.log('\nLogin credentials:');
    console.log('  Email: ap@demo.com');
    console.log('  Password: 1234demo');

  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
