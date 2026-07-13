import { resolveServiceContext, validateServiceModel, validateServiceModelForPublication } from './service-model.mjs';

export async function publishServiceModel(db, accountId, model, now = Date.now()) {
  const validation = validateServiceModelForPublication(model);
  if (!validation.valid) return { ok: false, error: 'invalid_service_model', details: validation.errors };
  const access = await db.prepare('SELECT role FROM account_tenants WHERE account_id = ? AND tenant_id = ?').bind(accountId, model.tenant_id).first();
  if (access?.role !== 'owner') return { ok: false, error: 'forbidden' };
  const existing = await db.prepare('SELECT version FROM service_model_versions WHERE tenant_id = ? AND model_key = ? AND version = ?').bind(model.tenant_id, model.model_key, model.version).first();
  if (existing) return { ok: false, error: 'service_model_version_exists' };
  const modelJson = canonicalJson(model);
  const manifestHash = await sha256(modelJson);
  const statements = [
    db.prepare("UPDATE service_model_versions SET status = 'retired' WHERE tenant_id = ? AND status = 'published'").bind(model.tenant_id),
    db.prepare('INSERT INTO service_model_versions (tenant_id, model_key, version, schema_version, status, model_json, manifest_hash, created_by_account_id, created_at_ms, published_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(model.tenant_id, model.model_key, model.version, model.schema_version, 'published', modelJson, manifestHash, accountId, now, now)
  ];
  for (const entity of model.entities) {
    statements.push(db.prepare('INSERT INTO service_model_entities (tenant_id, model_key, version, entity_key, entity_type, label, parent_key, position, complexity, required) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(
      model.tenant_id,
      model.model_key,
      model.version,
      entity.key,
      entity.type,
      entity.label,
      entity.parent_key ?? null,
      entity.position,
      entity.complexity ?? null,
      entity.required === undefined ? null : Number(entity.required)
    ));
  }
  for (const binding of model.bindings) {
    statements.push(db.prepare('INSERT INTO service_model_bindings (tenant_id, model_key, version, element_key, entity_key) VALUES (?, ?, ?, ?, ?)').bind(
      model.tenant_id,
      model.model_key,
      model.version,
      binding.element_key,
      binding.entity_key
    ));
  }
  for (const outcome of model.outcomes ?? []) {
    statements.push(db.prepare('INSERT INTO service_model_outcomes (tenant_id, model_key, version, outcome_key, label, transaction_key, outcome_type) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
      model.tenant_id,
      model.model_key,
      model.version,
      outcome.key,
      outcome.label,
      outcome.transaction_key,
      outcome.type
    ));
  }
  for (const keyEvent of model.key_events ?? []) {
    statements.push(db.prepare('INSERT INTO service_model_key_events (tenant_id, model_key, version, key_event_key, label, action, element_key, outcome_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(
      model.tenant_id,
      model.model_key,
      model.version,
      keyEvent.key,
      keyEvent.label,
      keyEvent.action,
      keyEvent.element_key,
      keyEvent.outcome_key
    ));
  }
  await db.batch(statements);
  return { ok: true, model_key: model.model_key, version: model.version };
}

export async function resolvePublishedServiceContext(db, tenantId, elementKey, action) {
  const row = await db.prepare("SELECT model_json FROM service_model_versions WHERE tenant_id = ? AND status = 'published'").bind(tenantId).first();
  if (!row?.model_json) return null;
  try {
    return resolveServiceContext(JSON.parse(row.model_json), elementKey, action);
  } catch {
    return null;
  }
}

export async function readPublishedServiceModel(db, accountId, tenantId) {
  const access = await db.prepare('SELECT role FROM account_tenants WHERE account_id = ? AND tenant_id = ?').bind(accountId, tenantId).first();
  if (!access) return { ok: false, error: 'forbidden' };
  const row = await db.prepare("SELECT model_json, manifest_hash FROM service_model_versions WHERE tenant_id = ? AND status = 'published'").bind(tenantId).first();
  if (!row) return { ok: false, error: 'service_model_not_found' };
  try {
    const model = JSON.parse(row.model_json);
    return validateServiceModel(model).valid
      ? { ok: true, model, manifest_hash: row.manifest_hash, role: access.role }
      : { ok: false, error: 'service_model_invalid_at_rest' };
  } catch {
    return { ok: false, error: 'service_model_invalid_at_rest' };
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
