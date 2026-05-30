export const STORAGE_STATUS = Object.freeze({
  DISABLED: 'disabled',
  READY: 'ready'
});

export const STORAGE_DECISION = Object.freeze({
  NOT_STORED: 'not_stored',
  STORAGE_DISABLED: 'storage_disabled',
  INVALID_RECORD: 'invalid_record'
});

export function createStorageCandidate(event, context = {}) {
  return {
    schema_version: '1.0.0',
    event,
    received_at_ms: context.received_at_ms ?? Date.now(),
    source: context.source ?? 'collector',
    storage_status: STORAGE_STATUS.DISABLED
  };
}

export function validateStorageCandidate(candidate) {
  const errors = [];

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return {
      valid: false,
      errors: ['candidate must be an object']
    };
  }

  if (candidate.schema_version !== '1.0.0') {
    errors.push('schema_version must be 1.0.0');
  }

  if (!candidate.event || typeof candidate.event !== 'object' || Array.isArray(candidate.event)) {
    errors.push('event must be an object');
  }

  if (!Number.isInteger(candidate.received_at_ms) || candidate.received_at_ms < 0) {
    errors.push('received_at_ms must be a non-negative integer');
  }

  if (typeof candidate.source !== 'string' || candidate.source.trim() === '') {
    errors.push('source must be a non-empty string');
  }

  if (candidate.storage_status !== STORAGE_STATUS.DISABLED) {
    errors.push('storage_status must remain disabled until a storage PR introduces bindings');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function createDisabledEventStore() {
  return {
    status: STORAGE_STATUS.DISABLED,
    async put(candidate) {
      const validation = validateStorageCandidate(candidate);

      if (!validation.valid) {
        return {
          stored: false,
          decision: STORAGE_DECISION.INVALID_RECORD,
          errors: validation.errors
        };
      }

      return {
        stored: false,
        decision: STORAGE_DECISION.STORAGE_DISABLED,
        storage: STORAGE_STATUS.DISABLED
      };
    }
  };
}
