const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const overrides = new Map([
  ['electron', '32.3.3'],
  ['electron-builder', '25.1.8'],
  ['@types/node', '20.19.39'],
]);

function dependencySpecs(dependencies = {}) {
  return Object.entries(dependencies).map(([name, version]) => {
    const override = overrides.get(name);
    return `${name}@${override ?? version}`;
  });
}

const specs = [
  ...dependencySpecs(packageJson.dependencies),
  ...dependencySpecs(packageJson.devDependencies),
];

console.log('Installing legacy-compatible dependencies without changing package.json or package-lock.json.');
console.log('Overrides: electron@32.3.3, electron-builder@25.1.8, @types/node@20.19.39');

const result = spawnSync(
  'npm',
  ['install', '--no-save', '--package-lock=false', '--no-audit', '--fund=false', '--include=dev', ...specs],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
