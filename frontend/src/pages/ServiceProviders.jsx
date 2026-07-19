import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';

const TRADES = ['plumber', 'electrician', 'locksmith', 'hvac', 'general', 'other'];

// Icons
const WrenchIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export function ServiceProviders() {
  const { t } = useLanguage();

  const tradeLabels = {
    plumber: t('plumber'),
    electrician: t('electrician'),
    locksmith: t('locksmith'),
    hvac: t('hvac'),
    general: t('general'),
    other: t('other')
  };
  const [serviceProviders, setServiceProviders] = useState([]);
  const [pmCompanies, setPmCompanies] = useState([]);
  const [selectedPm, setSelectedPm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSp, setEditingSp] = useState(null);
  const [filterTrade, setFilterTrade] = useState('');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    phone: '',
    email: '',
    trade: 'general',
    usageNote: '',
    available24h: true,
    availableFrom: '',
    availableTo: '',
  });

  useEffect(() => {
    loadPmCompanies();
  }, []);

  useEffect(() => {
    loadData();
  }, [filterTrade, selectedPm]);

  const loadPmCompanies = async () => {
    try {
      const data = await api.getPmCompanies();
      setPmCompanies(data.pmCompanies);
    } catch (err) {
      console.error('Failed to load PM companies:', err);
    }
  };

  const loadData = async () => {
    try {
      const params = {};
      if (filterTrade) params.trade = filterTrade;
      if (selectedPm) params.pmCompanyId = selectedPm;
      const data = await api.getServiceProviders(params);
      setServiceProviders(data.serviceProviders);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (sp = null) => {
    if (sp) {
      setEditingSp(sp);
      setFormData({
        companyName: sp.company_name,
        contactName: sp.contact_name || '',
        phone: sp.phone,
        email: sp.email || '',
        trade: sp.trade,
        usageNote: sp.usage_note || '',
        available24h: sp.available_24h !== false,
        availableFrom: sp.available_from || '',
        availableTo: sp.available_to || '',
      });
    } else {
      setEditingSp(null);
      setFormData({
        companyName: '',
        contactName: '',
        phone: '',
        email: '',
        trade: 'general',
        usageNote: '',
        available24h: true,
        availableFrom: '',
        availableTo: '',
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingSp) {
        await api.updateServiceProvider(editingSp.id, formData);
      } else {
        await api.createServiceProvider(formData);
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await api.toggleSpStatus(id);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this service provider?')) return;
    try {
      await api.deleteServiceProvider(id);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Stats
  const activeCount = serviceProviders.filter(sp => sp.status === 'active').length;
  const pausedCount = serviceProviders.filter(sp => sp.status !== 'active').length;

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>{t('loadingServiceProviders')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">{t('serviceProviders')}</h1>
        <p className="page-subtitle">{t('contractorsAndVendors')}</p>
      </div>

      {/* Stats Summary */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon primary">
              <WrenchIcon />
            </div>
          </div>
          <div className="stat-card-value">{serviceProviders.length}</div>
          <div className="stat-card-label">{t('totalProviders')}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon success">
              <CheckIcon />
            </div>
          </div>
          <div className="stat-card-value">{activeCount}</div>
          <div className="stat-card-label">{t('active')}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon warning">
              <PauseIcon />
            </div>
          </div>
          <div className="stat-card-value">{pausedCount}</div>
          <div className="stat-card-label">{t('paused')}</div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="form-select"
              style={{ width: 200 }}
              value={selectedPm}
              onChange={(e) => setSelectedPm(e.target.value)}
            >
              <option value="">{t('allPmCompanies')}</option>
              {pmCompanies.map((pm) => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>

            <select
              className="form-select"
              style={{ width: 180 }}
              value={filterTrade}
              onChange={(e) => setFilterTrade(e.target.value)}
            >
              <option value="">{t('allTrades')}</option>
              {TRADES.map((trade) => (
                <option key={trade} value={trade}>{tradeLabels[trade]}</option>
              ))}
            </select>

            <div style={{ flex: 1 }} />

            <button className="btn btn-primary" onClick={() => openModal()}>
              <PlusIcon /> {t('addProvider')}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('company')}</th>
                <th>{t('trade')}</th>
                <th>{t('phone')}</th>
                <th style={{ width: 100 }}>{t('status')}</th>
                <th style={{ width: 100 }}>{t('buildings')}</th>
                <th style={{ width: 180 }}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {serviceProviders.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <WrenchIcon />
                      </div>
                      <h3 className="empty-state-title">{t('noServiceProviders')}</h3>
                      <p className="empty-state-description">
                        {t('addContractorsDescription')}
                      </p>
                      <button className="btn btn-primary" onClick={() => openModal()}>
                        <PlusIcon /> {t('addProvider')}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                serviceProviders.map((sp) => (
                  <tr key={sp.id}>
                    <td>
                      <div className="table-cell-main">{sp.company_name}</div>
                      {sp.contact_name && (
                        <div className="table-cell-sub">{sp.contact_name}</div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-default" style={{ textTransform: 'capitalize' }}>
                        {tradeLabels[sp.trade] || sp.trade}
                      </span>
                    </td>
                    <td>
                      <span className="font-semibold">{sp.phone}</span>
                    </td>
                    <td>
                      <span className={`badge ${sp.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                        {sp.status === 'active' ? t('active') : t('paused')}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-primary">{sp.building_count || 0}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openModal(sp)}
                          title="Edit"
                        >
                          <EditIcon />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleToggleStatus(sp.id)}
                          title={sp.status === 'active' ? 'Pause' : 'Activate'}
                        >
                          {sp.status === 'active' ? <PauseIcon /> : <CheckIcon />}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDelete(sp.id)}
                          title="Delete"
                          style={{ color: 'var(--color-danger)' }}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal - Professional Design */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-pro" onClick={(e) => e.stopPropagation()}>
            <div className="modal-pro-header">
              <div className="modal-pro-icon primary">
                <WrenchIcon />
              </div>
              <div className="modal-pro-title-group">
                <h2 className="modal-pro-title">
                  {editingSp ? t('editServiceProvider') : t('addServiceProvider')}
                </h2>
                <p className="modal-pro-subtitle">
                  {editingSp ? `${t('editing')} ${editingSp.company_name}` : t('addContractorOrVendor')}
                </p>
              </div>
              <button className="modal-pro-close" onClick={() => setShowModal(false)}>
                <CloseIcon />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-pro-body">
                {/* Company Information */}
                <div className="modal-pro-section">
                  <div className="modal-pro-section-title">{t('companyInformationSection')}</div>

                  <div className="form-field-pro">
                    <div className="form-label-pro">
                      <span className="form-label-pro-text">{t('companyName')}</span>
                      <span className="form-label-pro-hint">{t('required')}</span>
                    </div>
                    <input
                      type="text"
                      className="form-input-pro"
                      value={formData.companyName}
                      onChange={(e) => updateField('companyName', e.target.value)}
                      required
                      placeholder="e.g., ABC Plumbing"
                    />
                  </div>

                  <div className="form-field-pro">
                    <div className="form-label-pro">
                      <span className="form-label-pro-text">{t('tradeSpecialty')}</span>
                      <span className="form-label-pro-hint">{t('required')}</span>
                    </div>
                    <select
                      className="form-input-pro"
                      value={formData.trade}
                      onChange={(e) => updateField('trade', e.target.value)}
                      required
                      style={{ cursor: 'pointer' }}
                    >
                      {TRADES.map((trade) => (
                        <option key={trade} value={trade}>{tradeLabels[trade]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="modal-pro-section">
                  <div className="modal-pro-section-title">{t('contactInformation')}</div>

                  <div className="form-field-pro">
                    <div className="form-label-pro">
                      <span className="form-label-pro-text">{t('contactPerson')}</span>
                    </div>
                    <input
                      type="text"
                      className="form-input-pro"
                      value={formData.contactName}
                      onChange={(e) => updateField('contactName', e.target.value)}
                      placeholder={t('primaryContactName')}
                    />
                  </div>

                  <div className="form-row-pro">
                    <div className="form-field-pro">
                      <div className="form-label-pro">
                        <span className="form-label-pro-text">{t('phone')}</span>
                        <span className="form-label-pro-hint">{t('required')}</span>
                      </div>
                      <input
                        type="tel"
                        className="form-input-pro"
                        value={formData.phone}
                        onChange={(e) => updateField('phone', e.target.value)}
                        required
                        placeholder="+49 xxx xxxxxxx"
                      />
                    </div>
                    <div className="form-field-pro">
                      <div className="form-label-pro">
                        <span className="form-label-pro-text">{t('email')}</span>
                      </div>
                      <input
                        type="email"
                        className="form-input-pro"
                        value={formData.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>
                </div>

                {/* Availability & Guidance — shown to the on-call person deciding
                    which provider to call, especially useful when they're not a
                    trade professional and need real signal beyond a bare name. */}
                <div className="modal-pro-section">
                  <div className="modal-pro-section-title">{t('availabilityGuidanceSection')}</div>

                  <div className="form-field-pro">
                    <div className="form-label-pro">
                      <span className="form-label-pro-text">{t('usageNote')}</span>
                    </div>
                    <input
                      type="text"
                      className="form-input-pro"
                      value={formData.usageNote}
                      onChange={(e) => updateField('usageNote', e.target.value)}
                      placeholder={t('usageNoteHint')}
                    />
                  </div>

                  <div className="form-field-pro">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.available24h}
                        onChange={(e) => updateField('available24h', e.target.checked)}
                      />
                      <span className="form-label-pro-text">{t('available24h')}</span>
                    </label>
                  </div>

                  {!formData.available24h && (
                    <div className="form-row-pro">
                      <div className="form-field-pro">
                        <div className="form-label-pro">
                          <span className="form-label-pro-text">{t('availableFrom')}</span>
                        </div>
                        <input
                          type="time"
                          className="form-input-pro"
                          value={formData.availableFrom}
                          onChange={(e) => updateField('availableFrom', e.target.value)}
                        />
                      </div>
                      <div className="form-field-pro">
                        <div className="form-label-pro">
                          <span className="form-label-pro-text">{t('availableTo')}</span>
                        </div>
                        <input
                          type="time"
                          className="form-input-pro"
                          value={formData.availableTo}
                          onChange={(e) => updateField('availableTo', e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-pro-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  {t('cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (
                    <>
                      <span className="loading-spinner" style={{ width: 16, height: 16, marginBottom: 0 }} />
                      {t('savingChanges')}
                    </>
                  ) : (
                    editingSp ? t('saveChanges') : t('addProvider')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
