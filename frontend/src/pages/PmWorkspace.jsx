import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import { usePm } from '../context/PmContext';

// Icons
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

const PhoneIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const FileTextIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
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

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const KeyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

// PM Dashboard Component
function PmDashboard({ pmCompany, stats, buildings, tenants, serviceProviders }) {
  const navigate = useNavigate();
  const { pmId } = useParams();

  return (
    <div>
      {/* Stats Grid — every tile is a shortcut into the matching tab, not just a number */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card clickable" onClick={() => navigate(`/pm/${pmId}/buildings`)} role="button" tabIndex={0}>
          <div className="stat-card-header">
            <div className="stat-card-icon primary"><BuildingIcon /></div>
          </div>
          <div className="stat-card-value">{buildings.length}</div>
          <div className="stat-card-label">Properties</div>
        </div>

        <div className="stat-card clickable" onClick={() => navigate(`/pm/${pmId}/tenants`)} role="button" tabIndex={0}>
          <div className="stat-card-header">
            <div className="stat-card-icon success"><UsersIcon /></div>
          </div>
          <div className="stat-card-value">{tenants.length}</div>
          <div className="stat-card-label">Tenants</div>
        </div>

        <div className="stat-card clickable" onClick={() => navigate(`/pm/${pmId}/service-providers`)} role="button" tabIndex={0}>
          <div className="stat-card-header">
            <div className="stat-card-icon warning"><WrenchIcon /></div>
          </div>
          <div className="stat-card-value">{serviceProviders.length}</div>
          <div className="stat-card-label">Service Providers</div>
        </div>

        <div className="stat-card clickable" onClick={() => navigate(`/pm/${pmId}/incidents`)} role="button" tabIndex={0}>
          <div className="stat-card-header">
            <div className="stat-card-icon primary"><PhoneIcon /></div>
          </div>
          <div className="stat-card-value">{stats?.this_month_calls || 0}</div>
          <div className="stat-card-label">Calls This Month</div>
        </div>

        <div
          className="stat-card clickable"
          onClick={() => navigate(`/pm/${pmId}/incidents?status=open`)}
          role="button"
          tabIndex={0}
          style={{
            borderColor: parseInt(stats?.open_incidents) > 0 ? 'var(--color-danger)' : undefined,
            borderWidth: parseInt(stats?.open_incidents) > 0 ? 2 : undefined
          }}
        >
          <div className="stat-card-header">
            <div className={`stat-card-icon ${parseInt(stats?.open_incidents) > 0 ? 'danger' : 'success'}`}>
              <AlertIcon />
            </div>
          </div>
          <div className="stat-card-value" style={{
            color: parseInt(stats?.open_incidents) > 0 ? 'var(--color-danger)' : undefined
          }}>
            {stats?.open_incidents || 0}
          </div>
          <div className="stat-card-label">Open Incidents</div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="card mb-6">
        <div className="card-body" style={{ padding: '16px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, textAlign: 'center' }}>
            <div>
              <div className="text-sm text-muted mb-1">Emergencies (Claimed)</div>
              <div className="font-semibold text-lg">{stats?.emergencies_claimed || 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted mb-1">Emergencies (Real)</div>
              <div className="font-semibold text-lg" style={{
                color: (stats?.emergencies_real || 0) > 0 ? 'var(--color-danger)' : undefined
              }}>
                {stats?.emergencies_real || 0}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted mb-1">Avg Response</div>
              <div className="font-semibold text-lg">{stats?.avg_response_time || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-muted mb-1">Missing Reports</div>
              <div className="font-semibold text-lg" style={{
                color: (stats?.missing_reports || 0) > 0 ? 'var(--color-danger)' : undefined
              }}>
                {stats?.missing_reports || 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Buildings Quick Overview */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Properties ({buildings.length})</h3>
        </div>
        {buildings.length === 0 ? (
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon"><BuildingIcon /></div>
              <h3 className="empty-state-title">No Properties Yet</h3>
              <p className="empty-state-description">
                Add your first property to start managing tenants and service providers.
              </p>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Address</th>
                  <th>City</th>
                  <th>Type</th>
                  <th>Units</th>
                  <th>Tenants</th>
                </tr>
              </thead>
              <tbody>
                {buildings.slice(0, 10).map((b) => (
                  <tr key={b.id}>
                    <td className="table-cell-main">{b.address}</td>
                    <td>{b.city || '-'}</td>
                    <td><span className="badge badge-default" style={{ textTransform: 'capitalize' }}>{b.building_type || 'residential'}</span></td>
                    <td>{b.total_units || b.num_apartments || '-'}</td>
                    <td><span className="badge badge-primary">{b.tenant_count || 0}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {buildings.length > 10 && (
          <div className="card-body" style={{ paddingTop: 0 }}>
            <div className="text-sm text-muted">
              Showing 10 of {buildings.length} properties.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Building form initial state
const initialBuildingForm = {
  address: '',
  city: '',
  postalCode: '',
  country: 'Germany',
  buildingType: 'residential',
  totalUnits: '',
  totalFloors: '1',
  hasBasement: false,
  basementUnits: '',
  hasPenthouse: false,
  numEntrances: '1',
  entranceNames: '',
  unitsPerFloor: '',
  unitNumberingFormat: '',
  hasElevator: false,
  numElevators: '0',
  // Parking
  parkingType: '',
  parkingSpaces: '',
  parkingLocation: '',
  // Gardens
  hasGardenFront: false,
  hasGardenBack: false,
  hasGardenSide: false,
  gardenNotes: '',
  // Emergency-relevant features
  hasRooftopAccess: false,
  rooftopAccessLocation: '',
  hasPool: false,
  poolLocation: '',
  hasBoilerRoom: false,
  boilerRoomLocation: '',
  hasStorageUnits: false,
  storageLocation: '',
  hasLaundryRoom: false,
  laundryRoomLocation: '',
  hasBikeStorage: false,
  bikeStorageLocation: '',
  hasMailroom: false,
  mailroomLocation: '',
  hasSprinklerSystem: false,
  hasFireAlarm: false,
  hasSecurityCameras: false,
  hasIntercom: false,
  // Access & Security
  keySafeLocation: '',
  keySafeCode: '',
  gateCode: '',
  mainEntranceCode: '',
  // Emergency Info
  waterShutoffLocation: '',
  gasShutoffLocation: '',
  electricShutoffLocation: '',
  heatingType: '',
  heatingShutoffLocation: '',
  specialAccessInstructions: '',
  // Contacts
  janitorName: '',
  janitorPhone: '',
  janitorEmail: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  specialInstructions: '',
  knownIssues: '',
  notes: '',
  status: 'active'
};

// Modal tabs definition
const modalTabs = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'structure', label: 'Structure' },
  { id: 'access', label: 'Access & Security' },
  { id: 'emergency', label: 'Emergency Info' },
  { id: 'contacts', label: 'Contacts' },
];

// PM Buildings Component
function PmBuildings({ buildings, pmId, onRefresh }) {
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(initialBuildingForm);
  const [activeTab, setActiveTab] = useState('basic');
  const [saving, setSaving] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const importFileInputRef = useRef(null);

  const openImportModal = () => {
    setImportRows([]);
    setImportError('');
    setImportResult(null);
    setShowImportModal(true);
  };

  const handleImportFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const { rows, error } = parseBuildingCsv(text);
    if (error) {
      setImportError(error);
      setImportRows([]);
    } else {
      setImportError('');
      setImportRows(rows);
    }
  };

  const handleImportSubmit = async () => {
    if (importRows.length === 0) return;
    setImporting(true);
    try {
      const result = await api.bulkImportBuildings(pmId, importRows);
      setImportResult(result);
      onRefresh();
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const openModal = (building = null) => {
    if (building) {
      setEditingItem(building);
      setForm({
        address: building.address || '',
        city: building.city || '',
        postalCode: building.postal_code || '',
        country: building.country || 'Germany',
        buildingType: building.building_type || 'residential',
        totalUnits: building.total_units || building.num_apartments || '',
        totalFloors: building.total_floors || building.num_floors || '1',
        hasBasement: building.has_basement || false,
        basementUnits: building.basement_units || '',
        hasPenthouse: building.has_penthouse || false,
        numEntrances: building.num_entrances || '1',
        entranceNames: building.entrance_names?.join(', ') || '',
        unitsPerFloor: building.units_per_floor || '',
        unitNumberingFormat: building.unit_numbering_format || '',
        hasElevator: building.has_elevator || false,
        numElevators: building.num_elevators || '0',
        // Parking
        parkingType: building.parking_type || '',
        parkingSpaces: building.parking_spaces || '',
        parkingLocation: building.parking_location || '',
        // Gardens
        hasGardenFront: building.has_garden_front || false,
        hasGardenBack: building.has_garden_back || false,
        hasGardenSide: building.has_garden_side || false,
        gardenNotes: building.garden_notes || '',
        // Emergency-relevant features
        hasRooftopAccess: building.has_rooftop_access || false,
        rooftopAccessLocation: building.rooftop_access_location || '',
        hasPool: building.has_pool || false,
        poolLocation: building.pool_location || '',
        hasBoilerRoom: building.has_boiler_room || false,
        boilerRoomLocation: building.boiler_room_location || '',
        hasStorageUnits: building.has_storage_units || false,
        storageLocation: building.storage_location || '',
        hasLaundryRoom: building.has_laundry_room || false,
        laundryRoomLocation: building.laundry_room_location || '',
        hasBikeStorage: building.has_bike_storage || false,
        bikeStorageLocation: building.bike_storage_location || '',
        hasMailroom: building.has_mailroom || false,
        mailroomLocation: building.mailroom_location || '',
        hasSprinklerSystem: building.has_sprinkler_system || false,
        hasFireAlarm: building.has_fire_alarm || false,
        hasSecurityCameras: building.has_security_cameras || false,
        hasIntercom: building.has_intercom || false,
        // Access & Security
        keySafeLocation: building.key_safe_location || '',
        keySafeCode: building.key_safe_code || '',
        gateCode: building.gate_code || '',
        mainEntranceCode: building.main_entrance_code || '',
        // Emergency Info
        waterShutoffLocation: building.water_shutoff_location || '',
        gasShutoffLocation: building.gas_shutoff_location || '',
        electricShutoffLocation: building.electric_shutoff_location || '',
        heatingType: building.heating_type || '',
        heatingShutoffLocation: building.heating_shutoff_location || '',
        specialAccessInstructions: building.special_access_instructions || '',
        // Contacts
        janitorName: building.janitor_name || '',
        janitorPhone: building.janitor_phone || '',
        janitorEmail: building.janitor_email || '',
        emergencyContactName: building.emergency_contact_name || '',
        emergencyContactPhone: building.emergency_contact_phone || '',
        specialInstructions: building.special_instructions || '',
        knownIssues: building.known_issues || '',
        notes: building.notes || '',
        status: building.status || 'active'
      });
    } else {
      setEditingItem(null);
      setForm(initialBuildingForm);
    }
    setActiveTab('basic');
    setShowModal(true);
  };

  // Get current tab index
  const currentTabIndex = modalTabs.findIndex(t => t.id === activeTab);
  const isLastTab = currentTabIndex === modalTabs.length - 1;

  // Go to next tab
  const goToNextTab = () => {
    if (!isLastTab) {
      setActiveTab(modalTabs[currentTabIndex + 1].id);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.address,
        address: form.address,
        city: form.city,
        postalCode: form.postalCode,
        country: form.country,
        buildingType: form.buildingType,
        totalUnits: parseInt(form.totalUnits) || 0,
        totalFloors: parseInt(form.totalFloors) || 1,
        hasBasement: form.hasBasement,
        basementUnits: parseInt(form.basementUnits) || 0,
        hasPenthouse: form.hasPenthouse,
        numEntrances: parseInt(form.numEntrances) || 1,
        entranceNames: form.entranceNames ? form.entranceNames.split(',').map(s => s.trim()) : null,
        unitsPerFloor: parseInt(form.unitsPerFloor) || null,
        unitNumberingFormat: form.unitNumberingFormat || null,
        hasElevator: form.hasElevator,
        numElevators: parseInt(form.numElevators) || 0,
        // Parking
        parkingType: form.parkingType || null,
        parkingSpaces: parseInt(form.parkingSpaces) || null,
        parkingLocation: form.parkingLocation || null,
        // Gardens
        hasGardenFront: form.hasGardenFront,
        hasGardenBack: form.hasGardenBack,
        hasGardenSide: form.hasGardenSide,
        gardenNotes: form.gardenNotes || null,
        // Facilities
        hasRooftopAccess: form.hasRooftopAccess,
        rooftopAccessLocation: form.rooftopAccessLocation || null,
        hasPool: form.hasPool,
        poolLocation: form.poolLocation || null,
        hasBoilerRoom: form.hasBoilerRoom,
        boilerRoomLocation: form.boilerRoomLocation || null,
        hasStorageUnits: form.hasStorageUnits,
        storageLocation: form.storageLocation || null,
        hasLaundryRoom: form.hasLaundryRoom,
        laundryRoomLocation: form.laundryRoomLocation || null,
        hasBikeStorage: form.hasBikeStorage,
        bikeStorageLocation: form.bikeStorageLocation || null,
        hasMailroom: form.hasMailroom,
        mailroomLocation: form.mailroomLocation || null,
        // Safety systems
        hasSprinklerSystem: form.hasSprinklerSystem,
        hasFireAlarm: form.hasFireAlarm,
        hasSecurityCameras: form.hasSecurityCameras,
        hasIntercom: form.hasIntercom,
        // Access & Security
        keySafeLocation: form.keySafeLocation || null,
        keySafeCode: form.keySafeCode || null,
        gateCode: form.gateCode || null,
        mainEntranceCode: form.mainEntranceCode || null,
        // Emergency Info
        waterShutoffLocation: form.waterShutoffLocation || null,
        gasShutoffLocation: form.gasShutoffLocation || null,
        electricShutoffLocation: form.electricShutoffLocation || null,
        heatingType: form.heatingType || null,
        heatingShutoffLocation: form.heatingShutoffLocation || null,
        specialAccessInstructions: form.specialAccessInstructions || null,
        // Contacts
        janitorName: form.janitorName || null,
        janitorPhone: form.janitorPhone || null,
        janitorEmail: form.janitorEmail || null,
        emergencyContactName: form.emergencyContactName || null,
        emergencyContactPhone: form.emergencyContactPhone || null,
        specialInstructions: form.specialInstructions || null,
        knownIssues: form.knownIssues || null,
        notes: form.notes || null,
        status: form.status,
        pmCompanyId: pmId
      };
      if (editingItem) {
        await api.updateBuilding(editingItem.id, payload);
      } else {
        await api.createBuilding(payload);
      }
      setShowModal(false);
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this property? This will also delete all tenants.')) return;
    try {
      await api.deleteBuilding(id);
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-secondary" onClick={openImportModal}>
          Import CSV
        </button>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <PlusIcon /> Add Property
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Address</th>
                <th>City</th>
                <th>Type</th>
                <th>Units</th>
                <th>Floors</th>
                <th>Features</th>
                <th>Tenants</th>
                <th>Status</th>
                <th style={{ width: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {buildings.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon"><BuildingIcon /></div>
                      <h3 className="empty-state-title">No Properties Yet</h3>
                      <p className="empty-state-description">Add your first property to get started.</p>
                      <button className="btn btn-primary" onClick={() => openModal()}>
                        <PlusIcon /> Add Property
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                buildings.map((b) => (
                  <tr key={b.id}>
                    <td className="table-cell-main">{b.address}</td>
                    <td>{b.city || '-'}</td>
                    <td><span className="badge badge-default" style={{ textTransform: 'capitalize' }}>{b.building_type || 'residential'}</span></td>
                    <td>{b.total_units || b.num_apartments || '-'}</td>
                    <td>{b.total_floors || b.num_floors || '-'}</td>
                    <td className="text-sm">
                      {[
                        (b.num_elevators || b.has_elevator) && `Elevator`,
                        b.parking_type && `Parking`,
                        b.has_basement && `Basement`
                      ].filter(Boolean).join(', ') || '-'}
                    </td>
                    <td><span className="badge badge-primary">{b.tenant_count || 0}</span></td>
                    <td>
                      <span className={`badge ${b.status === 'inactive' ? 'badge-warning' : 'badge-success'}`}>
                        {b.status === 'inactive' ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openModal(b)}>
                          <EditIcon />
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(b.id)} style={{ color: 'var(--color-danger)' }}>
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

      {/* Building Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingItem ? 'Edit Property' : 'Add Property'}</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)} style={{ padding: 8 }}>
                <CloseIcon />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border)', marginBottom: 24, overflowX: 'auto' }}>
              {modalTabs.map((tab, index) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                    color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    fontWeight: activeTab === tab.id ? 600 : 400,
                    cursor: 'pointer',
                    marginBottom: -1,
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <span style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-border)',
                    color: activeTab === tab.id ? '#fff' : 'var(--color-text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 600
                  }}>
                    {index + 1}
                  </span>
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              {/* Basic Info Tab */}
              {activeTab === 'basic' && (
                <div>
                  <div className="form-group">
                    <label className="form-label">Street Address *</label>
                    <input type="text" className="form-input" value={form.address} onChange={(e) => updateField('address', e.target.value)} required placeholder="e.g., Hauptstraße 10" />
                  </div>

                  <div className="form-row">
                    <div className="form-group" style={{ flex: 2 }}>
                      <label className="form-label">City</label>
                      <input type="text" className="form-input" value={form.city} onChange={(e) => updateField('city', e.target.value)} placeholder="e.g., Berlin" />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Postal Code</label>
                      <input type="text" className="form-input" value={form.postalCode} onChange={(e) => updateField('postalCode', e.target.value)} placeholder="12345" />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Country</label>
                      <input type="text" className="form-input" value={form.country} onChange={(e) => updateField('country', e.target.value)} />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Building Type</label>
                      <select className="form-select" value={form.buildingType} onChange={(e) => updateField('buildingType', e.target.value)}>
                        <option value="residential">Residential</option>
                        <option value="commercial">Commercial</option>
                        <option value="mixed">Mixed Use</option>
                        <option value="industrial">Industrial</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Status</label>
                      <select className="form-select" value={form.status} onChange={(e) => updateField('status', e.target.value)}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea className="form-input" value={form.notes} onChange={(e) => updateField('notes', e.target.value)} rows={3} placeholder="General notes about this property..." />
                  </div>
                </div>
              )}

              {/* Structure Tab */}
              {activeTab === 'structure' && (
                <div>
                  <h4 style={{ marginBottom: 16, fontWeight: 600 }}>Building Layout</h4>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Total Units</label>
                      <input type="number" className="form-input" min="0" value={form.totalUnits} onChange={(e) => updateField('totalUnits', e.target.value)} placeholder="0" />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Total Floors</label>
                      <input type="number" className="form-input" min="1" value={form.totalFloors} onChange={(e) => updateField('totalFloors', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Units Per Floor</label>
                      <input type="number" className="form-input" min="0" value={form.unitsPerFloor} onChange={(e) => updateField('unitsPerFloor', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Entrances</label>
                      <input type="number" className="form-input" min="1" value={form.numEntrances} onChange={(e) => updateField('numEntrances', e.target.value)} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Entrance Names</label>
                    <input type="text" className="form-input" value={form.entranceNames} onChange={(e) => updateField('entranceNames', e.target.value)} placeholder="e.g., A, B, C or Main, Side" />
                    <div className="form-hint">Comma-separated list of entrance identifiers</div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Unit Numbering Format</label>
                    <input type="text" className="form-input" value={form.unitNumberingFormat} onChange={(e) => updateField('unitNumberingFormat', e.target.value)} placeholder="e.g., floor-number, entrance-floor-number" />
                    <div className="form-hint">How units are numbered in this building</div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginBottom: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.hasBasement} onChange={(e) => updateField('hasBasement', e.target.checked)} />
                      Has Basement
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.hasPenthouse} onChange={(e) => updateField('hasPenthouse', e.target.checked)} />
                      Has Penthouse
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.hasElevator} onChange={(e) => updateField('hasElevator', e.target.checked)} />
                      Has Elevator
                    </label>
                  </div>

                  {form.hasBasement && (
                    <div className="form-group">
                      <label className="form-label">Basement Units (Storage, Cellar, etc.)</label>
                      <input type="number" className="form-input" min="0" value={form.basementUnits} onChange={(e) => updateField('basementUnits', e.target.value)} style={{ maxWidth: 200 }} placeholder="Number of basement units" />
                      <div className="form-hint">Total storage/cellar units in basement</div>
                    </div>
                  )}

                  {form.hasElevator && (
                    <div className="form-group">
                      <label className="form-label">Number of Elevators</label>
                      <input type="number" className="form-input" min="0" value={form.numElevators} onChange={(e) => updateField('numElevators', e.target.value)} style={{ maxWidth: 200 }} />
                    </div>
                  )}

                  <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

                  <h4 style={{ marginBottom: 16, fontWeight: 600 }}>Parking</h4>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Parking Type</label>
                      <select className="form-select" value={form.parkingType} onChange={(e) => updateField('parkingType', e.target.value)}>
                        <option value="">None</option>
                        <option value="underground">Underground Parking</option>
                        <option value="garage">Garage</option>
                        <option value="indoor">Indoor (Building)</option>
                        <option value="courtyard">Courtyard</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Parking Spaces</label>
                      <input type="number" className="form-input" min="0" value={form.parkingSpaces} onChange={(e) => updateField('parkingSpaces', e.target.value)} />
                    </div>
                  </div>

                  {form.parkingType && (
                    <div className="form-group">
                      <label className="form-label">Parking Location / Access</label>
                      <input type="text" className="form-input" value={form.parkingLocation} onChange={(e) => updateField('parkingLocation', e.target.value)} placeholder="e.g., Entrance via back gate, Level -1" />
                    </div>
                  )}

                  <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

                  <h4 style={{ marginBottom: 16, fontWeight: 600 }}>Gardens / Outdoor Areas</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginBottom: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.hasGardenFront} onChange={(e) => updateField('hasGardenFront', e.target.checked)} />
                      Front Garden
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.hasGardenBack} onChange={(e) => updateField('hasGardenBack', e.target.checked)} />
                      Back Garden
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.hasGardenSide} onChange={(e) => updateField('hasGardenSide', e.target.checked)} />
                      Side Garden
                    </label>
                  </div>

                  {(form.hasGardenFront || form.hasGardenBack || form.hasGardenSide) && (
                    <div className="form-group">
                      <label className="form-label">Garden Notes</label>
                      <input type="text" className="form-input" value={form.gardenNotes} onChange={(e) => updateField('gardenNotes', e.target.value)} placeholder="e.g., Irrigation system, garden shed location" />
                    </div>
                  )}

                  <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

                  <h4 style={{ marginBottom: 16, fontWeight: 600 }}>Common Areas & Facilities</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.hasRooftopAccess} onChange={(e) => updateField('hasRooftopAccess', e.target.checked)} />
                      Rooftop Access
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.hasPool} onChange={(e) => updateField('hasPool', e.target.checked)} />
                      Pool
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.hasBoilerRoom} onChange={(e) => updateField('hasBoilerRoom', e.target.checked)} />
                      Boiler / Heating Room
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.hasStorageUnits} onChange={(e) => updateField('hasStorageUnits', e.target.checked)} />
                      Storage Units
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.hasLaundryRoom} onChange={(e) => updateField('hasLaundryRoom', e.target.checked)} />
                      Laundry Room
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.hasBikeStorage} onChange={(e) => updateField('hasBikeStorage', e.target.checked)} />
                      Bike Storage
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.hasMailroom} onChange={(e) => updateField('hasMailroom', e.target.checked)} />
                      Mailroom / Package Area
                    </label>
                  </div>

                  {/* Location inputs for selected facilities */}
                  {form.hasRooftopAccess && (
                    <div className="form-group">
                      <label className="form-label">Rooftop Access Location</label>
                      <input type="text" className="form-input" value={form.rooftopAccessLocation} onChange={(e) => updateField('rooftopAccessLocation', e.target.value)} placeholder="e.g., Stairwell B, top floor" />
                    </div>
                  )}

                  {form.hasPool && (
                    <div className="form-group">
                      <label className="form-label">Pool Location</label>
                      <input type="text" className="form-input" value={form.poolLocation} onChange={(e) => updateField('poolLocation', e.target.value)} placeholder="e.g., Basement level, back courtyard" />
                    </div>
                  )}

                  {form.hasBoilerRoom && (
                    <div className="form-group">
                      <label className="form-label">Boiler / Heating Room Location</label>
                      <input type="text" className="form-input" value={form.boilerRoomLocation} onChange={(e) => updateField('boilerRoomLocation', e.target.value)} placeholder="e.g., Basement, entrance A" />
                    </div>
                  )}

                  {form.hasStorageUnits && (
                    <div className="form-group">
                      <label className="form-label">Storage Units Location</label>
                      <input type="text" className="form-input" value={form.storageLocation} onChange={(e) => updateField('storageLocation', e.target.value)} placeholder="e.g., Basement level -1" />
                    </div>
                  )}

                  {form.hasLaundryRoom && (
                    <div className="form-group">
                      <label className="form-label">Laundry Room Location</label>
                      <input type="text" className="form-input" value={form.laundryRoomLocation} onChange={(e) => updateField('laundryRoomLocation', e.target.value)} placeholder="e.g., Ground floor, near entrance B" />
                    </div>
                  )}

                  {form.hasBikeStorage && (
                    <div className="form-group">
                      <label className="form-label">Bike Storage Location</label>
                      <input type="text" className="form-input" value={form.bikeStorageLocation} onChange={(e) => updateField('bikeStorageLocation', e.target.value)} placeholder="e.g., Courtyard, basement" />
                    </div>
                  )}

                  {form.hasMailroom && (
                    <div className="form-group">
                      <label className="form-label">Mailroom / Package Area Location</label>
                      <input type="text" className="form-input" value={form.mailroomLocation} onChange={(e) => updateField('mailroomLocation', e.target.value)} placeholder="e.g., Main entrance lobby" />
                    </div>
                  )}

                  <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

                  <h4 style={{ marginBottom: 16, fontWeight: 600 }}>Safety Systems</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.hasSprinklerSystem} onChange={(e) => updateField('hasSprinklerSystem', e.target.checked)} />
                      Sprinkler System
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.hasFireAlarm} onChange={(e) => updateField('hasFireAlarm', e.target.checked)} />
                      Fire Alarm System
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.hasSecurityCameras} onChange={(e) => updateField('hasSecurityCameras', e.target.checked)} />
                      Security Cameras
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.hasIntercom} onChange={(e) => updateField('hasIntercom', e.target.checked)} />
                      Intercom System
                    </label>
                  </div>
                </div>
              )}

              {/* Access & Security Tab */}
              {activeTab === 'access' && (
                <div>
                  <div className="card" style={{ background: 'var(--color-warning-bg)', marginBottom: 24 }}>
                    <div className="card-body" style={{ padding: 16 }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ color: 'var(--color-warning)' }}><KeyIcon /></div>
                        <div>
                          <div className="font-semibold" style={{ marginBottom: 4 }}>Security Information</div>
                          <div className="text-sm text-secondary">
                            This information is sensitive and should only be shared with authorized service providers during emergencies.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <h4 style={{ marginBottom: 16, fontWeight: 600 }}>Access Codes</h4>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Main Entrance Code</label>
                      <input type="text" className="form-input" value={form.mainEntranceCode} onChange={(e) => updateField('mainEntranceCode', e.target.value)} placeholder="e.g., 1234" />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Gate Code</label>
                      <input type="text" className="form-input" value={form.gateCode} onChange={(e) => updateField('gateCode', e.target.value)} placeholder="If applicable" />
                    </div>
                  </div>

                  <h4 style={{ marginBottom: 16, marginTop: 24, fontWeight: 600 }}>Key Safe</h4>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 2 }}>
                      <label className="form-label">Key Safe Location</label>
                      <input type="text" className="form-input" value={form.keySafeLocation} onChange={(e) => updateField('keySafeLocation', e.target.value)} placeholder="e.g., Behind the garbage bins" />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Key Safe Code</label>
                      <input type="text" className="form-input" value={form.keySafeCode} onChange={(e) => updateField('keySafeCode', e.target.value)} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Special Access Instructions</label>
                    <textarea className="form-input" value={form.specialAccessInstructions} onChange={(e) => updateField('specialAccessInstructions', e.target.value)} rows={3} placeholder="Any special instructions for accessing the building..." />
                  </div>
                </div>
              )}

              {/* Emergency Info Tab */}
              {activeTab === 'emergency' && (
                <div>
                  <h4 style={{ marginBottom: 16, fontWeight: 600 }}>Utility Shutoffs</h4>
                  <div className="form-group">
                    <label className="form-label">Water Main Shutoff Location</label>
                    <input type="text" className="form-input" value={form.waterShutoffLocation} onChange={(e) => updateField('waterShutoffLocation', e.target.value)} placeholder="e.g., Basement, next to boiler room" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gas Main Shutoff Location</label>
                    <input type="text" className="form-input" value={form.gasShutoffLocation} onChange={(e) => updateField('gasShutoffLocation', e.target.value)} placeholder="Location of main gas shutoff valve" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Main Electrical Panel Location</label>
                    <input type="text" className="form-input" value={form.electricShutoffLocation} onChange={(e) => updateField('electricShutoffLocation', e.target.value)} placeholder="Location of main electrical panel/breaker box" />
                  </div>

                  <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

                  <h4 style={{ marginBottom: 16, fontWeight: 600 }}>Heating System</h4>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Heating Type</label>
                      <select className="form-select" value={form.heatingType} onChange={(e) => updateField('heatingType', e.target.value)}>
                        <option value="">Select...</option>
                        <option value="central_gas">Central Gas Heating</option>
                        <option value="central_oil">Central Oil Heating</option>
                        <option value="district">District Heating</option>
                        <option value="electric">Electric Heating</option>
                        <option value="heat_pump">Heat Pump</option>
                        <option value="individual">Individual Unit Heating</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 2 }}>
                      <label className="form-label">Heating Shutoff Location</label>
                      <input type="text" className="form-input" value={form.heatingShutoffLocation} onChange={(e) => updateField('heatingShutoffLocation', e.target.value)} placeholder="e.g., Boiler room, basement level" />
                    </div>
                  </div>

                  <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

                  <h4 style={{ marginBottom: 16, fontWeight: 600 }}>Known Issues & Instructions</h4>
                  <div className="form-group">
                    <label className="form-label">Known Issues</label>
                    <textarea className="form-input" value={form.knownIssues} onChange={(e) => updateField('knownIssues', e.target.value)} rows={3} placeholder="Any recurring issues or problems at this property (e.g., old pipes in building C, frequent elevator issues...)" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Special Instructions for Service Providers</label>
                    <textarea className="form-input" value={form.specialInstructions} onChange={(e) => updateField('specialInstructions', e.target.value)} rows={3} placeholder="Important instructions that should be shared with service providers during emergencies..." />
                  </div>
                </div>
              )}

              {/* Contacts Tab */}
              {activeTab === 'contacts' && (
                <div>
                  <h4 style={{ marginBottom: 16, fontWeight: 600 }}>Janitor / Building Manager</h4>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Name</label>
                      <input type="text" className="form-input" value={form.janitorName} onChange={(e) => updateField('janitorName', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Phone</label>
                      <input type="tel" className="form-input" value={form.janitorPhone} onChange={(e) => updateField('janitorPhone', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Email</label>
                      <input type="email" className="form-input" value={form.janitorEmail} onChange={(e) => updateField('janitorEmail', e.target.value)} />
                    </div>
                  </div>

                  <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--color-border)' }} />

                  <h4 style={{ marginBottom: 16, fontWeight: 600 }}>Emergency Contact</h4>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Name</label>
                      <input type="text" className="form-input" value={form.emergencyContactName} onChange={(e) => updateField('emergencyContactName', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Phone</label>
                      <input type="tel" className="form-input" value={form.emergencyContactPhone} onChange={(e) => updateField('emergencyContactPhone', e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: 24, justifyContent: 'space-between' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <div style={{ display: 'flex', gap: 12 }}>
                  {/* For new properties, show Continue button until last tab */}
                  {!editingItem && !isLastTab ? (
                    <button type="button" className="btn btn-primary" onClick={goToNextTab}>
                      Continue →
                    </button>
                  ) : (
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? (
                        <>
                          <span className="loading-spinner" style={{ width: 16, height: 16, marginBottom: 0 }} />
                          Saving...
                        </>
                      ) : (
                        editingItem ? 'Save Changes' : 'Create Property'
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Progress hint for new properties */}
              {!editingItem && !isLastTab && (
                <div style={{ marginTop: 12, textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>
                  Step {currentTabIndex + 1} of {modalTabs.length} • You can also click tabs above to jump to any section
                </div>
              )}
              {!editingItem && isLastTab && (
                <div style={{ marginTop: 12, textAlign: 'center', fontSize: 13, color: 'var(--color-success)' }}>
                  ✓ All sections reviewed • Click "Create Property" to save
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Import Properties from CSV</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowImportModal(false)} style={{ padding: 8 }}><CloseIcon /></button>
            </div>

            <div style={{ padding: '0 24px 24px' }}>
              {!importResult ? (
                <>
                  <div className="form-group">
                    <label className="form-label">CSV File</label>
                    <div className="text-sm text-muted" style={{ marginBottom: 8 }}>
                      File must have a header row with an <code>address</code> column (required).
                      Optional columns: <code>name, city, postalCode, buildingType, totalUnits</code>.
                    </div>
                    <input
                      ref={importFileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleImportFileSelect}
                      className="form-input"
                    />
                  </div>

                  {importError && (
                    <div className="card" style={{ background: 'var(--color-danger-bg)', marginBottom: 16 }}>
                      <div className="card-body" style={{ padding: 12 }}>
                        <div className="text-sm">{importError}</div>
                      </div>
                    </div>
                  )}

                  {importRows.length > 0 && !importError && (
                    <div className="card" style={{ marginBottom: 16 }}>
                      <div className="card-header">
                        <h3 className="card-title">Preview — {importRows.length} properties found</h3>
                      </div>
                      <div className="table-container" style={{ maxHeight: 240, overflowY: 'auto' }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Address</th>
                              <th>City</th>
                              <th>Type</th>
                              <th>Units</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importRows.map((r, i) => (
                              <tr key={i}>
                                <td>{r.address}</td>
                                <td>{r.city || '-'}</td>
                                <td>{r.buildingType || '-'}</td>
                                <td>{r.totalUnits || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)}>Cancel</button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={importRows.length === 0 || importing}
                      onClick={handleImportSubmit}
                    >
                      {importing ? 'Importing...' : `Import ${importRows.length || ''} Properties`}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="card" style={{ background: 'var(--color-success-bg)', marginBottom: 16 }}>
                    <div className="card-body" style={{ padding: 12 }}>
                      <div className="text-sm">
                        Successfully imported {importResult.inserted?.length || 0} properties.
                        {importResult.errors?.length > 0 && ` ${importResult.errors.length} rows failed.`}
                      </div>
                    </div>
                  </div>

                  {importResult.errors?.length > 0 && (
                    <div className="card" style={{ marginBottom: 16 }}>
                      <div className="card-header">
                        <h3 className="card-title">Failed Rows</h3>
                      </div>
                      <div className="table-container" style={{ maxHeight: 200, overflowY: 'auto' }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Address</th>
                              <th>Error</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importResult.errors.map((e, i) => (
                              <tr key={i}>
                                <td>{e.building?.address || '-'}</td>
                                <td className="text-danger">{e.error}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="modal-actions">
                    <button type="button" className="btn btn-primary" onClick={() => setShowImportModal(false)}>Done</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Parses a simple CSV with a header row: address,name,city,postalCode,buildingType,totalUnits
// (only "address" is required, extra/missing columns ignored)
function parseBuildingCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], error: 'File has no data rows' };

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const addressIdx = header.indexOf('address');
  const nameIdx = header.indexOf('name');
  const cityIdx = header.indexOf('city');
  const postalCodeIdx = header.indexOf('postalcode');
  const buildingTypeIdx = header.indexOf('buildingtype');
  const totalUnitsIdx = header.indexOf('totalunits');

  if (addressIdx === -1) {
    return { rows: [], error: 'CSV must have an "address" column' };
  }

  const rows = lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim());
    return {
      address: cols[addressIdx] || '',
      name: nameIdx !== -1 ? (cols[nameIdx] || '') : '',
      city: cityIdx !== -1 ? (cols[cityIdx] || '') : '',
      postalCode: postalCodeIdx !== -1 ? (cols[postalCodeIdx] || '') : '',
      buildingType: buildingTypeIdx !== -1 ? (cols[buildingTypeIdx] || '') : '',
      totalUnits: totalUnitsIdx !== -1 ? (cols[totalUnitsIdx] || '') : '',
    };
  }).filter(r => r.address);

  return { rows, error: null };
}

// Maps a CSV salutation cell (German or English, various spellings) to the
// tenant.title enum the voice brain reads. Anything unrecognized -> '' (no
// salutation), so the recognized-caller greeting drops the name rather than
// speaking a wrong one.
function csvTitleToEnum(raw) {
  const k = String(raw || '').trim().toLowerCase().replace(/\.$/, '');
  if (['herr', 'hr', 'mr', 'mister', 'm'].includes(k)) return 'Mister';
  if (['frau', 'fr', 'mrs', 'ms', 'missus', 'w'].includes(k)) return 'Missus';
  return '';
}

// Parses a simple CSV with a header row: name,phone,unit,title (extra columns
// ignored; title also accepts "anrede" / "salutation" as the column name)
function parseTenantCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], error: 'File has no data rows' };

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const nameIdx = header.indexOf('name');
  const phoneIdx = header.indexOf('phone');
  const unitIdx = header.indexOf('unit');
  const titleIdx = ['title', 'anrede', 'salutation'].map(h => header.indexOf(h)).find(i => i !== -1) ?? -1;

  if (nameIdx === -1 || phoneIdx === -1) {
    return { rows: [], error: 'CSV must have "name" and "phone" columns' };
  }

  const rows = lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim());
    return {
      name: cols[nameIdx] || '',
      phone: cols[phoneIdx] || '',
      unit: unitIdx !== -1 ? (cols[unitIdx] || '') : '',
      title: titleIdx !== -1 ? csvTitleToEnum(cols[titleIdx]) : '',
    };
  }).filter(r => r.name && r.phone);

  return { rows, error: null };
}

// Herr / Frau prefix for display, from the tenant.title enum.
function titlePrefix(title) {
  return title === 'Mister' ? 'Herr ' : title === 'Missus' ? 'Frau ' : '';
}

// PM Tenants Component
function PmTenants({ tenants, buildings, onRefresh }) {
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ buildingId: '', name: '', phone: '', unit: '', title: '', email: '', floor: '', entrance: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importBuildingId, setImportBuildingId] = useState('');
  const [importRows, setImportRows] = useState([]);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const openImportModal = () => {
    setImportBuildingId(buildings[0]?.id || '');
    setImportRows([]);
    setImportError('');
    setImportResult(null);
    setShowImportModal(true);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const { rows, error } = parseTenantCsv(text);
    if (error) {
      setImportError(error);
      setImportRows([]);
    } else {
      setImportError('');
      setImportRows(rows);
    }
  };

  const handleImportSubmit = async () => {
    if (!importBuildingId || importRows.length === 0) return;
    setImporting(true);
    try {
      const result = await api.bulkImportTenants(importBuildingId, importRows);
      setImportResult(result);
      onRefresh();
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const openModal = (tenant = null) => {
    if (tenant) {
      setEditingItem(tenant);
      setForm({
        buildingId: tenant.building_id,
        name: tenant.name,
        phone: tenant.phone,
        unit: tenant.unit || '',
        title: tenant.title || '',
        email: tenant.email || '',
        floor: tenant.floor || '',
        entrance: tenant.entrance || '',
        notes: tenant.notes || ''
      });
    } else {
      setEditingItem(null);
      setForm({ buildingId: buildings[0]?.id || '', name: '', phone: '', unit: '', title: '', email: '', floor: '', entrance: '', notes: '' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingItem) {
        await api.updateTenant(editingItem.id, form);
      } else {
        await api.createTenant(form);
      }
      setShowModal(false);
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this tenant?')) return;
    try {
      await api.deleteTenant(id);
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-secondary" onClick={openImportModal} disabled={buildings.length === 0}>
          Import CSV
        </button>
        <button className="btn btn-primary" onClick={() => openModal()} disabled={buildings.length === 0}>
          <PlusIcon /> Add Tenant
        </button>
      </div>

      {buildings.length === 0 && (
        <div className="card" style={{ background: 'var(--color-warning-bg)', marginBottom: 16 }}>
          <div className="card-body" style={{ padding: 16 }}>
            <div className="text-sm">Add a property first before adding tenants.</div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Property</th>
                <th>Unit</th>
                <th>Status</th>
                <th style={{ width: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-state-icon"><UsersIcon /></div>
                      <h3 className="empty-state-title">No Tenants Yet</h3>
                      <p className="empty-state-description">Add tenants to track their contact information.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                tenants.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="table-cell-main">{titlePrefix(t.title)}{t.name}</div>
                      {t.email && <div className="table-cell-sub">{t.email}</div>}
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{t.phone}</td>
                    <td>{t.building_address || buildings.find(b => b.id === t.building_id)?.address || '-'}</td>
                    <td>{t.unit || '-'}</td>
                    <td>
                      <span className={`badge ${t.status === 'active' ? 'badge-success' : 'badge-default'}`}>
                        {t.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openModal(t)}><EditIcon /></button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(t.id)} style={{ color: 'var(--color-danger)' }}><TrashIcon /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tenant Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingItem ? 'Edit Tenant' : 'Add Tenant'}</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)} style={{ padding: 8 }}><CloseIcon /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Property *</label>
                <select className="form-select" value={form.buildingId} onChange={(e) => setForm({ ...form, buildingId: e.target.value })} required>
                  <option value="">Select property</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>{b.address}{b.city ? `, ${b.city}` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: '0 0 140px' }}>
                  <label className="form-label">Salutation</label>
                  <select className="form-select" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}>
                    <option value="">—</option>
                    <option value="Mister">Herr</option>
                    <option value="Missus">Frau</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Tenant Name *</label>
                  <input type="text" className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
              </div>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)', marginTop: -8, marginBottom: 12 }}>
                Salutation is used to address the tenant by name when they call ("Wie kann ich Ihnen helfen, Herr Bauer?"). Leave blank if unknown.
              </p>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Phone *</label>
                  <input type="tel" className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required placeholder="+49..." />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Unit</label>
                  <input type="text" className="form-input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g., 4B" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Floor</label>
                  <input type="text" className="form-input" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Entrance</label>
                  <input type="text" className="form-input" value={form.entrance} onChange={(e) => setForm({ ...form, entrance: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : (editingItem ? 'Save' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Import Tenants from CSV</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowImportModal(false)} style={{ padding: 8 }}><CloseIcon /></button>
            </div>

            <div style={{ padding: '0 24px 24px' }}>
              {!importResult ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Property *</label>
                    <select className="form-select" value={importBuildingId} onChange={(e) => setImportBuildingId(e.target.value)} required>
                      <option value="">Select property</option>
                      {buildings.map((b) => (
                        <option key={b.id} value={b.id}>{b.address}{b.city ? `, ${b.city}` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">CSV File</label>
                    <div className="text-sm text-muted" style={{ marginBottom: 8 }}>
                      File must have a header row with columns: <code>name, phone</code> (required) and optionally <code>unit</code>, <code>title</code> (Herr / Frau — used to address the tenant by name when they call).
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileSelect}
                      className="form-input"
                    />
                  </div>

                  {importError && (
                    <div className="card" style={{ background: 'var(--color-danger-bg)', marginBottom: 16 }}>
                      <div className="card-body" style={{ padding: 12 }}>
                        <div className="text-sm">{importError}</div>
                      </div>
                    </div>
                  )}

                  {importRows.length > 0 && !importError && (
                    <div className="card" style={{ marginBottom: 16 }}>
                      <div className="card-header">
                        <h3 className="card-title">Preview — {importRows.length} tenants found</h3>
                      </div>
                      <div className="table-container" style={{ maxHeight: 240, overflowY: 'auto' }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Salutation</th>
                              <th>Name</th>
                              <th>Phone</th>
                              <th>Unit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importRows.map((r, i) => (
                              <tr key={i}>
                                <td>{r.title === 'Mister' ? 'Herr' : r.title === 'Missus' ? 'Frau' : '-'}</td>
                                <td>{r.name}</td>
                                <td style={{ fontFamily: 'monospace' }}>{r.phone}</td>
                                <td>{r.unit || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)}>Cancel</button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!importBuildingId || importRows.length === 0 || importing}
                      onClick={handleImportSubmit}
                    >
                      {importing ? 'Importing...' : `Import ${importRows.length || ''} Tenants`}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="card" style={{ background: 'var(--color-success-bg)', marginBottom: 16 }}>
                    <div className="card-body" style={{ padding: 12 }}>
                      <div className="text-sm">
                        Successfully imported {importResult.inserted?.length || 0} tenants.
                        {importResult.errors?.length > 0 && ` ${importResult.errors.length} rows failed.`}
                      </div>
                    </div>
                  </div>

                  {importResult.errors?.length > 0 && (
                    <div className="card" style={{ marginBottom: 16 }}>
                      <div className="card-header">
                        <h3 className="card-title">Failed Rows</h3>
                      </div>
                      <div className="table-container" style={{ maxHeight: 200, overflowY: 'auto' }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Phone</th>
                              <th>Error</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importResult.errors.map((e, i) => (
                              <tr key={i}>
                                <td>{e.tenant?.name}</td>
                                <td>{e.tenant?.phone}</td>
                                <td className="text-sm" style={{ color: 'var(--color-danger)' }}>{e.error}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="modal-actions">
                    <button type="button" className="btn btn-primary" onClick={() => setShowImportModal(false)}>Done</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// PM Service Providers Component
function PmServiceProviders({ serviceProviders, pmId, onRefresh }) {
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ companyName: '', contactName: '', phone: '', email: '', trade: 'general', notes: '' });
  const [saving, setSaving] = useState(false);

  const trades = ['general', 'plumber', 'electrician', 'hvac', 'locksmith', 'elevator', 'fire_safety', 'glass', 'roofing', 'other'];

  const openModal = (sp = null) => {
    if (sp) {
      setEditingItem(sp);
      setForm({
        companyName: sp.company_name,
        contactName: sp.contact_name || '',
        phone: sp.phone,
        email: sp.email || '',
        trade: sp.trade,
        notes: sp.notes || ''
      });
    } else {
      setEditingItem(null);
      setForm({ companyName: '', contactName: '', phone: '', email: '', trade: 'general', notes: '' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingItem) {
        await api.updateServiceProvider(editingItem.id, form);
      } else {
        await api.createServiceProvider({ ...form, pmCompanyId: pmId });
      }
      setShowModal(false);
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this service provider?')) return;
    try {
      await api.deleteServiceProvider(id);
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await api.toggleSpStatus(id);
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <PlusIcon /> Add Service Provider
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Trade</th>
                <th>Status</th>
                <th style={{ width: 180 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {serviceProviders.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-state-icon"><WrenchIcon /></div>
                      <h3 className="empty-state-title">No Service Providers Yet</h3>
                      <p className="empty-state-description">Add service providers to dispatch during emergencies.</p>
                      <button className="btn btn-primary" onClick={() => openModal()}>
                        <PlusIcon /> Add Service Provider
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                serviceProviders.map((sp) => (
                  <tr key={sp.id}>
                    <td className="table-cell-main">{sp.company_name}</td>
                    <td>{sp.contact_name || '-'}</td>
                    <td style={{ fontFamily: 'monospace' }}>{sp.phone}</td>
                    <td><span className="badge badge-default" style={{ textTransform: 'capitalize' }}>{sp.trade.replace(/_/g, ' ')}</span></td>
                    <td>
                      <span className={`badge ${sp.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                        {sp.status === 'active' ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openModal(sp)}><EditIcon /></button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleToggleStatus(sp.id)}>
                          {sp.status === 'active' ? 'Pause' : 'Activate'}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(sp.id)} style={{ color: 'var(--color-danger)' }}><TrashIcon /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SP Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingItem ? 'Edit Service Provider' : 'Add Service Provider'}</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)} style={{ padding: 8 }}><CloseIcon /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Company Name *</label>
                <input type="text" className="form-input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Name</label>
                <input type="text" className="form-input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Phone *</label>
                  <input type="tel" className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Trade *</label>
                <select className="form-select" value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} required>
                  {trades.map((t) => (
                    <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : (editingItem ? 'Save' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// PM Incidents Component
function PmIncidents({ pmId, pmName }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Reads ?status=open so the workspace's "Open Incidents" stat tile can
  // link straight into a pre-filtered list, same pattern as the FM-level
  // Incidents page.
  const [filter, setFilter] = useState(() => (searchParams.get('status') === 'open' ? 'open' : 'all'));

  useEffect(() => {
    const statusParam = searchParams.get('status');
    setFilter(statusParam === 'open' ? 'open' : 'all');
  }, [searchParams]);

  useEffect(() => {
    loadIncidents();
  }, [pmId, filter]);

  const loadIncidents = async () => {
    try {
      const params = { pmCompanyId: pmId };
      if (filter === 'open') params.status = 'open';
      const data = await api.getIncidents(params);
      setIncidents(data.incidents || []);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setLoading(false);
    }
  };

  const getResponsibility = (incident) => {
    if (['closed', 'sp_completed'].includes(incident.status)) {
      return { label: 'Resolved', class: 'badge-success' };
    }
    if (incident.missing_report > 0) {
      return { label: 'Report overdue', class: 'badge-danger' };
    }
    if (incident.status === 'sp_accepted') {
      return { label: 'SP working', class: 'badge-warning' };
    }
    if (incident.status === 'sp_dispatched') {
      return { label: 'Awaiting SP', class: 'badge-warning' };
    }
    if (incident.status === 'escalated_fm') {
      return { label: 'FM escalated', class: 'badge-danger' };
    }
    return { label: 'Open', class: 'badge-primary' };
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>Loading incidents...</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Incidents</h3>
        <select
          className="form-select"
          style={{ width: 180 }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All incidents</option>
          <option value="open">Open only</option>
        </select>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: 120 }}>Date/Time</th>
              <th>Property</th>
              <th>Issue</th>
              <th style={{ width: 100 }}>Severity</th>
              <th style={{ width: 130 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {incidents.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><AlertIcon /></div>
                    <h3 className="empty-state-title">No Incidents</h3>
                    <p className="empty-state-description">
                      {filter === 'open' ? `No open incidents for ${pmName}.` : `No incidents recorded for ${pmName}.`}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              incidents.map((incident) => {
                const resp = getResponsibility(incident);
                return (
                  <tr key={incident.id} className="clickable" onClick={() => navigate(`/incidents/${incident.id}`)}>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{formatTime(incident.created_at)}</td>
                    <td>{incident.building_name || 'Unknown'}</td>
                    <td>{incident.issue_category?.replace(/_/g, ' ') || 'Unknown'}</td>
                    <td>
                      {incident.is_emergency ? (
                        <span className="badge badge-danger">EMERGENCY</span>
                      ) : (
                        <span className="badge badge-default">Normal</span>
                      )}
                    </td>
                    <td><span className={`badge ${resp.class}`}>{resp.label}</span></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// PM Reports Component
function PmReports({ pmId, pmName }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, [pmId]);

  const loadReports = async () => {
    try {
      const data = await api.getReports({ pmCompanyId: pmId });
      setReports(data.reports || []);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Status</th>
              <th>Sent To</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><FileTextIcon /></div>
                    <h3 className="empty-state-title">No Reports</h3>
                    <p className="empty-state-description">No reports generated for {pmName} yet.</p>
                  </div>
                </td>
              </tr>
            ) : (
              reports.map((report) => (
                <tr key={report.id}>
                  <td>{new Date(report.created_at).toLocaleDateString('de-DE')}</td>
                  <td><span className="badge badge-default">{report.type}</span></td>
                  <td><span className={`badge ${report.status === 'sent' ? 'badge-success' : 'badge-warning'}`}>{report.status}</span></td>
                  <td>{report.sent_to || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Main PM Workspace Component
export function PmWorkspace() {
  const { pmId, '*': subPath } = useParams();
  const navigate = useNavigate();
  const { selectPm } = usePm();
  const [pmCompany, setPmCompany] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [serviceProviders, setServiceProviders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Determine active tab from URL path
  const getTabFromPath = () => {
    const path = subPath || '';
    if (path.startsWith('buildings')) return 'buildings';
    if (path.startsWith('tenants')) return 'tenants';
    if (path.startsWith('service-providers')) return 'service-providers';
    if (path.startsWith('incidents')) return 'incidents';
    if (path.startsWith('reports')) return 'reports';
    return 'dashboard';
  };

  const activeTab = getTabFromPath();

  // Navigate to tab URL when tab is clicked
  const handleTabChange = (tabId) => {
    if (tabId === 'dashboard') {
      navigate(`/pm/${pmId}`);
    } else {
      navigate(`/pm/${pmId}/${tabId}`);
    }
  };

  useEffect(() => {
    selectPm(pmId);
    loadData();
  }, [pmId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pmData, statsData, buildingsData, tenantsData, spData] = await Promise.all([
        api.getPmCompany(pmId),
        api.getIncidentStats({ pmCompanyId: pmId }),
        api.getBuildings({ pmCompanyId: pmId }),
        api.getTenants({ pmCompanyId: pmId }),
        api.getServiceProviders({ pmCompanyId: pmId }),
      ]);
      setPmCompany(pmData.pmCompany);
      setStats(statsData.stats);
      setBuildings(buildingsData.buildings || []);
      setTenants(tenantsData.tenants || []);
      setServiceProviders(spData.serviceProviders || []);
    } catch (err) {
      console.error('Failed to load PM data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <p>Loading PM workspace...</p>
      </div>
    );
  }

  if (!pmCompany) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="empty-state">
            <h3 className="empty-state-title">PM Company Not Found</h3>
            <p className="empty-state-description">The requested PM company could not be found.</p>
            <button className="btn btn-primary" onClick={() => navigate('/pm-companies')}>
              <ArrowLeftIcon /> Back to PM Companies
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <BuildingIcon /> },
    { id: 'buildings', label: 'Properties', icon: <BuildingIcon /> },
    { id: 'tenants', label: 'Tenants', icon: <UsersIcon /> },
    { id: 'service-providers', label: 'Service Providers', icon: <WrenchIcon /> },
    { id: 'incidents', label: 'Incidents', icon: <AlertIcon /> },
    { id: 'reports', label: 'Reports', icon: <FileTextIcon /> },
  ];

  return (
    <div>
      {/* PM Context Header */}
      <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, var(--color-primary) 0%, #1e40af 100%)' }}>
        <div className="card-body" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                PM Company Workspace
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{pmCompany.name}</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                {pmCompany.service_phone && (
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                    <PhoneIcon style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 4 }} />
                    {pmCompany.service_phone}
                  </span>
                )}
                {pmCompany.contact_email && (
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{pmCompany.contact_email}</span>
                )}
              </div>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/pm-companies')}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff' }}
            >
              <ArrowLeftIcon /> Exit Workspace
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto', padding: '0 8px' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '16px 20px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && (
        <PmDashboard pmCompany={pmCompany} stats={stats} buildings={buildings} tenants={tenants} serviceProviders={serviceProviders} />
      )}
      {activeTab === 'buildings' && (
        <PmBuildings buildings={buildings} pmId={pmId} onRefresh={loadData} />
      )}
      {activeTab === 'tenants' && (
        <PmTenants tenants={tenants} buildings={buildings} onRefresh={loadData} />
      )}
      {activeTab === 'service-providers' && (
        <PmServiceProviders serviceProviders={serviceProviders} pmId={pmId} onRefresh={loadData} />
      )}
      {activeTab === 'incidents' && (
        <PmIncidents pmId={pmId} pmName={pmCompany.name} />
      )}
      {activeTab === 'reports' && (
        <PmReports pmId={pmId} pmName={pmCompany.name} />
      )}
    </div>
  );
}
