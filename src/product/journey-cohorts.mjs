export const MINIMUM_COHORT_SIZE = 5;
export const JOURNEY_PATTERN_SAMPLE_LIMIT = 250;

const JOURNEY_PATTERNS = Object.freeze({
  confident_navigator: {
    label: 'Confident navigation',
    description: 'Journeys with strong momentum, proficiency and low observed friction.'
  },
  careful_checker: {
    label: 'Careful checking',
    description: 'Engaged journeys that move deliberately while assurance signals remain near neutral.'
  },
  frustrated_explorer: {
    label: 'Exploration with friction',
    description: 'Journeys with low momentum and repeated wayfinding or friction signals.'
  },
  resilient_improviser: {
    label: 'Recovery and adaptation',
    description: 'Journeys that recover or adapt while maintaining forward momentum.'
  },
  distrustful_checker: {
    label: 'Assurance seeking',
    description: 'Engaged journeys with lower observed assurance or trust-alignment signals.'
  },
  no_dominant_pattern: {
    label: 'No dominant pattern',
    description: 'The supported signals do not provide enough evidence for a stronger journey pattern.'
  }
});

export const VISIT_MATURITY_COHORTS = Object.freeze({
  first_time: {
    label: 'First-time journeys',
    description: 'The visitor had not previously started a consented ResearchOps session.'
  },
  returning: {
    label: 'Returning journeys',
    description: 'The visitor returned and has two or three consented sessions in total.'
  },
  established: {
    label: 'Established journeys',
    description: 'The visitor has four or more consented sessions in total.'
  }
});

export const OUTCOME_COHORTS = Object.freeze({
  completed_smoothly: {
    label: 'Completed without observed friction',
    description: 'A submit action was reached without help, validation, revisit or rapid-click signals.'
  },
  completed_after_friction: {
    label: 'Completed after friction',
    description: 'A submit action was reached after at least one supported friction signal.'
  },
  friction_unresolved: {
    label: 'Friction without completion',
    description: 'Supported friction was observed and no submit action was reached in the session.'
  },
  in_progress: {
    label: 'No outcome observed',
    description: 'Neither a submit action nor a supported friction signal was observed.'
  }
});

function dimensions(scoreResult = {}) {
  return Object.fromEntries((scoreResult.dimensions ?? []).map(({ key, score }) => [key, Number(score)]));
}

export function classifyJourneyPattern(scoreResult = {}, evidence = {}) {
  const scores = dimensions(scoreResult);
  const required = ['efficiency', 'engagement', 'wayfinding', 'proficiency', 'trust', 'trust_align', 'frustration', 'adaptability', 'stability'];
  if (!required.every((key) => Number.isFinite(scores[key]))) return 'no_dominant_pattern';

  // A neutral score set means the service emitted no supported evidence. It is
  // not a careful-checking pattern merely because the original thresholds span 50.
  if (!required.some((key) => Math.abs(scores[key] - 50) >= 1)) return 'no_dominant_pattern';

  const momentum = (scores.efficiency + scores.engagement + scores.wayfinding) / 3;
  const cautious = (value) => value >= 46 && value <= 56;

  if (momentum <= 35) return 'frustrated_explorer';
  if (number(evidence.deliberate_check_count) > 0 && scores.engagement >= 50 && momentum <= 58 && (cautious(scores.trust) || cautious(scores.trust_align))) return 'careful_checker';
  if ((scores.trust <= 42 || scores.trust_align <= 42) && scores.engagement >= 50) return 'distrustful_checker';
  if (momentum <= 45 && (scores.wayfinding < 45 || scores.efficiency < 45) && scores.frustration >= 55) return 'frustrated_explorer';
  if (
    (momentum >= 68 && scores.proficiency >= 62 && (scores.trust >= 56 || scores.trust_align >= 56) && scores.frustration <= 48) ||
    (momentum >= 72 && scores.proficiency >= 58 && scores.frustration <= 45)
  ) return 'confident_navigator';
  if ((scores.adaptability >= 58 || scores.stability >= 58) && momentum >= 50 && scores.frustration <= 60) return 'resilient_improviser';
  return 'no_dominant_pattern';
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function rate(numerator, denominator) {
  return denominator ? Math.round((number(numerator) / denominator) * 1000) / 10 : 0;
}

function journeyEvidence(events = []) {
  const deliberateChecks = new Set(['field.revisit', 'edit.undo', 'trust.assurance.tick', 'trust.password.reveal', 'trust.password.hide']);
  return {
    deliberate_check_count: events.filter((event) => deliberateChecks.has(event.action)).length
  };
}

export function summariseCohortRows(rows = [], definitions = {}, totalSessionCount = 0, minimumSize = MINIMUM_COHORT_SIZE) {
  const total = number(totalSessionCount);
  let suppressed = 0;
  const visible = [];
  for (const row of rows) {
    const definition = definitions[row.cohort_key];
    const sessionCount = number(row.session_count);
    if (!definition || sessionCount < minimumSize) {
      suppressed += sessionCount;
      continue;
    }
    visible.push({
      key: row.cohort_key,
      ...definition,
      session_count: sessionCount,
      share: rate(sessionCount, total),
      completion_rate: rate(row.completed_session_count, sessionCount),
      friction_rate: rate(row.friction_session_count, sessionCount),
      returning_session_rate: rate(row.returning_session_count, sessionCount),
      average_session_duration_ms: Math.round(number(row.average_session_duration_ms))
    });
  }
  visible.sort((left, right) => right.session_count - left.session_count || left.label.localeCompare(right.label));
  return {
    minimum_cohort_size: minimumSize,
    total_session_count: total,
    visible_session_count: visible.reduce((sum, row) => sum + row.session_count, 0),
    suppressed_session_count: suppressed,
    rows: visible
  };
}

export function buildJourneyPatternCohorts(journeys = [], selectedSessionCount = journeys.length, options = {}) {
  const minimumSize = options.minimumSize ?? MINIMUM_COHORT_SIZE;
  const sampleLimit = options.sampleLimit ?? JOURNEY_PATTERN_SAMPLE_LIMIT;
  const groups = new Map();
  let incompleteHistorySessionCount = 0;

  for (const journey of journeys) {
    const loadedEventCount = journey.events?.length ?? 0;
    if (number(journey.event_count) > loadedEventCount) {
      incompleteHistorySessionCount += 1;
      continue;
    }
    const key = classifyJourneyPattern(journey.dimension_scores, journeyEvidence(journey.events));
    const group = groups.get(key) ?? {
      cohort_key: key,
      session_count: 0,
      completed_session_count: 0,
      friction_session_count: 0,
      returning_session_count: 0,
      duration_total_ms: 0
    };
    group.session_count += 1;
    group.completed_session_count += number(journey.submit_count) > 0 ? 1 : 0;
    group.friction_session_count += number(journey.friction_event_count) > 0 ? 1 : 0;
    group.returning_session_count += journey.is_returning_visitor ? 1 : 0;
    group.duration_total_ms += Math.max(0, number(journey.last_seen_at_ms) - number(journey.started_at_ms));
    groups.set(key, group);
  }

  const assessed = [...groups.values()];
  for (const group of assessed) group.average_session_duration_ms = group.session_count ? group.duration_total_ms / group.session_count : 0;
  return {
    ...summariseCohortRows(assessed, JOURNEY_PATTERNS, journeys.length - incompleteHistorySessionCount, minimumSize),
    selected_session_count: number(selectedSessionCount),
    assessed_session_count: journeys.length - incompleteHistorySessionCount,
    incomplete_history_session_count: incompleteHistorySessionCount,
    sample_limit: sampleLimit,
    is_sample_limited: number(selectedSessionCount) > journeys.length
  };
}
