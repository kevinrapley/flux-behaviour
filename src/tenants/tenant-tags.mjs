export async function resolveTenantReference(db, reference) {
  if (typeof reference !== 'string' || reference === '') return null;
  const taggedTenant = await db.prepare(`SELECT tenants.id, tenants.allowed_origins_json
    FROM tenant_installation_tags
    INNER JOIN tenants ON tenants.id = tenant_installation_tags.tenant_id
    WHERE tenant_installation_tags.tag_id = ?
      AND tenant_installation_tags.revoked_at_ms IS NULL`).bind(reference).first();
  if (taggedTenant) return taggedTenant;
  if (reference !== 'researchops') return null;
  return db.prepare("SELECT id, allowed_origins_json FROM tenants WHERE id = 'researchops'").bind().first();
}

export function buildInstallationTag(baseUrl, tagId) {
  const moduleUrl = new URL('/assets/flux/sdk/flux-browser.install.mjs', baseUrl).toString();
  const endpoint = new URL('/api/collect', baseUrl).toString();
  return `<script type="module" src="${moduleUrl}" data-flux-endpoint="${endpoint}" data-flux-tag="${tagId}"></script>`;
}
