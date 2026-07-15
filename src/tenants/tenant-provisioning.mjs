export function generateTenantTag(randomUUID = () => crypto.randomUUID()) {
  const value = randomUUID();
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) {
    throw new RangeError('invalid_tenant_tag_source');
  }
  return `flux-${value.replaceAll('-', '').toLowerCase()}`;
}

export async function provisionTenant(db, input, dependencies = {}) {
  if (!validTenantInput(input)) return { ok: false, error: 'invalid_tenant' };
  const now = (dependencies.now ?? Date.now)();
  const tagId = generateTenantTag(dependencies.randomUUID);
  const statements = [
    db.prepare('INSERT INTO tenants (id, name, allowed_origins_json, created_at_ms) VALUES (?, ?, ?, ?)').bind(
      input.tenantId,
      input.name,
      JSON.stringify(input.allowedOrigins),
      now
    ),
    db.prepare('INSERT INTO tenant_installation_tags (tag_id, tenant_id, created_at_ms) VALUES (?, ?, ?)').bind(
      tagId,
      input.tenantId,
      now
    ),
    db.prepare('INSERT INTO account_tenants (account_id, tenant_id, role) VALUES (?, ?, ?)').bind(
      input.ownerAccountId,
      input.tenantId,
      'owner'
    ),
    db.prepare("INSERT INTO tenant_admin_audit (id, tenant_id, actor_account_id, action, created_at_ms) VALUES (?, ?, ?, 'created', ?)").bind(
      `audit-${(dependencies.randomUUID ?? (() => crypto.randomUUID()))()}`,
      input.tenantId,
      input.ownerAccountId,
      now
    )
  ];
  await db.batch(statements);
  return { ok: true, tenant_id: input.tenantId, tag_id: tagId };
}

function validTenantInput(input) {
  if (!/^[a-z][a-z0-9-]{2,79}$/.test(input?.tenantId ?? '')) return false;
  if (typeof input?.name !== 'string' || input.name !== input.name.trim() || input.name.length < 1 || input.name.length > 120) return false;
  if (/https?:|@|[\r\n]/i.test(input.name)) return false;
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(input?.ownerAccountId ?? '')) return false;
  if (!Array.isArray(input?.allowedOrigins) || input.allowedOrigins.length < 1 || input.allowedOrigins.length > 20) return false;
  if (new Set(input.allowedOrigins).size !== input.allowedOrigins.length) return false;
  return input.allowedOrigins.every(validOrigin);
}

function validOrigin(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    return value === url.origin && (url.protocol === 'https:' || (local && url.protocol === 'http:'));
  } catch {
    return false;
  }
}
