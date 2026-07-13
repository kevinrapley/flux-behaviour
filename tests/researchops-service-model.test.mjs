import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { validateServiceModel } from '../src/model/service-model.mjs';

test('initial ResearchOps model covers its primary authentication, project, objective and Sourcebook journeys', () => {
  const model = JSON.parse(readFileSync('config/models/researchops.v1.json', 'utf8'));
  const validation = validateServiceModel(model);
  const bindings = new Set(model.bindings.map(({ element_key }) => element_key));

  assert.deepEqual(validation, { valid: true, errors: [] });
  assert.equal(model.tenant_id, 'researchops');
  for (const key of [
    'page.account.sign-in',
    'link.navigation.projects',
    'page.projects',
    'link.project.view-dashboard',
    'page.project-dashboard',
    'button.project.add-objective',
    'field.project.add-objective-textarea',
    'button.project.save-objective',
    'link.navigation.sourcebook',
    'page.sourcebook',
    'link.sourcebook.pillar.enviro',
    'page.sourcebook-environment'
  ]) assert.ok(bindings.has(key), `missing ${key}`);
});

test('checked-in ResearchOps seed migration is generated exactly from the governed model', () => {
  const directory = mkdtempSync(join(tmpdir(), 'flux-service-model-'));
  const output = join(directory, 'seed.sql');
  try {
    execFileSync(process.execPath, ['scripts/generate-service-model-seed.mjs', 'config/models/researchops.v1.json', output]);
    assert.equal(
      readFileSync(output, 'utf8'),
      readFileSync('migrations/0004_seed_researchops_service_model.sql', 'utf8')
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
