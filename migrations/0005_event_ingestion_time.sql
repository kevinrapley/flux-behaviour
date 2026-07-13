ALTER TABLE events ADD COLUMN accepted_at_ms INTEGER;

UPDATE events
SET accepted_at_ms = occurred_at_ms
WHERE accepted_at_ms IS NULL;

CREATE INDEX IF NOT EXISTS events_by_tenant_acceptance
ON events(tenant_id, accepted_at_ms DESC);
