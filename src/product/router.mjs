import { describeInteraction } from './narrative.mjs';
import { validateEventRuntime } from '../events/validate-event-runtime.mjs';
import { fluxEventSchema } from '../events/flux-event-schema.mjs';

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const OTP_TTL_MS = 600000;

export async function handleProductRequest(request, env) {
  const path = new URL(request.url).pathname;
  if (!path.startsWith('/api/')) return null;
  if (!env.FLUX_DB) return json({ ok: false, error: 'storage_unavailable' }, 503);
  if (path === '/api/collect' && request.method === 'POST') return collect(request, env);
  if (path === '/api/auth/create-account' && request.method === 'POST') return createAccount(request, env);
  if (path === '/api/auth/request-otp' && request.method === 'POST') return requestOtp(request, env);
  if (path === '/api/auth/verify-otp' && request.method === 'POST') return verifyOtp(request, env);
  if (path === '/api/dashboard/researchops' && request.method === 'GET') return dashboard(request, env);
  return json({ ok: false, error: 'not_found' }, 404);
}

async function createAccount(request, env) {
  const email = normaliseEmail((await safeJson(request))?.email);
  if (!email) return json({ ok: false, error: 'invalid_email' }, 400);
  const existing = await env.FLUX_DB.prepare('SELECT id FROM accounts WHERE email = ?').bind(email).first();
  if (!existing) await env.FLUX_DB.prepare('INSERT INTO accounts (id, email, created_at_ms) VALUES (?, ?, ?)').bind(crypto.randomUUID(), email, Date.now()).run();
  return requestOtp(new Request(request.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) }), env);
}

async function collect(request, env) {
  const origin = request.headers.get('origin');
  const event = await safeJson(request);
  const valid = event && validateEventRuntime(event, fluxEventSchema).valid && event.tenant_id && event.visitor_id;
  if (!valid) return withCors(json({ ok: false, error: 'invalid_event' }, 400), origin);
  const tenant = await env.FLUX_DB.prepare('SELECT allowed_origins_json FROM tenants WHERE id = ?').bind(event.tenant_id).first();
  if (!tenant || !allows(tenant.allowed_origins_json, origin)) return withCors(json({ ok: false, error: 'origin_not_allowed' }, 403), origin);
  const now = Date.now();
  const existingVisitor = await env.FLUX_DB.prepare('SELECT session_count FROM visitors WHERE tenant_id = ? AND visitor_id = ?').bind(event.tenant_id, event.visitor_id).first();
  const existingSession = await env.FLUX_DB.prepare('SELECT id FROM sessions WHERE id = ? AND tenant_id = ?').bind(event.session_id, event.tenant_id).first();
  const statements = [
    env.FLUX_DB.prepare('INSERT INTO visitors (tenant_id, visitor_id, first_seen_at_ms, last_seen_at_ms, session_count) VALUES (?, ?, ?, ?, 1) ON CONFLICT(tenant_id, visitor_id) DO UPDATE SET last_seen_at_ms = excluded.last_seen_at_ms, session_count = session_count + ?').bind(event.tenant_id, event.visitor_id, now, now, existingSession ? 0 : 1),
    existingSession ? env.FLUX_DB.prepare('UPDATE sessions SET last_seen_at_ms = ? WHERE id = ?').bind(now, event.session_id) : env.FLUX_DB.prepare('INSERT INTO sessions (id, tenant_id, visitor_id, started_at_ms, last_seen_at_ms, is_returning_visitor) VALUES (?, ?, ?, ?, ?, ?)').bind(event.session_id, event.tenant_id, event.visitor_id, now, now, existingVisitor ? 1 : 0),
    env.FLUX_DB.prepare('INSERT INTO events (id, tenant_id, visitor_id, session_id, event_class, action, role, element_key, metadata_json, narrative, occurred_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), event.tenant_id, event.visitor_id, event.session_id, event.event_class, event.action, event.role, event.element_key, JSON.stringify(metadata(event)), describeInteraction(event), event.timestamp_ms)
  ];
  await env.FLUX_DB.batch(statements);
  return withCors(json({ ok: true, accepted: true, returning_visitor: Boolean(existingVisitor) }, 202), origin);
}

async function requestOtp(request, env) {
  const email = normaliseEmail((await safeJson(request))?.email);
  if (!email) return json({ ok: false, error: 'invalid_email' }, 400);
  const account = await env.FLUX_DB.prepare('SELECT id FROM accounts WHERE email = ?').bind(email).first();
  if (!account) return json({ ok: true });
  if (!env.RESEND_API_KEY || !env.FLUX_EMAIL_FROM || !env.FLUX_AUTH_SECRET) return json({ ok: false, error: 'otp_delivery_unconfigured' }, 503);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await env.FLUX_DB.prepare('INSERT INTO otp_challenges (id, account_id, code_hash, expires_at_ms, created_at_ms) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), account.id, await hash(code, env.FLUX_AUTH_SECRET), Date.now() + OTP_TTL_MS, Date.now()).run();
  const delivery = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: env.FLUX_EMAIL_FROM, to: [email], subject: 'Your Flux Behaviour sign-in code', text: `Your sign-in code is ${code}. It expires in 10 minutes.` }) });
  return delivery.ok ? json({ ok: true }) : json({ ok: false, error: 'otp_delivery_failed' }, 502);
}

async function verifyOtp(request, env) {
  const body = await safeJson(request); const email = normaliseEmail(body?.email); const code = typeof body?.code === 'string' ? body.code : '';
  const record = email && code && env.FLUX_AUTH_SECRET ? await env.FLUX_DB.prepare('SELECT c.id, c.code_hash, a.id AS account_id FROM otp_challenges c JOIN accounts a ON a.id = c.account_id WHERE a.email = ? AND c.consumed_at_ms IS NULL AND c.expires_at_ms > ? ORDER BY c.created_at_ms DESC LIMIT 1').bind(email, Date.now()).first() : null;
  if (!record || !(await equal(record.code_hash, await hash(code, env.FLUX_AUTH_SECRET)))) return json({ ok: false, error: 'invalid_or_expired_code' }, 401);
  await env.FLUX_DB.batch([env.FLUX_DB.prepare('UPDATE otp_challenges SET consumed_at_ms = ? WHERE id = ?').bind(Date.now(), record.id), env.FLUX_DB.prepare('UPDATE accounts SET last_login_at_ms = ? WHERE id = ?').bind(Date.now(), record.account_id)]);
  const payload = `${record.account_id}.${Date.now() + 28800000}`; const sessionCookie = `${payload}.${await hash(payload, env.FLUX_AUTH_SECRET)}`;
  return new Response(JSON.stringify({ ok: true }), { headers: { ...HEADERS, 'set-cookie': `flux_session=${sessionCookie}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800` } });
}

async function dashboard(request, env) {
  const sessionCookie = request.headers.get('cookie')?.match(/(?:^|; )flux_session=([^;]+)/)?.[1]; const [accountId, expires, signature] = sessionCookie?.split('.') ?? [];
  if (!accountId || !signature || Number(expires) <= Date.now() || !(await equal(signature, await hash(`${accountId}.${expires}`, env.FLUX_AUTH_SECRET)))) return json({ ok: false, error: 'unauthorised' }, 401);
  const access = await env.FLUX_DB.prepare("SELECT 1 FROM account_tenants WHERE account_id = ? AND tenant_id = 'researchops'").bind(accountId).first(); if (!access) return json({ ok: false, error: 'forbidden' }, 403);
  const sessions = await env.FLUX_DB.prepare("SELECT id, visitor_id, started_at_ms, last_seen_at_ms, is_returning_visitor FROM sessions WHERE tenant_id = 'researchops' ORDER BY started_at_ms DESC LIMIT 50").all();
  const events = await env.FLUX_DB.prepare("SELECT session_id, narrative, occurred_at_ms FROM events WHERE tenant_id = 'researchops' ORDER BY occurred_at_ms DESC LIMIT 500").all();
  return json({ ok: true, sessions: sessions.results, events: events.results });
}

function metadata(event) { const copy = { ...event }; delete copy.session_id; delete copy.visitor_id; delete copy.tenant_id; return copy; }
function allows(value, origin) { try { return !origin || JSON.parse(value).includes(origin); } catch { return false; } }
function withCors(response, origin) { const headers = new Headers(response.headers); if (origin) headers.set('access-control-allow-origin', origin); headers.set('vary', 'Origin'); return new Response(response.body, { status: response.status, headers }); }
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: HEADERS }); }
async function safeJson(request) { try { return await request.json(); } catch { return null; } }
function normaliseEmail(value) { const email = typeof value === 'string' ? value.trim().toLowerCase() : ''; return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null; }
async function hash(value, secret) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${secret}:${value}`)); return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join(''); }
async function equal(left, right) { if (left.length !== right.length) return false; let diff = 0; for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index); return diff === 0; }
