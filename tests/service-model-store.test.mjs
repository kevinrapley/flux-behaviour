import test from 'node:test';
import assert from 'node:assert/strict';

import { publishServiceModel, resolvePublishedServiceContext } from '../src/model/service-model-store.mjs';

function validModel() {
  return {
    schema_version: '1.0.0',
    tenant_id: 'researchops',
    model_key: 'model.researchops',
    version: 1,
    entities: [
      { key: 'service.researchops', type: 'service', label: 'ResearchOps', position: 1 },
      { key: 'transaction.manage-project', type: 'transaction', label: 'Manage a research project', parent_key: 'service.researchops', position: 1 },
      { key: 'task.edit-objective', type: 'task', label: 'Edit objective', parent_key: 'transaction.manage-project', position: 1 },
      { key: 'step.describe-objective', type: 'step', label: 'Describe objective', parent_key: 'task.edit-objective', position: 1 },
      { key: 'question.objective', type: 'question', label: 'Project objective', parent_key: 'step.describe-objective', position: 1, complexity: 4 },
      { key: 'field.objective', type: 'field', label: 'Objective editor', parent_key: 'question.objective', position: 1, required: true }
    ],
    bindings: [
      { element_key: 'field.project.objective.edit', entity_key: 'field.objective' },
      { element_key: 'form.project.add-objective', entity_key: 'step.describe-objective' }
    ],
    outcomes: [
      { key: 'outcome.objective-saved', label: 'Objective saved', transaction_key: 'transaction.manage-project', type: 'success' }
    ],
    key_events: [
      { key: 'key-event.objective-saved', label: 'Objective saved', action: 'flow.submit', element_key: 'form.project.add-objective', outcome_key: 'outcome.objective-saved' }
    ]
  };
}

function recordingDb({ owner = true, existing = false } = {}) {
  const prepared = [];
  const batches = [];
  return {
    prepared,
    batches,
    prepare(sql) {
      const statement = {
        sql,
        values: [],
        bind(...values) {
          this.values = values;
          return this;
        },
        async first() {
          if (sql.includes('account_tenants')) return owner ? { role: 'owner' } : null;
          if (sql.includes('service_model_versions')) return existing ? { version: 1 } : null;
          return null;
        }
      };
      prepared.push(statement);
      return statement;
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map(() => ({ success: true }));
    }
  };
}

test('publishes a validated model atomically and retires the previous tenant version', async () => {
  const db = recordingDb();
  const result = await publishServiceModel(db, 'account-1', validModel(), 1760000000000);

  assert.deepEqual(result, { ok: true, model_key: 'model.researchops', version: 1 });
  assert.equal(db.batches.length, 1);
  const statements = db.batches[0];
  assert.ok(statements.some(({ sql }) => sql.startsWith("UPDATE service_model_versions SET status = 'retired'")));
  assert.ok(statements.some(({ sql }) => sql.startsWith('INSERT INTO service_model_versions')));
  assert.equal(statements.filter(({ sql }) => sql.startsWith('INSERT INTO service_model_entities')).length, 6);
  assert.equal(statements.filter(({ sql }) => sql.startsWith('INSERT INTO service_model_bindings')).length, 2);
  assert.equal(statements.filter(({ sql }) => sql.startsWith('INSERT INTO service_model_outcomes')).length, 1);
  assert.equal(statements.filter(({ sql }) => sql.startsWith('INSERT INTO service_model_key_events')).length, 1);
});

test('refuses publication by an account that is not a tenant owner', async () => {
  const db = recordingDb({ owner: false });

  const result = await publishServiceModel(db, 'viewer-account', validModel());

  assert.deepEqual(result, { ok: false, error: 'forbidden' });
  assert.equal(db.batches.length, 0);
});

test('refuses to overwrite an existing tenant model version', async () => {
  const db = recordingDb({ existing: true });

  const result = await publishServiceModel(db, 'account-1', validModel());

  assert.deepEqual(result, { ok: false, error: 'service_model_version_exists' });
  assert.equal(db.batches.length, 0);
});

test('refuses an invalid publisher model before any database access', async () => {
  const db = recordingDb();
  const model = validModel();
  model.entities.find(({ type }) => type === 'question').complexity = 9;

  const result = await publishServiceModel(db, 'account-1', model);

  assert.equal(result.ok, false);
  assert.equal(result.error, 'invalid_service_model');
  assert.ok(result.details.some(({ code }) => code === 'invalid_complexity'));
  assert.equal(db.prepared.length, 0);
  assert.equal(db.batches.length, 0);
});

test('refuses unsafe field bindings at the publication boundary without invalidating legacy reads', async () => {
  for (const elementKey of ['autocomplete.email', 'field.auth.otp', `field.${'a'.repeat(115)}`]) {
    const db = recordingDb();
    const model = validModel();
    model.bindings.find(({ entity_key }) => entity_key === 'field.objective').element_key = elementKey;

    const result = await publishServiceModel(db, 'account-1', model);

    assert.equal(result.ok, false, elementKey);
    assert.equal(result.error, 'invalid_service_model');
    const expectedCode = elementKey.startsWith('autocomplete.') ? 'prohibited_global_binding' : 'prohibited_field_binding';
    assert.ok(result.details.some(({ code }) => code === expectedCode), elementKey);
    assert.equal(db.prepared.length, 0);
    assert.equal(db.batches.length, 0);
  }
});

test('refuses tenant-global autocomplete categories on non-field bindings at publication', async () => {
  const db = recordingDb();
  const model = validModel();
  model.bindings.push({ element_key: 'autocomplete.email', entity_key: 'transaction.manage-project' });

  const result = await publishServiceModel(db, 'account-1', model);

  assert.equal(result.ok, false);
  assert.equal(result.error, 'invalid_service_model');
  assert.ok(result.details.some(({ code }) => code === 'prohibited_global_binding'));
  assert.equal(db.prepared.length, 0);
});

test('resolves a collected semantic key against the currently published model version', async () => {
  const model = validModel();
  const db = {
    prepare(sql) {
      assert.match(sql, /status = 'published'/);
      return {
        bind(tenantId) { assert.equal(tenantId, 'researchops'); return this; },
        async first() { return { model_json: JSON.stringify(model) }; }
      };
    }
  };

  const context = await resolvePublishedServiceContext(db, 'researchops', 'field.project.objective.edit');

  assert.equal(context.model_key, 'model.researchops');
  assert.equal(context.model_version, 1);
  assert.equal(context.transaction_key, 'transaction.manage-project');
  assert.equal(context.field_key, 'field.objective');
  assert.equal(context.question_complexity, 4);
});

test('resolves a published action-specific key event to its configured outcome', async () => {
  const model = validModel();
  const db = {
    prepare() {
      return {
        bind() { return this; },
        async first() { return { model_json: JSON.stringify(model) }; }
      };
    }
  };

  const context = await resolvePublishedServiceContext(db, 'researchops', 'form.project.add-objective', 'flow.submit');

  assert.equal(context.key_event_key, 'key-event.objective-saved');
  assert.equal(context.outcome_key, 'outcome.objective-saved');
  assert.equal(context.outcome_type, 'success');
});
