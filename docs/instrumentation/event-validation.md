# Event validation module

Status: runtime-neutral validation module. This is not a collector, SDK or storage implementation.

## Purpose

The event validation module provides a reusable validation gate for Flux Behaviour events before collector or SDK code exists.

It validates an event object against `contracts/events/flux-event.schema.json` and returns structured validation results.

## Module paths

- `src/events/validate-event.mjs`
- `src/events/event-validation-errors.mjs`
- `src/events/index.mjs`

## Public functions

### `loadEventSchema(schemaPath)`

Loads the event schema from disk.

The default path is `contracts/events/flux-event.schema.json`.

### `validateEvent(event, schema)`

Validates an event object.

Returns:

```js
{
  valid: false,
  errors: [
    {
      code: 'additional_property',
      field: null,
      message: 'An additional field is not allowed by the event contract.'
    }
  ]
}
```

## Error rules

Validation errors must not echo submitted values.

Errors may include:

- rule code;
- safe schema field name for known schema fields;
- safe message.

Errors must not include:

- typed field content;
- clipboard content;
- file names;
- passwords;
- free-text values;
- raw event payloads;
- untrusted additional-property names.

Additional-property errors use `field: null` because the submitted property name is untrusted input.

## Current validation coverage

The module checks:

- event is a JSON object;
- required fields;
- additional properties;
- type rules;
- constant rules;
- enum rules;
- string patterns;
- minimum and maximum string length;
- numeric bounds.

## Current limitations

The module is a small local validator for the current schema subset. It is not a full JSON Schema implementation.

If the schema starts using nested objects, arrays, conditional validation, `$ref`, `oneOf`, `anyOf`, `allOf`, `format` or other JSON Schema features, the module must either be expanded deliberately or replaced with a reviewed JSON Schema validator.

## Release rule

Future collector and SDK work must use this validation module, or a deliberately superseding validator, before accepting or emitting event payloads.
