const status = document.querySelector('[data-flux-live-status]');
const sessions = document.querySelector('[data-flux-live-sessions]');
const journeys = document.querySelector('[data-flux-live-journeys]');

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
