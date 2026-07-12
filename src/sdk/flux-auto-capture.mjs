import { installFluxBrowserTag } from './flux-browser.mjs';

const CONSENT_KEY = 'flux.behaviour.consent';
const tag = installFluxBrowserTag(window);
const focusState = new WeakMap();
const fieldVisits = new Map();
const recentClicks = [];
const SAFE_ROLES = new Set(['field', 'form', 'control', 'page', 'service', 'environment']);
let lastPointerType = 'unknown';

if (localStorage.getItem(CONSENT_KEY) === 'yes') {
  window.flux('consent', 'granted');
  instrument();
} else if (localStorage.getItem(CONSENT_KEY) !== 'no') {
  showConsentBanner();
}

function showConsentBanner() {
  const banner = document.createElement('section');
  banner.className = 'govuk-cookie-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Behavioural analytics consent');
  banner.innerHTML = '<div class="govuk-width-container"><div class="govuk-grid-row"><div class="govuk-grid-column-two-thirds"><h2 class="govuk-heading-m">Help improve this service</h2><p class="govuk-body">With your consent, Flux Behaviour records interaction metadata such as navigation, timing and character counts. It never records what you type or identifies you directly.</p><button type="button" class="govuk-button" data-flux-consent="yes">Accept behavioural analytics</button> <button type="button" class="govuk-button govuk-button--secondary" data-flux-consent="no">Reject</button></div></div></div>';
  document.body.prepend(banner);
  banner.addEventListener('click', (event) => {
    const decision = event.target?.dataset?.fluxConsent;
    if (!decision) return;
    localStorage.setItem(CONSENT_KEY, decision);
    banner.remove();
    if (decision === 'yes') {
      window.flux('consent', 'granted');
      instrument();
    }
  });
}

function instrument() {
  window.flux('event', 'nav', 'page.loaded', { role: 'page', element_key: pageKey() });
  document.addEventListener('pointerdown', (event) => { lastPointerType = event.pointerType || 'mouse'; }, true);
  document.addEventListener('click', trackClick, true);
  document.addEventListener('keydown', trackKeyboard, true);
  document.addEventListener('paste', trackPaste, true);
  document.addEventListener('focusin', beginFocus, true);
  document.addEventListener('focusout', endFocus, true);
  document.addEventListener('submit', trackSubmit, true);
  document.addEventListener('invalid', trackInvalid, true);
  document.addEventListener('toggle', trackHelp, true);
}

function trackClick(event) {
  const target = targetDetails(event.target);
  if (!target) return;
  window.flux('event', 'nav', 'control.click', {
    ...target,
    pointer_type: lastPointerType
  });
  recordRage(target);
}

function trackKeyboard(event) {
  if (event.key === 'Tab') {
    const target = targetDetails(event.target);
    if (target) window.flux('event', 'nav', 'control.tab', { ...target, pointer_type: 'keyboard' });
  }
  const state = focusState.get(event.target);
  const details = targetDetails(event.target);
  if (details && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') window.flux('event', 'kbd', 'edit.undo', details);
  if (details && (event.metaKey || event.ctrlKey) && ['a', 'c', 'x', 'f'].includes(event.key.toLowerCase())) window.flux('event', 'kbd', 'act.shortcut', details);
  if (!state) return;
  if (event.key.length === 1) state.keyPressCount += 1;
  if (event.key === 'Backspace') state.backspaceCount += 1;
}

function trackPaste(event) {
  const state = focusState.get(event.target);
  const details = state?.target ?? editableTarget(event.target);
  if (!details) return;
  if (state) state.pasteCount += 1;
  window.flux('event', 'input', 'edit.paste', details);
}

function beginFocus(event) {
  const target = editableTarget(event.target);
  if (!target) return;
  const previous = focusState.get(event.target);
  if (previous?.onInput) event.target.removeEventListener('input', previous.onInput);
  const revisitCount = (fieldVisits.get(target.element_key) ?? 0) + 1;
  fieldVisits.set(target.element_key, revisitCount);
  if (revisitCount > 1) window.flux('event', 'input', 'field.revisit', { ...target, revisit_count: revisitCount });
  const state = { startedAt: performance.now(), keyPressCount: 0, backspaceCount: 0, edits: 0, pasteCount: 0, revisitCount, target, onInput: null };
  state.onInput = () => {
    const current = focusState.get(event.target);
    if (current === state) current.edits += 1;
  };
  focusState.set(event.target, state);
  event.target.addEventListener('input', state.onInput);
}

function endFocus(event) {
  const state = focusState.get(event.target);
  if (!state) return;
  focusState.delete(event.target);
  event.target.removeEventListener('input', state.onInput);
  const changed = state.keyPressCount > 0 || state.edits > 0 || state.pasteCount > 0;
  window.flux('event', 'input', 'field.blur', {
    ...state.target,
    duration_ms: Math.round(performance.now() - state.startedAt),
    key_press_count: state.keyPressCount,
    backspace_count: state.backspaceCount,
    edit_count: state.edits,
    paste_count: state.pasteCount,
    chars_per_minute: state.keyPressCount > 0 ? Math.min(2000, Math.round((state.keyPressCount * 60000) / Math.max(1, performance.now() - state.startedAt))) : 0,
    revisit_count: state.revisitCount,
    ...(changed ? { value_length: typeof event.target.value === 'string' ? event.target.value.length : 0 } : {}),
    pointer_type: lastPointerType
  });
}

function trackSubmit(event) {
  const target = event.target?.matches?.('form') ? event.target : null;
  if (!target || isSensitiveForm(target)) return;
  window.flux('event', 'nav', 'flow.submit', { role: 'form', element_key: formKey(target) });
}

function trackInvalid(event) {
  const target = editableTarget(event.target);
  if (target) window.flux('event', 'input', 'error.invalid', target);
}

function trackHelp(event) {
  const target = event.target;
  if (target?.matches?.('details[open]')) window.flux('event', 'assist', 'assist.help', { role: 'control', element_key: detailsKey(target) });
}

function recordRage(target) {
  const now = performance.now();
  recentClicks.push({ key: target.element_key, at: now });
  while (recentClicks.length && now - recentClicks[0].at > 700) recentClicks.shift();
  if (recentClicks.filter((click) => click.key === target.element_key).length === 3) window.flux('event', 'nav', 'act.rage', target);
}

function targetDetails(element) {
  const target = element?.closest?.('a,button,input,select,textarea,[role="button"],[tabindex]');
  if (isExcludedSensitiveInput(target)) return null;
  const key = stableKey(target);
  if (!target || !key) return null;
  return { role: semanticRole(target, target.matches('input,select,textarea') ? 'field' : 'control'), element_key: key };
}

function editableTarget(element) {
  if (isExcludedSensitiveInput(element)) return null;
  const key = stableKey(element);
  return element?.matches?.('input:not([type="hidden"]),textarea,select') && key ? { role: semanticRole(element, 'field'), element_key: key } : null;
}

function isExcludedSensitiveInput(element) {
  if (element?.dataset?.fluxSensitive === 'true') return true;
  if (!element?.matches?.('input')) return false;
  const type = (element.type || 'text').toLowerCase();
  const autocomplete = (element.autocomplete || '').toLowerCase();
  return ['password', 'email', 'tel'].includes(type) || ['one-time-code', 'current-password', 'new-password'].includes(autocomplete);
}

function isSensitiveForm(form) {
  if (form?.dataset?.fluxSensitive === 'true') return true;
  if (/^form\.auth(?:[.:-]|$)/.test(form?.dataset?.fluxKey ?? '')) return true;
  return Boolean(form?.querySelector?.('[data-flux-sensitive="true"],input[type="password"],input[type="email"],input[type="tel"],input[autocomplete="one-time-code"],input[autocomplete="current-password"],input[autocomplete="new-password"]'));
}

function semanticRole(element, fallback) {
  const declared = element?.dataset?.fluxRole;
  return SAFE_ROLES.has(declared) ? declared : fallback;
}

function stableKey(element) {
  if (typeof element?.dataset?.fluxKey === 'string' && /^[A-Za-z0-9._:-]{1,120}$/.test(element.dataset.fluxKey)) {
    return element.dataset.fluxKey;
  }
  if (!element?.matches?.('a,button,input,select,textarea,[role="button"],[tabindex]')) return null;
  const controls = [...document.querySelectorAll('a,button,input,select,textarea,[role="button"],[tabindex]')];
  const position = controls.indexOf(element);
  if (position < 0) return null;
  const kind = element.tagName.toLowerCase();
  const type = typeof element.type === 'string' && /^[a-z]+$/i.test(element.type) ? `.${element.type.toLowerCase()}` : '';
  return `auto.${kind}${type}.${position + 1}`;
}

function formKey(form) {
  const declared = stableKey(form);
  if (declared) return declared;
  const position = [...document.forms].indexOf(form);
  return `form.${pageKey()}.${Math.max(0, position) + 1}`;
}

function detailsKey(details) {
  const position = [...document.querySelectorAll('details')].indexOf(details);
  return `auto.details.${Math.max(0, position) + 1}`;
}

function pageKey() {
  const declared = document.body?.dataset?.fluxPage;
  if (typeof declared === 'string' && /^[A-Za-z0-9._:-]{1,120}$/.test(declared)) return declared;
  const key = location.pathname.replace(/[^A-Za-z0-9._:-]+/g, '-').replace(/^-|-$/g, '');
  return `auto.page.${key || 'home'}`;
}
