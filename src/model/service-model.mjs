const ENTITY_TYPES = new Set(['service', 'transaction', 'task', 'step', 'question', 'field']);
const PARENT_TYPE = {
  transaction: 'service',
  task: 'transaction',
  step: 'task',
  question: 'step',
  field: 'question'
};
const SEMANTIC_KEY = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const MODEL_PROPERTIES = new Set(['schema_version', 'tenant_id', 'model_key', 'version', 'entities', 'bindings', 'outcomes', 'key_events']);
const ENTITY_PROPERTIES = new Set(['key', 'type', 'label', 'parent_key', 'position', 'complexity', 'required']);
const BINDING_PROPERTIES = new Set(['element_key', 'entity_key']);
const OUTCOME_PROPERTIES = new Set(['key', 'label', 'transaction_key', 'type']);
const KEY_EVENT_PROPERTIES = new Set(['key', 'label', 'action', 'element_key', 'outcome_key']);
const OUTCOME_TYPES = new Set(['success', 'failure', 'progress', 'abandonment']);

export function validateServiceModel(model) {
  const errors = [];
  const addError = (code, path) => errors.push({ code, path });
  if (!model || typeof model !== 'object' || Array.isArray(model)) addError('invalid_model', '$');
  for (const key of Object.keys(model ?? {})) if (!MODEL_PROPERTIES.has(key)) addError('unknown_property', key);
  if (model?.schema_version !== '1.0.0') addError('invalid_schema_version', 'schema_version');
  if (!semanticKey(model?.tenant_id, 120)) addError('invalid_tenant_id', 'tenant_id');
  if (!semanticKey(model?.model_key, 120)) addError('invalid_model_key', 'model_key');
  if (!Number.isInteger(model?.version) || model.version < 1) addError('invalid_version', 'version');
  if (!Array.isArray(model?.entities) || model.entities.length === 0) addError('missing_entities', 'entities');
  if (!Array.isArray(model?.bindings)) addError('invalid_bindings', 'bindings');
  if (!Array.isArray(model?.outcomes)) addError('invalid_outcomes', 'outcomes');
  if (!Array.isArray(model?.key_events)) addError('invalid_key_events', 'key_events');
  if (Array.isArray(model?.entities) && model.entities.length > 5000) addError('too_many_entities', 'entities');
  if (Array.isArray(model?.bindings) && model.bindings.length > 10000) addError('too_many_bindings', 'bindings');
  if (Array.isArray(model?.outcomes) && model.outcomes.length > 1000) addError('too_many_outcomes', 'outcomes');
  if (Array.isArray(model?.key_events) && model.key_events.length > 2000) addError('too_many_key_events', 'key_events');

  const entities = Array.isArray(model?.entities) ? model.entities.slice(0, 5000) : [];
  const bindings = Array.isArray(model?.bindings) ? model.bindings.slice(0, 10000) : [];
  const outcomes = Array.isArray(model?.outcomes) ? model.outcomes.slice(0, 1000) : [];
  const keyEvents = Array.isArray(model?.key_events) ? model.key_events.slice(0, 2000) : [];

  const entitiesByKey = new Map();
  for (const [index, entity] of entities.entries()) {
    const path = `entities[${index}]`;
    for (const key of Object.keys(entity ?? {})) if (!ENTITY_PROPERTIES.has(key)) addError('unknown_property', `${path}.${key}`);
    if (!ENTITY_TYPES.has(entity?.type)) addError('invalid_entity_type', `${path}.type`);
    if (!semanticKey(entity?.key, 120)) addError('invalid_entity_key', `${path}.key`);
    if (typeof entity?.label !== 'string' || entity.label.trim().length === 0 || entity.label.length > 120) addError('invalid_label', `${path}.label`);
    if (typeof entity?.label === 'string' && (entity.label.includes('@') || /https?:|[\r\n]/i.test(entity.label))) addError('unsafe_label', `${path}.label`);
    if (!Number.isInteger(entity?.position) || entity.position < 1 || entity.position > 10000) addError('invalid_position', `${path}.position`);
    if (entitiesByKey.has(entity?.key)) addError('duplicate_entity_key', `${path}.key`);
    else entitiesByKey.set(entity?.key, entity);
    if (entity?.type === 'question' && (!Number.isInteger(entity.complexity) || entity.complexity < 1 || entity.complexity > 7)) {
      addError('invalid_complexity', `${path}.complexity`);
    }
    if (entity?.type !== 'question' && entity?.complexity !== undefined) addError('misplaced_complexity', `${path}.complexity`);
    if (entity?.type === 'field' && typeof entity.required !== 'boolean') addError('invalid_required_status', `${path}.required`);
    if (entity?.type !== 'field' && entity?.required !== undefined) addError('misplaced_required_status', `${path}.required`);
    if (entity?.type === 'service' && entity.parent_key !== undefined) addError('service_parent_forbidden', `${path}.parent_key`);
  }
  if (entities.filter((entity) => entity?.type === 'service').length !== 1) addError('invalid_service_root_count', 'entities');
  for (const [index, entity] of entities.entries()) {
    const expectedParentType = PARENT_TYPE[entity?.type];
    if (expectedParentType && entitiesByKey.get(entity.parent_key)?.type !== expectedParentType) {
      addError('invalid_parent_type', `entities[${index}].parent_key`);
    }
  }
  const boundElementKeys = new Set();
  const bindingEntityKeys = new Map();
  for (const [index, binding] of bindings.entries()) {
    const path = `bindings[${index}]`;
    for (const key of Object.keys(binding ?? {})) if (!BINDING_PROPERTIES.has(key)) addError('unknown_property', `${path}.${key}`);
    if (!semanticKey(binding?.element_key, 160)) {
      addError('invalid_element_key', `${path}.element_key`);
    }
    if (boundElementKeys.has(binding?.element_key)) addError('duplicate_element_binding', `${path}.element_key`);
    else {
      boundElementKeys.add(binding?.element_key);
      bindingEntityKeys.set(binding?.element_key, binding?.entity_key);
    }
    if (!entitiesByKey.has(binding?.entity_key)) addError('unresolved_binding', `${path}.entity_key`);
  }
  const outcomesByKey = new Map();
  for (const [index, outcome] of outcomes.entries()) {
    const path = `outcomes[${index}]`;
    for (const key of Object.keys(outcome ?? {})) if (!OUTCOME_PROPERTIES.has(key)) addError('unknown_property', `${path}.${key}`);
    if (!semanticKey(outcome?.key, 120)) addError('invalid_outcome_key', `${path}.key`);
    if (outcomesByKey.has(outcome?.key)) addError('duplicate_outcome_key', `${path}.key`);
    else outcomesByKey.set(outcome?.key, outcome);
    if (!safeLabel(outcome?.label)) addError('invalid_label', `${path}.label`);
    if (entitiesByKey.get(outcome?.transaction_key)?.type !== 'transaction') addError('unresolved_outcome_transaction', `${path}.transaction_key`);
    if (!OUTCOME_TYPES.has(outcome?.type)) addError('invalid_outcome_type', `${path}.type`);
  }
  const keyEventKeys = new Set();
  const keyEventMatches = new Set();
  for (const [index, keyEvent] of keyEvents.entries()) {
    const path = `key_events[${index}]`;
    for (const key of Object.keys(keyEvent ?? {})) if (!KEY_EVENT_PROPERTIES.has(key)) addError('unknown_property', `${path}.${key}`);
    if (!semanticKey(keyEvent?.key, 120)) addError('invalid_key_event_key', `${path}.key`);
    if (keyEventKeys.has(keyEvent?.key)) addError('duplicate_key_event_key', `${path}.key`);
    else keyEventKeys.add(keyEvent?.key);
    if (!safeLabel(keyEvent?.label)) addError('invalid_label', `${path}.label`);
    if (!semanticKey(keyEvent?.action, 80)) addError('invalid_key_event_action', `${path}.action`);
    if (!semanticKey(keyEvent?.element_key, 120)) addError('invalid_element_key', `${path}.element_key`);
    if (!validKeyEventContract(keyEvent?.action, keyEvent?.element_key)) addError('invalid_key_event_contract', path);
    if (!boundElementKeys.has(keyEvent?.element_key)) addError('unresolved_key_event_binding', `${path}.element_key`);
    const matchKey = `${keyEvent?.action}\u0000${keyEvent?.element_key}`;
    if (keyEventMatches.has(matchKey)) addError('duplicate_key_event_match', path);
    else keyEventMatches.add(matchKey);
    if (!outcomesByKey.has(keyEvent?.outcome_key)) addError('unresolved_key_event_outcome', `${path}.outcome_key`);
    const outcome = outcomesByKey.get(keyEvent?.outcome_key);
    const boundEntity = entitiesByKey.get(bindingEntityKeys.get(keyEvent?.element_key));
    const boundTransaction = ancestorOfType(boundEntity, 'transaction', entitiesByKey);
    if (outcome && boundTransaction?.key !== outcome.transaction_key) addError('key_event_outcome_transaction_mismatch', `${path}.outcome_key`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateServiceModelForPublication(model) {
  const validation = validateServiceModel(model);
  if (!validation.valid) return validation;
  const entitiesByKey = new Map(model.entities.map((entity) => [entity.key, entity]));
  const errors = [];
  for (const [index, binding] of model.bindings.entries()) {
    const key = binding.element_key.toLowerCase();
    const fieldBinding = entitiesByKey.get(binding.entity_key)?.type === 'field';
    if (key.startsWith('autocomplete.')) {
      errors.push({ code: 'prohibited_global_binding', path: `bindings[${index}].element_key` });
      continue;
    }
    const nestedAuthScope = key !== 'auth.otp' && /(^|[._:-])auth(?=[._:-]|$)/.test(key);
    if (nestedAuthScope && !fieldBinding) {
      errors.push({ code: 'prohibited_global_binding', path: `bindings[${index}].element_key` });
      continue;
    }
    if (fieldBinding && (key.length > 120 || !key.startsWith('field.') || key === 'auth.otp' || nestedAuthScope)) {
      errors.push({ code: 'prohibited_field_binding', path: `bindings[${index}].element_key` });
    }
  }
  return { valid: errors.length === 0, errors };
}

export function resolveServiceContext(model, elementKey, action) {
  if (!validateServiceModel(model).valid) return null;
  const entityKey = model.bindings.find((binding) => binding.element_key === elementKey)?.entity_key;
  if (!entityKey) return null;
  const entitiesByKey = new Map(model.entities.map((entity) => [entity.key, entity]));
  const hierarchy = {};
  let entity = entitiesByKey.get(entityKey);
  while (entity) {
    hierarchy[entity.type] = entity;
    entity = entity.parent_key ? entitiesByKey.get(entity.parent_key) : null;
  }
  const transaction = hierarchy.transaction;
  const questionComplexities = model.entities
    .filter((candidate) => candidate.type === 'question' && ancestorOfType(candidate, 'transaction', entitiesByKey)?.key === transaction?.key)
    .map((question) => question.complexity);
  const transactionComplexity = questionComplexities.length > 0
    ? Math.round((questionComplexities.reduce((sum, value) => sum + value, 0) / questionComplexities.length) * 100) / 100
    : null;
  const context = {
    model_key: model.model_key,
    model_version: model.version,
    entity_key: entityKey,
    service_key: hierarchy.service?.key ?? null,
    transaction_key: transaction?.key ?? null,
    task_key: hierarchy.task?.key ?? null,
    step_key: hierarchy.step?.key ?? null,
    question_key: hierarchy.question?.key ?? null,
    field_key: hierarchy.field?.key ?? null,
    field_required: hierarchy.field?.required ?? null,
    question_complexity: hierarchy.question?.complexity ?? null,
    transaction_complexity: transactionComplexity
  };
  const keyEvent = model.key_events?.find((candidate) => candidate.element_key === elementKey && candidate.action === action);
  const outcome = keyEvent ? model.outcomes?.find((candidate) => candidate.key === keyEvent.outcome_key) : null;
  if (keyEvent && outcome) {
    context.key_event_key = keyEvent.key;
    context.outcome_key = outcome.key;
    context.outcome_type = outcome.type;
  }
  return context;
}

function ancestorOfType(entity, type, entitiesByKey) {
  let current = entity;
  while (current) {
    if (current.type === type) return current;
    current = current.parent_key ? entitiesByKey.get(current.parent_key) : null;
  }
  return null;
}

function safeLabel(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 120 && !value.includes('@') && !/https?:|[\r\n]/i.test(value);
}

function semanticKey(value, maximumLength) {
  return typeof value === 'string' && value.length >= 3 && value.length <= maximumLength && SEMANTIC_KEY.test(value);
}

function validKeyEventContract(action, elementKey) {
  const otpActions = new Set(['auth.otp.requested', 'auth.otp.succeeded', 'auth.otp.failed']);
  const isOtpAction = typeof action === 'string' && action.startsWith('auth.otp.');
  const isOtpElement = elementKey === 'auth.otp';
  if (isOtpAction || isOtpElement) return isOtpElement && otpActions.has(action);
  return true;
}
