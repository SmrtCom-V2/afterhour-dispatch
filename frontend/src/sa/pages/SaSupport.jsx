import { useEffect, useState } from 'react';
import { saApi } from '../api';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-GB');
}

const PRIORITY_COLORS = {
  urgent: '#ef4444',
  high: '#f97316',
  normal: '#6b7280',
  low: '#22c55e',
};

const NOTE_TYPES = [
  { id: 'internal', label: 'Internal Note' },
  { id: 'customer', label: 'Customer Note' },
  { id: 'escalation', label: 'Escalation' },
  { id: 'feedback', label: 'Feedback' },
];

const PRIORITIES = [
  { id: 'urgent', label: 'Urgent' },
  { id: 'high', label: 'High' },
  { id: 'normal', label: 'Normal' },
  { id: 'low', label: 'Low' },
];

export function SaSupport() {
  const [activeTab, setActiveTab] = useState('notes');
  const [notes, setNotes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [noteType, setNoteType] = useState('');
  const [search, setSearch] = useState('');

  // New note form
  const [showNewNote, setShowNewNote] = useState(false);
  const [newNote, setNewNote] = useState({
    note: '',
    note_type: 'internal',
    priority: 'normal',
    company_id: '',
  });
  const [saving, setSaving] = useState(false);

  // Template preview
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const loadNotes = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (noteType) params.type = noteType;
      if (search) params.search = search;

      const query = new URLSearchParams(params).toString();
      const res = await saApi.request(`/support/notes${query ? `?${query}` : ''}`);
      setNotes(res.notes || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const res = await saApi.request('/support/templates');
      setTemplates(res.templates || []);
    } catch (err) {
      console.error('Failed to load templates', err);
    }
  };

  const loadStats = async () => {
    try {
      const res = await saApi.request('/support/stats');
      setStats(res.stats);
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  };

  useEffect(() => {
    loadNotes();
    loadTemplates();
    loadStats();
  }, [noteType, search]);

  const handleCreateNote = async () => {
    if (!newNote.note.trim()) {
      setError('Note content is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await saApi.request('/support/notes', {
        method: 'POST',
        body: JSON.stringify(newNote),
      });

      setNewNote({ note: '', note_type: 'internal', priority: 'normal', company_id: '' });
      setShowNewNote(false);
      await loadNotes();
      await loadStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!confirm('Delete this note?')) return;

    try {
      await saApi.request(`/support/notes/${noteId}`, { method: 'DELETE' });
      await loadNotes();
      await loadStats();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <p className="sa-eyebrow">Super Admin</p>
          <h1>Support & Communications</h1>
          <p className="sa-muted">Internal notes, customer communications, and email templates.</p>
        </div>
        <button className="sa-btn sa-btn-primary" onClick={() => setShowNewNote(true)}>
          Add Note
        </button>
      </div>

      {error && <div className="sa-error">{error}</div>}

      {/* Stats */}
      {stats && (
        <div className="sa-stats-grid-4">
          <div className="sa-stat-card">
            <div className="sa-stat-label">Total Notes</div>
            <div className="sa-stat-value">{stats.total_notes || 0}</div>
          </div>
          <div className="sa-stat-card">
            <div className="sa-stat-label">Urgent</div>
            <div className="sa-stat-value" style={{ color: '#ef4444' }}>{stats.urgent_notes || 0}</div>
          </div>
          <div className="sa-stat-card">
            <div className="sa-stat-label">Today</div>
            <div className="sa-stat-value">{stats.notes_today || 0}</div>
          </div>
          <div className="sa-stat-card">
            <div className="sa-stat-label">This Week</div>
            <div className="sa-stat-value">{stats.notes_week || 0}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="sa-tabs">
        <button
          className={`sa-tab ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          Support Notes
        </button>
        <button
          className={`sa-tab ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          Email Templates
        </button>
      </div>

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <>
          {/* Filters */}
          <div className="sa-export-options" style={{ marginBottom: 20 }}>
            <div className="sa-export-option">
              <label>Type</label>
              <select
                className="sa-input"
                value={noteType}
                onChange={(e) => setNoteType(e.target.value)}
                style={{ width: 160 }}
              >
                <option value="">All Types</option>
                {NOTE_TYPES.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="sa-export-option">
              <label>Search</label>
              <input
                type="text"
                className="sa-input"
                placeholder="Search notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 250 }}
              />
            </div>
          </div>

          {/* Notes List */}
          <div className="sa-panel">
            {loading ? (
              <div className="sa-loading">Loading...</div>
            ) : notes.length === 0 ? (
              <div className="sa-empty">
                <p>No support notes found.</p>
              </div>
            ) : (
              <div className="sa-support-notes-list">
                {notes.map((note) => (
                  <div key={note.id} className="sa-support-note">
                    <div className="sa-support-note-header">
                      <div className="sa-support-note-meta">
                        <span
                          className="sa-priority-badge"
                          style={{ backgroundColor: PRIORITY_COLORS[note.priority] + '20', color: PRIORITY_COLORS[note.priority] }}
                        >
                          {note.priority}
                        </span>
                        <span className="sa-note-type-badge">{note.note_type}</span>
                        {note.company_name && (
                          <span className="sa-company-badge">{note.company_name}</span>
                        )}
                      </div>
                      <button
                        className="sa-btn sa-btn-ghost sa-btn-sm"
                        onClick={() => handleDeleteNote(note.id)}
                      >
                        Delete
                      </button>
                    </div>
                    <div className="sa-support-note-body">{note.note}</div>
                    <div className="sa-support-note-footer">
                      <span>Created: {formatDate(note.created_at)}</span>
                      {note.created_by && <span>By: {note.created_by}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="sa-dashboard-grid">
          <div className="sa-panel">
            <div className="sa-panel-header">
              <h3>Email Templates</h3>
            </div>
            <div className="sa-templates-list">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`sa-template-item ${selectedTemplate?.id === template.id ? 'active' : ''}`}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <div className="sa-template-name">{template.name}</div>
                  <div className="sa-template-category">{template.category}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="sa-panel">
            <div className="sa-panel-header">
              <h3>Template Preview</h3>
            </div>
            {selectedTemplate ? (
              <div className="sa-template-preview">
                <div className="sa-template-field">
                  <label>Subject</label>
                  <div className="sa-template-value">{selectedTemplate.subject}</div>
                </div>
                <div className="sa-template-field">
                  <label>Body</label>
                  <pre className="sa-template-body">{selectedTemplate.body}</pre>
                </div>
                <div className="sa-template-variables">
                  <p className="sa-muted">Available variables: {`{{company_name}}, {{trial_start_date}}, {{trial_end_date}}, {{extension_days}}, {{new_trial_end_date}}`}</p>
                </div>
              </div>
            ) : (
              <p className="sa-muted" style={{ padding: 16 }}>Select a template to preview</p>
            )}
          </div>
        </div>
      )}

      {/* New Note Modal */}
      {showNewNote && (
        <div className="sa-modal-overlay" onClick={() => setShowNewNote(false)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-header">
              <h3>New Support Note</h3>
              <button className="sa-modal-close" onClick={() => setShowNewNote(false)}>&times;</button>
            </div>
            <div className="sa-modal-body">
              <div className="sa-form-group">
                <label>Company (optional)</label>
                <input
                  type="text"
                  className="sa-input"
                  placeholder="Company ID (leave empty for general note)"
                  value={newNote.company_id}
                  onChange={(e) => setNewNote({ ...newNote, company_id: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div className="sa-form-group" style={{ flex: 1 }}>
                  <label>Type</label>
                  <select
                    className="sa-input"
                    value={newNote.note_type}
                    onChange={(e) => setNewNote({ ...newNote, note_type: e.target.value })}
                  >
                    {NOTE_TYPES.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="sa-form-group" style={{ flex: 1 }}>
                  <label>Priority</label>
                  <select
                    className="sa-input"
                    value={newNote.priority}
                    onChange={(e) => setNewNote({ ...newNote, priority: e.target.value })}
                  >
                    {PRIORITIES.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sa-form-group">
                <label>Note</label>
                <textarea
                  className="sa-textarea"
                  placeholder="Enter note content..."
                  value={newNote.note}
                  onChange={(e) => setNewNote({ ...newNote, note: e.target.value })}
                  rows={5}
                />
              </div>
            </div>
            <div className="sa-modal-footer">
              <button className="sa-btn" onClick={() => setShowNewNote(false)}>Cancel</button>
              <button
                className="sa-btn sa-btn-primary"
                onClick={handleCreateNote}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Create Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
