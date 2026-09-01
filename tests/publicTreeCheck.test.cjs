const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const checkerSource = path.resolve(__dirname, '..', 'scripts', 'check-public-tree.cjs');

const runGit = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' });

test('public-tree check scans staged blobs rather than benign working-tree replacements', t => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'planwerk-public-tree-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repo, 'scripts'));
  fs.copyFileSync(checkerSource, path.join(repo, 'scripts', 'check-public-tree.cjs'));
  fs.writeFileSync(path.join(repo, 'LICENSE'), 'GNU AFFERO GENERAL PUBLIC LICENSE\n');
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({
    private: true,
    license: 'AGPL-3.0-only',
    scripts: {
      'electron:build': 'electron-builder --publish=never',
      'electron:build:win': 'electron-builder --publish=never',
      'electron:build:win:dir': 'electron-builder --publish=never',
    },
  }));
  fs.writeFileSync(path.join(repo, 'staged.txt'), `ghp_${'A'.repeat(36)}\n`);

  runGit(repo, 'init', '-q');
  runGit(repo, 'add', '.');
  fs.writeFileSync(path.join(repo, 'staged.txt'), 'benign working tree\n');

  const rejected = spawnSync(process.execPath, ['scripts/check-public-tree.cjs'], { cwd: repo, encoding: 'utf8' });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /staged\.txt: credential-shaped token/);

  runGit(repo, 'add', 'staged.txt');
  const accepted = spawnSync(process.execPath, ['scripts/check-public-tree.cjs'], { cwd: repo, encoding: 'utf8' });
  assert.equal(accepted.status, 0, accepted.stderr);
});
