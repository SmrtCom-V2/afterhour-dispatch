import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { OnboardingChecklist, EmergencyLineBanner } from '../components/Onboarding';
import { useLanguage } from '../context/LanguageContext';

// Icons
const BuildingIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
  </svg>
);

const CompanyIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1" />
    <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const AlertIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const TrendUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const TrendDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
    <polyline points="17 18 23 18 23 12" />
  </svg>
);

// Sparkline Component
const Sparkline = ({ data, color = 'primary' }) => {
  const max = Math.max(...data, 1);
  return (
    <div className="sparkline-container">
      {data.map((value, i) => (
        <div
          key={i}
          className={`sparkline-bar ${i === data.length - 1 ? 'highlight' : ''}`}
          style={{
            height: `${(value / max) * 100}%`,
            background: i === data.length - 1 ? `var(--color-${color})` : undefined
          }}
        />
      ))}
    </div>
  );
};

// Circular Progress Component
const CircularProgress = ({ value, max = 100, label, color = 'primary' }) => {
  const percentage = Math.min((value / max) * 100, 100);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="progress-ring-container">
      <svg className="progress-ring" width="120" height="120">
        <circle className="progress-ring-bg" cx="60" cy="60" r={radius} />
        <circle
          className={`progress-ring-fill ${color}`}
          cx="60"
          cy="60"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="progress-ring-text">
        <div className="progress-ring-value">{value}%</div>
        <div className="progress-ring-label">{label}</div>
      </div>
    </div>
  );
};

// Activity Chart Component
const ActivityChart = ({ data, t }) => {
  const maxValue = Math.max(...data.map(d => d.calls), 1);

  return (
    <div className="activity-chart-section">
      <div className="activity-chart-header">
        <h3 className="activity-chart-title">{t('callActivityLast7Days')}</h3>
        <div className="activity-chart-legend">
          <div className="legend-item">
            <span className="legend-dot calls"></span>
            <span>{t('calls')}</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot resolved"></span>
            <span>{t('resolved')}</span>
          </div>
        </div>
      </div>
      <div className="bar-chart">
        {data.map((day, i) => (
          <div key={i} className="bar-chart-column">
            <span className="bar-chart-value">{day.calls}</span>
            <div
              className="bar-chart-bar"
              style={{ height: `${(day.calls / maxValue) * 180}px` }}
              title={`${day.calls} ${t('calls')}`}
            />
            <span className="bar-chart-label">{day.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export function Dashboard() {
  const [stats, setStats] = useState(null);
  const [pmStats, setPmStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const statsData = await api.getIncidentStats({});
      setStats(statsData.stats);

      const pmData = await api.getPmCompanies();
      setPmStats(pmData.pmCompanies || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>{t('loadingDashboard')}</p>
      </div>
    );
  }

  const totalBuildings = pmStats.reduce((sum, pm) => sum + (parseInt(pm.building_count) || 0), 0);
  const totalOpenIncidents = pmStats.reduce((sum, pm) => sum + (parseInt(pm.open_incidents) || 0), 0);

  // Format time
  const formatTime = (date) => {
    return date.toLocaleTimeString(language === 'de' ? 'de-DE' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Real per-day call counts for the last 7 days, from the backend. 0 when no calls happened.
  // Range starts at max(7 days ago, company signup date) — a company that
  // signed up today must not show 6 days that happened before it existed
  // (confirmed live: a fresh account showed Mon-Sun even though the company
  // was created that same day).
  const dailyCallCounts = stats?.daily_call_counts || {};
  const dayLabelKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setHours(0, 0, 0, 0);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const companyCreatedAt = stats?.company_created_at ? new Date(stats.company_created_at) : null;
  if (companyCreatedAt) companyCreatedAt.setHours(0, 0, 0, 0);
  const rangeStart = companyCreatedAt && companyCreatedAt > sevenDaysAgo ? companyCreatedAt : sevenDaysAgo;
  const daysInRange = Math.round((new Date().setHours(0, 0, 0, 0) - rangeStart.getTime()) / 86400000) + 1;
  const weeklyData = Array.from({ length: daysInRange }, (_, i) => {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + i);
    const isoDate = d.toISOString().slice(0, 10);
    return { label: t(dayLabelKeys[d.getDay()]), calls: dailyCallCounts[isoDate] || 0 };
  });

  // Calculate response rate — 0 (not a fabricated placeholder) when there's no real call history yet
  const responseRate = stats?.month_calls
    ? Math.round(((stats.month_calls - (stats.missing_reports || 0)) / stats.month_calls) * 100)
    : 0;

  return (
    <div>
      {/* Blocking: emergency line not set up — tenants can't reach us */}
      <EmergencyLineBanner />

      {/* Onboarding Checklist */}
      <OnboardingChecklist />

      {/* Page Header with Theme Toggle */}
      <div className="page-header-modern">
        <div>
          <h1 className="page-title">{t('dashboard')}</h1>
          <p className="page-subtitle">{t('afterHoursOverview')}</p>
        </div>
        <div className="page-header-actions">
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            <span>{theme === 'light' ? t('dark') : t('light')}</span>
          </button>
        </div>
      </div>

      {/* Live Status Bar */}
      <div className="live-status-bar">
        <div className="live-status-time">
          <div className="live-status-clock">{formatTime(currentTime)}</div>
          <div className="live-status-date">{formatDate(currentTime)}</div>
        </div>
        <div className="live-status-indicators">
          <div className={`live-indicator ${(stats?.tonight_calls || 0) > 0 ? 'active' : ''}`}>
            <span className="live-indicator-value">{stats?.tonight_calls || 0}</span>
            <span className="live-indicator-label">{t('callsTonight')}</span>
          </div>
          <div
            className={`live-indicator clickable ${totalOpenIncidents > 0 ? 'urgent' : ''}`}
            onClick={() => navigate('/incidents?status=open')}
            role="button"
            tabIndex={0}
          >
            <span className="live-indicator-value">{totalOpenIncidents}</span>
            <span className="live-indicator-label">{t('openIncidents')}</span>
          </div>
          <div
            className="live-indicator clickable"
            onClick={() => navigate('/pm-companies')}
            role="button"
            tabIndex={0}
          >
            <span className="live-indicator-value">{pmStats.length}</span>
            <span className="live-indicator-label">{t('activePMs')}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="dashboard-grid">
        <div
          className="stat-card-modern primary clickable"
          onClick={() => navigate('/pm-companies')}
          role="button"
          tabIndex={0}
        >
          <div className="stat-card-header-modern">
            <div className="stat-card-icon-modern primary">
              <CompanyIcon />
            </div>
          </div>
          <div className="stat-card-value-modern">{pmStats.length}</div>
          <div className="stat-card-label-modern">{t('pmCompanies')}</div>
          <div className="stat-card-trend-modern neutral">
            <span>{t('totalActiveCompanies')}</span>
          </div>
        </div>

        <div
          className="stat-card-modern success clickable"
          onClick={() => navigate('/buildings')}
          role="button"
          tabIndex={0}
        >
          <div className="stat-card-header-modern">
            <div className="stat-card-icon-modern success">
              <BuildingIcon />
            </div>
          </div>
          <div className="stat-card-value-modern">{totalBuildings}</div>
          <div className="stat-card-label-modern">{t('totalProperties')}</div>
          <div className="stat-card-trend-modern up">
            <TrendUpIcon />
            <span>{t('acrossAllPMs')}</span>
          </div>
        </div>

        <div
          className="stat-card-modern primary clickable"
          onClick={() => navigate('/incidents')}
          role="button"
          tabIndex={0}
        >
          <div className="stat-card-header-modern">
            <div className="stat-card-icon-modern primary">
              <PhoneIcon />
            </div>
          </div>
          <div className="stat-card-value-modern">{stats?.tonight_calls || 0}</div>
          <div className="stat-card-label-modern">{t('callsToday')}</div>
          <Sparkline data={weeklyData.map(d => d.calls)} color="primary" />
        </div>

        <div
          className={`stat-card-modern clickable ${totalOpenIncidents > 0 ? 'danger' : 'success'}`}
          onClick={() => navigate('/incidents?status=open')}
          role="button"
          tabIndex={0}
        >
          <div className="stat-card-header-modern">
            <div className={`stat-card-icon-modern ${totalOpenIncidents > 0 ? 'danger' : 'success'}`}>
              <AlertIcon />
            </div>
          </div>
          <div className="stat-card-value-modern" style={{
            color: totalOpenIncidents > 0 ? 'var(--color-danger)' : 'var(--color-success)'
          }}>
            {totalOpenIncidents}
          </div>
          <div className="stat-card-label-modern">{t('openIncidents')}</div>
          {totalOpenIncidents > 0 ? (
            <div className="stat-card-trend-modern down">
              <TrendDownIcon />
              <span>{t('requiresAttention')}</span>
            </div>
          ) : (
            <div className="stat-card-trend-modern up">
              <TrendUpIcon />
              <span>{t('allClear')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="quick-stats-row">
        <div
          className="quick-stat-item clickable"
          onClick={() => navigate(`/incidents?dateFrom=${sevenDaysAgo.toISOString().slice(0, 10)}`)}
          role="button"
          tabIndex={0}
        >
          <div className="quick-stat-label">{t('thisWeek')}</div>
          <div className="quick-stat-value">{stats?.week_calls || 0} {t('calls')}</div>
        </div>
        <div
          className="quick-stat-item clickable"
          onClick={() => {
            const monthAgo = new Date();
            monthAgo.setDate(monthAgo.getDate() - 30);
            navigate(`/incidents?dateFrom=${monthAgo.toISOString().slice(0, 10)}`);
          }}
          role="button"
          tabIndex={0}
        >
          <div className="quick-stat-label">{t('thisMonth')}</div>
          <div className="quick-stat-value">{stats?.month_calls || 0} {t('calls')}</div>
        </div>
        <div
          className="quick-stat-item clickable"
          onClick={() => navigate('/incidents?isEmergency=true')}
          role="button"
          tabIndex={0}
        >
          <div className="quick-stat-label">{t('emergencies')}</div>
          <div className={`quick-stat-value ${(stats?.emergencies || 0) > 0 ? 'danger' : ''}`}>
            {stats?.emergencies || 0}
          </div>
        </div>
        <div
          className="quick-stat-item clickable"
          onClick={() => navigate('/incidents?missingReport=true')}
          role="button"
          tabIndex={0}
        >
          <div className="quick-stat-label">{t('missingReports')}</div>
          <div className={`quick-stat-value ${(stats?.missing_reports || 0) > 0 ? 'danger' : ''}`}>
            {stats?.missing_reports || 0}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="dashboard-grid-2">
        <ActivityChart data={weeklyData} t={t} />

        <div className="metric-card">
          <div className="metric-card-title">{t('responseRate')}</div>
          <CircularProgress
            value={responseRate}
            label={t('completed')}
            color={responseRate >= 90 ? 'success' : responseRate >= 70 ? 'warning' : 'danger'}
          />
          <div style={{ marginTop: 16, fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {stats?.avg_response_time || '-'} {t('avgResponse')}
          </div>
        </div>
      </div>

      {/* PM Companies Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">{t('pmCompanies')}</h3>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/pm-companies')}>
            {t('manageCompanies')}
          </button>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('company')}</th>
                <th>{t('servicePhone')}</th>
                <th>{t('properties')}</th>
                <th>{t('openIncidents')}</th>
                <th>{t('lastIncident')}</th>
                <th>{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {pmStats.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <CompanyIcon />
                      </div>
                      <h3 className="empty-state-title">{t('noPmCompaniesYet')}</h3>
                      <p className="empty-state-description">
                        {t('addFirstPmCompanyDescription')}
                      </p>
                      <button className="btn btn-primary" onClick={() => navigate('/pm-companies')}>
                        {t('addPmCompany')}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                pmStats.map((pm) => (
                  <tr key={pm.id} className="clickable" onClick={() => navigate(`/pm/${pm.id}`)}>
                    <td>
                      <div className="table-cell-main">{pm.name}</div>
                      {pm.contact_email && (
                        <div className="table-cell-sub">{pm.contact_email}</div>
                      )}
                    </td>
                    <td>
                      <span className="text-sm">{pm.service_phone || '-'}</span>
                    </td>
                    <td>
                      <span className="badge badge-default">{pm.building_count || 0}</span>
                    </td>
                    <td>
                      {parseInt(pm.open_incidents) > 0 ? (
                        <span className="badge badge-danger">{pm.open_incidents} {t('open').toLowerCase()}</span>
                      ) : (
                        <span className="badge badge-success">0</span>
                      )}
                    </td>
                    <td className="text-sm text-secondary">
                      {pm.last_incident_at
                        ? new Date(pm.last_incident_at).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US')
                        : '-'}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/pm/${pm.id}`);
                        }}
                      >
                        {t('enter')} <ArrowRightIcon />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Help Card */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{
              width: 40,
              height: 40,
              background: 'var(--color-info-bg)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-info)',
              flexShrink: 0
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold" style={{ marginBottom: 4 }}>{t('gettingStarted')}</h4>
              <p className="text-sm text-secondary" style={{ margin: 0 }}>
                {t('gettingStartedDescription')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
