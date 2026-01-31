import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

// Icons
const CompanyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1"/>
    <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/>
  </svg>
);

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CreditCardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

const StarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const ReceiptIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/>
    <path d="M8 10h8M8 14h4"/>
  </svg>
);

const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const AlertTriangleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

export function Settings() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState('company');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Company settings
  const [company, setCompany] = useState(null);
  const [companyForm, setCompanyForm] = useState({
    name: '',
    phoneNumber: '',
    fmOncallPhone: '',
    fmOncallName: '',
    aiConfidenceThreshold: 80,
    ownerEmail: '',
  });

  // Profile
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
  });

  // Password
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Users (admin only)
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    isAdmin: false,
  });

  // Billing
  const [billing, setBilling] = useState(null);
  const [plans, setPlans] = useState([]);
  const [billingLoading, setBillingLoading] = useState(false);

  // Privacy / GDPR
  const [gdprRequests, setGdprRequests] = useState({ export_requests: [], deletion_requests: [] });
  const [consentStatus, setConsentStatus] = useState({ marketing: false, analytics: false, data_sharing: false });
  const [myData, setMyData] = useState(null);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [companyRes, profileRes] = await Promise.all([
        api.getCompanySettings(),
        api.getProfile(),
      ]);

      setCompany(companyRes.company);
      setCompanyForm({
        name: companyRes.company.name || '',
        phoneNumber: companyRes.company.phone_number || '',
        fmOncallPhone: companyRes.company.fm_oncall_phone || '',
        fmOncallName: companyRes.company.fm_oncall_name || '',
        aiConfidenceThreshold: companyRes.company.ai_confidence_threshold || 80,
        ownerEmail: companyRes.company.owner_email || '',
      });

      setProfile(profileRes.profile);
      setProfileForm({
        name: profileRes.profile.name || '',
        email: profileRes.profile.email || '',
      });

      // Load users if admin
      if (profileRes.profile.is_admin) {
        try {
          const usersRes = await api.getUsers();
          setUsers(usersRes.users || []);
        } catch (err) {
          console.error('Failed to load users:', err);
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSaveCompany = async () => {
    setSaving(true);
    try {
      await api.updateCompanySettings(companyForm);
      showMessage('success', 'Company settings saved successfully');
    } catch (err) {
      showMessage('error', 'Failed to save company settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.updateProfile(profileForm);
      showMessage('success', 'Profile updated successfully');
    } catch (err) {
      showMessage('error', 'Failed to update profile: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMessage('error', 'New passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      showMessage('error', 'Password must be at least 8 characters');
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showMessage('success', 'Password changed successfully');
    } catch (err) {
      showMessage('error', 'Failed to change password: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddUser = async () => {
    if (!userForm.email || !userForm.password) {
      showMessage('error', language === 'de' ? 'E-Mail und Passwort sind erforderlich' : 'Email and password are required');
      return;
    }
    setSaving(true);
    try {
      await api.createUser(userForm);
      setShowUserModal(false);
      setUserForm({ name: '', email: '', password: '', isAdmin: false });
      const usersRes = await api.getUsers();
      setUsers(usersRes.users || []);
      showMessage('success', language === 'de' ? 'Benutzer erfolgreich erstellt' : 'User created successfully');
    } catch (err) {
      showMessage('error', (language === 'de' ? 'Benutzer konnte nicht erstellt werden: ' : 'Failed to create user: ') + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditUser = (userToEdit) => {
    setEditingUser(userToEdit);
    setUserForm({
      name: userToEdit.name || '',
      email: userToEdit.email || '',
      password: '',
      isAdmin: userToEdit.is_admin || false,
    });
    setShowUserModal(true);
  };

  const handleUpdateUser = async () => {
    if (!userForm.email) {
      showMessage('error', language === 'de' ? 'E-Mail ist erforderlich' : 'Email is required');
      return;
    }
    setSaving(true);
    try {
      const updateData = {
        name: userForm.name,
        email: userForm.email,
        isAdmin: userForm.isAdmin,
      };
      // Only include password if it was changed
      if (userForm.password) {
        updateData.password = userForm.password;
      }
      await api.updateUser(editingUser.id, updateData);
      setShowUserModal(false);
      setEditingUser(null);
      setUserForm({ name: '', email: '', password: '', isAdmin: false });
      const usersRes = await api.getUsers();
      setUsers(usersRes.users || []);
      showMessage('success', language === 'de' ? 'Benutzer erfolgreich aktualisiert' : 'User updated successfully');
    } catch (err) {
      showMessage('error', (language === 'de' ? 'Benutzer konnte nicht aktualisiert werden: ' : 'Failed to update user: ') + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCloseUserModal = () => {
    setShowUserModal(false);
    setEditingUser(null);
    setUserForm({ name: '', email: '', password: '', isAdmin: false });
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm(language === 'de' ? 'Möchten Sie diesen Benutzer wirklich löschen?' : 'Are you sure you want to delete this user?')) return;
    try {
      await api.deleteUser(userId);
      const usersRes = await api.getUsers();
      setUsers(usersRes.users || []);
      showMessage('success', language === 'de' ? 'Benutzer erfolgreich gelöscht' : 'User deleted successfully');
    } catch (err) {
      showMessage('error', (language === 'de' ? 'Benutzer konnte nicht gelöscht werden: ' : 'Failed to delete user: ') + err.message);
    }
  };

  // Billing handlers
  const loadBilling = async () => {
    setBillingLoading(true);
    try {
      const [statusRes, plansRes] = await Promise.all([
        api.getBillingStatus(),
        api.getBillingPlans(language),
      ]);
      setBilling(statusRes);
      setPlans(plansRes.plans || []);
    } catch (err) {
      console.error('Failed to load billing:', err);
    } finally {
      setBillingLoading(false);
    }
  };

  const handleSubscribe = async (priceId) => {
    setSaving(true);
    try {
      const result = await api.createCheckoutSession(priceId);
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      showMessage('error', 'Failed to start checkout: ' + err.message);
      setSaving(false);
    }
  };

  const handleManageBilling = async () => {
    setSaving(true);
    try {
      const result = await api.createBillingPortal();
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      showMessage('error', 'Failed to open billing portal: ' + err.message);
      setSaving(false);
    }
  };

  // Load billing when tab changes or language changes
  useEffect(() => {
    if (activeTab === 'billing' && !billingLoading) {
      loadBilling();
    }
  }, [activeTab, language]);

  // Privacy / GDPR handlers
  const loadPrivacy = async () => {
    setPrivacyLoading(true);
    try {
      const [requestsRes, consentRes, dataRes] = await Promise.all([
        api.getGdprRequests().catch(() => ({ export_requests: [], deletion_requests: [] })),
        api.getConsentStatus().catch(() => ({ marketing: false, analytics: false, data_sharing: false })),
        api.getMyData().catch(() => null),
      ]);
      setGdprRequests(requestsRes);
      setConsentStatus(consentRes);
      setMyData(dataRes);
    } catch (err) {
      console.error('Failed to load privacy data:', err);
    } finally {
      setPrivacyLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'privacy' && !privacyLoading) {
      loadPrivacy();
    }
  }, [activeTab]);

  const handleRequestExport = async () => {
    setSaving(true);
    try {
      await api.requestDataExport();
      showMessage('success', language === 'de' ? 'Exportanfrage wurde gesendet' : 'Export request submitted');
      loadPrivacy();
    } catch (err) {
      showMessage('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (!deleteReason.trim()) {
      showMessage('error', language === 'de' ? 'Bitte geben Sie einen Grund an' : 'Please provide a reason');
      return;
    }
    setSaving(true);
    try {
      await api.requestAccountDeletion(deleteReason);
      setShowDeleteModal(false);
      setDeleteReason('');
      showMessage('success', language === 'de' ? 'Löschanfrage wurde gesendet' : 'Deletion request submitted');
      loadPrivacy();
    } catch (err) {
      showMessage('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelDeletion = async (id) => {
    setSaving(true);
    try {
      await api.cancelDeletionRequest(id);
      showMessage('success', language === 'de' ? 'Löschanfrage wurde storniert' : 'Deletion request cancelled');
      loadPrivacy();
    } catch (err) {
      showMessage('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConsentChange = async (type, value) => {
    try {
      await api.updateConsent(type, value);
      setConsentStatus(prev => ({ ...prev, [type]: value }));
    } catch (err) {
      showMessage('error', err.message);
    }
  };

  const openCookieSettings = () => {
    window.dispatchEvent(new CustomEvent('openCookieSettings'));
  };

  const tabs = [
    { id: 'company', label: t('company'), icon: <CompanyIcon /> },
    { id: 'profile', label: t('profile'), icon: <UserIcon /> },
    { id: 'security', label: t('security'), icon: <LockIcon /> },
    { id: 'billing', label: t('billing'), icon: <CreditCardIcon /> },
    { id: 'privacy', label: language === 'de' ? 'Datenschutz' : 'Privacy', icon: <ShieldIcon /> },
  ];

  if (profile?.is_admin) {
    tabs.push({ id: 'users', label: t('users'), icon: <UsersIcon /> });
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>{t('loadingSettings')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">{t('settings')}</h1>
        <p className="page-subtitle">{t('manageSettings')}</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Company Tab */}
      {activeTab === 'company' && (
        <div style={{ maxWidth: 600 }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">{t('companyInformation')}</h3>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">{t('companyName')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  placeholder={language === 'de' ? 'Ihr Firmenname' : 'Your company name'}
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('inboundPhoneNumber')}</label>
                <input
                  type="tel"
                  className="form-input"
                  value={companyForm.phoneNumber}
                  onChange={(e) => setCompanyForm({ ...companyForm, phoneNumber: e.target.value })}
                  placeholder="+49..."
                />
                <div className="form-hint">
                  {t('phoneHint')}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t('fmOncallPhone')}</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={companyForm.fmOncallPhone}
                    onChange={(e) => setCompanyForm({ ...companyForm, fmOncallPhone: e.target.value })}
                    placeholder="+49..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('fmOncallName')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={companyForm.fmOncallName}
                    onChange={(e) => setCompanyForm({ ...companyForm, fmOncallName: e.target.value })}
                    placeholder={language === 'de' ? 'Name des Bereitschaftsmanagers' : 'On-call manager name'}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t('ownerEmail')}</label>
                <input
                  type="email"
                  className="form-input"
                  value={companyForm.ownerEmail}
                  onChange={(e) => setCompanyForm({ ...companyForm, ownerEmail: e.target.value })}
                  placeholder="owner@company.com"
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('aiConfidenceThreshold')}: {companyForm.aiConfidenceThreshold}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={companyForm.aiConfidenceThreshold}
                  onChange={(e) => setCompanyForm({ ...companyForm, aiConfidenceThreshold: parseInt(e.target.value) })}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }} className="text-muted">
                  <span>{t('moreEscalations')}</span>
                  <span>{t('fewerEscalations')}</span>
                </div>
              </div>

              {company && (
                <div className="info-box info" style={{ marginTop: 20 }}>
                  <div className="info-box-content">
                    <div className="info-box-title">{t('accountStatus')}</div>
                    <div style={{ display: 'flex', gap: 24, marginTop: 8, fontSize: 13 }}>
                      <div>
                        <span className="text-muted">{t('status')}: </span>
                        <span className={`badge ${company.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                          {company.status === 'active' ? t('active') : company.status === 'trial' ? t('trial') : company.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted">{t('created')}: </span>
                        <span>{new Date(company.created_at).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button className="btn btn-primary" onClick={handleSaveCompany} disabled={saving}>
                  {saving ? t('saving') : t('saveChanges')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div style={{ maxWidth: 600 }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">{t('yourProfile')}</h3>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">{t('name')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  placeholder={language === 'de' ? 'Ihr Name' : 'Your name'}
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('email')}</label>
                <input
                  type="email"
                  className="form-input"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  placeholder={language === 'de' ? 'Ihre E-Mail' : 'Your email'}
                />
              </div>

              {profile && (
                <div className="info-box info" style={{ marginTop: 16 }}>
                  <div className="info-box-content">
                    <div style={{ fontSize: 13 }}>
                      <span className="text-muted">{t('role')}: </span>
                      <span className={`badge ${profile.is_admin ? 'badge-primary' : 'badge-default'}`}>
                        {profile.is_admin ? t('admin') : t('staff')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button className="btn btn-primary" onClick={handleSaveProfile} disabled={saving}>
                  {saving ? t('saving') : t('updateProfile')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div style={{ maxWidth: 600 }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">{t('changePassword')}</h3>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">{t('currentPassword')}</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  placeholder={language === 'de' ? 'Aktuelles Passwort eingeben' : 'Enter current password'}
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('newPassword')}</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder={t('minCharacters')}
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('confirmPassword')}</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder={t('reenterPassword')}
                />
              </div>

              <div className="form-actions">
                <button className="btn btn-primary" onClick={handleChangePassword} disabled={saving}>
                  {saving ? t('changing') : t('changePassword')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && profile?.is_admin && (
        <div>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">{t('teamMembers')}</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowUserModal(true)}>
                <PlusIcon /> {t('addUser')}
              </button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>{t('user')}</th>
                    <th style={{ width: 100 }}>{t('role')}</th>
                    <th style={{ width: 140 }}>{t('created')}</th>
                    <th style={{ width: 80 }}>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <div className="empty-state">
                          <div className="empty-state-icon">
                            <UsersIcon />
                          </div>
                          <h3 className="empty-state-title">{t('noUsersYet')}</h3>
                          <p className="empty-state-description">
                            {t('addTeamMembers')}
                          </p>
                          <button className="btn btn-primary" onClick={() => setShowUserModal(true)}>
                            <PlusIcon /> {t('addUser')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="table-cell-main">{u.name || u.email}</div>
                          {u.name && <div className="table-cell-sub">{u.email}</div>}
                        </td>
                        <td>
                          <span className={`badge ${u.is_admin ? 'badge-primary' : 'badge-default'}`}>
                            {u.is_admin ? t('admin') : t('staff')}
                          </span>
                        </td>
                        <td className="text-sm text-secondary">
                          {new Date(u.created_at).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US')}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleEditUser(u)}
                              title={language === 'de' ? 'Benutzer bearbeiten' : 'Edit user'}
                            >
                              <EditIcon />
                            </button>
                            {u.id !== user?.id && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleDeleteUser(u.id)}
                                title={language === 'de' ? 'Benutzer löschen' : 'Delete user'}
                                style={{ color: 'var(--color-danger)' }}
                              >
                                <TrashIcon />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Billing Tab */}
      {activeTab === 'billing' && (
        <div className="billing-tab">
          {billingLoading ? (
            <div className="loading" style={{ padding: 40 }}>
              <div className="loading-spinner"></div>
              <p>{t('loadingBilling')}</p>
            </div>
          ) : (
            <>
              {/* Trial Banner */}
              {billing?.company?.trialDaysRemaining > 0 && billing?.subscription?.status !== 'active' && (
                <div style={{
                  background: 'linear-gradient(135deg, var(--color-primary), var(--color-info))',
                  borderRadius: 12,
                  padding: '20px 24px',
                  marginBottom: 24,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                      background: 'rgba(255,255,255,0.2)',
                      borderRadius: 12,
                      width: 48,
                      height: 48,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <ClockIcon />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 2 }}>
                        {language === 'de'
                          ? `Noch ${billing.company.trialDaysRemaining} Tage in der Testphase`
                          : `${billing.company.trialDaysRemaining} ${t('daysLeftInTrial')}`}
                      </div>
                      <div style={{ opacity: 0.9, fontSize: 13 }}>
                        {t('subscribeTooContinue')}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Current Subscription Card */}
              <div className="card" style={{ maxWidth: 480, marginBottom: 32 }}>
                <div className="card-body" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        background: billing?.subscription?.status === 'active'
                          ? 'var(--color-success-bg)'
                          : 'var(--color-primary-light)',
                        color: billing?.subscription?.status === 'active'
                          ? 'var(--color-success)'
                          : 'var(--color-primary)',
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <CreditCardIcon />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                          {t('currentPlan')}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                          {billing?.subscription?.status === 'active' ? t('activeSubscription') : t('noActiveSubscription')}
                        </div>
                      </div>
                    </div>
                    <span className={`badge ${
                      billing?.subscription?.status === 'active' ? 'badge-success' :
                      billing?.subscription?.status === 'past_due' ? 'badge-warning' :
                      billing?.company?.trialDaysRemaining > 0 ? 'badge-info' :
                      'badge-default'
                    }`} style={{ fontSize: 12 }}>
                      {billing?.subscription?.status === 'active' ? t('active') :
                       billing?.subscription?.status === 'past_due' ? t('pastDue') :
                       billing?.company?.trialDaysRemaining > 0 ? t('trial') : t('inactive')}
                    </span>
                  </div>

                  {billing?.subscription?.status === 'active' && (
                    <div style={{
                      borderTop: '1px solid var(--color-border)',
                      paddingTop: 16,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2 }}>
                          {billing.subscription?.cancelAtPeriodEnd ? t('endsOn') : t('renewsOn')}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>
                          {new Date(billing.subscription.currentPeriodEnd).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', {
                            day: 'numeric', month: 'long', year: 'numeric'
                          })}
                        </div>
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleManageBilling}
                        disabled={saving}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        {t('manage')} <ExternalLinkIcon />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Plans Section */}
              {(!billing?.subscription?.status || billing.subscription.status !== 'active') && (
                <>
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: 'var(--color-text)' }}>
                      {t('chooseYourPlan')}
                    </h3>
                    <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0 }}>
                      {t('selectPlanDescription')}
                      <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
                        {' '}{t('annualDiscount')}
                      </span>
                    </p>
                  </div>

                  {!billing?.stripeConfigured && (
                    <div style={{
                      background: 'var(--color-info-bg)',
                      border: '1px solid var(--color-info)',
                      borderRadius: 8,
                      padding: '12px 16px',
                      marginBottom: 20,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      fontSize: 13,
                      color: 'var(--color-info)',
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                      </svg>
                      <span>{t('onlinePaymentsComingSoon')}</span>
                    </div>
                  )}

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 16,
                    maxWidth: 1200,
                  }}>
                    {plans.map((plan) => (
                      <div
                        key={plan.id}
                        className="card"
                        style={{
                          position: 'relative',
                          border: plan.popular ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                          borderRadius: 12,
                          overflow: 'visible',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                      >
                        {plan.popular && (
                          <div style={{
                            position: 'absolute',
                            top: -12,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'var(--color-primary)',
                            color: 'white',
                            padding: '5px 14px',
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            whiteSpace: 'nowrap',
                          }}>
                            <StarIcon /> {t('mostPopular')}
                          </div>
                        )}
                        <div style={{ padding: '28px 24px 24px' }}>
                          <div style={{ marginBottom: 20 }}>
                            <h4 style={{
                              fontSize: 20,
                              fontWeight: 600,
                              marginBottom: 6,
                              color: 'var(--color-text)',
                            }}>
                              {plan.name}
                            </h4>
                            <p style={{
                              fontSize: 13,
                              color: 'var(--color-text-secondary)',
                              margin: 0,
                              lineHeight: 1.5,
                            }}>
                              {plan.description}
                            </p>
                          </div>

                          <div style={{ marginBottom: 16 }}>
                            {plan.price !== null ? (
                              <>
                                <span style={{
                                  fontSize: 36,
                                  fontWeight: 700,
                                  color: 'var(--color-text)',
                                }}>
                                  €{plan.price}
                                </span>
                                <span style={{
                                  fontSize: 14,
                                  color: 'var(--color-text-secondary)',
                                  marginLeft: 4,
                                }}>
                                  /{plan.interval}
                                </span>
                              </>
                            ) : (
                              <span style={{
                                fontSize: 24,
                                fontWeight: 600,
                                color: 'var(--color-primary)',
                              }}>
                                {t('onRequest')}
                              </span>
                            )}
                          </div>

                          {/* Limits */}
                          {plan.limits && (
                            <div style={{
                              background: 'var(--color-bg-secondary)',
                              borderRadius: 8,
                              padding: '10px 14px',
                              marginBottom: 20,
                              fontSize: 13,
                              color: 'var(--color-text-secondary)',
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span>{t('properties')}</span>
                                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                                  {typeof plan.limits.properties === 'number' ? `${t('upTo')} ${plan.limits.properties}` : plan.limits.properties}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>{t('callsPerMonth')}</span>
                                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                                  {typeof plan.limits.callsPerMonth === 'number' ? plan.limits.callsPerMonth : plan.limits.callsPerMonth}
                                </span>
                              </div>
                            </div>
                          )}

                          <ul style={{
                            listStyle: 'none',
                            padding: 0,
                            margin: '0 0 24px',
                            fontSize: 14,
                          }}>
                            {plan.features.map((feature, i) => (
                              <li key={i} style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 10,
                                marginBottom: 12,
                                color: 'var(--color-text)',
                              }}>
                                <span style={{
                                  color: 'var(--color-success)',
                                  marginTop: 2,
                                  flexShrink: 0,
                                }}>
                                  <CheckIcon />
                                </span>
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>

                          {/* Onboarding info */}
                          {plan.onboarding && (
                            <div style={{
                              fontSize: 12,
                              color: 'var(--color-text-secondary)',
                              marginBottom: 16,
                              textAlign: 'center',
                            }}>
                              {t('setup')}: {plan.onboarding}
                            </div>
                          )}

                          <button
                            className={`btn ${plan.popular ? 'btn-primary' : 'btn-secondary'}`}
                            style={{
                              width: '100%',
                              padding: '12px 20px',
                              fontSize: 14,
                              fontWeight: 500,
                            }}
                            onClick={() => plan.contactSales ? window.location.href = '/contact' : handleSubscribe(plan.priceId)}
                            disabled={saving || (!plan.contactSales && (!plan.priceId || !billing?.stripeConfigured))}
                          >
                            {saving ? t('loading') :
                             plan.contactSales ? t('contactSales') :
                             billing?.stripeConfigured ? t('getStarted') : t('comingSoon')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Invoices */}
              {billing?.invoices && billing.invoices.length > 0 && (
                <div style={{ maxWidth: 800, marginTop: 40 }}>
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ReceiptIcon /> {t('billingHistory')}
                      </h3>
                    </div>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>{t('date')}</th>
                            <th>{t('amount')}</th>
                            <th>{t('status')}</th>
                            <th style={{ width: 100 }}>{t('invoice')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {billing.invoices.map((invoice) => (
                            <tr key={invoice.id}>
                              <td>{new Date(invoice.created_at).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US')}</td>
                              <td style={{ fontWeight: 500 }}>
                                {(invoice.amount_paid / 100).toFixed(2)} {invoice.currency?.toUpperCase()}
                              </td>
                              <td>
                                <span className={`badge ${
                                  invoice.status === 'paid' ? 'badge-success' :
                                  invoice.status === 'open' ? 'badge-warning' :
                                  'badge-default'
                                }`}>
                                  {invoice.status === 'paid' ? t('paid') :
                                   invoice.status === 'open' ? t('open') : invoice.status}
                                </span>
                              </td>
                              <td>
                                {invoice.invoice_url && (
                                  <a
                                    href={invoice.invoice_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-secondary btn-sm"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  >
                                    {t('view')} <ExternalLinkIcon />
                                  </a>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Privacy Tab */}
      {activeTab === 'privacy' && (
        <div className="privacy-tab">
          {privacyLoading ? (
            <div className="loading" style={{ padding: 40 }}>
              <div className="loading-spinner"></div>
              <p>{language === 'de' ? 'Datenschutzeinstellungen laden...' : 'Loading privacy settings...'}</p>
            </div>
          ) : (
            <>
              {/* Cookie Settings */}
              <div className="card" style={{ maxWidth: 700, marginBottom: 24 }}>
                <div className="card-header">
                  <h3 className="card-title">
                    {language === 'de' ? 'Cookie-Einstellungen' : 'Cookie Settings'}
                  </h3>
                </div>
                <div className="card-body">
                  <p className="text-muted" style={{ marginBottom: 16 }}>
                    {language === 'de'
                      ? 'Verwalten Sie Ihre Cookie-Präferenzen für diese Website.'
                      : 'Manage your cookie preferences for this website.'}
                  </p>
                  <button className="btn btn-secondary" onClick={openCookieSettings}>
                    {language === 'de' ? 'Cookie-Einstellungen öffnen' : 'Open Cookie Settings'}
                  </button>
                </div>
              </div>

              {/* Consent Preferences */}
              <div className="card" style={{ maxWidth: 700, marginBottom: 24 }}>
                <div className="card-header">
                  <h3 className="card-title">
                    {language === 'de' ? 'Einwilligungen' : 'Consent Preferences'}
                  </h3>
                </div>
                <div className="card-body">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={consentStatus.marketing}
                        onChange={(e) => handleConsentChange('marketing', e.target.checked)}
                      />
                      <span className="toggle-switch-track">
                        <span className="toggle-switch-thumb" />
                      </span>
                      <span className="toggle-switch-label">
                        <span className="toggle-switch-title">
                          {language === 'de' ? 'Marketing-Kommunikation' : 'Marketing Communications'}
                        </span>
                        <span className="toggle-switch-desc">
                          {language === 'de'
                            ? 'Erhalten Sie Neuigkeiten, Updates und Angebote per E-Mail'
                            : 'Receive news, updates, and offers via email'}
                        </span>
                      </span>
                    </label>

                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={consentStatus.analytics}
                        onChange={(e) => handleConsentChange('analytics', e.target.checked)}
                      />
                      <span className="toggle-switch-track">
                        <span className="toggle-switch-thumb" />
                      </span>
                      <span className="toggle-switch-label">
                        <span className="toggle-switch-title">
                          {language === 'de' ? 'Nutzungsanalyse' : 'Usage Analytics'}
                        </span>
                        <span className="toggle-switch-desc">
                          {language === 'de'
                            ? 'Helfen Sie uns, das Produkt zu verbessern, indem Sie anonyme Nutzungsdaten teilen'
                            : 'Help us improve the product by sharing anonymous usage data'}
                        </span>
                      </span>
                    </label>

                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={consentStatus.data_sharing}
                        onChange={(e) => handleConsentChange('data_sharing', e.target.checked)}
                      />
                      <span className="toggle-switch-track">
                        <span className="toggle-switch-thumb" />
                      </span>
                      <span className="toggle-switch-label">
                        <span className="toggle-switch-title">
                          {language === 'de' ? 'Datenfreigabe' : 'Data Sharing'}
                        </span>
                        <span className="toggle-switch-desc">
                          {language === 'de'
                            ? 'Erlauben Sie die Weitergabe von Daten an vertrauenswürdige Partner'
                            : 'Allow sharing data with trusted partners'}
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Your Data */}
              {myData && (
                <div className="card" style={{ maxWidth: 700, marginBottom: 24 }}>
                  <div className="card-header">
                    <h3 className="card-title">
                      {language === 'de' ? 'Ihre Daten' : 'Your Data'}
                    </h3>
                  </div>
                  <div className="card-body">
                    <div style={{
                      background: 'var(--color-bg-secondary)',
                      borderRadius: 8,
                      padding: 16,
                      marginBottom: 16,
                    }}>
                      <div style={{ display: 'grid', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="text-muted">{language === 'de' ? 'Konto erstellt' : 'Account created'}</span>
                          <span>{myData.user?.created_at ? new Date(myData.user.created_at).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US') : '-'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="text-muted">{language === 'de' ? 'Erstellte Vorfälle' : 'Incidents created'}</span>
                          <span>{myData.data_summary?.incidents_created || 0}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="text-muted">{language === 'de' ? 'Login-Sitzungen' : 'Login sessions'}</span>
                          <span>{myData.data_summary?.login_sessions || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Data Export */}
              <div className="card" style={{ maxWidth: 700, marginBottom: 24 }}>
                <div className="card-header">
                  <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <DownloadIcon />
                    {language === 'de' ? 'Datenexport' : 'Data Export'}
                  </h3>
                </div>
                <div className="card-body">
                  <p className="text-muted" style={{ marginBottom: 16 }}>
                    {language === 'de'
                      ? 'Fordern Sie eine Kopie aller Ihrer personenbezogenen Daten an. Sie erhalten eine Benachrichtigung, wenn der Export fertig ist.'
                      : 'Request a copy of all your personal data. You will be notified when the export is ready.'}
                  </p>

                  {gdprRequests.export_requests?.some(r => r.status === 'pending' || r.status === 'processing') ? (
                    <div className="info-box info">
                      <div className="info-box-content">
                        {language === 'de'
                          ? 'Ihre Exportanfrage wird bearbeitet. Sie erhalten eine Benachrichtigung, wenn sie fertig ist.'
                          : 'Your export request is being processed. You will be notified when it\'s ready.'}
                      </div>
                    </div>
                  ) : (
                    <button className="btn btn-secondary" onClick={handleRequestExport} disabled={saving}>
                      <DownloadIcon style={{ marginRight: 8 }} />
                      {saving
                        ? (language === 'de' ? 'Senden...' : 'Submitting...')
                        : (language === 'de' ? 'Datenexport anfordern' : 'Request Data Export')}
                    </button>
                  )}

                  {gdprRequests.export_requests?.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <h4 style={{ fontSize: 14, marginBottom: 12 }}>
                        {language === 'de' ? 'Bisherige Anfragen' : 'Previous Requests'}
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {gdprRequests.export_requests.slice(0, 3).map(req => (
                          <div key={req.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: 'var(--color-bg-secondary)',
                            borderRadius: 6,
                            fontSize: 13,
                          }}>
                            <span>{new Date(req.created_at).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US')}</span>
                            <span className={`badge ${
                              req.status === 'completed' ? 'badge-success' :
                              req.status === 'processing' ? 'badge-info' :
                              'badge-warning'
                            }`}>
                              {req.status === 'completed' ? (language === 'de' ? 'Fertig' : 'Completed') :
                               req.status === 'processing' ? (language === 'de' ? 'In Bearbeitung' : 'Processing') :
                               (language === 'de' ? 'Ausstehend' : 'Pending')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Account Deletion */}
              <div className="card" style={{ maxWidth: 700, borderColor: 'var(--color-danger-light)' }}>
                <div className="card-header" style={{ background: 'rgba(239, 68, 68, 0.05)' }}>
                  <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-danger)' }}>
                    <AlertTriangleIcon />
                    {language === 'de' ? 'Konto löschen' : 'Delete Account'}
                  </h3>
                </div>
                <div className="card-body">
                  <p className="text-muted" style={{ marginBottom: 16 }}>
                    {language === 'de'
                      ? 'Fordern Sie die vollständige Löschung Ihres Kontos und aller zugehörigen Daten an. Dieser Vorgang kann nicht rückgängig gemacht werden.'
                      : 'Request complete deletion of your account and all associated data. This action cannot be undone.'}
                  </p>

                  {gdprRequests.deletion_requests?.some(r => r.status === 'pending' || r.status === 'processing') ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div className="info-box warning">
                        <div className="info-box-content">
                          {language === 'de'
                            ? 'Sie haben eine ausstehende Löschanfrage. Unser Team wird diese bearbeiten.'
                            : 'You have a pending deletion request. Our team will review it.'}
                        </div>
                      </div>
                      {gdprRequests.deletion_requests
                        .filter(r => r.status === 'pending')
                        .map(req => (
                          <button
                            key={req.id}
                            className="btn btn-secondary"
                            onClick={() => handleCancelDeletion(req.id)}
                            disabled={saving}
                          >
                            {language === 'de' ? 'Löschanfrage stornieren' : 'Cancel Deletion Request'}
                          </button>
                        ))}
                    </div>
                  ) : (
                    <button
                      className="btn"
                      style={{ background: 'var(--color-danger)', color: 'white' }}
                      onClick={() => setShowDeleteModal(true)}
                    >
                      {language === 'de' ? 'Kontolöschung anfordern' : 'Request Account Deletion'}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-pro" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-pro-header">
              <div className="modal-pro-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)' }}>
                <AlertTriangleIcon />
              </div>
              <div className="modal-pro-title-group">
                <h2 className="modal-pro-title">
                  {language === 'de' ? 'Konto löschen' : 'Delete Account'}
                </h2>
                <p className="modal-pro-subtitle">
                  {language === 'de' ? 'Diese Aktion kann nicht rückgängig gemacht werden' : 'This action cannot be undone'}
                </p>
              </div>
              <button className="modal-pro-close" onClick={() => setShowDeleteModal(false)}>
                <CloseIcon />
              </button>
            </div>

            <div className="modal-pro-body">
              <div className="info-box warning" style={{ marginBottom: 20 }}>
                <div className="info-box-content">
                  {language === 'de'
                    ? 'Die Löschung Ihres Kontos entfernt alle Ihre persönlichen Daten dauerhaft. Sie verlieren den Zugang zu allen Diensten.'
                    : 'Deleting your account will permanently remove all your personal data. You will lose access to all services.'}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  {language === 'de' ? 'Grund für die Löschung (erforderlich)' : 'Reason for deletion (required)'}
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder={language === 'de'
                    ? 'Bitte teilen Sie uns mit, warum Sie Ihr Konto löschen möchten...'
                    : 'Please tell us why you want to delete your account...'}
                />
              </div>
            </div>

            <div className="modal-pro-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                {language === 'de' ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                className="btn"
                style={{ background: 'var(--color-danger)', color: 'white' }}
                onClick={handleRequestDeletion}
                disabled={saving || !deleteReason.trim()}
              >
                {saving
                  ? (language === 'de' ? 'Senden...' : 'Submitting...')
                  : (language === 'de' ? 'Löschung bestätigen' : 'Confirm Deletion')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit User Modal - Professional Design */}
      {showUserModal && (
        <div className="modal-overlay" onClick={handleCloseUserModal}>
          <div className="modal-pro" onClick={(e) => e.stopPropagation()}>
            <div className="modal-pro-header">
              <div className="modal-pro-icon primary">
                {editingUser ? <EditIcon /> : <UserIcon />}
              </div>
              <div className="modal-pro-title-group">
                <h2 className="modal-pro-title">
                  {editingUser
                    ? (language === 'de' ? 'Benutzer bearbeiten' : 'Edit User')
                    : t('addUser')}
                </h2>
                <p className="modal-pro-subtitle">
                  {editingUser
                    ? (language === 'de' ? 'Benutzerdetails aktualisieren' : 'Update user details')
                    : t('addTeamMember')}
                </p>
              </div>
              <button className="modal-pro-close" onClick={handleCloseUserModal}>
                <CloseIcon />
              </button>
            </div>

            <div className="modal-pro-body">
              <div className="modal-pro-section">
                <div className="modal-pro-section-title">{t('userInformation')}</div>

                <div className="form-field-pro">
                  <div className="form-label-pro">
                    <span className="form-label-pro-text">{t('name')}</span>
                  </div>
                  <input
                    type="text"
                    className="form-input-pro"
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    placeholder={t('fullName')}
                  />
                </div>

                <div className="form-field-pro">
                  <div className="form-label-pro">
                    <span className="form-label-pro-text">{t('email')}</span>
                    <span className="form-label-pro-hint">{t('required')}</span>
                  </div>
                  <input
                    type="email"
                    className="form-input-pro"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    placeholder="user@company.com"
                  />
                </div>

                <div className="form-field-pro">
                  <div className="form-label-pro">
                    <span className="form-label-pro-text">{t('password')}</span>
                    <span className="form-label-pro-hint">
                      {editingUser
                        ? (language === 'de' ? 'Leer lassen, um beizubehalten' : 'Leave empty to keep current')
                        : t('minCharacters')}
                    </span>
                  </div>
                  <input
                    type="password"
                    className="form-input-pro"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder={editingUser ? '••••••••' : '••••••••'}
                  />
                </div>

                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={userForm.isAdmin}
                    onChange={(e) => setUserForm({ ...userForm, isAdmin: e.target.checked })}
                  />
                  <span className="toggle-switch-track">
                    <span className="toggle-switch-thumb" />
                  </span>
                  <span className="toggle-switch-label">
                    <span className="toggle-switch-title">{t('adminAccess')}</span>
                    <span className="toggle-switch-desc">{t('canManageUsersSettings')}</span>
                  </span>
                </label>
              </div>
            </div>

            <div className="modal-pro-footer">
              <button className="btn btn-secondary" onClick={handleCloseUserModal}>
                {t('cancel')}
              </button>
              <button
                className="btn btn-primary"
                onClick={editingUser ? handleUpdateUser : handleAddUser}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="loading-spinner" style={{ width: 16, height: 16, marginBottom: 0 }} />
                    {editingUser
                      ? (language === 'de' ? 'Speichern...' : 'Saving...')
                      : t('creating')}
                  </>
                ) : (
                  editingUser
                    ? (language === 'de' ? 'Änderungen speichern' : 'Save Changes')
                    : t('createUser')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
