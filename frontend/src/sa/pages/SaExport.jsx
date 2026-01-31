import { useState } from 'react';
import { saApi } from '../api';

const EXPORT_TYPES = [
  { id: 'companies', name: 'Companies', description: 'All FM companies with plan and status', icon: 'C' },
  { id: 'users', name: 'Users', description: 'All FM admin users across companies', icon: 'U' },
  { id: 'trials', name: 'Trials', description: 'Current trial companies with activation metrics', icon: 'T' },
  { id: 'subscriptions', name: 'Subscriptions', description: 'Active subscriptions with billing info', icon: '$' },
  { id: 'incidents', name: 'Incidents', description: 'All incidents with status and resolution', icon: '!' },
  { id: 'buildings', name: 'Buildings', description: 'All buildings with PM assignments', icon: 'B' },
  { id: 'audit-logs', name: 'Audit Logs', description: 'Super admin audit trail', icon: 'A' },
];

export function SaExport() {
  const [exporting, setExporting] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [format, setFormat] = useState('csv');
  const [days, setDays] = useState(90);

  const handleExport = async (typeId) => {
    setExporting(typeId);
    setError('');
    setSuccess('');

    try {
      let endpoint = `/export/${typeId}?format=${format}`;
      if (typeId === 'incidents' || typeId === 'audit-logs') {
        endpoint += `&days=${days}`;
      }

      if (format === 'csv') {
        // For CSV, trigger download
        const token = localStorage.getItem('sa_token');
        const SA_API_URL = import.meta.env.VITE_SA_API_URL || 'http://localhost:3001/sa';
        const response = await fetch(`${SA_API_URL}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Export failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${typeId}_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        setSuccess(`${typeId} exported successfully!`);
      } else {
        // JSON - preview in console or show count
        const result = await saApi.request(endpoint);
        setSuccess(`${typeId} export: ${result.count} records ready. Check console for JSON data.`);
        console.log(`Export ${typeId}:`, result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <p className="sa-eyebrow">Super Admin</p>
          <h1>Data Export</h1>
          <p className="sa-muted">Export data for analysis, reporting, or backup purposes.</p>
        </div>
      </div>

      {error && <div className="sa-error">{error}</div>}
      {success && <div className="sa-success">{success}</div>}

      {/* Export Options */}
      <div className="sa-export-options">
        <div className="sa-export-option">
          <label>Format</label>
          <div className="sa-btn-group">
            <button
              className={`sa-btn sa-btn-sm ${format === 'csv' ? 'sa-btn-primary' : ''}`}
              onClick={() => setFormat('csv')}
            >
              CSV
            </button>
            <button
              className={`sa-btn sa-btn-sm ${format === 'json' ? 'sa-btn-primary' : ''}`}
              onClick={() => setFormat('json')}
            >
              JSON
            </button>
          </div>
        </div>
        <div className="sa-export-option">
          <label>Time Range (Incidents/Audit)</label>
          <select
            className="sa-input"
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            style={{ width: 150 }}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 180 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>
      </div>

      {/* Export Types Grid */}
      <div className="sa-export-grid">
        {EXPORT_TYPES.map((type) => (
          <div key={type.id} className="sa-export-card">
            <div className="sa-export-card-header">
              <div className="sa-export-icon">{type.icon}</div>
              <div className="sa-export-card-info">
                <h3>{type.name}</h3>
                <p>{type.description}</p>
              </div>
            </div>
            <button
              className="sa-btn sa-btn-primary"
              onClick={() => handleExport(type.id)}
              disabled={exporting === type.id}
            >
              {exporting === type.id ? 'Exporting...' : `Export ${format.toUpperCase()}`}
            </button>
          </div>
        ))}
      </div>

      {/* Export All */}
      <div className="sa-panel" style={{ marginTop: 24 }}>
        <div className="sa-panel-header">
          <h3>Bulk Export</h3>
        </div>
        <p className="sa-muted" style={{ marginBottom: 16 }}>
          Export all data types at once. This may generate multiple files.
        </p>
        <button
          className="sa-btn sa-btn-secondary"
          onClick={async () => {
            for (const type of EXPORT_TYPES) {
              await handleExport(type.id);
              // Small delay between exports
              await new Promise(r => setTimeout(r, 500));
            }
          }}
          disabled={exporting !== null}
        >
          {exporting ? 'Exporting...' : 'Export All Data'}
        </button>
      </div>
    </div>
  );
}
