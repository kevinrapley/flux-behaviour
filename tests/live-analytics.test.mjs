import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLiveAnalytics, buildOverviewMetrics, dashboardRange } from '../src/product/live-analytics.mjs';

test('live analytics aggregates consented metadata without exposing event contents', () => {
  const result = buildLiveAnalytics(
    [{ id: 'session-new', is_returning_visitor: 0 }, { id: 'session-returning', is_returning_visitor: 1 }],
    [
      { action: 'field.blur', element_key: 'auto.input.text.1', metadata_json: JSON.stringify({ duration_ms: 1200, dwell_before_input_ms: 200, typing_duration_ms: 900, key_press_count: 9, backspace_count: 2 }) },
      { action: 'field.blur', element_key: 'auto.input.text.1', metadata_json: JSON.stringify({ duration_ms: 800, key_press_count: 0, backspace_count: 1 }) },
      { action: 'control.click', element_key: 'auto.button.button.2', metadata_json: JSON.stringify({ pointer_type: 'touch' }) }
    ]
  );

  assert.deepEqual(result, {
    session_count: 2,
    returning_session_count: 1,
    event_count: 3,
    median_field_dwell_ms: 500,
    typed_character_count: 9,
    correction_count: 3,
    touch_interaction_count: 1,
    dimension_scores: [
      { key: 'efficiency', label: 'Efficiency', tier: 'core', score: 50 },
      { key: 'engagement', label: 'Engagement', tier: 'core', score: 50 },
      { key: 'proficiency', label: 'Proficiency', tier: 'core', score: 50 },
      { key: 'wayfinding', label: 'Wayfinding', tier: 'core', score: 50 },
      { key: 'ict', label: 'ICT Level', tier: 'extended', score: 50 },
      { key: 'domain', label: 'Domain Knowledge', tier: 'extended', score: 50 },
      { key: 'stability', label: 'Stability', tier: 'extended', score: 50 },
      { key: 'frustration', label: 'Frustration', tier: 'extended', score: 50 },
      { key: 'trust', label: 'Assurance (Trust)', tier: 'extended', score: 50 },
      { key: 'adaptability', label: 'Adaptability', tier: 'extended', score: 50 },
      { key: 'trust_align', label: 'Trust Alignment', tier: 'extended', score: 50 },
      { key: 'cogload', label: 'Cognitive Load', tier: 'extended', score: 50 },
      { key: 'collaboration', label: 'Collaboration', tier: 'extended', score: 50 },
      { key: 'sustainability', label: 'Sustainability', tier: 'extended', score: 50 },
      { key: 'ethics', label: 'Ethical Alignment', tier: 'extended', score: 50 },
      { key: 'cogbias', label: 'Cognitive Bias Sensitivity', tier: 'exploratory', score: 50 },
      { key: 'epistemic', label: 'Epistemic Confidence', tier: 'exploratory', score: 50 },
      { key: 'ritual', label: 'Ritual Consistency', tier: 'exploratory', score: 50 },
      { key: 'predictive', label: 'Predictive Stability', tier: 'exploratory', score: 50 },
      { key: 'social_trust', label: 'Social Trust Resonance', tier: 'exploratory', score: 50 }
    ],
    actions: [{ action: 'field.blur', count: 2 }, { action: 'control.click', count: 1 }],
    controls: [{ element_key: 'auto.input.text.1', count: 2 }, { element_key: 'auto.button.button.2', count: 1 }]
  });
});

test('dashboard range defaults to 30 days and creates a like-for-like comparison period', () => {
  const now = Date.UTC(2026, 6, 11);
  const range = dashboardRange('unknown', now);

  assert.equal(range.key, '30d');
  assert.equal(range.label, 'Last 30 days');
  assert.equal(range.end_at_ms, now + 1);
  assert.equal(range.start_at_ms, now - (30 * 86400000));
  assert.equal(range.previous_start_at_ms, now - (60 * 86400000));
  assert.equal(range.previous_end_at_ms, range.start_at_ms);
  assert.equal(dashboardRange('all', now).previous_start_at_ms, null);
});

test('overview metrics calculate cumulative visitor, retention and journey-health measures', () => {
  const result = buildOverviewMetrics(
    { visitor_count: 10, new_visitor_count: 7, returning_visitor_count: 4, session_count: 15, average_session_duration_ms: 43210.7 },
    { event_count: 120, average_field_dwell_ms: 2400.4, typed_character_count: 80, correction_count: 8, touch_interaction_count: 12, completed_session_count: 9, friction_session_count: 3 }
  );

  assert.deepEqual(result, {
    visitor_count: 10,
    new_visitor_count: 7,
    returning_visitor_count: 4,
    returning_visitor_rate: 40,
    session_count: 15,
    event_count: 120,
    events_per_session: 8,
    average_session_duration_ms: 43211,
    median_field_dwell_ms: 2400,
    typed_character_count: 80,
    correction_count: 8,
    correction_rate: 10,
    touch_interaction_count: 12,
    completed_session_count: 9,
    completion_rate: 60,
    friction_session_count: 3
  });
});
