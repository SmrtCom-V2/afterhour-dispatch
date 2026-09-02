import { useState } from 'react';
import { s } from './cockpitStyles';
import { Section } from './primitives';
import { SpPicker } from './SpPicker';
import { aiHasImpliedAction, isOverrideOfAiSuggestion } from './useCockpitData';

const OVERRIDE_REASON_KEYS = [
  'ai_missed_a_fact',
  'ai_misjudged_severity',
  'caller_gave_more_info_after_call',
  'tier_right_tone_off',
  'other',
];

/**
 * ZONE 4 — the branch set. Primary path: send a service provider (pick one →
 * system calls / I'll call → confirm). Secondary paths: call the tenant back,
 * handle it myself, escalate to FM, defer to morning, forward a safe brief.
 */
export function Zone4Decide({
  data,
  derived,
  strings,
  busy,
  onDecide, // (action, { chosenSpId, overrideReason }) => Promise
  onForward, // () => Promise<{url}>
  callbackCount,
  actionError,
}) {
  const { suggestedCompany, allCompanies, fmOnCall } = data;
  const { urgencyKey } = derived;

  const [mode, setMode] = useState('choose'); // choose | pick_sp | confirm
  const [pendingAction, setPendingAction] = useState(null); // send_company | send_company_manual
  const [chosenSpId, setChosenSpId] = useState(suggestedCompany?.id || null);
  const [overrideReason, setOverrideReason] = useState('');
  const [forwardUrl, setForwardUrl] = useState('');
  const [forwarding, setForwarding] = useState(false);
  const [copied, setCopied] = useState(false);

  const showOverridePicker =
    aiHasImpliedAction(urgencyKey) &&
    pendingAction &&
    isOverrideOfAiSuggestion(urgencyKey, pendingAction);

  const chosenSp = allCompanies?.find((c) => c.id === chosenSpId) || suggestedCompany;

  const startSendCompany = () => {
    setChosenSpId(suggestedCompany?.id || allCompanies?.[0]?.id || null);
    setMode('pick_sp');
  };

  const goConfirm = (action) => {
    setPendingAction(action);
    setMode('confirm');
  };

  const doDecide = (action) => onDecide(action, { chosenSpId, overrideReason });

  const doForward = async () => {
    setForwarding(true);
    try {
      const res = await onForward();
      if (res?.url) setForwardUrl(res.url);
    } finally {
      setForwarding(false);
    }
  };

  // ---- confirm sheet -----------------------------------------------------
  if (mode === 'confirm' && pendingAction) {
    const isManual = pendingAction === 'send_company_manual';
    return (
      <>
        <div style={s.confirmBackdrop} onClick={() => setMode('pick_sp')} />
        <div style={s.confirmSheet}>
          <p style={s.confirmTitle}>
            {isManual
              ? strings.confirmManualTitle(chosenSp?.companyName || '')
              : strings.confirmSendTitle(chosenSp?.companyName || '')}
          </p>
          <p style={s.confirmBody}>
            {isManual ? strings.confirmManualBody : `${chosenSp?.phone || ''}`}
          </p>
          {showOverridePicker && (
            <div style={{ marginBottom: '14px' }}>
              <p style={s.sectionSubtitle}>{strings.overridePrompt}</p>
              <select
                style={s.select}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              >
                <option value="">{strings.overrideNone}</option>
                {OVERRIDE_REASON_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {strings.overrideReasons[k]}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            disabled={busy}
            style={{ ...s.decisionButton, background: '#16a34a' }}
            onClick={() => doDecide(pendingAction)}
          >
            {strings.confirm}
          </button>
          <button
            disabled={busy}
            style={s.decisionButtonSecondary}
            onClick={() => setMode('pick_sp')}
          >
            {strings.back}
          </button>
        </div>
      </>
    );
  }

  // ---- SP picker -------------------------------------------------------
  if (mode === 'pick_sp') {
    return (
      <Section title={strings.decide}>
        <SpPicker
          companies={allCompanies}
          suggestedId={suggestedCompany?.id}
          chosenId={chosenSpId}
          onChoose={setChosenSpId}
          strings={strings}
        />
        <button
          disabled={busy || !chosenSpId}
          style={{ ...s.decisionButton, background: '#16a34a' }}
          onClick={() => goConfirm('send_company')}
        >
          <span style={s.btnIcon}>🚒</span>
          {strings.systemCallsThem}
        </button>
        <button
          disabled={busy || !chosenSpId}
          style={s.decisionButtonSecondary}
          onClick={() => goConfirm('send_company_manual')}
        >
          <span style={s.btnIcon}>📱</span>
          {strings.illCallThem}
        </button>
        <button disabled={busy} style={s.decisionButtonSecondary} onClick={() => setMode('choose')}>
          {strings.back}
        </button>
      </Section>
    );
  }

  // ---- the branch set ------------------------------------------------
  return (
    <Section title={strings.decide}>
      {callbackCount > 0 && (
        <div style={s.warnBanner}>
          {strings.callbackCountNote(callbackCount)} {strings.stillNeedToDecide}
        </div>
      )}
      {actionError && <div style={s.warnBanner}>{actionError}</div>}

      {/* primary */}
      <button
        disabled={busy}
        style={{ ...s.decisionButton, background: '#16a34a' }}
        onClick={startSendCompany}
      >
        <span style={s.btnIcon}>🚒</span>
        {strings.actionSendCompany}
      </button>

      <div style={s.dividerLabel}>— or —</div>

      {/* secondary */}
      <button
        disabled={busy}
        style={s.decisionButtonSecondary}
        onClick={() => onDecide('callback_tenant', {})}
      >
        <span style={s.btnIcon}>📞</span>
        {strings.actionCallTenant}
      </button>
      <button
        disabled={busy}
        style={s.decisionButtonSecondary}
        onClick={() => goConfirmSecondary('owner_on_site')}
      >
        <span style={s.btnIcon}>🚗</span>
        {strings.actionOwnerOnSite}
      </button>
      {fmOnCall && (
        <button
          disabled={busy}
          style={s.decisionButtonSecondary}
          onClick={() => onDecide('escalate_fm', { overrideReason })}
        >
          <span style={s.btnIcon}>⬆</span>
          {strings.actionEscalateFm(fmOnCall.name)}
        </button>
      )}
      <button
        disabled={busy}
        style={s.decisionButtonSecondary}
        onClick={() => goConfirmSecondary('defer_morning')}
      >
        <span style={s.btnIcon}>🌙</span>
        {strings.actionDefer}
      </button>

      {/* forward */}
      <button
        disabled={busy || forwarding}
        style={s.decisionButtonSecondary}
        onClick={doForward}
      >
        <span style={s.btnIcon}>✉</span>
        {forwarding ? strings.forwardCreating : strings.actionForward}
      </button>
      {forwardUrl && (
        <div style={s.infoBanner}>
          <p style={{ margin: '0 0 6px' }}>{strings.forwardReady}</p>
          <div style={s.copyBox}>
            <input style={s.copyInput} readOnly value={forwardUrl} />
            <button
              style={s.copyBtn}
              onClick={() => {
                navigator.clipboard?.writeText(forwardUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? strings.forwardCopied : strings.forwardCopy}
            </button>
          </div>
          <p style={{ ...s.confNote, marginTop: '8px' }}>{strings.forwardExplain}</p>
        </div>
      )}

      {/* secondary confirm — reuses the same sheet for owner_on_site / defer */}
      {mode.startsWith('confirm2:') && (
        <SecondaryConfirm
          action={mode.slice('confirm2:'.length)}
          strings={strings}
          busy={busy}
          showOverridePicker={aiHasImpliedAction(urgencyKey) &&
            isOverrideOfAiSuggestion(urgencyKey, mode.slice('confirm2:'.length))}
          overrideReason={overrideReason}
          setOverrideReason={setOverrideReason}
          onConfirm={() => onDecide(mode.slice('confirm2:'.length), { overrideReason })}
          onCancel={() => setMode('choose')}
        />
      )}
    </Section>
  );

  function goConfirmSecondary(action) {
    setMode(`confirm2:${action}`);
  }
}

function SecondaryConfirm({
  action,
  strings,
  busy,
  showOverridePicker,
  overrideReason,
  setOverrideReason,
  onConfirm,
  onCancel,
}) {
  const title =
    action === 'owner_on_site' ? strings.actionOwnerOnSite : strings.actionDefer;
  return (
    <>
      <div style={s.confirmBackdrop} onClick={onCancel} />
      <div style={s.confirmSheet}>
        <p style={s.confirmTitle}>{title}?</p>
        {showOverridePicker && (
          <div style={{ margin: '10px 0 14px' }}>
            <p style={s.sectionSubtitle}>{strings.overridePrompt}</p>
            <select
              style={s.select}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            >
              <option value="">{strings.overrideNone}</option>
              {OVERRIDE_REASON_KEYS.map((k) => (
                <option key={k} value={k}>
                  {strings.overrideReasons[k]}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          disabled={busy}
          style={{ ...s.decisionButton, background: '#2563eb' }}
          onClick={onConfirm}
        >
          {strings.confirm}
        </button>
        <button disabled={busy} style={s.decisionButtonSecondary} onClick={onCancel}>
          {strings.cancel}
        </button>
      </div>
    </>
  );
}
