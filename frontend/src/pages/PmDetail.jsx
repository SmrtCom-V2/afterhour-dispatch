import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

export function PmDetail() {
  const { pmId } = useParams();
  const navigate = useNavigate();
  const [pmCompany, setPmCompany] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [serviceProviders, setServiceProviders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Modal states
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [showSpModal, setShowSpModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Form states
  const [buildingForm, setBuildingForm] = useState({ name: '', address: '', city: '', aiConfidenceOverride: '' });
  const [tenantForm, setTenantForm] = useState({ buildingId: '', name: '', phone: '', unit: '' });
  const [spForm, setSpForm] = useState({ companyName: '', contactName: '', phone: '', email: '', trade: 'general' });

  useEffect(() => {
    loadData();
  }, [pmId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pmData, statsData] = await Promise.all([
        api.getPmCompany(pmId),
        api.getIncidentStats({ pmCompanyId: pmId }),
      ]);
      setPmCompany(pmData.pmCompany);
      setBuildings(pmData.buildings || []);

      // Load tenants for this PM's buildings
      const tenantsData = await api.getTenants({ pmCompanyId: pmId });
      setTenants(tenantsData.tenants || []);

      // Load service providers for this PM's buildings
      const spData = await api.getServiceProviders({ pmCompanyId: pmId });
      setServiceProviders(spData.serviceProviders || []);

      setStats(statsData.stats);
    } catch (err) {
      console.error('Failed to load PM data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Building handlers
  const openBuildingModal = (building = null) => {
    if (building) {
      setEditingItem(building);
      setBuildingForm({
        name: building.name,
        address: building.address,
        city: building.city || '',
        aiConfidenceOverride: building.ai_confidence_override || '',
      });
    } else {
      setEditingItem(null);
      setBuildingForm({ name: '', address: '', city: '', aiConfidenceOverride: '' });
    }
    setShowBuildingModal(true);
  };

  const handleBuildingSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.updateBuilding(editingItem.id, { ...buildingForm, pmCompanyId: pmId });
      } else {
        await api.createBuilding({ ...buildingForm, pmCompanyId: pmId });
      }
      setShowBuildingModal(false);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteBuilding = async (id) => {
    if (!confirm('Delete this building? This will also delete all tenants.')) return;
    try {
      await api.deleteBuilding(id);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Tenant handlers
  const openTenantModal = (tenant = null) => {
    if (tenant) {
      setEditingItem(tenant);
      setTenantForm({
        buildingId: tenant.building_id,
        name: tenant.name,
        phone: tenant.phone,
        unit: tenant.unit || '',
      });
    } else {
      setEditingItem(null);
      setTenantForm({ buildingId: buildings[0]?.id || '', name: '', phone: '', unit: '' });
    }
    setShowTenantModal(true);
  };

  const handleTenantSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.updateTenant(editingItem.id, tenantForm);
      } else {
        await api.createTenant(tenantForm);
      }
      setShowTenantModal(false);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteTenant = async (id) => {
    if (!confirm('Deactivate this tenant?')) return;
    try {
      await api.deleteTenant(id);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Service Provider handlers
  const openSpModal = (sp = null) => {
    if (sp) {
      setEditingItem(sp);
      setSpForm({
        companyName: sp.company_name,
        contactName: sp.contact_name || '',
        phone: sp.phone,
        email: sp.email || '',
        trade: sp.trade,
      });
    } else {
      setEditingItem(null);
      setSpForm({ companyName: '', contactName: '', phone: '', email: '', trade: 'general' });
    }
    setShowSpModal(true);
  };

  const handleSpSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.updateServiceProvider(editingItem.id, spForm);
      } else {
        await api.createServiceProvider({ ...spForm, pmCompanyId: pmId });
      }
      setShowSpModal(false);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteSp = async (id) => {
    if (!confirm('Delete this service provider?')) return;
    try {
      await api.deleteServiceProvider(id);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!pmCompany) return <div className="error-message">PM Company not found</div>;

  const trades = ['general', 'plumbing', 'electrical', 'hvac', 'locksmith', 'elevator', 'fire_safety', 'glass', 'roofing'];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <button className="btn btn-secondary btn-small" onClick={() => navigate('/pm-companies')}>
          Back to PM Companies
        </button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">{pmCompany.name}</h1>
        <div style={{ color: '#666', display: 'flex', gap: 24 }}>
          {pmCompany.contact_email && <span>Email: {pmCompany.contact_email}</span>}
          {pmCompany.contact_phone && <span>Phone: {pmCompany.contact_phone}</span>}
        </div>
      </div>

      {/* Stats for this PM */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 24,
        paddingBottom: 24,
        borderBottom: '1px solid #E5E5E5'
      }}>
        <div style={{ padding: 16, border: '1px solid #E5E5E5', background: '#FAFAFA' }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>BUILDINGS</div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{buildings.length}</div>
        </div>
        <div style={{ padding: 16, border: '1px solid #E5E5E5', background: '#FAFAFA' }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>TENANTS</div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{tenants.length}</div>
        </div>
        <div style={{ padding: 16, border: '1px solid #E5E5E5', background: '#FAFAFA' }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>SERVICE PROVIDERS</div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{serviceProviders.length}</div>
        </div>
        <div style={{
          padding: 16,
          border: parseInt(stats?.open_incidents) > 0 ? '2px solid #C00000' : '1px solid #E5E5E5',
          background: parseInt(stats?.open_incidents) > 0 ? '#FFF5F5' : '#FAFAFA'
        }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>OPEN INCIDENTS</div>
          <div style={{
            fontSize: 28,
            fontWeight: 600,
            color: parseInt(stats?.open_incidents) > 0 ? '#C00000' : '#000'
          }}>
            {stats?.open_incidents || 0}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E5E5E5', marginBottom: 24 }}>
        {['overview', 'buildings', 'tenants', 'service-providers'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 24px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #000' : '2px solid transparent',
              fontWeight: activeTab === tab ? 600 : 400,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ marginBottom: 16, fontSize: 14, textTransform: 'uppercase', color: '#666' }}>
              Buildings ({buildings.length})
            </h3>
            {buildings.length === 0 ? (
              <div style={{ color: '#666', padding: 20, background: '#f5f5f5' }}>
                No buildings yet. <button className="btn btn-primary btn-small" style={{ marginLeft: 8 }} onClick={() => { setActiveTab('buildings'); openBuildingModal(); }}>Add first building</button>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Building</th>
                    <th>Address</th>
                    <th>City</th>
                    <th>Tenants</th>
                  </tr>
                </thead>
                <tbody>
                  {buildings.slice(0, 5).map((b) => (
                    <tr key={b.id}>
                      <td>{b.name}</td>
                      <td>{b.address}</td>
                      <td>{b.city || '-'}</td>
                      <td>{tenants.filter(t => t.building_id === b.id).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {buildings.length > 5 && (
              <button className="btn btn-secondary btn-small" style={{ marginTop: 8 }} onClick={() => setActiveTab('buildings')}>
                View all {buildings.length} buildings
              </button>
            )}
          </div>

          <div style={{ marginBottom: 32 }}>
            <h3 style={{ marginBottom: 16, fontSize: 14, textTransform: 'uppercase', color: '#666' }}>
              Recent Incidents
            </h3>
            <button className="btn btn-secondary btn-small" onClick={() => navigate(`/incidents?pmCompanyId=${pmId}`)}>
              View incidents for this PM
            </button>
          </div>
        </div>
      )}

      {/* Buildings Tab */}
      {activeTab === 'buildings' && (
        <div>
          <div className="actions-row">
            <button className="btn btn-primary" onClick={() => openBuildingModal()}>
              Add Building
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Building Name</th>
                <th>Address</th>
                <th>City</th>
                <th>AI Override</th>
                <th style={{ width: 150 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {buildings.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#666', padding: 40 }}>No buildings</td></tr>
              ) : (
                buildings.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 500 }}>{b.name}</td>
                    <td>{b.address}</td>
                    <td>{b.city || '-'}</td>
                    <td>{b.ai_confidence_override ? `${b.ai_confidence_override}%` : '-'}</td>
                    <td>
                      <button className="btn btn-secondary btn-small" onClick={() => openBuildingModal(b)}>Edit</button>
                      <button className="btn btn-secondary btn-small" style={{ marginLeft: 8 }} onClick={() => handleDeleteBuilding(b.id)}>Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tenants Tab */}
      {activeTab === 'tenants' && (
        <div>
          <div className="actions-row">
            <button className="btn btn-primary" onClick={() => openTenantModal()} disabled={buildings.length === 0}>
              Add Tenant
            </button>
            {buildings.length === 0 && (
              <span style={{ color: '#666', marginLeft: 12 }}>Add a building first</span>
            )}
          </div>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Building</th>
                <th>Unit</th>
                <th>Status</th>
                <th style={{ width: 150 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#666', padding: 40 }}>No tenants</td></tr>
              ) : (
                tenants.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 500 }}>{t.name}</td>
                    <td style={{ fontFamily: 'monospace' }}>{t.phone}</td>
                    <td>{buildings.find(b => b.id === t.building_id)?.name || '-'}</td>
                    <td>{t.unit || '-'}</td>
                    <td>{t.is_active ? <span style={{ color: '#00A000' }}>Active</span> : <span style={{ color: '#666' }}>Inactive</span>}</td>
                    <td>
                      <button className="btn btn-secondary btn-small" onClick={() => openTenantModal(t)}>Edit</button>
                      <button className="btn btn-secondary btn-small" style={{ marginLeft: 8 }} onClick={() => handleDeleteTenant(t.id)}>Deactivate</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Service Providers Tab */}
      {activeTab === 'service-providers' && (
        <div>
          <div className="actions-row">
            <button className="btn btn-primary" onClick={() => openSpModal()}>
              Add Service Provider
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Trade</th>
                <th>Status</th>
                <th style={{ width: 150 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {serviceProviders.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#666', padding: 40 }}>No service providers</td></tr>
              ) : (
                serviceProviders.map((sp) => (
                  <tr key={sp.id}>
                    <td style={{ fontWeight: 500 }}>{sp.company_name}</td>
                    <td>{sp.contact_name || '-'}</td>
                    <td style={{ fontFamily: 'monospace' }}>{sp.phone}</td>
                    <td style={{ textTransform: 'capitalize' }}>{sp.trade.replace(/_/g, ' ')}</td>
                    <td>{sp.is_active ? <span style={{ color: '#00A000' }}>Active</span> : <span style={{ color: '#666' }}>Inactive</span>}</td>
                    <td>
                      <button className="btn btn-secondary btn-small" onClick={() => openSpModal(sp)}>Edit</button>
                      <button className="btn btn-secondary btn-small" style={{ marginLeft: 8 }} onClick={() => handleDeleteSp(sp.id)}>Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Building Modal */}
      {showBuildingModal && (
        <div className="modal-overlay" onClick={() => setShowBuildingModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{editingItem ? 'Edit Building' : 'Add Building'}</h2>
            <form onSubmit={handleBuildingSubmit}>
              <div className="form-group">
                <label className="form-label">Building Name</label>
                <input type="text" className="form-input" value={buildingForm.name} onChange={(e) => setBuildingForm({ ...buildingForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input type="text" className="form-input" value={buildingForm.address} onChange={(e) => setBuildingForm({ ...buildingForm, address: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input type="text" className="form-input" value={buildingForm.city} onChange={(e) => setBuildingForm({ ...buildingForm, city: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">AI Confidence Override (%)</label>
                <input type="number" className="form-input" min="0" max="100" value={buildingForm.aiConfidenceOverride} onChange={(e) => setBuildingForm({ ...buildingForm, aiConfidenceOverride: e.target.value })} placeholder="Leave empty for default (80%)" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBuildingModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingItem ? 'Save' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tenant Modal */}
      {showTenantModal && (
        <div className="modal-overlay" onClick={() => setShowTenantModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{editingItem ? 'Edit Tenant' : 'Add Tenant'}</h2>
            <form onSubmit={handleTenantSubmit}>
              <div className="form-group">
                <label className="form-label">Building</label>
                <select className="form-select" value={tenantForm.buildingId} onChange={(e) => setTenantForm({ ...tenantForm, buildingId: e.target.value })} required>
                  <option value="">Select building</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tenant Name</label>
                <input type="text" className="form-input" value={tenantForm.name} onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input type="tel" className="form-input" value={tenantForm.phone} onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })} required placeholder="+49..." />
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <input type="text" className="form-input" value={tenantForm.unit} onChange={(e) => setTenantForm({ ...tenantForm, unit: e.target.value })} placeholder="e.g., Apt 4B" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTenantModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingItem ? 'Save' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Service Provider Modal */}
      {showSpModal && (
        <div className="modal-overlay" onClick={() => setShowSpModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{editingItem ? 'Edit Service Provider' : 'Add Service Provider'}</h2>
            <form onSubmit={handleSpSubmit}>
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input type="text" className="form-input" value={spForm.companyName} onChange={(e) => setSpForm({ ...spForm, companyName: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Name</label>
                <input type="text" className="form-input" value={spForm.contactName} onChange={(e) => setSpForm({ ...spForm, contactName: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input type="tel" className="form-input" value={spForm.phone} onChange={(e) => setSpForm({ ...spForm, phone: e.target.value })} required placeholder="+49..." />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={spForm.email} onChange={(e) => setSpForm({ ...spForm, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Trade</label>
                <select className="form-select" value={spForm.trade} onChange={(e) => setSpForm({ ...spForm, trade: e.target.value })} required>
                  {trades.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSpModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingItem ? 'Save' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
