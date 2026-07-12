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

export function isAuthOtpAction(action) {
  return typeof action === 'string' && AUTH_OTP_ACTION.test(action);
}

export function isNeutralAuthMilestone(event) {
  if (!isAuthOtpAction(event?.action)) return false;
  if (event.event_class !== 'trust' || event.role !== 'service' || event.element_key !== 'auth.otp') return false;

  const nestedMetadata = event.metadata;
  if (nestedMetadata && typeof nestedMetadata === 'object' && Object.keys(nestedMetadata).length > 0) return false;

  return !Object.keys(event).some((key) => key !== 'metadata' && !BASE_EVENT_KEYS.has(key));
}

export function violatesAuthMilestonePrivacy(event) {
  return isAuthOtpAction(event?.action) && !isNeutralAuthMilestone(event);
}
