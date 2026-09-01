/**
 * Per-carrier call-forwarding instructions for German mobile + landline carriers.
 * Shown to customers using the BYO-forward model (spec §4.1 model B).
 *
 * We recommend CONDITIONAL forwarding (on no-answer / on busy / time-based)
 * so the customer's daytime setup is untouched and only unanswered
 * after-hours calls reach After Hour.
 *
 * GSM codes below are the standard MMI codes and work on most German
 * networks for mobile lines. Landline (Telekom, Vodafone Kabel) forwarding
 * is configured in the provider's web portal / phone menu — codes vary by
 * router, so we link to the portal rather than give a code.
 *
 * `{FORWARD_TO}` is replaced client-side with the customer's provisioned
 * forward-target DID.
 */

const GSM_NOTE_DE =
  'Codes vom Mobiltelefon aus wählen. **`*61*{FORWARD_TO}#`** leitet nur unbeantwortete Anrufe weiter (empfohlen). **`*67*{FORWARD_TO}#`** bei besetzt. **`##002#`** löscht alle Weiterleitungen.';
const GSM_NOTE_EN =
  'Dial these from the mobile handset. **`*61*{FORWARD_TO}#`** forwards only unanswered calls (recommended). **`*67*{FORWARD_TO}#`** forwards on busy. **`##002#`** clears all forwarding.';

export const CARRIER_FORWARDING = {
  de: [
    {
      id: 'telekom_mobile',
      name: 'Telekom (Mobilfunk)',
      steps: [
        'Am Handy die Kurzwahl wählen: `*61*{FORWARD_TO}#` und Anruf-Taste drücken.',
        'Alternativ in der MeinMagenta App: Einstellungen → Rufumleitung → „Bei Nichtannahme" → Zielrufnummer {FORWARD_TO}.',
        'Verzögerung auf 15–20 Sekunden stellen, damit das Büro zuerst klingelt.',
      ],
      note: GSM_NOTE_DE,
    },
    {
      id: 'vodafone_mobile',
      name: 'Vodafone (Mobilfunk)',
      steps: [
        'Am Handy wählen: `*61*{FORWARD_TO}#` (Weiterleitung bei Nichtannahme).',
        'Oder MeinVodafone App: Services → Rufumleitung → „Wenn ich nicht rangehe" → {FORWARD_TO}.',
      ],
      note: GSM_NOTE_DE,
    },
    {
      id: 'o2_mobile',
      name: 'o2 / Telefónica (Mobilfunk)',
      steps: [
        'Am Handy wählen: `*61*{FORWARD_TO}#`.',
        'Oder Mein o2 App: Mein o2 → Einstellungen → Rufumleitung → „Verzögert" → {FORWARD_TO}.',
      ],
      note: GSM_NOTE_DE,
    },
    {
      id: 'telekom_festnetz',
      name: 'Telekom (Festnetz)',
      steps: [
        'Am Telefon wählen: `*61*{FORWARD_TO}#` und auflegen (funktioniert bei den meisten Anschlüssen).',
        'Oder im Telekom Kundencenter (kundencenter.telekom.de) → Festnetz → Rufumleitung → „bei Nichtmelden" → {FORWARD_TO}.',
        'Bei einer FRITZ!Box: Telefonie → Rufbehandlung → Rufumleitung → Neue Rufumleitung → „wenn nach ... Sekunden nicht rangegangen".',
      ],
      note: 'Bei Festnetz-Anschlüssen über Router (VoIP) wird die Weiterleitung meist im Router eingerichtet, nicht per Code.',
    },
    {
      id: 'vodafone_festnetz',
      name: 'Vodafone (Festnetz / Kabel)',
      steps: [
        'Im MeinVodafone Kundenportal → Festnetz → Anrufeinstellungen → Rufumleitung → „bei Nichtannahme" → {FORWARD_TO}.',
        'Bei einer Vodafone Station: Telefonie → Rufumleitung → verzögert → {FORWARD_TO}.',
      ],
      note: null,
    },
    {
      id: 'sipgate_placetel_other',
      name: 'sipgate / Placetel / andere VoIP-Anbieter',
      steps: [
        'Im Web-Konto des Anbieters die Rufumleitung / „Call Forwarding" öffnen.',
        '„Bei Nichterreichbarkeit" oder „nach X Sekunden" auf {FORWARD_TO} setzen.',
        'Optional: zeitgesteuerte Weiterleitung nur für die Nachtstunden (18:00–07:00) einrichten.',
      ],
      note: null,
    },
  ],
  en: [
    {
      id: 'telekom_mobile',
      name: 'Telekom (mobile)',
      steps: [
        'From the handset dial: `*61*{FORWARD_TO}#` then press call.',
        'Or in the MeinMagenta app: Settings → Call forwarding → "When not answered" → target number {FORWARD_TO}.',
        'Set the delay to 15–20 seconds so the office rings first.',
      ],
      note: GSM_NOTE_EN,
    },
    {
      id: 'vodafone_mobile',
      name: 'Vodafone (mobile)',
      steps: [
        'From the handset dial: `*61*{FORWARD_TO}#` (forward on no-answer).',
        'Or MeinVodafone app: Services → Call forwarding → "When I don\'t answer" → {FORWARD_TO}.',
      ],
      note: GSM_NOTE_EN,
    },
    {
      id: 'o2_mobile',
      name: 'o2 / Telefónica (mobile)',
      steps: [
        'From the handset dial: `*61*{FORWARD_TO}#`.',
        'Or Mein o2 app: My o2 → Settings → Call forwarding → "Delayed" → {FORWARD_TO}.',
      ],
      note: GSM_NOTE_EN,
    },
    {
      id: 'telekom_festnetz',
      name: 'Telekom (landline)',
      steps: [
        'From the phone dial: `*61*{FORWARD_TO}#` and hang up (works on most lines).',
        'Or in the Telekom Kundencenter → Landline → Call forwarding → "on no-answer" → {FORWARD_TO}.',
        'On a FRITZ!Box: Telephony → Call handling → Call diversion → New → "if not answered after ... seconds".',
      ],
      note: 'Router-based (VoIP) landlines usually configure forwarding in the router, not via a dial code.',
    },
    {
      id: 'vodafone_festnetz',
      name: 'Vodafone (landline / cable)',
      steps: [
        'In the MeinVodafone portal → Landline → Call settings → Call forwarding → "on no-answer" → {FORWARD_TO}.',
        'On a Vodafone Station: Telephony → Call forwarding → delayed → {FORWARD_TO}.',
      ],
      note: null,
    },
    {
      id: 'sipgate_placetel_other',
      name: 'sipgate / Placetel / other VoIP providers',
      steps: [
        'Open call forwarding in the provider\'s web account.',
        'Set "on unavailable" / "after X seconds" to {FORWARD_TO}.',
        'Optional: time-based forwarding for night hours only (18:00–07:00).',
      ],
      note: null,
    },
  ],
};

export default CARRIER_FORWARDING;
