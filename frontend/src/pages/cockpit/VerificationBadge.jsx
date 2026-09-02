import { s } from './cockpitStyles';

/**
 * Whether the caller was matched to a tenant on file. Central to trust —
 * an unverified caller on an emergency dispatch is a risk the on-call person
 * must see, not something buried in the AI's prose.
 */
export function VerificationBadge({ verificationStatus, caller, strings }) {
  const name = caller?.name || caller?.nameGiven;
  const mismatch =
    caller?.nameGiven &&
    caller?.nameOnFile &&
    caller.nameGiven.trim().toLowerCase() !== caller.nameOnFile.trim().toLowerCase();

  if (mismatch) {
    return (
      <span style={{ ...s.vbadge, ...s.vbadgeWarn }}>
        ⚠ {strings.nameMismatch(caller.nameGiven, caller.nameOnFile)}
      </span>
    );
  }

  if (verificationStatus === 'verified') {
    return <span style={{ ...s.vbadge, ...s.vbadgeOk }}>✓ {strings.verifiedCaller(name)}</span>;
  }
  if (verificationStatus === 'partial_match') {
    return <span style={{ ...s.vbadge, ...s.vbadgeWarn }}>⚠ {strings.partialMatchCaller(name)}</span>;
  }
  return <span style={{ ...s.vbadge, ...s.vbadgeWarn }}>⚠ {strings.unverifiedCaller}</span>;
}
