const MODES = Object.freeze({
  visit_maturity: { label: 'Visit maturity', sql: visitMaturitySql },
  outcome: { label: 'Outcome path', sql: outcomeSql },
  task: { label: 'Configured task', sql: taskSql },
  interaction_mode: { label: 'Interaction mode', sql: interactionModeSql }
});

export function buildComparisonReport({ mode, rows = [], minimumGroupSize = 5 }) {
  const definition = MODES[mode];
  if (!definition) throw new RangeError('unsupported_comparison_mode');
  return {
    mode,
    label: definition.label,
    minimum_group_size: minimumGroupSize,
    caveat: `Groups smaller than ${minimumGroupSize} journeys are suppressed. Differences are descriptive service evidence and do not establish cause.`,
    rows: rows.map((row) => comparisonRow(row, minimumGroupSize))
  };
}

export async function dashboardComparisonReport(db, { tenantId, mode, startAtMs, endAtMs, model, minimumGroupSize = 5 }) {
  const definition = MODES[mode];
  if (!definition) throw new RangeError('unsupported_comparison_mode');
  const values = [tenantId, startAtMs, endAtMs, model?.model_key ?? '', model?.version ?? 0];
  const result = await db.prepare(definition.sql()).bind(...values).all();
  return buildComparisonReport({ mode, rows: result.results ?? [], minimumGroupSize });
}

export function comparisonModes() {
  return Object.entries(MODES).map(([key, value]) => ({ key, label: value.label }));
}

export function isComparisonMode(value) {
  return Object.hasOwn(MODES, value);
}

function comparisonRow(row, minimumGroupSize) {
  const sessions = number(row.session_count);
  if (sessions < minimumGroupSize) {
    return {
      group_key: row.group_key,
      label: row.label,
      suppressed: true,
      session_count: null,
      interaction_count: null,
      interactions_per_session: null,
      completed_session_count: null,
      completion_rate: null,
      friction_session_count: null,
      friction_rate: null
    };
  }
  const interactions = number(row.interaction_count);
  const completed = number(row.completed_session_count);
  const friction = number(row.friction_session_count);
  return {
    group_key: row.group_key,
    label: row.label,
    suppressed: false,
    session_count: sessions,
    interaction_count: interactions,
    interactions_per_session: decimal(interactions, sessions),
    completed_session_count: completed,
    completion_rate: rate(completed, sessions),
    friction_session_count: friction,
    friction_rate: rate(friction, sessions)
  };
}

function visitMaturitySql() {
  return `/* compare:visit_maturity */
    WITH parameters AS (
      SELECT ? AS tenant_id, ? AS start_at_ms, ? AS end_at_ms, ? AS model_key, ? AS model_version
    ), selected AS (
      SELECT s.id AS session_id, s.is_returning_visitor,
        COUNT(e.id) AS interaction_count,
        MAX(CASE WHEN esc.outcome_type = 'success' THEN 1 ELSE 0 END) AS completed,
        MAX(CASE WHEN e.action IN ('error.invalid', 'act.rage', 'field.revisit', 'assist.help') THEN 1 ELSE 0 END) AS friction
      FROM parameters p INNER JOIN sessions s ON s.tenant_id = p.tenant_id
      LEFT JOIN events e ON e.session_id = s.id AND e.tenant_id = p.tenant_id AND e.occurred_at_ms >= p.start_at_ms AND e.occurred_at_ms < p.end_at_ms
      LEFT JOIN event_service_contexts esc ON esc.event_id = e.id AND esc.model_key = p.model_key AND esc.model_version = p.model_version
      WHERE s.started_at_ms >= p.start_at_ms AND s.started_at_ms < p.end_at_ms
      GROUP BY s.id, s.is_returning_visitor
    )
    SELECT CASE WHEN is_returning_visitor = 1 THEN 'returning' ELSE 'first_time' END AS group_key,
      CASE WHEN is_returning_visitor = 1 THEN 'Returning journeys' ELSE 'First-time journeys' END AS label,
      COUNT(*) AS session_count, SUM(interaction_count) AS interaction_count,
      SUM(completed) AS completed_session_count, SUM(friction) AS friction_session_count
    FROM selected GROUP BY is_returning_visitor ORDER BY group_key`;
}

function outcomeSql() {
  return `/* compare:outcome */
    WITH parameters AS (
      SELECT ? AS tenant_id, ? AS start_at_ms, ? AS end_at_ms, ? AS model_key, ? AS model_version
    ), selected AS (
      SELECT s.id AS session_id, COUNT(e.id) AS interaction_count,
        MAX(CASE WHEN esc.outcome_type = 'success' THEN 1 ELSE 0 END) AS completed,
        MAX(CASE WHEN esc.outcome_type = 'failure' THEN 1 ELSE 0 END) AS failed,
        MAX(CASE WHEN e.action IN ('error.invalid', 'act.rage', 'field.revisit', 'assist.help') THEN 1 ELSE 0 END) AS friction,
        MIN(CASE WHEN e.action IN ('error.invalid', 'act.rage', 'field.revisit', 'assist.help') THEN e.occurred_at_ms END) AS first_friction_at_ms,
        MAX(CASE WHEN esc.outcome_type = 'success' THEN e.occurred_at_ms END) AS last_success_at_ms,
        MAX(CASE WHEN e.action = 'error.recovered' THEN e.occurred_at_ms END) AS last_recovery_at_ms
      FROM parameters p INNER JOIN sessions s ON s.tenant_id = p.tenant_id
      LEFT JOIN events e ON e.session_id = s.id AND e.tenant_id = p.tenant_id AND e.occurred_at_ms >= p.start_at_ms AND e.occurred_at_ms < p.end_at_ms
      LEFT JOIN event_service_contexts esc ON esc.event_id = e.id AND esc.model_key = p.model_key AND esc.model_version = p.model_version
      WHERE s.started_at_ms >= p.start_at_ms AND s.started_at_ms < p.end_at_ms
      GROUP BY s.id
    ), classified AS (
      SELECT *, CASE
        WHEN friction = 1 AND (last_recovery_at_ms > first_friction_at_ms OR last_success_at_ms > first_friction_at_ms) THEN 'recovered'
        WHEN completed = 1 AND friction = 0 THEN 'completed'
        WHEN failed = 1 THEN 'failed'
        ELSE 'unresolved' END AS group_key
      FROM selected
    )
    SELECT group_key, CASE group_key WHEN 'recovered' THEN 'Recovered journeys' WHEN 'completed' THEN 'Completed without recorded friction' WHEN 'failed' THEN 'Configured failure' ELSE 'No configured outcome' END AS label,
      COUNT(*) AS session_count, SUM(interaction_count) AS interaction_count,
      SUM(completed) AS completed_session_count, SUM(friction) AS friction_session_count
    FROM classified GROUP BY group_key ORDER BY group_key`;
}

function taskSql() {
  return `/* compare:task */
    WITH parameters AS (
      SELECT ? AS tenant_id, ? AS start_at_ms, ? AS end_at_ms, ? AS model_key, ? AS model_version
    ), contextual AS (
      SELECT e.session_id, e.id, e.action, esc.transaction_key, esc.task_key, esc.outcome_type, sme.label AS task_label
      FROM parameters p INNER JOIN events e ON e.tenant_id = p.tenant_id
      INNER JOIN event_service_contexts esc ON esc.event_id = e.id AND esc.model_key = p.model_key AND esc.model_version = p.model_version
      INNER JOIN service_model_entities sme ON sme.tenant_id = p.tenant_id AND sme.model_key = p.model_key AND sme.version = p.model_version AND sme.entity_key = esc.task_key
      WHERE e.occurred_at_ms >= p.start_at_ms AND e.occurred_at_ms < p.end_at_ms AND esc.task_key IS NOT NULL
    ), successes AS (
      SELECT DISTINCT session_id, transaction_key FROM contextual WHERE outcome_type = 'success'
    )
    SELECT c.task_key AS group_key, c.task_label AS label,
      COUNT(DISTINCT c.session_id) AS session_count, COUNT(*) AS interaction_count,
      COUNT(DISTINCT CASE WHEN s.session_id IS NOT NULL THEN c.session_id END) AS completed_session_count,
      COUNT(DISTINCT CASE WHEN c.action IN ('error.invalid', 'act.rage', 'field.revisit', 'assist.help') THEN c.session_id END) AS friction_session_count
    FROM contextual c
    LEFT JOIN successes s ON s.session_id = c.session_id AND s.transaction_key = c.transaction_key
    GROUP BY c.task_key, c.task_label ORDER BY session_count DESC, c.task_label`;
}

function interactionModeSql() {
  return `/* compare:interaction_mode */
    WITH parameters AS (
      SELECT ? AS tenant_id, ? AS start_at_ms, ? AS end_at_ms, ? AS model_key, ? AS model_version
    ), selected AS (
      SELECT e.session_id, COUNT(*) AS interaction_count,
        MAX(CASE WHEN json_extract(e.metadata_json, '$.pointer_type') = 'keyboard' THEN 1 ELSE 0 END) AS keyboard_used,
        MAX(CASE WHEN json_extract(e.metadata_json, '$.pointer_type') = 'touch' THEN 1 ELSE 0 END) AS touch_used,
        MAX(CASE WHEN json_extract(e.metadata_json, '$.pointer_type') IN ('mouse', 'pen') THEN 1 ELSE 0 END) AS pointer_used,
        MAX(CASE WHEN esc.outcome_type = 'success' THEN 1 ELSE 0 END) AS completed,
        MAX(CASE WHEN e.action IN ('error.invalid', 'act.rage', 'field.revisit', 'assist.help') THEN 1 ELSE 0 END) AS friction
      FROM parameters p INNER JOIN events e ON e.tenant_id = p.tenant_id
      LEFT JOIN event_service_contexts esc ON esc.event_id = e.id AND esc.model_key = p.model_key AND esc.model_version = p.model_version
      WHERE e.occurred_at_ms >= p.start_at_ms AND e.occurred_at_ms < p.end_at_ms
      GROUP BY e.session_id
    ), classified AS (
      SELECT *, CASE
        WHEN keyboard_used + touch_used + pointer_used > 1 THEN 'mixed'
        WHEN keyboard_used = 1 THEN 'keyboard'
        WHEN touch_used = 1 THEN 'touch'
        WHEN pointer_used = 1 THEN 'pointer'
        ELSE 'unknown' END AS group_key
      FROM selected
    )
    SELECT group_key, CASE group_key WHEN 'mixed' THEN 'Mixed-input journeys' WHEN 'keyboard' THEN 'Keyboard journeys' WHEN 'touch' THEN 'Touch journeys' WHEN 'pointer' THEN 'Mouse or pen journeys' ELSE 'Unclassified interaction mode' END AS label,
      COUNT(*) AS session_count, SUM(interaction_count) AS interaction_count,
      SUM(completed) AS completed_session_count, SUM(friction) AS friction_session_count
    FROM classified GROUP BY group_key ORDER BY group_key`;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function rate(value, total) {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
}

function decimal(value, total) {
  return total > 0 ? Math.round((value / total) * 10) / 10 : 0;
}
