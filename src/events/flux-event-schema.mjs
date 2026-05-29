export const fluxEventSchema = Object.freeze({
  '$schema': 'https://json-schema.org/draft/2020-12/schema',
  '$id': 'https://kevinrapley.github.io/flux-behaviour/contracts/events/flux-event.schema.json',
  title: 'Flux Behaviour event',
  description: 'Metadata-only event contract for consented Flux Behaviour instrumentation.',
  type: 'object',
  additionalProperties: false,
  required: [
    'schema_version',
    'session_id',
    'consent',
    'origin',
    'event_class',
    'action',
    'role',
    'element_key',
    'timestamp_ms'
  ],
  properties: {
    schema_version: {
      type: 'string',
      const: '1.0.0'
    },
    session_id: {
      type: 'string',
      minLength: 8,
      maxLength: 128,
      pattern: '^[A-Za-z0-9._:-]+$'
    },
    consent: {
      type: 'string',
      const: 'yes'
    },
    origin: {
      type: 'string',
      enum: ['formkit', 'sdk', 'collector-test']
    },
    event_class: {
      type: 'string',
      enum: ['focus', 'input', 'nav', 'kbd', 'clipboard', 'drop', 'file', 'picker', 'trust', 'assist', 'a11y', 'env']
    },
    action: {
      type: 'string',
      minLength: 3,
      maxLength: 80,
      pattern: '^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$'
    },
    role: {
      type: 'string',
      enum: ['field', 'form', 'control', 'page', 'service', 'environment']
    },
    element_key: {
      type: 'string',
      minLength: 1,
      maxLength: 120,
      pattern: '^[A-Za-z0-9._:-]+$'
    },
    timestamp_ms: {
      type: 'integer',
      minimum: 0
    },
    value_length: {
      type: 'integer',
      minimum: 0,
      maximum: 10000
    },
    edit_count: {
      type: 'integer',
      minimum: 0,
      maximum: 10000
    },
    duration_ms: {
      type: 'integer',
      minimum: 0,
      maximum: 3600000
    },
    reason: {
      type: 'string',
      enum: ['empty_field', 'control_nonresponsive', 'validation_error', 'help_requested', 'unknown']
    },
    navigation_direction: {
      type: 'string',
      enum: ['forward', 'back', 'skip', 'unknown']
    },
    pointer_type: {
      type: 'string',
      enum: ['mouse', 'pen', 'touch', 'keyboard', 'unknown']
    },
    file_count: {
      type: 'integer',
      minimum: 0,
      maximum: 100
    },
    file_size_bucket: {
      type: 'string',
      enum: ['none', 'small', 'medium', 'large', 'unknown']
    }
  }
});
