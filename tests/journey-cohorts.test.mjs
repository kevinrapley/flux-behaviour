import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildJourneyPatternCohorts,
  classifyJourneyPattern,
  OUTCOME_COHORTS,
  summariseCohortRows
} from '../src/product/journey-cohorts.mjs';

function scores(values = {}) {
  const defaults = {
    efficiency: 50, engagement: 50, wayfinding: 50, proficiency: 50,
    trust: 50, trust_align: 50, frustration: 50, adaptability: 50, stability: 50
  };
  return { dimensions: Object.entries({ ...defaults, ...values }).map(([key, score]) => ({ key, score })) };
}

test('journey patterns preserve neutral uncertainty instead of treating no evidence as careful checking', () => {
  assert.equal(classifyJourneyPattern(scores()), 'no_dominant_pattern');
  assert.equal(classifyJourneyPattern(scores({ efficiency: 52, engagement: 52 })), 'no_dominant_pattern');
  assert.equal(classifyJourneyPattern(scores({ efficiency: 42, engagement: 64, wayfinding: 55, proficiency: 47, trust: 51, trust_align: 51, frustration: 45 }), { deliberate_check_count: 1 }), 'careful_checker');
  assert.equal(classifyJourneyPattern(scores({ efficiency: 75, engagement: 72, wayfinding: 70, proficiency: 64, trust: 57, frustration: 42 })), 'confident_navigator');
});

test('named cohorts smaller than five sessions are suppressed from the response', () => {
  const result = summariseCohortRows([
    { cohort_key: 'completed_smoothly', session_count: 7, completed_session_count: 7 },
    { cohort_key: 'friction_unresolved', session_count: 4, friction_session_count: 4 }
  ], OUTCOME_COHORTS, 11);

  assert.deepEqual(result.rows.map(({ key, session_count, share }) => ({ key, session_count, share })), [
    { key: 'completed_smoothly', session_count: 7, share: 63.6 }
  ]);
  assert.equal(result.suppressed_session_count, 4);
  assert.equal(result.minimum_cohort_size, 5);
});

test('journey-pattern cohorts aggregate service outcomes and exclude incomplete histories', () => {
  const complete = Array.from({ length: 5 }, (_, index) => ({
    id: `complete-${index}`,
    events: [{ action: 'flow.submit' }, { action: 'field.revisit' }],
    event_count: 2,
    dimension_scores: scores({ efficiency: 75, engagement: 72, wayfinding: 70, proficiency: 64, trust: 57, frustration: 42 }),
    submit_count: 1,
    friction_event_count: 0,
    is_returning_visitor: index < 2,
    started_at_ms: 1000,
    last_seen_at_ms: 6000
  }));
  const incomplete = { ...complete[0], id: 'incomplete', event_count: 3 };
  const result = buildJourneyPatternCohorts([...complete, incomplete], 10);

  assert.equal(result.assessed_session_count, 5);
  assert.equal(result.incomplete_history_session_count, 1);
  assert.equal(result.is_sample_limited, true);
  assert.deepEqual(result.rows.map(({ key, session_count, completion_rate, returning_session_rate }) => ({ key, session_count, completion_rate, returning_session_rate })), [
    { key: 'confident_navigator', session_count: 5, completion_rate: 100, returning_session_rate: 40 }
  ]);
});

test('contract assurance actions provide deliberate checking evidence', () => {
  const journeys = Array.from({ length: 5 }, (_, index) => ({
    id: `assurance-${index}`,
    event_count: 1,
    events: [{ action: 'trust.password.reveal' }],
    dimension_scores: scores({ efficiency: 42, engagement: 64, wayfinding: 55, proficiency: 47, trust: 51, trust_align: 51, frustration: 45 }),
    started_at_ms: 1000,
    last_seen_at_ms: 2000
  }));

  assert.deepEqual(buildJourneyPatternCohorts(journeys).rows.map(({ key, session_count }) => ({ key, session_count })), [
    { key: 'careful_checker', session_count: 5 }
  ]);
});
