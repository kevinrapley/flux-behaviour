CREATE INDEX IF NOT EXISTS event_service_contexts_by_model_period_lookup
  ON event_service_contexts(tenant_id, model_key, model_version, event_id);
