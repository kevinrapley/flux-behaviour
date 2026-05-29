import { readFileSync } from 'node:fs';

const DEFAULT_SCHEMA_PATH = 'contracts/events/flux-event.schema.json';

export function loadEventSchema(schemaPath = DEFAULT_SCHEMA_PATH) {
  return JSON.parse(readFileSync(schemaPath, 'utf8'));
}
