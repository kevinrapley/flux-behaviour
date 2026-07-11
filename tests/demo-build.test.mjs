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
    const playground = readFileSync(join(outputRoot, 'playground/index.html'), 'utf8');

    assert.match(index, /govuk-template/);
    assert.match(index, /window\.flux/);
    assert.match(index, /data-flux-endpoint/);

    assert.match(journey, /govuk-cookie-banner/);
    assert.match(journey, /flux-consent-accept/);
    assert.match(journey, /data-flux-field="full-name"/);
    assert.match(journey, /flux-event-log/);

    assert.match(dashboard, /Live ResearchOps journeys/);
    assert.match(dashboard, /data-flux-live-analytics/);
    assert.match(dashboard, /assets\/flux\/dashboard\/live-dashboard\.mjs/);

    assert.match(playground, /playground-score-bars/);
    assert.match(playground, /playground-score-lines/);
    assert.match(playground, /flux-playground-config/);
    assert.match(playground, /"neutral":\s*50/);
    assert.match(playground, /Efficiency/);
    assert.match(playground, /never be read as judgements/i);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('production runtime assets are sourced and copied as part of the demo build', () => {
  const source = readFileSync('src/sdk/flux-auto-capture.mjs', 'utf8');
  const browser = readFileSync('src/sdk/flux-browser.mjs', 'utf8');
  const copy = readFileSync('scripts/demo/copy-demo-assets.mjs', 'utf8');
  const outputRoot = mkdtempSync(join(tmpdir(), 'flux-assets-'));

  try {
    execFileSync(process.execPath, ['scripts/demo/copy-demo-assets.mjs', outputRoot]);
    const copiedCapture = readFileSync(join(outputRoot, 'assets/flux/sdk/flux-auto-capture.mjs'), 'utf8');
    const copiedDashboard = readFileSync(join(outputRoot, 'assets/flux/dashboard/live-dashboard.mjs'), 'utf8');

    assert.match(source, /key_press_count/);
    assert.match(source, /backspace_count/);
    assert.match(source, /fluxKey/);
    assert.match(source, /auto\.\$\{kind\}/);
    assert.match(source, /one-time-code/);
    assert.match(source, /removeEventListener\('input', state\.onInput\)/);
    assert.match(source, /edit\.paste/);
    assert.match(source, /field\.revisit/);
    assert.match(source, /flow\.submit/);
    assert.match(source, /assist\.help/);
    assert.match(browser, /persistentVisitorId/);
    assert.match(browser, /persistentSessionId/);
    assert.match(copy, /src\/dashboard/);
    assert.equal(copiedCapture, source);
    assert.match(copiedDashboard, /api\/dashboard\/researchops/);
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
