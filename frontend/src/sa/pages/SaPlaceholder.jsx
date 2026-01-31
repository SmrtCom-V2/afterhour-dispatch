export function SaPlaceholder({ title, description }) {
  return (
    <div className="sa-page">
      <div className="sa-page-header">
        <div>
          <p className="sa-eyebrow">Super Admin</p>
          <h1>{title}</h1>
          <p className="sa-muted">{description}</p>
        </div>
      </div>
      <div className="sa-panel">
        <p className="sa-muted">This area is scaffolded and ready for API wiring.</p>
      </div>
    </div>
  );
}
