const ENTITY_TYPES = ['service', 'transaction', 'task', 'step', 'question', 'field'];

export function summariseServiceModel(model, coverage = {}, observedKeyEvents = []) {
  const entitiesByKey = new Map(model.entities.map((entity) => [entity.key, entity]));
  const entityCounts = Object.fromEntries(ENTITY_TYPES.map((type) => [type, model.entities.filter((entity) => entity.type === type).length]));
  const transactionComplexity = model.entities
    .filter((entity) => entity.type === 'transaction')
    .map((transaction) => {
      const questions = model.entities.filter((entity) => entity.type === 'question' && ancestor(entity, 'transaction', entitiesByKey)?.key === transaction.key);
      const complexity = questions.length === 0 ? null : round(questions.reduce((sum, question) => sum + question.complexity, 0) / questions.length);
      return { key: transaction.key, label: transaction.label, complexity, question_count: questions.length };
    });
  const eventCount = boundedCount(coverage.event_count);
  const resolvedEventCount = Math.min(eventCount, boundedCount(coverage.resolved_event_count));
  const unmappedEventCount = Math.min(eventCount - resolvedEventCount, boundedCount(coverage.unmapped_event_count ?? eventCount - resolvedEventCount));
  const retiredModelEventCount = boundedCount(coverage.retired_model_event_count);
  const observedByKey = new Map(observedKeyEvents.map((row) => [row.key_event_key, row]));
  const outcomesByKey = new Map(model.outcomes.map((outcome) => [outcome.key, outcome]));
  const keyEvents = model.key_events.map((keyEvent) => {
    const outcome = outcomesByKey.get(keyEvent.outcome_key);
    const observed = observedByKey.get(keyEvent.key);
    return {
      key: keyEvent.key,
      label: keyEvent.label,
      outcome_key: outcome.key,
      outcome_label: outcome.label,
      outcome_type: outcome.type,
      event_count: boundedCount(observed?.event_count),
      session_count: boundedCount(observed?.session_count)
    };
  });
  return {
    model_key: model.model_key,
    version: model.version,
    entity_counts: entityCounts,
    binding_count: model.bindings.length,
    outcome_count: model.outcomes.length,
    key_event_count: model.key_events.length,
    key_events: keyEvents,
    transaction_complexity: transactionComplexity,
    coverage: {
      event_count: eventCount,
      resolved_event_count: resolvedEventCount,
      unmapped_event_count: unmappedEventCount,
      retired_model_event_count: retiredModelEventCount,
      mapping_rate: eventCount === 0 ? 0 : round((resolvedEventCount / eventCount) * 100)
    }
  };
}

function ancestor(entity, type, entitiesByKey) {
  let current = entity;
  while (current) {
    if (current.type === type) return current;
    current = current.parent_key ? entitiesByKey.get(current.parent_key) : null;
  }
  return null;
}

function boundedCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function round(value) {
  return Math.round(value * 100) / 100;
}
