CREATE TABLE IF NOT EXISTS tenant_installation_tags (
  tag_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE REFERENCES tenants(id),
  created_at_ms INTEGER NOT NULL,
  revoked_at_ms INTEGER
);

CREATE TABLE IF NOT EXISTS platform_admins (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id),
  created_at_ms INTEGER NOT NULL
);

INSERT OR IGNORE INTO tenant_installation_tags (tag_id, tenant_id, created_at_ms, revoked_at_ms)
VALUES ('flux-researchops', 'researchops', unixepoch() * 1000, NULL);

INSERT INTO tenant_installation_tags (tag_id, tenant_id, created_at_ms, revoked_at_ms)
SELECT 'flux-existing-' || tenants.rowid, tenants.id, unixepoch() * 1000, NULL
FROM tenants
LEFT JOIN tenant_installation_tags ON tenant_installation_tags.tenant_id = tenants.id
WHERE tenants.id != 'researchops'
  AND tenant_installation_tags.tenant_id IS NULL;
