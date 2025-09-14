import fs from 'fs';
import path from 'path';
import child_process from 'child_process';

// Resolve build/server
const serverBuild = path.resolve(process.cwd(), 'build', 'server');
if (!fs.existsSync(serverBuild)) {
  console.error('build/server not found. Run `npm run build` first.');
  process.exit(1);
}

// If build/server/index.js exists, use it. Otherwise search for nodejs_* subdir containing index.js
let entry = path.join(serverBuild, 'index.js');
if (!fs.existsSync(entry)) {
  const files = fs.readdirSync(serverBuild, { withFileTypes: true });
  const candidate = files.find((d) => d.isDirectory() && d.name.startsWith('nodejs_'));
  if (candidate) {
    const candidateIndex = path.join(serverBuild, candidate.name, 'index.js');
    if (fs.existsSync(candidateIndex)) {
      entry = candidateIndex;
    }
  }
}

if (!fs.existsSync(entry)) {
  console.error('Could not find server entry under build/server. Expected build/server/index.js or build/server/nodejs_*/index.js');
  process.exit(1);
}

// Spawn react-router-serve with the resolved entry
const bin = path.resolve(process.cwd(), 'node_modules', '.bin', 'react-router-serve');
const args = [entry];

const child = child_process.spawn(bin, args, { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code));
child.on('error', (err) => {
  console.error('Failed to start react-router-serve:', err);
  process.exit(1);
});
