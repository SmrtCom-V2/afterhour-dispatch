import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';

// Icons
const BuildingIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
  </svg>
);

const CompanyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1" />
    <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export function Buildings() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [pmCompanies, setPmCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPmCompanies();
  }, []);

  const loadPmCompanies = async () => {
    try {
      const data = await api.getPmCompanies();
      setPmCompanies(data.pmCompanies || []);
    } catch (err) {
      console.error('Failed to load PM companies:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totalBuildings = pmCompanies.reduce((sum, pm) => sum + (parseInt(pm.building_count) || 0), 0);
  const totalTenants = pmCompanies.reduce((sum, pm) => sum + (parseInt(pm.tenant_count) || 0), 0);

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>{t('loadingBuildings')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">{t('buildings')}</h1>
        <p className="page-subtitle">{t('managePropertiesAcrossPM')}</p>
      </div>

      {/* Stats Summary */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon primary">
              <BuildingIcon />
            </div>
          </div>
          <div className="stat-card-value">{totalBuildings}</div>
          <div className="stat-card-label">{t('totalBuildings')}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon success">
              <CompanyIcon />
            </div>
          </div>
          <div className="stat-card-value">{pmCompanies.length}</div>
          <div className="stat-card-label">{t('pmCompanies')}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon info">
              <UsersIcon />
            </div>
          </div>
          <div className="stat-card-value">{totalTenants}</div>
          <div className="stat-card-label">{t('totalTenants')}</div>
        </div>
      </div>

      {/* PM Companies with Buildings */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">{t('buildingsByPmCompany')}</h3>
          <span className="text-sm text-muted">
            {t('selectCompanyToManage')}
          </span>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('pmCompanies')}</th>
                <th style={{ width: 120 }}>{t('buildings')}</th>
                <th style={{ width: 120 }}>{t('tenants')}</th>
                <th style={{ width: 160 }}>{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {pmCompanies.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <CompanyIcon />
                      </div>
                      <h3 className="empty-state-title">{t('noPmCompaniesYetBuildings')}</h3>
                      <p className="empty-state-description">
                        {t('addFirstPmToManageBuildings')}
                      </p>
                      <button
                        className="btn btn-primary"
                        onClick={() => navigate('/pm-companies')}
                      >
                        {t('addPmCompany')}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                pmCompanies.map((pm) => (
                  <tr key={pm.id} className="clickable" onClick={() => navigate(`/pm/${pm.id}`)}>
                    <td>
                      <div className="table-cell-main">{pm.name}</div>
                      {pm.contact_email && (
                        <div className="table-cell-sub">{pm.contact_email}</div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-primary">{pm.building_count || 0}</span>
                    </td>
                    <td>
                      <span className="badge badge-default">{pm.tenant_count || 0}</span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/pm/${pm.id}`)}
                      >
                        {t('manage')} <ArrowRightIcon />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
