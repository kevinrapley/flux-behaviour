import { createValidationError, EVENT_VALIDATION_ERROR_CODES } from './event-validation-errors.mjs';
import { fluxEventSchema } from './flux-event-schema.mjs';
import { violatesEventPrivacy } from './event-privacy-policy.mjs';

export function validateEventRuntime(event, schema = fluxEventSchema) {
  const errors = [];

  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return {
      valid: false,
      errors: [createValidationError(EVENT_VALIDATION_ERROR_CODES.NOT_OBJECT, null, 'Event must be a JSON object.')]
    };
  }

  for (const field of schema.required ?? []) {
    if (!Object.hasOwn(event, field)) {
      errors.push(createValidationError(EVENT_VALIDATION_ERROR_CODES.MISSING_REQUIRED_FIELD, field, 'Required field is missing.'));
    }
  }

  if (schema.additionalProperties === false) {
    for (const field of Object.keys(event)) {
      if (!Object.hasOwn(schema.properties ?? {}, field)) {
        errors.push(createValidationError(EVENT_VALIDATION_ERROR_CODES.ADDITIONAL_PROPERTY, null, 'An additional field is not allowed by the event contract.'));
      }
    }
  }

  for (const [field, value] of Object.entries(event)) {
    const rules = schema.properties?.[field];
    if (!rules) continue;

    if (rules.type && !hasExpectedType(value, rules.type)) {
      errors.push(createValidationError(EVENT_VALIDATION_ERROR_CODES.INVALID_TYPE, field, 'Field has the wrong type.'));
    }

    if (Object.hasOwn(rules, 'const') && value !== rules.const) {
      errors.push(createValidationError(EVENT_VALIDATION_ERROR_CODES.INVALID_CONST, field, 'Field does not match the required constant.'));
    }

    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(createValidationError(EVENT_VALIDATION_ERROR_CODES.INVALID_ENUM, field, 'Field is not an allowed value.'));
    }

    if (rules.pattern && typeof value === 'string' && !(new RegExp(rules.pattern).test(value))) {
      errors.push(createValidationError(EVENT_VALIDATION_ERROR_CODES.PATTERN_MISMATCH, field, 'Field does not match the required pattern.'));
    }

    if (typeof value === 'string' && Object.hasOwn(rules, 'minLength') && value.length < rules.minLength) {
      errors.push(createValidationError(EVENT_VALIDATION_ERROR_CODES.TOO_SHORT, field, 'Field is shorter than allowed.'));
    }

    if (typeof value === 'string' && Object.hasOwn(rules, 'maxLength') && value.length > rules.maxLength) {
      errors.push(createValidationError(EVENT_VALIDATION_ERROR_CODES.TOO_LONG, field, 'Field is longer than allowed.'));
    }

    if (typeof value === 'number' && Object.hasOwn(rules, 'minimum') && value < rules.minimum) {
      errors.push(createValidationError(EVENT_VALIDATION_ERROR_CODES.BELOW_MINIMUM, field, 'Field is below the allowed minimum.'));
    }

    if (typeof value === 'number' && Object.hasOwn(rules, 'maximum') && value > rules.maximum) {
      errors.push(createValidationError(EVENT_VALIDATION_ERROR_CODES.ABOVE_MAXIMUM, field, 'Field is above the allowed maximum.'));
    }
  }

  if (violatesEventPrivacy(event)) {
    errors.push(createValidationError(
      EVENT_VALIDATION_ERROR_CODES.PRIVACY_POLICY,
      null,
      'Event violates the metadata-only privacy policy.'
    ));
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function hasExpectedType(value, expectedType) {
  if (expectedType === 'integer') return Number.isInteger(value);
  return typeof value === expectedType;
}
