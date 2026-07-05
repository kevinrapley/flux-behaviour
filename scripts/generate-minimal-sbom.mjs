import { writeFileSync, readFileSync } from 'node:fs';
import crypto from 'node:crypto';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

let lock = null;
try {
  lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
} catch (err) {
  // Fall back to package.json entries if lockfile is missing
}

const deps = {
  ...pkg.dependencies,
  ...pkg.devDependencies
};

const components = [];

for (const [name, versionRange] of Object.entries(deps)) {
  let version = versionRange.replace(/^[\^~]/, '');
  let hashes = undefined;

  if (lock && lock.packages) {
    const lockEntry = lock.packages[`node_modules/${name}`] || lock.packages[name];
    if (lockEntry) {
      if (lockEntry.version) {
        version = lockEntry.version;
      }
      if (lockEntry.integrity) {
        const match = lockEntry.integrity.match(/^(sha[0-9]+)-(.+)$/);
        if (match) {
          const algMap = {
            sha1: 'SHA-1',
            sha256: 'SHA-256',
            sha384: 'SHA-384',
            sha512: 'SHA-512'
          };
          const alg = algMap[match[1]] || match[1].toUpperCase();
          try {
            const hexContent = Buffer.from(match[2], 'base64').toString('hex');
            hashes = [{ alg, content: hexContent }];
          } catch (e) {
            // Ignore hash formatting issues
          }
        }
      }
    }
  }

  let purl = `pkg:npm/${name}@${version}`;
  if (name.startsWith('@')) {
    const parts = name.slice(1).split('/');
    if (parts.length === 2) {
      purl = `pkg:npm/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}@${version}`;
    }
  }

  const component = {
    type: 'library',
    name,
    version,
    purl
  };

  if (hashes) {
    component.hashes = hashes;
  }

  components.push(component);
}

// Sort components deterministically
components.sort((a, b) => a.name.localeCompare(b.name));

const serial = crypto.createHash('sha256').update(`${pkg.name}@${pkg.version}`).digest('hex');
const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: `urn:uuid:${serial.slice(0, 8)}-${serial.slice(8, 12)}-${serial.slice(12, 16)}-${serial.slice(16, 20)}-${serial.slice(20, 32)}`,
  version: 1,
  metadata: {
    component: {
      type: 'application',
      name: pkg.name,
      version: pkg.version
    }
  },
  components
};

writeFileSync('sbom.cdx.json', JSON.stringify(sbom, null, 2) + '\n');
console.log('Generated CycloneDX SBOM.');

