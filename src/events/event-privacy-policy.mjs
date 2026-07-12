const BASE_EVENT_KEYS = new Set([
  'schema_version',
  'session_id',
  'visitor_id',
  'tenant_id',
  'consent',
  'origin',
  'event_class',
  'action',
  'role',
  'element_key',
  'timestamp_ms',
]);

const AUTH_OTP_ACTION = /^auth\.otp\.(requested|succeeded|failed)$/;
const WRITING_SIGNAL_KEYS = [
  'writing_language',
  'word_count',
  'spelling_issue_count',
  'grammar_issue_count',
  'uppercase_letter_count',
  'lowercase_letter_count',
  'all_caps_word_count',
];

export function isAuthOtpAction(action) {
  return typeof action === 'string' && AUTH_OTP_ACTION.test(action);
}

export function isAuthFormSubmit(event) {
  return event?.action === 'flow.submit' && /^form\.auth(?:[.:-]|$)/.test(event?.element_key ?? '');
}

export function isAuthScopedInteraction(event) {
  const key = String(event?.element_key ?? '').toLowerCase();
  return key !== 'auth.otp' && /(^|[.:-])auth(?=[.:-]|$)/.test(key);
}

export function isReservedAuthKeyMisuse(event) {
  return String(event?.element_key ?? '').toLowerCase() === 'auth.otp' && !isNeutralAuthMilestone(event);
}

export function isSensitiveAuthInteraction(event) {
  return isAuthScopedInteraction(event) || isReservedAuthKeyMisuse(event);
}

export function hasUnchangedFieldLength(event) {
  if (event?.action !== 'field.blur' || !Object.hasOwn(event, 'value_length')) return false;
  return !['key_press_count', 'edit_count', 'paste_count'].some((key) => Number.isInteger(event[key]) && event[key] > 0);
}

export function hasIncompleteWritingSignals(event) {
  const supplied = WRITING_SIGNAL_KEYS.filter((key) => Object.hasOwn(event ?? {}, key));
  return supplied.length > 0 && supplied.length !== WRITING_SIGNAL_KEYS.length;
}

export function isNeutralAuthMilestone(event) {
  if (!isAuthOtpAction(event?.action)) return false;
  if (event.event_class !== 'trust' || event.role !== 'service' || event.element_key !== 'auth.otp') return false;

  const nestedMetadata = event.metadata;
  if (nestedMetadata && typeof nestedMetadata === 'object' && Object.keys(nestedMetadata).length > 0) return false;

  return !Object.keys(event).some((key) => key !== 'metadata' && !BASE_EVENT_KEYS.has(key));
}

export function violatesEventPrivacy(event) {
  return (isAuthOtpAction(event?.action) && !isNeutralAuthMilestone(event))
    || isSensitiveAuthInteraction(event)
    || hasUnchangedFieldLength(event)
    || hasIncompleteWritingSignals(event);
}
