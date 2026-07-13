import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { summariseServiceModel } from '../src/model/service-model-summary.mjs';
import { dashboardServiceModel } from '../src/product/router.mjs';

test('summarises configured entities, transaction complexity and event mapping coverage', () => {
  const model = {
    schema_version: '1.0.0', tenant_id: 'researchops', model_key: 'model.researchops', version: 2,
    entities: [
      { key: 'service.researchops', type: 'service', label: 'ResearchOps', position: 1 },
      { key: 'transaction.projects', type: 'transaction', label: 'Manage projects', parent_key: 'service.researchops', position: 1 },
      { key: 'task.objective', type: 'task', label: 'Edit objective', parent_key: 'transaction.projects', position: 1 },
      { key: 'step.objective', type: 'step', label: 'Describe objective', parent_key: 'task.objective', position: 1 },
      { key: 'question.objective', type: 'question', label: 'Objective', parent_key: 'step.objective', position: 1, complexity: 3 },
      { key: 'question.review', type: 'question', label: 'Review', parent_key: 'step.objective', position: 2, complexity: 5 },
      { key: 'field.objective', type: 'field', label: 'Objective editor', parent_key: 'question.objective', position: 1, required: true }
    ],
    bindings: [
      { element_key: 'field.project.objective.edit', entity_key: 'field.objective' },
      { element_key: 'form.project.objective', entity_key: 'step.objective' }
    ],
    outcomes: [
      { key: 'outcome.objective-saved', label: 'Objective saved', transaction_key: 'transaction.projects', type: 'success' }
    ],
    key_events: [
      { key: 'key-event.objective-saved', label: 'Objective saved', action: 'flow.submit', element_key: 'form.project.objective', outcome_key: 'outcome.objective-saved' }
    ]
  };

  const summary = summariseServiceModel(model, { event_count: 10, resolved_event_count: 8, unmapped_event_count: 2, retired_model_event_count: 3 }, [
    { key_event_key: 'key-event.objective-saved', outcome_key: 'outcome.objective-saved', outcome_type: 'success', event_count: 3, session_count: 2 }
  ]);

  assert.deepEqual(summary, {
    model_key: 'model.researchops',
    version: 2,
    entity_counts: { service: 1, transaction: 1, task: 1, step: 1, question: 2, field: 1 },
    binding_count: 2,
    outcome_count: 1,
    key_event_count: 1,
    key_events: [{
      key: 'key-event.objective-saved',
      label: 'Objective saved',
      outcome_key: 'outcome.objective-saved',
      outcome_label: 'Objective saved',
      outcome_type: 'success',
      event_count: 3,
      session_count: 2
    }],
    transaction_complexity: [{ key: 'transaction.projects', label: 'Manage projects', complexity: 4, question_count: 2 }],
    coverage: { event_count: 10, resolved_event_count: 8, unmapped_event_count: 2, retired_model_event_count: 3, mapping_rate: 80 }
  });
});

test('dashboard service-model query reports mapping coverage for the selected period', async () => {
  const model = {
    schema_version: '1.0.0', tenant_id: 'researchops', model_key: 'model.researchops', version: 1,
    entities: [
      { key: 'service.researchops', type: 'service', label: 'ResearchOps', position: 1 },
      { key: 'transaction.home', type: 'transaction', label: 'Open home', parent_key: 'service.researchops', position: 1 }
    ],
    bindings: [{ element_key: 'page.home', entity_key: 'transaction.home' }],
    outcomes: [{ key: 'outcome.home-opened', label: 'Home opened', transaction_key: 'transaction.home', type: 'progress' }],
    key_events: [{ key: 'key-event.home-opened', label: 'Home opened', action: 'page.loaded', element_key: 'page.home', outcome_key: 'outcome.home-opened' }]
  };
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          if (sql.includes('retired_model_event_count')) assert.deepEqual(values, ['model.researchops', 1, 'model.researchops', 1, 'model.researchops', 1, 'researchops', 1000, 2000]);
          if (sql.includes('GROUP BY esc.key_event_key')) assert.deepEqual(values, ['researchops', 1000, 2000, 'model.researchops', 1]);
          return this;
        },
        async first() {
          if (sql.includes('service_model_versions')) return { model_json: JSON.stringify(model) };
          if (sql.includes('event_service_contexts')) return { event_count: 5, resolved_event_count: 3, unmapped_event_count: 2, retired_model_event_count: 4 };
          throw new Error(`Unexpected query: ${sql}`);
        },
        async all() {
          assert.match(sql, /GROUP BY esc\.key_event_key/);
          return { results: [{ key_event_key: 'key-event.home-opened', outcome_key: 'outcome.home-opened', outcome_type: 'progress', event_count: 4, session_count: 3 }] };
        }
      };
    }
  };

  const result = await dashboardServiceModel({ FLUX_DB: db }, 'researchops', 1000, 2000);

  assert.equal(result.model_key, 'model.researchops');
  assert.deepEqual(result.coverage, { event_count: 5, resolved_event_count: 3, unmapped_event_count: 2, retired_model_event_count: 4, mapping_rate: 60 });
  assert.equal(result.key_events[0].event_count, 4);
  assert.equal(result.key_events[0].session_count, 3);
});

test('dashboard refuses an invalid service model at rest before querying coverage', async () => {
  const db = {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes('service_model_versions')) return { model_json: JSON.stringify({ schema_version: '1.0.0' }) };
          throw new Error('Coverage must not be queried for an invalid model');
        }
      };
    }
  };

  assert.equal(await dashboardServiceModel({ FLUX_DB: db }, 'researchops', 1000, 2000), null);
});

test('authenticated dashboard response includes the selected-period service-model summary', () => {
  const router = readFileSync('src/product/router.mjs', 'utf8');

  assert.match(router, /dashboardServiceModel\(env, 'researchops', period\.start_at_ms, period\.end_at_ms, publishedModel\)/);
  assert.match(router, /service_model: serviceModel/);
});
