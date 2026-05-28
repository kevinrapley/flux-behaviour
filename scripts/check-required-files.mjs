import { existsSync, readFileSync } from 'node:fs';
const required = ['README.md','AGENTS.md','RECENT_LEARNINGS.md','CONTRIBUTING.md','SECURITY.md','CODEOWNERS','.github/CODEOWNERS','.github/PULL_REQUEST_TEMPLATE.md','repository-contract.yaml','github-settings.yaml','conformance-matrix.yaml','gap-register.yaml','harm-register.yaml','agent-evidence.yaml','accessibility-evidence.md','docs/product/product-charter.md','docs/migration/source-inventory.md','docs/governance/assurance-case.md','docs/security/secret-handling.md'];
const missing = required.filter((file) => !existsSync(file));
if (missing.length) {
  console.error(`Missing required files:\n${missing.join('\n')}`);
  process.exit(1);
}
const readme = readFileSync('README.md','utf8');
for (const phrase of ['consent','privacy','governed foundation','Flux Behaviour']) {
  if (!readme.includes(phrase)) {
    console.error(`README missing ${phrase}`);
    process.exit(1);
  }
}
console.log(`Repository governance file check passed for ${required.length} files.`);
