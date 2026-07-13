import { readFile, writeFile } from 'node:fs/promises';

import { validateServiceModel } from '../src/model/service-model.mjs';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) throw new Error('Usage: node scripts/generate-service-model-seed.mjs <model.json> <migration.sql>');

const model = JSON.parse(await readFile(inputPath, 'utf8'));
const validation = validateServiceModel(model);
if (!validation.valid) throw new Error(`Invalid service model: ${JSON.stringify(validation.errors)}`);

const modelJson = canonicalJson(model);
const manifestHash = await sha256(modelJson);
const sql = [
  '-- Generated from the governed publisher service model. Do not edit by hand.',
  `-- Source: ${inputPath}`,
  '',
  `INSERT OR IGNORE INTO service_model_versions (tenant_id, model_key, version, schema_version, status, model_json, manifest_hash, created_by_account_id, created_at_ms, published_at_ms) VALUES (${quote(model.tenant_id)}, ${quote(model.model_key)}, ${model.version}, ${quote(model.schema_version)}, 'published', ${quote(modelJson)}, ${quote(manifestHash)}, NULL, unixepoch() * 1000, unixepoch() * 1000);`,
  '',
  ...model.entities.map((entity) => `INSERT OR IGNORE INTO service_model_entities (tenant_id, model_key, version, entity_key, entity_type, label, parent_key, position, complexity, required) VALUES (${quote(model.tenant_id)}, ${quote(model.model_key)}, ${model.version}, ${quote(entity.key)}, ${quote(entity.type)}, ${quote(entity.label)}, ${entity.parent_key ? quote(entity.parent_key) : 'NULL'}, ${entity.position}, ${entity.complexity ?? 'NULL'}, ${entity.required === undefined ? 'NULL' : Number(entity.required)});`),
  '',
  ...model.bindings.map((binding) => `INSERT OR IGNORE INTO service_model_bindings (tenant_id, model_key, version, element_key, entity_key) VALUES (${quote(model.tenant_id)}, ${quote(model.model_key)}, ${model.version}, ${quote(binding.element_key)}, ${quote(binding.entity_key)});`),
  '',
  ...(model.outcomes ?? []).map((outcome) => `INSERT OR IGNORE INTO service_model_outcomes (tenant_id, model_key, version, outcome_key, label, transaction_key, outcome_type) VALUES (${quote(model.tenant_id)}, ${quote(model.model_key)}, ${model.version}, ${quote(outcome.key)}, ${quote(outcome.label)}, ${quote(outcome.transaction_key)}, ${quote(outcome.type)});`),
  '',
  ...(model.key_events ?? []).map((keyEvent) => `INSERT OR IGNORE INTO service_model_key_events (tenant_id, model_key, version, key_event_key, label, action, element_key, outcome_key) VALUES (${quote(model.tenant_id)}, ${quote(model.model_key)}, ${model.version}, ${quote(keyEvent.key)}, ${quote(keyEvent.label)}, ${quote(keyEvent.action)}, ${quote(keyEvent.element_key)}, ${quote(keyEvent.outcome_key)});`),
  '',
].join('\n');

await writeFile(outputPath, sql, 'utf8');

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
