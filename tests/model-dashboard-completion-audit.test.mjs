import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const EXPECTED = [
  ...Array.from({ length: 13 }, (_, index) => `MODEL-${String(index + 1).padStart(2, '0')}`),
  ...Array.from({ length: 10 }, (_, index) => `DASH-${String(index + 1).padStart(2, '0')}`),
  'NLP-01', 'ADAPT-01'
];

test('completion audit classifies every source-grounded roadmap requirement exactly once', () => {
  const audit = readFileSync('docs/product/model-dashboard-completion-audit.md', 'utf8');
  const rows = [...audit.matchAll(/^\| ((?:MODEL|DASH)-\d{2}|NLP-01|ADAPT-01) \| ([^|]+) \|/gm)];
  assert.deepEqual(rows.map((match) => match[1]), EXPECTED);
  assert.equal(new Set(rows.map((match) => match[1])).size, EXPECTED.length);
  for (const [, id, state] of rows) {
    assert.match(state, /Implemented|Partial|Retained|Reframed/, `${id} needs an explicit audit state`);
  }
});

test('audit preserves source coverage, live-evidence limits and owned residual gaps', () => {
  const audit = readFileSync('docs/product/model-dashboard-completion-audit.md', 'utf8');
  const roadmap = readFileSync('docs/product/behaviour-model-dashboard-gap-analysis.md', 'utf8');
  const gaps = readFileSync('gap-register.yaml', 'utf8');
  assert.match(audit, /three Google Analytics screenshots/);
  assert.match(audit, /do not substitute for DPIA, full accessibility/);
  assert.match(audit, /GAP-013: comparable complexity-adjusted/);
  assert.match(audit, /GAP-015: correction-context contract/);
  assert.match(audit, /GAP-016: accountable analytics-to-action layer/);
  assert.match(audit, /GAP-017: RBAC, redaction/);
  for (const id of EXPECTED) assert.match(roadmap, new RegExp(`\\| ${id.replace('-', '\\-')} \\|`));
  for (const id of ['GAP-013', 'GAP-015', 'GAP-016', 'GAP-017']) assert.match(gaps, new RegExp(`id: ${id}`));
});
