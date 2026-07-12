import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync('src/sdk/flux-auto-capture.mjs', 'utf8')
  .replace(/^import .*?;\n/gmu, '');

function storage() {
  const values = new Map([['flux.behaviour.consent', 'yes']]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function field(value = '') {
  const listeners = new Map();
  const node = {
    dataset: { fluxKey: 'field.project.objective-editor', fluxRole: 'field' },
    tagName: 'TEXTAREA',
    type: '',
    value,
    closest: (selector) => selector === 'form' || selector.includes('data-flux-sensitive') ? null : node,
    matches: (selector) => selector.includes('textarea'),
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name) => listeners.delete(name),
    dispatchInput: (inputType = 'insertText') => listeners.get('input')?.({ target: node, inputType }),
  };
  return node;
}

function link(key, href = '') {
  const node = {
    dataset: { ...(key ? { fluxKey: key } : {}), fluxRole: 'control' },
    tagName: 'A',
    type: '',
    href,
    getAttribute: (name) => name === 'href' ? href : null,
    setAttribute(name, value) {
      if (name === 'data-flux-key') this.dataset.fluxKey = value;
      if (name === 'data-flux-role') this.dataset.fluxRole = value;
    },
    closest: (selector) => selector === 'form' || selector.includes('data-flux-sensitive') ? null : node,
    matches: (selector) => selector.split(',').some((part) => part.trim() === 'a'),
  };
  return node;
}

function emailField() {
  const node = {
    dataset: { fluxKey: 'field.auth.email', fluxRole: 'field', fluxSensitive: 'true' },
    tagName: 'INPUT',
    type: 'email',
    autocomplete: 'email',
    closest: (selector) => selector.includes('data-flux-sensitive') ? node : selector === 'form' ? null : node,
    matches: (selector) => selector === 'input' || selector.includes('input'),
  };
  return node;
}

function sensitiveInput(type, autocomplete) {
  const node = {
    dataset: { fluxKey: `field.checkout.${autocomplete}`, fluxRole: 'field' },
    tagName: 'INPUT',
    type,
    autocomplete,
    value: 'never exported',
    closest: (selector) => selector === 'form' || selector.includes('data-flux-sensitive') ? null : node,
    matches: (selector) => selector === 'input' || selector.includes('input'),
  };
  return node;
}

function authForm(key) {
  const node = {
    dataset: { fluxKey: key, fluxRole: 'form', fluxSensitive: 'true' },
    tagName: 'FORM',
    closest: () => node,
    matches: (selector) => selector === 'form',
    querySelector: () => ({}),
    querySelectorAll: () => [],
  };
  return node;
}

function otpField() {
  const node = {
    dataset: { fluxKey: 'field.auth.otp-code', fluxRole: 'field', fluxSensitive: 'true' },
    tagName: 'INPUT',
    type: 'text',
    autocomplete: 'one-time-code',
    closest: (selector) => selector === 'form' ? authForm('form.auth.otp-verify') : selector.includes('data-flux-sensitive') ? node : node,
    matches: (selector) => selector === 'input' || selector.includes('input'),
  };
  return node;
}

function harness(analyse) {
  const events = [];
  const clock = { now: 0 };
  const localStorage = storage();
  const document = {
    body: { dataset: { fluxPage: 'page.project-dashboard' }, prepend() {} },
    forms: [],
    addEventListener() {},
    querySelectorAll: () => [],
  };
  const window = {
    document,
    localStorage,
    sessionStorage: storage(),
    location: { pathname: '/pages/project-dashboard/' },
    flux: (...args) => events.push(args),
    fluxWriting: { analyse },
  };
  const context = vm.createContext({
    URL,
    window,
    document,
    localStorage,
    location: window.location,
    performance: { now: () => clock.now },
    installFluxBrowserTag() {},
  });
  vm.runInContext(source, context);
  return { clock, context, events };
}

test('calculates typing speed from analysed word count and active typing time', async () => {
  const { clock, context, events } = harness(async () => ({
    writing_language: 'en-GB',
    word_count: 39,
    spelling_issue_count: 0,
    grammar_issue_count: 0,
    uppercase_letter_count: 8,
    lowercase_letter_count: 192,
    all_caps_word_count: 0,
  }));
  const textarea = field('local content never leaves the page');
  context.textarea = textarea;

  vm.runInContext('beginFocus({ target: textarea });', context);
  clock.now = 3_300;
  vm.runInContext("trackKeyboard({ target: textarea, key: 'x', metaKey: false, ctrlKey: false });", context);
  clock.now = 46_800;
  vm.runInContext("trackKeyboard({ target: textarea, key: 'x', metaKey: false, ctrlKey: false });", context);
  vm.runInContext('endFocus({ target: textarea });', context);
  await new Promise((resolve) => setImmediate(resolve));

  const analysis = events.find((args) => args[2] === 'field.writing-analysis')?.[3];
  assert.equal(analysis.words_per_minute, 54);
  assert.equal(Object.hasOwn(analysis, 'chars_per_minute'), false);
  assert.equal(JSON.stringify(analysis).includes(textarea.value), false);
});

test('emits blur immediately before asynchronous writing analysis completes', async () => {
  let finishAnalysis;
  const { context, events } = harness(() => new Promise((resolve) => { finishAnalysis = resolve; }));
  const textarea = field('local content');
  context.textarea = textarea;
  vm.runInContext('beginFocus({ target: textarea });', context);
  vm.runInContext("trackKeyboard({ target: textarea, key: 'x', metaKey: false, ctrlKey: false });", context);
  vm.runInContext('endFocus({ target: textarea });', context);

  assert.equal(events.some((args) => args[2] === 'field.blur'), true);
  assert.equal(events.some((args) => args[2] === 'field.writing-analysis'), false);
  finishAnalysis({ writing_language: 'en-GB', word_count: 1, spelling_issue_count: 0, grammar_issue_count: 0, uppercase_letter_count: 0, lowercase_letter_count: 5, all_caps_word_count: 0 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(events.some((args) => args[2] === 'field.writing-analysis'), true);
});

test('keeps only the final Tab destination before Enter navigation', () => {
  const { context, events } = harness(async () => ({}));
  const home = link('link.navigation.home');
  const sourcebook = link('link.navigation.sourcebook-environment');
  context.home = home;
  context.sourcebook = sourcebook;

  vm.runInContext("trackKeyboard({ target: home, key: 'Tab', metaKey: false, ctrlKey: false });", context);
  vm.runInContext('beginFocus({ target: sourcebook });', context);
  vm.runInContext("trackKeyboard({ target: sourcebook, key: 'Enter', metaKey: false, ctrlKey: false });", context);
  vm.runInContext('trackClick({ target: sourcebook });', context);

  const journey = events.filter((args) => ['control.tab', 'control.activate'].includes(args[2]));
  assert.deepEqual(journey.map((args) => [args[2], args[3].element_key]), [
    ['control.tab', 'link.navigation.sourcebook-environment'],
    ['control.activate', 'link.navigation.sourcebook-environment'],
  ]);
  assert.equal(journey[1][3].pointer_type, 'keyboard');
  assert.equal(events.some((args) => args[2] === 'control.click'), false);
});

test('records keyboard focus origin for a field reached with Tab', () => {
  const { context, events } = harness(async () => ({}));
  const home = link('link.navigation.home');
  const textarea = field();
  context.home = home;
  context.textarea = textarea;

  vm.runInContext("trackKeyboard({ target: home, key: 'Tab', metaKey: false, ctrlKey: false });", context);
  vm.runInContext('beginFocus({ target: textarea });', context);

  const focus = events.find((args) => args[2] === 'field.focus.keyboard');
  assert.equal(focus?.[3].element_key, 'field.project.objective-editor');
  assert.equal(focus?.[3].pointer_type, 'keyboard');
  vm.runInContext('endFocus({ target: textarea });', context);
  const blur = events.find((args) => args[2] === 'field.blur');
  assert.equal(blur?.[3].pointer_type, 'keyboard');
});

test('does not report Space on a link as activation', () => {
  const { context, events } = harness(async () => ({}));
  const sourcebook = link('link.navigation.sourcebook');
  context.sourcebook = sourcebook;
  vm.runInContext("trackKeyboard({ target: sourcebook, key: ' ', metaKey: false, ctrlKey: false });", context);
  assert.equal(events.some((args) => args[2] === 'control.activate'), false);
});

test('emits only the final Tab destination when typing begins', () => {
  const { context, events } = harness(async () => ({}));
  const home = link('link.navigation.home');
  const textarea = field();
  context.home = home;
  context.textarea = textarea;

  vm.runInContext("trackKeyboard({ target: home, key: 'Tab', metaKey: false, ctrlKey: false });", context);
  vm.runInContext('beginFocus({ target: textarea });', context);
  vm.runInContext("trackKeyboard({ target: textarea, key: 'x', metaKey: false, ctrlKey: false });", context);

  const tabs = events.filter((args) => args[2] === 'control.tab');
  assert.equal(tabs.length, 1);
  assert.equal(tabs[0][3].element_key, 'field.project.objective-editor');
});

test('records ordinary browser autocomplete against the semantic field', () => {
  const { context, events } = harness(async () => ({}));
  const textarea = field('must not leave');
  context.textarea = textarea;

  vm.runInContext("trackAutocomplete({ target: textarea, inputType: 'insertReplacementText' });", context);

  const autocomplete = events.find((args) => args[2] === 'field.autocomplete.used');
  assert.equal(autocomplete?.[3].element_key, 'field.project.objective-editor');
  assert.equal(JSON.stringify(autocomplete).includes(textarea.value), false);
});

test('autocomplete does not turn autofilled content into blur length or writing metadata', async () => {
  let analysisCalls = 0;
  const { context, events } = harness(async () => { analysisCalls += 1; return {}; });
  const textarea = field('autofilled content must remain local');
  context.textarea = textarea;
  vm.runInContext('beginFocus({ target: textarea });', context);
  vm.runInContext("trackAutocomplete({ target: textarea, inputType: 'insertReplacementText' });", context);
  textarea.dispatchInput('insertReplacementText');
  vm.runInContext('endFocus({ target: textarea });', context);
  await new Promise((resolve) => setImmediate(resolve));

  const blur = events.find((args) => args[2] === 'field.blur')?.[3];
  assert.equal(Object.hasOwn(blur, 'value_length'), false);
  assert.equal(events.some((args) => args[2] === 'field.writing-analysis'), false);
  assert.equal(analysisCalls, 0);
});

test('does not analyse an untouched prefilled value', async () => {
  let analysisCalls = 0;
  const { context, events } = harness(async () => { analysisCalls += 1; return {}; });
  const textarea = field('prefilled by the publisher');
  context.textarea = textarea;
  vm.runInContext('beginFocus({ target: textarea }); endFocus({ target: textarea });', context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(analysisCalls, 0);
  assert.equal(events.some((args) => args[2] === 'field.writing-analysis'), false);
});

test('records sensitive browser autocomplete by fixed field category without content or length', () => {
  const { context, events } = harness(async () => ({}));
  const email = emailField();
  email.value = 'must-not-leave@example.test';
  context.email = email;

  vm.runInContext("trackAutocomplete({ target: email, inputType: 'insertReplacementText' });", context);

  const autocomplete = events.find((args) => args[2] === 'field.autocomplete.email.used');
  assert.deepEqual(autocomplete?.slice(0, 3), ['event', 'trust', 'field.autocomplete.email.used']);
  assert.equal(JSON.stringify(autocomplete?.[3]), JSON.stringify({ role: 'service', element_key: 'autocomplete.email' }));
  assert.equal(JSON.stringify(autocomplete).includes(email.value), false);
});

test('captures password, one-time-code, telephone and payment autocompletes as safe categories', () => {
  for (const [type, autocompleteName, category] of [
    ['password', 'current-password', 'password'],
    ['text', 'one-time-code', 'one-time-code'],
    ['tel', 'tel', 'telephone'],
    ['text', 'cc-number', 'payment'],
    ['text', 'section-checkout cc-number', 'payment'],
    ['text', 'section-login one-time-code', 'one-time-code'],
  ]) {
    const { context, events } = harness(async () => ({}));
    const input = sensitiveInput(type, autocompleteName);
    context.input = input;
    vm.runInContext("trackAutocomplete({ target: input, inputType: 'insertReplacementText' });", context);
    const event = events.find((args) => args[2] === `field.autocomplete.${category}.used`);
    assert.equal(event?.[3].element_key, `autocomplete.${category}`);
    assert.equal(JSON.stringify(event).includes(input.value), false);
  }
});

test('does not derive a semantic key from a potentially identifying link URL', () => {
  const { context } = harness(async () => ({}));
  const caseLink = link('', '/cases/kevin-rapley-private-case');
  context.caseLink = caseLink;
  assert.equal(vm.runInContext('semanticFallbackKey(caseLink)', context), null);
});

test('treats a form containing payment autocomplete tokens as sensitive', () => {
  const { context } = harness(async () => ({}));
  const payment = sensitiveInput('text', 'section-checkout cc-number');
  const form = { dataset: {}, querySelector: () => null, querySelectorAll: (selector) => selector === 'input[autocomplete]' ? [payment] : [] };
  context.form = form;
  assert.equal(vm.runInContext('isSensitiveForm(form)', context), true);
});

test('derives safe OTP outcomes from attributed auth journey state', () => {
  const { context, events } = harness(async () => ({}));
  const requestForm = authForm('form.auth.otp-request');
  const verifyForm = authForm('form.auth.otp-verify');
  const code = otpField();
  context.requestForm = requestForm;
  context.verifyForm = verifyForm;
  context.code = code;

  vm.runInContext('trackSubmit({ target: requestForm });', context);
  vm.runInContext('trackSubmit({ target: verifyForm });', context);
  vm.runInContext('beginFocus({ target: code });', context);

  assert.deepEqual(events.filter((args) => args[1] === 'trust').map((args) => args[2]), [
    'auth.otp.requested',
    'auth.otp.failed',
  ]);
});

test('records successful OTP verification after the attributed account page opens', () => {
  const { context, events } = harness(async () => ({}));
  const verifyForm = authForm('form.auth.otp-verify');
  context.verifyForm = verifyForm;

  vm.runInContext('trackSubmit({ target: verifyForm });', context);
  vm.runInContext("document.body.dataset.fluxPage = 'page.account'; resolvePendingOtpSuccess();", context);

  assert.equal(events.some((args) => args[2] === 'auth.otp.succeeded'), true);
});
