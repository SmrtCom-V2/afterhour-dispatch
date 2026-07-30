// GDPR tooling was built against a different, hypothetical schema
// (user accounts, sessions, consent tracking) than what this system
// actually has (tenant/incident/pm_company/building, no login-based
// tenant accounts). Every backend route it called always failed and
// silently reported fake success — worse than not existing, since a
// super-admin handling a real legal data request would have believed
// it worked. Backend now returns a clear 501; this page reflects that
// honestly instead of showing an empty, misleadingly "working" table.
export function SaGdpr() {
  return (
    <div className="sa-page">
      <h1 className="sa-page-title">GDPR Tools</h1>
      <div
        style={{
          background: '#450a0a',
          border: '1px solid #7f1d1d',
          borderRadius: 8,
          padding: '20px 24px',
          color: '#fca5a5',
          maxWidth: 640,
        }}
      >
        <strong>Not yet available.</strong>
        <p style={{ marginTop: 8, marginBottom: 0, color: '#fecaca', fontSize: 14, lineHeight: 1.6 }}>
          Data export and deletion tooling has not been built against this system's real
          data model yet. If you have a real GDPR request to handle, contact engineering
          directly — do not assume any export or deletion happened via this page.
        </p>
      </div>
    </div>
  );
}
