/**
 * On-call cockpit copy. English-first (Ron, 2026-09-02 — German is added later
 * as a `de` key, same shape). The language is chosen by the CALL's language
 * (`incident` payload → future field), NOT a UI toggle: the on-call person is
 * not a logged-in user with a saved preference. Until the call carries a
 * language, everything is `en`.
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

const STRINGS = { en };

export function getStrings(lang) {
  return STRINGS[lang] || STRINGS.en;
}

export default STRINGS;
