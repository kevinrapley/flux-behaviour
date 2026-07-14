const TRASH_RETENTION_MS = 35 * 24 * 60 * 60 * 1000;

export function validTenantSettings(input) {
  if (typeof input?.name !== 'string' || input.name !== input.name.trim() || input.name.length < 1 || input.name.length > 120) return false;
  if (/https?:|@|[\r\n]/i.test(input.name)) return false;
  if (!Array.isArray(input?.allowedOrigins) || input.allowedOrigins.length < 1 || input.allowedOrigins.length > 20) return false;
  if (new Set(input.allowedOrigins).size !== input.allowedOrigins.length) return false;
  return input.allowedOrigins.every(validOrigin);
}

export function tenantAggregateCsv({ tenantId, generatedAt, rows = [] }) {
  const lines = [
    ['Flux tenant aggregate export'],
    ['tenant', tenantId],
    ['generated_at', generatedAt],
    ['caveat', 'Aggregate service evidence only. No raw events or identifiers are included.'],
    [],
    ['day', 'visitors', 'sessions', 'interactions'],
    ...rows.map((row) => [row.day, row.visitors, row.sessions, row.interactions])
  ];
  return `${lines.map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

export async function trashTenantTracking(db, tenantId, actorAccountId, dependencies = {}) {
  const now = (dependencies.now ?? Date.now)();
  const purgeAfter = now + TRASH_RETENTION_MS;
  const auditId = `audit-${(dependencies.randomUUID ?? (() => crypto.randomUUID()))()}`;
  await db.batch([
    db.prepare('UPDATE tenants SET deleted_at_ms = ?, purge_after_ms = ?, deleted_by_account_id = ? WHERE id = ? AND deleted_at_ms IS NULL').bind(now, purgeAfter, actorAccountId, tenantId),
    db.prepare('UPDATE tenant_installation_tags SET revoked_at_ms = ? WHERE tenant_id = ? AND revoked_at_ms IS NULL').bind(now, tenantId),
    db.prepare('INSERT INTO tenant_admin_audit (id, tenant_id, actor_account_id, action, created_at_ms) VALUES (?, ?, ?, ?, ?)').bind(auditId, tenantId, actorAccountId, 'moved_to_trash', now)
  ]);
  return { ok: true, status: 'trashed', purge_after_ms: purgeAfter };
}

export async function restoreTenantTracking(db, tenantId, actorAccountId, dependencies = {}) {
  const now = (dependencies.now ?? Date.now)();
  const auditId = `audit-${(dependencies.randomUUID ?? (() => crypto.randomUUID()))()}`;
  await db.batch([
    db.prepare('UPDATE tenants SET deleted_at_ms = NULL, purge_after_ms = NULL, deleted_by_account_id = NULL WHERE id = ? AND deleted_at_ms IS NOT NULL').bind(tenantId),
    db.prepare('UPDATE tenant_installation_tags SET revoked_at_ms = NULL WHERE tenant_id = ?').bind(tenantId),
    db.prepare('INSERT INTO tenant_admin_audit (id, tenant_id, actor_account_id, action, created_at_ms) VALUES (?, ?, ?, ?, ?)').bind(auditId, tenantId, actorAccountId, 'restored', now)
  ]);
  return { ok: true, status: 'active' };
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

function csvCell(value = '') {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
