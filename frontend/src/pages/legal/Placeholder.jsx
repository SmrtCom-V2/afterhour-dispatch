export function Placeholder({ label, children }) {
  return (
    <div className="legal-placeholder">
      <strong>⚠ TODO — {label}</strong>
      {children}
    </div>
  );
}
