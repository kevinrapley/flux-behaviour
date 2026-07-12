import { isAuthOtpAction, isNeutralAuthMilestone, isSensitiveAuthInteraction } from '../events/event-privacy-policy.mjs';

const SEMANTIC_CONTROL_TYPES = new Set(['button', 'field', 'form', 'link', 'tab']);
const CONTROL_SCOPES = new Set(['analysis', 'auth', 'journal', 'navigation', 'project']);
const AUTH_OUTCOMES = Object.freeze({
  'auth.otp.requested': 'Requested a one-time sign-in code.',
  'auth.otp.succeeded': 'Successfully verified the one-time code and signed in.',
  'auth.otp.failed': 'Could not verify the one-time code.',
});

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
    return { label: sentenceCase(tokens.slice(1).join(' ')), noun: 'page', type: 'page' };
  }
  if (!SEMANTIC_CONTROL_TYPES.has(type)) return null;
  if (type === 'form' && /^\d+$/.test(tokens.at(-1) ?? '')) return null;
  const labelStart = CONTROL_SCOPES.has(tokens[1]) ? 2 : 1;
  const purposeTokens = tokens.slice(labelStart);
  const isTextArea = type === 'field' && purposeTokens.at(-1) === 'textarea';
  if (isTextArea) purposeTokens.pop();
  return {
    label: sentenceCase(purposeTokens.join(' ')),
    noun: isTextArea ? 'text area' : type,
    type,
  };
}

function fallbackElement(event) {
  const key = String(event.element_key ?? '').toLowerCase();
  if (key.startsWith('auto.page.')) return { phrase: 'an unlabelled page', noun: 'page', type: 'page' };
  if (/^auto\.a\./.test(key)) return { phrase: 'an unlabelled link', noun: 'link', type: 'link' };
  if (/^auto\.button\.submit\./.test(key)) return { phrase: 'an unlabelled submit button', noun: 'submit button', type: 'button' };
  if (/^auto\.button\./.test(key)) return { phrase: 'an unlabelled button', noun: 'button', type: 'button' };
  if (/^auto\.textarea\./.test(key)) return { phrase: 'an unlabelled text area', noun: 'text area', type: 'field' };
  if (/^auto\.(?:input|select)\./.test(key)) return { phrase: 'an unlabelled field', noun: 'field', type: 'field' };
  if (/^form\..*\.\d+$/.test(key)) return { phrase: 'an unlabelled form', noun: 'form', type: 'form' };
  if (key.startsWith('auto.')) return { phrase: `an unlabelled ${event.role || 'element'}`, noun: event.role || 'element', type: event.role || 'element' };
  return null;
}

function elementDetails(event) {
  const semantic = semanticElement(event.element_key);
  if (semantic) return { ...semantic, phrase: `the ${semantic.label} ${semantic.noun}`, semantic: true };
  return fallbackElement(event);
}

function durationText(durationMs) {
  return `${Math.round(durationMs / 100) / 10}s`;
}

function exitText(metadata) {
  return metadata.pointer_type && metadata.pointer_type !== 'unknown'
    ? ` Focus left using a ${metadata.pointer_type}.`
    : '';
}

function methodText(event, metadata) {
  if (event.action === 'control.click') return metadata.pointer_type === 'touch' ? 'Touched' : 'Clicked';
  return 'Interacted with';
}

export function describeInteraction(event) {
  const metadata = event.metadata ?? event;
  const element = elementDetails(event);
  const outcome = isNeutralAuthMilestone(event) ? AUTH_OUTCOMES[event.action] : null;
  if (outcome) return outcome;
  if (isAuthOtpAction(event.action)) return 'Ignored an invalid authentication milestone.';
  if (isSensitiveAuthInteraction(event)) return 'Ignored a sensitive authentication interaction.';

  if (event.action === 'page.loaded' && element?.type === 'page') {
    return element.semantic ? `Opened ${element.phrase}.` : 'Opened an unlabelled page.';
  }

  if (event.action === 'field.focus.auto' && element?.type === 'field') {
    return `Automatically focused ${element.phrase}.`;
  }
  if (event.action?.startsWith('field.focus.') && element?.type === 'field') {
    const origin = event.action.slice('field.focus.'.length);
    const suffix = origin === 'pointer' && metadata.pointer_type && metadata.pointer_type !== 'unknown'
      ? ` using a ${metadata.pointer_type}`
      : origin === 'keyboard' ? ' using a keyboard' : '';
    return `Focused ${element.phrase}${suffix}.`;
  }

  const dwell = Number.isInteger(metadata.duration_ms) ? metadata.duration_ms : null;
  const keyPresses = Number.isInteger(metadata.key_press_count) ? metadata.key_press_count : null;
  const valueLength = Number.isInteger(metadata.value_length) ? metadata.value_length : null;
  const editCount = Number.isInteger(metadata.edit_count) ? metadata.edit_count : 0;
  const pasteCount = Number.isInteger(metadata.paste_count) ? metadata.paste_count : 0;
  const changed = (keyPresses ?? 0) > 0 || editCount > 0 || pasteCount > 0;

  if (event.action === 'field.blur' && element?.type === 'field' && !changed) {
    const duration = dwell === null ? '' : ` for ${durationText(dwell)}`;
    return `Focused ${element.phrase}${duration} without changing it.${exitText(metadata)}`;
  }
  if (event.action === 'field.blur' && element?.type === 'field' && keyPresses !== null && keyPresses > 0) {
    const duration = dwell === null ? '' : `After dwelling for ${durationText(dwell)}, `;
    return `${duration}typed ${keyPresses} character${keyPresses === 1 ? '' : 's'} in ${element.phrase} using a keyboard.${exitText(metadata)}`;
  }
  if (event.action === 'field.blur' && element?.type === 'field' && changed) {
    const duration = dwell === null ? '' : ` after focusing it for ${durationText(dwell)}`;
    if (valueLength !== null && valueLength > 0) {
      return `Entered ${valueLength} character${valueLength === 1 ? '' : 's'} in ${element.phrase}${duration} without recorded key presses.${exitText(metadata)}`;
    }
    return `Changed ${element.phrase}${duration} without recorded key presses.${exitText(metadata)}`;
  }
  if (event.action === 'flow.submit' && element?.type === 'form') return `Submitted ${element.phrase}.`;
  if (event.action === 'error.invalid' && element?.type === 'field') return `Encountered a validation error on ${element.phrase}.`;
  if (event.action === 'control.tab' && element) return `Tabbed from ${element.phrase} using a keyboard.`;

  if (element) {
    const method = methodText(event, metadata);
    const pointer = metadata.pointer_type && metadata.pointer_type !== 'unknown' ? ` using a ${metadata.pointer_type}` : '';
    return `${method} ${element.phrase}${pointer}.`;
  }

  const label = String(event.element_key ?? 'unknown').replace(/[._:-]+/g, ' ').trim();
  return `Interacted with ${event.role || 'element'} “${label || 'unknown'}”.`;
}
