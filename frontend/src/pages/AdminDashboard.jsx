import { useMemo } from 'react';

const companies = [
  {
    id: 1,
    name: 'Nordic Facility Group',
    vatId: 'DE329102',
    buildings: 120,
    contact: 'Sophie Keller',
    email: 'sophie@nordicfm.de',
    phone: '+49 30 7821 390',
    address: 'Unter den Linden 12, Berlin',
    plan: 'Enterprise',
    coverageStart: '2026-03-02',
    coverageEnd: '2027-03-02',
    payment: 'Paid',
    status: 'Active',
  },
  {
    id: 2,
    name: 'UrbanWorks FM',
    vatId: 'DE771214',
    buildings: 44,
    contact: 'Daniel Voss',
    email: 'daniel@urbanworks.de',
    phone: '+49 40 2291 008',
    address: 'Hafenstrasse 55, Hamburg',
    plan: 'Growth',
    coverageStart: '2026-01-10',
    coverageEnd: '2027-01-10',
    payment: 'Pending',
    status: 'Trial',
  },
  {
    id: 3,
    name: 'Metro Facility Care',
    vatId: 'DE918833',
    buildings: 76,
    contact: 'Liam Hoffmann',
    email: 'liam@metrocare.de',
    phone: '+49 69 7710 442',
    address: 'Messeplatz 3, Frankfurt',
    plan: 'Starter',
    coverageStart: '2025-05-01',
    coverageEnd: '2026-05-01',
    payment: 'Failed',
    status: 'Overdue',
  },
  {
    id: 4,
    name: 'GreenLine Property',
    vatId: 'DE551904',
    buildings: 22,
    contact: 'Maya Schulte',
    email: 'maya@greenline.de',
    phone: '+49 211 5589 990',
    address: 'Koenigsallee 92, Dusseldorf',
    plan: 'Growth',
    coverageStart: '2026-02-14',
    coverageEnd: '2027-02-14',
    payment: 'Paid',
    status: 'Active',
  },
];

export function AdminDashboard() {
  const stats = useMemo(() => {
    const active = companies.filter((c) => c.status === 'Active').length;
    const trial = companies.filter((c) => c.status === 'Trial').length;
    const overdue = companies.filter((c) => c.status === 'Overdue').length;
    const endingSoon = companies.filter((c) => new Date(c.coverageEnd) < new Date('2027-02-01')).length;
    return { active, trial, overdue, endingSoon };
  }, []);

  return (
    <div className="admin-dashboard">
      <div className="page-header">
        <div>
          <div className="admin-eyebrow">Admin Console</div>
          <h1 className="page-title">After-Hours Coverage Control</h1>
          <p className="admin-subtitle">
            Track facility management companies, coverage windows, and billing status.
          </p>
        </div>
        <div className="admin-header-actions">
          <button className="btn btn-secondary">Export CSV</button>
          <button className="btn btn-primary">Create Company</button>
        </div>
      </div>

      <div className="admin-kpis">
        <div className="admin-kpi-card">
          <p className="admin-kpi-label">Active Companies</p>
          <p className="admin-kpi-value">{stats.active}</p>
          <p className="admin-kpi-meta">Coverage running</p>
        </div>
        <div className="admin-kpi-card">
          <p className="admin-kpi-label">Trials</p>
          <p className="admin-kpi-value">{stats.trial}</p>
          <p className="admin-kpi-meta">Onboarding this week</p>
        </div>
        <div className="admin-kpi-card">
          <p className="admin-kpi-label">Ending Soon</p>
          <p className="admin-kpi-value">{stats.endingSoon}</p>
          <p className="admin-kpi-meta">Next 30 days</p>
        </div>
        <div className="admin-kpi-card">
          <p className="admin-kpi-label">Overdue</p>
          <p className="admin-kpi-value admin-kpi-alert">{stats.overdue}</p>
          <p className="admin-kpi-meta">Payment follow-up</p>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Companies</h2>
            <p>View signups, coverage, and payment health at a glance.</p>
          </div>
          <div className="admin-panel-actions">
            <button className="btn btn-secondary btn-small">Import</button>
            <button className="btn btn-secondary btn-small">Bulk Actions</button>
          </div>
        </div>

        <div className="admin-filters">
          <label className="admin-filter">
            Status
            <select className="form-select">
              <option>All</option>
              <option>Active</option>
              <option>Trial</option>
              <option>Paused</option>
              <option>Overdue</option>
              <option>Canceled</option>
            </select>
          </label>
          <label className="admin-filter">
            Payment
            <select className="form-select">
              <option>All</option>
              <option>Paid</option>
              <option>Pending</option>
              <option>Failed</option>
            </select>
          </label>
          <label className="admin-filter">
            Coverage End
            <input className="form-input" type="date" />
          </label>
          <label className="admin-filter">
            Plan
            <select className="form-select">
              <option>All</option>
              <option>Starter</option>
              <option>Growth</option>
              <option>Enterprise</option>
            </select>
          </label>
          <label className="admin-filter admin-filter-search">
            Search
            <input className="form-input" placeholder="Company, contact, VAT" />
          </label>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Contact</th>
              <th>Coverage Window</th>
              <th>Plan</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.id}>
                <td>
                  <div className="admin-company">{company.name}</div>
                  <div className="admin-muted">VAT {company.vatId} • {company.buildings} buildings</div>
                </td>
                <td>
                  <div className="admin-company">{company.contact}</div>
                  <div className="admin-muted">{company.email}</div>
                </td>
                <td>
                  <div className="admin-company">{company.coverageStart}</div>
                  <div className="admin-muted">Ends {company.coverageEnd}</div>
                </td>
                <td>{company.plan}</td>
                <td>
                  <span className={`admin-pill admin-pill-${company.payment.toLowerCase()}`}>
                    {company.payment}
                  </span>
                </td>
                <td>
                  <span className={`admin-pill admin-pill-${company.status.toLowerCase()}`}>
                    {company.status}
                  </span>
                </td>
                <td>
                  <div className="admin-actions">
                    <button className="btn btn-secondary btn-small">View</button>
                    <button className="btn btn-secondary btn-small">Edit</button>
                    <button className="btn btn-danger btn-small">Pause</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-split">
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Selected Company</h2>
              <p>Quick actions and profile detail.</p>
            </div>
            <button className="btn btn-secondary btn-small">Open Profile</button>
          </div>
          <div className="admin-card">
            <div>
              <div className="admin-company">Nordic Facility Group</div>
              <div className="admin-muted">Unter den Linden 12, Berlin • VAT DE329102</div>
            </div>
            <div className="admin-card-grid">
              <div>
                <p className="admin-card-label">Primary Contact</p>
                <p>Sophie Keller</p>
                <p className="admin-muted">+49 30 7821 390</p>
              </div>
              <div>
                <p className="admin-card-label">Coverage</p>
                <p>Mar 2, 2026 - Mar 2, 2027</p>
                <p className="admin-muted">Renewal reminder in 90 days</p>
              </div>
              <div>
                <p className="admin-card-label">Billing</p>
                <p>Enterprise plan • EUR 1,200 / mo</p>
                <p className="admin-muted">Next invoice: Apr 1, 2026</p>
              </div>
            </div>
            <div className="admin-actions">
              <button className="btn btn-secondary">Edit Company</button>
              <button className="btn btn-secondary">Suspend</button>
              <button className="btn btn-primary">Mark Paid</button>
            </div>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Activity Feed</h2>
              <p>Recent changes to coverage and billing.</p>
            </div>
            <button className="btn btn-secondary btn-small">View All</button>
          </div>
          <div className="admin-activity">
            <div className="admin-activity-item">
              <span className="status-dot pending"></span>
              <div>
                <p><strong>UrbanWorks FM</strong> completed onboarding checklist.</p>
                <p className="admin-muted">10 minutes ago</p>
              </div>
            </div>
            <div className="admin-activity-item">
              <span className="status-dot open"></span>
              <div>
                <p>Invoice reminder sent to <strong>Metro Facility Care</strong>.</p>
                <p className="admin-muted">1 hour ago</p>
              </div>
            </div>
            <div className="admin-activity-item">
              <span className="status-dot closed"></span>
              <div>
                <p><strong>GreenLine Property</strong> upgraded to Growth plan.</p>
                <p className="admin-muted">Yesterday</p>
              </div>
            </div>
            <div className="admin-activity-item">
              <span className="status-dot pending"></span>
              <div>
                <p>New company signup: <strong>Harbor FM</strong> (Trial).</p>
                <p className="admin-muted">2 days ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
