import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve('.');
const scanner = join(root, 'scripts/secret-pattern-scan.mjs');

test('repository contract declares high public-service assurance posture', () => {
  const contract = execFileSync('node', ['-e', "process.stdout.write(require('node:fs').readFileSync('repository-contract.yaml','utf8'))"], { encoding: 'utf8' });
  assert.match(contract, /risk_level: high/);
  assert.match(contract, /public-service/);
});

test('GitHub settings require reviews and status checks', () => {
  const settings = execFileSync('node', ['-e', "process.stdout.write(require('node:fs').readFileSync('github-settings.yaml','utf8'))"], { encoding: 'utf8' });
  assert.match(settings, /require_pull_request_reviews: true/);
  assert.match(settings, /require_code_owner_reviews: true/);
  assert.match(settings, /CI \(Conformance\)/);
});

test('harm register blocks production release at foundation stage', () => {
  const harmRegister = execFileSync('node', ['-e', "process.stdout.write(require('node:fs').readFileSync('harm-register.yaml','utf8'))"], { encoding: 'utf8' });
  assert.match(harmRegister, /release_decision: blocked/);
});

test('secret scanner catches quoted, unquoted and YAML-style assignments', () => {
  const cases = [
    ['dotenv-unquoted.env', 'API' + '_KEY=' + 'a'.repeat(24)],
    ['dotenv-quoted.env', 'TOKEN=' + '\"' + 'b'.repeat(24) + '\"'],
    ['yaml-secret.yaml', 'client_' + 'secret: ' + 'c'.repeat(24)]
  ];

  for (const [filename, content] of cases) {
    const dir = mkdtempSync(join(tmpdir(), 'flux-secret-scan-'));
    try {
      writeFileSync(join(dir, filename), `${content}\n`);
      assert.throws(() => {
        execFileSync('node', [scanner], { cwd: dir, stdio: 'pipe' });
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('secret scanner does not mistake ordinary task identifiers for provider keys', () => {
  const dir = mkdtempSync(join(tmpdir(), 'flux-secret-scan-'));
  try {
    writeFileSync(join(dir, 'configuration.mjs'), "export const feature = 'task-funnel-configuration-manager';\n");
    assert.doesNotThrow(() => execFileSync('node', [scanner], { cwd: dir, stdio: 'pipe' }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
