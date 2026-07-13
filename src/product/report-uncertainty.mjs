const Z_95 = 1.959963984540054;

export function buildUncertaintyReport(overview = {}) {
  const rates = [
    rateEvidence('Returning visitors', overview.returning_visitor_count, overview.visitor_count),
    rateEvidence('Journey completion', overview.completed_session_count, overview.session_count),
    rateEvidence('Journeys with friction', overview.friction_session_count, overview.session_count)
  ].filter(Boolean);
  return {
    method: 'wilson_95',
    note: 'Intervals use the Wilson 95% method. They describe sampling uncertainty around the observed journeys; they do not correct collection gaps, selection effects or model error, and they do not establish cause.',
    rates
  };
}

export function wilsonInterval(numerator, denominator) {
  const total = whole(denominator);
  const observed = Math.min(total, whole(numerator));
  if (total === 0) return null;
  const proportion = observed / total;
  const zSquared = Z_95 ** 2;
  const denominatorTerm = 1 + (zSquared / total);
  const centre = (proportion + (zSquared / (2 * total))) / denominatorTerm;
  const margin = (Z_95 * Math.sqrt((proportion * (1 - proportion) / total) + (zSquared / (4 * total ** 2)))) / denominatorTerm;
  return { lower: percent(Math.max(0, centre - margin)), upper: percent(Math.min(1, centre + margin)) };
}

export function buildGovernanceReport({ realtime, serviceModel, eventSchemaVersion }) {
  const coverage = serviceModel?.coverage;
  return {
    boundary: 'This area reports aggregate collection and model evidence only. It never exposes visitor identifiers, session identifiers, narratives, entered values or raw events.',
    controls: [
      {
        key: 'freshness',
        label: 'Ingestion freshness',
        status: freshnessStatus(realtime?.freshness_status),
        evidence: freshnessEvidence(realtime)
      },
      {
        key: 'semantic_coverage',
        label: 'Published-model coverage',
        status: coverage ? `${number(coverage.mapping_rate)}% mapped` : 'Unavailable',
        evidence: coverage ? `${number(coverage.resolved_event_count)} of ${number(coverage.event_count)} current-model interactions mapped; ${number(coverage.unmapped_event_count)} unmapped and ${number(coverage.retired_model_event_count)} attributed to retired versions.` : 'No valid published service model was available.'
      },
      {
        key: 'versions',
        label: 'Schema and model versions',
        status: serviceModel ? 'Versioned' : 'Schema only',
        evidence: `Event schema ${eventSchemaVersion}; ${serviceModel ? `model ${serviceModel.model_key} version ${serviceModel.version}` : 'no valid published model'}.`
      },
      {
        key: 'export',
        label: 'Export boundary',
        status: 'Aggregate only',
        evidence: 'Allow-listed CSV reports include filters, generation time, schema/model versions, suppression and caveats; raw-event export is unavailable.'
      }
    ],
    limitations: [
      'Collector acceptance and drop rates are not yet measured end to end.',
      'Consent-choice rates are not reported because Flux currently stores consented analytics events, not a complete denominator of all service visits.',
      'Production retention and deletion controls remain a release gate.',
      'Rates and comparisons remain descriptive service evidence and may be affected by collection gaps or model coverage.'
    ]
  };
}

function rateEvidence(label, numeratorValue, denominatorValue) {
  const denominator = whole(denominatorValue);
  if (denominator === 0) return null;
  const numerator = Math.min(denominator, whole(numeratorValue));
  const interval = wilsonInterval(numerator, denominator);
  return {
    label,
    numerator,
    denominator,
    rate: percent(numerator / denominator),
    lower: interval.lower,
    upper: interval.upper,
    interpretation: denominator < 5 ? 'Very limited evidence' : denominator < 30 ? 'Wide interval — use caution' : 'Narrower interval — still descriptive'
  };
}

function freshnessStatus(value) {
  if (value === 'live') return 'Live';
  if (value === 'delayed') return 'Delayed';
  if (value === 'stale') return 'Stale';
  return 'No recent data';
}

function freshnessEvidence(realtime) {
  if (!realtime || realtime.latest_accepted_at_ms === null || realtime.latest_accepted_at_ms === undefined) return 'No interaction was accepted in the 30-minute realtime window.';
  return `Latest accepted interaction was ${Math.round(number(realtime.freshness_ms) / 1000)} seconds old when this report was generated.`;
}

function whole(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function percent(value) {
  return Math.round(value * 1000) / 10;
}
