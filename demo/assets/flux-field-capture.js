// Rich field-level capture for the demo pages. Everything measured here is
// interaction metadata: counts, timings and input methods. Key identity is
// reduced to "printable", "backspace/delete" or "other" — which keys were
// pressed is never recorded, so no content can be reconstructed.

const TYPING_GAP_LIMIT_MS = 2000;

export function computeCharsPerMinute(printableCount, typingMs) {
  if (printableCount < 2 || typingMs <= 0) return 0;
  return Math.min(Math.round(printableCount / (typingMs / 60000)), 2000);
}

export function createFieldCapture(emit) {
  const fields = new Map();
  let lastInputMethod = 'unknown';

  function fieldState(key) {
    if (!fields.has(key)) {
      fields.set(key, {
        focusCount: 0,
        editCount: 0,
        keyPressCount: 0,
        backspaceCount: 0,
        pasteCount: 0,
        printableCount: 0,
        typingMs: 0,
        lastKeyAt: null,
        focusedAt: null
      });
    }
    return fields.get(key);
  }

  return {
    // Input-method tracking listens document-wide so the *next* focus knows
    // whether it came from a pointer or the keyboard.
    recordPointer(pointerType) {
      lastInputMethod = ['mouse', 'pen', 'touch'].includes(pointerType) ? pointerType : 'unknown';
    },

    recordNavigationKey() {
      lastInputMethod = 'keyboard';
    },

    focus(key) {
      const state = fieldState(key);
      state.focusCount += 1;
      state.focusedAt = performance.now();

      emit('focus', 'field.focus', {
        role: 'field',
        element_key: key,
        pointer_type: lastInputMethod,
        revisit_count: Math.min(Math.max(state.focusCount - 1, 0), 1000)
      });
    },

    keydown(key, domKey) {
      const state = fieldState(key);
      const now = performance.now();
      state.keyPressCount += 1;

      if (domKey === 'Backspace' || domKey === 'Delete') {
        state.backspaceCount += 1;
      } else if (domKey && domKey.length === 1) {
        state.printableCount += 1;
        if (state.lastKeyAt !== null) {
          const gap = now - state.lastKeyAt;
          if (gap > 0 && gap < TYPING_GAP_LIMIT_MS) {
            state.typingMs += gap;
          }
        }
      }

      state.lastKeyAt = now;
    },

    input(key) {
      fieldState(key).editCount += 1;
    },

    paste(key) {
      const state = fieldState(key);
      state.pasteCount += 1;

      emit('clipboard', 'field.paste', {
        role: 'field',
        element_key: key,
        paste_count: Math.min(state.pasteCount, 100)
      });
    },

    blur(key, valueLength) {
      const state = fieldState(key);
      const durationMs = state.focusedAt === null
        ? 0
        : Math.round(performance.now() - state.focusedAt);
      state.focusedAt = null;
      state.lastKeyAt = null;

      const details = {
        role: 'field',
        element_key: key,
        duration_ms: Math.min(durationMs, 3600000),
        edit_count: Math.min(state.editCount, 10000),
        key_press_count: Math.min(state.keyPressCount, 10000),
        backspace_count: Math.min(state.backspaceCount, 10000),
        chars_per_minute: computeCharsPerMinute(state.printableCount, state.typingMs),
        revisit_count: Math.min(Math.max(state.focusCount - 1, 0), 1000)
      };

      if (typeof valueLength === 'number') {
        details.value_length = Math.min(valueLength, 10000);
      }

      emit('input', 'field.blur', details);
    }
  };
}

// Wire the capture to every element carrying data-flux-field under root.
export function instrumentFields(root, emit) {
  const capture = createFieldCapture(emit);

  root.addEventListener('pointerdown', (event) => capture.recordPointer(event.pointerType));
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') capture.recordNavigationKey();
    const key = event.target?.dataset?.fluxField;
    if (key) capture.keydown(key, event.key);
  });
  root.addEventListener('focusin', (event) => {
    const key = event.target?.dataset?.fluxField;
    if (key) capture.focus(key);
  });
  root.addEventListener('focusout', (event) => {
    const key = event.target?.dataset?.fluxField;
    if (!key) return;
    const value = event.target?.value;
    capture.blur(key, typeof value === 'string' ? value.length : undefined);
  });
  root.addEventListener('input', (event) => {
    const key = event.target?.dataset?.fluxField;
    if (key) capture.input(key);
  });
  root.addEventListener('paste', (event) => {
    const key = event.target?.dataset?.fluxField;
    if (key) capture.paste(key);
  });

  return capture;
}
