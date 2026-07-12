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
    'visitor_id',
    'tenant_id',
    'consent',
    'origin',
    'event_class',
    'action',
    'role',
    'element_key',
    'timestamp_ms'
  ],
  allOf: [{
    if: {
      properties: { action: { pattern: '^auth\\.otp\\.(requested|succeeded|failed)$' } },
      required: ['action']
    },
    then: {
      properties: {
        event_class: { const: 'trust' },
        role: { const: 'service' },
        element_key: { const: 'auth.otp' }
      },
      not: {
        anyOf: [
          'value_length', 'edit_count', 'duration_ms', 'dwell_before_input_ms',
          'typing_duration_ms', 'reason', 'navigation_direction',
          'pointer_type', 'file_count', 'file_size_bucket', 'key_press_count',
          'backspace_count', 'paste_count', 'chars_per_minute', 'revisit_count'
        ].map((field) => ({ required: [field] }))
      }
    }
  }, {
    if: {
      properties: { element_key: { pattern: '(^|[.:-])[Aa][Uu][Tt][Hh]([.:-]|$)' } },
      required: ['element_key']
    },
    then: {
      properties: {
        event_class: { const: 'trust' },
        action: { pattern: '^auth\\.otp\\.(requested|succeeded|failed)$' },
        role: { const: 'service' },
        element_key: { const: 'auth.otp' }
      },
      not: {
        anyOf: [
          'value_length', 'edit_count', 'duration_ms', 'dwell_before_input_ms',
          'typing_duration_ms', 'reason', 'navigation_direction',
          'pointer_type', 'file_count', 'file_size_bucket', 'key_press_count',
          'backspace_count', 'paste_count', 'chars_per_minute', 'revisit_count'
        ].map((field) => ({ required: [field] }))
      }
    }
  }, {
    if: {
      properties: { element_key: { pattern: '^[Aa][Uu][Tt][Hh]\\.[Oo][Tt][Pp]$' } },
      required: ['element_key']
    },
    then: {
      properties: {
        event_class: { const: 'trust' },
        action: { pattern: '^auth\\.otp\\.(requested|succeeded|failed)$' },
        role: { const: 'service' },
        element_key: { const: 'auth.otp' }
      },
      not: {
        anyOf: [
          'value_length', 'edit_count', 'duration_ms', 'dwell_before_input_ms',
          'typing_duration_ms', 'reason', 'navigation_direction',
          'pointer_type', 'file_count', 'file_size_bucket', 'key_press_count',
          'backspace_count', 'paste_count', 'chars_per_minute', 'revisit_count'
        ].map((field) => ({ required: [field] }))
      }
    }
  }, {
    if: {
      properties: { action: { const: 'field.blur' } },
      required: ['action', 'value_length']
    },
    then: {
      anyOf: [
        { properties: { key_press_count: { minimum: 1 } }, required: ['key_press_count'] },
        { properties: { edit_count: { minimum: 1 } }, required: ['edit_count'] },
        { properties: { paste_count: { minimum: 1 } }, required: ['paste_count'] }
      ]
    }
  }],
  properties: {
    schema_version: {
      type: 'string',
      const: '1.1.0'
    },
    session_id: {
      type: 'string',
      minLength: 8,
      maxLength: 128,
      pattern: '^[A-Za-z0-9._:-]+$'
    },
    visitor_id: {
      type: 'string',
      minLength: 8,
      maxLength: 128,
      pattern: '^[A-Za-z0-9._:-]+$'
    },
    tenant_id: {
      type: 'string',
      minLength: 2,
      maxLength: 80,
      pattern: '^[a-z][a-z0-9-]*$'
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
    dwell_before_input_ms: {
      type: 'integer',
      minimum: 0,
      maximum: 3600000
    },
    typing_duration_ms: {
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
    },
    key_press_count: {
      type: 'integer',
      minimum: 0,
      maximum: 10000
    },
    backspace_count: {
      type: 'integer',
      minimum: 0,
      maximum: 10000
    },
    paste_count: {
      type: 'integer',
      minimum: 0,
      maximum: 100
    },
    chars_per_minute: {
      type: 'integer',
      minimum: 0,
      maximum: 2000
    },
    revisit_count: {
      type: 'integer',
      minimum: 0,
      maximum: 1000
    }
  }
});
