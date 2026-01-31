/**
 * Morning Report Generator Service
 * Generates and sends PDF reports to PMs at 7 AM
 *
 * Report includes:
 * - Summary
 * - All calls from last night
 * - Emergency or not
 * - SP used
 * - What was done
 * - Photos (invoice later note)
 */

import PDFDocument from 'pdfkit';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { getStorageProvider } from '../providers/storage/index.js';

/**
 * Generate morning report PDF for a PM company
 */
export async function generateMorningReport(pmCompanyId, reportDate = null) {
  // Default to yesterday if no date provided
  const targetDate = reportDate || getYesterdayDate();

  logger.info('Generating morning report', { pmCompanyId, targetDate });

  // Get PM company info
  const pmResult = await db.query(
    `SELECT pm.*, fm.name as fm_company_name
     FROM pm_company pm
     JOIN fm_company fm ON pm.fm_company_id = fm.id
     WHERE pm.id = $1`,
    [pmCompanyId]
  );

  if (pmResult.rows.length === 0) {
    throw new Error('PM company not found');
  }

  const pmCompany = pmResult.rows[0];

  // Get all incidents for this PM's buildings from the target date
  const incidentsResult = await db.query(
    `SELECT i.*,
            b.name as building_name, b.address as building_address,
            sp.company_name as sp_company_name, sp.phone as sp_phone,
            sr.description as report_description, sr.finish_time as report_finish_time, sr.status as report_status,
            (SELECT json_agg(json_build_object('file_name', sra.file_name, 'file_path', sra.file_path))
             FROM sp_report_attachment sra
             JOIN sp_report sr2 ON sra.sp_report_id = sr2.id
             WHERE sr2.incident_id = i.id) as photos
     FROM incident i
     JOIN building b ON i.building_id = b.id
     LEFT JOIN service_provider sp ON i.assigned_sp_id = sp.id
     LEFT JOIN sp_report sr ON sr.incident_id = i.id
     WHERE b.pm_company_id = $1
       AND DATE(i.created_at) = $2
     ORDER BY i.created_at`,
    [pmCompanyId, targetDate]
  );

  const incidents = incidentsResult.rows;

  // Generate PDF
  const pdfBuffer = await createPDF(pmCompany, incidents, targetDate);

  // Store report record
  const incidentIds = incidents.map((i) => i.id);

  await db.query(
    `INSERT INTO morning_report (pm_company_id, report_date, incidents_included)
     VALUES ($1, $2, $3)
     ON CONFLICT (pm_company_id, report_date) DO UPDATE SET incidents_included = $3`,
    [pmCompanyId, targetDate, incidentIds]
  );

  return pdfBuffer;
}

/**
 * Create PDF document
 */
async function createPDF(pmCompany, incidents, reportDate) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 50 });

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('After-Hours Incident Report', { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(12).font('Helvetica');
    doc.text(`Property Manager: ${pmCompany.name}`);
    doc.text(`Report Date: ${reportDate}`);
    doc.text(`Generated: ${new Date().toISOString()}`);
    doc.moveDown();

    // Summary
    doc.fontSize(14).font('Helvetica-Bold').text('Summary');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');

    const totalCalls = incidents.length;
    const emergencies = incidents.filter((i) => i.is_emergency).length;
    const nonEmergencies = totalCalls - emergencies;
    const dispatchedCount = incidents.filter((i) => i.assigned_sp_id).length;
    const missingReports = incidents.filter((i) => i.report_status === 'missing').length;

    doc.text(`Total Calls: ${totalCalls}`);
    doc.text(`Emergencies: ${emergencies}`);
    doc.text(`Non-Emergencies: ${nonEmergencies}`);
    doc.text(`SP Dispatched: ${dispatchedCount}`);
    if (missingReports > 0) {
      doc.fillColor('red').text(`Missing Reports: ${missingReports}`).fillColor('black');
    }
    doc.moveDown();

    // Horizontal line
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Incidents detail
    if (incidents.length === 0) {
      doc.fontSize(12).text('No incidents reported during this period.', { align: 'center' });
    } else {
      for (let i = 0; i < incidents.length; i++) {
        const incident = incidents[i];

        // Check if we need a new page
        if (doc.y > 650) {
          doc.addPage();
        }

        doc.fontSize(12).font('Helvetica-Bold');
        doc.text(`Incident #${i + 1} - ${incident.building_name}`);
        doc.fontSize(10).font('Helvetica');

        // Time
        const time = new Date(incident.created_at).toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
        });
        doc.text(`Time: ${time}`);

        // Building
        doc.text(`Building: ${incident.building_name}`);
        doc.text(`Address: ${incident.building_address}`);

        // Classification
        const categoryDisplay = (incident.issue_category || 'unknown').replace(/_/g, ' ').toUpperCase();
        const emergencyLabel = incident.is_emergency ? 'EMERGENCY' : 'Non-Emergency';
        doc.text(`Issue: ${categoryDisplay} (${emergencyLabel})`);
        doc.text(`AI Confidence: ${incident.ai_confidence || 0}%`);

        // Decision
        const decisionMap = {
          emergency_dispatch: 'SP Dispatched',
          not_emergency: 'Not Emergency - Closed',
          unclear_escalated: 'Escalated to FM',
          verification_failed: 'Verification Failed',
          pending: 'Pending',
        };
        doc.text(`Decision: ${decisionMap[incident.decision] || incident.decision}`);

        // SP Info
        if (incident.sp_company_name) {
          doc.moveDown(0.3);
          doc.font('Helvetica-Bold').text('Service Provider:');
          doc.font('Helvetica');
          doc.text(`Company: ${incident.sp_company_name}`);
          doc.text(`Phone: ${incident.sp_phone || 'N/A'}`);

          // Report status
          if (incident.report_status === 'submitted') {
            doc.text(`Report: Submitted`);
            if (incident.report_finish_time) {
              const finishTime = new Date(incident.report_finish_time).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
              });
              doc.text(`Work Completed: ${finishTime}`);
            }
            if (incident.report_description) {
              doc.text(`SP Notes: ${incident.report_description}`);
            }
          } else if (incident.report_status === 'missing') {
            doc.fillColor('red').text('Report: MISSING - UNPAID').fillColor('black');
          } else {
            doc.text('Report: Pending');
          }

          // Photos note
          if (incident.photos && incident.photos.length > 0) {
            doc.text(`Photos: ${incident.photos.length} attached (see appendix)`);
          }

          doc.moveDown(0.3);
          doc.fillColor('gray').fontSize(8).text('(Invoice to follow separately)').fillColor('black').fontSize(10);
        }

        doc.moveDown();

        // Separator
        if (i < incidents.length - 1) {
          doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
          doc.moveDown(0.5);
        }
      }
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).fillColor('gray');
    doc.text('This report was automatically generated by the FM After-Hours System.', { align: 'center' });
    doc.text(`Report ID: ${pmCompany.id}-${reportDate}`, { align: 'center' });

    doc.end();
  });
}

/**
 * Get yesterday's date in YYYY-MM-DD format
 */
function getYesterdayDate() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

/**
 * Get all PM companies that need reports
 */
export async function getPmCompaniesForReports() {
  const result = await db.query(
    `SELECT DISTINCT pm.id, pm.name, pm.contact_email
     FROM pm_company pm
     JOIN building b ON b.pm_company_id = pm.id
     JOIN incident i ON i.building_id = b.id
     WHERE DATE(i.created_at) = $1
       AND pm.contact_email IS NOT NULL`,
    [getYesterdayDate()]
  );

  return result.rows;
}

export default { generateMorningReport, getPmCompaniesForReports };
