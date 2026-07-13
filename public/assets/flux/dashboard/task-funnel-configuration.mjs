export function createFunnel(model, { label }) {
  const next = nextVersion(model);
  const service = next.entities.find(({ type }) => type === 'service');
  const transactions = next.entities.filter(({ type }) => type === 'transaction');
  next.entities.push({
    key: uniqueKey(next, 'transaction', label),
    type: 'transaction',
    label: requiredLabel(label),
    parent_key: service.key,
    position: transactions.length + 1
  });
  return next;
}

export function createTask(model, { transactionKey, label }) {
  const next = nextVersion(model);
  requireEntity(next, transactionKey, 'transaction');
  const siblings = children(next, transactionKey, 'task');
  next.entities.push({
    key: uniqueKey(next, 'task', label),
    type: 'task',
    label: requiredLabel(label),
    parent_key: transactionKey,
    position: siblings.length + 1
  });
  return next;
}

export function createStep(model, { taskKey, label, elementKey }) {
  const next = nextVersion(model);
  const task = requireEntity(next, taskKey, 'task');
  const semanticElementKey = requiredElementKey(elementKey);
  const key = uniqueKey(next, 'step', label);
  next.entities.push({
    key,
    type: 'step',
    label: requiredLabel(label),
    parent_key: taskKey,
    position: children(next, taskKey, 'step').length + 1
  });
  assignStepBinding(next, semanticElementKey, key, transactionAncestor(next, task).key);
  return next;
}

export function updateEntity(model, entityKey, { label }) {
  const next = nextVersion(model);
  const entity = next.entities.find((candidate) => candidate.key === entityKey);
  if (!entity || !['transaction', 'task', 'step'].includes(entity.type)) throw new TypeError('editable_entity_not_found');
  entity.label = requiredLabel(label);
  return next;
}

export function updateStep(model, stepKey, { label, elementKey }) {
  const next = nextVersion(model);
  const step = requireEntity(next, stepKey, 'step');
  const semanticElementKey = requiredElementKey(elementKey);
  const binding = next.bindings.find((candidate) => candidate.entity_key === stepKey);
  const transactionKey = transactionAncestor(next, step).key;
  step.label = requiredLabel(label);
  if (binding) {
    const previousElementKey = binding.element_key;
    const targetBinding = next.bindings.find((candidate) => candidate.element_key === semanticElementKey);
    if (targetBinding && targetBinding !== binding) {
      if (targetBinding.entity_key !== transactionKey) throw new TypeError('element_key_in_use');
      next.bindings = next.bindings.filter((candidate) => candidate !== binding);
      targetBinding.entity_key = stepKey;
    } else {
      binding.element_key = semanticElementKey;
    }
    for (const keyEvent of next.key_events) {
      if (keyEvent.element_key === previousElementKey) keyEvent.element_key = semanticElementKey;
    }
  } else {
    assignStepBinding(next, semanticElementKey, stepKey, transactionKey);
  }
  return next;
}

export function moveEntity(model, entityKey, direction) {
  if (direction !== -1 && direction !== 1) throw new TypeError('invalid_move_direction');
  const next = nextVersion(model);
  const entity = next.entities.find((candidate) => candidate.key === entityKey);
  if (!entity || !['transaction', 'task', 'step'].includes(entity.type)) throw new TypeError('movable_entity_not_found');
  const siblings = next.entities
    .filter((candidate) => candidate.type === entity.type && candidate.parent_key === entity.parent_key)
    .sort((left, right) => left.position - right.position || left.key.localeCompare(right.key));
  const index = siblings.findIndex(({ key }) => key === entityKey);
  const other = siblings[index + direction];
  if (!other) throw new TypeError('move_out_of_bounds');
  const position = entity.position;
  entity.position = other.position;
  other.position = position;
  return next;
}

export function deleteEntity(model, entityKey) {
  const next = nextVersion(model);
  const root = next.entities.find((candidate) => candidate.key === entityKey);
  if (!root || !['transaction', 'task', 'step'].includes(root.type)) throw new TypeError('deletable_entity_not_found');
  const deletedKeys = new Set([entityKey]);
  let found = true;
  while (found) {
    found = false;
    for (const entity of next.entities) {
      if (entity.parent_key && deletedKeys.has(entity.parent_key) && !deletedKeys.has(entity.key)) {
        deletedKeys.add(entity.key);
        found = true;
      }
    }
  }
  const deletedElementKeys = new Set(next.bindings.filter(({ entity_key }) => deletedKeys.has(entity_key)).map(({ element_key }) => element_key));
  const deletedOutcomeKeys = new Set(
    root.type === 'transaction'
      ? next.outcomes.filter(({ transaction_key }) => transaction_key === root.key).map(({ key }) => key)
      : []
  );
  const affectedOutcomeKeys = new Set(
    next.key_events.filter(({ element_key }) => deletedElementKeys.has(element_key)).map(({ outcome_key }) => outcome_key)
  );
  next.entities = next.entities.filter(({ key }) => !deletedKeys.has(key));
  next.bindings = next.bindings.filter(({ entity_key }) => !deletedKeys.has(entity_key));
  next.key_events = next.key_events.filter(({ element_key, outcome_key }) => !deletedElementKeys.has(element_key) && !deletedOutcomeKeys.has(outcome_key));
  for (const outcomeKey of affectedOutcomeKeys) {
    if (!next.key_events.some(({ outcome_key }) => outcome_key === outcomeKey)) deletedOutcomeKeys.add(outcomeKey);
  }
  next.outcomes = next.outcomes.filter(({ key }) => !deletedOutcomeKeys.has(key));
  next.key_events = next.key_events.filter(({ outcome_key }) => !deletedOutcomeKeys.has(outcome_key));
  reindexEntities(next);
  return next;
}

export function createSuccessEvent(model, { transactionKey, label, action, elementKey }) {
  const next = nextVersion(model);
  requireEntity(next, transactionKey, 'transaction');
  const outcomeLabel = requiredLabel(label);
  const semanticElementKey = requiredElementKey(elementKey);
  const semanticAction = requiredAction(action);
  const binding = next.bindings.find((candidate) => candidate.element_key === semanticElementKey);
  if (binding) {
    const boundEntity = next.entities.find(({ key }) => key === binding.entity_key);
    if (transactionAncestor(next, boundEntity)?.key !== transactionKey) throw new TypeError('element_key_in_other_funnel');
  } else {
    next.bindings.push({ element_key: semanticElementKey, entity_key: transactionKey });
  }
  const outcomeKey = uniqueArtifactKey(next.outcomes, 'outcome', outcomeLabel);
  next.outcomes.push({
    key: outcomeKey,
    label: outcomeLabel,
    transaction_key: transactionKey,
    type: 'success'
  });
  next.key_events.push({
    key: uniqueArtifactKey(next.key_events, 'key-event', outcomeLabel),
    label: outcomeLabel,
    action: semanticAction,
    element_key: semanticElementKey,
    outcome_key: outcomeKey
  });
  return next;
}

export function updateSuccessEvent(model, outcomeKey, keyEventKeyOrChanges, maybeChanges) {
  const next = nextVersion(model);
  const outcome = next.outcomes.find(({ key }) => key === outcomeKey);
  const changes = typeof keyEventKeyOrChanges === 'string' ? maybeChanges : keyEventKeyOrChanges;
  const keyEventKey = typeof keyEventKeyOrChanges === 'string' ? keyEventKeyOrChanges : null;
  const matchingEvents = next.key_events.filter(({ outcome_key }) => outcome_key === outcomeKey);
  if (!keyEventKey && matchingEvents.length > 1) throw new TypeError('ambiguous_success_event');
  const keyEvent = keyEventKey
    ? matchingEvents.find(({ key }) => key === keyEventKey)
    : matchingEvents[0];
  if (!outcome || !keyEvent) throw new TypeError('success_event_not_found');
  const { label, action, elementKey } = changes ?? {};
  const outcomeLabel = requiredLabel(label);
  const semanticAction = requiredAction(action);
  const semanticElementKey = requiredElementKey(elementKey);
  const binding = next.bindings.find((candidate) => candidate.element_key === semanticElementKey);
  if (binding) {
    const boundEntity = next.entities.find(({ key }) => key === binding.entity_key);
    if (transactionAncestor(next, boundEntity)?.key !== outcome.transaction_key) throw new TypeError('element_key_in_other_funnel');
  } else {
    next.bindings.push({ element_key: semanticElementKey, entity_key: outcome.transaction_key });
  }
  if (matchingEvents.length === 1) outcome.label = outcomeLabel;
  keyEvent.label = outcomeLabel;
  keyEvent.action = semanticAction;
  keyEvent.element_key = semanticElementKey;
  return next;
}

export function deleteSuccessEvent(model, outcomeKey, keyEventKey = null) {
  const next = nextVersion(model);
  const outcome = next.outcomes.find(({ key }) => key === outcomeKey);
  if (!outcome) throw new TypeError('success_event_not_found');
  const matchingEvents = next.key_events.filter(({ outcome_key }) => outcome_key === outcomeKey);
  if (!keyEventKey && matchingEvents.length > 1) throw new TypeError('ambiguous_success_event');
  if (keyEventKey && !matchingEvents.some(({ key }) => key === keyEventKey)) throw new TypeError('success_event_not_found');
  const deletedKey = keyEventKey ?? matchingEvents[0]?.key;
  if (deletedKey) next.key_events = next.key_events.filter(({ key }) => key !== deletedKey);
  if (!next.key_events.some(({ outcome_key }) => outcome_key === outcomeKey)) {
    next.outcomes = next.outcomes.filter(({ key }) => key !== outcomeKey);
  }
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

function requiredElementKey(value) {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (key.length < 3 || key.length > 160 || !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(key)) {
    throw new TypeError('invalid_element_key');
  }
  return key;
}

function requiredAction(value) {
  const action = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (action.length < 3 || action.length > 80 || !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(action)) {
    throw new TypeError('invalid_action');
  }
  return action;
}

function requireEntity(model, key, type) {
  const entity = model.entities.find((candidate) => candidate.key === key);
  if (entity?.type !== type) throw new TypeError(`${type}_not_found`);
  return entity;
}

function children(model, parentKey, type) {
  return model.entities.filter((entity) => entity.type === type && entity.parent_key === parentKey);
}

function transactionAncestor(model, entity) {
  let current = entity;
  while (current) {
    if (current.type === 'transaction') return current;
    current = model.entities.find(({ key }) => key === current.parent_key);
  }
  return null;
}

function assignStepBinding(model, elementKey, stepKey, transactionKey) {
  const binding = model.bindings.find((candidate) => candidate.element_key === elementKey);
  if (!binding) {
    model.bindings.push({ element_key: elementKey, entity_key: stepKey });
    return;
  }
  if (binding.entity_key !== transactionKey) throw new TypeError('element_key_in_use');
  binding.entity_key = stepKey;
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
  let suffix = 1;
  let key = boundedKey(prefix, stem, suffix);
  while (keys.has(key)) {
    suffix += 1;
    key = boundedKey(prefix, stem, suffix);
  }
  return key;
}

function boundedKey(prefix, stem, suffix) {
  const suffixText = suffix === 1 ? '' : `-${suffix}`;
  const maximumStemLength = 160 - prefix.length - 1 - suffixText.length;
  const boundedStem = stem.slice(0, maximumStemLength).replace(/-+$/g, '') || 'item'.slice(0, maximumStemLength);
  return `${prefix}.${boundedStem}${suffixText}`;
}

function uniqueArtifactKey(items, prefix, label) {
  const model = { entities: items.map(({ key }) => ({ key })) };
  return uniqueKey(model, prefix, label);
}
