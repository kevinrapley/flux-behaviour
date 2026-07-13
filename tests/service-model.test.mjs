import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveServiceContext, validateServiceModel } from '../src/model/service-model.mjs';

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

test('accepts a versioned publisher service hierarchy with field bindings and question complexity', () => {
  const result = validateServiceModel(validModel());

  assert.deepEqual(result, { valid: true, errors: [] });
});

test('rejects duplicate keys, broken parent types and complexity outside the 1 to 7 scale', () => {
  const model = validModel();
  model.entities.push(
    { key: 'field.objective', type: 'field', label: 'Duplicate field', parent_key: 'question.objective', position: 2, required: false },
    { key: 'question.invalid', type: 'question', label: 'Invalid question', parent_key: 'service.researchops', position: 2, complexity: 8 }
  );

  const result = validateServiceModel(model);
  const codes = result.errors.map(({ code }) => code);

  assert.equal(result.valid, false);
  assert.ok(codes.includes('duplicate_entity_key'));
  assert.ok(codes.includes('invalid_parent_type'));
  assert.ok(codes.includes('invalid_complexity'));
});

test('rejects bindings that contain URLs or target an undeclared entity', () => {
  const model = validModel();
  model.bindings.push({
    element_key: 'https://research-operations.com/project?id=record-123',
    entity_key: 'field.missing'
  });

  const result = validateServiceModel(model);
  const codes = result.errors.map(({ code }) => code);

  assert.equal(result.valid, false);
  assert.ok(codes.includes('invalid_element_key'));
  assert.ok(codes.includes('unresolved_binding'));
});

test('requires bounded labels, positions, field requirement and question complexity metadata', () => {
  const model = validModel();
  model.entities.find(({ type }) => type === 'question').complexity = undefined;
  model.entities.find(({ type }) => type === 'field').required = undefined;
  model.entities.find(({ type }) => type === 'task').label = 'x'.repeat(121);
  model.entities.find(({ type }) => type === 'step').position = 0;

  const result = validateServiceModel(model);
  const codes = result.errors.map(({ code }) => code);

  assert.equal(result.valid, false);
  assert.ok(codes.includes('invalid_complexity'));
  assert.ok(codes.includes('invalid_required_status'));
  assert.ok(codes.includes('invalid_label'));
  assert.ok(codes.includes('invalid_position'));
});

test('requires exactly one root service and forbids a parent on that root', () => {
  const model = validModel();
  model.entities[0].parent_key = 'service.other';
  model.entities.push({ key: 'service.other', type: 'service', label: 'Other service', position: 2 });

  const result = validateServiceModel(model);
  const codes = result.errors.map(({ code }) => code);

  assert.equal(result.valid, false);
  assert.ok(codes.includes('invalid_service_root_count'));
  assert.ok(codes.includes('service_parent_forbidden'));
});

test('resolves an event binding to its full hierarchy and transaction complexity baseline', () => {
  const model = validModel();
  model.entities.push(
    { key: 'question.review', type: 'question', label: 'Review objective', parent_key: 'step.describe-objective', position: 2, complexity: 6 },
    { key: 'field.review', type: 'field', label: 'Review confirmation', parent_key: 'question.review', position: 1, required: true }
  );

  const context = resolveServiceContext(model, 'field.project.objective.edit');

  assert.deepEqual(context, {
    model_key: 'model.researchops',
    model_version: 1,
    entity_key: 'field.objective',
    service_key: 'service.researchops',
    transaction_key: 'transaction.manage-project',
    task_key: 'task.edit-objective',
    step_key: 'step.describe-objective',
    question_key: 'question.objective',
    field_key: 'field.objective',
    field_required: true,
    question_complexity: 4,
    transaction_complexity: 5
  });
});

test('rejects undeclared properties that could smuggle content into model configuration', () => {
  const model = validModel();
  model.visitor_email = 'person@example.test';
  model.entities[0].description = 'unbounded content';
  model.bindings[0].url = 'https://example.test/record/123';

  const result = validateServiceModel(model);

  assert.equal(result.valid, false);
  assert.equal(result.errors.filter(({ code }) => code === 'unknown_property').length, 3);
});

test('rejects labels containing email addresses, URLs or multiline content', () => {
  const model = validModel();
  model.entities[0].label = 'Contact person@example.test\nhttps://example.test';

  const result = validateServiceModel(model);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(({ code }) => code === 'unsafe_label'));
});

test('rejects complexity outside questions and required status outside fields', () => {
  const model = validModel();
  model.entities.find(({ type }) => type === 'task').complexity = 2;
  model.entities.find(({ type }) => type === 'step').required = false;

  const result = validateServiceModel(model);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(({ code }) => code === 'misplaced_complexity'));
  assert.ok(result.errors.some(({ code }) => code === 'misplaced_required_status'));
});

test('resolves an action-specific key event to a configured transaction outcome without losing task context', () => {
  const model = validModel();

  const validation = validateServiceModel(model);
  const context = resolveServiceContext(model, 'form.project.add-objective', 'flow.submit');

  assert.deepEqual(validation, { valid: true, errors: [] });
  assert.equal(context.task_key, 'task.edit-objective');
  assert.equal(context.step_key, 'step.describe-objective');
  assert.equal(context.key_event_key, 'key-event.objective-saved');
  assert.equal(context.outcome_key, 'outcome.objective-saved');
  assert.equal(context.outcome_type, 'success');
});

test('requires configured outcomes and key events instead of treating generic submits as success', () => {
  const model = validModel();
  delete model.outcomes;
  delete model.key_events;

  const result = validateServiceModel(model);
  const codes = result.errors.map(({ code }) => code);

  assert.equal(result.valid, false);
  assert.ok(codes.includes('missing_outcomes'));
  assert.ok(codes.includes('missing_key_events'));
});

test('requires each key event to have one unambiguous action and bound element pair', () => {
  const model = validModel();
  model.key_events.push({
    key: 'key-event.objective-saved-again',
    label: 'Objective saved again',
    action: 'flow.submit',
    element_key: 'form.project.add-objective',
    outcome_key: 'outcome.objective-saved'
  });
  model.key_events[0].element_key = 'form.project.unbound-objective';

  const result = validateServiceModel(model);
  const codes = result.errors.map(({ code }) => code);

  assert.equal(result.valid, false);
  assert.ok(codes.includes('unresolved_key_event_binding'));
});

test('rejects duplicate action and element pairs even when key-event keys differ', () => {
  const model = validModel();
  model.key_events.push({
    key: 'key-event.objective-complete',
    label: 'Objective complete',
    action: 'flow.submit',
    element_key: 'form.project.add-objective',
    outcome_key: 'outcome.objective-saved'
  });

  const result = validateServiceModel(model);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(({ code }) => code === 'duplicate_key_event_match'));
});

test('requires bounded semantic tenant and model keys', () => {
  const model = validModel();
  model.tenant_id = 'researchops/private';
  model.model_key = 'x'.repeat(121);

  const result = validateServiceModel(model);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(({ code }) => code === 'invalid_tenant_id'));
  assert.ok(result.errors.some(({ code }) => code === 'invalid_model_key'));
});
