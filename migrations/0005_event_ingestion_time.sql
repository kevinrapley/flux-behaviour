ALTER TABLE events ADD COLUMN accepted_at_ms INTEGER;

CREATE INDEX IF NOT EXISTS events_by_tenant_acceptance
ON events(tenant_id, accepted_at_ms DESC);

CREATE INDEX IF NOT EXISTS sessions_by_tenant_activity
ON sessions(tenant_id, last_seen_at_ms DESC);
