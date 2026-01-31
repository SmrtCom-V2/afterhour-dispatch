import { useEffect, useState } from 'react';
import { saApi } from '../api';

export function SaUsage() {
  const [usage, setUsage] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setError('');
      try {
        const res = await saApi.getUsage();
        setUsage(res.usage || []);
      } catch (err) {
        setError(err.message);
      }
    };
    load();
  }, []);

  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <p className="sa-eyebrow">Super Admin</p>
          <h1>Usage</h1>
          <p className="sa-muted">Companies approaching or exceeding limits.</p>
        </div>
      </div>

      {error && <div className="sa-error">{error}</div>}

      <div className="sa-panel">
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Seats Used</th>
                <th>Seats Limit</th>
                <th>Last Activity</th>
                <th>Over Limit</th>
              </tr>
            </thead>
            <tbody>
              {usage.length === 0 ? (
                <tr><td colSpan={5} className="sa-loading">No usage data.</td></tr>
              ) : (
                usage.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.seats_used ?? 0}</td>
                    <td>{u.seats_limit ?? 0}</td>
                    <td>{u.last_activity_at ? new Date(u.last_activity_at).toLocaleString('en-GB') : '-'}</td>
                    <td>{u.over_limit ? '⚠' : '-'}</td>
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
