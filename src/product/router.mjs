import { describeInteraction } from './narrative.mjs';
import { buildGoogleAuthorisationUrl } from './google-oauth.mjs';
import { buildLiveAnalytics, buildOverviewMetrics, dashboardRange } from './live-analytics.mjs';
import { scoreSessionDimensions } from './session-dimensions.mjs';
import {
  buildJourneyPatternCohorts,
  JOURNEY_PATTERN_SAMPLE_LIMIT,
  OUTCOME_COHORTS,
  summariseCohortRows,
  VISIT_MATURITY_COHORTS
} from './journey-cohorts.mjs';
import { validateEventRuntime } from '../events/validate-event-runtime.mjs';
import { fluxEventSchema } from '../events/flux-event-schema.mjs';

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export async function handleProductRequest(request, env) {
  const path = new URL(request.url).pathname;
  if (!path.startsWith('/api/')) return null;
  if (!env.FLUX_DB) return json({ ok: false, error: 'storage_unavailable' }, 503);
  if (path === '/api/collect' && request.method === 'OPTIONS') return collectPreflight(request, env);
  if (path === '/api/collect' && request.method === 'POST') return collect(request, env);
  if (path === '/api/auth/google/start' && request.method === 'GET') return startGoogleSignIn(request, env);
  if (path === '/api/auth/google/callback' && request.method === 'GET') return completeGoogleSignIn(request, env);
  if (path.startsWith('/api/dashboard/researchops/session/') && request.method === 'GET') return sessionHistory(request, env, path);
  if (path === '/api/dashboard/researchops' && request.method === 'GET') return dashboard(request, env);
  return json({ ok: false, error: 'not_found' }, 404);
}

async function startGoogleSignIn(request, env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.FLUX_AUTH_SECRET) {
    return json({ ok: false, error: 'google_sign_in_unconfigured' }, 503);
  }
  const state = randomToken();
  const redirectUri = new URL('/api/auth/google/callback', request.url).toString();
  const location = buildGoogleAuthorisationUrl({ clientId: env.GOOGLE_CLIENT_ID, redirectUri, state });
  return new Response(null, { status: 302, headers: { location, 'set-cookie': `flux_google_state=${state}.${await hash(state, env.FLUX_AUTH_SECRET)}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/google; Max-Age=600` } });
}

async function completeGoogleSignIn(request, env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.FLUX_AUTH_SECRET) return json({ ok: false, error: 'google_sign_in_unconfigured' }, 503);
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookie = readCookie(request, 'flux_google_state');
  const [cookieState, signature] = cookie?.split('.') ?? [];
  if (!code || !state || !cookieState || state !== cookieState || !signature || !(await equal(signature, await hash(state, env.FLUX_AUTH_SECRET)))) {
    return json({ ok: false, error: 'google_sign_in_failed' }, 400);
  }
  const redirectUri = new URL('/api/auth/google/callback', request.url).toString();
  const tokenRequest = new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri, grant_type: 'authorization_code' });
  tokenRequest.set('client_' + 'secret', env.GOOGLE_CLIENT_SECRET);
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: tokenRequest
  });
  const providerCredentials = tokenResponse.ok ? await safeResponseJson(tokenResponse) : null;
  if (!providerCredentials?.access_token) return json({ ok: false, error: 'google_sign_in_failed' }, 400);
  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${providerCredentials.access_token}` } });
  const profile = profileResponse.ok ? await safeResponseJson(profileResponse) : null;
  const email = normaliseEmail(profile?.email);
  if (!email || profile?.email_verified !== true || typeof profile?.sub !== 'string' || profile.sub.length > 255) return json({ ok: false, error: 'google_sign_in_failed' }, 400);
  const accountId = await resolveGoogleAccount(env, { email, subject: profile.sub });
  return dashboardSession(accountId, env, '/dashboard/', true);
}

async function resolveGoogleAccount(env, { email, subject }) {
  const identity = await env.FLUX_DB.prepare("SELECT account_id FROM external_identities WHERE provider = 'google' AND subject = ?").bind(subject).first();
  if (identity?.account_id) return identity.account_id;
  const account = await env.FLUX_DB.prepare('SELECT id FROM accounts WHERE email = ?').bind(email).first();
  const accountId = account?.id ?? crypto.randomUUID();
  const statements = [];
  if (!account) statements.push(env.FLUX_DB.prepare('INSERT INTO accounts (id, email, created_at_ms) VALUES (?, ?, ?)').bind(accountId, email, Date.now()));
  statements.push(env.FLUX_DB.prepare("INSERT OR IGNORE INTO external_identities (provider, subject, account_id, created_at_ms) VALUES ('google', ?, ?, ?)").bind(subject, accountId, Date.now()));
  statements.push(env.FLUX_DB.prepare('UPDATE accounts SET last_login_at_ms = ? WHERE id = ?').bind(Date.now(), accountId));
  await env.FLUX_DB.batch(statements);
  return accountId;
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
    existingSession ? env.FLUX_DB.prepare('UPDATE sessions SET last_seen_at_ms = ? WHERE id = ?').bind(now, event.session_id) : env.FLUX_DB.prepare('INSERT OR IGNORE INTO sessions (id, tenant_id, visitor_id, started_at_ms, last_seen_at_ms, is_returning_visitor) VALUES (?, ?, ?, ?, ?, ?)').bind(event.session_id, event.tenant_id, event.visitor_id, now, now, existingVisitor ? 1 : 0),
    env.FLUX_DB.prepare('INSERT INTO events (id, tenant_id, visitor_id, session_id, event_class, action, role, element_key, metadata_json, narrative, occurred_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), event.tenant_id, event.visitor_id, event.session_id, event.event_class, event.action, event.role, event.element_key, JSON.stringify(metadata(event)), describeInteraction(event), event.timestamp_ms)
  ];
  await env.FLUX_DB.batch(statements);
  return withCors(json({ ok: true, accepted: true, returning_visitor: Boolean(existingVisitor) }, 202), origin);
}

async function collectPreflight(request, env) {
  const origin = request.headers.get('origin');
  if (!origin) return json({ ok: false, error: 'origin_not_allowed' }, 403);
  const tenants = await env.FLUX_DB.prepare('SELECT allowed_origins_json FROM tenants').bind().all();
  if (!tenants.results?.some((tenant) => allows(tenant.allowed_origins_json, origin))) return json({ ok: false, error: 'origin_not_allowed' }, 403);
  return new Response(null, { status: 204, headers: { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'Origin', 'cache-control': 'no-store' } });
}

async function dashboardSession(accountId, env, location, clearGoogleState = false) {
  const payload = `${accountId}.${Date.now() + 28800000}`; const sessionCookie = `${payload}.${await hash(payload, env.FLUX_AUTH_SECRET)}`;
  const headers = new Headers({ 'set-cookie': `flux_session=${sessionCookie}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800` });
  if (clearGoogleState) headers.append('set-cookie', 'flux_google_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/google; Max-Age=0');
  if (location) { headers.set('location', location); return new Response(null, { status: 302, headers }); }
  headers.set('content-type', HEADERS['content-type']); headers.set('cache-control', HEADERS['cache-control']);
  return new Response(JSON.stringify({ ok: true }), { headers });
}

async function dashboard(request, env) {
  const sessionCookie = request.headers.get('cookie')?.match(/(?:^|; )flux_session=([^;]+)/)?.[1]; const [accountId, expires, signature] = sessionCookie?.split('.') ?? [];
  if (!accountId || !signature || Number(expires) <= Date.now() || !(await equal(signature, await hash(`${accountId}.${expires}`, env.FLUX_AUTH_SECRET)))) return json({ ok: false, error: 'unauthorised' }, 401);
  const access = await env.FLUX_DB.prepare("SELECT 1 FROM account_tenants WHERE account_id = ? AND tenant_id = 'researchops'").bind(accountId).first(); if (!access) return json({ ok: false, error: 'forbidden' }, 403);
  const period = dashboardRange(new URL(request.url).searchParams.get('range'));
  const overview = await dashboardOverview(env, period.start_at_ms, period.end_at_ms);
  const comparison = period.previous_start_at_ms === null ? null : await dashboardOverview(env, period.previous_start_at_ms, period.previous_end_at_ms);
  const trend = await env.FLUX_DB.prepare("SELECT date(started_at_ms / 1000, 'unixepoch') AS day, COUNT(DISTINCT visitor_id) AS visitors, COUNT(*) AS sessions, COUNT(DISTINCT CASE WHEN is_returning_visitor = 0 THEN visitor_id END) AS new_visitors, COUNT(DISTINCT CASE WHEN is_returning_visitor = 1 THEN visitor_id END) AS returning_visitors FROM sessions WHERE tenant_id = 'researchops' AND started_at_ms >= ? AND started_at_ms < ? GROUP BY day ORDER BY day ASC").bind(period.start_at_ms, period.end_at_ms).all();
  const actions = await env.FLUX_DB.prepare("SELECT e.action, COUNT(*) AS count FROM events e INNER JOIN sessions s ON s.id = e.session_id WHERE s.tenant_id = 'researchops' AND s.started_at_ms >= ? AND s.started_at_ms < ? GROUP BY e.action ORDER BY count DESC, e.action ASC LIMIT 8").bind(period.start_at_ms, period.end_at_ms).all();
  const sessions = await env.FLUX_DB.prepare("SELECT s.id, s.started_at_ms, s.last_seen_at_ms, s.is_returning_visitor, COUNT(e.id) AS event_count, COUNT(DISTINCT CASE WHEN e.action = 'flow.submit' THEN e.id END) AS submit_count, COUNT(DISTINCT CASE WHEN e.action IN ('error.invalid', 'act.rage', 'field.revisit', 'assist.help') THEN e.id END) AS friction_event_count FROM sessions s LEFT JOIN events e ON e.session_id = s.id WHERE s.tenant_id = 'researchops' AND s.started_at_ms >= ? AND s.started_at_ms < ? GROUP BY s.id, s.started_at_ms, s.last_seen_at_ms, s.is_returning_visitor ORDER BY s.started_at_ms DESC LIMIT 12").bind(period.start_at_ms, period.end_at_ms).all();
  const events = await env.FLUX_DB.prepare("SELECT session_id, event_class, action, role, element_key, metadata_json, narrative, occurred_at_ms FROM (SELECT e.session_id, e.event_class, e.action, e.role, e.element_key, e.metadata_json, e.narrative, e.occurred_at_ms FROM events e WHERE e.tenant_id = 'researchops' AND e.session_id IN (SELECT id FROM sessions WHERE tenant_id = 'researchops' AND started_at_ms >= ? AND started_at_ms < ? ORDER BY started_at_ms DESC LIMIT 12) ORDER BY e.occurred_at_ms DESC LIMIT 500) ORDER BY occurred_at_ms ASC").bind(period.start_at_ms, period.end_at_ms).all();
  const presentedEvents = presentJourneyEvents(events.results ?? []);
  const journeys = groupJourneys(sessions.results, presentedEvents).map((journey) => ({ ...journey, dimension_scores: scoreSessionDimensions(journey.events) }));
  const cohorts = await dashboardCohorts(env, period.start_at_ms, period.end_at_ms, overview.session_count);
  return json({
    ok: true,
    sessions: sessions.results,
    journeys,
    analytics: {
      ...buildLiveAnalytics(sessions.results, presentedEvents, journeys),
      period,
      overview,
      comparison,
      trend: trend.results ?? [],
      actions: actions.results ?? [],
      cohorts
    }
  });
}

export async function dashboardCohorts(env, startAtMs, endAtMs, selectedSessionCount) {
  const sessionSignals = "WITH session_signals AS (SELECT s.id, s.is_returning_visitor, v.session_count AS lifetime_session_count, MAX(0, s.last_seen_at_ms - s.started_at_ms) AS duration_ms, MAX(CASE WHEN e.action = 'flow.submit' THEN 1 ELSE 0 END) AS completed, MAX(CASE WHEN e.action IN ('error.invalid', 'act.rage', 'field.revisit', 'assist.help') THEN 1 ELSE 0 END) AS friction FROM sessions s INNER JOIN visitors v ON v.tenant_id = s.tenant_id AND v.visitor_id = s.visitor_id LEFT JOIN events e ON e.session_id = s.id AND e.tenant_id = s.tenant_id WHERE s.tenant_id = 'researchops' AND s.started_at_ms >= ? AND s.started_at_ms < ? GROUP BY s.id, s.is_returning_visitor, v.session_count, s.started_at_ms, s.last_seen_at_ms) ";
  const lifecycleQuery = `${sessionSignals}SELECT CASE WHEN is_returning_visitor = 0 THEN 'first_time' WHEN lifetime_session_count >= 4 THEN 'established' ELSE 'returning' END AS cohort_key, COUNT(*) AS session_count, SUM(completed) AS completed_session_count, SUM(friction) AS friction_session_count, SUM(is_returning_visitor) AS returning_session_count, AVG(duration_ms) AS average_session_duration_ms FROM session_signals GROUP BY cohort_key`;
  const outcomeQuery = `${sessionSignals}SELECT CASE WHEN completed = 1 AND friction = 0 THEN 'completed_smoothly' WHEN completed = 1 AND friction = 1 THEN 'completed_after_friction' WHEN completed = 0 AND friction = 1 THEN 'friction_unresolved' ELSE 'in_progress' END AS cohort_key, COUNT(*) AS session_count, SUM(completed) AS completed_session_count, SUM(friction) AS friction_session_count, SUM(is_returning_visitor) AS returning_session_count, AVG(duration_ms) AS average_session_duration_ms FROM session_signals GROUP BY cohort_key`;
  const patternSessionsQuery = `SELECT s.id, s.started_at_ms, s.last_seen_at_ms, s.is_returning_visitor, COUNT(e.id) AS event_count, COUNT(DISTINCT CASE WHEN e.action = 'flow.submit' THEN e.id END) AS submit_count, COUNT(DISTINCT CASE WHEN e.action IN ('error.invalid', 'act.rage', 'field.revisit', 'assist.help') THEN e.id END) AS friction_event_count FROM sessions s LEFT JOIN events e ON e.session_id = s.id AND e.tenant_id = s.tenant_id WHERE s.tenant_id = 'researchops' AND s.started_at_ms >= ? AND s.started_at_ms < ? GROUP BY s.id, s.started_at_ms, s.last_seen_at_ms, s.is_returning_visitor ORDER BY s.started_at_ms DESC LIMIT ${JOURNEY_PATTERN_SAMPLE_LIMIT}`;
  const patternEventsQuery = `SELECT session_id, action, metadata_json, occurred_at_ms FROM (SELECT e.session_id, e.action, e.metadata_json, e.occurred_at_ms FROM events e WHERE e.tenant_id = 'researchops' AND e.session_id IN (SELECT id FROM sessions WHERE tenant_id = 'researchops' AND started_at_ms >= ? AND started_at_ms < ? ORDER BY started_at_ms DESC LIMIT ${JOURNEY_PATTERN_SAMPLE_LIMIT}) ORDER BY e.occurred_at_ms DESC LIMIT 10000) ORDER BY occurred_at_ms ASC`;
  const [lifecycle, outcomes, patternSessions, patternEvents] = await Promise.all([
    env.FLUX_DB.prepare(lifecycleQuery).bind(startAtMs, endAtMs).all(),
    env.FLUX_DB.prepare(outcomeQuery).bind(startAtMs, endAtMs).all(),
    env.FLUX_DB.prepare(patternSessionsQuery).bind(startAtMs, endAtMs).all(),
    env.FLUX_DB.prepare(patternEventsQuery).bind(startAtMs, endAtMs).all()
  ]);
  const patternJourneys = groupJourneys(patternSessions.results ?? [], patternEvents.results ?? []).map((journey) => ({
    ...journey,
    dimension_scores: scoreSessionDimensions(journey.events)
  }));
  return {
    privacy_note: 'Named cohort results are shown only when at least 5 journeys share the pattern.',
    journey_patterns: buildJourneyPatternCohorts(patternJourneys, selectedSessionCount),
    visit_maturity: summariseCohortRows(lifecycle.results ?? [], VISIT_MATURITY_COHORTS, selectedSessionCount),
    outcome_paths: summariseCohortRows(outcomes.results ?? [], OUTCOME_COHORTS, selectedSessionCount)
  };
}

async function dashboardOverview(env, startAtMs, endAtMs) {
  const sessions = await env.FLUX_DB.prepare("SELECT COUNT(DISTINCT visitor_id) AS visitor_count, COUNT(DISTINCT CASE WHEN is_returning_visitor = 0 THEN visitor_id END) AS new_visitor_count, COUNT(DISTINCT CASE WHEN is_returning_visitor = 1 THEN visitor_id END) AS returning_visitor_count, COUNT(*) AS session_count, COALESCE(AVG(CASE WHEN last_seen_at_ms >= started_at_ms THEN last_seen_at_ms - started_at_ms ELSE 0 END), 0) AS average_session_duration_ms FROM sessions WHERE tenant_id = 'researchops' AND started_at_ms >= ? AND started_at_ms < ?").bind(startAtMs, endAtMs).first();
  const events = await env.FLUX_DB.prepare("SELECT COUNT(*) AS event_count, COALESCE(AVG(CASE WHEN e.action = 'field.blur' THEN CASE WHEN json_type(e.metadata_json, '$.dwell_before_input_ms') = 'integer' THEN CAST(json_extract(e.metadata_json, '$.dwell_before_input_ms') AS REAL) WHEN COALESCE(CAST(json_extract(e.metadata_json, '$.key_press_count') AS INTEGER), 0) = 0 AND COALESCE(CAST(json_extract(e.metadata_json, '$.edit_count') AS INTEGER), 0) = 0 AND COALESCE(CAST(json_extract(e.metadata_json, '$.paste_count') AS INTEGER), 0) = 0 THEN CAST(json_extract(e.metadata_json, '$.duration_ms') AS REAL) END END), 0) AS average_field_dwell_ms, COALESCE(SUM(CASE WHEN e.action = 'field.blur' THEN CAST(json_extract(e.metadata_json, '$.key_press_count') AS REAL) ELSE 0 END), 0) AS typed_character_count, COALESCE(SUM(CASE WHEN e.action = 'field.blur' THEN CAST(json_extract(e.metadata_json, '$.backspace_count') AS REAL) ELSE 0 END), 0) AS correction_count, COALESCE(SUM(CASE WHEN json_extract(e.metadata_json, '$.pointer_type') = 'touch' THEN 1 ELSE 0 END), 0) AS touch_interaction_count, COUNT(DISTINCT CASE WHEN e.action = 'flow.submit' THEN e.session_id END) AS completed_session_count, COUNT(DISTINCT CASE WHEN e.action IN ('error.invalid', 'act.rage', 'field.revisit', 'assist.help') THEN e.session_id END) AS friction_session_count FROM events e INNER JOIN sessions s ON s.id = e.session_id WHERE s.tenant_id = 'researchops' AND s.started_at_ms >= ? AND s.started_at_ms < ?").bind(startAtMs, endAtMs).first();
  return buildOverviewMetrics(sessions, events);
}

async function sessionHistory(request, env, path) {
  const sessionCookie = request.headers.get('cookie')?.match(/(?:^|; )flux_session=([^;]+)/)?.[1]; const [accountId, expires, signature] = sessionCookie?.split('.') ?? [];
  if (!accountId || !signature || Number(expires) <= Date.now() || !(await equal(signature, await hash(`${accountId}.${expires}`, env.FLUX_AUTH_SECRET)))) return json({ ok: false, error: 'unauthorised' }, 401);
  const access = await env.FLUX_DB.prepare("SELECT 1 FROM account_tenants WHERE account_id = ? AND tenant_id = 'researchops'").bind(accountId).first(); if (!access) return json({ ok: false, error: 'forbidden' }, 403);
  const sessionId = decodeURIComponent(path.slice('/api/dashboard/researchops/session/'.length));
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(sessionId)) return json({ ok: false, error: 'not_found' }, 404);
  const session = await env.FLUX_DB.prepare("SELECT id, started_at_ms, last_seen_at_ms, is_returning_visitor FROM sessions WHERE id = ? AND tenant_id = 'researchops'").bind(sessionId).first();
  if (!session) return json({ ok: false, error: 'not_found' }, 404);
  const events = await env.FLUX_DB.prepare("SELECT session_id, event_class, action, role, element_key, metadata_json, narrative, occurred_at_ms FROM events WHERE tenant_id = 'researchops' AND session_id = ? ORDER BY occurred_at_ms ASC").bind(sessionId).all();
  const presentedEvents = (events.results ?? []).map(presentEvent);
  return json({ ok: true, journey: { ...session, events: presentedEvents, dimension_scores: scoreSessionDimensions(presentedEvents) } });
}

export function presentEvent(event) {
  let parsedMetadata = {};
  try {
    const parsed = JSON.parse(event.metadata_json ?? '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const narrativeMetadataKeys = new Set([
        'duration_ms',
        'dwell_before_input_ms',
        'typing_duration_ms',
        'writing_language',
        'word_count',
        'spelling_issue_count',
        'grammar_issue_count',
        'uppercase_letter_count',
        'lowercase_letter_count',
        'all_caps_word_count',
        'key_press_count',
        'backspace_count',
        'chars_per_minute',
        'words_per_minute',
        'value_length',
        'edit_count',
        'paste_count',
        'revisit_count',
        'pointer_type',
      ]);
      parsedMetadata = Object.fromEntries(
        Object.entries(parsed).filter(([key]) => narrativeMetadataKeys.has(key)),
      );
    }
  } catch {
    parsedMetadata = {};
  }
  const narrative = describeInteraction({
    event_class: event.event_class,
    action: event.action,
    role: event.role,
    element_key: event.element_key,
    metadata: parsedMetadata,
  });
  return { ...event, narrative };
}

export function presentJourneyEvents(events = []) {
  const presented = [];
  let pendingTab = null;
  for (const event of events) {
    if (event.action === 'control.tab') {
      pendingTab = event;
      continue;
    }
    if (pendingTab) presented.push(presentEvent(pendingTab));
    pendingTab = null;
    presented.push(presentEvent(event));
  }
  if (pendingTab) presented.push(presentEvent(pendingTab));
  return presented;
}

export function groupJourneys(sessions = [], events = []) {
  const eventsBySession = new Map();
  for (const event of events) {
    const journey = eventsBySession.get(event.session_id) ?? [];
    journey.push(event);
    eventsBySession.set(event.session_id, journey);
  }
  return sessions.map((session) => ({ ...session, events: eventsBySession.get(session.id) ?? [] }));
}

function metadata(event) { const copy = { ...event }; delete copy.session_id; delete copy.visitor_id; delete copy.tenant_id; return copy; }
function allows(value, origin) { try { return typeof origin === 'string' && JSON.parse(value).includes(origin); } catch { return false; } }
function withCors(response, origin) { const headers = new Headers(response.headers); if (origin) headers.set('access-control-allow-origin', origin); headers.set('vary', 'Origin'); return new Response(response.body, { status: response.status, headers }); }
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: HEADERS }); }
async function safeJson(request) { try { return await request.json(); } catch { return null; } }
async function safeResponseJson(response) { try { return await response.json(); } catch { return null; } }
function normaliseEmail(value) { const email = typeof value === 'string' ? value.trim().toLowerCase() : ''; return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null; }
function readCookie(request, name) { return request.headers.get('cookie')?.match(new RegExp(`(?:^|; )${name}=([^;]+)`))?.[1] ?? null; }
async function hash(value, secret) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${secret}:${value}`)); return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join(''); }
async function equal(left, right) { if (left.length !== right.length) return false; let diff = 0; for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index); return diff === 0; }
function randomToken() { const bytes = crypto.getRandomValues(new Uint8Array(24)); return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join(''); }
