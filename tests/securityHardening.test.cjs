const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('renderer entrypoint uses local assets and has no runtime CDN imports', () => {
  const html = read('index.html');
  const viteConfig = read('vite.config.ts');

  assert.doesNotMatch(html, /cdn\.tailwindcss|fonts\.googleapis|esm\.sh|https:\/\//);
  assert.match(html, /Content-Security-Policy/);
  assert.match(viteConfig, /host:\s*'127\.0\.0\.1'/);
  assert.doesNotMatch(viteConfig, /GEMINI_API_KEY|process\.env\.API_KEY|process\.env\.GEMINI_API_KEY/);
});

test('electron main process keeps renderer isolated and IPC sender-checked', () => {
  const main = read('main.cjs');

  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /setWindowOpenHandler/);
  assert.match(main, /will-navigate/);
  assert.match(main, /setPermissionRequestHandler/);
  assert.match(main, /setPermissionCheckHandler/);
  assert.match(main, /isTrustedIpcEvent/);
  assert.match(main, /handleTrustedIpc/);
  assert.match(main, /clipboard/);
  assert.match(main, /planwerk:write-clipboard-text/);
  assert.match(main, /normalizePlanwerkData\(data\)/);
  assert.match(main, /planwerk:mcp-get-status/);
  assert.match(main, /planwerk:mcp-set-enabled/);
  assert.match(main, /planwerk:mcp-regenerate-token/);
  assert.match(main, /safeStorage/);
  assert.match(main, /startMcpServer/);
  assert.match(main, /postMcpRendererTask/);
  assert.match(main, /postMcpRendererProject/);
  assert.match(main, /updateMcpRendererTasks/);
  assert.match(main, /postMcpRendererGoal/);
  assert.match(main, /setMcpRendererGoalFocus/);
  assert.doesNotMatch(main, /addMcpRendererTask|__MCP_ADD_TASK__|create_task/);
  assert.match(main, /mainWindow\.hide\(\)/);
  assert.match(main, /before-quit/);
  assert.match(main, /app\.on\('activate', \(\) => \{\s+focusMainWindow\(\);\s+\}\);/);
  assert.doesNotMatch(main, /PLANWERK_LOCAL_API/);

  const preload = read('preload.cjs');
  assert.match(preload, /contextBridge\.exposeInMainWorld\('planwerkClipboard'/);
  assert.match(preload, /planwerk:write-clipboard-text/);
  assert.match(preload, /contextBridge\.exposeInMainWorld\('planwerkMcp'/);

  const appSource = read('App.tsx');
  const storeSource = read('hooks/useStore.ts');
  const types = read('types.ts');
  assert.match(storeSource, /const commitMcpState = useCallback/);
  assert.match(storeSource, /stateRef\.current = nextState/);
  assert.match(storeSource, /const getMcpState = useCallback\(\(\) => stateRef\.current/);
  assert.match(appSource, /__MCP_GET_STATE__ = \(\) => storageStatus\.hasOpenFile \? getMcpState\(\) : null/);
  assert.match(appSource, /postMcpProject\(payload\)/);
  assert.match(appSource, /postMcpTask\(payload\)/);
  assert.match(appSource, /__MCP_POST_TASK__/);
  assert.match(appSource, /__MCP_POST_PROJECT__/);
  assert.match(appSource, /__MCP_UPDATE_TASKS__/);
  assert.match(appSource, /__MCP_POST_GOAL__/);
  assert.match(appSource, /__MCP_SET_GOAL_FOCUS__/);
  assert.match(types, /__MCP_POST_TASK__/);
  assert.match(types, /__MCP_POST_PROJECT__/);
  assert.match(types, /__MCP_UPDATE_TASKS__/);
  assert.match(types, /__MCP_POST_GOAL__/);
  assert.match(types, /__MCP_SET_GOAL_FOCUS__/);
  assert.doesNotMatch(appSource, /__MCP_ADD_TASK__|create_task/);
  assert.doesNotMatch(types, /__MCP_ADD_TASK__|create_task/);
});

test('local MCP token regeneration stops the old server before creating a new token', () => {
  const main = read('main.cjs');
  const mcpServer = read('mcpServer.cjs');

  assert.match(
    main,
    /handleTrustedIpc\('planwerk:mcp-regenerate-token', async \(\) => \{\s+try \{\s+await stopLocalMcpServer\(\);\s+const access = await mcpPreferences\.regenerateToken\(\);/
  );
  assert.match(main, /await runtime\.close\(\);\s+if \(localMcpRuntime === runtime\) localMcpRuntime = null/);
  assert.doesNotMatch(main, /const runtime = localMcpRuntime;\s+localMcpRuntime = null/);
  assert.match(mcpServer, /const listenerClosed = new Promise/);
  assert.match(mcpServer, /httpServer\.close\(/);
  assert.match(mcpServer, /Promise\.allSettled/);
  assert.match(mcpServer, /await listenerClosed/);
});

test('planwerk package reads pin regular files to their opened handles', () => {
  const source = read('planwerkFile.cjs');

  assert.match(source, /fs\.lstat\(filePath\)/);
  assert.match(source, /O_NOFOLLOW/);
  assert.match(source, /pathStats\.dev !== handleStats\.dev/);
  assert.match(source, /pathStats\.ino !== handleStats\.ino/);
  assert.match(source, /opened\.handle\.readFile\('utf8'\)/);
  assert.doesNotMatch(source, /const raw = await fs\.readFile\(filePath, 'utf8'\)/);
});

test('electron app accepts planwerk files from OS open events', () => {
  const main = read('main.cjs');
  const preload = read('preload.cjs');
  const types = read('types.ts');

  assert.match(main, /requestSingleInstanceLock/);
  assert.match(main, /second-instance/);
  assert.match(main, /open-file/);
  assert.match(main, /findPlanwerkPathFromArgs/);
  assert.match(main, /openPlanwerkPathFromOs/);
  assert.match(main, /planwerk:file-opened/);
  assert.match(main, /rememberPlanwerkPath\(loaded\.path\)/);
  assert.match(main, /activateLoadedPlanwerk\(loaded\)/);

  assert.match(preload, /onFileOpened/);
  assert.match(preload, /planwerk:file-opened/);
  assert.match(types, /onFileOpened:\s*\(handler:\s*\(result:\s*PlanwerkFileResult\)\s*=>\s*void\)\s*=>\s*\(\)\s*=>\s*void/);
});

test('electron app can close the active planwerk file without deleting it', () => {
  const main = read('main.cjs');
  const preload = read('preload.cjs');
  const types = read('types.ts');

  assert.match(main, /handleTrustedIpc\('planwerk:close'/);
  assert.match(main, /forgetPlanwerkPath\(\)/);
  assert.match(main, /stopPlanwerkWatcher\(\)/);
  assert.doesNotMatch(main, /rm\(.*currentPlanwerkPath/s);

  assert.match(preload, /close: \(\) => ipcRenderer\.invoke\('planwerk:close'\)/);
  assert.match(types, /close: \(\) => Promise<PlanwerkFileResult>/);
});

test('development launchers keep electron app path before forwarded file args', () => {
  const startElectron = read('scripts/start-electron.cjs');
  const launchElectron = read('scripts/launch-electron.cjs');

  assert.match(startElectron, /\['\.',\s*\.\.\.args\]/);
  assert.match(launchElectron, /\['\.',\s*\.\.\.args\]/);
});

test('packaged Windows app removes the native menu bar', () => {
  const main = read('main.cjs');

  assert.match(
    main,
    /if \(process\.platform === 'win32' && !isDev\) {\s+mainWindow\.removeMenu\(\);\s+}/
  );
  assert.doesNotMatch(main, /Menu\.setApplicationMenu/);
});

test('Windows app icon is available for packaging and the runtime window', () => {
  const main = read('main.cjs');
  const packageJson = JSON.parse(read('package.json'));

  assert.match(main, /const WINDOWS_ICON_PATH = path\.join\(__dirname, 'build', 'icon\.ico'\)/);
  assert.match(main, /\.\.\.\(process\.platform === 'win32' \? \{ icon: WINDOWS_ICON_PATH \} : \{\}\)/);
  assert.ok(packageJson.build.files.includes('build/icon.ico'));
  assert.equal(packageJson.build.win.icon, 'build/icon.ico');
  assert.equal(fs.existsSync(path.join(repoRoot, 'build/icon.ico')), true);
});

test('release packaging includes the local MCP runtime rather than the old development API', () => {
  const packageJson = JSON.parse(read('package.json'));

  assert.ok(packageJson.dependencies['@modelcontextprotocol/sdk']);
  assert.ok(packageJson.dependencies.zod);
  assert.ok(packageJson.build.files.includes('mcpServer.cjs'));
  assert.ok(packageJson.build.files.includes('mcpPreferences.cjs'));
  assert.equal(packageJson.build.files.includes('localApi.cjs'), false);
});

test('macOS release notices use a fixed GitHub destination and validate the available version', () => {
  const main = read('main.cjs');
  const preload = read('preload.cjs');

  assert.match(main, /PLANWERK_RELEASE_API_URL = 'https:\/\/api\.github\.com\/repos\/benjifunkt\/planwerk\/releases\/latest'/);
  assert.match(main, /PLANWERK_RELEASE_PAGE_BASE_URL = 'https:\/\/github\.com\/benjifunkt\/planwerk\/releases\/tag\/v'/);
  assert.match(main, /parseReleaseVersion\(version\)/);
  assert.match(main, /version !== updateStatus\?\.availableVersion/);
  assert.match(main, /shell\.openExternal\(`\$\{PLANWERK_RELEASE_PAGE_BASE_URL}\$\{version}`\)/);
  assert.doesNotMatch(preload, /openReleasePage: \(url\)/);
  assert.match(preload, /openReleasePage: \(version\)/);
});

test('release packaging defines auto-update targets without implicit publishing', () => {
  const packageJson = JSON.parse(read('package.json'));

  assert.match(packageJson.scripts['electron:build'], /--publish=never/);
  assert.equal(
    packageJson.scripts['electron:build:win'],
    'npm run build && electron-builder --win nsis --x64 --publish=never'
  );
  assert.match(packageJson.scripts['electron:build:win:dir'], /--publish=never/);
  assert.match(packageJson.scripts['electron:build:mac:arm64'], /--publish=never/);
  assert.match(packageJson.scripts['electron:build:mac:x64'], /--publish=never/);
  assert.deepEqual(packageJson.build.win, {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'build/icon.ico',
  });
  assert.deepEqual(packageJson.build.mac.target, [
    { target: 'dmg', arch: ['arm64', 'x64'] },
    { target: 'zip', arch: ['arm64', 'x64'] },
  ]);
  assert.equal(packageJson.build.mac.identity, '-');
  assert.equal(packageJson.build.mac.hardenedRuntime, false);
  assert.deepEqual(packageJson.build.publish, [{
    provider: 'github',
    owner: 'benjifunkt',
    repo: 'planwerk',
    releaseType: 'draft',
  }]);
  assert.equal(fs.existsSync(path.join(repoRoot, 'build/icon.ico')), true);
});

test('GitHub release publishing is restricted to version tags and uses one reviewed draft', () => {
  const ciWorkflow = read('.github/workflows/ci.yml');
  const releaseWorkflow = read('.github/workflows/release.yml');

  assert.match(ciWorkflow, /npm run release:check/);
  assert.match(releaseWorkflow, /tags:\s*\n\s*- 'v\*\.\*\.\*'/);
  assert.match(releaseWorkflow, /permissions:\s*\n\s*contents: write/);
  assert.match(releaseWorkflow, /create-draft:\s*\n\s*needs: validate/);
  assert.match(releaseWorkflow, /gh release create/);
  assert.match(releaseWorkflow, /electron-builder --mac --x64 --arm64 --publish never/);
  assert.match(releaseWorkflow, /codesign --verify --deep --strict --verbose=2 release\/mac\/Planwerk\.app/);
  assert.match(releaseWorkflow, /codesign --verify --deep --strict --verbose=2 release\/mac-arm64\/Planwerk\.app/);
  assert.match(releaseWorkflow, /electron-builder --win nsis --x64 --publish never/);
  assert.match(releaseWorkflow, /uses: actions\/upload-artifact@v4/);
  assert.match(releaseWorkflow, /uses: actions\/download-artifact@v4/);
  assert.match(releaseWorkflow, /gh release upload .*release-assets\/\* --repo "\$\{GITHUB_REPOSITORY}" --clobber/);
  assert.match(releaseWorkflow, /secrets\.GITHUB_TOKEN/);
  assert.match(releaseWorkflow, /gh release edit/);
  assert.doesNotMatch(releaseWorkflow, /--publish always/);
  assert.doesNotMatch(releaseWorkflow, /pull_request:/);
});
