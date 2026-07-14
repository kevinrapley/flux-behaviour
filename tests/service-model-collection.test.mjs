import test from 'node:test';
import assert from 'node:assert/strict';

import { handleProductRequest } from '../src/product/router.mjs';

const event = {
  schema_version: '1.2.0',
  session_id: 'session-valid-001',
  visitor_id: 'visitor-valid-001',
  tenant_id: 'researchops',
  consent: 'yes',
  origin: 'formkit',
  event_class: 'focus',
  action: 'focus.enter',
  role: 'field',
  element_key: 'application.reference-number',
  timestamp_ms: 1760000000000
};

const model = {
  schema_version: '1.0.0', tenant_id: 'researchops', model_key: 'model.researchops', version: 3,
  entities: [
    { key: 'service.researchops', type: 'service', label: 'ResearchOps', position: 1 },
    { key: 'transaction.start-project', type: 'transaction', label: 'Start a project', parent_key: 'service.researchops', position: 1 },
    { key: 'task.reference', type: 'task', label: 'Add a reference', parent_key: 'transaction.start-project', position: 1 },
    { key: 'step.reference', type: 'step', label: 'Enter reference', parent_key: 'task.reference', position: 1 },
    { key: 'question.reference', type: 'question', label: 'Reference number', parent_key: 'step.reference', position: 1, complexity: 2 },
    { key: 'field.reference', type: 'field', label: 'Reference number', parent_key: 'question.reference', position: 1, required: true }
  ],
  bindings: [
    { element_key: 'application.reference-number', entity_key: 'field.reference' },
    { element_key: 'form.project.add-objective', entity_key: 'step.reference' }
  ],
  outcomes: [
    { key: 'outcome.objective-saved', label: 'Objective saved', transaction_key: 'transaction.start-project', type: 'success' }
  ],
  key_events: [
    { key: 'key-event.objective-saved', label: 'Objective saved', action: 'flow.submit', element_key: 'form.project.add-objective', outcome_key: 'outcome.objective-saved' }
  ]
};

test('collector freezes the published service hierarchy beside a resolved event', async () => {
  const batches = [];
  const beforeCollection = Date.now();
  const db = {
    prepare(sql) {
      return {
        sql,
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() {
          if (sql.includes('tenant_installation_tags')) return null;
          if (sql.includes('allowed_origins_json')) return { id: 'researchops', allowed_origins_json: '["https://researchops.pages.dev"]' };
          if (sql.includes('service_model_versions')) return { model_json: JSON.stringify(model) };
          return null;
        }
      };
    },
    async batch(statements) { batches.push(statements); return statements.map(() => ({ success: true })); }
  };
  const response = await handleProductRequest(new Request('https://flux-behaviour.pages.dev/api/collect', {
    method: 'POST',
    headers: { origin: 'https://researchops.pages.dev', 'content-type': 'application/json' },
    body: JSON.stringify(event)
  }), { FLUX_DB: db });
  const afterCollection = Date.now();

  assert.equal(response.status, 202);
  const eventStatement = batches[0].find(({ sql }) => sql.startsWith('INSERT INTO events'));
  assert.match(eventStatement.sql, /occurred_at_ms, accepted_at_ms/);
  assert.ok(eventStatement.values.at(-1) >= beforeCollection);
  assert.ok(eventStatement.values.at(-1) <= afterCollection);
  const contextStatement = batches[0].find(({ sql }) => sql.startsWith('INSERT INTO event_service_contexts'));
  assert.ok(contextStatement);
  assert.equal(contextStatement.values[1], 'researchops');
  assert.equal(contextStatement.values[2], 'model.researchops');
  assert.equal(contextStatement.values[3], 3);
  assert.ok(contextStatement.values.includes('transaction.start-project'));
  assert.ok(contextStatement.values.includes('field.reference'));
  assert.ok(contextStatement.values.includes(2));
});

test('collector freezes a configured key event and outcome instead of inferring submit success', async () => {
  const batches = [];
  const db = {
    prepare(sql) {
      return {
        sql,
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() {
          if (sql.includes('tenant_installation_tags')) return null;
          if (sql.includes('allowed_origins_json')) return { id: 'researchops', allowed_origins_json: '["https://researchops.pages.dev"]' };
          if (sql.includes('service_model_versions')) return { model_json: JSON.stringify(model) };
          return null;
        }
      };
    },
    async batch(statements) { batches.push(statements); return statements.map(() => ({ success: true })); }
  };
  const submitted = { ...event, action: 'flow.submit', role: 'form', element_key: 'form.project.add-objective' };
  const response = await handleProductRequest(new Request('https://flux-behaviour.pages.dev/api/collect', {
    method: 'POST',
    headers: { origin: 'https://researchops.pages.dev', 'content-type': 'application/json' },
    body: JSON.stringify(submitted)
  }), { FLUX_DB: db });

  assert.equal(response.status, 202);
  const contextStatement = batches[0].find(({ sql }) => sql.startsWith('INSERT INTO event_service_contexts'));
  assert.match(contextStatement.sql, /key_event_key, outcome_key, outcome_type/);
  assert.ok(contextStatement.values.includes('key-event.objective-saved'));
  assert.ok(contextStatement.values.includes('outcome.objective-saved'));
  assert.ok(contextStatement.values.includes('success'));
});
