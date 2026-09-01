const UPDATE_START_DELAY_MS = 30_000;
const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1_000;
const RELEASE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const parseReleaseVersion = (value) => {
  if (typeof value !== 'string') return null;
  const match = RELEASE_VERSION_PATTERN.exec(value);
  if (!match) return null;
  return match.slice(1).map(Number);
};

const compareReleaseVersions = (left, right) => {
  const leftParts = parseReleaseVersion(left);
  const rightParts = parseReleaseVersion(right);
  if (!leftParts || !rightParts) return null;

  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }
  return 0;
};

const createUpdateService = ({
  app,
  autoUpdater,
  readPreferences,
  writePreferences,
  fetchLatestRelease,
  sendStatus = () => {},
  platform = process.platform,
  macUpdatesEnabled = false,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  logger = console,
}) => {
  const isPackaged = Boolean(app.isPackaged);
  const automaticInstallationSupported = isPackaged && (
    platform === 'win32' || (platform === 'darwin' && macUpdatesEnabled)
  );
  const usesReleaseNotices = isPackaged
    && platform === 'darwin'
    && !macUpdatesEnabled
    && typeof fetchLatestRelease === 'function';
  const updateCheckSupported = automaticInstallationSupported || usesReleaseNotices;

  let automaticUpdatesEnabled = true;
  let dismissedUpdateVersion;
  let startupTimer = null;
  let intervalTimer = null;
  let checkInProgress = false;
  let disposed = false;
  let listenersRegistered = false;
  let status = {
    updateCheckSupported,
    automaticInstallationSupported,
    automaticUpdatesEnabled,
    currentVersion: app.getVersion(),
    phase: updateCheckSupported ? 'idle' : 'unsupported',
    shouldNotify: false,
    ...(updateCheckSupported ? {} : { unsupportedReason: 'unavailable' }),
  };

  const emitStatus = (updates = {}) => {
    status = {
      ...status,
      ...updates,
      updateCheckSupported,
      automaticInstallationSupported,
      automaticUpdatesEnabled,
      currentVersion: app.getVersion(),
    };
    sendStatus({ ...status });
    return { ...status };
  };

  const clearSchedule = () => {
    if (startupTimer) {
      clearTimeoutFn(startupTimer);
      startupTimer = null;
    }
    if (intervalTimer) {
      clearIntervalFn(intervalTimer);
      intervalTimer = null;
    }
  };

  const markError = (error) => {
    checkInProgress = false;
    logger.error('Planwerk update check failed:', error);
    return emitStatus({ phase: 'error', availableVersion: undefined, shouldNotify: false });
  };

  const checkReleaseNotice = async ({ userInitiated }) => {
    try {
      const release = await fetchLatestRelease();
      const availableVersion = release?.version;
      const comparison = compareReleaseVersions(availableVersion, app.getVersion());

      if (comparison === null) {
        throw new Error('GitHub returned an invalid Planwerk release version.');
      }

      checkInProgress = false;
      if (comparison > 0) {
        return emitStatus({
          phase: 'available',
          availableVersion,
          shouldNotify: userInitiated || availableVersion !== dismissedUpdateVersion,
        });
      }

      return emitStatus({ phase: 'upToDate', availableVersion: undefined, shouldNotify: false });
    } catch (error) {
      return markError(error);
    }
  };

  const checkNow = async ({ userInitiated = false } = {}) => {
    if (!updateCheckSupported || disposed || checkInProgress) return { ...status };

    checkInProgress = true;
    emitStatus({ phase: 'checking', availableVersion: undefined, shouldNotify: false });

    if (usesReleaseNotices) {
      return checkReleaseNotice({ userInitiated });
    }

    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      return markError(error);
    }

    return { ...status };
  };

  const scheduleChecks = () => {
    clearSchedule();
    const shouldSchedule = usesReleaseNotices
      || (automaticInstallationSupported && automaticUpdatesEnabled);
    if (!updateCheckSupported || disposed || !shouldSchedule) return;

    startupTimer = setTimeoutFn(() => {
      startupTimer = null;
      checkNow();
    }, UPDATE_START_DELAY_MS);
    startupTimer?.unref?.();

    intervalTimer = setIntervalFn(() => {
      checkNow();
    }, UPDATE_INTERVAL_MS);
    intervalTimer?.unref?.();
  };

  const listeners = {
    checkingForUpdate: () => {
      checkInProgress = true;
      emitStatus({ phase: 'checking', availableVersion: undefined, shouldNotify: false });
    },
    updateAvailable: (info = {}) => {
      emitStatus({ phase: 'available', availableVersion: info.version, shouldNotify: false });
    },
    updateNotAvailable: () => {
      checkInProgress = false;
      emitStatus({ phase: 'upToDate', availableVersion: undefined, shouldNotify: false });
    },
    downloadProgress: () => {
      emitStatus({ phase: 'downloading', shouldNotify: false });
    },
    updateDownloaded: (info = {}) => {
      checkInProgress = false;
      emitStatus({ phase: 'ready', availableVersion: info.version, shouldNotify: false });
    },
    error: markError,
  };

  const registerListeners = () => {
    if (!automaticInstallationSupported || listenersRegistered) return;
    autoUpdater.on('checking-for-update', listeners.checkingForUpdate);
    autoUpdater.on('update-available', listeners.updateAvailable);
    autoUpdater.on('update-not-available', listeners.updateNotAvailable);
    autoUpdater.on('download-progress', listeners.downloadProgress);
    autoUpdater.on('update-downloaded', listeners.updateDownloaded);
    autoUpdater.on('error', listeners.error);
    listenersRegistered = true;
  };

  const unregisterListeners = () => {
    if (!listenersRegistered) return;
    autoUpdater.removeListener('checking-for-update', listeners.checkingForUpdate);
    autoUpdater.removeListener('update-available', listeners.updateAvailable);
    autoUpdater.removeListener('update-not-available', listeners.updateNotAvailable);
    autoUpdater.removeListener('download-progress', listeners.downloadProgress);
    autoUpdater.removeListener('update-downloaded', listeners.updateDownloaded);
    autoUpdater.removeListener('error', listeners.error);
    listenersRegistered = false;
  };

  const start = async () => {
    const preferences = await readPreferences();
    automaticUpdatesEnabled = preferences.automaticUpdatesEnabled !== false;
    dismissedUpdateVersion = parseReleaseVersion(preferences.dismissedUpdateVersion)
      ? preferences.dismissedUpdateVersion
      : undefined;

    if (!updateCheckSupported) {
      return emitStatus({ phase: 'unsupported', unsupportedReason: 'unavailable' });
    }

    if (automaticInstallationSupported) {
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      registerListeners();
    }
    scheduleChecks();
    return emitStatus({ phase: 'idle', unsupportedReason: undefined });
  };

  const setAutomaticUpdatesEnabled = async (enabled) => {
    if (!automaticInstallationSupported || typeof enabled !== 'boolean') return { ...status };

    try {
      const preferences = await readPreferences();
      await writePreferences({ ...preferences, automaticUpdatesEnabled: enabled });
    } catch (error) {
      return markError(error);
    }

    automaticUpdatesEnabled = enabled;
    scheduleChecks();
    return emitStatus({ phase: 'idle', shouldNotify: false });
  };

  const dismissAvailableVersion = async (version) => {
    if (
      !usesReleaseNotices
      || !parseReleaseVersion(version)
      || version !== status.availableVersion
    ) {
      return { ...status };
    }

    try {
      const preferences = await readPreferences();
      await writePreferences({ ...preferences, dismissedUpdateVersion: version });
    } catch (error) {
      return markError(error);
    }

    dismissedUpdateVersion = version;
    return emitStatus({ shouldNotify: false });
  };

  const dispose = () => {
    disposed = true;
    clearSchedule();
    unregisterListeners();
  };

  return {
    start,
    dispose,
    checkNow,
    setAutomaticUpdatesEnabled,
    dismissAvailableVersion,
    getStatus: () => ({ ...status }),
  };
};

module.exports = {
  UPDATE_INTERVAL_MS,
  UPDATE_START_DELAY_MS,
  compareReleaseVersions,
  createUpdateService,
  parseReleaseVersion,
};
