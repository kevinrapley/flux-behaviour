// Playground model carried over from kevinrapley/flux-behavioural-analytics.
// Provenance: public/js/constants.js (dimensions), public/js/engine.js
// (engine parameters), public/js/cohorts.js (composites, session cohorts),
// public/js/ui.js (persona replay deltas), config/flux_scoring_config_v6.10.json
// (exploratory dimensions, thresholds). Demo logic, not promoted scoring.

export const engineParams = Object.freeze({
  neutral: 50,
  bounds: [0, 100],
  delta_ema_alpha: 0.25,
  median_window_k: 5,
  max_change_per_second: 6,
  decay_per_second_toward_neutral: 0.12,
  deadband_abs: 0.2,
  backskip_min_gap_ms: 300
});

export const uiScoreBands = Object.freeze({ green_min: 70, amber_min: 40 });

// ND attempt banding thresholds from config v6.10.
export const ndBand = Object.freeze({
  efficiency: { green_min: 0.7, amber_min: 0.4 },
  submovements: { green_max: 20, amber_max: 40 }
});

export const dimensions = Object.freeze([
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

// Composite indices from public/js/cohorts.js composites().
export const composites = Object.freeze([
  { key: 'momentum', label: 'Momentum', formula: (s) => (s.efficiency + s.engagement + s.wayfinding) / 3 },
  { key: 'skill', label: 'Skill', formula: (s) => (s.proficiency + s.ict + s.domain) / 3 },
  { key: 'ct', label: 'Confidence & Trust', formula: (s) => (s.trust_align + s.trust + (100 - s.frustration)) / 3 },
  { key: 'ra', label: 'Resilience & Adaptability', formula: (s) => (s.stability + s.adaptability + (100 - s.cogload)) / 3 },
  { key: 'gi', label: 'Governance & Integrity', formula: (s) => (s.collaboration + s.sustainability + s.ethics) / 3 }
]);

// Session cohort rules from public/js/cohorts.js classifySessionCohort().
export function classifySessionCohort(s) {
  const mom = (s.efficiency + s.engagement + s.wayfinding) / 3;
  const cautious = (v) => v >= 46 && v <= 56;

  if (mom <= 35) return 'Frustrated Explorer';
  if (s.engagement >= 50 && mom <= 58 && (cautious(s.trust) || cautious(s.trust_align))) return 'Careful Checker';
  if ((s.trust <= 42 || s.trust_align <= 42) && s.engagement >= 50) return 'Distrustful Checker';
  if (mom <= 45 && (s.wayfinding < 45 || s.efficiency < 45) && s.frustration >= 55) return 'Frustrated Explorer';
  if (
    (mom >= 68 && s.proficiency >= 62 && (s.trust >= 56 || s.trust_align >= 56) && s.frustration <= 48) ||
    (mom >= 72 && s.proficiency >= 58 && s.frustration <= 45)
  ) return 'Confident Navigator';
  if ((s.adaptability >= 58 || s.stability >= 58) && mom >= 50 && s.frustration <= 60) return 'Resilient Improviser';
  return 'Unclassified';
}

// Persona replay deltas from public/js/ui.js.
export const personas = Object.freeze({
  'Confident Navigator': { efficiency: 8, engagement: 3, wayfinding: 3, proficiency: 5, ict: 3, domain: 2, trust: 4, trust_align: 2, stability: 2, frustration: -5, cogload: -2 },
  'Careful Checker': { trust: -6, trust_align: -4, engagement: 5, proficiency: -3, efficiency: -3, wayfinding: 2, domain: 1, stability: 2, cogload: 3, frustration: -2 },
  'Frustrated Explorer': { efficiency: -8, wayfinding: -13, proficiency: -3, engagement: -1, stability: -1, domain: -5, ict: -3, trust: -6, frustration: 12, trust_align: -4, cogload: 6 },
  'Resilient Improviser': { efficiency: -1, proficiency: 1, domain: 2, ict: 3, stability: 1, adaptability: 4, trust: 1, trust_align: 2, engagement: 4, frustration: 2, cogload: -1 },
  'Distrustful Checker': { trust: -6, trust_align: -6, engagement: 5, efficiency: -6, wayfinding: 1, domain: 2, proficiency: -2, stability: 3, frustration: 3, cogload: 2 },
  'Sustained Performer': { sustainability: 10, efficiency: 4, stability: 3, engagement: 2, cogload: -2 },
  'Policy Guardian': { ethics: 15, trust_align: 8, trust: 4, stability: 2, cogload: -2 },
  'Collaborative Steward': { collaboration: 12, sustainability: 3, ethics: 2, stability: 2 }
});

export const playgroundModel = Object.freeze({
  engineParams,
  uiScoreBands,
  ndBand,
  dimensions,
  personaNames: Object.keys(personas)
});
