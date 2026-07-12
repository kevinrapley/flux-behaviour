import assert from 'node:assert/strict';
import test from 'node:test';

import { describeInteraction } from '../src/product/narrative.mjs';

test('describes privacy-safe authentication milestones as outcomes', () => {
  assert.equal(
    describeInteraction({
      event_class: 'trust',
      action: 'auth.otp.succeeded',
      role: 'service',
      element_key: 'auth.otp',
      metadata: {},
    }),
    'Successfully verified the one-time code and signed in.',
  );
});

test('describes semantic controls using their purpose and control type', () => {
  assert.equal(
    describeInteraction({
      event_class: 'nav',
      action: 'control.click',
      role: 'control',
      element_key: 'tab.journal.codes',
      metadata: { interaction_type: 'click', pointer_type: 'mouse' },
    }),
    'Click the Codes tab, using mouse.',
  );
});

test('describes keyboard tab movement from the control where it began', () => {
  assert.equal(
    describeInteraction({
      event_class: 'nav',
      action: 'control.tab',
      role: 'control',
      element_key: 'link.navigation.projects',
      metadata: { interaction_type: 'tab', pointer_type: 'keyboard' },
    }),
    'Tabbed from the Projects link, using keyboard.',
  );
});

test('describes an untouched field without claiming that the visitor typed', () => {
  assert.equal(
    describeInteraction({
      event_class: 'input',
      action: 'field.blur',
      role: 'field',
      element_key: 'field.analysis.code-retrieval',
      metadata: {
        interaction_type: 'input',
        duration_ms: 1400,
        key_press_count: 0,
        value_length: 0,
        pointer_type: 'mouse',
      },
    }),
    'Focused the Code retrieval field for 1.4s without entering text, using mouse.',
  );
});

test('describes actual field input with purpose, dwell and character count', () => {
  assert.equal(
    describeInteraction({
      event_class: 'input',
      action: 'field.blur',
      role: 'field',
      element_key: 'field.analysis.code-retrieval',
      metadata: { duration_ms: 1400, key_press_count: 8, value_length: 7, pointer_type: 'mouse' },
    }),
    'Typed 8 characters in the Code retrieval field after focusing it for 1.4s, using mouse.',
  );
});

test('describes form submissions and validation errors as journey events', () => {
  assert.equal(
    describeInteraction({ action: 'flow.submit', role: 'form', element_key: 'form.analysis.code-retrieval', metadata: {} }),
    'Submitted the Code retrieval form.',
  );
  assert.equal(
    describeInteraction({ action: 'error.invalid', role: 'field', element_key: 'field.journal.entry-content', metadata: {} }),
    'Encountered a validation error on the Entry content field.',
  );
});

test('describes semantic page loads as page visits', () => {
  assert.equal(
    describeInteraction({
      event_class: 'nav',
      action: 'page.loaded',
      role: 'page',
      element_key: 'page.account.sign-in',
      metadata: {},
    }),
    'Opened the Account sign in page.',
  );
});
