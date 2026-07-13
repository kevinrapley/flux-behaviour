import { installFluxBrowserTag } from './flux-browser.mjs';
import '../writing/uk-english-writing-runtime.mjs';

const CONSENT_KEY = 'flux.behaviour.consent';
const tag = installFluxBrowserTag(window);
const focusState = new WeakMap();
const fieldVisits = new Map();
const recentClicks = [];
const SAFE_ROLES = new Set(['field', 'form', 'control', 'page', 'service', 'environment']);
const AUTH_SCOPED_KEY = /(^|[._:-])auth(?=[._:-]|$)/i;
const CONTROL_SELECTOR = 'a,button,input,select,textarea,[role="button"],[tabindex]:not([tabindex^="-"])';
const AUTH_PENDING_KEY = 'flux.behaviour.auth_otp_verification_pending';
const recordedAutocomplete = new WeakMap();
let lastPointerType = 'unknown';
let lastPointer = { target: null, type: 'unknown', at: Number.NEGATIVE_INFINITY };
let awaitingTabDestination = false;
let pendingTabDestination = null;
let lastKeyboardActivation = { target: null, at: Number.NEGATIVE_INFINITY };

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
  banner.innerHTML = '<div class="govuk-width-container"><div class="govuk-grid-row"><div class="govuk-grid-column-two-thirds"><h2 class="govuk-heading-m">Help improve this service</h2><p class="govuk-body">With your consent, Flux Behaviour records interaction metadata such as navigation, timing, typing rate, corrections, browser autocomplete use and possible UK English writing issues. Text and autocomplete values stay in this browser and never leave the page.</p><button type="button" class="govuk-button" data-flux-consent="yes" data-flux-key="button.consent.accept-behavioural-analytics" data-flux-role="control">Accept behavioural analytics</button> <button type="button" class="govuk-button govuk-button--secondary" data-flux-consent="no" data-flux-key="button.consent.reject-behavioural-analytics" data-flux-role="control">Reject</button></div></div></div>';
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
  resolvePendingOtpSuccess();
  window.flux('event', 'nav', 'page.loaded', { role: 'page', element_key: pageKey() });
  document.addEventListener('pointerdown', recordPointer, true);
  document.addEventListener('click', trackClick, true);
  document.addEventListener('keydown', trackKeyboard, true);
  document.addEventListener('paste', trackPaste, true);
  document.addEventListener('focusin', beginFocus, true);
  document.addEventListener('focusout', endFocus, true);
  document.addEventListener('input', trackAutocomplete, true);
  document.addEventListener('change', trackAutocomplete, true);
  document.addEventListener('submit', trackSubmit, true);
  document.addEventListener('invalid', trackInvalid, true);
  document.addEventListener('toggle', trackHelp, true);
}

function recordPointer(event) {
  lastPointerType = event.pointerType || 'mouse';
  lastPointer = { target: event.target, type: lastPointerType, at: performance.now() };
}

function trackClick(event) {
  if (lastKeyboardActivation.target === event.target && performance.now() - lastKeyboardActivation.at <= 1000) return;
  flushPendingTabDestination();
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
    const state = focusState.get(event.target);
    if (state) state.exitPointerType = 'keyboard';
    awaitingTabDestination = true;
    return;
  }
  if (activatesControl(event) && !editableTarget(event.target)) {
    const target = targetDetails(event.target);
    flushPendingTabDestination();
    if (target) {
      lastKeyboardActivation = { target: event.target, at: performance.now() };
      window.flux('event', 'nav', 'control.activate', { ...target, pointer_type: 'keyboard' });
    }
  }
  flushPendingTabDestination();
  const state = focusState.get(event.target);
  const details = targetDetails(event.target);
  if (details && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') window.flux('event', 'kbd', 'edit.undo', details);
  if (details && (event.metaKey || event.ctrlKey) && ['a', 'c', 'x', 'f'].includes(event.key.toLowerCase())) window.flux('event', 'kbd', 'act.shortcut', details);
  if (!state) return;
  if (event.key !== 'Tab') recordFirstInteraction(state);
  if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
    state.keyPressCount += 1;
    recordTyping(state);
  }
  if (event.key === 'Backspace' || event.key === 'Delete') {
    state.backspaceCount += 1;
    recordTyping(state);
  }
}

function activatesControl(event) {
  if (event.key === 'Enter') return true;
  if (event.key !== ' ') return false;
  return Boolean(event.target?.matches?.('button,[role="button"],input[type="button"],input[type="submit"],input[type="reset"]'));
}

function trackPaste(event) {
  const state = focusState.get(event.target);
  const details = state?.target ?? editableTarget(event.target);
  if (!details) return;
  if (state) {
    recordFirstInteraction(state);
    state.pasteCount += 1;
  }
  window.flux('event', 'input', 'edit.paste', details);
}

function trackAutocomplete(event) {
  const target = event.target;
  if (!target?.matches?.('input, select, textarea')) return;
  const now = performance.now();
  if (now - (recordedAutocomplete.get(target) ?? Number.NEGATIVE_INFINITY) < 5000) return;
  let browserAutofill = event.inputType === 'insertReplacementText';
  try {
    browserAutofill ||= target.matches(':-webkit-autofill') || target.matches(':-moz-autofill');
  } catch {
    // Unsupported pseudo-class; InputEvent remains the conservative signal.
  }
  if (!browserAutofill) return;
  recordedAutocomplete.set(target, now);
  const state = focusState.get(target);
  if (state) state.autocompleteHandled = true;
  const details = editableTarget(target);
  if (details) {
    window.flux('event', 'input', 'field.autocomplete.used', details);
    return;
  }
  if (!isExcludedSensitiveInput(target)) return;
  const category = autocompleteCategory(target);
  window.flux('event', 'trust', `field.autocomplete.${category}.used`, {
    role: 'service',
    element_key: `autocomplete.${category}`,
  });
}

function autocompleteCategory(target) {
  const type = String(target?.type || '').toLowerCase();
  const autocomplete = String(target?.autocomplete || '').toLowerCase().split(/\s+/);
  if (type === 'email' || autocomplete.some((token) => ['email', 'username'].includes(token))) return 'email';
  if (type === 'password' || autocomplete.some((token) => ['current-password', 'new-password'].includes(token))) return 'password';
  if (autocomplete.includes('one-time-code')) return 'one-time-code';
  if (type === 'tel' || autocomplete.some((token) => token === 'tel' || token.startsWith('tel-'))) return 'telephone';
  if (autocomplete.some((token) => token.startsWith('cc-'))) return 'payment';
  return 'other';
}

function beginFocus(event) {
  resolveFailedOtpAttempt(event.target);
  const arrivedByTab = awaitingTabDestination;
  if (arrivedByTab) {
    pendingTabDestination = targetDetails(event.target);
    awaitingTabDestination = false;
  }
  const target = editableTarget(event.target);
  if (!target) return;
  const previous = focusState.get(event.target);
  if (previous?.onInput) event.target.removeEventListener('input', previous.onInput);
  const revisitCount = (fieldVisits.get(target.element_key) ?? 0) + 1;
  fieldVisits.set(target.element_key, revisitCount);
  if (revisitCount > 1) window.flux('event', 'input', 'field.revisit', { ...target, revisit_count: revisitCount });
  const now = performance.now();
  const recentPointer = now - lastPointer.at <= 1000;
  let focusOrigin = 'programmatic';
  let pointerType;
  if (arrivedByTab) {
    focusOrigin = 'keyboard';
    pointerType = 'keyboard';
  } else if (recentPointer && (lastPointer.target === event.target || lastPointer.target?.control === event.target)) {
    focusOrigin = 'pointer';
    pointerType = lastPointer.type;
  } else if (event.target?.dataset?.fluxAutofocus === 'true' && recentPointer) {
    focusOrigin = 'auto';
  }
  window.flux('event', 'focus', `field.focus.${focusOrigin}`, {
    ...target,
    ...(pointerType ? { pointer_type: pointerType } : {}),
  });
  const state = { startedAt: performance.now(), firstInteractionAt: null, firstTypingAt: null, lastTypingAt: null, keyPressCount: 0, backspaceCount: 0, edits: 0, pasteCount: 0, revisitCount, target, onInput: null, autocompleteHandled: false, exitPointerType: pointerType ?? null };
  state.onInput = (inputEvent) => {
    const current = focusState.get(event.target);
    if (current === state) {
      if (inputEvent?.inputType === 'insertReplacementText' || current.autocompleteHandled) return;
      recordFirstInteraction(current);
      current.edits += 1;
    }
  };
  focusState.set(event.target, state);
  event.target.addEventListener('input', state.onInput);
}

function flushPendingTabDestination() {
  if (!pendingTabDestination) return;
  window.flux('event', 'nav', 'control.tab', { ...pendingTabDestination, pointer_type: 'keyboard' });
  pendingTabDestination = null;
}

function endFocus(event) {
  const state = focusState.get(event.target);
  if (!state) return;
  focusState.delete(event.target);
  event.target.removeEventListener('input', state.onInput);
  const endedAt = performance.now();
  const durationMs = Math.round(endedAt - state.startedAt);
  const typingDurationMs = state.firstTypingAt === null ? 0 : Math.round(state.lastTypingAt - state.firstTypingAt);
  const changed = state.keyPressCount > 0 || state.edits > 0 || state.pasteCount > 0;
  const details = {
    ...state.target,
    duration_ms: durationMs,
    dwell_before_input_ms: Math.round((state.firstInteractionAt ?? endedAt) - state.startedAt),
    typing_duration_ms: typingDurationMs,
    key_press_count: state.keyPressCount,
    backspace_count: state.backspaceCount,
    edit_count: state.edits,
    paste_count: state.pasteCount,
    revisit_count: state.revisitCount,
    ...(changed ? { value_length: typeof event.target.value === 'string' ? event.target.value.length : 0 } : {}),
    pointer_type: state.exitPointerType ?? lastPointerType
  };
  window.flux('event', 'input', 'field.blur', details);
  const analyser = changed && !state.autocompleteHandled && supportsWritingAnalysis(event.target)
    ? window.fluxWriting?.analyse
    : null;
  if (typeof analyser !== 'function') {
    return;
  }
  const localValue = typeof event.target.value === 'string' ? event.target.value : '';
  void Promise.resolve(analyser(localValue))
    .then((signals) => {
      const writingSignals = safeWritingSignals(signals);
      const wordsPerMinute = typingDurationMs > 0 && state.keyPressCount > 0
        ? Math.min(1000, Math.round(((state.keyPressCount / 5) * 60000) / typingDurationMs))
        : 0;
      window.flux('event', 'input', 'field.writing-analysis', {
        ...state.target,
        ...writingSignals,
        words_per_minute: wordsPerMinute,
      });
    })
    .catch(() => {});
}

function supportsWritingAnalysis(element) {
  if (element?.dataset?.fluxWritingAnalysis === 'false') return false;
  if (element?.tagName === 'TEXTAREA') return true;
  return element?.tagName === 'INPUT' && ['', 'text', 'search'].includes((element.type || 'text').toLowerCase());
}

function safeWritingSignals(value) {
  if (!value || value.writing_language !== 'en-GB') return {};
  const fields = ['word_count', 'spelling_issue_count', 'grammar_issue_count', 'uppercase_letter_count', 'lowercase_letter_count', 'all_caps_word_count'];
  if (!fields.every((field) => Number.isInteger(value[field]) && value[field] >= 0 && value[field] <= 10_000)) return {};
  return Object.fromEntries([['writing_language', 'en-GB'], ...fields.map((field) => [field, value[field]])]);
}

function recordFirstInteraction(state) {
  state.firstInteractionAt ??= performance.now();
}

function recordTyping(state) {
  const now = performance.now();
  state.firstTypingAt ??= now;
  state.lastTypingAt = now;
}

function trackSubmit(event) {
  const target = event.target?.matches?.('form') ? event.target : null;
  if (!target) return;
  const key = target.dataset?.fluxKey;
  if (key === 'form.auth.otp-request') {
    emitAuthMilestone('auth.otp.requested');
    return;
  }
  if (key === 'form.auth.otp-verify') {
    window.sessionStorage?.setItem(AUTH_PENDING_KEY, String(Date.now()));
    return;
  }
  if (isSensitiveForm(target)) return;
  window.flux('event', 'nav', 'flow.submit', { role: 'form', element_key: formKey(target) });
}

function resolveFailedOtpAttempt(target) {
  if (!window.sessionStorage?.getItem(AUTH_PENDING_KEY)) return;
  if (String(target?.autocomplete || '').toLowerCase() !== 'one-time-code') return;
  window.sessionStorage.removeItem(AUTH_PENDING_KEY);
  emitAuthMilestone('auth.otp.failed');
}

function resolvePendingOtpSuccess() {
  if (!window.sessionStorage?.getItem(AUTH_PENDING_KEY)) return;
  if (pageKey() !== 'page.account') return;
  window.sessionStorage.removeItem(AUTH_PENDING_KEY);
  emitAuthMilestone('auth.otp.succeeded');
}

function emitAuthMilestone(action) {
  window.flux('event', 'trust', action, { role: 'service', element_key: 'auth.otp' });
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
  const target = element?.closest?.(CONTROL_SELECTOR);
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
  if (element?.closest?.('[data-flux-sensitive="true"]')) return true;
  if (element?.dataset?.fluxSensitive === 'true') return true;
  if (isSensitiveKey(element?.dataset?.fluxKey)) return true;
  const ownerForm = element?.closest?.('form');
  if (ownerForm && isSensitiveForm(ownerForm)) return true;
  if (!element?.matches?.('input')) return false;
  const type = (element.type || 'text').toLowerCase();
  const autocomplete = autocompleteTokens(element);
  return ['password', 'email', 'tel'].includes(type)
    || autocomplete.some((token) => ['one-time-code', 'current-password', 'new-password'].includes(token) || token.startsWith('cc-'));
}

function autocompleteTokens(element) {
  return String(element?.autocomplete || '').toLowerCase().split(/\s+/).filter(Boolean);
}

function isSensitiveForm(form) {
  if (form?.dataset?.fluxSensitive === 'true') return true;
  if (isSensitiveKey(form?.dataset?.fluxKey)) return true;
  if (form?.querySelector?.('[data-flux-sensitive="true"],input[type="password"],input[type="email"],input[type="tel"]')) return true;
  if ([...(form?.querySelectorAll?.('input[autocomplete]') ?? [])].some((input) => autocompleteTokens(input).some((token) => ['one-time-code', 'current-password', 'new-password'].includes(token) || token.startsWith('cc-')))) return true;
  return [...(form?.querySelectorAll?.('[data-flux-key]') ?? [])].some((element) => isSensitiveKey(element.dataset.fluxKey));
}

function isSensitiveKey(key) {
  return AUTH_SCOPED_KEY.test(key ?? '') || String(key ?? '').toLowerCase() === 'auth.otp';
}

function semanticRole(element, fallback) {
  const declared = element?.dataset?.fluxRole;
  return SAFE_ROLES.has(declared) ? declared : fallback;
}

function stableKey(element) {
  if (typeof element?.dataset?.fluxKey === 'string' && /^[A-Za-z0-9._:-]{1,120}$/.test(element.dataset.fluxKey)) {
    return element.dataset.fluxKey;
  }
  const semanticKey = semanticFallbackKey(element);
  if (semanticKey) {
    element.setAttribute?.('data-flux-key', semanticKey);
    element.setAttribute?.('data-flux-role', semanticControlType(element) === 'field' ? 'field' : 'control');
    return semanticKey;
  }
  if (!element?.matches?.(CONTROL_SELECTOR)) return null;
  const controls = [...document.querySelectorAll(CONTROL_SELECTOR)];
  const position = controls.indexOf(element);
  if (position < 0) return null;
  const kind = element.tagName.toLowerCase();
  const type = typeof element.type === 'string' && /^[a-z]+$/i.test(element.type) ? `.${element.type.toLowerCase()}` : '';
  return `auto.${kind}${type}.${position + 1}`;
}

function semanticFallbackKey(element) {
  const type = semanticControlType(element);
  if (!type) return null;
  if (type === 'link') return null;
  const purpose = semanticSlug(element.id || element.name);
  if (!purpose) return null;
  const scope = pageScope();
  return `${type}.${scope}.${purpose}`.slice(0, 120);
}

function semanticControlType(element) {
  const tag = String(element?.tagName || '').toLowerCase();
  if (tag === 'a') return 'link';
  if (['input', 'select', 'textarea'].includes(tag)) return 'field';
  if (tag === 'button' || element?.matches?.('[role="button"]')) return 'button';
  return null;
}

function pageScope() {
  const declared = document.body?.dataset?.fluxPage;
  return semanticSlug(String(declared || '').replace(/^page\./, '')) || 'page';
}

function semanticSlug(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/g, '')
    .replace(/(^|-)(rec[a-z0-9]{10,}|[a-f0-9]{12,}|\d{4,})(?=-|$)/g, '$1')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
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
