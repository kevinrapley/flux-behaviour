// Event-to-score nudge mappings ported from the original playground
// (flux-behavioural-analytics public/js/events.js applyAutoNudges, ui.js
// button handlers, frustration.js soothing rules), extended to the
// exploratory dimensions using the interpretive signals the original SDK
// defined (emitInterpretive: help_views, revisit_rate, dwell_variance,
// confirmation_bursts) and the v6.10 formula directions.

function lerp(a, b, x) {
  return a + (b - a) * Math.max(0, Math.min(1, x));
}

// Frustration soothing goes through the tone channel (negative deltas).
function soothe(engine, amount, t) {
  engine.apply('frustration', -Math.abs(amount), t);
}

export function applyAutoNudges(engine, ev, t = Date.now()) {
  if (!ev) return;
  const nav = ev.nav || { dir: 'start' };
  const backish = nav.dir === 'back' || nav.dir === 'skip';
  // Positive credit is withheld on back/skip navigation, as in the original.
  const maybe = (key, delta) => {
    if (backish && delta > 0) return;
    engine.apply(key, delta, t);
  };
  const add = (key, delta) => engine.apply(key, delta, t);

  switch (`${ev.type}.${ev.metric}`) {
    case 'act.rage':
      maybe('frustration', 4);
      maybe('efficiency', -1.5);
      maybe('engagement', -1);
      add('predictive', -1);
      add('stability', -0.5);
      return;

    case 'act.tabs':
    case 'act.clicksBetween': {
      const isTabs = ev.metric === 'tabs';
      if (backish) {
        if (isTabs && ev.creditable) {
          maybe('efficiency', 1); maybe('proficiency', 1); maybe('wayfinding', 1);
        } else if (isTabs) {
          add('efficiency', -0.25); add('proficiency', -0.25); add('wayfinding', -0.25);
        } else {
          add('efficiency', -1);
          if (nav.dir === 'skip') { add('wayfinding', -1); add('ritual', -1); }
        }
      } else {
        if (ev.creditable) {
          if (isTabs) { add('efficiency', 1); add('proficiency', 1); add('wayfinding', 1); }
          else add('proficiency', 0.5);
        } else if (isTabs) {
          add('efficiency', -0.25); add('proficiency', -0.25); add('wayfinding', -0.25);
        } else {
          add('efficiency', -1);
        }
        soothe(engine, isTabs ? 0.4 : 0.25, t);
        if (isTabs) add('ict', 0.5);
      }
      return;
    }

    case 'act.streak3':
      add('wayfinding', 1);
      soothe(engine, 0.9, t);
      add('epistemic', 1);
      add('ritual', 0.5);
      add('predictive', 0.5);
      if (ev.method === 'tab') add('ict', 0.5);
      return;

    case 'act.autocomplete':
      maybe('proficiency', 0.5);
      add('ict', 0.5);
      return;

    case 'act.shortcut':
      add('ict', 1);
      add('proficiency', 0.5);
      return;

    case 'time.fieldDwell': {
      const seconds = Number(ev.value || 0);
      if (seconds >= 8) { add('cogload', 2); add('efficiency', -1); }
      else if (seconds >= 4) add('cogload', 1);
      else if (seconds > 0) soothe(engine, 0.2, t);
      return;
    }

    case 'time.idleEpisode':
      add('engagement', -1);
      add('cogload', 0.5);
      return;

    case 'field.revisit':
      add('cogload', 0.75);
      add('epistemic', -0.5);
      add('ritual', 0.5);
      if ((ev.value || 0) >= 3) add('cogbias', -2);
      return;

    case 'edit.corrections':
      add('proficiency', -1);
      maybe('frustration', 1.5);
      add('predictive', -0.5);
      return;

    case 'edit.typing': {
      // Steady typing: chars_per_minute from the capture layer.
      const cpm = Number(ev.value || 0);
      if (cpm > 150) { add('proficiency', 2); add('ict', 1); add('predictive', 0.5); }
      else if (cpm > 60) { add('proficiency', 1); add('ict', 0.5); }
      return;
    }

    case 'edit.paste':
      add('efficiency', 1);
      add('ict', 0.5);
      return;

    case 'trust.assuranceTick':
      engine.nudge({ trust: 2, trust_align: 1 }, t);
      add('social_trust', 1);
      return;

    case 'trust.passwordReveal':
      add('epistemic', 0.5);
      return;

    case 'trust.passwordHide':
      soothe(engine, 0.3, t);
      return;

    case 'lookup.start':
      add('engagement', 1);
      return;

    case 'lookup.select':
      engine.nudge({ wayfinding: 2, efficiency: 1, trust: 1, trust_align: 1, cogload: -1, domain: 1 }, t);
      soothe(engine, 1.2, t);
      engine.apply('frustration', -0.6, t);
      add('social_trust', 1.5);
      return;

    case 'assist.help':
      engine.nudge({ cogload: 3, engagement: 0.5 }, t);
      add('adaptability', 1);
      add('epistemic', -1);
      add('domain', -0.5);
      return;

    case 'error.invalid':
      engine.nudge({ frustration: 2, efficiency: -1, wayfinding: -1 }, t);
      add('stability', -1.5);
      add('predictive', -1.5);
      add('social_trust', -1);
      return;

    case 'error.recovered':
      add('adaptability', 3);
      add('stability', 1);
      soothe(engine, 0.8, t);
      return;

    case 'flow.submit':
      engine.nudge({ efficiency: 2, engagement: 2, stability: 1, domain: 1, cogload: -1 }, t);
      soothe(engine, 1.2, t);
      engine.apply('frustration', -1.0, t);
      add('sustainability', 0.8);
      add('predictive', 1);
      return;

    case 'handoff.note':
      engine.nudge({ collaboration: 3, sustainability: 1, stability: 1 }, t);
      soothe(engine, 0.5, t);
      add('social_trust', 1);
      return;

    case 'context.note':
      engine.nudge({ collaboration: 2, ethics: 1, sustainability: 1 }, t);
      soothe(engine, 0.5, t);
      return;

    case 'policy.breach':
      engine.nudge({ ethics: -10, trust_align: -5, stability: -2, frustration: 4, cogload: 3 }, t);
      add('social_trust', -2);
      return;

    case 'oversight.ack':
      engine.nudge({ ethics: 5, trust_align: 3, stability: 1, cogload: -1 }, t);
      soothe(engine, 0.8, t);
      engine.apply('frustration', -0.4, t);
      add('epistemic', 0.5);
      return;

    case 'fatigue.mark':
      engine.nudge({ sustainability: -3, efficiency: -2, cogload: 3, stability: -1 }, t);
      return;

    case 'pointer.ndAttempt': {
      // Derived from the v6.10 formula directions:
      //   eff = lerp(30,95,path_efficiency); nav penalised by misses and
      //   submovements; prof penalised by acquire time and submovements.
      const subs = Number(ev.submovements ?? 0);
      const misses = Number(ev.misses_per_target ?? 0);

      // Misses matter whether or not the click was aimed.
      add('wayfinding', -(misses * 0.5) - Math.max(0, subs - 20) * 0.02);
      if (misses > 0) maybe('frustration', 0.5 * misses);

      // Efficiency is only assessable when there was a real aiming movement.
      // A stationary or twitch click (rage clicking, re-clicking under the
      // cursor) is not an aiming task, so it earns no efficiency credit and
      // no penalty here — rage and miss mappings own those penalties.
      if (!ev.aimed) return;

      const eff = Number(ev.path_efficiency ?? 0.5);
      add('efficiency', (lerp(30, 95, eff) - 62.5) / 20);
      add('proficiency', -Math.max(0, subs - 20) * 0.02);
      if (ev.band === 'GREEN') add('predictive', 0.3);
      return;
    }

    default:
  }
}
