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
    const developers = readFileSync(join(outputRoot, 'developers/index.html'), 'utf8');
    const account = readFileSync(join(outputRoot, 'account/index.html'), 'utf8');
    const admin = readFileSync(join(outputRoot, 'admin/index.html'), 'utf8');

    assert.match(index, /govuk-template/);
    assert.match(index, /window\.flux/);
    assert.match(index, /data-flux-endpoint/);

    assert.match(journey, /govuk-cookie-banner/);
    assert.match(journey, /flux-consent-accept/);
    assert.match(journey, /data-flux-field="full-name"/);
    assert.match(journey, /flux-event-log/);

    assert.match(dashboard, /Audience overview/);
    assert.match(dashboard, /whether visitors come back/);
    assert.match(dashboard, /data-flux-overview/);
    assert.match(dashboard, /data-flux-trend/);
    assert.match(dashboard, /Recent journeys/);
    assert.match(dashboard, /assets\/flux\/dashboard\/live-dashboard\.mjs/);

    assert.match(playground, /playground-score-bars/);
    assert.match(playground, /playground-score-lines/);
    assert.match(playground, /flux-playground-config/);
    assert.match(playground, /"neutral":\s*50/);
    assert.match(playground, /Efficiency/);
    assert.match(playground, /never be read as judgements/i);

    assert.match(developers, /Flux Behaviour developer documentation/);
    assert.match(developers, /data-flux-tenant/);
    assert.match(developers, /data-flux-tag="YOUR_UNIQUE_TAG"/);
    assert.match(developers, /data-flux-role/);
    assert.match(developers, /data-flux-sensitive/);
    assert.match(developers, /POST<\/span> <code>\/api\/collect/);
    assert.match(developers, /Tasks and funnels/);
    assert.match(developers, /schema version <code>1\.2\.0<\/code>/);
    assert.match(developers, /credentials: 'omit'/);
    assert.doesNotMatch(developers, /data-flux-key="jane@example\.com"/);
    assert.match(developers, /These exclusions apply only to automatic capture/);
    assert.match(developers, /localStorage\.setItem\('flux\.behaviour\.consent', 'no'\)/);
    assert.match(developers, /<code>assist\.help<\/code>/);
    assert.match(developers, /at least 3 characters to bind it/);
    assert.match(developers, /Access-Control-Allow-Origin/);
    assert.match(developers, /POST<\/span> <code>\/api\/admin\/tenants/);
    assert.match(developers, /GET<\/span> <code>\/api\/tenant\/:tenant\/installation/);
    assert.match(developers, /ResearchOps legacy installation continues to use/);
    assert.match(developers, /GET|PATCH/);
    assert.match(developers, /<code>\/api\/admin\/tenants\/:tenant<\/code>/);
    assert.match(developers, /<code>\/api\/admin\/tenants\/:tenant\/access<\/code>/);
    assert.match(developers, /<code>\/api\/admin\/tenants\/:tenant\/export\.csv<\/code>/);
    assert.match(developers, /Move tracking to trash/);
    assert.match(developers, /35 days/);

    assert.match(account, /Sign in to Flux Behaviour/);
    assert.match(account, /href="\/api\/auth\/google\/start"/);
    assert.match(account, /href="\/developers\/"/);
    assert.match(account, /href="\/account\/" aria-current="true"/);
    assert.match(account, /verified Google email address/);
    assert.match(account, /provider account identifier/);
    assert.doesNotMatch(account, /No real user data is collected/);

    assert.match(admin, /Tenant administration/);
    assert.match(admin, /Create a new tenant/);
    assert.match(admin, /Property details and allowed origins/);
    assert.match(admin, /Property access/);
    assert.match(admin, /Export aggregate data/);
    assert.match(admin, /Move tracking to trash/);
    assert.match(admin, /assets\/flux\/admin\/tenant-admin\.mjs/);
    assert.match(admin, /href="\/admin\/" aria-current="true"/);
    assert.match(admin, /Account email addresses are used only to manage Flux administration access/);
    assert.doesNotMatch(admin, /No real user data is collected/);
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
    const headers = readFileSync(join(outputRoot, '_headers'), 'utf8');

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
    assert.match(headers, /\/assets\/flux\/\*/);
    assert.match(headers, /Access-Control-Allow-Origin: \*/);
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
