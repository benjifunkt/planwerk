const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const {
  UPDATE_INTERVAL_MS,
  UPDATE_START_DELAY_MS,
  compareReleaseVersions,
  createUpdateService,
  parseReleaseVersion,
} = require('../updater.cjs');

const createHarness = ({
  platform = 'win32',
  isPackaged = true,
  macUpdatesEnabled = false,
  preferences = {},
  appVersion = '1.0.0',
  latestRelease = { version: '1.1.0' },
  releaseError,
} = {}) => {
  const autoUpdater = new EventEmitter();
  let checks = 0;
  let releaseChecks = 0;
  autoUpdater.checkForUpdates = async () => {
    checks += 1;
  };

  let storedPreferences = { ...preferences };
  const writes = [];
  const statuses = [];
  const timeouts = [];
  const intervals = [];
  const clearedTimeouts = [];
  const clearedIntervals = [];
  const errors = [];
  const createTimer = (collection, handler, delay) => {
    const timer = { handler, delay, unref() {} };
    collection.push(timer);
    return timer;
  };

  const service = createUpdateService({
    app: { isPackaged, getVersion: () => appVersion },
    autoUpdater,
    platform,
    macUpdatesEnabled,
    readPreferences: async () => ({ ...storedPreferences }),
    writePreferences: async (nextPreferences) => {
      storedPreferences = { ...nextPreferences };
      writes.push({ ...nextPreferences });
    },
    fetchLatestRelease: async () => {
      releaseChecks += 1;
      if (releaseError) throw releaseError;
      return latestRelease;
    },
    sendStatus: status => statuses.push(status),
    setTimeoutFn: (handler, delay) => createTimer(timeouts, handler, delay),
    clearTimeoutFn: timer => clearedTimeouts.push(timer),
    setIntervalFn: (handler, delay) => createTimer(intervals, handler, delay),
    clearIntervalFn: timer => clearedIntervals.push(timer),
    logger: { error: (...args) => errors.push(args) },
  });

  return {
    autoUpdater,
    service,
    statuses,
    timeouts,
    intervals,
    clearedTimeouts,
    clearedIntervals,
    writes,
    errors,
    getChecks: () => checks,
    getReleaseChecks: () => releaseChecks,
  };
};

test('release versions are parsed and compared semantically', () => {
  assert.deepEqual(parseReleaseVersion('10.2.3'), [10, 2, 3]);
  assert.equal(parseReleaseVersion('v1.2.3'), null);
  assert.equal(parseReleaseVersion('1.2'), null);
  assert.equal(compareReleaseVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareReleaseVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareReleaseVersions('0.9.0', '1.0.0'), -1);
  assert.equal(compareReleaseVersions('not-a-version', '1.0.0'), null);
});

test('unsigned macOS builds schedule release checks without enabling automatic installation', async () => {
  const harness = createHarness({ platform: 'darwin' });

  const status = await harness.service.start();

  assert.equal(status.updateCheckSupported, true);
  assert.equal(status.automaticInstallationSupported, false);
  assert.equal(status.phase, 'idle');
  assert.equal(harness.timeouts[0].delay, UPDATE_START_DELAY_MS);
  assert.equal(harness.intervals[0].delay, UPDATE_INTERVAL_MS);

  await harness.timeouts[0].handler();

  assert.equal(harness.getReleaseChecks(), 1);
  assert.equal(harness.getChecks(), 0);
  assert.equal(harness.service.getStatus().phase, 'available');
  assert.equal(harness.service.getStatus().availableVersion, '1.1.0');
  assert.equal(harness.service.getStatus().shouldNotify, true);
});

test('macOS release notices are dismissed once per version but manual checks reopen them', async () => {
  const harness = createHarness({ platform: 'darwin', preferences: { currentPlanwerkPath: '/tmp/example.planwerk' } });
  await harness.service.start();
  await harness.service.checkNow();

  const dismissed = await harness.service.dismissAvailableVersion('1.1.0');
  assert.equal(dismissed.shouldNotify, false);
  assert.deepEqual(harness.writes, [{
    currentPlanwerkPath: '/tmp/example.planwerk',
    dismissedUpdateVersion: '1.1.0',
  }]);

  const automaticCheck = await harness.service.checkNow();
  assert.equal(automaticCheck.phase, 'available');
  assert.equal(automaticCheck.shouldNotify, false);

  const manualCheck = await harness.service.checkNow({ userInitiated: true });
  assert.equal(manualCheck.phase, 'available');
  assert.equal(manualCheck.shouldNotify, true);
});

test('stored macOS dismissals suppress automatic notices after restart', async () => {
  const harness = createHarness({
    platform: 'darwin',
    preferences: { dismissedUpdateVersion: '1.1.0' },
  });
  await harness.service.start();

  const status = await harness.service.checkNow();

  assert.equal(status.phase, 'available');
  assert.equal(status.shouldNotify, false);
});

test('macOS reports equal or older releases as up to date', async () => {
  const equalHarness = createHarness({ platform: 'darwin', latestRelease: { version: '1.0.0' } });
  await equalHarness.service.start();
  assert.equal((await equalHarness.service.checkNow()).phase, 'upToDate');

  const olderHarness = createHarness({ platform: 'darwin', latestRelease: { version: '0.9.0' } });
  await olderHarness.service.start();
  assert.equal((await olderHarness.service.checkNow()).phase, 'upToDate');
});

test('invalid and failed macOS release requests become safe error states', async () => {
  const invalidHarness = createHarness({ platform: 'darwin', latestRelease: { version: 'preview' } });
  await invalidHarness.service.start();
  const invalidStatus = await invalidHarness.service.checkNow();
  assert.equal(invalidStatus.phase, 'error');
  assert.equal(invalidStatus.shouldNotify, false);
  assert.equal(Object.hasOwn(invalidStatus, 'error'), false);

  const offlineHarness = createHarness({ platform: 'darwin', releaseError: new Error('private network detail') });
  await offlineHarness.service.start();
  const offlineStatus = await offlineHarness.service.checkNow();
  assert.equal(offlineStatus.phase, 'error');
  assert.equal(JSON.stringify(offlineStatus).includes('private network detail'), false);
  assert.equal(offlineHarness.errors.length, 1);
});

test('packaged Windows builds schedule quiet checks and map updater events to safe states', async () => {
  const harness = createHarness();

  const initial = await harness.service.start();
  assert.equal(initial.phase, 'idle');
  assert.equal(initial.updateCheckSupported, true);
  assert.equal(initial.automaticInstallationSupported, true);
  assert.equal(harness.autoUpdater.autoDownload, true);
  assert.equal(harness.autoUpdater.autoInstallOnAppQuit, true);
  assert.equal(harness.timeouts[0].delay, UPDATE_START_DELAY_MS);
  assert.equal(harness.intervals[0].delay, UPDATE_INTERVAL_MS);

  await harness.timeouts[0].handler();
  assert.equal(harness.getChecks(), 1);
  assert.equal(harness.getReleaseChecks(), 0);
  assert.equal(harness.service.getStatus().phase, 'checking');

  harness.autoUpdater.emit('update-available', { version: '1.0.1' });
  assert.equal(harness.service.getStatus().phase, 'available');
  assert.equal(harness.service.getStatus().availableVersion, '1.0.1');

  harness.autoUpdater.emit('download-progress', { percent: 50 });
  assert.equal(harness.service.getStatus().phase, 'downloading');

  harness.autoUpdater.emit('update-downloaded', { version: '1.0.1' });
  assert.equal(harness.service.getStatus().phase, 'ready');
  assert.equal(harness.service.getStatus().availableVersion, '1.0.1');
});

test('automatic update preference is stored outside workspace data and controls Windows scheduling', async () => {
  const harness = createHarness({ preferences: { currentPlanwerkPath: '/tmp/example.planwerk', automaticUpdatesEnabled: false } });

  const initial = await harness.service.start();
  assert.equal(initial.automaticUpdatesEnabled, false);
  assert.equal(harness.timeouts.length, 0);

  const enabled = await harness.service.setAutomaticUpdatesEnabled(true);
  assert.equal(enabled.automaticUpdatesEnabled, true);
  assert.deepEqual(harness.writes, [{ currentPlanwerkPath: '/tmp/example.planwerk', automaticUpdatesEnabled: true }]);
  assert.equal(harness.timeouts.length, 1);
  assert.equal(harness.intervals.length, 1);

  const disabled = await harness.service.setAutomaticUpdatesEnabled(false);
  assert.equal(disabled.automaticUpdatesEnabled, false);
  assert.equal(harness.clearedTimeouts.length, 1);
  assert.equal(harness.clearedIntervals.length, 1);
});

test('manual Windows checks remain available when automatic checks are disabled', async () => {
  const harness = createHarness({ preferences: { automaticUpdatesEnabled: false } });
  await harness.service.start();

  await harness.service.checkNow({ userInitiated: true });

  assert.equal(harness.getChecks(), 1);
  assert.equal(harness.service.getStatus().phase, 'checking');
});

test('updater errors are logged internally but never exposed to the renderer status', async () => {
  const harness = createHarness();
  await harness.service.start();
  harness.autoUpdater.emit('error', new Error('private internal updater detail'));

  const status = harness.service.getStatus();
  assert.equal(status.phase, 'error');
  assert.equal(Object.hasOwn(status, 'error'), false);
  assert.equal(JSON.stringify(status).includes('private internal updater detail'), false);
  assert.equal(harness.errors.length, 1);
});

test('unpackaged builds expose all update capabilities as unavailable', async () => {
  const harness = createHarness({ platform: 'darwin', isPackaged: false });
  const status = await harness.service.start();

  assert.equal(status.updateCheckSupported, false);
  assert.equal(status.automaticInstallationSupported, false);
  assert.equal(status.phase, 'unsupported');
  assert.equal(harness.timeouts.length, 0);
  assert.equal(harness.intervals.length, 0);
});

test('disposing the service removes schedules and updater listeners', async () => {
  const harness = createHarness();
  await harness.service.start();

  harness.service.dispose();

  assert.equal(harness.clearedTimeouts.length, 1);
  assert.equal(harness.clearedIntervals.length, 1);
  assert.equal(harness.autoUpdater.listenerCount('error'), 0);
  assert.equal(harness.autoUpdater.listenerCount('update-downloaded'), 0);
});
