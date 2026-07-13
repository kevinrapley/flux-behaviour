import { createTaskFunnelManager } from './task-funnel-manager.mjs';

const dashboard = document.querySelector('[data-flux-dashboard]');
const status = document.querySelector('[data-flux-live-status]');
const content = document.querySelector('[data-flux-dashboard-content]');
const overview = document.querySelector('[data-flux-overview]');
const uncertainty = document.querySelector('[data-flux-uncertainty]');
const comparisonReport = document.querySelector('[data-flux-comparison-report]');
const periodCopy = document.querySelector('[data-flux-period-copy]');
const trend = document.querySelector('[data-flux-trend]');
const realtime = document.querySelector('[data-flux-realtime]');
const serviceModel = document.querySelector('[data-flux-service-model]');
const eventReport = document.querySelector('[data-flux-event-report]');
const entityReport = document.querySelector('[data-flux-entity-report]');
const funnelReport = document.querySelector('[data-flux-funnel-report]');
const fieldReport = document.querySelector('[data-flux-field-report]');
const health = document.querySelector('[data-flux-health]');
const interactions = document.querySelector('[data-flux-interactions]');
const cohorts = document.querySelector('[data-flux-cohorts]');
const signals = document.querySelector('[data-flux-signals]');
const journeys = document.querySelector('[data-flux-live-journeys]');
const governance = document.querySelector('[data-flux-governance]');
const taskFunnelManagerRoot = document.querySelector('[data-flux-task-funnel-manager]');
const refresh = document.querySelector('[data-flux-refresh]');
const rangeButtons = [...document.querySelectorAll('[data-flux-range]')];
const customRange = document.querySelector('[data-flux-custom-range]');
const customStart = document.querySelector('[data-flux-custom-start]');
const customEnd = document.querySelector('[data-flux-custom-end]');
const customApply = document.querySelector('[data-flux-custom-apply]');
const compareSelect = document.querySelector('[data-flux-compare]');
const exportReportSelect = document.querySelector('[data-flux-export-report]');
const exportLink = document.querySelector('[data-flux-export]');
const viewLinks = [...document.querySelectorAll('[data-flux-view]')];
const reportAreas = [...document.querySelectorAll('[data-flux-report-area]')];
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

const taskFunnelManager = createTaskFunnelManager({
  root: taskFunnelManagerRoot,
  tenantId: dashboard?.dataset.fluxTenant,
  onPublished: () => void loadDashboard()
});

let currentRange = new URL(window.location.href).searchParams.get('range') || '30d';
if (!rangeButtons.some((button) => button.dataset.fluxRange === currentRange)) currentRange = '30d';
const reportViews = new Set(viewLinks.map((link) => link.dataset.fluxView));
let currentView = new URL(window.location.href).searchParams.get('view') || 'overview';
if (!reportViews.has(currentView)) {
  currentView = 'overview';
  const url = new URL(window.location.href);
  url.searchParams.set('view', currentView);
  window.history.replaceState({}, '', url);
}

for (const viewLink of viewLinks) {
  viewLink.addEventListener('click', (event) => {
    event.preventDefault();
    currentView = viewLink.dataset.fluxView;
    const url = new URL(window.location.href);
    url.searchParams.set('view', currentView);
    window.history.replaceState({}, '', url);
    updateViewControls();
    const heading = document.querySelector(`[data-flux-report-area="${currentView}"] h2`);
    heading?.setAttribute('tabindex', '-1');
    heading?.focus();
  });
}

for (const button of rangeButtons) {
  button.addEventListener('click', () => {
    if (button.dataset.fluxRange === currentRange) return;
    currentRange = button.dataset.fluxRange;
    updateRangeControls();
    if (currentRange === 'custom') return;
    const url = new URL(window.location.href);
    url.searchParams.set('range', currentRange);
    url.searchParams.delete('start');
    url.searchParams.delete('end');
    window.history.replaceState({}, '', url);
    updateUrlBackedLinks();
    void loadDashboard();
  });
}

customApply?.addEventListener('click', () => {
  if (!customStart.value || !customEnd.value) {
    status.textContent = 'Choose both a start and end date.';
    customStart.focus();
    return;
  }
  const url = new URL(window.location.href);
  const params = url.searchParams;
  params.set('range', 'custom');
  params.set('start', customStart.value);
  params.set('end', customEnd.value);
  window.history.replaceState({}, '', url);
  updateUrlBackedLinks();
  void loadDashboard();
});

compareSelect?.addEventListener('change', () => {
  const url = new URL(window.location.href);
  url.searchParams.set('compare', compareSelect.value);
  window.history.replaceState({}, '', url);
  updateUrlBackedLinks();
  void loadDashboard();
});

exportReportSelect?.addEventListener('change', updateExportLink);

refresh?.addEventListener('click', () => void loadDashboard());
updateRangeControls();
updateViewControls();
void loadDashboard();

async function loadDashboard() {
  setLoading(true);
  try {
    const params = new URL(window.location.href).searchParams;
    const response = await fetch(`/api/dashboard/researchops?${params.toString()}`, { credentials: 'include' });
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
  customRange.hidden = currentRange !== 'custom';
  const params = new URL(window.location.href).searchParams;
  if (currentRange === 'custom') {
    customStart.value = params.get('start') ?? '';
    customEnd.value = params.get('end') ?? '';
  }
  compareSelect.value = params.get('compare') ?? 'period';
  updateExportLink();
  updateViewLinks();
  for (const button of rangeButtons) {
    const active = button.dataset.fluxRange === currentRange;
    button.classList.toggle('flux-dashboard__range-button--active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function updateViewControls() {
  for (const link of viewLinks) {
    const active = link.dataset.fluxView === currentView;
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  for (const area of reportAreas) area.hidden = area.dataset.fluxReportArea !== currentView;
  updateViewLinks();
}

function updateViewLinks() {
  const current = new URL(window.location.href);
  for (const link of viewLinks) {
    const target = new URL(current.href);
    target.searchParams.set('view', link.dataset.fluxView);
    link.href = `${target.pathname}?${target.searchParams.toString()}`;
  }
}

function updateUrlBackedLinks() {
  updateExportLink();
  updateViewLinks();
}

function updateExportLink() {
  const params = new URL(window.location.href).searchParams;
  params.set('range', currentRange);
  params.set('report', exportReportSelect.value);
  exportLink.href = `/api/dashboard/researchops/export.csv?${params.toString()}`;
}

function renderDashboard(data) {
  const analytics = data.analytics ?? {};
  const summary = analytics.overview ?? {};
  content.hidden = false;
  status.className = 'flux-dashboard__status';
  status.textContent = `${analytics.period?.label ?? 'Selected period'} · updated ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  periodCopy.textContent = periodDescription(analytics.period, summary);
  overview.replaceChildren(...overviewCards(summary, analytics.comparison));
  uncertainty.replaceChildren(renderUncertainty(analytics.uncertainty));
  comparisonReport.replaceChildren(renderComparisonReport(analytics.comparison_report, analytics.comparison_mode));
  realtime.replaceChildren(renderRealtime(analytics.realtime));
  trend.replaceChildren(renderTrend(analytics.trend ?? []));
  serviceModel.replaceChildren(renderServiceModel(analytics.service_model));
  eventReport.replaceChildren(renderEventReport(analytics.event_report));
  entityReport.replaceChildren(renderEntityReport(analytics.entity_report));
  funnelReport.replaceChildren(renderFunnelReport(analytics.funnel_report));
  fieldReport.replaceChildren(renderFieldReport(analytics.field_report));
  health.replaceChildren(renderHealth(summary));
  interactions.replaceChildren(renderInteractions(analytics.actions ?? []));
  cohorts.replaceChildren(renderCohorts(analytics.cohorts ?? {}, analytics.lifecycle));
  signals.replaceChildren(renderSignals(analytics.dimension_scores ?? []));
  journeys.replaceChildren(...(data.journeys ?? []).map(journeyCard));
  governance.replaceChildren(renderGovernance(analytics.governance));
  void taskFunnelManager.load();
  if ((data.journeys ?? []).length === 0) journeys.replaceChildren(emptyState('No journeys in this period', 'Choose a wider date range or check again after visitors have used ResearchOps.'));
}

function renderUncertainty(data) {
  if (!data?.rates?.length) return emptyState('Uncertainty unavailable', 'Rate intervals appear after the selected period contains journeys.');
  const section = document.createElement('section');
  section.className = 'flux-uncertainty';
  section.append(
    element('h3', 'govuk-heading-m', 'How certain are these rates?'),
    element('p', 'govuk-body-s flux-safeguard', data.note)
  );
  const table = document.createElement('table');
  table.className = 'govuk-table govuk-table--small-text-until-tablet';
  table.append(
    tableHead(['Measure', 'Observed', 'Sample', 'Rate', '95% interval', 'Interpretation']),
    tableBody(data.rates.map((rate) => [
      rate.label,
      rate.numerator,
      rate.denominator,
      formatPercent(rate.rate),
      `${formatPercent(rate.lower)} to ${formatPercent(rate.upper)}`,
      rate.interpretation
    ]))
  );
  const scroll = document.createElement('div');
  scroll.className = 'flux-uncertainty__table';
  scroll.append(table);
  section.append(scroll);
  return section;
}

function renderGovernance(data) {
  if (!data) return emptyState('Governance report unavailable', 'Data-quality controls could not be loaded for this selection.');
  const wrapper = document.createElement('div');
  wrapper.className = 'flux-governance';
  wrapper.append(element('p', 'govuk-body-s flux-safeguard', data.boundary));
  const table = document.createElement('table');
  table.className = 'govuk-table govuk-table--small-text-until-tablet';
  table.append(
    tableHead(['Control', 'Status', 'Evidence']),
    tableBody((data.controls ?? []).map((control) => [control.label, control.status, control.evidence]))
  );
  wrapper.append(table);
  if (data.limitations?.length) {
    const heading = element('h3', 'govuk-heading-m', 'Known limitations and release gates');
    const list = document.createElement('ul');
    list.className = 'govuk-list govuk-list--bullet';
    for (const limitation of data.limitations) list.append(element('li', '', limitation));
    wrapper.append(heading, list);
  }
  return wrapper;
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

function renderComparisonReport(data, mode) {
  if (mode === 'period' || !mode) return emptyState('Previous-period comparison', 'Change against the preceding like-for-like period is shown alongside metrics throughout this dashboard.');
  if (!data) return emptyState('Comparison unavailable', 'Publish a valid service model or choose another comparison dimension.');
  const wrapper = document.createElement('div');
  wrapper.className = 'flux-comparison-report';
  wrapper.append(element('h3', 'govuk-heading-m', data.label), element('p', 'govuk-body-s flux-safeguard', data.caveat));
  const rows = (data.rows ?? []).map((row) => row.suppressed
    ? [row.label, `Suppressed — fewer than ${numberFormat.format(data.minimum_group_size)} journeys`, '—', '—', '—']
    : [row.label, row.session_count, formatDecimal(row.interactions_per_session), formatPercent(row.completion_rate), formatPercent(row.friction_rate)]);
  const table = document.createElement('table');
  table.className = 'govuk-table govuk-table--small-text-until-tablet';
  table.append(tableHead(['Group', 'Journeys', 'Interactions per journey', 'Completion', 'Friction']), tableBody(rows));
  const scroll = document.createElement('div');
  scroll.className = 'flux-comparison-report__table';
  scroll.append(table);
  wrapper.append(scroll);
  return wrapper;
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

function renderEventReport(data) {
  if (!data) return emptyState('Event report unavailable', 'Publish a valid service model before interpreting event and key-event evidence.');
  const wrapper = document.createElement('div');
  wrapper.className = 'flux-event-report';
  wrapper.append(renderEventTrend(data.trend ?? []));
  const events = reportDetails('Ranked events', `${numberFormat.format((data.events ?? []).length)} event types`,
    ['Event', 'Class', 'Interactions', 'Journeys', 'Journey rate', 'Change'],
    (data.events ?? []).map((row) => [actionLabel(row.action), capitalise(row.event_class), row.event_count, row.session_count, formatPercent(row.sessions_rate), formatChange(row.event_count_change, data.comparison_available)]));
  const keyEvents = reportDetails('Configured key events', `${numberFormat.format((data.key_events ?? []).length)} key events with selected-period evidence`,
    ['Key event', 'Outcome', 'Interactions', 'Journeys', 'Journey rate', 'Change'],
    (data.key_events ?? []).map((row) => [row.label, `${row.outcome_label} · ${capitalise(row.outcome_type)}`, row.event_count, row.session_count, formatPercent(row.sessions_rate), formatChange(row.event_count_change, data.comparison_available)]));
  const elements = reportDetails('Pages, forms and controls', `${numberFormat.format((data.elements ?? []).length)} configured elements with selected-period evidence`,
    ['Element', 'Type', 'Mapped purpose', 'Interactions', 'Journeys', 'Journey rate', 'Change'],
    (data.elements ?? []).map((row) => [semanticElementLabel(row.element_key), capitalise(row.role), row.entity_label, row.event_count, row.session_count, formatPercent(row.sessions_rate), formatChange(row.event_count_change, data.comparison_available)]));
  wrapper.append(events, keyEvents, elements);
  return wrapper;
}

function renderEventTrend(rows) {
  if (rows.length === 0) return emptyState('No event trend yet', 'Daily interaction and key-event evidence will appear after events are recorded.');
  const maximum = Math.max(1, ...rows.map((row) => Number(row.event_count) || 0));
  const chart = document.createElement('div');
  chart.className = 'flux-event-trend';
  chart.setAttribute('role', 'img');
  chart.setAttribute('aria-label', `${numberFormat.format(rows.reduce((sum, row) => sum + Number(row.event_count || 0), 0))} interactions across ${numberFormat.format(rows.length)} reported days.`);
  for (const row of rows) {
    const bar = document.createElement('span');
    bar.className = 'flux-event-trend__bar';
    bar.style.height = `${Number(row.event_count) === 0 ? 0 : Math.max(2, (Number(row.event_count) / maximum) * 100)}%`;
    bar.title = `${shortDate(row.day)}: ${numberFormat.format(row.event_count)} interactions; ${numberFormat.format(row.key_event_count)} key event${Number(row.key_event_count) === 1 ? '' : 's'}`;
    chart.append(bar);
  }
  const details = reportDetails('Daily event data', `${numberFormat.format(rows.length)} reported days`, ['Date', 'Interactions', 'Key events'], rows.map((row) => [shortDate(row.day), row.event_count, row.key_event_count]));
  const section = document.createElement('div');
  section.append(chart, details);
  return section;
}

function renderEntityReport(data) {
  if (!data) return emptyState('Service performance unavailable', 'Publish a valid service model before interpreting semantic entity performance.');
  const wrapper = document.createElement('div');
  wrapper.className = 'flux-entity-report';
  const groups = [
    ['transaction', 'Transactions'],
    ['task', 'Tasks'],
    ['step', 'Steps'],
    ['question', 'Questions'],
    ['field', 'Fields']
  ];
  for (const [type, label] of groups) {
    const rows = data.by_type?.[type] ?? [];
    wrapper.append(reportDetails(label, `${numberFormat.format(rows.length)} configured ${type}${rows.length === 1 ? '' : 's'} with evidence`,
      ['Service entity', 'Journeys', 'Entry', 'Exit', 'Success', 'Friction', 'Average time', 'Change'],
      rows.map((row) => [entityLabel(row), row.session_count, row.entry_session_count, row.exit_session_count, formatPercent(row.success_rate), formatPercent(row.friction_rate), formatDuration(row.average_duration_ms), formatChange(row.session_count_change, data.comparison_available)])));
  }
  return wrapper;
}

function renderFunnelReport(data) {
  if (!data) return emptyState('Funnel report unavailable', 'Publish a valid service model before interpreting transaction progress.');
  const transactions = data.transactions ?? [];
  if (transactions.length === 0) return emptyState('No configured transactions', 'Add transactions and ordered steps to the published service model.');
  const wrapper = document.createElement('div');
  wrapper.className = 'flux-funnel-report';
  for (const transaction of transactions) {
    const article = document.createElement('article');
    article.className = 'flux-funnel';
    article.append(element('h3', 'govuk-heading-m flux-funnel__title', transaction.label));
    const metrics = document.createElement('dl');
    metrics.className = 'flux-funnel__metrics';
    for (const [label, value, context] of [
      ['Started', numberFormat.format(transaction.started_session_count), 'journeys entering this configured transaction'],
      ['Completion', formatPercent(transaction.completion_rate), `${numberFormat.format(transaction.completed_session_count)} configured successes`],
      ['Abandonment', formatPercent(transaction.abandonment_rate), `${numberFormat.format(transaction.abandoned_session_count)} closed journeys without an outcome`],
      ['Recovery', formatPercent(transaction.recovery_rate), `${numberFormat.format(transaction.recovered_session_count)} of ${numberFormat.format(transaction.friction_session_count)} journeys with friction`]
    ]) metrics.append(funnelMetric(label, value, context));
    article.append(metrics);
    if (Number(transaction.started_session_count) === 0) {
      article.append(element('p', 'govuk-body-s flux-funnel__empty', 'No journey started this configured transaction in the selected period.'));
    } else {
      article.append(element('p', 'govuk-body-s flux-funnel__context', `${numberFormat.format(transaction.failed_session_count)} failed · ${numberFormat.format(transaction.in_progress_session_count)} in progress · completion ${formatChangePoints(transaction.completion_rate_change, data.comparison_available)} · median ${formatDuration(transaction.median_completion_ms)} · 90th percentile ${formatDuration(transaction.p90_completion_ms)}.`));
    }
    const table = document.createElement('table');
    table.className = 'govuk-table govuk-table--small-text-until-tablet';
    table.append(
      tableHead(['Step', 'Reached journeys', 'Reach', 'Drop-off from previous']),
      tableBody((transaction.steps ?? []).map((step) => [step.label, step.session_count, formatPercent(step.reach_rate), `${numberFormat.format(step.step_dropoff_count)} · ${formatPercent(step.step_dropoff_rate)}`]))
    );
    const scroll = document.createElement('div');
    scroll.className = 'flux-funnel__steps';
    scroll.append(table);
    article.append(scroll);
    wrapper.append(article);
  }
  return wrapper;
}

function renderFieldReport(data) {
  if (!data) return emptyState('Field report unavailable', 'Publish a valid service model before interpreting field evidence.');
  const fields = data.fields ?? [];
  if (fields.length === 0) return emptyState('No configured fields', 'Add fields beneath questions in the published service model.');
  const wrapper = document.createElement('div');
  wrapper.className = 'flux-field-report';
  const table = document.createElement('table');
  table.className = 'govuk-table govuk-table--small-text-until-tablet';
  table.append(
    tableHead(['Field', 'Status', 'Exposed journeys', 'Interacted', 'Coverage', 'Edited', 'Validation', 'Outcome success', 'Corrections', 'Change']),
    tableBody(fields.map((field) => [
      field.complexity === null ? field.label : `${field.label} · complexity ${formatDecimal(field.complexity)} of 7`,
      field.required ? `Required · ${numberFormat.format(field.required_skip_attempt_session_count)} empty-field validation attempts` : 'Optional',
      field.exposed_session_count,
      `${field.interacted_session_count} · ${numberFormat.format(field.non_interaction_session_count)} did not interact`,
      formatPercent(field.coverage_rate),
      `${field.edited_session_count} · ${formatPercent(field.edited_completion_rate)}`,
      `${field.validation_session_count} · ${formatPercent(field.validation_rate)}`,
      `${field.successful_outcome_session_count} · ${formatPercent(field.successful_outcome_rate)}`,
      field.correction_count,
      formatChangePoints(field.coverage_rate_change, data.comparison_available)
    ]))
  );
  const scroll = document.createElement('div');
  scroll.className = 'flux-field-report__table';
  scroll.append(table);
  wrapper.append(scroll);
  for (const field of fields) wrapper.append(fieldDistributions(field));
  return wrapper;
}

function fieldDistributions(field) {
  const details = document.createElement('details');
  details.className = 'govuk-details flux-field-distributions';
  const summary = document.createElement('summary');
  summary.className = 'govuk-details__summary';
  summary.append(element('span', 'govuk-details__summary-text', `${field.label} distributions`));
  const grids = document.createElement('div');
  grids.className = 'flux-field-distributions__grid';
  grids.append(
    distributionTable('Dwell before input distribution', field.dwell_distribution, [['under_1s', 'Under 1 second'], ['from_1_to_5s', '1 to 5 seconds'], ['from_5_to_15s', '5 to 15 seconds'], ['from_15_to_60s', '15 to 60 seconds'], ['over_60s', '60 seconds or more']]),
    distributionTable('Safe value-length distribution', field.length_distribution, [['empty', 'Empty'], ['from_1_to_20', '1 to 20 characters'], ['from_21_to_100', '21 to 100 characters'], ['from_101_to_500', '101 to 500 characters'], ['over_500', 'More than 500 characters']])
  );
  details.append(summary, element('p', 'govuk-body-s', 'These aggregate buckets never contain or reveal entered values.'), grids);
  return details;
}

function distributionTable(title, distribution, buckets) {
  const section = document.createElement('section');
  section.append(element('h4', 'govuk-heading-s', title));
  const table = document.createElement('table');
  table.className = 'govuk-table govuk-table--small-text-until-tablet';
  table.append(tableHead(['Bucket', 'Journeys']), tableBody(buckets.map(([key, label]) => [label, distribution?.[key] ?? 0])));
  section.append(table);
  return section;
}

function funnelMetric(label, value, context) {
  const metric = document.createElement('div');
  metric.className = 'flux-funnel__metric';
  metric.append(
    element('dt', 'flux-funnel__metric-label', label),
    element('dd', 'flux-funnel__metric-value', value),
    element('dd', 'flux-funnel__metric-context', context)
  );
  return metric;
}

function reportDetails(label, description, headings, rows) {
  const details = document.createElement('details');
  details.className = 'govuk-details flux-report';
  const summary = document.createElement('summary');
  summary.className = 'govuk-details__summary';
  summary.append(element('span', 'govuk-details__summary-text', label));
  details.append(summary, element('p', 'govuk-body-s', description));
  if (rows.length === 0) {
    details.append(element('p', 'govuk-body-s', 'No evidence was recorded for this selection.'));
    return details;
  }
  const table = document.createElement('table');
  table.className = 'govuk-table govuk-table--small-text-until-tablet';
  table.append(tableHead(headings), tableBody(rows));
  const scroll = document.createElement('div');
  scroll.className = 'flux-report-table';
  scroll.append(table);
  details.append(scroll);
  return details;
}

function entityLabel(row) {
  const context = [];
  if (row.complexity !== null && row.complexity !== undefined) context.push(`complexity ${formatDecimal(row.complexity)} of 7`);
  if (row.required !== null && row.required !== undefined) context.push(row.required ? 'required' : 'optional');
  return context.length ? `${row.label} · ${context.join(' · ')}` : row.label;
}

function semanticElementLabel(value) {
  return String(value ?? '').split('.').map(capitalise).join(' › ');
}

function renderCohorts(data, lifecycle) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flux-cohorts';
  wrapper.append(element('p', 'flux-cohorts__privacy', data.privacy_note ?? 'Named cohort results are shown only when at least 5 journeys share the pattern.'));
  wrapper.append(
    cohortGroup('Visit maturity', 'Whether journeys are first-time, returning or established.', data.visit_maturity),
    cohortGroup('Outcome paths', 'Whether journeys completed smoothly, recovered from friction or did not reach an outcome.', data.outcome_paths),
    cohortGroup('Interaction patterns', 'Heuristic journey patterns derived from supported, content-free signals.', data.journey_patterns, journeyPatternCoverage(data.journey_patterns))
  );
  wrapper.append(renderLifecycle(lifecycle));
  return wrapper;
}

function renderLifecycle(data) {
  const section = document.createElement('section');
  section.className = 'flux-cohort-group flux-lifecycle';
  section.append(
    element('h3', 'govuk-heading-m flux-cohort-group__title', 'Repeat visits and change over time'),
    element('p', 'govuk-body-s', data?.privacy_note ?? 'Lifecycle evidence appears after enough consented repeat journeys are recorded.'),
    element('p', 'govuk-body-s flux-safeguard', data?.interpretation_note ?? 'Changes describe service journeys, not people.')
  );
  if (!data) {
    section.append(emptyState('Lifecycle evidence unavailable', 'Choose a bounded period with enough consented journeys.'));
    return section;
  }
  const summary = document.createElement('dl');
  summary.className = 'flux-health-list';
  const recency = data.recency ?? {};
  const frequency = data.frequency ?? {};
  for (const [label, value, note] of [
    ['Typical return interval', recency.available ? formatLifecycleInterval(recency.median_interval_ms) : 'Suppressed', recency.available ? `90th percentile ${formatLifecycleInterval(recency.p90_interval_ms)} · ${numberFormat.format(recency.returning_journey_count)} repeat journeys` : `${numberFormat.format(recency.suppressed_journey_count ?? 0)} repeat journeys; at least 5 are required`],
    ['Journeys per visitor', frequency.available ? formatDecimal(frequency.average_journeys) : 'Suppressed', frequency.available ? `${numberFormat.format(frequency.repeat_visitor_count)} of ${numberFormat.format(frequency.visitor_count)} visitors had more than one journey in the selected period` : `${numberFormat.format(frequency.visitor_count ?? 0)} visitors; at least 5 are required`]
  ]) {
    const row = document.createElement('div');
    row.className = 'flux-health-list__row';
    const copy = document.createElement('div');
    copy.append(element('h4', 'flux-health-list__label', label), element('p', 'flux-health-list__note', note));
    row.append(copy, element('strong', 'flux-health-list__value', value));
    summary.append(row);
  }
  section.append(summary);
  section.append(reportDetails('Visit-maturity movement', `${numberFormat.format(data.maturity_movement?.selected_session_count ?? 0)} selected journeys`,
    ['Journey group', 'Journeys', 'Share', 'Previous share', 'Change'],
    (data.maturity_movement?.rows ?? []).map((row) => [row.label, row.session_count, formatPercent(row.share), row.previous_share === null ? 'Unavailable or suppressed' : formatPercent(row.previous_share), row.change_percentage_points === null ? 'Unavailable or suppressed' : formatChangePoints(row.change_percentage_points, data.comparison_available)])));
  section.append(reportDetails('Like-for-like service-friction movement', 'Rates use journeys in each period as the denominator. They do not establish why behaviour changed.',
    ['Signal', 'Affected journeys', 'Rate', 'Previous rate', 'Change', 'Direction'],
    (data.celeration ?? []).map((row) => [row.label, row.affected_session_count === null ? 'Suppressed' : `${numberFormat.format(row.affected_session_count)} of ${numberFormat.format(row.session_count)}`, row.rate === null ? 'Suppressed' : formatPercent(row.rate), row.previous_rate === null ? 'Unavailable' : formatPercent(row.previous_rate), row.change_percentage_points === null ? 'Unavailable' : formatChangePoints(row.change_percentage_points, data.comparison_available), row.direction === 'little_change' ? 'Little change' : capitalise(row.direction)])));
  return section;
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

function formatChange(value, comparisonAvailable = true) {
  if (!comparisonAvailable) return 'No comparison period';
  if (value === null || value === undefined) return 'New in this period';
  const change = Number(value) || 0;
  if (Math.abs(change) < 0.05) return 'No change';
  return `${Math.abs(change).toLocaleString('en-GB', { maximumFractionDigits: 1 })}% ${change > 0 ? 'up' : 'down'}`;
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

function formatLifecycleInterval(value) {
  const milliseconds = Math.max(0, Number(value) || 0);
  if (milliseconds < 86400000) return formatDuration(milliseconds);
  let days = Math.floor(milliseconds / 86400000);
  let hours = Math.round((milliseconds % 86400000) / 3600000);
  if (hours === 24) {
    days += 1;
    hours = 0;
  }
  return `${numberFormat.format(days)} day${days === 1 ? '' : 's'}${hours ? ` ${numberFormat.format(hours)}h` : ''}`;
}

function formatChangePoints(value, comparisonAvailable = true) {
  if (!comparisonAvailable) return 'no comparison period';
  if (value === null || value === undefined) return 'new in this period';
  const change = Number(value) || 0;
  if (Math.abs(change) < 0.05) return 'no change';
  return `${Math.abs(change).toLocaleString('en-GB', { maximumFractionDigits: 1 })} percentage points ${change > 0 ? 'up' : 'down'}`;
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
