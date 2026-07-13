import test from 'node:test';
import assert from 'node:assert/strict';

import { createFunnel, createStep, createTask } from '../src/dashboard/task-funnel-configuration.mjs';
import { validateServiceModel } from '../src/model/service-model.mjs';

function modelWithStep() {
  let model = {
    schema_version: '1.0.0',
    tenant_id: 'example-service',
    model_key: 'model.example-service',
    version: 3,
    entities: [
      { key: 'service.example-service', type: 'service', label: 'Example service', position: 1 }
    ],
    bindings: [],
    outcomes: [],
    key_events: []
  };
  model = createFunnel(model, { label: 'Apply for support' });
  model = createTask(model, { transactionKey: 'transaction.apply-for-support', label: 'Provide details' });
  return createStep(model, {
    taskKey: 'task.provide-details',
    label: 'Enter details',
    elementKey: 'form.support.details'
  });
}

test('creates a question group with declared complexity under an owner-selected step', async () => {
  const configuration = await import('../src/dashboard/field-configuration.mjs').catch(() => ({}));
  assert.equal(typeof configuration.createQuestionGroup, 'function');

  const current = modelWithStep();
  const next = configuration.createQuestionGroup(current, {
    stepKey: 'step.enter-details',
    label: 'Contact details',
    complexity: 4
  });

  assert.equal(current.version + 1, next.version);
  assert.deepEqual(next.entities.at(-1), {
    key: 'question.contact-details',
    type: 'question',
    label: 'Contact details',
    parent_key: 'step.enter-details',
    position: 1,
    complexity: 4
  });
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});

test('edits a question label and complexity without changing its stable key', async () => {
  const { createQuestionGroup, updateQuestionGroup } = await import('../src/dashboard/field-configuration.mjs');
  let current = createQuestionGroup(modelWithStep(), {
    stepKey: 'step.enter-details', label: 'Contact details', complexity: 4
  });

  const next = updateQuestionGroup(current, 'question.contact-details', {
    label: 'Your contact details', complexity: '6'
  });

  assert.deepEqual(next.entities.find(({ key }) => key === 'question.contact-details'), {
    key: 'question.contact-details',
    type: 'question',
    label: 'Your contact details',
    parent_key: 'step.enter-details',
    position: 1,
    complexity: 6
  });
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});

test('creates a required field with an exact publisher data-flux-key', async () => {
  const { createField, createQuestionGroup } = await import('../src/dashboard/field-configuration.mjs');
  const current = createQuestionGroup(modelWithStep(), {
    stepKey: 'step.enter-details', label: 'Contact details', complexity: 4
  });

  const next = createField(current, {
    questionKey: 'question.contact-details',
    label: 'Email address',
    elementKey: 'field.support.email',
    required: 'true'
  });

  assert.deepEqual(next.entities.at(-1), {
    key: 'field.email-address',
    type: 'field',
    label: 'Email address',
    parent_key: 'question.contact-details',
    position: 1,
    required: true
  });
  assert.deepEqual(next.bindings.at(-1), {
    element_key: 'field.support.email',
    entity_key: 'field.email-address'
  });
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});

test('edits field meaning and publisher binding without changing its stable key', async () => {
  const { createField, createQuestionGroup, updateField } = await import('../src/dashboard/field-configuration.mjs');
  let current = createQuestionGroup(modelWithStep(), {
    stepKey: 'step.enter-details', label: 'Contact details', complexity: 4
  });
  current = createField(current, {
    questionKey: 'question.contact-details', label: 'Email address',
    elementKey: 'field.support.email', required: true
  });

  const next = updateField(current, 'field.email-address', {
    label: 'Contact email', elementKey: 'field.support.contact-email', required: 'false'
  });

  assert.deepEqual(next.entities.find(({ key }) => key === 'field.email-address'), {
    key: 'field.email-address', type: 'field', label: 'Contact email',
    parent_key: 'question.contact-details', position: 1, required: false
  });
  assert.deepEqual(next.bindings.at(-1), {
    element_key: 'field.support.contact-email', entity_key: 'field.email-address'
  });
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});

test('deletes a field and its publisher binding from the next model version', async () => {
  const { createField, createQuestionGroup, deleteFieldEntity } = await import('../src/dashboard/field-configuration.mjs');
  let current = createQuestionGroup(modelWithStep(), {
    stepKey: 'step.enter-details', label: 'Contact details', complexity: 4
  });
  current = createField(current, {
    questionKey: 'question.contact-details', label: 'Email address',
    elementKey: 'field.support.email', required: true
  });

  const next = deleteFieldEntity(current, 'field.email-address');

  assert.equal(next.entities.some(({ key }) => key === 'field.email-address'), false);
  assert.equal(next.entities.some(({ key }) => key === 'question.contact-details'), true);
  assert.equal(next.bindings.some(({ entity_key }) => entity_key === 'field.email-address'), false);
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});

test('deletes a question group and every field and binding beneath it', async () => {
  const { createField, createQuestionGroup, deleteFieldEntity } = await import('../src/dashboard/field-configuration.mjs');
  let current = createQuestionGroup(modelWithStep(), {
    stepKey: 'step.enter-details', label: 'Contact details', complexity: 4
  });
  current = createField(current, {
    questionKey: 'question.contact-details', label: 'Email address',
    elementKey: 'field.support.email', required: true
  });
  current = createField(current, {
    questionKey: 'question.contact-details', label: 'Telephone number',
    elementKey: 'field.support.telephone', required: false
  });

  const next = deleteFieldEntity(current, 'question.contact-details');

  assert.equal(next.entities.some(({ type }) => type === 'question' || type === 'field'), false);
  assert.deepEqual(next.bindings, [{ element_key: 'form.support.details', entity_key: 'step.enter-details' }]);
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});
