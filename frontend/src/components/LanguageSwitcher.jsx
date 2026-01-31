import { useLanguage } from '../context/LanguageContext';

export function LanguageSwitcher({ variant = 'default' }) {
  const { language, setLanguage, t } = useLanguage();

  if (variant === 'compact') {
    return (
      <div style={{
        display: 'flex',
        gap: 4,
        background: 'var(--color-bg-secondary)',
        borderRadius: 6,
        padding: 2,
      }}>
        <button
          onClick={() => setLanguage('de')}
          style={{
            padding: '4px 8px',
            fontSize: 12,
            fontWeight: language === 'de' ? 600 : 400,
            background: language === 'de' ? 'var(--color-primary)' : 'transparent',
            color: language === 'de' ? 'white' : 'var(--color-text-secondary)',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          title="Deutsch"
        >
          DE
        </button>
        <button
          onClick={() => setLanguage('en')}
          style={{
            padding: '4px 8px',
            fontSize: 12,
            fontWeight: language === 'en' ? 600 : 400,
            background: language === 'en' ? 'var(--color-primary)' : 'transparent',
            color: language === 'en' ? 'white' : 'var(--color-text-secondary)',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          title="English"
        >
          EN
        </button>
      </div>
    );
  }

  // Default dropdown variant
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        style={{
          padding: '6px 28px 6px 10px',
          fontSize: 13,
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          background: 'var(--color-bg)',
          color: 'var(--color-text)',
          cursor: 'pointer',
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
        }}
      >
        <option value="de">🇩🇪 Deutsch</option>
        <option value="en">🇬🇧 English</option>
      </select>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          color: 'var(--color-text-secondary)',
        }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

export default LanguageSwitcher;
