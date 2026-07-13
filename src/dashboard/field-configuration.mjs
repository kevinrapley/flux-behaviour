export function createQuestionGroup(model, { stepKey, label, complexity }) {
  const next = nextVersion(model);
  requireEntity(next, stepKey, 'step');
  const questionLabel = requiredLabel(label);
  next.entities.push({
    key: uniqueKey(next, 'question', questionLabel),
    type: 'question',
    label: questionLabel,
    parent_key: stepKey,
    position: children(next, stepKey, 'question').length + 1,
    complexity: requiredComplexity(complexity)
  });
  return next;
}

export function updateQuestionGroup(model, questionKey, { label, complexity }) {
  const next = nextVersion(model);
  const question = requireEntity(next, questionKey, 'question');
  question.label = requiredLabel(label);
  question.complexity = requiredComplexity(complexity);
  return next;
}

export function createField(model, { questionKey, label, elementKey, required }) {
  const next = nextVersion(model);
  requireEntity(next, questionKey, 'question');
  const fieldLabel = requiredLabel(label);
  const semanticElementKey = requiredElementKey(elementKey);
  if (next.bindings.some((binding) => binding.element_key === semanticElementKey)) throw new TypeError('element_key_in_use');
  const key = uniqueKey(next, 'field', fieldLabel);
  next.entities.push({
    key,
    type: 'field',
    label: fieldLabel,
    parent_key: questionKey,
    position: children(next, questionKey, 'field').length + 1,
    required: requiredBoolean(required)
  });
  next.bindings.push({ element_key: semanticElementKey, entity_key: key });
  return next;
}

export function updateField(model, fieldKey, { label, elementKey, required }) {
  const next = nextVersion(model);
  const field = requireEntity(next, fieldKey, 'field');
  const semanticElementKey = requiredElementKey(elementKey);
  const collision = next.bindings.find((binding) => binding.element_key === semanticElementKey && binding.entity_key !== fieldKey);
  if (collision) throw new TypeError('element_key_in_use');
  const binding = next.bindings.find((candidate) => candidate.entity_key === fieldKey);
  field.label = requiredLabel(label);
  field.required = requiredBoolean(required);
  if (binding) {
    const previousElementKey = binding.element_key;
    binding.element_key = semanticElementKey;
    for (const keyEvent of next.key_events) {
      if (keyEvent.element_key === previousElementKey) keyEvent.element_key = semanticElementKey;
    }
  } else {
    next.bindings.push({ element_key: semanticElementKey, entity_key: fieldKey });
  }
  return next;
}

export function deleteFieldEntity(model, entityKey) {
  const next = nextVersion(model);
  const root = next.entities.find((candidate) => candidate.key === entityKey);
  if (!root || !['question', 'field'].includes(root.type)) throw new TypeError('deletable_field_entity_not_found');
  const deletedKeys = new Set([entityKey]);
  if (root.type === 'question') {
    for (const field of children(next, root.key, 'field')) deletedKeys.add(field.key);
  }
  const deletedElementKeys = new Set(
    next.bindings.filter(({ entity_key }) => deletedKeys.has(entity_key)).map(({ element_key }) => element_key)
  );
  next.entities = next.entities.filter(({ key }) => !deletedKeys.has(key));
  next.bindings = next.bindings.filter(({ entity_key }) => !deletedKeys.has(entity_key));
  next.key_events = next.key_events.filter(({ element_key }) => !deletedElementKeys.has(element_key));
  reindexEntities(next);
  return next;
}

function nextVersion(model) {
  const next = structuredClone(model);
  next.version += 1;
  return next;
}

function requiredLabel(value) {
  const label = typeof value === 'string' ? value.trim() : '';
  if (!label) throw new TypeError('label_required');
  return label;
}

function requiredComplexity(value) {
  const complexity = Number(value);
  if (!Number.isInteger(complexity) || complexity < 1 || complexity > 7) throw new TypeError('invalid_complexity');
  return complexity;
}

function requiredElementKey(value) {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (key.length < 3 || key.length > 160 || !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(key)) {
    throw new TypeError('invalid_element_key');
  }
  return key;
}

function requiredBoolean(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new TypeError('invalid_required_status');
}

function requireEntity(model, key, type) {
  const entity = model.entities.find((candidate) => candidate.key === key);
  if (entity?.type !== type) throw new TypeError(`${type}_not_found`);
  return entity;
}

function children(model, parentKey, type) {
  return model.entities.filter((entity) => entity.type === type && entity.parent_key === parentKey);
}

function reindexEntities(model) {
  const groups = new Map();
  for (const entity of model.entities) {
    const groupKey = `${entity.type}\u0000${entity.parent_key ?? ''}`;
    const group = groups.get(groupKey) ?? [];
    group.push(entity);
    groups.set(groupKey, group);
  }
  for (const group of groups.values()) {
    group.sort((left, right) => left.position - right.position || left.key.localeCompare(right.key));
    group.forEach((entity, index) => { entity.position = index + 1; });
  }
}

function uniqueKey(model, prefix, label) {
  const stem = requiredLabel(label)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
  const keys = new Set(model.entities.map(({ key }) => key));
  let key = `${prefix}.${stem}`;
  let suffix = 2;
  while (keys.has(key)) {
    key = `${prefix}.${stem}-${suffix}`;
    suffix += 1;
  }
  return key;
}
