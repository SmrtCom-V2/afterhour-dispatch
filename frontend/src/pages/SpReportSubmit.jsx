import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { API_URL } from '../utils/apiConfig';

export function SpReportSubmit() {
  const { token } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    finishTime: '',
    photos: [],
  });

  useEffect(() => {
    loadReport();
  }, [token]);

  const loadReport = async () => {
    try {
      const res = await fetch(`${API_URL}/sp-report/${token}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load report');
        return;
      }

      setReport(data.report);

      // Set default finish time to now
      const now = new Date();
      setFormData((prev) => ({
        ...prev,
        finishTime: now.toISOString().slice(0, 16),
      }));
    } catch (err) {
      setError('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setFormData((prev) => ({
      ...prev,
      photos: [...prev.photos, ...files],
    }));
  };

  const removePhoto = (index) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.photos.length === 0) {
      setError('Please add at least one photo');
      return;
    }

    setSubmitting(true);
    setError('');

    const data = new FormData();
    data.append('description', formData.description);
    data.append('finishTime', formData.finishTime);
    formData.photos.forEach((photo) => {
      data.append('photos', photo);
    });

    try {
      const res = await fetch(`${API_URL}/sp-report/${token}`, {
        method: 'POST',
        body: data,
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Failed to submit report');
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="login-page">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="login-page">
        <div className="login-form" style={{ textAlign: 'center' }}>
          <h1 style={{ color: '#00A000', marginBottom: 16 }}>Report Submitted</h1>
          <p>Thank you. Your report has been submitted successfully.</p>
        </div>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="login-page">
        <div className="login-form" style={{ textAlign: 'center' }}>
          <h1 style={{ color: '#C00000', marginBottom: 16 }}>Error</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div style={{ width: 480, maxWidth: '90%' }}>
        <h1 className="login-title">Service Report</h1>

        {/* Job Info */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Company:</strong> {report.spName}
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Building:</strong> {report.buildingName}
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Address:</strong> {report.buildingAddress}
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Issue:</strong> {report.issueCategory?.replace(/_/g, ' ')}
          </div>
          <div style={{ color: '#C00000', fontWeight: 600 }}>
            Deadline: {new Date(report.deadline).toLocaleString('de-DE')}
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Work Description (required)</label>
            <textarea
              className="form-textarea"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              placeholder="Describe what work was done..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Finish Time</label>
            <input
              type="datetime-local"
              className="form-input"
              value={formData.finishTime}
              onChange={(e) => setFormData({ ...formData, finishTime: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Photos (required)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              style={{ marginBottom: 8 }}
            />
            {formData.photos.length > 0 && (
              <div className="photo-grid">
                {formData.photos.map((photo, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img
                      src={URL.createObjectURL(photo)}
                      alt={`Photo ${i + 1}`}
                      className="photo-thumbnail"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      style={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#C00000',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: '#FFF3CD', padding: 12, borderRadius: 4, marginBottom: 16 }}>
            <strong>IMPORTANT:</strong> NO REPORT = NO PAYMENT
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </form>
      </div>
    </div>
  );
}
