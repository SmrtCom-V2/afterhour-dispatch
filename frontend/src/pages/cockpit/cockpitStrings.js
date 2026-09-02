/**
 * On-call cockpit copy. The language is chosen by the CALL's language
 * (`incident.callLanguage` in the payload), NOT a UI toggle: the on-call
 * person is not a logged-in user with a saved preference. Falls back to `en`.
 *
 * `de` mirrors `en` key-for-key (getStrings throws in dev if a key is missing).
 * German terminology reuses the vetted 3am wording from the original cockpit
 * and the app's LanguageContext (NOTFALL / Dienstleister / Gewerk / Mieter).
 */

const en = {
  // loading / errors
  loading: 'Loading…',
  linkExpired: 'This link has expired.',
  incidentNotFound: 'Incident not found.',
  connectionFailed: 'Connection failed.',

  // Zone 1 — verdict
  badgeEmergency: 'EMERGENCY',
  badgeUrgent: 'URGENT',
  badgeUnsure: 'AI UNSURE — YOUR CALL',
  badgeNotUrgent: 'NOT URGENT',
  recommendSendCompany: 'Recommended: send a service provider now',
  recommendDefer: 'Recommended: this can wait until morning',
  recommendReadAndDecide: 'Read the call below and decide',
  autoDispatchIn: 'Auto-dispatch in',
  autoDispatchImminent: 'Auto-dispatch imminent',
  autoDispatchExplain:
    'If nobody decides, the system automatically sends a service provider 10 minutes after the call.',

  // Zone 2 — the 20-second read
  aiCouldNotJudge: 'The AI could not judge how urgent this is.',
  aiCouldNotJudgeSub: 'Read the call below and make the decision yourself.',
  aiThinksEmergency: 'AI read: this is an emergency',
  aiThinksNotEmergency: 'AI read: not an emergency',
  aiConfidenceInProblem: (n) => `AI is ${n}% confident it understood the problem correctly`,
  aiLowConfidence: '— low confidence, read the transcript',
  whatCallerReported: 'What the caller reported',
  whatsUnusual: "What's worth knowing",
  recurringIssue: (n, cat) => `${ordinal(n)} ${cat} issue at this building in the last 30 days`,
  recurringAny: (n) => `${n} other incident${n === 1 ? '' : 's'} at this building in the last 30 days`,
  codesAttached: 'Building access codes are attached below',
  callDegraded: 'A technical issue during the call means some details may be incomplete',

  // verification
  verifiedCaller: (name) => `Caller verified${name ? `: ${name}` : ''}`,
  partialMatchCaller: (name) => `Partial identity match${name ? `: ${name}` : ''}`,
  unverifiedCaller: 'Caller identity not confirmed',
  nameMismatch: (given, onFile) => `Caller said "${given}" — number on file belongs to ${onFile}`,

  // Zone 3 — detail
  detailToggleShow: 'Show full call detail',
  detailToggleHide: 'Hide call detail',
  callSummary: 'Call summary',
  questionsAsked: 'What the AI asked',
  fullTranscript: 'Full transcript',
  where: 'Where',
  property: 'Property',
  address: 'Address',
  callTenant: (name) => `Call the tenant${name ? ` (${name})` : ''}`,
  janitor: 'Janitor',
  history: 'History at this property',
  contactedSoFar: 'Contacted so far',
  noHistory: 'No previous incidents at this property.',
  outcomeLabel: {
    dispatched: 'service provider sent',
    dispatched_manual: 'service provider sent (called directly)',
    owner_on_site: 'handled on site',
    deferred_morning: 'left for the morning',
    escalated_to_fm: 'escalated to FM',
    stabilized_pending_repair: 'stabilized, repair to follow',
    resolved_night: 'resolved that night',
    callback_pending: 'callback in progress',
  },

  // access grid
  waterShutoff: 'Water shut-off',
  gasShutoff: 'Gas shut-off',
  electricShutoff: 'Electric panel',
  keySafe: 'Key safe',
  gateCode: 'Gate code',
  entranceCode: 'Entrance code',

  // Zone 4 — decide
  decide: 'Decide',
  overridePrompt:
    "Does your decision differ from the AI's read? Optionally say why (helps improve the AI):",
  overrideNone: '— no reason given —',
  overrideReasons: {
    ai_missed_a_fact: 'AI missed a fact',
    ai_misjudged_severity: 'AI misjudged how urgent it was',
    caller_gave_more_info_after_call: 'Caller gave more info after the call',
    tier_right_tone_off: 'Assessment was right, tone was off',
    other: 'Other',
  },
  actionSendCompany: 'Send a service provider',
  actionCallTenant: 'Call the tenant back first',
  actionOwnerOnSite: "I'll handle it myself",
  actionEscalateFm: (name) => `Escalate to ${name || 'FM on-call'}`,
  actionDefer: 'Not urgent — leave until morning',
  actionForward: 'Forward a safe brief (no access codes)',

  // SP picker
  pickProvider: 'Which service provider?',
  suggestedTag: 'Suggested',
  rankTag: (n) => (n === 1 ? "Building's 1st choice" : `Building's choice #${n}`),
  open24h: '24/7',
  openNow: 'Open now',
  closedNow: (from, to) => `Closed now · ${from}–${to}`,
  systemCallsThem: 'System calls them',
  illCallThem: "I'll call them myself",
  noProviderForTrade: 'No service provider on file for this trade.',

  // confirm
  confirmSendTitle: (co) => `Send ${co} now?`,
  confirmManualTitle: (co) => `Mark ${co} as dispatched?`,
  confirmManualBody: "You're calling them yourself. They'll get the report link and the “no report = no payment” reminder.",
  confirm: 'Confirm',
  back: 'Back',
  cancel: 'Cancel',

  // callback holding state
  callbackRecorded: 'Callback logged. Call the tenant, then come back and decide.',
  callbackCountNote: (n) => `You've logged ${n} callback${n === 1 ? '' : 's'} on this incident.`,
  stillNeedToDecide: 'You still need to make a decision — the auto-dispatch clock is running.',

  // forward
  forwardCreating: 'Creating link…',
  forwardReady: 'Safe brief link ready — copy and send it:',
  forwardCopy: 'Copy link',
  forwardCopied: 'Copied',
  forwardExplain: 'This link shows the brief and transcript only. No access codes.',

  // Zone 5 — after action
  decisionMade: 'Decision made',
  decidedBy: (name) => `Handled by ${name}.`,
  decidedByUnknown: 'Already handled.',
  result: 'Result',
  recordNightResult: 'Record how the night ended:',
  noteOptional: 'Note (optional)',
  outcomeStabilized: 'Stabilized — repair tomorrow',
  outcomeResolved: 'Fully resolved tonight',
  alreadyDecidedBy: (name, outcome) =>
    `${name ? `${name} already decided` : 'Already decided'}: ${outcome}.`,

  // errors on action
  actionFailed: 'That did not go through. Try again.',
  noFmConfigured: 'No FM on-call number is configured for this client. Use another option or call your manager directly.',
};

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// German. Reuses the vetted terms: NOTFALL, DRINGEND, NICHT DRINGEND,
// Dienstleister, Gewerk, Mieter, Hausmeister, Zugangscodes.
const de = {
  loading: 'Lädt…',
  linkExpired: 'Dieser Link ist abgelaufen.',
  incidentNotFound: 'Vorfall nicht gefunden.',
  connectionFailed: 'Verbindung fehlgeschlagen.',

  badgeEmergency: 'NOTFALL',
  badgeUrgent: 'DRINGEND',
  badgeUnsure: 'AI UNSICHER — DEINE EINSCHÄTZUNG',
  badgeNotUrgent: 'NICHT DRINGEND',
  recommendSendCompany: 'Empfehlung: Dienstleister jetzt schicken',
  recommendDefer: 'Empfehlung: kann bis morgen warten',
  recommendReadAndDecide: 'Gesprächsverlauf unten lesen und entscheiden',
  autoDispatchIn: 'Automatischer Einsatz in',
  autoDispatchImminent: 'Automatischer Einsatz steht unmittelbar bevor',
  autoDispatchExplain:
    'Wenn niemand entscheidet, schickt das System 10 Minuten nach dem Anruf automatisch einen Dienstleister.',

  aiCouldNotJudge: 'Die AI konnte die Dringlichkeit nicht einschätzen.',
  aiCouldNotJudgeSub: 'Bitte den Gesprächsverlauf unten lesen und selbst entscheiden.',
  aiThinksEmergency: 'AI-Einschätzung: Notfall',
  aiThinksNotEmergency: 'AI-Einschätzung: kein Notfall',
  aiConfidenceInProblem: (n) => `AI ist zu ${n}% sicher, das Problem richtig verstanden zu haben`,
  aiLowConfidence: '— geringe Sicherheit, Gesprächsverlauf lesen',
  whatCallerReported: 'Was der Anrufer gemeldet hat',
  whatsUnusual: 'Was du wissen solltest',
  recurringIssue: (n, cat) => `${ordinalDe(n)} ${cat}-Vorfall an diesem Objekt in den letzten 30 Tagen`,
  recurringAny: (n) => `${n} weitere${n === 1 ? 'r' : ''} Vorfall${n === 1 ? '' : 'e'} an diesem Objekt in den letzten 30 Tagen`,
  codesAttached: 'Zugangscodes des Gebäudes sind unten hinterlegt',
  callDegraded: 'Wegen einer technischen Störung im Anruf können einige Angaben unvollständig sein',

  verifiedCaller: (name) => `Anrufer verifiziert${name ? `: ${name}` : ''}`,
  partialMatchCaller: (name) => `Identität teilweise bestätigt${name ? `: ${name}` : ''}`,
  unverifiedCaller: 'Identität des Anrufers nicht bestätigt',
  nameMismatch: (given, onFile) => `Anrufer nannte „${given}" — hinterlegte Nummer gehört zu ${onFile}`,

  detailToggleShow: 'Gesamten Anruf anzeigen',
  detailToggleHide: 'Anrufdetails ausblenden',
  callSummary: 'Zusammenfassung des Anrufs',
  questionsAsked: 'Was die AI gefragt hat',
  fullTranscript: 'Vollständiger Gesprächsverlauf',
  where: 'Wo',
  property: 'Objekt',
  address: 'Adresse',
  callTenant: (name) => `Mieter anrufen${name ? ` (${name})` : ''}`,
  janitor: 'Hausmeister',
  history: 'Verlauf an diesem Objekt',
  contactedSoFar: 'Bereits kontaktiert',
  noHistory: 'Keine früheren Vorfälle an diesem Objekt.',
  outcomeLabel: {
    dispatched: 'Dienstleister geschickt',
    dispatched_manual: 'Dienstleister geschickt (direkt angerufen)',
    owner_on_site: 'vor Ort erledigt',
    deferred_morning: 'auf morgen verschoben',
    escalated_to_fm: 'an FM eskaliert',
    stabilized_pending_repair: 'stabilisiert, Reparatur folgt',
    resolved_night: 'in der Nacht gelöst',
    callback_pending: 'Rückruf läuft',
  },

  waterShutoff: 'Wasserhaupthahn',
  gasShutoff: 'Gashaupthahn',
  electricShutoff: 'Stromkasten',
  keySafe: 'Schlüsseltresor',
  gateCode: 'Hoftor-Code',
  entranceCode: 'Hauseingang-Code',

  decide: 'Entscheidung',
  overridePrompt:
    'Weicht deine Entscheidung von der AI-Einschätzung ab? Grund optional angeben (hilft, die AI zu verbessern):',
  overrideNone: '— kein Grund angegeben —',
  overrideReasons: {
    ai_missed_a_fact: 'AI hat eine Tatsache übersehen',
    ai_misjudged_severity: 'AI hat die Dringlichkeit falsch eingeschätzt',
    caller_gave_more_info_after_call: 'Anrufer gab nach dem Anruf mehr Infos',
    tier_right_tone_off: 'Einschätzung war richtig, Tonfall daneben',
    other: 'Sonstiges',
  },
  actionSendCompany: 'Dienstleister schicken',
  actionCallTenant: 'Zuerst den Mieter zurückrufen',
  actionOwnerOnSite: 'Ich kümmere mich selbst darum',
  actionEscalateFm: (name) => `An ${name || 'FM-Bereitschaft'} eskalieren`,
  actionDefer: 'Nicht dringend — kann bis morgen warten',
  actionForward: 'Sichere Zusammenfassung weiterleiten (ohne Zugangscodes)',

  pickProvider: 'Welcher Dienstleister?',
  suggestedTag: 'Empfohlen',
  rankTag: (n) => (n === 1 ? '1. Wahl des Objekts' : `${n}. Wahl des Objekts`),
  open24h: '24/7',
  openNow: 'Jetzt erreichbar',
  closedNow: (from, to) => `Jetzt geschlossen · ${from}–${to}`,
  systemCallsThem: 'System ruft an',
  illCallThem: 'Ich rufe selbst an',
  noProviderForTrade: 'Kein Dienstleister für dieses Gewerk hinterlegt.',

  confirmSendTitle: (co) => `${co} jetzt anrufen?`,
  confirmManualTitle: (co) => `${co} als beauftragt markieren?`,
  confirmManualBody:
    'Du rufst selbst an. Der Dienstleister erhält den Berichts-Link und den Hinweis „kein Bericht = keine Zahlung".',
  confirm: 'Bestätigen',
  back: 'Zurück',
  cancel: 'Abbrechen',

  callbackRecorded: 'Rückruf notiert. Ruf den Mieter an und entscheide dann.',
  callbackCountNote: (n) => `Du hast ${n} Rückruf${n === 1 ? '' : 'e'} zu diesem Vorfall notiert.`,
  stillNeedToDecide: 'Du musst noch entscheiden — die Uhr für den automatischen Einsatz läuft.',

  forwardCreating: 'Link wird erstellt…',
  forwardReady: 'Link zur sicheren Zusammenfassung ist bereit — kopieren und senden:',
  forwardCopy: 'Link kopieren',
  forwardCopied: 'Kopiert',
  forwardExplain: 'Dieser Link zeigt nur die Zusammenfassung und den Gesprächsverlauf. Keine Zugangscodes.',

  decisionMade: 'Entscheidung getroffen',
  decidedBy: (name) => `Bearbeitet von ${name}.`,
  decidedByUnknown: 'Bereits bearbeitet.',
  result: 'Ergebnis',
  recordNightResult: 'Festhalten, wie die Nacht ausging:',
  noteOptional: 'Notiz (optional)',
  outcomeStabilized: 'Stabilisiert — Reparatur morgen',
  outcomeResolved: 'Heute Nacht vollständig gelöst',
  alreadyDecidedBy: (name, outcome) =>
    `${name ? `${name} hat bereits entschieden` : 'Bereits entschieden'}: ${outcome}.`,

  actionFailed: 'Das hat nicht geklappt. Bitte erneut versuchen.',
  noFmConfigured:
    'Für diesen Kunden ist keine FM-Bereitschaftsnummer hinterlegt. Nutze eine andere Option oder ruf deinen Verantwortlichen direkt an.',
};

function ordinalDe(n) {
  return `${n}.`;
}

en.lang = 'en';
de.lang = 'de';

const STRINGS = { en, de };

/**
 * Shallow key-parity check between locales — a missing translation key would
 * otherwise surface as `undefined` in the 3am UI. Returns the missing keys
 * per locale (empty object = all good). Used by the test and by getStrings
 * in dev.
 */
export function missingKeys() {
  const base = Object.keys(en);
  const out = {};
  for (const [lang, obj] of Object.entries(STRINGS)) {
    if (lang === 'en') continue;
    const miss = base.filter((k) => !(k in obj));
    if (miss.length) out[lang] = miss;
  }
  return out;
}

let devChecked = false;
export function getStrings(lang) {
  const picked = STRINGS[lang] || STRINGS.en;
  // Dev-only, once: warn if a non-en locale is missing keys. Wrapped in a
  // try so a non-Vite runtime (node --test) doesn't choke on import.meta.
  if (!devChecked) {
    devChecked = true;
    try {
      if (import.meta.env.DEV) {
        const miss = missingKeys();
        for (const [l, keys] of Object.entries(miss)) {
          console.warn(`[cockpitStrings] ${l} missing keys:`, keys);
        }
      }
    } catch {
      /* not a Vite build — skip */
    }
  }
  return picked;
}

export default STRINGS;
