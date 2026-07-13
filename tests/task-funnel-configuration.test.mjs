import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createFunnel,
  createStep,
  createSuccessEvent,
  createTask,
  deleteEntity,
  deleteSuccessEvent,
  moveEntity,
  updateEntity,
  updateStep,
  updateSuccessEvent
} from '../src/dashboard/task-funnel-configuration.mjs';
import { validateServiceModel } from '../src/model/service-model.mjs';

function emptyModel() {
  return {
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
}

test('creates a tenant-owned funnel as a new immutable model version', () => {
  const current = emptyModel();

  const next = createFunnel(current, { label: 'Apply for support' });

  assert.equal(current.version, 3);
  assert.equal(current.entities.length, 1);
  assert.equal(next.version, 4);
  assert.deepEqual(next.entities[1], {
    key: 'transaction.apply-for-support',
    type: 'transaction',
    label: 'Apply for support',
    parent_key: 'service.example-service',
    position: 1
  });
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});

test('creates a task inside an owner-selected funnel', () => {
  const model = createFunnel(emptyModel(), { label: 'Apply for support' });

  const next = createTask(model, {
    transactionKey: 'transaction.apply-for-support',
    label: 'Provide contact details'
  });

  assert.deepEqual(next.entities.at(-1), {
    key: 'task.provide-contact-details',
    type: 'task',
    label: 'Provide contact details',
    parent_key: 'transaction.apply-for-support',
    position: 1
  });
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});

test('creates an ordered funnel step bound to a publisher data-flux-key', () => {
  let model = createFunnel(emptyModel(), { label: 'Apply for support' });
  model = createTask(model, { transactionKey: 'transaction.apply-for-support', label: 'Provide contact details' });

  const next = createStep(model, {
    taskKey: 'task.provide-contact-details',
    label: 'Enter your details',
    elementKey: 'form.application.contact-details'
  });

  assert.deepEqual(next.entities.at(-1), {
    key: 'step.enter-your-details',
    type: 'step',
    label: 'Enter your details',
    parent_key: 'task.provide-contact-details',
    position: 1
  });
  assert.deepEqual(next.bindings.at(-1), {
    element_key: 'form.application.contact-details',
    entity_key: 'step.enter-your-details'
  });
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});

test('edits a funnel or task label without changing its stable key', () => {
  const current = createFunnel(emptyModel(), { label: 'Apply for support' });

  const next = updateEntity(current, 'transaction.apply-for-support', { label: 'Request support' });

  const funnel = next.entities.find(({ key }) => key === 'transaction.apply-for-support');
  assert.equal(funnel.label, 'Request support');
  assert.equal(next.version, current.version + 1);
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});

test('deletes a funnel and every dependent task, step, binding and outcome', () => {
  let current = createFunnel(emptyModel(), { label: 'Apply for support' });
  current = createTask(current, { transactionKey: 'transaction.apply-for-support', label: 'Provide details' });
  current = createStep(current, { taskKey: 'task.provide-details', label: 'Enter details', elementKey: 'form.support.details' });
  current.outcomes.push({
    key: 'outcome.support-complete', label: 'Support request completed',
    transaction_key: 'transaction.apply-for-support', type: 'success'
  });
  current.key_events.push({
    key: 'key-event.support-complete', label: 'Support request completed', action: 'flow.submit',
    element_key: 'form.support.details', outcome_key: 'outcome.support-complete'
  });

  const next = deleteEntity(current, 'transaction.apply-for-support');

  assert.deepEqual(next.entities.map(({ type }) => type), ['service']);
  assert.deepEqual(next.bindings, []);
  assert.deepEqual(next.outcomes, []);
  assert.deepEqual(next.key_events, []);
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});

test('deleting a bound step removes an outcome that loses its final matching event', () => {
  let current = createFunnel(emptyModel(), { label: 'Apply for support' });
  current = createTask(current, { transactionKey: 'transaction.apply-for-support', label: 'Provide details' });
  current = createStep(current, { taskKey: 'task.provide-details', label: 'Send request', elementKey: 'form.support.request' });
  current = createSuccessEvent(current, {
    transactionKey: 'transaction.apply-for-support', label: 'Request sent',
    action: 'flow.submit', elementKey: 'form.support.request'
  });

  const next = deleteEntity(current, 'step.send-request');

  assert.deepEqual(next.outcomes, []);
  assert.deepEqual(next.key_events, []);
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});

test('deleting one bound step retains an outcome that still has another matching event', () => {
  let current = createFunnel(emptyModel(), { label: 'Use guidance' });
  current = createTask(current, { transactionKey: 'transaction.use-guidance', label: 'Open guidance' });
  current = createStep(current, { taskKey: 'task.open-guidance', label: 'Open scope', elementKey: 'page.guidance.scope' });
  current = createStep(current, { taskKey: 'task.open-guidance', label: 'Open people', elementKey: 'page.guidance.people' });
  current.outcomes.push({
    key: 'outcome.guidance-opened', label: 'Guidance opened',
    transaction_key: 'transaction.use-guidance', type: 'success'
  });
  current.key_events.push(
    { key: 'key-event.scope-opened', label: 'Scope opened', action: 'page.loaded', element_key: 'page.guidance.scope', outcome_key: 'outcome.guidance-opened' },
    { key: 'key-event.people-opened', label: 'People opened', action: 'page.loaded', element_key: 'page.guidance.people', outcome_key: 'outcome.guidance-opened' }
  );

  const next = deleteEntity(current, 'step.open-scope');

  assert.deepEqual(next.outcomes.map(({ key }) => key), ['outcome.guidance-opened']);
  assert.deepEqual(next.key_events.map(({ key }) => key), ['key-event.people-opened']);
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});

test('configures a funnel success from an action and publisher data-flux-key', () => {
  let current = createFunnel(emptyModel(), { label: 'Apply for support' });
  current = createTask(current, { transactionKey: 'transaction.apply-for-support', label: 'Provide details' });
  current = createStep(current, { taskKey: 'task.provide-details', label: 'Enter details', elementKey: 'form.support.details' });

  const next = createSuccessEvent(current, {
    transactionKey: 'transaction.apply-for-support',
    label: 'Support request sent',
    action: 'flow.submit',
    elementKey: 'form.support.details'
  });

  assert.deepEqual(next.outcomes, [{
    key: 'outcome.support-request-sent',
    label: 'Support request sent',
    transaction_key: 'transaction.apply-for-support',
    type: 'success'
  }]);
  assert.deepEqual(next.key_events, [{
    key: 'key-event.support-request-sent',
    label: 'Support request sent',
    action: 'flow.submit',
    element_key: 'form.support.details',
    outcome_key: 'outcome.support-request-sent'
  }]);
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});

test('edits a funnel step label and publisher binding without changing its stable key', () => {
  let current = createFunnel(emptyModel(), { label: 'Apply for support' });
  current = createTask(current, { transactionKey: 'transaction.apply-for-support', label: 'Provide details' });
  current = createStep(current, { taskKey: 'task.provide-details', label: 'Enter details', elementKey: 'form.support.details' });

  const next = updateStep(current, 'step.enter-details', {
    label: 'Check your details',
    elementKey: 'page.support.check-details'
  });

  assert.equal(next.entities.find(({ key }) => key === 'step.enter-details').label, 'Check your details');
  assert.deepEqual(next.bindings, [{ element_key: 'page.support.check-details', entity_key: 'step.enter-details' }]);
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});

test('reorders tasks or steps within their current parent', () => {
  let current = createFunnel(emptyModel(), { label: 'Apply for support' });
  current = createTask(current, { transactionKey: 'transaction.apply-for-support', label: 'First task' });
  current = createTask(current, { transactionKey: 'transaction.apply-for-support', label: 'Second task' });

  const next = moveEntity(current, 'task.second-task', -1);

  const tasks = next.entities.filter(({ type }) => type === 'task').sort((left, right) => left.position - right.position);
  assert.deepEqual(tasks.map(({ key, position }) => [key, position]), [
    ['task.second-task', 1],
    ['task.first-task', 2]
  ]);
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});

test('edits a configured funnel success without changing its stable outcome key', () => {
  let current = createFunnel(emptyModel(), { label: 'Apply for support' });
  current = createSuccessEvent(current, {
    transactionKey: 'transaction.apply-for-support', label: 'Request sent',
    action: 'flow.submit', elementKey: 'form.support.request'
  });

  const next = updateSuccessEvent(current, 'outcome.request-sent', {
    label: 'Application accepted', action: 'flow.complete', elementKey: 'page.support.confirmation'
  });

  assert.deepEqual(next.outcomes, [{
    key: 'outcome.request-sent', label: 'Application accepted',
    transaction_key: 'transaction.apply-for-support', type: 'success'
  }]);
  assert.equal(next.key_events[0].key, 'key-event.request-sent');
  assert.equal(next.key_events[0].label, 'Application accepted');
  assert.equal(next.key_events[0].action, 'flow.complete');
  assert.equal(next.key_events[0].element_key, 'page.support.confirmation');
  assert.deepEqual(next.bindings, [
    { element_key: 'form.support.request', entity_key: 'transaction.apply-for-support' },
    { element_key: 'page.support.confirmation', entity_key: 'transaction.apply-for-support' }
  ]);
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});

test('deletes a configured funnel success without guessing that its transaction binding is disposable', () => {
  let current = createFunnel(emptyModel(), { label: 'Apply for support' });
  current = createSuccessEvent(current, {
    transactionKey: 'transaction.apply-for-support', label: 'Request sent',
    action: 'flow.submit', elementKey: 'form.support.request'
  });

  const next = deleteSuccessEvent(current, 'outcome.request-sent');

  assert.deepEqual(next.outcomes, []);
  assert.deepEqual(next.key_events, []);
  assert.deepEqual(next.bindings, [{ element_key: 'form.support.request', entity_key: 'transaction.apply-for-support' }]);
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});

test('edits one of several matching events without hiding or changing the others', () => {
  let current = createFunnel(emptyModel(), { label: 'Use guidance' });
  current.bindings.push(
    { element_key: 'page.guidance.scope', entity_key: 'transaction.use-guidance' },
    { element_key: 'page.guidance.people', entity_key: 'transaction.use-guidance' }
  );
  current.outcomes.push({ key: 'outcome.guidance-opened', label: 'Guidance opened', transaction_key: 'transaction.use-guidance', type: 'success' });
  current.key_events.push(
    { key: 'key-event.scope-opened', label: 'Scope opened', action: 'page.loaded', element_key: 'page.guidance.scope', outcome_key: 'outcome.guidance-opened' },
    { key: 'key-event.people-opened', label: 'People opened', action: 'page.loaded', element_key: 'page.guidance.people', outcome_key: 'outcome.guidance-opened' }
  );

  const next = updateSuccessEvent(current, 'outcome.guidance-opened', 'key-event.people-opened', {
    label: 'People guidance opened', action: 'page.loaded', elementKey: 'page.guidance.people'
  });

  assert.equal(next.outcomes[0].label, 'Guidance opened');
  assert.deepEqual(next.key_events.map(({ key, label }) => [key, label]), [
    ['key-event.scope-opened', 'Scope opened'],
    ['key-event.people-opened', 'People guidance opened']
  ]);
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});

test('deletes one of several matching events and removes the outcome only with its final event', () => {
  let current = createFunnel(emptyModel(), { label: 'Use guidance' });
  current.bindings.push(
    { element_key: 'page.guidance.scope', entity_key: 'transaction.use-guidance' },
    { element_key: 'page.guidance.people', entity_key: 'transaction.use-guidance' }
  );
  current.outcomes.push({ key: 'outcome.guidance-opened', label: 'Guidance opened', transaction_key: 'transaction.use-guidance', type: 'success' });
  current.key_events.push(
    { key: 'key-event.scope-opened', label: 'Scope opened', action: 'page.loaded', element_key: 'page.guidance.scope', outcome_key: 'outcome.guidance-opened' },
    { key: 'key-event.people-opened', label: 'People opened', action: 'page.loaded', element_key: 'page.guidance.people', outcome_key: 'outcome.guidance-opened' }
  );

  const oneLeft = deleteSuccessEvent(current, 'outcome.guidance-opened', 'key-event.scope-opened');
  const noneLeft = deleteSuccessEvent(oneLeft, 'outcome.guidance-opened', 'key-event.people-opened');

  assert.deepEqual(oneLeft.outcomes.map(({ key }) => key), ['outcome.guidance-opened']);
  assert.deepEqual(oneLeft.key_events.map(({ key }) => key), ['key-event.people-opened']);
  assert.deepEqual(noneLeft.outcomes, []);
  assert.deepEqual(noneLeft.key_events, []);
  assert.equal(noneLeft.bindings.length, 2);
});

test('promotes a same-funnel transaction success binding when its key becomes an ordered step', () => {
  let current = createFunnel(emptyModel(), { label: 'Apply for support' });
  current = createTask(current, { transactionKey: 'transaction.apply-for-support', label: 'Provide details' });
  current = createSuccessEvent(current, {
    transactionKey: 'transaction.apply-for-support', label: 'Request sent',
    action: 'flow.submit', elementKey: 'form.support.request'
  });

  const next = createStep(current, {
    taskKey: 'task.provide-details', label: 'Send request', elementKey: 'form.support.request'
  });

  assert.deepEqual(next.bindings, [{ element_key: 'form.support.request', entity_key: 'step.send-request' }]);
  assert.equal(next.key_events[0].element_key, 'form.support.request');
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});

test('rejects publisher element keys longer than the collectable event contract', () => {
  let current = createFunnel(emptyModel(), { label: 'Apply for support' });
  current = createTask(current, { transactionKey: 'transaction.apply-for-support', label: 'Provide details' });
  const longKey = `field.${'a'.repeat(155)}`;

  assert.throws(() => createStep(current, {
    taskKey: 'task.provide-details', label: 'Provide details', elementKey: longKey
  }), /invalid_element_key/);
  assert.throws(() => createSuccessEvent(current, {
    transactionKey: 'transaction.apply-for-support', label: 'Details provided', action: 'flow.submit', elementKey: longKey
  }), /invalid_element_key/);
});

test('keeps generated entity and artifact keys within the unified semantic-key contract', () => {
  const label = 'a'.repeat(120);
  const first = createFunnel(emptyModel(), { label });
  const second = createFunnel(first, { label });
  const withSuccess = createSuccessEvent(first, {
    transactionKey: first.entities[1].key, label, action: 'flow.submit', elementKey: 'form.support.request'
  });

  assert.ok(first.entities[1].key.length <= 160);
  assert.ok(second.entities[2].key.length <= 160);
  assert.notEqual(first.entities[1].key, second.entities[2].key);
  assert.ok(withSuccess.outcomes[0].key.length <= 160);
  assert.ok(withSuccess.key_events[0].key.length <= 160);
  assert.deepEqual(validateServiceModel(withSuccess), { valid: true, errors: [] });
});

test('keeps a step-bound success event valid when the step data-flux-key changes', () => {
  let current = createFunnel(emptyModel(), { label: 'Apply for support' });
  current = createTask(current, { transactionKey: 'transaction.apply-for-support', label: 'Provide details' });
  current = createStep(current, { taskKey: 'task.provide-details', label: 'Send request', elementKey: 'form.support.request' });
  current = createSuccessEvent(current, {
    transactionKey: 'transaction.apply-for-support', label: 'Request sent',
    action: 'flow.submit', elementKey: 'form.support.request'
  });

  const next = updateStep(current, 'step.send-request', {
    label: 'Submit request', elementKey: 'form.support.submit'
  });

  assert.equal(next.key_events[0].element_key, 'form.support.submit');
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});

test('adds a direct publisher binding when an existing step did not have one', () => {
  let current = createFunnel(emptyModel(), { label: 'Apply for support' });
  current = createTask(current, { transactionKey: 'transaction.apply-for-support', label: 'Provide details' });
  current.entities.push({
    key: 'step.review-details', type: 'step', label: 'Review details',
    parent_key: 'task.provide-details', position: 1
  });

  const next = updateStep(current, 'step.review-details', {
    label: 'Check details', elementKey: 'page.support.check'
  });

  assert.deepEqual(next.bindings, [{ element_key: 'page.support.check', entity_key: 'step.review-details' }]);
  assert.deepEqual(validateServiceModel(next), { valid: true, errors: [] });
});
