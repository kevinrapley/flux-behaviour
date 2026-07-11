# Behaviour signal map

How captured behaviours move the 20 dimensions in the playground's demo scoring. Signals are captured in `demo/assets/flux-behaviour-signals.js` (plus the playground driver for page-level actions) and mapped in `demo/assets/flux-nudges.js`, running through the ported v46.s engine (EMA → median → deadband → per-second rate limit, decay toward neutral, dual-channel Frustration). Lineage: the original `applyAutoNudges`, UI handlers and frustration soothing rules, extended to the exploratory dimensions using the v6.10 formula directions.

Coherence invariants, enforced by `tests/signal-coherence.test.mjs`:

1. **No signal pushes one dimension in both directions.**
2. **Positive credit is withheld on back/skip navigation** (original rule).
3. **A stationary or twitch click is not an aiming task** — it can never earn Efficiency.
4. **An acquisition consumes its approach** — one approach movement, one score.
5. **Credit requires substance**: navigation, streak, ICT and soothing credit need creditable input (real text, a chosen option, or a valid short numeric part) in the field being left.
6. **Speed without consideration is not trust**: rushed governance ticks and toggle bursts score as compliance/anxiety patterns, not assurance.

## Typing and editing

| Behaviour | Signal | Moves |
| --- | --- | --- |
| Steady typing (cpm at blur) | `edit.typing` | Proficiency +1..2, ICT +0.5..1, Predictive +0.5 (fast), Engagement +0.5..1 |
| Correction-heavy episode (>25% backspaces, ≥5 keys) | `edit.corrections` | Proficiency −1, Frustration +1.5, Predictive −0.5 |
| Undo (Cmd/Ctrl+Z) | `edit.undo` | Proficiency −0.5, Frustration +0.75, Adaptability +0.25 — *not* ICT |
| Paste | `edit.paste` | Efficiency +1, ICT +0.5 (Cmd+V does not also count as a shortcut) |
| Autocomplete fill | `act.autocomplete` | Proficiency +0.5, ICT +0.5 |
| Other shortcuts (Cmd+A/C/X/F…) | `act.shortcut` | ICT +1, Proficiency +0.5 |

## Field navigation

| Behaviour | Signal | Moves |
| --- | --- | --- |
| Forward tab after completing a field | `act.tabs` creditable | Efficiency/Proficiency/Wayfinding +1, ICT +0.5, soothes Frustration 0.4 |
| Forward tab past an empty field | `act.tabs` non-creditable | Efficiency/Proficiency/Wayfinding −0.25; no ICT, no soothing |
| Three creditable forward moves | `act.streak3` | Wayfinding +1, Epistemic +1, Ritual/Predictive +0.5, soothes 0.9 |
| Three empty tab moves (hunting) | `act.passiveTabs` | Wayfinding −1, Cognitive Load +0.5, Epistemic −0.5 |
| Click between fields after completing | `act.clicksBetween` creditable | Proficiency +0.5, soothes 0.25 |
| Back/skip moves | direction on the above | Penalties only; positive credit withheld |
| Field revisits | `field.revisit` | Cognitive Load +0.75, Epistemic −0.5, Ritual +0.5; ≥3 → Bias Sensitivity −2 |

## Time

| Behaviour | Signal | Moves |
| --- | --- | --- |
| Long dwell while actively typing | `time.fieldDwell` active | Engagement +1 (composition, not struggle; Cognitive Load +0.5 only past 8s) |
| Long dwell without input | `time.fieldDwell` inactive | Cognitive Load +1..2, Efficiency −1 at 8s+ |
| Quick completed dwell | `time.fieldDwell` <4s | soothes 0.2 |
| Idle 6s+ | `time.idleEpisode` | Engagement −1, Cognitive Load +0.5 |

## Pointer

| Behaviour | Signal | Moves |
| --- | --- | --- |
| Aimed acquisition (≥30px approach, ≥100ms) | `pointer.ndAttempt` aimed | Efficiency scaled from path efficiency (lerp 30..95 around neutral); GREEN adds Predictive +0.3, Engagement +0.3 |
| Unaimed click (stationary/twitch) | `pointer.ndAttempt` unaimed | No efficiency movement either way; plotted red on the matrix |
| Missed clicks near targets | misses on the attempt | Wayfinding −0.5/miss, Frustration +0.5/miss |
| Rage clicks (3+ in 700ms) | `act.rage` | Frustration +4, Efficiency −1.5, Engagement −1, Predictive −1, Stability −0.5 |

## Support, trust and flow

| Behaviour | Signal | Moves |
| --- | --- | --- |
| Help opened | `assist.help` | Cognitive Load +3, Adaptability +1, Engagement +0.5, Epistemic −1, Domain −0.5 |
| Address lookup started | `lookup.start` | Engagement +1 |
| Lookup retried without selecting | `lookup.retry` | Wayfinding −1, Cognitive Load +1, Frustration +0.5 |
| Lookup result selected | `lookup.select` | Wayfinding +2, Efficiency +1, Trust +1, Trust Alignment +1, Domain +1, Cognitive Load −1, Social Trust +1.5, strong soothing |
| Considered assurance tick | `trust.assuranceTick` | Trust +2, Trust Alignment +1, Social Trust +1 |
| Rushed assurance tick (<800ms after previous) | `trust.assuranceTickRushed` | Trust +0.5 only, Bias Sensitivity −1, Epistemic −0.5 |
| Password reveal / hide | `trust.passwordReveal/Hide` | Epistemic +0.5 / soothes 0.3 |
| Password toggle burst (3 in 5s) | `trust.passwordToggleBurst` | Frustration +1, Epistemic −1 |
| Validation error | `error.invalid` | Frustration +2, Efficiency −1, Wayfinding −1, Stability −1.5, Predictive −1.5, Social Trust −1 |
| Error fixed on resubmit | `error.recovered` | Adaptability +3, Stability +1, soothes 0.8 |
| Successful submit | `flow.submit` | Efficiency/Engagement +2, Stability/Domain +1, Cognitive Load −1, Sustainability +0.8, Predictive +1, strong soothing |

## Team and governance (repeats within 4s counted but not scored)

| Behaviour | Signal | Moves |
| --- | --- | --- |
| Handoff with note | `handoff.note` | Collaboration +3, Sustainability/Stability +1, Social Trust +1, soothes 0.5 |
| Context note | `context.note` | Collaboration +2, Ethics/Sustainability +1, soothes 0.5 |
| Oversight acknowledged | `oversight.ack` | Ethics +5, Trust Alignment +3, Stability +1, Cognitive Load −1, Epistemic +0.5 |
| Policy breach (simulated) | `policy.breach` | Ethics −10, Trust Alignment −5, Stability −2, Frustration +4, Cognitive Load +3, Social Trust −2 |
| Long-session mark | `fatigue.mark` | Sustainability −3, Efficiency −2, Cognitive Load +3, Stability −1 |

The production session dashboard uses the subset of these signals that can be captured as consented, content-free metadata: field dwell, character and correction counts, tab progression, paste and shortcut categories, revisits, rage clicks, help disclosures, validation errors and submit attempts. It renders all 20 indicators, retaining neutral values when no safe signal exists. Golden-corpus validation remains required before any use beyond service-improvement evidence (GAP-008), and every score display carries the interpretation policy: never a judgement about a person.
