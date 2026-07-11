const status = document.querySelector('[data-flux-live-status]');
const sessions = document.querySelector('[data-flux-live-sessions]');
const journeys = document.querySelector('[data-flux-live-journeys]');
const analytics = document.querySelector('[data-flux-live-analytics]');

async function loadDashboard() {
  const response = await fetch('/api/dashboard/researchops', { credentials: 'include' });
  if (response.status === 401) {
    status.textContent = 'Sign in to view ResearchOps analytics.';
    return;
  }
  if (!response.ok) {
    status.textContent = 'Live analytics are not available yet.';
    return;
  }
  const data = await response.json();
  status.textContent = `${data.sessions.length} recent ResearchOps sessions.`;
  sessions.replaceChildren(...data.sessions.map(sessionRow));
  journeys.replaceChildren(...data.journeys.map(journeySection));
  analytics.replaceChildren(analyticsSummary(data.analytics));
}

function analyticsSummary(data) {
  const section = document.createElement('section');
  const summary = document.createElement('dl');
  summary.className = 'govuk-summary-list';
  const rows = [
    ['Consented events', data.event_count],
    ['Returning sessions', `${data.returning_session_count} of ${data.session_count}`],
    ['Median field dwell', data.median_field_dwell_ms ? `${Math.round(data.median_field_dwell_ms / 100) / 10}s` : 'No field dwell recorded yet'],
    ['Typed characters', data.typed_character_count],
    ['Corrections', data.correction_count],
    ['Touch interactions', data.touch_interaction_count]
  ];
  for (const [term, value] of rows) {
    const row = document.createElement('div');
    row.className = 'govuk-summary-list__row';
    const key = document.createElement('dt');
    key.className = 'govuk-summary-list__key';
    key.textContent = term;
    const item = document.createElement('dd');
    item.className = 'govuk-summary-list__value';
    item.textContent = value;
    row.append(key, item);
    summary.append(row);
  }
  const heading = document.createElement('h3');
  heading.className = 'govuk-heading-m';
  heading.textContent = 'Live interaction analytics';
  section.append(heading, summary, frequencyList('Interaction types', data.actions, 'action'), frequencyList('Most-used control types', data.controls, 'element_key'));
  return section;
}

function frequencyList(title, rows, key) {
  const section = document.createElement('section');
  const heading = document.createElement('h4');
  heading.className = 'govuk-heading-s';
  heading.textContent = title;
  const list = document.createElement('ul');
  list.className = 'govuk-list govuk-list--bullet';
  for (const row of rows) {
    const item = document.createElement('li');
    item.textContent = `${row[key]}: ${row.count}`;
    list.append(item);
  }
  if (rows.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'No interaction data received yet.';
    list.append(item);
  }
  section.append(heading, list);
  return section;
}

function sessionRow(session) {
  const row = document.createElement('tr');
  row.className = 'govuk-table__row';
  for (const value of [session.visitor_id, session.is_returning_visitor ? 'Returning' : 'New', new Date(session.started_at_ms).toLocaleString()]) {
    const cell = document.createElement('td');
    cell.className = 'govuk-table__cell';
    cell.textContent = value;
    row.append(cell);
  }
  return row;
}

function journeySection(session) {
  const section = document.createElement('section');
  const heading = document.createElement('h4');
  heading.className = 'govuk-heading-s';
  heading.textContent = `${session.is_returning_visitor ? 'Returning' : 'New'} visitor session — ${new Date(session.started_at_ms).toLocaleString()}`;
  const events = document.createElement('ol');
  events.className = 'govuk-list govuk-list--number';
  for (const event of session.events) {
    const item = document.createElement('li');
    item.textContent = `${new Date(event.occurred_at_ms).toLocaleTimeString()} — ${event.narrative}`;
    events.append(item);
  }
  if (session.events.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'govuk-body-s';
    empty.textContent = 'No interaction events were received for this session.';
    section.append(heading, empty);
  } else {
    section.append(heading, events);
  }
  return section;
}

loadDashboard().catch(() => { status.textContent = 'Live analytics are not available yet.'; });
