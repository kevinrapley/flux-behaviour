export function buildEventReport({
  selectedSessionCount,
  comparisonAvailable = true,
  eventRows = [],
  previousEventRows = [],
  keyEventRows = [],
  previousKeyEventRows = [],
  elementRows = [],
  previousElementRows = [],
  trendRows = [],
  startAtMs,
  endAtMs
}) {
  const previousEvents = new Map(previousEventRows.map((row) => [`${row.event_class}:${row.action}`, row]));
  const previousKeyEvents = new Map(previousKeyEventRows.map((row) => [row.key_event_key, row]));
  const previousElements = new Map(previousElementRows.map((row) => [`${row.element_key}:${row.role}`, row]));
  return {
    comparison_available: comparisonAvailable,
    events: eventRows.map((row) => eventRow(row, previousEvents.get(`${row.event_class}:${row.action}`), selectedSessionCount, comparisonAvailable))
      .sort((left, right) => right.event_count - left.event_count || left.action.localeCompare(right.action)),
    key_events: keyEventRows.map((row) => keyEventRow(row, previousKeyEvents.get(row.key_event_key), selectedSessionCount, comparisonAvailable))
      .sort((left, right) => right.event_count - left.event_count || left.label.localeCompare(right.label)),
    elements: elementRows.map((row) => elementRow(row, previousElements.get(`${row.element_key}:${row.role}`), selectedSessionCount, comparisonAvailable))
      .sort((left, right) => right.event_count - left.event_count || left.element_key.localeCompare(right.element_key)),
    trend: completeDailyTrend(trendRows, startAtMs, endAtMs)
  };
}

function completeDailyTrend(rows, startAtMs, endAtMs) {
  const normalised = new Map(rows.map((row) => [row.day, {
    day: row.day,
    event_count: number(row.event_count),
    key_event_count: number(row.key_event_count)
  }]));
  const dayCount = Math.ceil((Number(endAtMs) - Number(startAtMs)) / 86400000);
  if (!Number.isFinite(dayCount) || dayCount < 1 || dayCount > 370 || Number(startAtMs) <= 0) return [...normalised.values()].sort((left, right) => left.day.localeCompare(right.day));
  return Array.from({ length: dayCount }, (_, index) => {
    const day = new Date(Number(startAtMs) + (index * 86400000)).toISOString().slice(0, 10);
    return normalised.get(day) ?? { day, event_count: 0, key_event_count: 0 };
  });
}

function elementRow(row, previous, selectedSessionCount, comparisonAvailable) {
  const eventCount = number(row.event_count);
  const sessionCount = number(row.session_count);
  const previousEventCount = comparisonAvailable ? number(previous?.event_count) : null;
  return {
    element_key: row.element_key,
    role: row.role,
    entity_key: row.entity_key,
    entity_label: row.entity_label,
    event_count: eventCount,
    session_count: sessionCount,
    sessions_rate: rate(sessionCount, selectedSessionCount),
    previous_event_count: previousEventCount,
    event_count_change: comparisonAvailable ? change(eventCount, previousEventCount) : null
  };
}

export function buildEntityReport({ selectedSessionCount, comparisonAvailable = true, rows = [], previousRows = [] }) {
  const previous = new Map(previousRows.map((row) => [`${row.entity_type}:${row.entity_key}`, row]));
  const entities = rows.map((row) => {
    const sessionCount = number(row.session_count);
    const previousSessionCount = comparisonAvailable ? number(previous.get(`${row.entity_type}:${row.entity_key}`)?.session_count) : null;
    return {
      entity_type: row.entity_type,
      entity_key: row.entity_key,
      label: row.label,
      interaction_count: number(row.interaction_count),
      session_count: sessionCount,
      sessions_rate: rate(sessionCount, selectedSessionCount),
      entry_session_count: number(row.entry_session_count),
      exit_session_count: number(row.exit_session_count),
      success_session_count: number(row.success_session_count),
      success_rate: rate(row.success_session_count, sessionCount),
      friction_session_count: number(row.friction_session_count),
      friction_rate: rate(row.friction_session_count, sessionCount),
      average_duration_ms: number(row.average_duration_ms),
      complexity: row.complexity === null || row.complexity === undefined ? null : number(row.complexity),
      required: row.required === null || row.required === undefined ? null : Boolean(row.required),
      previous_session_count: previousSessionCount,
      session_count_change: comparisonAvailable ? change(sessionCount, previousSessionCount) : null
    };
  }).sort((left, right) => right.session_count - left.session_count || left.label.localeCompare(right.label));
  return {
    comparison_available: comparisonAvailable,
    entities,
    by_type: Object.fromEntries(['service', 'transaction', 'task', 'step', 'question', 'field'].map((type) => [type, entities.filter((row) => row.entity_type === type)]))
  };
}

export async function dashboardEventEntityReports(db, {
  tenantId,
  model,
  selectedSessionCount,
  startAtMs,
  endAtMs,
  previousStartAtMs,
  previousEndAtMs
}) {
  const hasComparison = previousStartAtMs !== null && previousStartAtMs !== undefined;
  const queries = [
    query(db, eventSql('current'), [tenantId, startAtMs, endAtMs]),
    hasComparison ? query(db, eventSql('previous'), [tenantId, previousStartAtMs, previousEndAtMs]) : Promise.resolve([]),
    query(db, keyEventSql('current'), [tenantId, startAtMs, endAtMs, model.model_key, model.version]),
    hasComparison ? query(db, keyEventSql('previous'), [tenantId, previousStartAtMs, previousEndAtMs, model.model_key, model.version]) : Promise.resolve([]),
    query(db, elementSql('current'), [tenantId, model.model_key, model.version, tenantId, startAtMs, endAtMs, model.model_key, model.version]),
    hasComparison ? query(db, elementSql('previous'), [tenantId, model.model_key, model.version, tenantId, previousStartAtMs, previousEndAtMs, model.model_key, model.version]) : Promise.resolve([]),
    query(db, trendSql(), [model.model_key, model.version, tenantId, startAtMs, endAtMs]),
    query(db, entitySql('current'), [tenantId, startAtMs, endAtMs, model.model_key, model.version, tenantId, model.model_key, model.version]),
    hasComparison ? query(db, entitySql('previous'), [tenantId, previousStartAtMs, previousEndAtMs, model.model_key, model.version, tenantId, model.model_key, model.version]) : Promise.resolve([])
  ];
  const [eventRows, previousEventRows, keyRows, previousKeyRows, elementRows, previousElementRows, trendRows, entityRows, previousEntityRows] = await Promise.all(queries);
  const keyEvents = new Map((model.key_events ?? []).map((row) => [row.key, row]));
  const outcomes = new Map((model.outcomes ?? []).map((row) => [row.key, row]));
  const reportSessionCount = number(eventRows[0]?.selected_session_count) || selectedSessionCount;
  const enrichKeyEvent = (row) => {
    const keyEvent = keyEvents.get(row.key_event_key);
    const outcome = outcomes.get(row.outcome_key ?? keyEvent?.outcome_key);
    return {
      ...row,
      label: keyEvent?.label ?? row.key_event_key,
      outcome_label: outcome?.label ?? row.outcome_key,
      outcome_type: outcome?.type ?? row.outcome_type
    };
  };
  return {
    events: buildEventReport({
      selectedSessionCount: reportSessionCount,
      comparisonAvailable: hasComparison,
      eventRows,
      previousEventRows,
      keyEventRows: keyRows.map(enrichKeyEvent),
      previousKeyEventRows: previousKeyRows,
      elementRows,
      previousElementRows,
      trendRows,
      startAtMs,
      endAtMs
    }),
    entities: buildEntityReport({ selectedSessionCount: reportSessionCount, comparisonAvailable: hasComparison, rows: entityRows, previousRows: previousEntityRows })
  };
}

async function query(db, sql, values) {
  const result = await db.prepare(sql).bind(...values).all();
  return result.results ?? [];
}

function eventSql(period) {
  return `/* report-events:${period} */
    WITH selected_events AS (
      SELECT event_class, action, session_id FROM events
      WHERE tenant_id = ? AND occurred_at_ms >= ? AND occurred_at_ms < ?
    ), selected_sessions AS (
      SELECT COUNT(DISTINCT session_id) AS selected_session_count FROM selected_events
    )
    SELECT event_class, action, COUNT(*) AS event_count, COUNT(DISTINCT session_id) AS session_count,
      selected_session_count
    FROM selected_events CROSS JOIN selected_sessions
    GROUP BY event_class, action, selected_session_count`;
}

function keyEventSql(period) {
  return `/* report-key-events:${period} */
    SELECT esc.key_event_key, esc.outcome_key, esc.outcome_type,
      COUNT(*) AS event_count, COUNT(DISTINCT e.session_id) AS session_count
    FROM event_service_contexts esc
    INNER JOIN events e ON e.id = esc.event_id
    WHERE e.tenant_id = ? AND e.occurred_at_ms >= ? AND e.occurred_at_ms < ?
      AND esc.model_key = ? AND esc.model_version = ? AND esc.key_event_key IS NOT NULL
    GROUP BY esc.key_event_key, esc.outcome_key, esc.outcome_type`;
}

function elementSql(period) {
  return `/* report-elements:${period} */
    SELECT e.element_key, e.role, esc.entity_key, sme.label AS entity_label,
      COUNT(*) AS event_count, COUNT(DISTINCT e.session_id) AS session_count
    FROM events e
    INNER JOIN event_service_contexts esc ON esc.event_id = e.id
    INNER JOIN service_model_entities sme
      ON sme.tenant_id = ? AND sme.model_key = ? AND sme.version = ? AND sme.entity_key = esc.entity_key
    WHERE e.tenant_id = ? AND e.occurred_at_ms >= ? AND e.occurred_at_ms < ?
      AND esc.model_key = ? AND esc.model_version = ?
    GROUP BY e.element_key, e.role, esc.entity_key, sme.label`;
}

function trendSql() {
  return `/* report-events:trend */
    SELECT strftime('%Y-%m-%d', e.occurred_at_ms / 1000, 'unixepoch') AS day,
      COUNT(*) AS event_count,
      SUM(CASE WHEN esc.key_event_key IS NOT NULL THEN 1 ELSE 0 END) AS key_event_count
    FROM events e
    LEFT JOIN event_service_contexts esc
      ON esc.event_id = e.id AND esc.model_key = ? AND esc.model_version = ?
    WHERE e.tenant_id = ? AND e.occurred_at_ms >= ? AND e.occurred_at_ms < ?
    GROUP BY day ORDER BY day`;
}

function entitySql(period) {
  return `/* report-entities:${period} */
    WITH contextual_events AS (
      SELECT e.id, e.session_id, e.occurred_at_ms, e.action, esc.outcome_type,
        esc.service_key, esc.transaction_key, esc.task_key, esc.step_key, esc.question_key, esc.field_key,
        esc.transaction_complexity
      FROM events e
      INNER JOIN event_service_contexts esc ON esc.event_id = e.id
      WHERE e.tenant_id = ? AND e.occurred_at_ms >= ? AND e.occurred_at_ms < ?
        AND esc.model_key = ? AND esc.model_version = ?
    ), successful_transactions AS (
      SELECT session_id, transaction_key
      FROM contextual_events
      WHERE outcome_type = 'success' AND transaction_key IS NOT NULL
      GROUP BY session_id, transaction_key
    ), entity_events AS (
      SELECT *, 'service' AS entity_type, service_key AS entity_key FROM contextual_events WHERE service_key IS NOT NULL
      UNION ALL SELECT *, 'transaction', transaction_key FROM contextual_events WHERE transaction_key IS NOT NULL
      UNION ALL SELECT *, 'task', task_key FROM contextual_events WHERE task_key IS NOT NULL
      UNION ALL SELECT *, 'step', step_key FROM contextual_events WHERE step_key IS NOT NULL
      UNION ALL SELECT *, 'question', question_key FROM contextual_events WHERE question_key IS NOT NULL
      UNION ALL SELECT *, 'field', field_key FROM contextual_events WHERE field_key IS NOT NULL
    ), ranked AS (
      SELECT entity_events.*,
        CASE WHEN successful_transactions.session_id IS NULL THEN 0 ELSE 1 END AS transaction_has_success,
        ROW_NUMBER() OVER (PARTITION BY entity_events.session_id, entity_events.entity_type ORDER BY entity_events.occurred_at_ms, entity_events.id, entity_events.entity_key) AS entry_rank,
        ROW_NUMBER() OVER (PARTITION BY entity_events.session_id, entity_events.entity_type ORDER BY entity_events.occurred_at_ms DESC, entity_events.id DESC, entity_events.entity_key DESC) AS exit_rank
      FROM entity_events
      LEFT JOIN successful_transactions
        ON successful_transactions.session_id = entity_events.session_id
        AND successful_transactions.transaction_key = entity_events.transaction_key
    ), session_entity AS (
      SELECT entity_type, entity_key, session_id,
        COUNT(*) AS interaction_count,
        MIN(occurred_at_ms) AS first_at_ms,
        MAX(occurred_at_ms) AS last_at_ms,
        MAX(CASE WHEN entry_rank = 1 THEN 1 ELSE 0 END) AS is_entry,
        MAX(CASE WHEN exit_rank = 1 THEN 1 ELSE 0 END) AS is_exit,
        MAX(transaction_has_success) AS has_success,
        MAX(CASE WHEN action IN ('error.invalid', 'act.rage', 'field.revisit', 'assist.help') THEN 1 ELSE 0 END) AS has_friction,
        MAX(transaction_complexity) AS transaction_complexity
      FROM ranked GROUP BY entity_type, entity_key, session_id
    )
    SELECT se.entity_type, se.entity_key, sme.label,
      SUM(se.interaction_count) AS interaction_count,
      COUNT(*) AS session_count,
      SUM(se.is_entry) AS entry_session_count,
      SUM(se.is_exit) AS exit_session_count,
      SUM(se.has_success) AS success_session_count,
      SUM(se.has_friction) AS friction_session_count,
      AVG(se.last_at_ms - se.first_at_ms) AS average_duration_ms,
      CASE WHEN se.entity_type = 'transaction' THEN AVG(se.transaction_complexity) ELSE MAX(sme.complexity) END AS complexity,
      MAX(sme.required) AS required
    FROM session_entity se
    INNER JOIN service_model_entities sme
      ON sme.tenant_id = ? AND sme.model_key = ? AND sme.version = ? AND sme.entity_key = se.entity_key
    GROUP BY se.entity_type, se.entity_key, sme.label`;
}

function eventRow(row, previous, selectedSessionCount, comparisonAvailable) {
  const eventCount = number(row.event_count);
  const sessionCount = number(row.session_count);
  const previousEventCount = comparisonAvailable ? number(previous?.event_count) : null;
  return {
    event_class: row.event_class,
    action: row.action,
    event_count: eventCount,
    session_count: sessionCount,
    sessions_rate: rate(sessionCount, selectedSessionCount),
    previous_event_count: previousEventCount,
    event_count_change: comparisonAvailable ? change(eventCount, previousEventCount) : null
  };
}

function keyEventRow(row, previous, selectedSessionCount, comparisonAvailable) {
  const eventCount = number(row.event_count);
  const sessionCount = number(row.session_count);
  const previousEventCount = comparisonAvailable ? number(previous?.event_count) : null;
  return {
    key_event_key: row.key_event_key,
    label: row.label,
    outcome_label: row.outcome_label,
    outcome_type: row.outcome_type,
    event_count: eventCount,
    session_count: sessionCount,
    sessions_rate: rate(sessionCount, selectedSessionCount),
    previous_event_count: previousEventCount,
    event_count_change: comparisonAvailable ? change(eventCount, previousEventCount) : null
  };
}

function rate(value, total) {
  return Number(total) > 0 ? Math.round((number(value) / Number(total)) * 1000) / 10 : 0;
}

function change(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
