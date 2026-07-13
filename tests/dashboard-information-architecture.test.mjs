import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('dashboard exposes the target report areas with shared URL-backed filters', () => {
  const template = readFileSync('demo/templates/pages/dashboard.njk', 'utf8');
  const dashboard = readFileSync('src/dashboard/live-dashboard.mjs', 'utf8');
  const styles = readFileSync('demo/styles/demo.scss', 'utf8');
  const views = ['overview', 'realtime', 'journeys', 'tasks', 'fields', 'events', 'cohorts', 'model', 'governance'];

  assert.match(template, /aria-label="Analytics reports"/);
  for (const view of views) {
    assert.match(template, new RegExp(`data-flux-view="${view}"`));
    assert.match(template, new RegExp(`data-flux-report-area="${view}"`));
  }
  assert.match(template, /data-flux-uncertainty/);
  assert.match(template, /data-flux-governance/);
  assert.match(dashboard, /url\.searchParams\.set\('view', currentView\)/);
  assert.match(dashboard, /area\.hidden = area\.dataset\.fluxReportArea !== currentView/);
  assert.match(dashboard, /target\.searchParams\.set\('view', link\.dataset\.fluxView\)/);
  assert.match(dashboard, /history\.replaceState\(\{\}, '', url\);\n\s+updateUrlBackedLinks\(\);/);
  assert.match(dashboard, /function updateUrlBackedLinks\(\) \{\n\s+updateExportLink\(\);\n\s+updateViewLinks\(\);/);
  assert.match(dashboard, /renderUncertainty\(analytics\.uncertainty\)/);
  assert.match(dashboard, /renderGovernance\(analytics\.governance\)/);
  assert.match(dashboard, /renderLifecycle\(lifecycle\)/);
  assert.match(dashboard, /formatLifecycleInterval\(recency\.median_interval_ms\)/);
  assert.match(dashboard, /milliseconds < 86400000[\s\S]*day\$\{days === 1/);
  assert.match(styles, /\.flux-report-navigation/);
  assert.match(styles, /overflow-x: auto/);
  assert.match(styles, /\[data-flux-report-area\]\[hidden\][\s\S]*display: none !important/);
});

test('dashboard API publishes uncertainty and governance reports', () => {
  const router = readFileSync('src/product/router.mjs', 'utf8');
  assert.match(router, /uncertainty: buildUncertaintyReport\(overview\)/);
  assert.match(router, /governance: buildGovernanceReport/);
  assert.match(router, /eventSchemaVersion: fluxEventSchema\.properties\.schema_version\.const/);
});
