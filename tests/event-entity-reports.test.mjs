import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { buildEntityReport, buildEventReport, dashboardEventEntityReports } from '../src/product/event-entity-reports.mjs';

test('builds ranked event and key-event evidence with like-for-like comparisons', () => {
  const report = buildEventReport({
    selectedSessionCount: 10,
    startAtMs: Date.parse('2026-07-12T00:00:00Z'),
    endAtMs: Date.parse('2026-07-15T00:00:00Z'),
    eventRows: [
      { event_class: 'navigation', action: 'page.loaded', event_count: 14, session_count: 7 },
      { event_class: 'interaction', action: 'control.activate', event_count: 21, session_count: 6 }
    ],
    previousEventRows: [
      { event_class: 'navigation', action: 'page.loaded', event_count: 10, session_count: 5 },
      { event_class: 'interaction', action: 'control.activate', event_count: 7, session_count: 4 }
    ],
    keyEventRows: [
      { key_event_key: 'key-event.objective-saved', label: 'Objective saved', outcome_label: 'Objective saved', outcome_type: 'success', event_count: 4, session_count: 3 }
    ],
    previousKeyEventRows: [
      { key_event_key: 'key-event.objective-saved', event_count: 2, session_count: 2 }
    ],
    elementRows: [
      { element_key: 'field.project.objective.edit', role: 'field', entity_key: 'field.objective', entity_label: 'Objective editor', event_count: 12, session_count: 5 }
    ],
    previousElementRows: [
      { element_key: 'field.project.objective.edit', role: 'field', event_count: 8, session_count: 4 }
    ],
    trendRows: [
      { day: '2026-07-12', event_count: 9, key_event_count: 1 },
      { day: '2026-07-14', event_count: 26, key_event_count: 3 }
    ]
  });

  assert.deepEqual(report.events[0], {
    event_class: 'interaction',
    action: 'control.activate',
    event_count: 21,
    session_count: 6,
    sessions_rate: 60,
    previous_event_count: 7,
    event_count_change: 200
  });
  assert.deepEqual(report.key_events[0], {
    key_event_key: 'key-event.objective-saved',
    label: 'Objective saved',
    outcome_label: 'Objective saved',
    outcome_type: 'success',
    event_count: 4,
    session_count: 3,
    sessions_rate: 30,
    previous_event_count: 2,
    event_count_change: 100
  });
  assert.deepEqual(report.trend, [
    { day: '2026-07-12', event_count: 9, key_event_count: 1 },
    { day: '2026-07-13', event_count: 0, key_event_count: 0 },
    { day: '2026-07-14', event_count: 26, key_event_count: 3 }
  ]);
  assert.deepEqual(report.elements[0], {
    element_key: 'field.project.objective.edit',
    role: 'field',
    entity_key: 'field.objective',
    entity_label: 'Objective editor',
    event_count: 12,
    session_count: 5,
    sessions_rate: 50,
    previous_event_count: 8,
    event_count_change: 50
  });
});

test('builds semantic entity performance with journeys, entry, exit, outcomes, friction and time', () => {
  const report = buildEntityReport({
    selectedSessionCount: 12,
    rows: [{
      entity_type: 'task', entity_key: 'task.objective', label: 'Edit objective', interaction_count: 30,
      session_count: 8, entry_session_count: 3, exit_session_count: 2, success_session_count: 5,
      friction_session_count: 2, average_duration_ms: 45200, complexity: 4, required: null
    }],
    previousRows: [{ entity_type: 'task', entity_key: 'task.objective', session_count: 4 }]
  });

  assert.deepEqual(report.entities[0], {
    entity_type: 'task',
    entity_key: 'task.objective',
    label: 'Edit objective',
    interaction_count: 30,
    session_count: 8,
    sessions_rate: 66.7,
    entry_session_count: 3,
    exit_session_count: 2,
    success_session_count: 5,
    success_rate: 62.5,
    friction_session_count: 2,
    friction_rate: 25,
    average_duration_ms: 45200,
    complexity: 4,
    required: null,
    previous_session_count: 4,
    session_count_change: 100
  });
  assert.deepEqual(report.by_type.task, report.entities);
});

test('distinguishes an unavailable comparison period from a previous period with zero activity', () => {
  const events = buildEventReport({
    selectedSessionCount: 2,
    comparisonAvailable: false,
    eventRows: [{ event_class: 'navigation', action: 'page.loaded', event_count: 2, session_count: 2 }]
  });
  const entities = buildEntityReport({
    selectedSessionCount: 2,
    comparisonAvailable: false,
    rows: [{ entity_type: 'task', entity_key: 'task.home', label: 'Open home', session_count: 2 }]
  });

  assert.equal(events.comparison_available, false);
  assert.equal(events.events[0].previous_event_count, null);
  assert.equal(events.events[0].event_count_change, null);
  assert.equal(entities.comparison_available, false);
  assert.equal(entities.entities[0].previous_session_count, null);
  assert.equal(entities.entities[0].session_count_change, null);
});

test('queries event and entity reports for the exact published model and comparison period', async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          calls.push({ sql, values });
          return this;
        },
        async all() {
          if (sql.includes('report-events:current')) return { results: [{ event_class: 'navigation', action: 'page.loaded', event_count: 5, session_count: 4, selected_session_count: 4 }] };
          if (sql.includes('report-events:previous')) return { results: [{ event_class: 'navigation', action: 'page.loaded', event_count: 2, session_count: 2 }] };
          if (sql.includes('report-key-events:current')) return { results: [{ key_event_key: 'key-event.home-opened', outcome_key: 'outcome.home-opened', outcome_type: 'progress', event_count: 3, session_count: 3 }] };
          if (sql.includes('report-key-events:previous')) return { results: [] };
          if (sql.includes('report-elements:current')) return { results: [{ element_key: 'page.home', role: 'page', entity_key: 'transaction.home', entity_label: 'Open home', event_count: 5, session_count: 4 }] };
          if (sql.includes('report-elements:previous')) return { results: [] };
          if (sql.includes('report-events:trend')) return { results: [{ day: '2026-07-13', event_count: 5, key_event_count: 3 }] };
          if (sql.includes('report-entities:current')) return { results: [{ entity_type: 'transaction', entity_key: 'transaction.home', label: 'Open home', interaction_count: 5, session_count: 4 }] };
          if (sql.includes('report-entities:previous')) return { results: [] };
          throw new Error(`Unexpected query: ${sql}`);
        }
      };
    }
  };
  const model = {
    model_key: 'model.researchops', version: 3,
    key_events: [{ key: 'key-event.home-opened', label: 'Home opened', outcome_key: 'outcome.home-opened' }],
    outcomes: [{ key: 'outcome.home-opened', label: 'Home opened', type: 'progress' }]
  };

  const result = await dashboardEventEntityReports(db, {
    tenantId: 'researchops', model, selectedSessionCount: 8,
    startAtMs: 1000, endAtMs: 2000, previousStartAtMs: 0, previousEndAtMs: 1000
  });

  assert.equal(result.events.key_events[0].label, 'Home opened');
  assert.equal(result.events.events[0].sessions_rate, 100);
  assert.equal(result.entities.entities[0].sessions_rate, 100);
  assert.equal(result.events.elements[0].entity_label, 'Open home');
  assert.equal(result.entities.entities[0].label, 'Open home');
  assert.equal(calls.length, 9);
  assert.ok(calls.filter(({ sql }) => sql.includes('report-key-events') || sql.includes('report-elements') || sql.includes('report-entities')).every(({ values }) => values.includes('model.researchops') && values.includes(3)));
  assert.ok(calls.some(({ sql, values }) => sql.includes('report-events:previous') && values.join(',') === 'researchops,0,1000'));
  const entityQuery = calls.find(({ sql }) => sql.includes('report-entities:current')).sql;
  assert.match(entityQuery, /successful_transactions/);
  assert.match(entityQuery, /transaction_has_success/);
});

test('attributes a transaction success to a field reached earlier in the same journey', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE events (id TEXT PRIMARY KEY, tenant_id TEXT, session_id TEXT, occurred_at_ms INTEGER, event_class TEXT, action TEXT, element_key TEXT, role TEXT);
    CREATE TABLE event_service_contexts (event_id TEXT PRIMARY KEY, tenant_id TEXT, model_key TEXT, model_version INTEGER, entity_key TEXT, service_key TEXT, transaction_key TEXT, task_key TEXT, step_key TEXT, question_key TEXT, field_key TEXT, transaction_complexity INTEGER, key_event_key TEXT, outcome_key TEXT, outcome_type TEXT);
    CREATE TABLE service_model_entities (tenant_id TEXT, model_key TEXT, version INTEGER, entity_key TEXT, label TEXT, complexity INTEGER, required INTEGER);
    INSERT INTO service_model_entities VALUES ('researchops', 'model.researchops', 3, 'field.objective', 'Objective editor', NULL, 1);
    INSERT INTO service_model_entities VALUES ('researchops', 'model.researchops', 3, 'step.describe-objective', 'Describe objective', NULL, NULL);
    INSERT INTO events VALUES ('field-event', 'researchops', 'session-1', 1100, 'interaction', 'field.blur', 'field.project.objective', 'field');
    INSERT INTO events VALUES ('success-event', 'researchops', 'session-1', 1200, 'interaction', 'flow.submit', 'form.project.objective', 'form');
    INSERT INTO event_service_contexts VALUES ('field-event', 'researchops', 'model.researchops', 3, 'field.objective', 'service.researchops', 'transaction.manage-project', 'task.add-objective', 'step.describe-objective', 'question.objective', 'field.objective', 5, NULL, NULL, NULL);
    INSERT INTO event_service_contexts VALUES ('success-event', 'researchops', 'model.researchops', 3, 'step.describe-objective', 'service.researchops', 'transaction.manage-project', 'task.add-objective', 'step.describe-objective', NULL, NULL, 5, 'key-event.objective-saved', 'outcome.objective-saved', 'success');
  `);
  const db = {
    prepare(sql) {
      let values = [];
      return {
        bind(...nextValues) { values = nextValues; return this; },
        async all() { return { results: sqlite.prepare(sql).all(...values) }; }
      };
    }
  };
  const reports = await dashboardEventEntityReports(db, {
    tenantId: 'researchops',
    model: {
      model_key: 'model.researchops', version: 3,
      key_events: [{ key: 'key-event.objective-saved', label: 'Objective saved', outcome_key: 'outcome.objective-saved' }],
      outcomes: [{ key: 'outcome.objective-saved', label: 'Objective saved', type: 'success' }]
    },
    selectedSessionCount: 1,
    startAtMs: 1000,
    endAtMs: 2000,
    previousStartAtMs: null,
    previousEndAtMs: null
  });

  const field = reports.entities.by_type.field[0];
  assert.equal(field.session_count, 1);
  assert.equal(field.success_session_count, 1);
  assert.equal(field.success_rate, 100);
  sqlite.close();
});

test('authenticated dashboard includes event and semantic entity reports', () => {
  const router = readFileSync('src/product/router.mjs', 'utf8');

  assert.match(router, /dashboardEventEntityReports/);
  assert.match(router, /event_report: reports\.events/);
  assert.match(router, /entity_report: reports\.entities/);
  assert.match(router, /const publishedModel = await dashboardPublishedServiceModel/);
  assert.match(router, /dashboardServiceModel\(env, 'researchops', period\.start_at_ms, period\.end_at_ms, publishedModel\)/);
  assert.match(router, /dashboardReports\(env, 'researchops', period, overview\.session_count, publishedModel\)/);
});
