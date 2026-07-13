CREATE TABLE IF NOT EXISTS service_model_versions (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  model_key TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  schema_version TEXT NOT NULL CHECK (schema_version = '1.0.0'),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'retired')),
  model_json TEXT NOT NULL,
  manifest_hash TEXT NOT NULL,
  created_by_account_id TEXT REFERENCES accounts(id),
  created_at_ms INTEGER NOT NULL,
  published_at_ms INTEGER,
  PRIMARY KEY (tenant_id, model_key, version)
);

CREATE TABLE IF NOT EXISTS service_model_entities (
  tenant_id TEXT NOT NULL,
  model_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  entity_key TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('service', 'transaction', 'task', 'step', 'question', 'field')),
  label TEXT NOT NULL,
  parent_key TEXT,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 10000),
  complexity INTEGER CHECK (complexity BETWEEN 1 AND 7),
  required INTEGER CHECK (required IN (0, 1)),
  PRIMARY KEY (tenant_id, model_key, version, entity_key),
  FOREIGN KEY (tenant_id, model_key, version) REFERENCES service_model_versions(tenant_id, model_key, version)
);

CREATE TABLE IF NOT EXISTS service_model_bindings (
  tenant_id TEXT NOT NULL,
  model_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  element_key TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  PRIMARY KEY (tenant_id, model_key, version, element_key),
  FOREIGN KEY (tenant_id, model_key, version, entity_key) REFERENCES service_model_entities(tenant_id, model_key, version, entity_key)
);

CREATE TABLE IF NOT EXISTS service_model_outcomes (
  tenant_id TEXT NOT NULL,
  model_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  outcome_key TEXT NOT NULL,
  label TEXT NOT NULL,
  transaction_key TEXT NOT NULL,
  outcome_type TEXT NOT NULL CHECK (outcome_type IN ('success', 'failure', 'progress', 'abandonment')),
  PRIMARY KEY (tenant_id, model_key, version, outcome_key),
  FOREIGN KEY (tenant_id, model_key, version) REFERENCES service_model_versions(tenant_id, model_key, version)
);

CREATE TABLE IF NOT EXISTS service_model_key_events (
  tenant_id TEXT NOT NULL,
  model_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  key_event_key TEXT NOT NULL,
  label TEXT NOT NULL,
  action TEXT NOT NULL,
  element_key TEXT NOT NULL,
  outcome_key TEXT NOT NULL,
  PRIMARY KEY (tenant_id, model_key, version, key_event_key),
  UNIQUE (tenant_id, model_key, version, action, element_key),
  FOREIGN KEY (tenant_id, model_key, version, outcome_key) REFERENCES service_model_outcomes(tenant_id, model_key, version, outcome_key)
);

CREATE TABLE IF NOT EXISTS event_service_contexts (
  event_id TEXT PRIMARY KEY REFERENCES events(id),
  tenant_id TEXT NOT NULL,
  model_key TEXT NOT NULL,
  model_version INTEGER NOT NULL,
  entity_key TEXT NOT NULL,
  service_key TEXT,
  transaction_key TEXT,
  task_key TEXT,
  step_key TEXT,
  question_key TEXT,
  field_key TEXT,
  field_required INTEGER CHECK (field_required IN (0, 1)),
  question_complexity INTEGER CHECK (question_complexity BETWEEN 1 AND 7),
  transaction_complexity REAL,
  key_event_key TEXT,
  outcome_key TEXT,
  outcome_type TEXT CHECK (outcome_type IN ('success', 'failure', 'progress', 'abandonment')),
  FOREIGN KEY (tenant_id, model_key, model_version, entity_key) REFERENCES service_model_entities(tenant_id, model_key, version, entity_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_published_service_model_per_tenant
  ON service_model_versions(tenant_id)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS service_model_entities_by_parent
  ON service_model_entities(tenant_id, model_key, version, parent_key, position);

CREATE INDEX IF NOT EXISTS event_service_contexts_by_transaction
  ON event_service_contexts(tenant_id, transaction_key, model_version);
