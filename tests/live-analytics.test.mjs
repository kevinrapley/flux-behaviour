import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLiveAnalytics } from '../src/product/live-analytics.mjs';

test('live analytics aggregates consented metadata without exposing event contents', () => {
  const result = buildLiveAnalytics(
    [{ id: 'session-new', is_returning_visitor: 0 }, { id: 'session-returning', is_returning_visitor: 1 }],
    [
      { action: 'field.blur', element_key: 'auto.input.text.1', metadata_json: JSON.stringify({ duration_ms: 1200, key_press_count: 9, backspace_count: 2 }) },
      { action: 'field.blur', element_key: 'auto.input.text.1', metadata_json: JSON.stringify({ duration_ms: 800, key_press_count: 4, backspace_count: 1 }) },
      { action: 'control.click', element_key: 'auto.button.button.2', metadata_json: JSON.stringify({ pointer_type: 'touch' }) }
    ]
  );

  assert.deepEqual(result, {
    session_count: 2,
    returning_session_count: 1,
    event_count: 3,
    median_field_dwell_ms: 1000,
    typed_character_count: 13,
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
