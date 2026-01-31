import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';

// Icons
const CompanyIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1" />
    <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const BuildingIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
  </svg>
);

const AlertIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
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

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday', shortLabel: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', shortLabel: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', shortLabel: 'Wed' },
  { key: 'thursday', label: 'Thursday', shortLabel: 'Thu' },
  { key: 'friday', label: 'Friday', shortLabel: 'Fri' },
  { key: 'saturday', label: 'Saturday', shortLabel: 'Sat' },
  { key: 'sunday', label: 'Sunday', shortLabel: 'Sun' },
];

const defaultDayHours = {
  monday: { enabled: true, start: '18:00', end: '07:00' },
  tuesday: { enabled: true, start: '18:00', end: '07:00' },
  wednesday: { enabled: true, start: '18:00', end: '07:00' },
  thursday: { enabled: true, start: '18:00', end: '07:00' },
  friday: { enabled: true, start: '18:00', end: '07:00' },
  saturday: { enabled: true, start: '00:00', end: '23:59' },
  sunday: { enabled: true, start: '00:00', end: '23:59' },
};

const initialFormState = {
  name: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  servicePhone: '',
  address: '',
  city: '',
  postalCode: '',
  country: 'Germany',
  notes: '',
  status: 'active',
  aiConfidenceThreshold: 80,
  sameHoursAllDays: true,
  afterhoursStart: '18:00',
  afterhoursEnd: '07:00',
  afterhoursByDay: { ...defaultDayHours },
};

export function PmCompanies() {
  const [pmCompanies, setPmCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPm, setEditingPm] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const filteredPmCompanies = pmCompanies.filter(pm => {
    const matchesSearch = !searchTerm ||
      pm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pm.contact_email && pm.contact_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (pm.service_phone && pm.service_phone.includes(searchTerm));

    let matchesStatus = true;
    if (filterStatus === 'has_incidents') {
      matchesStatus = parseInt(pm.open_incidents) > 0;
    } else if (filterStatus === 'no_incidents') {
      matchesStatus = parseInt(pm.open_incidents) === 0;
    } else if (filterStatus === 'active') {
      matchesStatus = pm.status !== 'inactive';
    } else if (filterStatus === 'inactive') {
      matchesStatus = pm.status === 'inactive';
    }

    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await api.getPmCompanies();
      setPmCompanies(data.pmCompanies);
    } catch (err) {
      console.error('Failed to load PM companies:', err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (pm = null) => {
    if (pm) {
      setEditingPm(pm);
      // Parse afterhours_by_day from the database (JSON string or object)
      let parsedByDay = { ...defaultDayHours };
      if (pm.afterhours_by_day) {
        try {
          parsedByDay = typeof pm.afterhours_by_day === 'string'
            ? JSON.parse(pm.afterhours_by_day)
            : pm.afterhours_by_day;
        } catch (e) {
          console.error('Failed to parse afterhours_by_day:', e);
        }
      }
      setFormData({
        name: pm.name || '',
        contactName: pm.contact_name || '',
        contactEmail: pm.contact_email || '',
        contactPhone: pm.contact_phone || '',
        servicePhone: pm.service_phone || '',
        address: pm.address || '',
        city: pm.city || '',
        postalCode: pm.postal_code || '',
        country: pm.country || 'Germany',
        notes: pm.notes || '',
        status: pm.status || 'active',
        aiConfidenceThreshold: pm.ai_confidence_threshold || 80,
        sameHoursAllDays: pm.same_hours_all_days !== false,
        afterhoursStart: pm.afterhours_start?.slice(0, 5) || '18:00',
        afterhoursEnd: pm.afterhours_end?.slice(0, 5) || '07:00',
        afterhoursByDay: parsedByDay,
      });
    } else {
      setEditingPm(null);
      setFormData({ ...initialFormState, afterhoursByDay: { ...defaultDayHours } });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingPm) {
        await api.updatePmCompany(editingPm.id, formData);
      } else {
        await api.createPmCompany(formData);
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(t('confirmDeletePm').replace('{0}', name))) return;
    try {
      await api.deletePmCompany(id);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateDayHours = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      afterhoursByDay: {
        ...prev.afterhoursByDay,
        [day]: {
          ...prev.afterhoursByDay[day],
          [field]: value
        }
      }
    }));
  };

  const applyToAllDays = () => {
    const template = formData.afterhoursByDay.monday;
    const updated = {};
    DAYS_OF_WEEK.forEach(({ key }) => {
      updated[key] = { ...template };
    });
    setFormData(prev => ({ ...prev, afterhoursByDay: updated }));
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>{t('loadingPmCompanies')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">{t('pmCompanies')}</h1>
        <p className="page-subtitle">{t('pmCompaniesDescription')}</p>
      </div>

      {/* Stats Summary */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon primary">
              <CompanyIcon />
            </div>
          </div>
          <div className="stat-card-value">{pmCompanies.length}</div>
          <div className="stat-card-label">{t('totalCompanies')}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon success">
              <BuildingIcon />
            </div>
          </div>
          <div className="stat-card-value">
            {pmCompanies.reduce((sum, pm) => sum + (parseInt(pm.building_count) || 0), 0)}
          </div>
          <div className="stat-card-label">{t('totalProperties')}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon warning">
              <AlertIcon />
            </div>
          </div>
          <div className="stat-card-value" style={{
            color: pmCompanies.reduce((sum, pm) => sum + (parseInt(pm.open_incidents) || 0), 0) > 0
              ? 'var(--color-danger)' : undefined
          }}>
            {pmCompanies.reduce((sum, pm) => sum + (parseInt(pm.open_incidents) || 0), 0)}
          </div>
          <div className="stat-card-label">{t('openIncidents')}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon primary">
              <PhoneIcon />
            </div>
          </div>
          <div className="stat-card-value">
            {pmCompanies.filter(pm => pm.service_phone).length}
          </div>
          <div className="stat-card-label">{t('withServicePhone')}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: 250 }}>
              <SearchIcon />
              <input
                type="text"
                className="form-input"
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: 40 }}
              />
              <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
                <SearchIcon />
              </div>
            </div>

            <select
              className="form-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ width: 200 }}
            >
              <option value="all">{t('allCompanies')}</option>
              <option value="active">{t('activeOnly')}</option>
              <option value="inactive">{t('inactiveOnly')}</option>
              <option value="has_incidents">{t('withOpenIncidents')}</option>
              <option value="no_incidents">{t('noOpenIncidents')}</option>
            </select>

            <button className="btn btn-primary" onClick={() => openModal()}>
              <PlusIcon /> {t('addPmCompany')}
            </button>
          </div>

          {(searchTerm || filterStatus !== 'all') && (
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-text-muted)' }}>
              {t('showingXofY').replace('{0}', filteredPmCompanies.length).replace('{1}', pmCompanies.length)}
            </div>
          )}
        </div>
      </div>

      {/* Companies Table */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('company')}</th>
                <th>{t('servicePhone')}</th>
                <th style={{ width: 100 }}>{t('properties')}</th>
                <th style={{ width: 120 }}>{t('openIncidents')}</th>
                <th style={{ width: 120 }}>{t('afterHours')}</th>
                <th style={{ width: 100 }}>{t('status')}</th>
                <th style={{ width: 160 }}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredPmCompanies.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <CompanyIcon />
                      </div>
                      <h3 className="empty-state-title">
                        {pmCompanies.length === 0 ? t('noPmCompaniesYet') : t('noResultsFound')}
                      </h3>
                      <p className="empty-state-description">
                        {pmCompanies.length === 0
                          ? t('addFirstPmCompanyDescription')
                          : t('tryAdjustingSearch')}
                      </p>
                      {pmCompanies.length === 0 && (
                        <button className="btn btn-primary" onClick={() => openModal()}>
                          <PlusIcon /> {t('addPmCompany')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPmCompanies.map((pm) => (
                  <tr key={pm.id} className="clickable" onClick={() => navigate(`/pm/${pm.id}`)}>
                    <td>
                      <div className="table-cell-main">{pm.name}</div>
                      {pm.contact_email && (
                        <div className="table-cell-sub">{pm.contact_email}</div>
                      )}
                      {pm.city && (
                        <div className="table-cell-sub">{pm.city}</div>
                      )}
                    </td>
                    <td>
                      {pm.service_phone ? (
                        <span className="font-semibold">{pm.service_phone}</span>
                      ) : (
                        <span className="text-muted">{t('notSet')}</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-default">{pm.building_count || 0}</span>
                    </td>
                    <td>
                      {parseInt(pm.open_incidents) > 0 ? (
                        <span className="badge badge-danger">{pm.open_incidents} {t('open')}</span>
                      ) : (
                        <span className="badge badge-success">0</span>
                      )}
                    </td>
                    <td className="text-sm text-secondary">
                      {pm.afterhours_start?.slice(0, 5) || '18:00'} - {pm.afterhours_end?.slice(0, 5) || '07:00'}
                    </td>
                    <td>
                      <span className={`badge ${pm.status === 'inactive' ? 'badge-warning' : 'badge-success'}`}>
                        {pm.status === 'inactive' ? t('inactive') : t('active')}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openModal(pm)}
                          title={t('edit')}
                        >
                          <EditIcon /> {t('edit')}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDelete(pm.id, pm.name)}
                          title={t('delete')}
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
          <div className="modal-pro" style={{ maxWidth: '600px', width: '95vw' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-pro-header">
              <div className="modal-pro-icon primary">
                <CompanyIcon />
              </div>
              <div className="modal-pro-title-group">
                <h2 className="modal-pro-title">
                  {editingPm ? t('editPmCompany') : t('addPmCompany')}
                </h2>
                <p className="modal-pro-subtitle">
                  {editingPm ? `${t('editing')} ${editingPm.name}` : t('addNewPmCompany')}
                </p>
              </div>
              <button className="modal-pro-close" onClick={() => setShowModal(false)}>
                <CloseIcon />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-pro-body">
                {/* Company Information Section */}
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
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      required
                      placeholder="e.g., ABC Property Management"
                    />
                  </div>

                  <div className="form-field-pro">
                    <div className="form-label-pro">
                      <span className="form-label-pro-text">{t('status')}</span>
                    </div>
                    <select
                      className="form-input-pro"
                      value={formData.status}
                      onChange={(e) => updateField('status', e.target.value)}
                      style={{ cursor: 'pointer' }}
                    >
                      <option value="active">{t('active')}</option>
                      <option value="inactive">{t('inactive')}</option>
                    </select>
                  </div>

                  <div className="form-field-pro">
                    <div className="form-label-pro">
                      <span className="form-label-pro-text">{t('servicePhoneHotline')}</span>
                      <span className="form-label-pro-hint">{t('tenantsCallThis')}</span>
                    </div>
                    <input
                      type="text"
                      className="form-input-pro"
                      value={formData.servicePhone}
                      onChange={(e) => updateField('servicePhone', e.target.value)}
                      placeholder="e.g., +49 30 12345678"
                    />
                  </div>

                  <div className="form-field-pro">
                    <div className="form-label-pro">
                      <span className="form-label-pro-text">{t('address')}</span>
                    </div>
                    <input
                      type="text"
                      className="form-input-pro"
                      value={formData.address}
                      onChange={(e) => updateField('address', e.target.value)}
                      placeholder={t('streetAddress')}
                    />
                  </div>

                  <div className="form-field-pro">
                    <div className="form-label-pro">
                      <span className="form-label-pro-text">{t('city')}</span>
                    </div>
                    <input
                      type="text"
                      className="form-input-pro"
                      value={formData.city}
                      onChange={(e) => updateField('city', e.target.value)}
                      placeholder={t('city')}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-field-pro">
                      <div className="form-label-pro">
                        <span className="form-label-pro-text">{t('postalCode')}</span>
                      </div>
                      <input
                        type="text"
                        className="form-input-pro"
                        value={formData.postalCode}
                        onChange={(e) => updateField('postalCode', e.target.value)}
                        placeholder="12345"
                      />
                    </div>
                    <div className="form-field-pro">
                      <div className="form-label-pro">
                        <span className="form-label-pro-text">{t('country')}</span>
                      </div>
                      <input
                        type="text"
                        className="form-input-pro"
                        value={formData.country}
                        onChange={(e) => updateField('country', e.target.value)}
                        placeholder="Germany"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information Section */}
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

                  <div className="form-field-pro">
                    <div className="form-label-pro">
                      <span className="form-label-pro-text">{t('email')}</span>
                      <span className="form-label-pro-hint">{t('emailForReports')}</span>
                    </div>
                    <input
                      type="email"
                      className="form-input-pro"
                      value={formData.contactEmail}
                      onChange={(e) => updateField('contactEmail', e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="form-field-pro">
                    <div className="form-label-pro">
                      <span className="form-label-pro-text">{t('phone')}</span>
                      <span className="form-label-pro-hint">{t('phoneForEscalations')}</span>
                    </div>
                    <input
                      type="text"
                      className="form-input-pro"
                      value={formData.contactPhone}
                      onChange={(e) => updateField('contactPhone', e.target.value)}
                      placeholder="+49 xxx xxxxxxx"
                    />
                  </div>
                </div>

                {/* After-Hours Settings Section */}
                <div className="modal-pro-section">
                  <div className="modal-pro-section-title">{t('afterHoursSettings')}</div>

                  {/* Toggle: Same for all days vs Custom per day */}
                  <div className="form-field-pro" style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="hoursMode"
                          checked={formData.sameHoursAllDays}
                          onChange={() => updateField('sameHoursAllDays', true)}
                        />
                        <span>{t('sameHoursAllDays') || 'Same hours for all days'}</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="hoursMode"
                          checked={!formData.sameHoursAllDays}
                          onChange={() => updateField('sameHoursAllDays', false)}
                        />
                        <span>{t('customHoursPerDay') || 'Custom per day'}</span>
                      </label>
                    </div>
                  </div>

                  {/* Same hours for all days */}
                  {formData.sameHoursAllDays ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-field-pro">
                        <div className="form-label-pro">
                          <span className="form-label-pro-text">{t('afterHoursStart')}</span>
                        </div>
                        <input
                          type="time"
                          className="form-input-pro"
                          value={formData.afterhoursStart}
                          onChange={(e) => updateField('afterhoursStart', e.target.value)}
                        />
                      </div>
                      <div className="form-field-pro">
                        <div className="form-label-pro">
                          <span className="form-label-pro-text">{t('afterHoursEnd')}</span>
                        </div>
                        <input
                          type="time"
                          className="form-input-pro"
                          value={formData.afterhoursEnd}
                          onChange={(e) => updateField('afterhoursEnd', e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    /* Custom hours per day */
                    <div>
                      <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={applyToAllDays}
                          style={{ fontSize: '12px' }}
                        >
                          {t('applyMondayToAll') || 'Apply Monday to all'}
                        </button>
                      </div>
                      <div style={{
                        display: 'grid',
                        gap: '8px',
                        background: 'var(--color-bg-hover)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px'
                      }}>
                        {DAYS_OF_WEEK.map(({ key, label, shortLabel }) => (
                          <div
                            key={key}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '100px auto 1fr 1fr',
                              gap: '12px',
                              alignItems: 'center',
                              padding: '8px',
                              background: formData.afterhoursByDay[key]?.enabled ? 'var(--color-bg-card)' : 'transparent',
                              borderRadius: 'var(--radius-sm)',
                              opacity: formData.afterhoursByDay[key]?.enabled ? 1 : 0.6
                            }}
                          >
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={formData.afterhoursByDay[key]?.enabled ?? true}
                                onChange={(e) => updateDayHours(key, 'enabled', e.target.checked)}
                              />
                              <span style={{ fontWeight: 500, fontSize: '13px' }}>{shortLabel}</span>
                            </label>
                            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                              {formData.afterhoursByDay[key]?.enabled ? '' : '(Off)'}
                            </span>
                            <input
                              type="time"
                              className="form-input-pro"
                              value={formData.afterhoursByDay[key]?.start || '18:00'}
                              onChange={(e) => updateDayHours(key, 'start', e.target.value)}
                              disabled={!formData.afterhoursByDay[key]?.enabled}
                              style={{ padding: '6px 10px', fontSize: '13px' }}
                            />
                            <input
                              type="time"
                              className="form-input-pro"
                              value={formData.afterhoursByDay[key]?.end || '07:00'}
                              onChange={(e) => updateDayHours(key, 'end', e.target.value)}
                              disabled={!formData.afterhoursByDay[key]?.enabled}
                              style={{ padding: '6px 10px', fontSize: '13px' }}
                            />
                          </div>
                        ))}
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                        {t('afterHoursPerDayHint') || 'Uncheck days when your service is not available after-hours.'}
                      </p>
                    </div>
                  )}

                  <div className="form-field-pro" style={{ marginTop: '16px' }}>
                    <div className="form-label-pro">
                      <span className="form-label-pro-text">{t('aiConfidenceThreshold')}</span>
                      <span className="form-label-pro-hint">{formData.aiConfidenceThreshold}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={formData.aiConfidenceThreshold}
                      onChange={(e) => updateField('aiConfidenceThreshold', parseInt(e.target.value))}
                      style={{ width: '100%', height: 8, cursor: 'pointer' }}
                    />
                    <div className="form-hint" style={{ marginTop: 8 }}>
                      {t('aiDecisionsBelowThreshold')}
                    </div>
                  </div>
                </div>

                {/* Notes Section */}
                <div className="modal-pro-section">
                  <div className="modal-pro-section-title">{t('additionalNotes')}</div>
                  <div className="form-field-pro">
                    <textarea
                      className="form-input-pro"
                      value={formData.notes}
                      onChange={(e) => updateField('notes', e.target.value)}
                      placeholder={t('internalNotes')}
                      rows={3}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
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
                    editingPm ? t('saveChanges') : t('createCompany')
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
