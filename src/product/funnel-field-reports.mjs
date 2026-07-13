export function buildFunnelReport({ model, comparisonAvailable = true, summaries = [], steps = [], previousSummaries = [] }) {
  const entities = new Map((model?.entities ?? []).map((entity) => [entity.key, entity]));
  const summariesByTransaction = new Map(summaries.map((row) => [row.transaction_key, row]));
  const previous = new Map(previousSummaries.map((row) => [row.transaction_key, row]));
  const configuredSteps = transactionSteps(model?.entities ?? []);
  return {
    comparison_available: comparisonAvailable,
    transactions: (model?.entities ?? []).filter(({ type }) => type === 'transaction').map((transaction) => {
      const row = summariesByTransaction.get(transaction.key) ?? { transaction_key: transaction.key };
      const started = number(row.started_session_count);
      const completed = number(row.completed_session_count);
      const friction = number(row.friction_session_count);
      const previousRow = previous.get(row.transaction_key);
      const previousCompletionRate = comparisonAvailable && previousRow ? rate(previousRow.completed_session_count, previousRow.started_session_count) : null;
      let previousStepCount = started;
      const funnelSteps = (configuredSteps.get(row.transaction_key) ?? []).map((step) => {
        const evidence = steps.find((candidate) => candidate.transaction_key === row.transaction_key && candidate.step_key === step.key);
        const sessionCount = number(evidence?.session_count);
        const dropoffCount = Math.max(0, previousStepCount - sessionCount);
        const result = {
          step_key: step.key,
          label: step.label,
          position: step.funnel_position,
          session_count: sessionCount,
          reach_rate: rate(sessionCount, started),
          previous_step_session_count: previousStepCount,
          step_dropoff_count: dropoffCount,
          step_dropoff_rate: rate(dropoffCount, previousStepCount)
        };
        previousStepCount = sessionCount;
        return result;
      });
      const completionRate = rate(completed, started);
      return {
        transaction_key: row.transaction_key,
        label: entities.get(row.transaction_key)?.label ?? row.transaction_key,
        started_session_count: started,
        completed_session_count: completed,
        completion_rate: completionRate,
        failed_session_count: number(row.failed_session_count),
        failure_rate: rate(row.failed_session_count, started),
        abandoned_session_count: number(row.abandoned_session_count),
        abandonment_rate: rate(row.abandoned_session_count, started),
        in_progress_session_count: number(row.in_progress_session_count),
        friction_session_count: friction,
        recovered_session_count: number(row.recovered_session_count),
        recovery_rate: rate(row.recovered_session_count, friction),
        median_completion_ms: number(row.median_completion_ms),
        p90_completion_ms: number(row.p90_completion_ms),
        previous_completion_rate: previousCompletionRate,
        completion_rate_change: previousCompletionRate === null ? null : Math.round((completionRate - previousCompletionRate) * 10) / 10,
        steps: funnelSteps
      };
    }).sort((left, right) => number(entities.get(left.transaction_key)?.position) - number(entities.get(right.transaction_key)?.position))
  };
}

export function buildFieldReport({ comparisonAvailable = true, rows = [], previousRows = [] }) {
  const previous = new Map(previousRows.map((row) => [row.field_key, row]));
  return {
    comparison_available: comparisonAvailable,
    fields: rows.map((row) => {
      const exposed = number(row.exposed_session_count);
      const interacted = number(row.interacted_session_count);
      const previousRow = previous.get(row.field_key);
      const previousCoverageRate = comparisonAvailable && previousRow ? rate(previousRow.interacted_session_count, previousRow.exposed_session_count) : null;
      const coverageRate = rate(interacted, exposed);
      return {
        field_key: row.field_key,
        label: row.label,
        required: Boolean(row.required),
        complexity: row.complexity === null || row.complexity === undefined ? null : number(row.complexity),
        exposed_session_count: exposed,
        interacted_session_count: interacted,
        coverage_rate: coverageRate,
        non_interaction_session_count: Math.max(0, exposed - interacted),
        edited_session_count: number(row.edited_session_count),
        edited_completion_rate: rate(row.edited_session_count, exposed),
        validation_session_count: number(row.validation_session_count),
        validation_rate: rate(row.validation_session_count, interacted),
        required_skip_attempt_session_count: number(row.required_skip_attempt_session_count),
        successful_outcome_session_count: number(row.successful_outcome_session_count),
        successful_outcome_rate: rate(row.successful_outcome_session_count, interacted),
        correction_count: number(row.correction_count),
        dwell_distribution: {
          under_1s: number(row.dwell_under_1s),
          from_1_to_5s: number(row.dwell_1_5s),
          from_5_to_15s: number(row.dwell_5_15s),
          from_15_to_60s: number(row.dwell_15_60s),
          over_60s: number(row.dwell_over_60s)
        },
        length_distribution: {
          empty: number(row.length_empty),
          from_1_to_20: number(row.length_1_20),
          from_21_to_100: number(row.length_21_100),
          from_101_to_500: number(row.length_101_500),
          over_500: number(row.length_over_500)
        },
        previous_coverage_rate: previousCoverageRate,
        coverage_rate_change: previousCoverageRate === null ? null : Math.round((coverageRate - previousCoverageRate) * 10) / 10
      };
    }).sort((left, right) => Number(right.required) - Number(left.required) || left.label.localeCompare(right.label))
  };
}

export async function dashboardFunnelFieldReports(db, {
  tenantId,
  model,
  startAtMs,
  endAtMs,
  previousStartAtMs,
  previousEndAtMs
}) {
  const hasComparison = previousStartAtMs !== null && previousStartAtMs !== undefined;
  const modelValues = [model.model_key, model.version];
  const [summaries, previousSummaries, steps, fields, previousFields] = await Promise.all([
    query(db, funnelSql('current'), [tenantId, startAtMs, endAtMs, ...modelValues, tenantId, endAtMs - 1800000, endAtMs - 1800000]),
    hasComparison ? query(db, funnelSql('previous'), [tenantId, previousStartAtMs, previousEndAtMs, ...modelValues, tenantId, previousEndAtMs - 1800000, previousEndAtMs - 1800000]) : Promise.resolve([]),
    query(db, funnelStepsSql(), [tenantId, ...modelValues, tenantId, startAtMs, endAtMs, ...modelValues]),
    query(db, fieldsSql('current'), [tenantId, ...modelValues, tenantId, startAtMs, endAtMs, ...modelValues]),
    hasComparison ? query(db, fieldsSql('previous'), [tenantId, ...modelValues, tenantId, previousStartAtMs, previousEndAtMs, ...modelValues]) : Promise.resolve([])
  ]);
  return {
    funnels: buildFunnelReport({ model, comparisonAvailable: hasComparison, summaries, steps, previousSummaries }),
    fields: buildFieldReport({ comparisonAvailable: hasComparison, rows: fields, previousRows: previousFields })
  };
}

async function query(db, sql, values) {
  const result = await db.prepare(sql).bind(...values).all();
  return result.results ?? [];
}

function funnelSql(period) {
  return `/* report-funnels:${period} */
    WITH transaction_events AS (
      SELECT e.session_id, esc.transaction_key, e.occurred_at_ms, e.action, esc.outcome_type
      FROM events e INNER JOIN event_service_contexts esc ON esc.event_id = e.id
      WHERE e.tenant_id = ? AND e.occurred_at_ms >= ? AND e.occurred_at_ms < ?
        AND esc.model_key = ? AND esc.model_version = ? AND esc.transaction_key IS NOT NULL
    ), session_transactions AS (
      SELECT te.session_id, te.transaction_key, s.last_seen_at_ms,
        MIN(te.occurred_at_ms) AS started_at_ms,
        MIN(CASE WHEN te.outcome_type = 'success' THEN te.occurred_at_ms END) AS completed_at_ms,
        MAX(CASE WHEN te.outcome_type = 'success' THEN te.occurred_at_ms END) AS last_success_at_ms,
        MAX(CASE WHEN te.outcome_type = 'failure' THEN 1 ELSE 0 END) AS has_failure,
        MIN(CASE WHEN te.action IN ('error.invalid', 'act.rage', 'field.revisit', 'assist.help') THEN te.occurred_at_ms END) AS friction_at_ms,
        MIN(CASE WHEN te.action = 'error.recovered' THEN te.occurred_at_ms END) AS recovery_at_ms
      FROM transaction_events te INNER JOIN sessions s ON s.id = te.session_id AND s.tenant_id = ?
      GROUP BY te.session_id, te.transaction_key, s.last_seen_at_ms
    ), completion_durations AS (
      SELECT transaction_key, completed_at_ms - started_at_ms AS duration_ms
      FROM session_transactions WHERE completed_at_ms IS NOT NULL
    ), ordered_durations AS (
      SELECT transaction_key, duration_ms,
        ROW_NUMBER() OVER (PARTITION BY transaction_key ORDER BY duration_ms) AS duration_rank,
        COUNT(*) OVER (PARTITION BY transaction_key) AS duration_count
      FROM completion_durations
    ), duration_stats AS (
      SELECT transaction_key,
        AVG(CASE WHEN duration_rank IN ((duration_count + 1) / 2, (duration_count + 2) / 2) THEN duration_ms END) AS median_completion_ms,
        MIN(CASE WHEN duration_rank >= ((duration_count * 9 + 9) / 10) THEN duration_ms END) AS p90_completion_ms
      FROM ordered_durations GROUP BY transaction_key
    )
    SELECT st.transaction_key,
      COUNT(*) AS started_session_count,
      SUM(CASE WHEN st.completed_at_ms IS NOT NULL THEN 1 ELSE 0 END) AS completed_session_count,
      SUM(CASE WHEN st.completed_at_ms IS NULL AND st.has_failure = 1 THEN 1 ELSE 0 END) AS failed_session_count,
      SUM(CASE WHEN st.last_seen_at_ms <= ? AND st.completed_at_ms IS NULL AND st.has_failure = 0 THEN 1 ELSE 0 END) AS abandoned_session_count,
      SUM(CASE WHEN st.last_seen_at_ms > ? AND st.completed_at_ms IS NULL AND st.has_failure = 0 THEN 1 ELSE 0 END) AS in_progress_session_count,
      SUM(CASE WHEN st.friction_at_ms IS NOT NULL THEN 1 ELSE 0 END) AS friction_session_count,
      SUM(CASE WHEN st.friction_at_ms IS NOT NULL AND ((st.recovery_at_ms IS NOT NULL AND st.recovery_at_ms > st.friction_at_ms) OR (st.last_success_at_ms IS NOT NULL AND st.last_success_at_ms > st.friction_at_ms)) THEN 1 ELSE 0 END) AS recovered_session_count,
      ds.median_completion_ms, ds.p90_completion_ms
    FROM session_transactions st LEFT JOIN duration_stats ds ON ds.transaction_key = st.transaction_key
    GROUP BY st.transaction_key, ds.median_completion_ms, ds.p90_completion_ms`;
}

function funnelStepsSql() {
  return `/* report-funnel-steps:current */
    WITH RECURSIVE step_config AS (
      SELECT txn.entity_key AS transaction_key, step.entity_key AS step_key,
        ROW_NUMBER() OVER (PARTITION BY txn.entity_key ORDER BY task.position, step.position, step.entity_key) AS funnel_position
      FROM service_model_entities step
      INNER JOIN service_model_entities task
        ON task.tenant_id = step.tenant_id AND task.model_key = step.model_key AND task.version = step.version AND task.entity_key = step.parent_key
      INNER JOIN service_model_entities txn
        ON txn.tenant_id = task.tenant_id AND txn.model_key = task.model_key AND txn.version = task.version AND txn.entity_key = task.parent_key
      WHERE step.tenant_id = ? AND step.model_key = ? AND step.version = ? AND step.entity_type = 'step'
    ), step_events AS (
      SELECT e.session_id, esc.transaction_key, esc.step_key, e.occurred_at_ms, e.id
      FROM events e INNER JOIN event_service_contexts esc ON esc.event_id = e.id
      WHERE e.tenant_id = ? AND e.occurred_at_ms >= ? AND e.occurred_at_ms < ?
        AND esc.model_key = ? AND esc.model_version = ?
        AND esc.transaction_key IS NOT NULL AND esc.step_key IS NOT NULL
    ), qualified_steps(transaction_key, session_id, funnel_position, step_key, qualified_at_ms, event_id) AS (
      SELECT sc.transaction_key, se.session_id, sc.funnel_position, sc.step_key, se.occurred_at_ms, se.id
      FROM step_config sc INNER JOIN step_events se
        ON se.transaction_key = sc.transaction_key AND se.step_key = sc.step_key
      WHERE sc.funnel_position = 1 AND NOT EXISTS (
        SELECT 1 FROM step_events earlier
        WHERE earlier.session_id = se.session_id AND earlier.transaction_key = se.transaction_key
          AND earlier.step_key = se.step_key
          AND (earlier.occurred_at_ms < se.occurred_at_ms OR (earlier.occurred_at_ms = se.occurred_at_ms AND earlier.id < se.id))
      )
      UNION ALL
      SELECT sc.transaction_key, qualified.session_id, sc.funnel_position, sc.step_key, se.occurred_at_ms, se.id
      FROM qualified_steps qualified
      INNER JOIN step_config sc
        ON sc.transaction_key = qualified.transaction_key AND sc.funnel_position = qualified.funnel_position + 1
      INNER JOIN step_events se
        ON se.session_id = qualified.session_id AND se.transaction_key = sc.transaction_key AND se.step_key = sc.step_key
        AND (se.occurred_at_ms > qualified.qualified_at_ms OR (se.occurred_at_ms = qualified.qualified_at_ms AND se.id > qualified.event_id))
      WHERE NOT EXISTS (
        SELECT 1 FROM step_events earlier
        WHERE earlier.session_id = se.session_id AND earlier.transaction_key = se.transaction_key AND earlier.step_key = se.step_key
          AND (earlier.occurred_at_ms > qualified.qualified_at_ms OR (earlier.occurred_at_ms = qualified.qualified_at_ms AND earlier.id > qualified.event_id))
          AND (earlier.occurred_at_ms < se.occurred_at_ms OR (earlier.occurred_at_ms = se.occurred_at_ms AND earlier.id < se.id))
      )
    )
    SELECT sc.transaction_key, sc.step_key, COUNT(DISTINCT qualified.session_id) AS session_count
    FROM step_config sc LEFT JOIN qualified_steps qualified
      ON qualified.transaction_key = sc.transaction_key AND qualified.step_key = sc.step_key
    GROUP BY sc.transaction_key, sc.step_key, sc.funnel_position`;
}

function fieldsSql(period) {
  return `/* report-fields:${period} */
    WITH field_config AS (
      SELECT f.entity_key AS field_key, f.label, f.required, q.complexity,
        step.entity_key AS step_key, txn.entity_key AS transaction_key
      FROM service_model_entities f
      INNER JOIN service_model_entities q
        ON q.tenant_id = f.tenant_id AND q.model_key = f.model_key AND q.version = f.version AND q.entity_key = f.parent_key
      INNER JOIN service_model_entities step
        ON step.tenant_id = q.tenant_id AND step.model_key = q.model_key AND step.version = q.version AND step.entity_key = q.parent_key
      INNER JOIN service_model_entities task
        ON task.tenant_id = step.tenant_id AND task.model_key = step.model_key AND task.version = step.version AND task.entity_key = step.parent_key
      INNER JOIN service_model_entities txn
        ON txn.tenant_id = task.tenant_id AND txn.model_key = task.model_key AND txn.version = task.version AND txn.entity_key = task.parent_key
      WHERE f.tenant_id = ? AND f.model_key = ? AND f.version = ? AND f.entity_type = 'field'
    ), contextual_events AS (
      SELECT e.id, e.session_id, e.occurred_at_ms, e.action, e.metadata_json, esc.transaction_key, esc.step_key, esc.field_key, esc.outcome_type
      FROM events e INNER JOIN event_service_contexts esc ON esc.event_id = e.id
      WHERE e.tenant_id = ? AND e.occurred_at_ms >= ? AND e.occurred_at_ms < ?
        AND esc.model_key = ? AND esc.model_version = ?
    ), step_sessions AS (
      SELECT DISTINCT step_key, session_id FROM contextual_events WHERE step_key IS NOT NULL
    ), transaction_successes AS (
      SELECT transaction_key, session_id, MAX(occurred_at_ms) AS success_at_ms
      FROM contextual_events WHERE outcome_type = 'success' GROUP BY transaction_key, session_id
    ), latest_field_blurs AS (
      SELECT field_key, session_id, dwell_ms, value_length FROM (
        SELECT field_key, session_id,
          CAST(json_extract(metadata_json, '$.dwell_before_input_ms') AS INTEGER) AS dwell_ms,
          CAST(json_extract(metadata_json, '$.value_length') AS INTEGER) AS value_length,
          ROW_NUMBER() OVER (PARTITION BY field_key, session_id ORDER BY occurred_at_ms DESC, id DESC) AS blur_rank
        FROM contextual_events WHERE field_key IS NOT NULL AND action = 'field.blur'
      ) WHERE blur_rank = 1
    ), field_sessions AS (
      SELECT field_key, session_id,
        MIN(occurred_at_ms) AS first_interacted_at_ms,
        MAX(CASE WHEN action = 'field.blur' AND (COALESCE(CAST(json_extract(metadata_json, '$.key_press_count') AS INTEGER), 0) > 0 OR COALESCE(CAST(json_extract(metadata_json, '$.edit_count') AS INTEGER), 0) > 0 OR COALESCE(CAST(json_extract(metadata_json, '$.paste_count') AS INTEGER), 0) > 0) THEN 1 ELSE 0 END) AS edited,
        MAX(CASE WHEN action = 'error.invalid' THEN 1 ELSE 0 END) AS validation,
        MAX(CASE WHEN action = 'error.invalid' AND json_extract(metadata_json, '$.reason') = 'empty_field' THEN 1 ELSE 0 END) AS required_skip_attempt,
        SUM(CASE WHEN action = 'field.blur' THEN COALESCE(CAST(json_extract(metadata_json, '$.backspace_count') AS INTEGER), 0) ELSE 0 END) AS correction_count
      FROM contextual_events WHERE field_key IS NOT NULL GROUP BY field_key, session_id
    )
    SELECT fc.field_key, fc.label, fc.required, fc.complexity,
      COUNT(DISTINCT ss.session_id) AS exposed_session_count,
      COUNT(DISTINCT fs.session_id) AS interacted_session_count,
      COALESCE(SUM(fs.edited), 0) AS edited_session_count,
      COALESCE(SUM(fs.validation), 0) AS validation_session_count,
      COALESCE(SUM(CASE WHEN fc.required = 1 THEN fs.required_skip_attempt ELSE 0 END), 0) AS required_skip_attempt_session_count,
      COUNT(DISTINCT CASE WHEN ts.success_at_ms > fs.first_interacted_at_ms THEN fs.session_id END) AS successful_outcome_session_count,
      COALESCE(SUM(fs.correction_count), 0) AS correction_count,
      COALESCE(SUM(CASE WHEN latest.dwell_ms < 1000 THEN 1 ELSE 0 END), 0) AS dwell_under_1s,
      COALESCE(SUM(CASE WHEN latest.dwell_ms >= 1000 AND latest.dwell_ms < 5000 THEN 1 ELSE 0 END), 0) AS dwell_1_5s,
      COALESCE(SUM(CASE WHEN latest.dwell_ms >= 5000 AND latest.dwell_ms < 15000 THEN 1 ELSE 0 END), 0) AS dwell_5_15s,
      COALESCE(SUM(CASE WHEN latest.dwell_ms >= 15000 AND latest.dwell_ms < 60000 THEN 1 ELSE 0 END), 0) AS dwell_15_60s,
      COALESCE(SUM(CASE WHEN latest.dwell_ms >= 60000 THEN 1 ELSE 0 END), 0) AS dwell_over_60s,
      COALESCE(SUM(CASE WHEN latest.value_length = 0 THEN 1 ELSE 0 END), 0) AS length_empty,
      COALESCE(SUM(CASE WHEN latest.value_length BETWEEN 1 AND 20 THEN 1 ELSE 0 END), 0) AS length_1_20,
      COALESCE(SUM(CASE WHEN latest.value_length BETWEEN 21 AND 100 THEN 1 ELSE 0 END), 0) AS length_21_100,
      COALESCE(SUM(CASE WHEN latest.value_length BETWEEN 101 AND 500 THEN 1 ELSE 0 END), 0) AS length_101_500,
      COALESCE(SUM(CASE WHEN latest.value_length > 500 THEN 1 ELSE 0 END), 0) AS length_over_500
    FROM field_config fc
    LEFT JOIN step_sessions ss ON ss.step_key = fc.step_key
    LEFT JOIN field_sessions fs ON fs.field_key = fc.field_key AND fs.session_id = ss.session_id
    LEFT JOIN latest_field_blurs latest ON latest.field_key = fc.field_key AND latest.session_id = ss.session_id
    LEFT JOIN transaction_successes ts ON ts.transaction_key = fc.transaction_key AND ts.session_id = ss.session_id
    GROUP BY fc.field_key, fc.label, fc.required, fc.complexity`;
}

function transactionSteps(entities) {
  const tasks = entities.filter(({ type }) => type === 'task').sort(byPosition);
  const steps = entities.filter(({ type }) => type === 'step');
  const result = new Map();
  for (const task of tasks) {
    const transaction = task.parent_key;
    const list = result.get(transaction) ?? [];
    for (const step of steps.filter((candidate) => candidate.parent_key === task.key).sort(byPosition)) {
      list.push({ ...step, funnel_position: list.length + 1 });
    }
    result.set(transaction, list);
  }
  return result;
}

function byPosition(left, right) {
  return number(left.position) - number(right.position);
}

function rate(value, total) {
  return number(total) > 0 ? Math.round((number(value) / number(total)) * 1000) / 10 : 0;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
