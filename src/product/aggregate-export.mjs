const REPORTS = new Set(['overview', 'events', 'key_events', 'elements', 'entities', 'funnels', 'fields', 'comparison']);

export function isAggregateExportReport(value) {
  return REPORTS.has(value);
}

export function buildAggregateExport({ report, data, provenance }) {
  if (!isAggregateExportReport(report)) throw new RangeError('unsupported_export_report');
  return { provenance: normaliseProvenance(provenance), rows: exportRows(report, data ?? {}) };
}

export function buildAggregateCsv({ provenance, rows }) {
  const headings = [
    'source', 'generated_at', 'tenant_id', 'report', 'record_type', 'key', 'label', 'metric', 'value', 'sample_size',
    'range', 'range_start', 'range_end', 'compare', 'model_key', 'model_version', 'event_schema_version', 'suppression_note', 'caveat'
  ];
  const lines = [headings.join(',')];
  for (const row of rows.slice(0, 5000)) {
    const output = { ...provenance, ...row };
    lines.push(headings.map((heading) => csvCell(output[heading])).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

function exportRows(report, data) {
  if (report === 'overview') return metrics('overview', 'overview', 'Audience overview', data, [
    'visitor_count', 'new_visitor_count', 'returning_visitor_count', 'returning_visitor_rate', 'session_count', 'event_count',
    'events_per_session', 'average_session_duration_ms', 'median_field_dwell_ms', 'correction_rate', 'completion_rate', 'friction_session_count'
  ], data.session_count);
  if (report === 'events') return flatten(data.events, report, 'event', (row) => `${row.event_class}:${row.action}`, (row) => row.action, ['event_count', 'session_count', 'sessions_rate', 'previous_event_count', 'event_count_change']);
  if (report === 'key_events') return flatten(data.key_events, report, 'key_event', (row) => row.key_event_key, (row) => row.label, ['event_count', 'session_count', 'sessions_rate', 'previous_event_count', 'event_count_change']);
  if (report === 'elements') return flatten(data.elements, report, 'element', (row) => row.element_key, (row) => row.entity_label, ['event_count', 'session_count', 'sessions_rate', 'previous_event_count', 'event_count_change']);
  if (report === 'entities') return flatten(data.entities, report, 'entity', (row) => row.entity_key, (row) => row.label, ['interaction_count', 'session_count', 'sessions_rate', 'entry_session_count', 'exit_session_count', 'success_session_count', 'success_rate', 'friction_session_count', 'friction_rate', 'average_duration_ms', 'session_count_change']);
  if (report === 'comparison') return flatten(data.rows, report, 'comparison_group', (row) => row.group_key, (row) => row.label, ['suppressed', 'session_count', 'interaction_count', 'interactions_per_session', 'completed_session_count', 'completion_rate', 'friction_session_count', 'friction_rate']);
  if (report === 'funnels') return funnelRows(data.transactions ?? []);
  return fieldRows(data.fields ?? []);
}

function funnelRows(transactions) {
  const rows = [];
  for (const transaction of transactions) {
    rows.push(...metrics('funnels', 'transaction', transaction.label, transaction, [
      'started_session_count', 'completed_session_count', 'completion_rate', 'failed_session_count', 'failure_rate',
      'abandoned_session_count', 'abandonment_rate', 'in_progress_session_count', 'friction_session_count',
      'recovered_session_count', 'recovery_rate', 'median_completion_ms', 'p90_completion_ms', 'completion_rate_change'
    ], transaction.started_session_count, transaction.transaction_key));
    for (const step of transaction.steps ?? []) rows.push(...metrics('funnels', 'funnel_step', step.label, step, ['position', 'session_count', 'reach_rate', 'step_dropoff_count', 'step_dropoff_rate'], transaction.started_session_count, step.step_key));
  }
  return rows;
}

function fieldRows(fields) {
  const rows = [];
  for (const field of fields) {
    rows.push(...metrics('fields', 'field', field.label, field, [
      'required', 'complexity', 'exposed_session_count', 'interacted_session_count', 'coverage_rate', 'non_interaction_session_count',
      'edited_session_count', 'edited_completion_rate', 'validation_session_count', 'validation_rate',
      'required_skip_attempt_session_count', 'successful_outcome_session_count', 'successful_outcome_rate', 'correction_count', 'coverage_rate_change'
    ], field.exposed_session_count, field.field_key));
    for (const [bucket, value] of Object.entries(field.dwell_distribution ?? {})) rows.push(row('fields', 'field', field.field_key, field.label, `dwell_${bucket}`, value, field.interacted_session_count));
    for (const [bucket, value] of Object.entries(field.length_distribution ?? {})) rows.push(row('fields', 'field', field.field_key, field.label, `length_${bucket}`, value, field.interacted_session_count));
  }
  return rows;
}

function flatten(items = [], report, recordType, key, label, names) {
  return items.flatMap((item) => metrics(report, recordType, label(item), item, names, item.session_count, key(item)));
}

function metrics(report, recordType, label, source, names, sampleSize, key = recordType) {
  return names.filter((name) => source[name] !== undefined).map((name) => row(report, recordType, key, label, name, source[name], sampleSize));
}

function row(report, recordType, key, label, metric, value, sampleSize) {
  return { report, record_type: recordType, key, label, metric, value, sample_size: sampleSize ?? '' };
}

function normaliseProvenance(value = {}) {
  return {
    source: value.source ?? 'Flux Behaviour aggregate dashboard',
    generated_at: value.generated_at ?? new Date().toISOString(),
    tenant_id: value.tenant_id ?? '',
    range: value.range ?? '',
    range_start: value.range_start ?? '',
    range_end: value.range_end ?? '',
    compare: value.compare ?? '',
    model_key: value.model_key ?? '',
    model_version: value.model_version ?? '',
    event_schema_version: value.event_schema_version ?? '',
    suppression_note: value.suppression_note ?? '',
    caveat: value.caveat ?? 'Aggregate service evidence; no raw events or entered values.'
  };
}

function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value !== 'number' && /^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
