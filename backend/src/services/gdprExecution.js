/**
 * GDPR Execution Service
 *
 * Real deletion/export logic against the ACTUAL schema (fm_admin / tenant /
 * fm_employee / call / incident — not the plural users/incidents/pm_companies
 * schema saGdpr.js was originally written against, which is why that file
 * used to be a hard 501).
 *
 * Subject model: a `gdpr_deletion_requests.user_id` / `gdpr_export_requests.user_id`
 * always points at `fm_admin.id` — that is the only login-capable identity in
 * this system (tenants and fm_employees have no accounts, so they can never
 * submit a request themselves; an fm_admin submits on their own behalf).
 * "Delete my data" for an fm_admin therefore means: anonymize the fm_admin's
 * own login identity, AND anonymize the PII of the tenants/employees inside
 * their company, since an fm_admin is normally the owner of that company's
 * data and Article 17 requests from a company owner typically mean "wipe our
 * tenant data too" in practice for a single-admin-per-company MVP (see
 * schema.sql comment: "single admin per FM company in MVP"). Where a company
 * has multiple fm_admin rows (is_admin=false staff accounts), only that one
 * admin's own identity is scrubbed — tenant/employee data is shared company
 * data, not that one non-owner user's personal data, so it is only wiped when
 * the requesting admin IS the company (is_admin = true / sole admin).
 *
 * Anonymize vs delete, by table:
 * - fm_admin: ANONYMIZE (scrub email/name/phone, invalidate password_hash,
 *   set disabled=true). Never hard-delete: fm_admin.id is a NOT NULL FK
 *   target from audit_log.actor_admin_id and sa_audit_log — deleting the row
 *   would either cascade-delete unrelated audit history or violate the FK.
 *   Anonymizing preserves referential integrity and the audit trail while
 *   removing the personal identifiers.
 * - tenant: ANONYMIZE (name/phone/email/secondary_phone/notes scrubbed, kept
 *   inactive). tenant.id is referenced by incident.tenant_id (nullable FK,
 *   ON DELETE not cascading — actually no ON DELETE clause means default
 *   RESTRICT, so hard-deleting a tenant with incidents would fail anyway).
 *   Anonymizing avoids breaking incident history/audit trail for a real
 *   emergency-dispatch record (which itself may need retention for safety/
 *   liability reasons independent of GDPR).
 * - fm_employee: ANONYMIZE, same FK-safety reasoning (referenced by
 *   on_call_schedule.fm_employee_id, dispatch history).
 * - call.transcript / call.caller_phone: SCRUB when the call's caller_phone
 *   matches the deleted person's phone number — transcripts can contain full
 *   conversation content including what was said, which is PII in itself.
 * - consent_log / audit_log / sa_audit_log / company_events / support_notes:
 *   NOT scrubbed. These are the compliance/security audit trail. GDPR Art.
 *   17(3)(b) permits retaining data necessary for compliance with a legal
 *   obligation, and Art. 17(3)(e) for legal claims — a B2B SaaS audit trail
 *   of who-did-what-when is retained for exactly that reason. The FK
 *   (actor_admin_id / user_id) still points at the now-anonymized fm_admin
 *   row, so "who" resolves to "[deleted user]" after anonymization rather
 *   than orphaning the log.
 *
 * A full pg_dump backup must be taken (both server-side and copied to the
 * local db-backups folder) before calling executeAnonymization — this
 * module does not take the backup itself, the caller (saGdpr.js route) does,
 * so the backup step is visible/auditable at the call site.
 */

import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';

const REDACTED_EMAIL_DOMAIN = 'deleted.invalid';

function redactedEmail(id) {
  return `deleted-${id}@${REDACTED_EMAIL_DOMAIN}`;
}

/**
 * Anonymize an fm_admin's own login identity.
 * Does NOT touch password verification path beyond making the hash useless
 * (disabled=true already blocks login via requireActiveSubscription/auth
 * checks elsewhere, but we also invalidate the hash defensively).
 */
async function anonymizeFmAdmin(client, adminId) {
  const result = await client.query(
    `UPDATE fm_admin
     SET name = '[deleted]',
         email = $2,
         phone = NULL,
         password_hash = '',
         disabled = TRUE,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, fm_company_id`,
    [adminId, redactedEmail(adminId)]
  );
  return result.rows[0] || null;
}

/**
 * Anonymize every tenant row under the fm_company (via pm_company -> building -> tenant).
 */
async function anonymizeTenantsForCompany(client, fmCompanyId) {
  const result = await client.query(
    `UPDATE tenant t
     SET name = '[deleted]',
         phone = '000000000',
         email = NULL,
         secondary_phone = NULL,
         notes = NULL,
         status = 'inactive',
         updated_at = NOW()
     FROM building b, pm_company pm
     WHERE t.building_id = b.id
       AND b.pm_company_id = pm.id
       AND pm.fm_company_id = $1
       AND t.name != '[deleted]'
     RETURNING t.id, t.phone AS new_phone`,
    [fmCompanyId]
  );
  return result.rows.map((r) => r.id);
}

/**
 * Anonymize every fm_employee row under the fm_company.
 */
async function anonymizeEmployeesForCompany(client, fmCompanyId) {
  const result = await client.query(
    `UPDATE fm_employee
     SET name = '[deleted]',
         email = NULL,
         phone = '000000000',
         notes = NULL,
         is_active = FALSE,
         can_be_oncall = FALSE,
         updated_at = NOW()
     WHERE fm_company_id = $1
       AND name != '[deleted]'
     RETURNING id`,
    [fmCompanyId]
  );
  return result.rows.map((r) => r.id);
}

/**
 * Scrub call transcripts/caller numbers that belonged to the tenants/incidents
 * of this company, since a transcript can contain a tenant's spoken PII
 * (name, address, description of what happened). Keep call/incident rows
 * themselves for operational/safety record-keeping — only null out the
 * free-text content and phone number.
 */
async function scrubCallContentForCompany(client, fmCompanyId) {
  const result = await client.query(
    `UPDATE call
     SET transcript = NULL,
         caller_phone = '000000000'
     WHERE fm_company_id = $1
       AND transcript IS NOT NULL
     RETURNING id`,
    [fmCompanyId]
  );
  return result.rows.map((r) => r.id);
}

/**
 * Also scrub the free-text tenant fields captured directly on `incident`
 * (tenant_name_given / tenant_phone_given / tenant_address_given) — these are
 * a snapshot taken at call time and are NOT foreign-keyed to tenant, so they
 * survive tenant anonymization untouched unless handled separately.
 */
async function scrubIncidentCapturedPiiForCompany(client, fmCompanyId) {
  const result = await client.query(
    `UPDATE incident i
     SET tenant_name_given = '[deleted]',
         tenant_phone_given = '000000000',
         tenant_address_given = NULL
     FROM call c
     WHERE i.call_id = c.id
       AND c.fm_company_id = $1
       AND i.tenant_name_given IS NOT NULL
       AND i.tenant_name_given != '[deleted]'
     RETURNING i.id`,
    [fmCompanyId]
  );
  return result.rows.map((r) => r.id);
}

/**
 * Execute a deletion request. Determines scope (own identity only, vs whole
 * company's tenant/employee data) based on whether the requesting admin is
 * the company's admin (is_admin = true). Returns a summary for audit logging.
 *
 * MUST be called after a verified pg_dump backup exists — this function does
 * not take one itself.
 */
export async function executeAnonymization({ adminId }) {
  return db.transaction(async (client) => {
    const adminRow = await client.query(
      `SELECT id, fm_company_id, is_admin FROM fm_admin WHERE id = $1`,
      [adminId]
    );

    if (adminRow.rows.length === 0) {
      throw new Error('fm_admin not found — cannot execute deletion');
    }

    const { fm_company_id: fmCompanyId, is_admin: isAdmin } = adminRow.rows[0];

    const summary = {
      admin_id: adminId,
      fm_company_id: fmCompanyId,
      scope: isAdmin ? 'company_owner' : 'self_only',
      tenants_anonymized: [],
      employees_anonymized: [],
      calls_scrubbed: [],
      incidents_scrubbed: [],
    };

    // Company-wide scrub only when the requester is the company's admin —
    // a non-admin fm_admin deleting their own account should not wipe
    // shared company data (tenants/employees) that belongs to the business,
    // not to them personally.
    if (isAdmin) {
      summary.tenants_anonymized = await anonymizeTenantsForCompany(client, fmCompanyId);
      summary.employees_anonymized = await anonymizeEmployeesForCompany(client, fmCompanyId);
      summary.calls_scrubbed = await scrubCallContentForCompany(client, fmCompanyId);
      summary.incidents_scrubbed = await scrubIncidentCapturedPiiForCompany(client, fmCompanyId);
    }

    const anonymizedAdmin = await anonymizeFmAdmin(client, adminId);
    summary.admin_anonymized = !!anonymizedAdmin;

    logger.info('GDPR deletion executed', summary);
    return summary;
  });
}

/**
 * Build a full personal-data export for one fm_admin, scoped to what they
 * can see/own: their own fm_admin record, their company's tenants,
 * employees, and incidents (redacted to what's relevant — this is an
 * export of the requester's OWN data, so we include the company data they
 * are the custodian of, not other admins' personal data at other companies).
 */
export async function buildDataExport({ adminId }) {
  const adminResult = await db.query(
    `SELECT id, email, name, phone, is_admin, is_platform_admin, created_at, last_login_at
     FROM fm_admin WHERE id = $1`,
    [adminId]
  );

  if (adminResult.rows.length === 0) {
    throw new Error('fm_admin not found — cannot build export');
  }

  const admin = adminResult.rows[0];

  const companyResult = await db.query(
    `SELECT id, name, phone_number, status, owner_email, created_at
     FROM fm_company WHERE id = (SELECT fm_company_id FROM fm_admin WHERE id = $1)`,
    [adminId]
  );

  const consentResult = await db.query(
    `SELECT consent_type, consented, created_at FROM consent_log
     WHERE user_id = $1 ORDER BY created_at DESC`,
    [adminId]
  );

  const auditResult = await db.query(
    `SELECT action_type, created_at FROM audit_log
     WHERE actor_admin_id = $1 ORDER BY created_at DESC LIMIT 500`,
    [adminId]
  );

  const tenantsResult = await db.query(
    `SELECT t.id, t.name, t.phone, t.email, t.unit, t.status, t.created_at
     FROM tenant t
     JOIN building b ON t.building_id = b.id
     JOIN pm_company pm ON b.pm_company_id = pm.id
     WHERE pm.fm_company_id = $1`,
    [companyResult.rows[0]?.id]
  ).catch(() => ({ rows: [] }));

  const employeesResult = await db.query(
    `SELECT id, name, email, phone, role, created_at FROM fm_employee WHERE fm_company_id = $1`,
    [companyResult.rows[0]?.id]
  ).catch(() => ({ rows: [] }));

  return {
    exported_at: new Date().toISOString(),
    export_scope: 'This export contains the requesting user\'s own account data and the operational data of the company they administer (tenants, employees) if applicable.',
    account: admin,
    company: companyResult.rows[0] || null,
    consent_history: consentResult.rows,
    audit_history: auditResult.rows,
    tenants: tenantsResult.rows,
    employees: employeesResult.rows,
  };
}
