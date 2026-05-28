import { writeFileSync, readFileSync } from 'node:fs';
import crypto from 'node:crypto';
const pkg = JSON.parse(readFileSync('package.json','utf8'));
const serial = crypto.createHash('sha256').update(`${pkg.name}@${pkg.version}`).digest('hex');
const sbom = { bomFormat:'CycloneDX', specVersion:'1.5', serialNumber:`urn:uuid:${serial.slice(0,8)}-${serial.slice(8,12)}-${serial.slice(12,16)}-${serial.slice(16,20)}-${serial.slice(20,32)}`, version:1, metadata:{component:{type:'application', name:pkg.name, version:pkg.version}}, components:[] };
writeFileSync('sbom.cdx.json', JSON.stringify(sbom, null, 2) + '\n');
console.log('Generated minimal CycloneDX SBOM.');
