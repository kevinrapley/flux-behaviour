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
- **Playground** (`/playground/`) — an interactive page showing behavioural dimensions rising and falling in real time, carried over in spirit from the original `flux-behavioural-analytics` playground. Six dimensions from the v6.10 scoring reference (Efficiency, Wayfinding, Proficiency, Engagement, Frustration, Cognitive Load) are scored by a demo engine implementing the reference parameters (neutral 50, EMA smoothing, median filter, rate limiting, decay toward neutral, deadband). Typing, corrections, pasting, rage-clicks, help use and task completion move the scores; ONS-pattern charts show current scores with the reference bands (green/amber/red) and a rolling 60-second history. The event-to-stimulus mappings are demonstration heuristics, labelled as such on the page, and scores carry the interpretation policy warning (service improvement only, never user judgement).
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
