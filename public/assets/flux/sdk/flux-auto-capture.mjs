import { installFluxBrowserTag } from './flux-browser.mjs';

const tag = installFluxBrowserTag(window);
const CONSENT_KEY = 'flux.behaviour.consent';
let lastPointerType = 'unknown';
const focusState = new WeakMap();

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
  banner.innerHTML = `<div class="govuk-width-container"><div class="govuk-grid-row"><div class="govuk-grid-column-two-thirds"><h2 class="govuk-heading-m">Help improve this service</h2><p class="govuk-body">With your consent, Flux Behaviour records interaction metadata such as navigation, timing and character counts. It never records what you type or identifies you directly.</p><button type="button" class="govuk-button" data-flux-consent="yes">Accept behavioural analytics</button> <button type="button" class="govuk-button govuk-button--secondary" data-flux-consent="no">Reject</button></div></div></div>`;
  document.body.prepend(banner);
  banner.addEventListener('click', (event) => {
    const decision = event.target?.dataset?.fluxConsent;
    if (!decision) return;
    localStorage.setItem(CONSENT_KEY, decision);
    banner.remove();
    if (decision === 'yes') { window.flux('consent', 'granted'); instrument(); }
  });
}

function instrument() {
  window.flux('event', 'nav', 'page.loaded', { role: 'page', element_key: pageKey() });
  document.addEventListener('pointerdown', (event) => { lastPointerType = event.pointerType || 'mouse'; }, true);
  document.addEventListener('click', (event) => trackClick(event), true);
  document.addEventListener('keydown', (event) => { if (event.key === 'Tab') trackTab(event); }, true);
  document.addEventListener('focusin', (event) => beginFocus(event), true);
  document.addEventListener('keydown', (event) => countTyping(event), true);
  document.addEventListener('focusout', (event) => endFocus(event), true);
}

function trackClick(event) {
  const target = targetDetails(event.target);
  if (!target) return;
  window.flux('event', 'nav', 'control.click', { ...target, pointer_type: lastPointerType, interaction_type: lastPointerType === 'touch' ? 'touch' : 'click' });
}

function trackTab(event) {
  const target = targetDetails(event.target);
  if (target) window.flux('event', 'nav', 'control.tab', { ...target, pointer_type: 'keyboard', interaction_type: 'tab' });
}

function beginFocus(event) {
  const target = editableTarget(event.target);
  if (!target) return;
  focusState.set(event.target, { startedAt: performance.now(), keyPressCount: 0, edits: 0, target });
  event.target.addEventListener('input', () => { const state = focusState.get(event.target); if (state) state.edits += 1; }, { once: true });
}

function countTyping(event) {
  const state = focusState.get(event.target);
  if (state && event.key.length === 1) state.keyPressCount += 1;
}

function endFocus(event) {
  const state = focusState.get(event.target);
  if (!state) return;
  focusState.delete(event.target);
  window.flux('event', 'input', 'field.blur', { ...state.target, duration_ms: Math.round(performance.now() - state.startedAt), key_press_count: state.keyPressCount, edit_count: state.edits, value_length: typeof event.target.value === 'string' ? event.target.value.length : 0, pointer_type: lastPointerType, interaction_type: 'input' });
}

function targetDetails(element) {
  const target = element?.closest?.('a,button,input,select,textarea,[role="button"],[tabindex]');
  const key = stableKey(target);
  if (!target || !key) return null;
  return { role: target.matches('input,select,textarea') ? 'field' : target.matches('form') ? 'form' : 'control', element_key: key };
}

function editableTarget(element) { const key = stableKey(element); return element?.matches?.('input:not([type="hidden"]),textarea,select') && key ? { role: 'field', element_key: key } : null; }
function stableKey(element) { return typeof element?.dataset?.fluxKey === 'string' && /^[A-Za-z0-9._:-]{1,120}$/.test(element.dataset.fluxKey) ? element.dataset.fluxKey : null; }
function pageKey() { return location.pathname.replace(/[^A-Za-z0-9._:-]+/g, '-').replace(/^-|-$/g, '') || 'home'; }
