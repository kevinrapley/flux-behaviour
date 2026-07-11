const status = document.querySelector('[data-flux-live-status]');
const sessions = document.querySelector('[data-flux-live-sessions]');
const journey = document.querySelector('[data-flux-live-journey]');

async function loadDashboard() {
  const response = await fetch('/api/dashboard/researchops', { credentials: 'include' });
  if (response.status === 401) { status.textContent = 'Sign in to view ResearchOps analytics.'; return; }
  if (!response.ok) { status.textContent = 'Live analytics are not available yet.'; return; }
  const data = await response.json();
  status.textContent = `${data.sessions.length} recent ResearchOps sessions.`;
  sessions.replaceChildren(...data.sessions.map(sessionRow));
  journey.replaceChildren(...data.events.map(eventRow));
}

function sessionRow(session) {
  const row = document.createElement('tr'); row.className = 'govuk-table__row';
  row.innerHTML = `<td class="govuk-table__cell">${escape(session.visitor_id)}</td><td class="govuk-table__cell">${session.is_returning_visitor ? 'Returning' : 'New'}</td><td class="govuk-table__cell">${new Date(session.started_at_ms).toLocaleString()}</td>`;
  return row;
}

function eventRow(event) {
  const item = document.createElement('li'); item.className = 'govuk-list';
  item.textContent = `${new Date(event.occurred_at_ms).toLocaleTimeString()} — ${event.narrative}`;
  return item;
}

function escape(value) { const span = document.createElement('span'); span.textContent = value; return span.innerHTML; }
loadDashboard().catch(() => { status.textContent = 'Live analytics are not available yet.'; });
