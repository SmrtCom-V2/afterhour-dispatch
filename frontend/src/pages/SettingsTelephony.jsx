/**
 * Settings — Emergency Line (after-hours number provisioning)
 * Spec: AFTERHOUR_PHONE_NUMBER_PROVISIONING_SPEC.md §10.2
 *
 * Per PM company: shows the assigned number + status, lets the customer
 *   - get a dedicated Twilio number (+€4.99/mo), or
 *   - register "I'll forward my own number" (free), or
 *   - run the verification test call, or
 *   - release the number.
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { Layout } from '../components/Layout';
import { useLanguage } from '../context/LanguageContext';

const PhoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
);

function StatusBadge({ status, t }) {
  const map = {
    active: { cls: 'badge-success', label: t('lineStatusActive') || 'Active' },
    provisioning: { cls: 'badge-warning', label: t('lineStatusProvisioning') || 'Setting up' },
    forwarding_pending: { cls: 'badge-warning', label: t('lineStatusForwardingPending') || 'Forwarding setup pending' },
    port_pending: { cls: 'badge-warning', label: t('lineStatusPortPending') || 'Port pending' },
    unassigned: { cls: 'badge-muted', label: t('lineStatusUnassigned') || 'Not set up' },
    released: { cls: 'badge-muted', label: t('lineStatusReleased') || 'Released' },
  };
  const s = map[status] || map.unassigned;
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

function PmLineCard({ pm, priceLabel, provisioningAvailable, onChanged, t }) {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(null); // 'dedicated' | 'byo' | null
  const [publishedNumber, setPublishedNumber] = useState('');
  const [verification, setVerification] = useState(null);
  const [error, setError] = useState(null);

  const isActive = pm.service_phone_status === 'active';
  const hasNumber = !!pm.service_phone && pm.service_phone_status !== 'unassigned' && pm.service_phone_status !== 'released';

  const run = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); await onChanged(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const getDedicated = () => run(async () => {
    await api.provisionNumber(pm.id, { type: 'local', areaCode: '30' });
  });

  const setupByo = () => run(async () => {
    if (!publishedNumber.trim()) throw new Error(t('enterYourNumber') || 'Enter your published number first');
    await api.setupByoForward(pm.id, publishedNumber.trim());
  });

  const startVerify = () => run(async () => {
    const res = await api.startTelephonyVerification(pm.id);
    setVerification(res);
  });

  const confirmHeard = () => run(async () => {
    await api.confirmTelephonyHeard(verification.verificationId);
    setVerification(null);
  });

  const release = () => {
    if (!window.confirm(t('confirmReleaseNumber') || 'Release this number? Tenants will no longer be able to reach After Hour on it.')) return;
    run(async () => { await api.releaseTelephonyNumber(pm.id); setMode(null); });
  };

  return (
    <div className="card mb-4">
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 600 }}>{pm.name}</div>
          <StatusBadge status={pm.service_phone_status} t={t} />
        </div>

        {hasNumber && (
          <div style={{ marginBottom: 12 }}>
            <div className="text-sm text-muted">{t('yourEmergencyNumber') || 'Your emergency number'}</div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.5px' }}>
              {pm.telephony_model === 'byo_forward' ? pm.published_number : pm.service_phone}
            </div>
            {pm.telephony_model === 'byo_forward' && (
              <div className="text-sm text-muted" style={{ marginTop: 4 }}>
                {t('forwardsTo') || 'Forwards to'}: <strong>{pm.service_phone}</strong>
              </div>
            )}
            {pm.telephony_model === 'provisioned' && (
              <div className="text-sm text-muted" style={{ marginTop: 4 }}>{priceLabel}/{t('perMonth') || 'month'}</div>
            )}
          </div>
        )}

        {isActive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-success)', fontSize: 14, marginBottom: 8 }}>
            <CheckIcon /> {t('lineIsLive') || 'Your emergency line is live.'}
          </div>
        )}

        {/* Not set up yet — offer both options */}
        {!hasNumber && !mode && (
          <div style={{ display: 'grid', gap: 8 }}>
            <button className="btn btn-primary" disabled={busy || !provisioningAvailable} onClick={getDedicated}>
              {t('getDedicatedNumber') || 'Get a dedicated number'} — +{priceLabel}/{t('perMonth') || 'month'}
            </button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setMode('byo')}>
              {t('useMyOwnNumber') || 'Use my own number (free)'}
            </button>
            {!provisioningAvailable && (
              <div className="text-sm text-muted">{t('provisioningUnavailable') || 'Number setup is temporarily unavailable — contact support.'}</div>
            )}
          </div>
        )}

        {/* BYO forward setup */}
        {!hasNumber && mode === 'byo' && (
          <div style={{ display: 'grid', gap: 8 }}>
            <label className="text-sm" style={{ fontWeight: 500 }}>
              {t('yourPublishedNumber') || 'The number your tenants currently call'}
            </label>
            <input
              className="form-input"
              placeholder="+49 30 1234567"
              value={publishedNumber}
              onChange={(e) => setPublishedNumber(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" disabled={busy} onClick={setupByo}>
                {t('continue') || 'Continue'}
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => setMode(null)}>
                {t('cancel') || 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* Forwarding pending — show instructions link + verify */}
        {pm.service_phone_status === 'forwarding_pending' && (
          <div style={{ marginTop: 8 }}>
            <p className="text-sm">
              {t('forwardYourLineTo') || 'Set conditional call-forwarding (on no-answer) from your published number to'}: <strong>{pm.service_phone}</strong>.{' '}
              <a href="/settings/telephony/forwarding" target="_blank" rel="noreferrer">{t('carrierInstructions') || 'Per-carrier instructions'}</a>
            </p>
          </div>
        )}

        {/* Verification */}
        {hasNumber && !isActive && !verification && (
          <button className="btn btn-primary" style={{ marginTop: 8 }} disabled={busy} onClick={startVerify}>
            {t('testMyLine') || 'Test my line'}
          </button>
        )}
        {verification && (
          <div style={{ marginTop: 12, padding: 12, background: 'var(--color-info-bg)', borderRadius: 8 }}>
            <p className="text-sm" style={{ marginBottom: 8 }}>{verification.instruction}</p>
            {verification.autoChecks && (
              <ul className="text-sm text-muted" style={{ margin: '0 0 8px 16px' }}>
                <li>{verification.autoChecks.twilioWebhook ? '✓' : '✗'} {t('checkNumberConfig') || 'Number configured'}</li>
                <li>{verification.autoChecks.routingResolves ? '✓' : '✗'} {t('checkRouting') || 'Routing verified'}</li>
              </ul>
            )}
            <button className="btn btn-success btn-sm" disabled={busy} onClick={confirmHeard}>
              {t('iHeardIt') || 'I heard the assistant'}
            </button>
          </div>
        )}

        {/* Release (active dedicated only) */}
        {isActive && pm.telephony_model === 'provisioned' && (
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, color: 'var(--color-danger)' }} disabled={busy} onClick={release}>
            {t('releaseThisNumber') || 'Release this number'}
          </button>
        )}

        {error && <div className="text-sm" style={{ color: 'var(--color-danger)', marginTop: 8 }}>{error}</div>}
      </div>
    </div>
  );
}

export default function SettingsTelephony() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.getTelephonyStatus()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const priceLabel = data?.dedicatedNumberPriceCents
    ? `€${(data.dedicatedNumberPriceCents / 100).toFixed(2)}`
    : '€4.99';

  return (
    <Layout>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <PhoneIcon />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('emergencyLine') || 'Emergency Line'}</h1>
        </div>
        <p className="text-muted" style={{ marginBottom: 20 }}>
          {t('emergencyLineIntro') || 'The phone number your tenants call for after-hours emergencies. Set one up per client.'}
        </p>

        {loading && <div className="text-muted">{t('loading') || 'Loading…'}</div>}
        {error && <div className="card"><div className="card-body" style={{ color: 'var(--color-danger)' }}>{error}</div></div>}

        {data && data.pmCompanies.length === 0 && (
          <div className="card"><div className="card-body">
            {t('addClientFirst') || 'Add a client (PM company) first, then set up its emergency line here.'}
          </div></div>
        )}

        {data && data.pmCompanies.map((pm) => (
          <PmLineCard
            key={pm.id}
            pm={pm}
            priceLabel={priceLabel}
            provisioningAvailable={data.provisioningAvailable}
            onChanged={load}
            t={t}
          />
        ))}
      </div>
    </Layout>
  );
}
