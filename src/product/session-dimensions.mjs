const NEUTRAL = 50;

export const SESSION_DIMENSIONS = Object.freeze([
  { key: 'efficiency', label: 'Efficiency', tier: 'core' },
  { key: 'engagement', label: 'Engagement', tier: 'core' },
  { key: 'proficiency', label: 'Proficiency', tier: 'core' },
  { key: 'wayfinding', label: 'Wayfinding', tier: 'core' },
  { key: 'ict', label: 'ICT Level', tier: 'extended' },
  { key: 'domain', label: 'Domain Knowledge', tier: 'extended' },
  { key: 'stability', label: 'Stability', tier: 'extended' },
  { key: 'frustration', label: 'Frustration', tier: 'extended' },
  { key: 'trust', label: 'Assurance (Trust)', tier: 'extended' },
  { key: 'adaptability', label: 'Adaptability', tier: 'extended' },
  { key: 'trust_align', label: 'Trust Alignment', tier: 'extended' },
  { key: 'cogload', label: 'Cognitive Load', tier: 'extended' },
  { key: 'collaboration', label: 'Collaboration', tier: 'extended' },
  { key: 'sustainability', label: 'Sustainability', tier: 'extended' },
  { key: 'ethics', label: 'Ethical Alignment', tier: 'extended' },
  { key: 'cogbias', label: 'Cognitive Bias Sensitivity', tier: 'exploratory' },
  { key: 'epistemic', label: 'Epistemic Confidence', tier: 'exploratory' },
  { key: 'ritual', label: 'Ritual Consistency', tier: 'exploratory' },
  { key: 'predictive', label: 'Predictive Stability', tier: 'exploratory' },
  { key: 'social_trust', label: 'Social Trust Resonance', tier: 'exploratory' }
]);

const COMPOSITES = Object.freeze([
  { key: 'momentum', label: 'Momentum', keys: ['efficiency', 'engagement', 'wayfinding'] },
  { key: 'skill', label: 'Skill', keys: ['proficiency', 'ict', 'domain'] },
  { key: 'confidence_trust', label: 'Confidence and trust', keys: ['trust_align', 'trust', 'frustration'], invert: ['frustration'] },
  { key: 'resilience_adaptability', label: 'Resilience and adaptability', keys: ['stability', 'adaptability', 'cogload'], invert: ['cogload'] },
  { key: 'governance_integrity', label: 'Governance and integrity', keys: ['collaboration', 'sustainability', 'ethics'] }
]);

function metadata(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function count(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function clamp(value) {
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
}

function apply(scores, deltas) {
  for (const [key, delta] of Object.entries(deltas)) {
    if (Object.hasOwn(scores, key) && Number.isFinite(delta)) scores[key] = clamp(scores[key] + delta);
  }
}

function average(values) {
  return values.length ? Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10 : NEUTRAL;
}

export function scoreSessionDimensions(events = []) {
  const scores = Object.fromEntries(SESSION_DIMENSIONS.map(({ key }) => [key, NEUTRAL]));
  let previousFieldWasCompleted = false;
  let creditableTabs = 0;
  let passiveTabs = 0;

  for (const event of events) {
    const details = metadata(event.metadata_json);
    const action = event.action;

    if (action === 'field.blur') {
      const durationSeconds = count(details.duration_ms) / 1000;
      const keys = count(details.key_press_count);
      const corrections = count(details.backspace_count);
      const edits = count(details.edit_count);
      const cpm = durationSeconds > 0 ? (keys * 60) / durationSeconds : 0;
      previousFieldWasCompleted = keys > 0 || edits > 0;
      if (keys > 0) apply(scores, cpm > 150 ? { proficiency: 2, ict: 1, predictive: 0.5, engagement: 1 } : cpm > 60 ? { proficiency: 1, ict: 0.5, engagement: 0.75 } : { engagement: 0.5 });
      if (keys >= 5 && corrections / keys > 0.25) apply(scores, { proficiency: -1, frustration: 1.5, predictive: -0.5 });
      if (keys > 0) apply(scores, durationSeconds >= 8 ? { engagement: 1, cogload: 0.5 } : { engagement: 0.5 });
      else if (durationSeconds >= 8) apply(scores, { cogload: 2, efficiency: -1 });
      else if (durationSeconds >= 4) apply(scores, { cogload: 1 });
      continue;
    }

    if (action === 'field.revisit') {
      const revisits = count(details.revisit_count);
      apply(scores, revisits >= 3 ? { cogload: 0.75, epistemic: -0.5, ritual: 0.5, cogbias: -2 } : { cogload: 0.75, epistemic: -0.5, ritual: 0.5 });
      continue;
    }

    if (action === 'control.tab') {
      if (previousFieldWasCompleted) {
        apply(scores, { efficiency: 1, proficiency: 1, wayfinding: 1, ict: 0.5, frustration: -0.4 });
        creditableTabs += 1;
        if (creditableTabs % 3 === 0) apply(scores, { wayfinding: 1, epistemic: 1, ritual: 0.5, predictive: 0.5, frustration: -0.9 });
      } else {
        apply(scores, { efficiency: -0.25, proficiency: -0.25, wayfinding: -0.25 });
        passiveTabs += 1;
        if (passiveTabs % 3 === 0) apply(scores, { wayfinding: -1, cogload: 0.5, epistemic: -0.5 });
      }
      previousFieldWasCompleted = false;
      continue;
    }

    previousFieldWasCompleted = false;
    if (action === 'edit.paste') apply(scores, { efficiency: 1, ict: 0.5 });
    else if (action === 'edit.undo') apply(scores, { proficiency: -0.5, frustration: 0.75, adaptability: 0.25 });
    else if (action === 'act.shortcut') apply(scores, { ict: 1, proficiency: 0.5 });
    else if (action === 'act.rage') apply(scores, { frustration: 4, efficiency: -1.5, engagement: -1, predictive: -1, stability: -0.5 });
    else if (action === 'assist.help') apply(scores, { cogload: 3, adaptability: 1, engagement: 0.5, epistemic: -1, domain: -0.5 });
    else if (action === 'error.invalid') apply(scores, { frustration: 2, efficiency: -1, wayfinding: -1, stability: -1.5, predictive: -1.5, social_trust: -1 });
    else if (action === 'error.recovered') apply(scores, { adaptability: 3, stability: 1, frustration: -0.8 });
    else if (action === 'flow.submit') apply(scores, { efficiency: 2, engagement: 2, stability: 1, domain: 1, cogload: -1, sustainability: 0.8, predictive: 1, frustration: -1 });
  }

  const dimensions = SESSION_DIMENSIONS.map(({ key, label, tier }) => ({ key, label, tier, score: scores[key] }));
  const composites = COMPOSITES.map(({ key, label, keys, invert = [] }) => ({ key, label, score: average(keys.map((dimension) => invert.includes(dimension) ? 100 - scores[dimension] : scores[dimension])) }));
  return { dimensions, composites };
}

export function medianDimensionScores(sessionScores = []) {
  return SESSION_DIMENSIONS.map(({ key, label, tier }) => {
    const values = sessionScores.map((session) => session.dimensions.find((dimension) => dimension.key === key)?.score).filter(Number.isFinite).sort((left, right) => left - right);
    const middle = Math.floor(values.length / 2);
    const score = values.length === 0 ? NEUTRAL : values.length % 2 ? values[middle] : Math.round(((values[middle - 1] + values[middle]) / 2) * 10) / 10;
    return { key, label, tier, score };
  });
}
