const ACTION_LABELS = Object.freeze({ click: 'Click', touch: 'Touch', tab: 'Tab', focus: 'Focus', input: 'Type', nav: 'Navigate', kbd: 'Key interaction', assist: 'Open help' });
const SEMANTIC_CONTROL_TYPES = new Set(['button', 'field', 'form', 'link', 'tab']);
const CONTROL_SCOPES = new Set(['analysis', 'auth', 'journal', 'navigation', 'project']);
const AUTH_OUTCOMES = Object.freeze({
  'auth.otp.requested': 'Requested a one-time sign-in code.',
  'auth.otp.succeeded': 'Successfully verified the one-time code and signed in.',
  'auth.otp.failed': 'Could not verify the one-time code.',
});

function interactionDetails(metadata) {
  const details = [];
  if (metadata.pointer_type && metadata.pointer_type !== 'unknown') details.push(`using ${metadata.pointer_type}`);
  return details.length ? `, ${details.join(', ')}` : '';
}

function words(value) {
  return String(value ?? '')
    .split(/[._:-]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase() === 'otp' ? 'one-time code' : word);
}

function sentenceCase(value) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : 'Unknown';
}

function semanticElement(elementKey) {
  const tokens = words(elementKey);
  const type = tokens[0];
  if (type === 'page') return { label: sentenceCase(tokens.slice(1).join(' ')), type: 'page' };
  if (!SEMANTIC_CONTROL_TYPES.has(type)) return null;
  const labelStart = CONTROL_SCOPES.has(tokens[1]) ? 2 : 1;
  return { label: sentenceCase(tokens.slice(labelStart).join(' ')), type };
}

export function describeInteraction(event) {
  const metadata = event.metadata ?? event;
  const semantic = semanticElement(event.element_key);
  const outcome = AUTH_OUTCOMES[event.action];
  if (outcome) return outcome;

  if (event.action === 'page.loaded' && semantic?.type === 'page') {
    return `Opened the ${semantic.label} page.`;
  }

  const dwell = Number.isInteger(metadata.duration_ms) ? metadata.duration_ms : null;
  const typed = Number.isInteger(metadata.key_press_count) ? metadata.key_press_count : Number.isInteger(metadata.value_length) ? metadata.value_length : null;
  if (event.action === 'field.blur' && semantic?.type === 'field' && typed === 0) {
    const duration = dwell === null ? '' : ` for ${Math.round(dwell / 100) / 10}s`;
    return `Focused the ${semantic.label} field${duration} without entering text${interactionDetails(metadata)}.`;
  }
  if (event.action === 'field.blur' && semantic?.type === 'field' && typed !== null && typed > 0) {
    const duration = dwell === null ? '' : ` after focusing it for ${Math.round(dwell / 100) / 10}s`;
    return `Typed ${typed} character${typed === 1 ? '' : 's'} in the ${semantic.label} field${duration}${interactionDetails(metadata)}.`;
  }
  if (event.action === 'flow.submit' && semantic?.type === 'form') {
    return `Submitted the ${semantic.label} form.`;
  }
  if (event.action === 'error.invalid' && semantic?.type === 'field') {
    return `Encountered a validation error on the ${semantic.label} field.`;
  }
  if (event.action === 'control.tab' && semantic) {
    return `Tabbed from the ${semantic.label} ${semantic.type}${interactionDetails(metadata)}.`;
  }

  const method = ACTION_LABELS[metadata.interaction_type] ?? ACTION_LABELS[event.event_class] ?? 'Interact';
  if (semantic) {
    const parts = [`${method} the ${semantic.label} ${semantic.type}`];
    if (dwell !== null) parts.push(`after dwelling for ${Math.round(dwell / 100) / 10}s`);
    if (typed !== null) parts.push(`then typing ${typed} character${typed === 1 ? '' : 's'}`);
    if (metadata.pointer_type && metadata.pointer_type !== 'unknown') parts.push(`using ${metadata.pointer_type}`);
    return `${parts.join(', ')}.`;
  }

  const label = String(event.element_key ?? 'unknown').replace(/[._:-]+/g, ' ').trim();
  const parts = [`${method} on ${event.role || 'element'} “${label || 'unknown'}”`];
  if (dwell !== null) parts.push(`after dwelling for ${Math.round(dwell / 100) / 10}s`);
  if (typed !== null) parts.push(`then typing ${typed} character${typed === 1 ? '' : 's'}`);
  if (metadata.pointer_type && metadata.pointer_type !== 'unknown') parts.push(`using ${metadata.pointer_type}`);
  return `${parts.join(', ')}.`;
}
