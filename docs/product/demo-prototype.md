# Demo prototype

The demo prototype shows Flux Behaviour working end to end on a GOV.UK-styled service, in the same way the original `flux-behavioural-analytics` repository carried a demo. It is a static build, not a deployed service.

## Build and run

```bash
npm ci
npm run demo:serve
```

Then open `http://localhost:4321/`. `npm run demo:build` produces the static site in `public/` (gitignored build output).

## Pages

- **Get started** (`/`) — the GA-style install snippet and the tag's privacy guarantees.
- **Demo journey** (`/journey/`) — an "Apply for a demo licence" form using GOV.UK Design System patterns (cookie banner for consent, question page, help details). The page is instrumented with the real SDK tag; an on-page log shows every event exactly as it leaves the page. Events post to the collector endpoint (`FLUX_DEMO_COLLECTOR_ENDPOINT` at build time, defaulting to a local worker on `127.0.0.1:8787`).
- **Playground** (`/playground/`) — the whole of the original `flux-behavioural-analytics` playground rebuilt on GOV.UK Frontend. All 20 dimensions (core, extended and exploratory) are scored by a port of the original v46.s engine: event-driven ticks through EMA smoothing, a median filter, a deadband and a per-second rate limit, with decay toward neutral on a clock and the dual-channel Frustration model (events push, soothing behaviours calm). The signal mappings are ported from the original `applyAutoNudges`, UI handlers and frustration rules: rage clicks, tab/click navigation with creditable-input guards and direction, forward streaks, field dwell, revisits, corrections, typing speed, pastes, autocomplete, shortcuts, idle episodes, address lookup, assurance ticks, password show/hide, validation errors and recovery, submits, handoffs, context notes, oversight acknowledgements, policy breaches, fatigue marks and pointer kinematics (path efficiency, submovements, misses within the original acquisition-window policy, GREEN/AMBER/RED banding). The page is a realistic "request for records" journey using GOV.UK components (date input, select, radios, checkboxes, address lookup, password toggle, error summary), plus team/governance actions, the 8 replay personas, live engine tuning sliders, composite indices, session cohort classification, a pointer telemetry panel and a live table counting every recorded behaviour. ONS-pattern charts show all dimension scores with reference bands and a rolling 60-second history. Scores carry the interpretation policy warning (service improvement only, never user judgement).
- **Dashboard** (`/dashboard/`) — behavioural signal visualisations following the ONS Charts conventions (config-per-breakpoint, accessible summaries alongside graphics, data labels, source lines). The dashboard renders fixture data and says so on the page, because collector storage is disabled.

## Structure

```text
demo/templates/    Nunjucks layout and pages (GOV.UK Frontend v6 chrome)
demo/styles/       Sass entry point building on govuk-frontend
demo/assets/       Journey instrumentation and ONS-pattern d3 chart modules
demo/data/         Fixture aggregates for the dashboard
scripts/demo/      Render, asset-copy and static-serve scripts
```

## Honest limits

- Dashboard data is fixture data until collector storage and an aggregation pipeline exist.
- Chart modules follow ONS Charts patterns; they do not yet vendor the `ONSdigital/Charts` template library directly (see gap register).
- The demo has not been through a full accessibility audit (see gap register).
