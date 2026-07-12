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
      metadata: { pointer_type: 'mouse' },
    }),
    'Clicked the Codes tab using a mouse.',
  );
});

test('does not treat pasted or autofilled content as an untouched field', () => {
  assert.equal(
    describeInteraction({
      event_class: 'input',
      action: 'field.blur',
      role: 'field',
      element_key: 'field.analysis.code-retrieval',
      metadata: { duration_ms: 1400, key_press_count: 0, value_length: 7, edit_count: 1, paste_count: 1 },
    }),
    'Entered 7 characters in the Code retrieval field after focusing it for 1.4s without recorded key presses.',
  );
});

test('keeps positional fallback form keys generic', () => {
  assert.equal(
    describeInteraction({
      event_class: 'nav',
      action: 'flow.submit',
      role: 'form',
      element_key: 'form.page.projects.1',
      metadata: {},
    }),
    'Submitted an unlabelled form.',
  );
});

test('requires the neutral OTP service event shape before claiming an outcome', () => {
  assert.equal(
    describeInteraction({
      event_class: 'input',
      action: 'auth.otp.succeeded',
      role: 'field',
      element_key: 'field.auth.otp',
      metadata: { value_length: 6 },
    }),
    'Ignored an invalid authentication milestone.',
  );
});

test('rejects metadata-bearing OTP milestones without narrating their metadata', () => {
  assert.equal(
    describeInteraction({
      event_class: 'trust',
      action: 'auth.otp.succeeded',
      role: 'service',
      element_key: 'auth.otp',
      metadata: { value_length: 6 },
    }),
    'Ignored an invalid authentication milestone.',
  );
});

test('does not treat an unchanged prefilled value as visitor input', () => {
  assert.equal(
    describeInteraction({
      event_class: 'input',
      action: 'field.blur',
      role: 'field',
      element_key: 'field.analysis.code-retrieval',
      metadata: { duration_ms: 1400, key_press_count: 0, value_length: 12, edit_count: 0, paste_count: 0 },
    }),
    'Dwelled on the Code retrieval field for 1.4s without changing it.',
  );
});

test('keeps URL-derived page fallbacks generic', () => {
  assert.equal(
    describeInteraction({
      event_class: 'nav',
      action: 'page.loaded',
      role: 'page',
      element_key: 'auto.page.page.john-smith',
      metadata: {},
    }),
    'Opened an unlabelled page.',
  );
});

test('keeps legacy hyphenated page keys generic', () => {
  assert.equal(
    describeInteraction({
      event_class: 'nav',
      action: 'page.loaded',
      role: 'page',
      element_key: 'page-john-smith',
      metadata: {},
    }),
    'Interacted with page “page john smith”.',
  );
});

test('defensively ignores authentication form submits', () => {
  assert.equal(
    describeInteraction({
      event_class: 'nav',
      action: 'flow.submit',
      role: 'form',
      element_key: 'form.auth.otp-verify',
      metadata: {},
    }),
    'Ignored a sensitive authentication interaction.',
  );
});

test('defensively ignores authentication control interactions', () => {
  assert.equal(
    describeInteraction({
      event_class: 'nav',
      action: 'control.click',
      role: 'control',
      element_key: 'button.auth.verify-code',
      metadata: { pointer_type: 'mouse' },
    }),
    'Ignored a sensitive authentication interaction.',
  );
});

test('defensively ignores misuse of the reserved authentication key', () => {
  assert.equal(
    describeInteraction({
      event_class: 'nav',
      action: 'control.click',
      role: 'control',
      element_key: 'auth.otp',
      metadata: { pointer_type: 'mouse' },
    }),
    'Ignored a sensitive authentication interaction.',
  );
});

test('defensively ignores nested authentication scopes', () => {
  assert.equal(
    describeInteraction({
      event_class: 'nav',
      action: 'control.click',
      role: 'control',
      element_key: 'control.navigation.Auth.verify',
      metadata: {},
    }),
    'Ignored a sensitive authentication interaction.',
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
    'Tabbed from the Projects link using a keyboard.',
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
    'Dwelled on the Code retrieval field for 1.4s without changing it. Focus left using a mouse.',
  );
});

test('describes actual field input with purpose and privacy-safe typing detail', () => {
  assert.equal(
    describeInteraction({
      event_class: 'input',
      action: 'field.blur',
      role: 'field',
      element_key: 'field.analysis.code-retrieval',
      metadata: {
        duration_ms: 15_200,
        dwell_before_input_ms: 2_200,
        typing_duration_ms: 12_500,
        key_press_count: 56,
        backspace_count: 4,
        chars_per_minute: 269,
        paste_count: 1,
        revisit_count: 2,
        value_length: 52,
        pointer_type: 'mouse',
      },
    }),
    'After dwelling for 2.2s without interacting, typed 56 characters in the Code retrieval field over 12.5s at 269 characters per minute. Used Backspace or Delete 4 times and pasted once. This was the second visit to the field. Focus left using a mouse.',
  );
});

test('describes legacy typed events as total focus time rather than dwell', () => {
  assert.equal(
    describeInteraction({
      event_class: 'input',
      action: 'field.blur',
      role: 'field',
      element_key: 'field.project.objective-editor',
      metadata: { duration_ms: 15_200, key_press_count: 56, pointer_type: 'mouse' },
    }),
    'Typed 56 characters in the Objective editor field while it was focused for 15.2s. Focus left using a mouse.',
  );
});

test('describes automatic focus and the Add Objective text area without implementation identifiers', () => {
  assert.equal(
    describeInteraction({
      event_class: 'focus',
      action: 'field.focus.auto',
      role: 'field',
      element_key: 'field.project.add-objective-textarea',
      metadata: {},
    }),
    'Automatically focused the Add objective text area.',
  );
  assert.equal(
    describeInteraction({
      event_class: 'input',
      action: 'field.blur',
      role: 'field',
      element_key: 'field.project.add-objective-textarea',
      metadata: {
        duration_ms: 28800,
        dwell_before_input_ms: 1400,
        typing_duration_ms: 26000,
        key_press_count: 101,
        chars_per_minute: 233,
        value_length: 101,
        pointer_type: 'mouse',
      },
    }),
    'After dwelling for 1.4s without interacting, typed 101 characters in the Add objective text area over 26s at 233 characters per minute. Focus left using a mouse.',
  );
});

test('never exposes generated auto keys or repeated HTML control names', () => {
  assert.equal(
    describeInteraction({
      event_class: 'nav',
      action: 'control.click',
      role: 'control',
      element_key: 'auto.button.button.37',
      metadata: { pointer_type: 'mouse' },
    }),
    'Clicked an unlabelled button using a mouse.',
  );
  assert.equal(
    describeInteraction({
      event_class: 'input',
      action: 'field.blur',
      role: 'field',
      element_key: 'auto.textarea.textarea.38',
      metadata: { duration_ms: 28800, key_press_count: 101, pointer_type: 'mouse' },
    }),
    'Typed 101 characters in an unlabelled text area while it was focused for 28.8s. Focus left using a mouse.',
  );
});

test('preserves help-seeking meaning for generated disclosure keys', () => {
  assert.equal(
    describeInteraction({
      event_class: 'assist',
      action: 'assist.help',
      role: 'control',
      element_key: 'auto.details.12',
      metadata: {},
    }),
    'Opened help from an unlabelled disclosure.',
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
