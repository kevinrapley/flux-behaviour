CREATE TABLE IF NOT EXISTS external_identities (
  provider TEXT NOT NULL CHECK(provider IN ('google')),
  subject TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_at_ms INTEGER NOT NULL,
  PRIMARY KEY (provider, subject)
);

CREATE INDEX IF NOT EXISTS external_identities_by_account ON external_identities(account_id);

UPDATE tenants
SET allowed_origins_json = '["https://researchops.pages.dev","https://research-operations.com","https://flux-behaviour.pages.dev"]'
WHERE id = 'researchops';
