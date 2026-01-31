import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePm } from '../context/PmContext';
import { useLanguage } from '../context/LanguageContext';
import { WelcomeModal, GuidedTour } from './Onboarding';
import { StatusBanners } from './StatusBanners';
import { LanguageSwitcher } from './LanguageSwitcher';

// Icons as simple SVG components
const DashboardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const BuildingIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
  </svg>
);

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const CompanyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1" />
    <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
  </svg>
);

const WrenchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const AlertIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const ReportIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14,2 14,8 20,8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10,9 9,9 8,9" />
  </svg>
);

const EmployeeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16,17 21,12 16,7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const { selectedPm, selectedPmId, clearPm, pmCompanies } = usePm();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Check if we're in a PM workspace
  const isPmWorkspace = location.pathname.startsWith('/pm/');

  // Get user initials for avatar
  const getInitials = (name, email) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email ? email[0].toUpperCase() : 'U';
  };

  return (
    <div className="app-layout">
      {/* Onboarding Overlays */}
      <WelcomeModal />
      <GuidedTour />

      <aside className="sidebar">
        {/* Header / Logo */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            </div>
            <div>
              <div className="sidebar-logo-text">After Hour</div>
              <div className="sidebar-logo-sub">{t('adminPanel')}</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {isPmWorkspace && selectedPm ? (
            <>
              {/* PM Context Banner */}
              <div style={{
                margin: '0 12px 16px',
                padding: '12px',
                background: 'var(--color-primary-light)',
                borderRadius: 'var(--radius-md)',
                borderLeft: '3px solid var(--color-primary)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600, marginBottom: 4 }}>
                  {t('pmWorkspace')}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{selectedPm.name}</div>
                <button
                  onClick={() => { clearPm(); navigate('/'); }}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%' }}
                >
                  {t('backToFmGlobal')}
                </button>
              </div>

              {/* PM Scoped Navigation */}
              <div className="sidebar-section">
                <div className="sidebar-section-title">{t('overview')}</div>
                <ul className="sidebar-nav-list">
                  <li className="sidebar-nav-item">
                    <NavLink to={`/pm/${selectedPmId}`} end>
                      <DashboardIcon /> {t('dashboard')}
                    </NavLink>
                  </li>
                </ul>
              </div>

              <div className="sidebar-section">
                <div className="sidebar-section-title">{t('dataManagement')}</div>
                <ul className="sidebar-nav-list">
                  <li className="sidebar-nav-item">
                    <NavLink to={`/pm/${selectedPmId}/buildings`}>
                      <BuildingIcon /> {t('properties')}
                    </NavLink>
                  </li>
                  <li className="sidebar-nav-item">
                    <NavLink to={`/pm/${selectedPmId}/tenants`}>
                      <UsersIcon /> {t('tenants')}
                    </NavLink>
                  </li>
                  <li className="sidebar-nav-item">
                    <NavLink to={`/pm/${selectedPmId}/service-providers`}>
                      <WrenchIcon /> {t('serviceProviders')}
                    </NavLink>
                  </li>
                </ul>
              </div>

              <div className="sidebar-section">
                <div className="sidebar-section-title">{t('operations')}</div>
                <ul className="sidebar-nav-list">
                  <li className="sidebar-nav-item">
                    <NavLink to={`/pm/${selectedPmId}/incidents`}>
                      <AlertIcon /> {t('incidents')}
                    </NavLink>
                  </li>
                  <li className="sidebar-nav-item">
                    <NavLink to={`/pm/${selectedPmId}/reports`}>
                      <ReportIcon /> {t('reports')}
                    </NavLink>
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <>
              {/* FM Global Navigation */}
              <div className="sidebar-section">
                <div className="sidebar-section-title">{t('overview')}</div>
                <ul className="sidebar-nav-list">
                  <li className="sidebar-nav-item">
                    <NavLink to="/" end>
                      <DashboardIcon /> {t('dashboard')}
                    </NavLink>
                  </li>
                </ul>
              </div>

              <div className="sidebar-section">
                <div className="sidebar-section-title">{t('management')}</div>
                <ul className="sidebar-nav-list">
                  <li className="sidebar-nav-item">
                    <NavLink to="/pm-companies">
                      <CompanyIcon /> {t('pmCompanies')}
                    </NavLink>
                  </li>
                  <li className="sidebar-nav-item">
                    <NavLink to="/buildings">
                      <BuildingIcon /> {t('properties')}
                    </NavLink>
                  </li>
                  <li className="sidebar-nav-item">
                    <NavLink to="/tenants">
                      <UsersIcon /> {t('tenants')}
                    </NavLink>
                  </li>
                  <li className="sidebar-nav-item">
                    <NavLink to="/service-providers">
                      <WrenchIcon /> {t('serviceProviders')}
                    </NavLink>
                  </li>
                  <li className="sidebar-nav-item">
                    <NavLink to="/employees">
                      <EmployeeIcon /> {t('employees')}
                    </NavLink>
                  </li>
                </ul>
              </div>

              <div className="sidebar-section">
                <div className="sidebar-section-title">{t('operations')}</div>
                <ul className="sidebar-nav-list">
                  <li className="sidebar-nav-item">
                    <NavLink to="/incidents">
                      <AlertIcon /> {t('incidents')}
                    </NavLink>
                  </li>
                  <li className="sidebar-nav-item">
                    <NavLink to="/reports">
                      <ReportIcon /> {t('reports')}
                    </NavLink>
                  </li>
                </ul>
              </div>

              <div className="sidebar-section">
                <div className="sidebar-section-title">{t('settings')}</div>
                <ul className="sidebar-nav-list">
                  <li className="sidebar-nav-item">
                    <NavLink to="/settings">
                      <SettingsIcon /> {t('settings')}
                    </NavLink>
                  </li>
                </ul>
              </div>

              {/* PM Quick Selector */}
              {pmCompanies.length > 0 && (
                <div style={{
                  margin: '16px 12px 0',
                  padding: '16px',
                  background: 'var(--color-bg-hover)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--color-text-muted)',
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {t('quickAccess')}
                  </div>
                  <select
                    className="form-select"
                    style={{ width: '100%', fontSize: 13 }}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        navigate(`/pm/${e.target.value}`);
                      }
                    }}
                  >
                    <option value="">{t('selectPmCompany')}</option>
                    {pmCompanies.map((pm) => (
                      <option key={pm.id} value={pm.id}>{pm.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </nav>

        {/* Footer / User */}
        <div className="sidebar-footer">
          {/* Language Switcher */}
          <div style={{ marginBottom: 16 }}>
            <LanguageSwitcher variant="compact" />
          </div>

          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {getInitials(user?.name, user?.email)}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name || 'Admin'}</div>
              <div className="sidebar-user-email">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', marginTop: 12, justifyContent: 'flex-start' }}
          >
            <LogoutIcon /> {t('logout')}
          </button>
        </div>
      </aside>

      <main className="main-content">
        <StatusBanners />
        <div className="main-body">
          {children}
        </div>
      </main>
    </div>
  );
}
