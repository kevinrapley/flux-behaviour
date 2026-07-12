import { readFileSync } from 'node:fs';
import { createValidationError, EVENT_VALIDATION_ERROR_CODES } from './event-validation-errors.mjs';
import { violatesAuthMilestonePrivacy } from './event-privacy-policy.mjs';

const DEFAULT_SCHEMA_PATH = 'contracts/events/flux-event.schema.json';

export function loadEventSchema(schemaPath = DEFAULT_SCHEMA_PATH) {
  return JSON.parse(readFileSync(schemaPath, 'utf8'));
}

export function validateEvent(event, schema = loadEventSchema()) {
  const errors = [];

  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return {
      valid: false,
      errors: [createValidationError(
        EVENT_VALIDATION_ERROR_CODES.NOT_OBJECT,
        null,
        'Event must be a JSON object.'
      )]
    };
  }

  for (const field of schema.required ?? []) {
    if (!Object.hasOwn(event, field)) {
      errors.push(createValidationError(
        EVENT_VALIDATION_ERROR_CODES.MISSING_REQUIRED_FIELD,
        field,
        'Required field is missing.'
      ));
    }
  }

  if (schema.additionalProperties === false) {
    for (const field of Object.keys(event)) {
      if (!Object.hasOwn(schema.properties ?? {}, field)) {
        errors.push(createValidationError(
          EVENT_VALIDATION_ERROR_CODES.ADDITIONAL_PROPERTY,
          null,
          'An additional field is not allowed by the event contract.'
        ));
      }
    }
  }

  for (const [field, value] of Object.entries(event)) {
    const rules = schema.properties?.[field];
    if (!rules) continue;

    validateType(errors, field, value, rules);
    validateConst(errors, field, value, rules);
    validateEnum(errors, field, value, rules);
    validatePattern(errors, field, value, rules);
    validateLength(errors, field, value, rules);
    validateNumericBounds(errors, field, value, rules);
  }

  if (violatesAuthMilestonePrivacy(event)) {
    errors.push(createValidationError(
      EVENT_VALIDATION_ERROR_CODES.PRIVACY_POLICY,
      null,
      'Authentication milestones must use the neutral event shape without optional metadata.'
    ));
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateType(errors, field, value, rules) {
  if (!rules.type) return;

  const valid = rules.type === 'integer'
    ? Number.isInteger(value)
    : typeof value === rules.type;

  if (!valid) {
    errors.push(createValidationError(
      EVENT_VALIDATION_ERROR_CODES.INVALID_TYPE,
      field,
      'Field has the wrong type.'
    ));
  }
}

function validateConst(errors, field, value, rules) {
  if (!Object.hasOwn(rules, 'const')) return;

  if (value !== rules.const) {
    errors.push(createValidationError(
      EVENT_VALIDATION_ERROR_CODES.INVALID_CONST,
      field,
      'Field does not match the required constant.'
    ));
  }
}

function validateEnum(errors, field, value, rules) {
  if (!rules.enum) return;

  if (!rules.enum.includes(value)) {
    errors.push(createValidationError(
      EVENT_VALIDATION_ERROR_CODES.INVALID_ENUM,
      field,
      'Field is not an allowed value.'
    ));
  }
}

function validatePattern(errors, field, value, rules) {
  if (!rules.pattern || typeof value !== 'string') return;

  if (!(new RegExp(rules.pattern).test(value))) {
    errors.push(createValidationError(
      EVENT_VALIDATION_ERROR_CODES.PATTERN_MISMATCH,
      field,
      'Field does not match the required pattern.'
    ));
  }
}

function validateLength(errors, field, value, rules) {
  if (typeof value !== 'string') return;

  if (Object.hasOwn(rules, 'minLength') && value.length < rules.minLength) {
    errors.push(createValidationError(
      EVENT_VALIDATION_ERROR_CODES.TOO_SHORT,
      field,
      'Field is shorter than allowed.'
    ));
  }

  if (Object.hasOwn(rules, 'maxLength') && value.length > rules.maxLength) {
    errors.push(createValidationError(
      EVENT_VALIDATION_ERROR_CODES.TOO_LONG,
      field,
      'Field is longer than allowed.'
    ));
  }
}

function validateNumericBounds(errors, field, value, rules) {
  if (typeof value !== 'number') return;

  if (Object.hasOwn(rules, 'minimum') && value < rules.minimum) {
    errors.push(createValidationError(
      EVENT_VALIDATION_ERROR_CODES.BELOW_MINIMUM,
      field,
      'Field is below the allowed minimum.'
    ));
  }

  if (Object.hasOwn(rules, 'maximum') && value > rules.maximum) {
    errors.push(createValidationError(
      EVENT_VALIDATION_ERROR_CODES.ABOVE_MAXIMUM,
      field,
      'Field is above the allowed maximum.'
    ));
  }
}
