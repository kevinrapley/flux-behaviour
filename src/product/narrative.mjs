import { isAuthOtpAction, isNeutralAuthMilestone, isSensitiveAuthInteraction } from '../events/event-privacy-policy.mjs';

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
  const controlledKey = String(elementKey ?? '');
  const tokens = words(elementKey);
  const type = tokens[0];
  if (type === 'page') {
    if (!/^page\.[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*$/.test(controlledKey)) return null;
    return { label: sentenceCase(tokens.slice(1).join(' ')), type: 'page' };
  }
  if (!SEMANTIC_CONTROL_TYPES.has(type)) return null;
  // Positional form fallbacks are deliberately generic, even though they use
  // the form.* namespace. Only a publisher-declared form key is narrative-safe.
  if (type === 'form' && /^\d+$/.test(tokens.at(-1) ?? '')) return null;
  const labelStart = CONTROL_SCOPES.has(tokens[1]) ? 2 : 1;
  return { label: sentenceCase(tokens.slice(labelStart).join(' ')), type };
}

function actionMethod(event, metadata) {
  if (event.action === 'control.click') return metadata.pointer_type === 'touch' ? 'Touch' : 'Click';
  return ACTION_LABELS[event.event_class] ?? 'Interact';
}

export function describeInteraction(event) {
  const metadata = event.metadata ?? event;
  const semantic = semanticElement(event.element_key);
  const outcome = isNeutralAuthMilestone(event) ? AUTH_OUTCOMES[event.action] : null;
  if (outcome) return outcome;
  if (isAuthOtpAction(event.action)) return 'Ignored an invalid authentication milestone.';
  if (isSensitiveAuthInteraction(event)) return 'Ignored a sensitive authentication interaction.';

  if (event.action === 'page.loaded' && semantic?.type === 'page') {
    return `Opened the ${semantic.label} page.`;
  }

  const dwell = Number.isInteger(metadata.duration_ms) ? metadata.duration_ms : null;
  const keyPresses = Number.isInteger(metadata.key_press_count) ? metadata.key_press_count : null;
  const valueLength = Number.isInteger(metadata.value_length) ? metadata.value_length : null;
  const editCount = Number.isInteger(metadata.edit_count) ? metadata.edit_count : 0;
  const pasteCount = Number.isInteger(metadata.paste_count) ? metadata.paste_count : 0;
  const typed = keyPresses ?? valueLength;
  const changed = (keyPresses ?? 0) > 0 || editCount > 0 || pasteCount > 0;
  if (event.action === 'field.blur' && semantic?.type === 'field' && !changed) {
    const duration = dwell === null ? '' : ` for ${Math.round(dwell / 100) / 10}s`;
    return `Focused the ${semantic.label} field${duration} without changing it${interactionDetails(metadata)}.`;
  }
  if (event.action === 'field.blur' && semantic?.type === 'field' && keyPresses !== null && keyPresses > 0) {
    const duration = dwell === null ? '' : ` after focusing it for ${Math.round(dwell / 100) / 10}s`;
    return `Typed ${keyPresses} character${keyPresses === 1 ? '' : 's'} in the ${semantic.label} field${duration}${interactionDetails(metadata)}.`;
  }
  if (event.action === 'field.blur' && semantic?.type === 'field' && changed) {
    const duration = dwell === null ? '' : ` after focusing it for ${Math.round(dwell / 100) / 10}s`;
    if (valueLength !== null && valueLength > 0) {
      return `Entered ${valueLength} character${valueLength === 1 ? '' : 's'} in the ${semantic.label} field${duration} without recorded key presses${interactionDetails(metadata)}.`;
    }
    return `Changed the ${semantic.label} field${duration} without recorded key presses${interactionDetails(metadata)}.`;
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

  const method = actionMethod(event, metadata);
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
