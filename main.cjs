const { app, BrowserWindow, clipboard, dialog, ipcMain, net, safeStorage, session, shell } = require('electron');
const fsSync = require('fs');
const fs = require('fs/promises');
const path = require('path');
const { fileURLToPath } = require('url');
const {
  copyPlanwerkPackageWithTimestamp,
  emptyPlanwerkData,
  ensurePlanwerkExtension,
  getPlanwerkPackageSignature,
  isMissingPlanwerkPackageError,
  isPlanwerkPackagePath,
  loadPlanwerkPackage,
  normalizePlanwerkData,
  writePlanwerkPackage,
} = require('./planwerkFile.cjs');
const { createMcpPreferenceService } = require('./mcpPreferences.cjs');
const { DEFAULT_ENDPOINT, startMcpServer } = require('./mcpServer.cjs');
const { createUpdateService, parseReleaseVersion } = require('./updater.cjs');

const isDev = process.env.NODE_ENV === 'development';
const DEV_RENDERER_ORIGIN = 'http://127.0.0.1:3000';
const WINDOWS_ICON_PATH = path.join(__dirname, 'build', 'icon.ico');
const MAC_UPDATES_ENABLED = false;
const PLANWERK_RELEASE_API_URL = 'https://api.github.com/repos/benjifunkt/planwerk/releases/latest';
const PLANWERK_RELEASE_PAGE_BASE_URL = 'https://github.com/benjifunkt/planwerk/releases/tag/v';

let mainWindow = null;
let currentPlanwerkPath = null;
let currentPlanwerkSignature = null;
let currentPlanwerkUpdatedAt = null;
let currentPlanwerkWatcher = null;
let currentPlanwerkWatchTimer = null;
let pendingPlanwerkOpenPath = null;
let localMcpRuntime = null;
let localMcpError = null;
let updateService = null;
let isQuitting = false;

const configureAboutPanel = () => {
  app.setAboutPanelOptions({
    applicationName: 'Planwerk',
    applicationVersion: app.getVersion(),
    copyright: 'Copyright © 2026 Benjamin Bauer. Open Source.',
    credits: 'Created with Care',
  });
};

// Older Intel Macs can struggle with Chromium GPU initialization.
app.disableHardwareAcceleration();

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

const getPreferencesPath = () => path.join(app.getPath('userData'), 'planwerk-preferences.json');

const readPreferences = async () => {
  try {
    const raw = await fs.readFile(getPreferencesPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    if (error && error.code === 'ENOENT') return {};
    console.error('Failed to read Planwerk preferences:', error);
    return {};
  }
};

const writePreferences = async (preferences) => {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(getPreferencesPath(), `${JSON.stringify(preferences, null, 2)}\n`, 'utf8');
};

const mcpPreferences = createMcpPreferenceService({ readPreferences, writePreferences, safeStorage });

const rememberPlanwerkPath = async (packagePath) => {
  currentPlanwerkPath = packagePath;
  const preferences = await readPreferences();
  await writePreferences({ ...preferences, currentPlanwerkPath: packagePath });
};

const forgetPlanwerkPath = async () => {
  currentPlanwerkPath = null;
  currentPlanwerkSignature = null;
  currentPlanwerkUpdatedAt = null;
  const preferences = await readPreferences();
  const { currentPlanwerkPath: _currentPlanwerkPath, ...nextPreferences } = preferences;
  await writePreferences(nextPreferences);
};

const serializeError = (error) => (
  error && error.message ? error.message : 'Unknown Planwerk file error.'
);

const normalizePlanwerkOpenPath = (rawPath) => {
  if (typeof rawPath !== 'string' || rawPath.length === 0) return null;

  let packagePath = rawPath;
  try {
    const parsed = new URL(rawPath);
    if (parsed.protocol === 'file:') {
      packagePath = fileURLToPath(parsed);
    }
  } catch {
    packagePath = rawPath;
  }

  return isPlanwerkPackagePath(packagePath) ? packagePath : null;
};

const findPlanwerkPathFromArgs = (args) => {
  if (!Array.isArray(args)) return null;

  for (const arg of args) {
    const packagePath = normalizePlanwerkOpenPath(arg);
    if (packagePath) return packagePath;
  }

  return null;
};

const isTrustedRendererUrl = (rawUrl) => {
  if (!rawUrl) return false;

  try {
    const parsed = new URL(rawUrl);

    if (isDev) {
      return parsed.origin === DEV_RENDERER_ORIGIN;
    }

    if (parsed.protocol !== 'file:') return false;
    return path.normalize(fileURLToPath(parsed)) === path.normalize(path.join(__dirname, 'dist', 'index.html'));
  } catch {
    return false;
  }
};

const isTrustedIpcEvent = (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win !== mainWindow || win.isDestroyed()) return false;

  const frameUrl = event.senderFrame?.url || event.sender.getURL();
  return isTrustedRendererUrl(frameUrl);
};

const handleTrustedIpc = (channel, handler) => {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isTrustedIpcEvent(event)) {
      return { ok: false, reason: 'untrusted-sender', message: 'Untrusted Planwerk renderer.' };
    }

    return handler(event, ...args);
  });
};

const getDialogWindow = (event) => BrowserWindow.fromWebContents(event.sender) || mainWindow;

const updateCurrentSignature = (loaded) => {
  currentPlanwerkSignature = loaded.signature || null;
  currentPlanwerkUpdatedAt = loaded.updatedAt || null;
};

const sendToRenderer = (channel, payload) => {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  });
};

const getUnavailableUpdateStatus = () => ({
  updateCheckSupported: false,
  automaticInstallationSupported: false,
  automaticUpdatesEnabled: true,
  currentVersion: app.getVersion(),
  phase: 'unsupported',
  shouldNotify: false,
  unsupportedReason: 'unavailable',
});

const fetchLatestPublishedRelease = async () => {
  const response = await net.fetch(PLANWERK_RELEASE_API_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `Planwerk/${app.getVersion()}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub release request failed with status ${response.status}.`);
  }

  const release = await response.json();
  if (
    !release
    || typeof release.tag_name !== 'string'
    || release.draft === true
    || release.prerelease === true
  ) {
    throw new Error('GitHub returned an invalid Planwerk release.');
  }

  const version = release.tag_name.startsWith('v')
    ? release.tag_name.slice(1)
    : release.tag_name;
  if (!parseReleaseVersion(version)) {
    throw new Error('GitHub returned an invalid Planwerk release version.');
  }

  return { version };
};

const initializeUpdateService = async () => {
  const { autoUpdater } = require('electron-updater');
  updateService = createUpdateService({
    app,
    autoUpdater,
    readPreferences,
    writePreferences,
    fetchLatestRelease: fetchLatestPublishedRelease,
    macUpdatesEnabled: MAC_UPDATES_ENABLED,
    sendStatus: (status) => sendToRenderer('planwerk:update-status', status),
  });
  await updateService.start();
};

const callMcpRendererFunction = async (functionName, payload) => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;

  const serializedName = JSON.stringify(functionName);
  const callExpression = payload === undefined
    ? 'fn()'
    : `fn(${JSON.stringify(payload)})`;

  return mainWindow.webContents.executeJavaScript(
    `(() => { const fn = window[${serializedName}]; return typeof fn === 'function' ? ${callExpression} : null; })()`
  );
};

const getMcpRendererState = () => callMcpRendererFunction('__MCP_GET_STATE__');
const postMcpRendererTask = (payload) => callMcpRendererFunction('__MCP_POST_TASK__', payload);
const postMcpRendererProject = (payload) => callMcpRendererFunction('__MCP_POST_PROJECT__', payload);
const updateMcpRendererTasks = (payload) => callMcpRendererFunction('__MCP_UPDATE_TASKS__', payload);
const postMcpRendererGoal = (payload) => callMcpRendererFunction('__MCP_POST_GOAL__', payload);
const setMcpRendererGoalFocus = (payload) => callMcpRendererFunction('__MCP_SET_GOAL_FOCUS__', payload);

const stopLocalMcpServer = async () => {
  const runtime = localMcpRuntime;
  if (!runtime) return;

  await runtime.close();
  if (localMcpRuntime === runtime) localMcpRuntime = null;
};

const startLocalMcpServerForAccess = async (access) => {
  if (!access.enabled) {
    await stopLocalMcpServer();
    localMcpError = null;
    return;
  }

  if (!access.token) {
    localMcpError = 'Local MCP access token is unavailable.';
    return;
  }

  if (localMcpRuntime) return;

  try {
    localMcpRuntime = await startMcpServer({
      token: access.token,
      getState: getMcpRendererState,
      postTask: postMcpRendererTask,
      postProject: postMcpRendererProject,
      updateTasks: updateMcpRendererTasks,
      postGoal: postMcpRendererGoal,
      setGoalFocus: setMcpRendererGoalFocus,
    });
    localMcpError = null;
  } catch (error) {
    localMcpRuntime = null;
    localMcpError = serializeError(error);
  }
};

const getLocalMcpStatus = async () => {
  try {
    const access = await mcpPreferences.getAccess();
    return {
      ok: true,
      enabled: access.enabled,
      running: Boolean(localMcpRuntime),
      endpoint: DEFAULT_ENDPOINT,
      token: access.enabled ? access.token : null,
      error: localMcpError,
    };
  } catch (error) {
    return {
      ok: false,
      enabled: true,
      running: false,
      endpoint: DEFAULT_ENDPOINT,
      token: null,
      error: serializeError(error),
    };
  }
};

const restoreLocalMcpServer = async () => {
  try {
    const access = await mcpPreferences.getAccess();
    await startLocalMcpServerForAccess(access);
  } catch (error) {
    localMcpError = serializeError(error);
  }
};

const stopPlanwerkWatcher = () => {
  if (currentPlanwerkWatchTimer) {
    clearTimeout(currentPlanwerkWatchTimer);
    currentPlanwerkWatchTimer = null;
  }

  if (currentPlanwerkWatcher) {
    currentPlanwerkWatcher.close();
    currentPlanwerkWatcher = null;
  }
};

const handleWatchedPlanwerkChange = async () => {
  if (!currentPlanwerkPath) return;

  try {
    const loaded = await loadPlanwerkPackage(currentPlanwerkPath);
    if (loaded.signature === currentPlanwerkSignature) return;

    updateCurrentSignature(loaded);
    sendToRenderer('planwerk:external-change', { ok: true, ...loaded });
  } catch (error) {
    if (isMissingPlanwerkPackageError(error)) {
      await forgetPlanwerkPath();
      stopPlanwerkWatcher();
      sendToRenderer('planwerk:external-change', { ok: false, reason: 'missing-current-path' });
      return;
    }

    sendToRenderer('planwerk:external-change', {
      ok: false,
      reason: 'load-failed',
      path: currentPlanwerkPath,
      message: serializeError(error),
    });
  }
};

const startPlanwerkWatcher = (packagePath) => {
  stopPlanwerkWatcher();
  if (!packagePath) return;

  try {
    currentPlanwerkWatcher = fsSync.watch(packagePath, { persistent: false }, (_eventType, fileName) => {
      if (fileName && String(fileName).endsWith('.tmp')) return;

      if (currentPlanwerkWatchTimer) clearTimeout(currentPlanwerkWatchTimer);
      currentPlanwerkWatchTimer = setTimeout(() => {
        currentPlanwerkWatchTimer = null;
        handleWatchedPlanwerkChange();
      }, 250);
    });
  } catch (error) {
    console.error('Failed to watch Planwerk file:', error);
  }
};

const activateLoadedPlanwerk = async (loaded) => {
  currentPlanwerkPath = loaded.path;
  updateCurrentSignature(loaded);
  startPlanwerkWatcher(loaded.path);
  return loaded;
};

const ensureMainWindow = () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  }

  return mainWindow;
};

const focusMainWindow = () => {
  const win = ensureMainWindow();
  if (!win || win.isDestroyed()) return;

  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
};

const openPlanwerkPathFromOs = async (packagePath) => {
  if (!isPlanwerkPackagePath(packagePath)) return null;

  try {
    const loaded = await loadPlanwerkPackage(packagePath);
    await rememberPlanwerkPath(loaded.path);
    await activateLoadedPlanwerk(loaded);
    focusMainWindow();
    sendToRenderer('planwerk:file-opened', { ok: true, ...loaded });
    return { ok: true, ...loaded };
  } catch (error) {
    const result = {
      ok: false,
      reason: 'open-failed',
      path: packagePath,
      message: serializeError(error),
    };
    focusMainWindow();
    sendToRenderer('planwerk:file-opened', result);
    return result;
  }
};

const openPlanwerkPathWhenReady = (packagePath) => {
  if (!isPlanwerkPackagePath(packagePath)) return;

  if (!app.isReady()) {
    pendingPlanwerkOpenPath = packagePath;
    return;
  }

  openPlanwerkPathFromOs(packagePath);
};

const loadCurrentPlanwerk = async () => {
  const preferences = await readPreferences();
  const packagePath = currentPlanwerkPath || preferences.currentPlanwerkPath || null;

  if (!packagePath) {
    return { ok: false, reason: 'missing-current-path' };
  }

  try {
    const loaded = await loadPlanwerkPackage(packagePath);
    await activateLoadedPlanwerk(loaded);
    return { ok: true, ...loaded };
  } catch (error) {
    if (isMissingPlanwerkPackageError(error)) {
      await forgetPlanwerkPath();
      stopPlanwerkWatcher();
      return { ok: false, reason: 'missing-current-path' };
    }

    return {
      ok: false,
      reason: 'load-failed',
      path: packagePath,
      message: serializeError(error),
    };
  }
};

const getWorkspaceInfo = async () => {
  const preferences = await readPreferences();
  const packagePath = currentPlanwerkPath || preferences.currentPlanwerkPath || null;
  if (!packagePath) {
    return { ok: true, hasWorkspace: false, path: null, name: null, exists: false };
  }

  let exists = false;
  try {
    const stats = await fs.stat(packagePath);
    exists = stats.isDirectory();
  } catch {
    exists = false;
  }

  return {
    ok: true,
    hasWorkspace: Boolean(packagePath),
    path: packagePath,
    name: path.basename(packagePath, '.planwerk'),
    exists,
  };
};

const registerPlanwerkIpc = () => {
  handleTrustedIpc('planwerk:load-current', () => loadCurrentPlanwerk());

  handleTrustedIpc('planwerk:update-get-status', () => (
    updateService?.getStatus() || getUnavailableUpdateStatus()
  ));

  handleTrustedIpc('planwerk:update-set-automatic', async (_event, enabled) => {
    if (typeof enabled !== 'boolean' || !updateService) {
      return updateService?.getStatus() || getUnavailableUpdateStatus();
    }
    return updateService.setAutomaticUpdatesEnabled(enabled);
  });

  handleTrustedIpc('planwerk:update-check-now', () => (
    updateService?.checkNow({ userInitiated: true }) || getUnavailableUpdateStatus()
  ));

  handleTrustedIpc('planwerk:update-dismiss-version', (_event, version) => (
    updateService?.dismissAvailableVersion(version) || getUnavailableUpdateStatus()
  ));

  handleTrustedIpc('planwerk:update-open-release-page', async (_event, version) => {
    const updateStatus = updateService?.getStatus();
    if (
      !parseReleaseVersion(version)
      || version !== updateStatus?.availableVersion
    ) {
      return { ok: false, reason: 'invalid-release' };
    }

    try {
      await shell.openExternal(`${PLANWERK_RELEASE_PAGE_BASE_URL}${version}`);
      return { ok: true };
    } catch (error) {
      console.error('Failed to open Planwerk release page:', error);
      return { ok: false, reason: 'open-failed' };
    }
  });

  handleTrustedIpc('planwerk:mcp-get-status', () => getLocalMcpStatus());

  handleTrustedIpc('planwerk:mcp-set-enabled', async (_event, enabled) => {
    if (typeof enabled !== 'boolean') {
      return {
        ok: false,
        enabled: false,
        running: false,
        endpoint: DEFAULT_ENDPOINT,
        token: null,
        error: 'Invalid local MCP setting.',
      };
    }

    try {
      const access = await mcpPreferences.setEnabled(enabled);
      await stopLocalMcpServer();
      await startLocalMcpServerForAccess(access);
      return getLocalMcpStatus();
    } catch (error) {
      localMcpError = serializeError(error);
      const status = await getLocalMcpStatus();
      return { ...status, ok: false, token: null, error: localMcpError };
    }
  });

  handleTrustedIpc('planwerk:mcp-regenerate-token', async () => {
    try {
      await stopLocalMcpServer();
      const access = await mcpPreferences.regenerateToken();
      await startLocalMcpServerForAccess(access);
      return getLocalMcpStatus();
    } catch (error) {
      localMcpError = serializeError(error);
      const status = await getLocalMcpStatus();
      return { ...status, ok: false, token: null, error: localMcpError };
    }
  });

  handleTrustedIpc('planwerk:write-clipboard-text', async (_event, text) => {
    if (typeof text !== 'string') {
      return { ok: false, reason: 'invalid-text', message: 'Clipboard text must be a string.' };
    }

    try {
      clipboard.writeText(text);
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: 'clipboard-write-failed', message: serializeError(error) };
    }
  });

  handleTrustedIpc('planwerk:create', async (event, options = {}) => {
    try {
      if (options == null || typeof options !== 'object' || Array.isArray(options)) {
        return { ok: false, reason: 'invalid-options', message: 'Invalid Planwerk create options.' };
      }

      const result = await dialog.showSaveDialog(getDialogWindow(event), {
        title: 'Create Planwerk File',
        buttonLabel: 'Create',
        defaultPath: path.join(app.getPath('documents'), 'Planwerk.planwerk'),
        filters: [{ name: 'Planwerk', extensions: ['planwerk'] }],
        properties: ['createDirectory'],
      });

      if (result.canceled || !result.filePath) {
        return { ok: false, canceled: true };
      }

      const packagePath = ensurePlanwerkExtension(result.filePath);
      const initialData = options.initialData ? normalizePlanwerkData(options.initialData) : emptyPlanwerkData();
      const written = await writePlanwerkPackage(packagePath, initialData);
      await rememberPlanwerkPath(written.path);
      await activateLoadedPlanwerk(written);

      return { ok: true, ...written };
    } catch (error) {
      return { ok: false, reason: 'create-failed', message: serializeError(error) };
    }
  });

  handleTrustedIpc('planwerk:open', async (event) => {
    try {
      const result = await dialog.showOpenDialog(getDialogWindow(event), {
        title: 'Open Planwerk File',
        buttonLabel: 'Open',
        message: 'Select a .planwerk file.',
        filters: [{ name: 'Planwerk', extensions: ['planwerk'] }],
        properties: process.platform === 'darwin'
          ? ['openFile', 'openDirectory']
          : ['openDirectory'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, canceled: true };
      }

      const packagePath = result.filePaths[0];
      if (!isPlanwerkPackagePath(packagePath)) {
        return { ok: false, reason: 'invalid-extension', message: 'Please select a .planwerk file.' };
      }

      const loaded = await loadPlanwerkPackage(packagePath);
      await rememberPlanwerkPath(loaded.path);
      await activateLoadedPlanwerk(loaded);

      return { ok: true, ...loaded };
    } catch (error) {
      return { ok: false, reason: 'open-failed', message: serializeError(error) };
    }
  });

  handleTrustedIpc('planwerk:close', async () => {
    try {
      stopPlanwerkWatcher();
      await forgetPlanwerkPath();
      return { ok: true, path: null, name: null };
    } catch (error) {
      return { ok: false, reason: 'close-failed', message: serializeError(error) };
    }
  });

  handleTrustedIpc('planwerk:save', async (_event, data, options = {}) => {
    const preferences = await readPreferences();
    const packagePath = currentPlanwerkPath || preferences.currentPlanwerkPath || null;

    if (!packagePath) {
      return { ok: false, reason: 'missing-current-path', message: 'No Planwerk file is open.' };
    }

    try {
      if (options == null || typeof options !== 'object' || Array.isArray(options)) {
        return { ok: false, reason: 'invalid-options', message: 'Invalid Planwerk save options.' };
      }

      if (options.expectedSignature != null && typeof options.expectedSignature !== 'string') {
        return { ok: false, reason: 'invalid-options', message: 'Invalid Planwerk signature.' };
      }

      const normalizedData = normalizePlanwerkData(data);

      if (options.expectedSignature) {
        const diskSignature = await getPlanwerkPackageSignature(packagePath);
        if (diskSignature.signature !== options.expectedSignature) {
          const loaded = await loadPlanwerkPackage(packagePath);
          await activateLoadedPlanwerk(loaded);
          return {
            ok: false,
            reason: 'signature-conflict',
            message: 'The Planwerk file changed outside the app.',
            external: { ok: true, ...loaded },
          };
        }
      }

      const written = await writePlanwerkPackage(packagePath, normalizedData);
      await activateLoadedPlanwerk(written);
      return { ok: true, ...written };
    } catch (error) {
      if (isMissingPlanwerkPackageError(error)) {
        await forgetPlanwerkPath();
        stopPlanwerkWatcher();
        return { ok: false, reason: 'missing-current-path' };
      }

      return { ok: false, reason: 'save-failed', message: serializeError(error) };
    }
  });

  handleTrustedIpc('planwerk:copy-external-version', async (_event, options = {}) => {
    const preferences = await readPreferences();
    const packagePath = currentPlanwerkPath || preferences.currentPlanwerkPath || null;

    if (!packagePath) {
      return { ok: false, reason: 'missing-current-path', message: 'No Planwerk file is open.' };
    }

    try {
      if (options == null || typeof options !== 'object' || Array.isArray(options)) {
        return { ok: false, reason: 'invalid-options', message: 'Invalid Planwerk copy options.' };
      }

      const copied = await copyPlanwerkPackageWithTimestamp(
        packagePath,
        options.data ? normalizePlanwerkData(options.data) : emptyPlanwerkData()
      );
      return { ok: true, externalPath: copied.path, ...copied };
    } catch (error) {
      return { ok: false, reason: 'copy-failed', message: serializeError(error) };
    }
  });

  handleTrustedIpc('planwerk:get-info', () => getWorkspaceInfo());
};

const configureSessionSecurity = () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler(() => false);
};

const configureWindowSecurity = (win) => {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isTrustedRendererUrl(targetUrl)) {
      event.preventDefault();
    }
  });
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    ...(process.platform === 'win32' ? { icon: WINDOWS_ICON_PATH } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      devTools: isDev
    }
  });

  if (process.platform === 'win32' && !isDev) {
    mainWindow.removeMenu();
  }

  configureWindowSecurity(mainWindow);

  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !isQuitting && localMcpRuntime) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  if (isDev) {
    mainWindow.loadURL(DEV_RENDERER_ORIGIN);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  return mainWindow;
}

if (hasSingleInstanceLock) {
  pendingPlanwerkOpenPath = findPlanwerkPathFromArgs(process.argv);

  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    const packagePath = normalizePlanwerkOpenPath(filePath);
    if (packagePath) openPlanwerkPathWhenReady(packagePath);
  });

  app.on('second-instance', (_event, argv) => {
    const packagePath = findPlanwerkPathFromArgs(argv);
    if (packagePath) {
      openPlanwerkPathFromOs(packagePath);
      return;
    }

    focusMainWindow();
  });

  app.whenReady().then(async () => {
    configureAboutPanel();
    configureSessionSecurity();
    registerPlanwerkIpc();

    if (pendingPlanwerkOpenPath) {
      const packagePath = pendingPlanwerkOpenPath;
      pendingPlanwerkOpenPath = null;
      await openPlanwerkPathFromOs(packagePath);
    } else {
      createWindow();
    }

    await restoreLocalMcpServer();
    await initializeUpdateService().catch((error) => {
      console.error('Failed to initialize Planwerk updates:', error);
    });

    app.on('activate', () => {
      focusMainWindow();
    });
  });
}

app.on('before-quit', () => {
  isQuitting = true;
  updateService?.dispose();
  stopLocalMcpServer().catch((error) => {
    console.error('Failed to stop local MCP server:', error);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  } else {
    mainWindow = null;
    if (BrowserWindow.getAllWindows().length === 0) {
      stopPlanwerkWatcher();
    }
  }
});
