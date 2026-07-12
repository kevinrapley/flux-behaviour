export const EVENT_VALIDATION_ERROR_CODES = Object.freeze({
  NOT_OBJECT: 'not_object',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  ADDITIONAL_PROPERTY: 'additional_property',
  INVALID_TYPE: 'invalid_type',
  INVALID_CONST: 'invalid_const',
  INVALID_ENUM: 'invalid_enum',
  PATTERN_MISMATCH: 'pattern_mismatch',
  TOO_SHORT: 'too_short',
  TOO_LONG: 'too_long',
  BELOW_MINIMUM: 'below_minimum',
  ABOVE_MAXIMUM: 'above_maximum',
  PRIVACY_POLICY: 'privacy_policy'
});

export function createValidationError(code, field, message) {
  return {
    code,
    field,
    message
  };
}
