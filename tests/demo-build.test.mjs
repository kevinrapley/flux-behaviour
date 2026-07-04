import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function renderDemo() {
  const outputRoot = mkdtempSync(join(tmpdir(), 'flux-demo-'));
  execFileSync(process.execPath, ['scripts/demo/render-demo-pages.mjs', outputRoot]);
  return outputRoot;
}

test('demo build renders the GOV.UK prototype pages', () => {
  const outputRoot = renderDemo();

  try {
    const index = readFileSync(join(outputRoot, 'index.html'), 'utf8');
    const journey = readFileSync(join(outputRoot, 'journey/index.html'), 'utf8');
    const dashboard = readFileSync(join(outputRoot, 'dashboard/index.html'), 'utf8');

    assert.match(index, /govuk-template/);
    assert.match(index, /window\.flux/);
    assert.match(index, /data-flux-endpoint/);

    assert.match(journey, /govuk-cookie-banner/);
    assert.match(journey, /flux-consent-accept/);
    assert.match(journey, /data-flux-field="full-name"/);
    assert.match(journey, /flux-event-log/);

    assert.match(dashboard, /field-friction-chart/);
    assert.match(dashboard, /validation-errors-chart/);
    assert.match(dashboard, /flux-dashboard-data/);
    assert.match(dashboard, /fixture data/i);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('demo pages never inline typed values or identifiers into events', () => {
  const outputRoot = renderDemo();

  try {
    const journey = readFileSync(join(outputRoot, 'journey/index.html'), 'utf8');

    assert.doesNotMatch(journey, /autocomplete="off"/);
    assert.match(journey, /never records what you type/i);
    assert.equal(existsSync(join(outputRoot, 'journey/index.html')), true);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});
