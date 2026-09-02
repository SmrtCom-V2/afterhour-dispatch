import { s } from './cockpitStyles';

export function Shell({ children }) {
  return <div style={s.shell}>{children}</div>;
}

export function Centered({ children }) {
  return <div style={s.centered}>{children}</div>;
}

export function Section({ title, children }) {
  return (
    <div style={s.section}>
      {title && <h2 style={s.sectionTitle}>{title}</h2>}
      {children}
    </div>
  );
}

export function Row({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div style={s.row}>
      <span style={s.rowLabel}>{label}</span>
      <span style={s.rowValue}>{value}</span>
    </div>
  );
}

export function AccessItem({ label, value }) {
  if (!value) return null;
  return (
    <div style={s.accessItem}>
      <span style={s.accessLabel}>{label}</span>
      <span style={s.accessValue}>{value}</span>
    </div>
  );
}
