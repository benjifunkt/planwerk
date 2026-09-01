const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const git = (...args) => execFileSync('git', args, { cwd: repoRoot });
const listGitPaths = (...args) => git(...args).toString('utf8').split('\0').filter(Boolean);

const cachedFiles = listGitPaths('ls-files', '-z', '--cached');
const untrackedFiles = listGitPaths('ls-files', '-z', '--others', '--exclude-standard');
const cachedFileSet = new Set(cachedFiles);
const publicFiles = [...cachedFiles, ...untrackedFiles];

const readPublicFile = (relativePath) => (
  cachedFileSet.has(relativePath)
    ? git('show', `:${relativePath}`)
    : fs.readFileSync(path.join(repoRoot, relativePath))
);

const forbiddenPaths = new Set([
  ['Onboarding', ' Notizen.md'].join(''),
  ['Warnungen', ' notizen.md'].join(''),
  ['design', '-qa.md'].join(''),
  ['security', '_best_practices_report.md'].join(''),
  ['OPEN_SOURCE', '_RELEASE_AUDIT.md'].join(''),
  'build/icon-old.png',
]);
const forbiddenExtensions = new Set(['.key', '.pem', '.p12', '.pfx', '.cer', '.crt']);
const findings = [];

const addFinding = (relativePath, reason) => findings.push(`${relativePath}: ${reason}`);

const unstagedCheck = spawnSync('git', ['diff', '--quiet', '--'], { cwd: repoRoot });
if (unstagedCheck.status !== 0) {
  addFinding('<working-tree>', 'tracked changes must be staged so the exact public index is verified');
}

for (const relativePath of publicFiles) {
  const normalizedPath = relativePath.split(path.sep).join('/');
  const lowerPath = normalizedPath.toLowerCase();
  const baseName = path.posix.basename(lowerPath);

  if (forbiddenPaths.has(normalizedPath)) addFinding(normalizedPath, 'private or obsolete release artifact');
  if (normalizedPath.startsWith('Demo/')) addFinding(normalizedPath, 'demo data is excluded from the public release');
  if (lowerPath.includes('.planwerk/')) addFinding(normalizedPath, 'tracked Planwerk workspace data');
  if (baseName === '.mcp.json') addFinding(normalizedPath, 'project-scoped MCP configuration');
  if (baseName.startsWith('.env.') && baseName !== '.env.example') addFinding(normalizedPath, 'environment-specific configuration');
  if (forbiddenExtensions.has(path.extname(lowerPath))) addFinding(normalizedPath, 'private key, certificate, or signing material');

  const buffer = readPublicFile(relativePath);
  if (buffer.includes(0)) continue;
  const sourceText = buffer.toString('utf8');

  const macHomeMarker = `/${'Users'}/`;
  const windowsHomePattern = new RegExp(`[A-Za-z]:\\\\${'Users'}\\\\`, 'i');
  if (sourceText.includes(macHomeMarker) || windowsHomePattern.test(sourceText)) {
    addFinding(normalizedPath, 'machine-specific user-home path');
  }
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(sourceText)) {
    addFinding(normalizedPath, 'embedded private key');
  }
  if (/(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|sk_live_[A-Za-z0-9]{20,})/.test(sourceText)) {
    addFinding(normalizedPath, 'credential-shaped token');
  }
  if (normalizedPath !== 'package-lock.json' && /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(sourceText)) {
    addFinding(normalizedPath, 'email address in the public source tree');
  }
}

if (!publicFiles.includes('package.json')) {
  addFinding('package.json', 'package metadata is missing');
} else {
  const packageJson = JSON.parse(readPublicFile('package.json').toString('utf8'));
  if (packageJson.private !== true) addFinding('package.json', 'npm publication must remain disabled');
  if (packageJson.license !== 'AGPL-3.0-only') addFinding('package.json', 'license must be AGPL-3.0-only');
  for (const scriptName of ['electron:build', 'electron:build:win', 'electron:build:win:dir']) {
    if (!packageJson.scripts?.[scriptName]?.includes('--publish=never')) {
      addFinding('package.json', `${scriptName} must disable implicit publishing`);
    }
  }
}

if (!publicFiles.includes('LICENSE')) addFinding('LICENSE', 'license file is missing');

if (findings.length > 0) {
  console.error('Public-tree verification failed:');
  findings.forEach(finding => console.error(`- ${finding}`));
  process.exitCode = 1;
} else {
  console.log(`Public-tree verification passed for ${publicFiles.length} files.`);
}
