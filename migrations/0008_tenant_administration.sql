ALTER TABLE tenants ADD COLUMN deleted_at_ms INTEGER;
ALTER TABLE tenants ADD COLUMN purge_after_ms INTEGER;
ALTER TABLE tenants ADD COLUMN deleted_by_account_id TEXT REFERENCES accounts(id);

CREATE TABLE IF NOT EXISTS tenant_admin_audit (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  actor_account_id TEXT NOT NULL REFERENCES accounts(id),
  action TEXT NOT NULL CHECK(action IN ('created', 'updated', 'access_updated', 'moved_to_trash', 'restored', 'exported')),
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS tenant_admin_audit_by_tenant
  ON tenant_admin_audit(tenant_id, created_at_ms DESC);
