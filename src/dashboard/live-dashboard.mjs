const dashboard = document.querySelector('[data-flux-dashboard]');
const status = document.querySelector('[data-flux-live-status]');
const content = document.querySelector('[data-flux-dashboard-content]');
const overview = document.querySelector('[data-flux-overview]');
const periodCopy = document.querySelector('[data-flux-period-copy]');
const trend = document.querySelector('[data-flux-trend]');
const realtime = document.querySelector('[data-flux-realtime]');
const serviceModel = document.querySelector('[data-flux-service-model]');
const health = document.querySelector('[data-flux-health]');
const interactions = document.querySelector('[data-flux-interactions]');
const cohorts = document.querySelector('[data-flux-cohorts]');
const signals = document.querySelector('[data-flux-signals]');
const journeys = document.querySelector('[data-flux-live-journeys]');
const refresh = document.querySelector('[data-flux-refresh]');
const rangeButtons = [...document.querySelectorAll('[data-flux-range]')];
const numberFormat = new Intl.NumberFormat('en-GB');
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const ACTION_LABELS = Object.freeze({
  'page.loaded': 'Pages viewed',
  'control.click': 'Clicks',
  'control.tab': 'Keyboard navigation',
  'field.blur': 'Fields completed',
  'field.revisit': 'Fields revisited',
  'edit.paste': 'Paste actions',
  'edit.undo': 'Undo actions',
  'act.shortcut': 'Keyboard shortcuts',
  'act.rage': 'Repeated rapid clicks',
  'assist.help': 'Help opened',
  'error.invalid': 'Validation errors',
  'error.recovered': 'Errors recovered',
  'flow.submit': 'Forms submitted'
});

let currentRange = new URL(window.location.href).searchParams.get('range') || '30d';
if (!rangeButtons.some((button) => button.dataset.fluxRange === currentRange)) currentRange = '30d';

for (const button of rangeButtons) {
  button.addEventListener('click', () => {
    if (button.dataset.fluxRange === currentRange) return;
    currentRange = button.dataset.fluxRange;
    updateRangeControls();
    const url = new URL(window.location.href);
    url.searchParams.set('range', currentRange);
    window.history.replaceState({}, '', url);
    void loadDashboard();
  });
}

refresh?.addEventListener('click', () => void loadDashboard());
updateRangeControls();
void loadDashboard();

async function loadDashboard() {
  setLoading(true);
  try {
    const response = await fetch(`/api/dashboard/researchops?range=${encodeURIComponent(currentRange)}`, { credentials: 'include' });
    if (response.status === 401) {
      renderSignIn();
      return;
    }
    if (!response.ok) throw new Error('dashboard_unavailable');
    const data = await response.json();
    renderDashboard(data);
  } catch {
    renderError();
  } finally {
    setLoading(false);
  }
}

function setLoading(loading) {
  dashboard?.setAttribute('aria-busy', String(loading));
  refresh?.toggleAttribute('disabled', loading);
  for (const button of rangeButtons) button.toggleAttribute('disabled', loading);
  if (loading) status.textContent = 'Updating ResearchOps analytics…';
}

function updateRangeControls() {
  for (const button of rangeButtons) {
    const active = button.dataset.fluxRange === currentRange;
    button.classList.toggle('flux-dashboard__range-button--active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function renderDashboard(data) {
  const analytics = data.analytics ?? {};
  const summary = analytics.overview ?? {};
  content.hidden = false;
  status.className = 'flux-dashboard__status';
  status.textContent = `${analytics.period?.label ?? 'Selected period'} · updated ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  periodCopy.textContent = periodDescription(analytics.period, summary);
  overview.replaceChildren(...overviewCards(summary, analytics.comparison));
  realtime.replaceChildren(renderRealtime(analytics.realtime));
  trend.replaceChildren(renderTrend(analytics.trend ?? []));
  serviceModel.replaceChildren(renderServiceModel(analytics.service_model));
  health.replaceChildren(renderHealth(summary));
  interactions.replaceChildren(renderInteractions(analytics.actions ?? []));
  cohorts.replaceChildren(renderCohorts(analytics.cohorts ?? {}));
  signals.replaceChildren(renderSignals(analytics.dimension_scores ?? []));
  journeys.replaceChildren(...(data.journeys ?? []).map(journeyCard));
  if ((data.journeys ?? []).length === 0) journeys.replaceChildren(emptyState('No journeys in this period', 'Choose a wider date range or check again after visitors have used ResearchOps.'));
}

function renderSignIn() {
  content.hidden = true;
  const callout = document.createElement('div');
  callout.className = 'flux-dashboard__callout';
  callout.append(
    element('h2', 'govuk-heading-l', 'Sign in to view ResearchOps analytics'),
    element('p', 'govuk-body', 'The dashboard contains protected, pseudonymous service analytics and is available only to authorised ResearchOps accounts.'),
    link('/api/auth/google/start', 'Sign in with Google', 'govuk-button')
  );
  status.replaceChildren(callout);
}

function renderError() {
  content.hidden = true;
  const callout = document.createElement('div');
  callout.className = 'flux-dashboard__callout flux-dashboard__callout--error';
  const retry = element('button', 'govuk-button govuk-button--secondary', 'Try again');
  retry.type = 'button';
  retry.addEventListener('click', () => void loadDashboard());
  callout.append(element('h2', 'govuk-heading-l', 'Analytics could not be loaded'), element('p', 'govuk-body', 'The service may be temporarily unavailable. No dashboard data has been changed.'), retry);
  status.replaceChildren(callout);
}

function overviewCards(current, previous) {
  const sessionsPerVisitor = Number(current.session_count) / Math.max(1, Number(current.visitor_count));
  return [
    metricCard('Visitors', current.visitor_count, comparisonText(current.visitor_count, previous?.visitor_count), 'People with at least one consented session'),
    metricCard('Returning visitors', `${formatPercent(current.returning_visitor_rate)}`, rateComparison(current.returning_visitor_rate, previous?.returning_visitor_rate), `${numberFormat.format(current.returning_visitor_count ?? 0)} visitors came back`),
    metricCard('Sessions', current.session_count, comparisonText(current.session_count, previous?.session_count), `${formatDecimal(sessionsPerVisitor)} session${sessionsPerVisitor === 1 ? '' : 's'} per visitor`),
    metricCard('Interactions', current.event_count, comparisonText(current.event_count, previous?.event_count), `${formatDecimal(current.events_per_session)} per session`)
  ];
}

function metricCard(label, value, comparison, context) {
  const card = document.createElement('article');
  card.className = 'flux-metric';
  card.append(
    element('h3', 'flux-metric__label', label),
    element('p', 'flux-metric__value', typeof value === 'number' ? numberFormat.format(value) : value),
    element('p', `flux-metric__comparison${comparison.startsWith('No comparison') ? ' flux-metric__comparison--neutral' : ''}`, comparison),
    element('p', 'flux-metric__context', context)
  );
  return card;
}

function renderTrend(rows) {
  if (rows.length === 0) return emptyState('No activity to chart', 'Visitor and session trends will appear when consented sessions are received.');
  const section = document.createElement('div');
  section.className = 'flux-trend';
  const compact = window.matchMedia?.('(max-width: 600px)').matches === true;
  const width = compact ? 360 : 900;
  const height = compact ? 220 : 280;
  const margin = compact ? { top: 16, right: 8, bottom: 38, left: 30 } : { top: 18, right: 18, bottom: 42, left: 44 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maximum = Math.max(1, ...rows.flatMap((row) => [Number(row.visitors) || 0, Number(row.sessions) || 0]));
  const x = (index) => margin.left + (rows.length === 1 ? plotWidth / 2 : (index / (rows.length - 1)) * plotWidth);
  const y = (value) => margin.top + plotHeight - ((Number(value) || 0) / maximum) * plotHeight;
  const gridSteps = Math.min(4, maximum);
  const svg = svgElement('svg', { class: 'flux-trend__chart', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-labelledby': 'flux-trend-title flux-trend-desc' });
  svg.append(svgElement('title', { id: 'flux-trend-title' }, 'Daily visitors and sessions'), svgElement('desc', { id: 'flux-trend-desc' }, trendSummary(rows)));
  for (let step = 0; step <= gridSteps; step += 1) {
    const value = Math.round((maximum / gridSteps) * step);
    const lineY = y(value);
    svg.append(svgElement('line', { class: 'flux-trend__grid', x1: margin.left, x2: width - margin.right, y1: lineY, y2: lineY }));
    svg.append(svgElement('text', { class: 'flux-trend__axis-label', x: margin.left - 10, y: lineY + 4, 'text-anchor': 'end' }, numberFormat.format(value)));
  }
  svg.append(seriesPath(rows, 'visitors', 'flux-trend__line flux-trend__line--visitors', x, y), seriesPath(rows, 'sessions', 'flux-trend__line flux-trend__line--sessions', x, y));
  rows.forEach((row, index) => {
    svg.append(
      svgElement('circle', { class: 'flux-trend__point flux-trend__point--visitors', cx: x(index), cy: y(row.visitors), r: 3.5 }),
      svgElement('circle', { class: 'flux-trend__point flux-trend__point--sessions', cx: x(index), cy: y(row.sessions), r: 3.5 })
    );
  });
  const labelIndexes = [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])];
  for (const index of labelIndexes) svg.append(svgElement('text', { class: 'flux-trend__axis-label', x: x(index), y: height - 12, 'text-anchor': index === 0 ? 'start' : index === rows.length - 1 ? 'end' : 'middle' }, shortDate(rows[index].day)));
  const details = document.createElement('details');
  details.className = 'govuk-details flux-trend__data';
  const summary = document.createElement('summary');
  summary.className = 'govuk-details__summary';
  summary.append(element('span', 'govuk-details__summary-text', 'View chart data'));
  const table = document.createElement('table');
  table.className = 'govuk-table govuk-table--small-text-until-tablet';
  table.append(tableHead(['Date', 'Visitors', 'Sessions', 'Returning visitors']), tableBody(rows.map((row) => [dateFormat.format(new Date(`${row.day}T00:00:00Z`)), row.visitors, row.sessions, row.returning_visitors])));
  details.append(summary, table);
  section.append(svg, details);
  return section;
}

function seriesPath(rows, key, className, x, y) {
  const points = rows.map((row, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(row[key])}`).join(' ');
  return svgElement('path', { class: className, d: points });
}

function renderHealth(data) {
  const list = document.createElement('div');
  list.className = 'flux-health-list';
  const rows = [
    ['Completion rate', formatPercent(data.completion_rate), `${numberFormat.format(data.completed_session_count ?? 0)} sessions reached a configured success outcome`],
    ['Average session', formatDuration(data.average_session_duration_ms), 'Time between the first and latest interaction'],
    ['Median field dwell', formatDuration(data.median_field_dwell_ms), 'Typical time spent in an interacted field'],
    ['Correction rate', formatPercent(data.correction_rate), `${numberFormat.format(data.correction_count ?? 0)} corrections across typed interactions`]
  ];
  for (const [label, value, note] of rows) {
    const row = document.createElement('div');
    row.className = 'flux-health-list__row';
    const copy = document.createElement('div');
    copy.append(element('h3', 'flux-health-list__label', label), element('p', 'flux-health-list__note', note));
    row.append(copy, element('strong', 'flux-health-list__value', value));
    list.append(row);
  }
  const insight = document.createElement('p');
  insight.className = `flux-insight${Number(data.friction_session_count) > 0 ? ' flux-insight--attention' : ''}`;
  insight.textContent = Number(data.friction_session_count) > 0
    ? `${numberFormat.format(data.friction_session_count)} session${Number(data.friction_session_count) === 1 ? '' : 's'} included help, validation, revisit or rapid-click signals.`
    : 'No explicit friction signals were recorded in this period.';
  const section = document.createElement('div');
  section.append(list, insight);
  return section;
}

function renderInteractions(rows) {
  if (rows.length === 0) return emptyState('No interaction data', 'Ranked behaviours will appear as visitors use the service.');
  const maximum = Math.max(...rows.map((row) => Number(row.count) || 0), 1);
  const list = document.createElement('ol');
  list.className = 'flux-ranking';
  for (const row of rows) {
    const item = document.createElement('li');
    item.className = 'flux-ranking__item';
    const header = document.createElement('div');
    header.className = 'flux-ranking__header';
    header.append(element('span', 'flux-ranking__label', actionLabel(row.action)), element('strong', 'flux-ranking__value', numberFormat.format(Number(row.count) || 0)));
    const bar = document.createElement('div');
    bar.className = 'flux-ranking__track';
    const fill = document.createElement('span');
    fill.className = 'flux-ranking__fill';
    fill.style.width = `${Math.max(3, ((Number(row.count) || 0) / maximum) * 100)}%`;
    bar.append(fill);
    item.append(header, bar);
    list.append(item);
  }
  return list;
}

function renderRealtime(data) {
  if (!data) return emptyState('Realtime data unavailable', 'Collection activity and freshness could not be calculated.');
  const wrapper = document.createElement('div');
  wrapper.className = 'flux-realtime';
  const metrics = document.createElement('div');
  metrics.className = 'flux-realtime__metrics';
  for (const [label, value, note] of [
    ['Active sessions · 5 minutes', data.active_sessions_5m, 'Sessions with a recently accepted interaction'],
    ['Active sessions · 30 minutes', data.active_sessions_30m, 'Sessions active in the wider realtime window'],
    ['Interactions · 5 minutes', data.interactions_5m, 'Events accepted by Flux'],
    ['Interactions · 30 minutes', data.interactions_30m, 'Events accepted by Flux']
  ]) metrics.append(realtimeMetric(label, value, note));

  const freshness = document.createElement('div');
  freshness.className = `flux-realtime__freshness flux-realtime__freshness--${data.freshness_status ?? 'no_data'}`;
  freshness.append(
    element('h3', 'govuk-heading-s', 'Ingestion freshness'),
    element('p', 'govuk-body-s', freshnessCopy(data))
  );

  const rows = data.interactions_per_minute ?? [];
  const maximum = Math.max(1, ...rows.map((row) => Number(row.interaction_count) || 0));
  const chart = document.createElement('div');
  chart.className = 'flux-realtime__bars';
  chart.setAttribute('role', 'img');
  chart.setAttribute('aria-label', realtimeSummary(rows));
  for (const row of rows) {
    const interactionCount = Number(row.interaction_count) || 0;
    const bar = document.createElement('span');
    bar.className = 'flux-realtime__bar';
    bar.style.height = `${interactionCount === 0 ? 0 : Math.max(2, (interactionCount / maximum) * 100)}%`;
    bar.title = `${minuteLabel(row.minute_start_ms)}: ${numberFormat.format(interactionCount)} interaction${interactionCount === 1 ? '' : 's'}`;
    chart.append(bar);
  }
  const details = document.createElement('details');
  details.className = 'govuk-details flux-realtime__data';
  const detailsSummary = document.createElement('summary');
  detailsSummary.className = 'govuk-details__summary';
  detailsSummary.append(element('span', 'govuk-details__summary-text', 'Interactions per minute'));
  const table = document.createElement('table');
  table.className = 'govuk-table govuk-table--small-text-until-tablet';
  table.append(tableHead(['Minute', 'Interactions']), tableBody(rows.map((row) => [minuteLabel(row.minute_start_ms), row.interaction_count]), true));
  details.append(detailsSummary, table);
  wrapper.append(metrics, freshness, chart, details);
  return wrapper;
}

function realtimeMetric(label, value, note) {
  const card = document.createElement('article');
  card.className = 'flux-realtime__metric';
  card.append(
    element('h3', 'flux-realtime__metric-label', label),
    element('p', 'flux-realtime__metric-value', numberFormat.format(Number(value) || 0)),
    element('p', 'flux-realtime__metric-note', note)
  );
  return card;
}

function freshnessCopy(data) {
  if (data.latest_accepted_at_ms === null || data.latest_accepted_at_ms === undefined) return 'No interactions have been accepted in the realtime window.';
  const age = formatDuration(data.freshness_ms ?? 0);
  const state = { live: 'Live', delayed: 'Delayed', stale: 'Stale' }[data.freshness_status] ?? 'Unknown';
  return `${state} · latest interaction accepted ${age} ago at ${minuteLabel(data.latest_accepted_at_ms)}.`;
}

function realtimeSummary(rows) {
  const total = rows.reduce((sum, row) => sum + (Number(row.interaction_count) || 0), 0);
  const activeMinutes = rows.filter((row) => Number(row.interaction_count) > 0).length;
  return `${numberFormat.format(total)} interactions across ${numberFormat.format(activeMinutes)} of the last 30 minutes.`;
}

function minuteLabel(value) {
  return new Date(Number(value) || 0).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function renderServiceModel(data) {
  if (!data) return emptyState('No published service model', 'Publish a validated model before interpreting task, field or complexity analytics.');
  const wrapper = document.createElement('div');
  wrapper.className = 'flux-service-model';
  const metrics = document.createElement('div');
  metrics.className = 'flux-health-list';
  const configuredEntities = Object.values(data.entity_counts ?? {}).reduce((sum, count) => sum + (Number(count) || 0), 0);
  for (const [label, value, note] of [
    ['Published model', `Version ${numberFormat.format(data.version ?? 0)}`, data.model_key ?? 'No stable model key'],
    ['Configured entities', numberFormat.format(configuredEntities), `${numberFormat.format(data.binding_count ?? 0)} semantic bindings`],
    ['Configured outcomes', numberFormat.format(data.outcome_count ?? 0), `${numberFormat.format(data.key_event_count ?? 0)} key events`],
    ['Semantic mapping coverage', formatPercent(data.coverage?.mapping_rate), `${numberFormat.format(data.coverage?.resolved_event_count ?? 0)} of ${numberFormat.format(data.coverage?.event_count ?? 0)} current-or-unmapped interactions resolved · ${numberFormat.format(data.coverage?.retired_model_event_count ?? 0)} retired-version interactions reported separately`]
  ]) {
    const row = document.createElement('div');
    row.className = 'flux-health-list__row';
    const copy = document.createElement('div');
    copy.append(element('h3', 'flux-health-list__label', label), element('p', 'flux-health-list__note', note));
    row.append(copy, element('strong', 'flux-health-list__value', value));
    metrics.append(row);
  }
  const complexity = data.transaction_complexity ?? [];
  const details = document.createElement('details');
  details.className = 'govuk-details';
  const summary = document.createElement('summary');
  summary.className = 'govuk-details__summary';
  summary.append(element('span', 'govuk-details__summary-text', 'Transaction complexity'));
  const table = document.createElement('table');
  table.className = 'govuk-table govuk-table--small-text-until-tablet';
  table.append(tableHead(['Transaction', 'Questions', 'Complexity']), tableBody(complexity.map((row) => [row.label, row.question_count, row.complexity === null ? 'Not established' : `${formatDecimal(row.complexity)} of 7`])));
  details.append(summary, table);
  const outcomes = document.createElement('details');
  outcomes.className = 'govuk-details';
  const outcomesSummary = document.createElement('summary');
  outcomesSummary.className = 'govuk-details__summary';
  outcomesSummary.append(element('span', 'govuk-details__summary-text', 'Configured key events and outcomes'));
  const outcomesTable = document.createElement('table');
  outcomesTable.className = 'govuk-table govuk-table--small-text-until-tablet';
  outcomesTable.append(
    tableHead(['Key event', 'Outcome', 'Type', 'Events', 'Sessions']),
    tableBody((data.key_events ?? []).map((row) => [row.label, row.outcome_label, capitalise(row.outcome_type), row.event_count, row.session_count]))
  );
  const outcomesTableScroll = document.createElement('div');
  outcomesTableScroll.className = 'flux-service-model__table-scroll';
  outcomesTableScroll.append(outcomesTable);
  outcomes.append(outcomesSummary, outcomesTableScroll);
  wrapper.append(metrics, details, outcomes);
  return wrapper;
}

function renderCohorts(data) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flux-cohorts';
  wrapper.append(element('p', 'flux-cohorts__privacy', data.privacy_note ?? 'Named cohort results are shown only when at least 5 journeys share the pattern.'));
  wrapper.append(
    cohortGroup('Visit maturity', 'Whether journeys are first-time, returning or established.', data.visit_maturity),
    cohortGroup('Outcome paths', 'Whether journeys completed smoothly, recovered from friction or did not reach an outcome.', data.outcome_paths),
    cohortGroup('Interaction patterns', 'Heuristic journey patterns derived from supported, content-free signals.', data.journey_patterns, journeyPatternCoverage(data.journey_patterns))
  );
  return wrapper;
}

function cohortGroup(title, description, data = {}, coverage = '') {
  const section = document.createElement('section');
  section.className = 'flux-cohort-group';
  section.append(element('h3', 'govuk-heading-m flux-cohort-group__title', title), element('p', 'govuk-body-s flux-cohort-group__copy', description));
  if (coverage) section.append(element('p', 'govuk-body-s flux-cohort-group__coverage', coverage));
  const rows = data?.rows ?? [];
  if (rows.length === 0) {
    const count = Number(data?.suppressed_session_count) || Number(data?.assessed_session_count) || 0;
    section.append(emptyState('Building a privacy-safe cohort', count > 0
      ? `${numberFormat.format(count)} journey${count === 1 ? '' : 's'} cannot yet be shown as a named cohort. At least ${numberFormat.format(data?.minimum_cohort_size ?? 5)} are required.`
      : 'Cohort results will appear after enough consented journeys are recorded.'));
    return section;
  }
  const list = document.createElement('div');
  list.className = 'flux-cohort-list';
  for (const row of rows) list.append(cohortCard(row));
  section.append(list);
  if (Number(data.suppressed_session_count) > 0) section.append(element('p', 'govuk-body-s flux-cohort-group__suppressed', `${numberFormat.format(data.suppressed_session_count)} additional journey${Number(data.suppressed_session_count) === 1 ? '' : 's'} remain suppressed because their cohort is smaller than ${numberFormat.format(data.minimum_cohort_size ?? 5)}.`));
  return section;
}

function cohortCard(row) {
  const card = document.createElement('article');
  card.className = 'flux-cohort';
  const heading = document.createElement('div');
  heading.className = 'flux-cohort__heading';
  heading.append(element('h4', 'flux-cohort__label', row.label), element('strong', 'flux-cohort__share', formatPercent(row.share)));
  const metrics = document.createElement('dl');
  metrics.className = 'flux-cohort__metrics';
  for (const [label, value] of [
    ['Journeys', numberFormat.format(row.session_count)],
    ['Completion', formatPercent(row.completion_rate)],
    ['Friction', formatPercent(row.friction_rate)],
    ['Returning', formatPercent(row.returning_session_rate)]
  ]) metrics.append(definition(label, value));
  card.append(heading, element('p', 'flux-cohort__description', row.description), metrics);
  return card;
}

function journeyPatternCoverage(data = {}) {
  const parts = [];
  if (Number(data.assessed_session_count) > 0) parts.push(`${numberFormat.format(data.assessed_session_count)} recent journey${Number(data.assessed_session_count) === 1 ? '' : 's'} assessed`);
  if (data.is_sample_limited) parts.push(`most recent ${numberFormat.format(data.sample_limit)} of ${numberFormat.format(data.selected_session_count)} used`);
  if (Number(data.incomplete_history_session_count) > 0) {
    const count = Number(data.incomplete_history_session_count);
    parts.push(`${numberFormat.format(count)} excluded because ${count === 1 ? 'its' : 'their'} full event history was not available`);
  }
  return parts.join(' · ');
}

function renderSignals(dimensions) {
  if (dimensions.length === 0) return emptyState('No behavioural indicators yet', 'Indicators appear after sessions contain enough consented interaction metadata.');
  const wrapper = document.createElement('div');
  const note = element('p', 'flux-safeguard', 'These are service-friction heuristics, not classifications or judgements of a person. Neutral scores mean there is not enough supported evidence to move the indicator.');
  const core = document.createElement('div');
  core.className = 'flux-signal-grid';
  for (const dimension of dimensions.filter((item) => item.tier === 'core')) core.append(signalCard(dimension));
  const details = document.createElement('details');
  details.className = 'govuk-details flux-signal-details';
  const summary = document.createElement('summary');
  summary.className = 'govuk-details__summary';
  summary.append(element('span', 'govuk-details__summary-text', 'View all 20 behavioural indicators'));
  const table = document.createElement('table');
  table.className = 'govuk-table govuk-table--small-text-until-tablet';
  table.append(tableHead(['Indicator', 'Tier', 'Median score']), tableBody(dimensions.map((dimension) => [dimension.label, capitalise(dimension.tier), formatDecimal(dimension.score)]), true));
  details.append(summary, table);
  wrapper.append(note, core, details);
  return wrapper;
}

function signalCard(dimension) {
  const card = document.createElement('article');
  card.className = 'flux-signal';
  const track = document.createElement('div');
  track.className = 'flux-signal__track';
  const fill = document.createElement('span');
  fill.className = 'flux-signal__fill';
  fill.style.width = `${Math.max(0, Math.min(100, Number(dimension.score) || 0))}%`;
  track.append(fill);
  card.append(element('h3', 'flux-signal__label', dimension.label), element('p', 'flux-signal__score', formatDecimal(dimension.score)), track, element('p', 'flux-signal__scale', '0 · neutral 50 · 100'));
  return card;
}

function journeyCard(session, index) {
  const article = document.createElement('article');
  article.className = 'flux-journey';
  const header = document.createElement('div');
  header.className = 'flux-journey__header';
  const title = document.createElement('div');
  title.append(element('p', 'flux-journey__eyebrow', `Journey ${index + 1}`), element('h3', 'govuk-heading-m flux-journey__title', dateTimeFormat.format(new Date(session.started_at_ms))));
  const badge = element('span', `flux-badge ${session.is_returning_visitor ? 'flux-badge--returning' : 'flux-badge--new'}`, session.is_returning_visitor ? 'Returning visitor' : 'New visitor');
  header.append(title, badge);
  const metrics = document.createElement('dl');
  metrics.className = 'flux-journey__metrics';
  for (const [label, value] of [
    ['Duration', formatDuration(Number(session.last_seen_at_ms) - Number(session.started_at_ms))],
    ['Interactions', numberFormat.format(Number(session.event_count) || session.events?.length || 0)],
    ['Journey outcome', journeyOutcome(session)]
  ]) metrics.append(definition(label, value));
  const toggle = element('button', 'govuk-button govuk-button--secondary flux-journey__button', 'View journey');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  const panel = document.createElement('div');
  panel.className = 'flux-journey__detail';
  panel.hidden = true;
  toggle.addEventListener('click', async () => {
    if (!panel.hidden) {
      panel.hidden = true;
      toggle.textContent = 'View journey';
      toggle.setAttribute('aria-expanded', 'false');
      return;
    }
    toggle.disabled = true;
    toggle.textContent = 'Loading journey…';
    try {
      const response = await fetch(`/api/dashboard/researchops/session/${encodeURIComponent(session.id)}`, { credentials: 'include' });
      if (!response.ok) throw new Error('history_unavailable');
      const data = await response.json();
      panel.replaceChildren(journeyTimeline(data.journey.events ?? []), sessionDimensionDetails(data.journey.dimension_scores));
      panel.hidden = false;
      toggle.textContent = 'Hide journey';
      toggle.setAttribute('aria-expanded', 'true');
    } catch {
      panel.replaceChildren(element('p', 'govuk-error-message', 'Complete journey history is temporarily unavailable.'));
      panel.hidden = false;
      toggle.textContent = 'Try journey again';
    } finally {
      toggle.disabled = false;
    }
  });
  article.append(header, metrics, toggle, panel);
  return article;
}

function journeyTimeline(events) {
  const section = document.createElement('section');
  section.className = 'flux-timeline';
  section.append(element('h4', 'govuk-heading-s', 'Complete interaction sequence'));
  if (events.length === 0) {
    section.append(element('p', 'govuk-body-s', 'No interaction events were received for this session.'));
    return section;
  }
  const list = document.createElement('ol');
  list.className = 'flux-timeline__list';
  for (const event of events) {
    const item = document.createElement('li');
    item.className = 'flux-timeline__item';
    item.append(element('time', 'flux-timeline__time', new Date(event.occurred_at_ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })), element('p', 'flux-timeline__copy', event.narrative));
    list.append(item);
  }
  section.append(list);
  return section;
}

function sessionDimensionDetails(scores) {
  const details = document.createElement('details');
  details.className = 'govuk-details flux-journey__signals';
  const summary = document.createElement('summary');
  summary.className = 'govuk-details__summary';
  summary.append(element('span', 'govuk-details__summary-text', 'View session indicators'));
  const table = document.createElement('table');
  table.className = 'govuk-table govuk-table--small-text-until-tablet';
  table.append(tableHead(['Indicator', 'Score']), tableBody((scores?.dimensions ?? []).map((dimension) => [dimension.label, formatDecimal(dimension.score)]), true));
  details.append(summary, element('p', 'govuk-body-s', 'Session indicators describe interaction patterns and must not be used to judge the visitor.'), table);
  return details;
}

function journeyOutcome(session) {
  if (Number(session.successful_outcome_count) > 0) return 'Success outcome reached';
  if (Number(session.friction_event_count) > 0) return 'Friction signal';
  return 'In progress';
}

function periodDescription(period, data) {
  if (!period) return 'Cumulative consented activity for the selected period.';
  const range = period.key === 'all' ? 'all recorded activity' : `${dateFormat.format(new Date(period.start_at_ms))} to ${dateFormat.format(new Date(period.end_at_ms - 1))}`;
  return `${capitalise(range)} · ${numberFormat.format(data.new_visitor_count ?? 0)} first-time visitors; ${numberFormat.format(data.returning_visitor_count ?? 0)} visitors returned.`;
}

function comparisonText(current, previous) {
  if (!Number.isFinite(Number(previous))) return 'No comparison period';
  if (Number(previous) === 0) return Number(current) === 0 ? 'No change from previous period' : 'New activity in this period';
  const change = ((Number(current) - Number(previous)) / Number(previous)) * 100;
  if (Math.abs(change) < 0.05) return 'No change from previous period';
  return `${Math.abs(change).toFixed(Math.abs(change) >= 10 ? 0 : 1)}% ${change > 0 ? 'up' : 'down'} from previous period`;
}

function rateComparison(current, previous) {
  if (!Number.isFinite(Number(previous))) return 'No comparison period';
  const change = Number(current) - Number(previous);
  if (Math.abs(change) < 0.05) return 'No change from previous period';
  return `${Math.abs(change).toFixed(1)} percentage points ${change > 0 ? 'up' : 'down'}`;
}

function trendSummary(rows) {
  const visitors = rows.reduce((total, row) => total + (Number(row.visitors) || 0), 0);
  const sessions = rows.reduce((total, row) => total + (Number(row.sessions) || 0), 0);
  return `${rows.length} daily points showing ${numberFormat.format(visitors)} visitor appearances and ${numberFormat.format(sessions)} sessions.`;
}

function shortDate(value) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(`${value}T00:00:00Z`));
}

function formatDuration(value) {
  const milliseconds = Math.max(0, Number(value) || 0);
  if (milliseconds < 1000) return milliseconds ? `${Math.round(milliseconds)}ms` : '0s';
  const seconds = milliseconds / 1000;
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

function formatPercent(value) {
  return `${formatDecimal(value)}%`;
}

function formatDecimal(value) {
  const number = Number(value) || 0;
  return number.toLocaleString('en-GB', { maximumFractionDigits: 1 });
}

function actionLabel(value) {
  return ACTION_LABELS[value] ?? capitalise(String(value ?? 'Interaction').replace(/[._:-]+/g, ' '));
}

function capitalise(value) {
  const text = String(value ?? '');
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : '';
}

function definition(term, value) {
  const wrapper = document.createElement('div');
  wrapper.append(element('dt', 'flux-journey__metric-label', term), element('dd', 'flux-journey__metric-value', value));
  return wrapper;
}

function emptyState(title, copy) {
  const state = document.createElement('div');
  state.className = 'flux-empty';
  state.append(element('h3', 'govuk-heading-m', title), element('p', 'govuk-body', copy));
  return state;
}

function tableHead(labels) {
  const head = document.createElement('thead');
  head.className = 'govuk-table__head';
  const row = document.createElement('tr');
  row.className = 'govuk-table__row';
  for (const label of labels) {
    const heading = element('th', 'govuk-table__header', label);
    heading.scope = 'col';
    row.append(heading);
  }
  head.append(row);
  return head;
}

function tableBody(rows, numericLast = false) {
  const body = document.createElement('tbody');
  body.className = 'govuk-table__body';
  for (const values of rows) {
    const row = document.createElement('tr');
    row.className = 'govuk-table__row';
    values.forEach((value, index) => {
      const cell = element('td', `govuk-table__cell${numericLast && index === values.length - 1 ? ' govuk-table__cell--numeric' : ''}`, value);
      row.append(cell);
    });
    body.append(row);
  }
  return body;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function link(href, text, className) {
  const anchor = element('a', className, text);
  anchor.href = href;
  return anchor;
}

function svgElement(tag, attributes = {}, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  if (text !== undefined) node.textContent = String(text);
  return node;
}
