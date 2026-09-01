const assert = require('assert');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  PLANWERK_JSON_FILE_MAX_BYTES,
  copyPlanwerkPackageWithTimestamp,
  ensurePlanwerkExtension,
  getPlanwerkPackageSignature,
  isMissingPlanwerkPackageError,
  isPlanwerkPackagePath,
  loadPlanwerkPackage,
  normalizePlanwerkData,
  writePlanwerkPackage,
} = require('../planwerkFile.cjs');

const makeTempDir = async () => fs.mkdtemp(path.join(os.tmpdir(), 'planwerk-file-test-'));

test('writes and loads a planwerk package as multiple JSON files', async () => {
  const root = await makeTempDir();
  const packagePath = path.join(root, 'Week.planwerk');
  const data = {
    tasks: [{ id: 'task_1', title: 'Task', reflectionValue: 0 }],
    projects: [{ id: 'proj_1', name: 'General' }],
    templates: [],
    settings: { theme: 'dark', language: 'de', sidebarCollapsed: true },
    analytics: { generalGoal: 'Build calmly' },
  };

  await writePlanwerkPackage(packagePath, data);

  const files = await fs.readdir(packagePath);
  assert.deepEqual(files.sort(), [
    'analytics.json',
    'manifest.json',
    'projects.json',
    'settings.json',
    'tasks.json',
    'templates.json',
  ]);

  const loaded = await loadPlanwerkPackage(packagePath);
  assert.equal(loaded.path, packagePath);
  assert.equal(loaded.data.tasks[0].title, 'Task');
  assert.equal(loaded.data.settings.theme, 'dark');
  assert.equal(loaded.data.analytics.generalGoal, 'Build calmly');
});

test('loads missing optional package files with empty defaults', async () => {
  const root = await makeTempDir();
  const packagePath = path.join(root, 'Sparse.planwerk');
  await fs.mkdir(packagePath);
  await fs.writeFile(
    path.join(packagePath, 'manifest.json'),
    JSON.stringify({ format: 'planwerk', version: 1 }, null, 2)
  );

  const loaded = await loadPlanwerkPackage(packagePath);

  assert.deepEqual(loaded.data.tasks, []);
  assert.deepEqual(loaded.data.projects, []);
  assert.deepEqual(loaded.data.templates, []);
  assert.deepEqual(loaded.data.settings, {
    onboarding: {
      version: 1,
      tutorial: {
        workWeek: true,
        createTask: true,
        board: true,
        autofill: true,
        cleanup: true,
        reflection: true,
        lookback: true,
        goals: true,
      },
      hints: {
        bulkTaskShortcut: { firstTaskCreated: false, shown: true },
        weeklyReflectionReminder: { shown: true, cleanupTutorialCompletedAt: null },
      },
    },
  });
  assert.deepEqual(loaded.data.analytics, {});
});

test('rejects directories without a valid manifest', async () => {
  const root = await makeTempDir();
  const packagePath = path.join(root, 'Broken.planwerk');
  await fs.mkdir(packagePath);
  await fs.writeFile(path.join(packagePath, 'manifest.json'), JSON.stringify({ format: 'other' }));

  await assert.rejects(
    () => loadPlanwerkPackage(packagePath),
    /not a valid Planwerk file/
  );
});

test('rejects malformed planwerk data instead of silently accepting it', () => {
  assert.throws(
    () => normalizePlanwerkData({ tasks: [{ id: 'task_1' }], projects: [], templates: [], settings: {}, analytics: {} }),
    /tasks\[0\]\.title is required/
  );

  assert.throws(
    () => normalizePlanwerkData({ tasks: 'not-an-array', projects: [], templates: [], settings: {}, analytics: {} }),
    /tasks must be an array/
  );
});

test('strips unknown object fields while preserving valid planwerk data', () => {
  const normalized = normalizePlanwerkData({
    tasks: [{ id: 'task_1', title: 'Task', unknown: 'ignored' }],
    projects: [{ id: 'proj_1', name: 'Project', unknown: 'ignored' }],
    templates: [],
    settings: { theme: 'dark', defaultDueDateOffsetDays: 7, unknown: 'ignored' },
    analytics: { generalGoal: 'Goal', unknown: 'ignored' },
    unknown: 'ignored',
  });

  assert.equal(normalized.tasks[0].title, 'Task');
  assert.equal(normalized.tasks[0].unknown, undefined);
  assert.equal(normalized.projects[0].unknown, undefined);
  assert.equal(normalized.settings.defaultDueDateOffsetDays, 7);
  assert.equal(normalized.settings.unknown, undefined);
  assert.equal(normalized.analytics.unknown, undefined);
});

test('preserves explicit backlog pin preferences in planwerk settings', () => {
  const pinned = normalizePlanwerkData({
    tasks: [], projects: [], templates: [], settings: { backlogPinned: true }, analytics: {},
  });
  const unpinned = normalizePlanwerkData({
    tasks: [], projects: [], templates: [], settings: { backlogPinned: false }, analytics: {},
  });

  assert.equal(pinned.settings.backlogPinned, true);
  assert.equal(unpinned.settings.backlogPinned, false);
});

test('preserves an optional immutable first reflection timestamp in analytics', () => {
  const withTimestamp = normalizePlanwerkData({
    tasks: [], projects: [], templates: [], settings: {}, analytics: { firstReflectionAt: 1234 },
  });
  const withExplicitNull = normalizePlanwerkData({
    tasks: [], projects: [], templates: [], settings: {}, analytics: { firstReflectionAt: null },
  });
  const legacy = normalizePlanwerkData({
    tasks: [], projects: [], templates: [], settings: {}, analytics: {},
  });

  assert.equal(withTimestamp.analytics.firstReflectionAt, 1234);
  assert.equal(withExplicitNull.analytics.firstReflectionAt, null);
  assert.equal(Object.hasOwn(legacy.analytics, 'firstReflectionAt'), false);
  assert.throws(
    () => normalizePlanwerkData({
      tasks: [], projects: [], templates: [], settings: {}, analytics: { firstReflectionAt: -1 },
    }),
    /analytics\.firstReflectionAt must be between/
  );
});

test('defaults missing onboarding settings to completed for existing planwerk files', () => {
  const normalized = normalizePlanwerkData({
    tasks: [],
    projects: [],
    templates: [],
    settings: {},
    analytics: {},
  });

  assert.deepEqual(normalized.settings.onboarding, {
    version: 1,
    tutorial: {
      workWeek: true,
      createTask: true,
      board: true,
      autofill: true,
      cleanup: true,
      reflection: true,
      lookback: true,
      goals: true,
    },
    hints: {
      bulkTaskShortcut: { firstTaskCreated: false, shown: true },
      weeklyReflectionReminder: { shown: true, cleanupTutorialCompletedAt: null },
    },
  });

  const normalizedWithoutSettings = normalizePlanwerkData({
    tasks: [],
    projects: [],
    templates: [],
    analytics: {},
  });

  assert.deepEqual(normalizedWithoutSettings.settings.onboarding, {
    version: 1,
    tutorial: {
      workWeek: true,
      createTask: true,
      board: true,
      autofill: true,
      cleanup: true,
      reflection: true,
      lookback: true,
      goals: true,
    },
    hints: {
      bulkTaskShortcut: { firstTaskCreated: false, shown: true },
      weeklyReflectionReminder: { shown: true, cleanupTutorialCompletedAt: null },
    },
  });
});

test('preserves explicit incomplete onboarding settings for new planwerk files', () => {
  const normalized = normalizePlanwerkData({
    tasks: [],
    projects: [],
    templates: [],
    settings: {
      onboarding: {
        version: 1,
        tutorial: {
          workWeek: false,
          createTask: false,
          board: false,
          autofill: false,
          cleanup: false,
          reflection: false,
          lookback: false,
          goals: false,
        },
        hints: {
          weeklyReflectionReminder: { shown: false, cleanupTutorialCompletedAt: null },
        },
      },
    },
    analytics: {},
  });

  assert.deepEqual(normalized.settings.onboarding, {
    version: 1,
    tutorial: {
      workWeek: false,
      createTask: false,
      board: false,
      autofill: false,
      cleanup: false,
      reflection: false,
      lookback: false,
      goals: false,
    },
    hints: {
      bulkTaskShortcut: { firstTaskCreated: false, shown: false },
      weeklyReflectionReminder: { shown: false, cleanupTutorialCompletedAt: null },
    },
  });
});

test('preserves explicit bulk task shortcut hint progress', () => {
  const normalized = normalizePlanwerkData({
    tasks: [],
    projects: [],
    templates: [],
    settings: {
      onboarding: {
        version: 1,
        tutorial: {
          workWeek: true,
          createTask: true,
          board: true,
          autofill: false,
          cleanup: false,
          reflection: false,
          lookback: false,
          goals: false,
        },
        hints: {
          bulkTaskShortcut: {
            firstTaskCreated: true,
            shown: false,
          },
        },
      },
    },
    analytics: {},
  });

  assert.deepEqual(normalized.settings.onboarding.hints, {
    bulkTaskShortcut: {
      firstTaskCreated: true,
      shown: false,
    },
    weeklyReflectionReminder: {
      shown: true,
    },
  });
});

test('defaults missing create task onboarding to completed for existing planwerk files', () => {
  const normalized = normalizePlanwerkData({
    tasks: [],
    projects: [],
    templates: [],
    settings: {
      onboarding: {
        version: 1,
        tutorial: {
          workWeek: true,
        },
      },
    },
    analytics: {},
  });

  assert.deepEqual(normalized.settings.onboarding, {
    version: 1,
    tutorial: {
      workWeek: true,
      createTask: true,
      board: true,
      autofill: true,
      cleanup: true,
      reflection: true,
      lookback: true,
      goals: true,
    },
    hints: {
      bulkTaskShortcut: { firstTaskCreated: false, shown: true },
      weeklyReflectionReminder: { shown: true },
    },
  });
});

test('defaults missing board onboarding to completed for existing planwerk files', () => {
  const normalized = normalizePlanwerkData({
    tasks: [],
    projects: [],
    templates: [],
    settings: {
      onboarding: {
        version: 1,
        tutorial: {
          workWeek: true,
          createTask: true,
        },
      },
    },
    analytics: {},
  });

  assert.deepEqual(normalized.settings.onboarding, {
    version: 1,
    tutorial: {
      workWeek: true,
      createTask: true,
      board: true,
      autofill: true,
      cleanup: true,
      reflection: true,
      lookback: true,
      goals: true,
    },
    hints: {
      bulkTaskShortcut: { firstTaskCreated: false, shown: true },
      weeklyReflectionReminder: { shown: true },
    },
  });
});

test('defaults missing secondary onboarding to completed for existing planwerk files', () => {
  const normalized = normalizePlanwerkData({
    tasks: [],
    projects: [],
    templates: [],
    settings: {
      onboarding: {
        version: 1,
        tutorial: {
          workWeek: true,
          createTask: true,
          board: true,
        },
      },
    },
    analytics: {},
  });

  assert.deepEqual(normalized.settings.onboarding, {
    version: 1,
    tutorial: {
      workWeek: true,
      createTask: true,
      board: true,
      autofill: true,
      cleanup: true,
      reflection: true,
      lookback: true,
      goals: true,
    },
    hints: {
      bulkTaskShortcut: { firstTaskCreated: false, shown: true },
      weeklyReflectionReminder: { shown: true },
    },
  });
});

test('defaults missing view onboarding to completed for existing planwerk files', () => {
  const normalized = normalizePlanwerkData({
    tasks: [],
    projects: [],
    templates: [],
    settings: {
      onboarding: {
        version: 1,
        tutorial: {
          workWeek: true,
          createTask: true,
          board: true,
          autofill: true,
          cleanup: true,
        },
      },
    },
    analytics: {},
  });

  assert.deepEqual(normalized.settings.onboarding, {
    version: 1,
    tutorial: {
      workWeek: true,
      createTask: true,
      board: true,
      autofill: true,
      cleanup: true,
      reflection: true,
      lookback: true,
      goals: true,
    },
    hints: {
      bulkTaskShortcut: { firstTaskCreated: false, shown: true },
      weeklyReflectionReminder: { shown: true },
    },
  });
});

test('accepts zero max hours for hidden work week days', () => {
  const normalized = normalizePlanwerkData({
    tasks: [],
    projects: [],
    templates: [],
    settings: {
      visibleDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      maxHoursPerDayByDay: {
        mon: 4,
        tue: 4,
        wed: 4,
        thu: 4,
        fri: 4,
        sat: 0,
        sun: 0,
      },
    },
    analytics: {},
  });

  assert.equal(normalized.settings.maxHoursPerDayByDay.sat, 0);
  assert.equal(normalized.settings.maxHoursPerDayByDay.sun, 0);
  assert.deepEqual(normalized.settings.visibleDays, ['mon', 'tue', 'wed', 'thu', 'fri']);
});

test('preserves a valid week start day and normalizes unsupported values to monday', () => {
  const wednesday = normalizePlanwerkData({
    tasks: [],
    projects: [],
    templates: [],
    settings: { weekStartDay: 'wed' },
    analytics: {},
  });
  const unsupported = normalizePlanwerkData({
    tasks: [],
    projects: [],
    templates: [],
    settings: { weekStartDay: 'holiday' },
    analytics: {},
  });

  assert.equal(wednesday.settings.weekStartDay, 'wed');
  assert.equal(unsupported.settings.weekStartDay, 'mon');
});

test('rejects invalid onboarding settings', () => {
  assert.throws(
    () => normalizePlanwerkData({
      tasks: [],
      projects: [],
      templates: [],
      settings: {
        onboarding: {
          version: 1,
          tutorial: {
            workWeek: 'done',
          },
        },
      },
      analytics: {},
    }),
    /settings\.onboarding\.tutorial\.workWeek must be a boolean/
  );

  assert.throws(
    () => normalizePlanwerkData({
      tasks: [],
      projects: [],
      templates: [],
      settings: {
        onboarding: {
          version: 1,
          tutorial: {
            workWeek: true,
            createTask: 'done',
          },
        },
      },
      analytics: {},
    }),
    /settings\.onboarding\.tutorial\.createTask must be a boolean/
  );

  assert.throws(
    () => normalizePlanwerkData({
      tasks: [],
      projects: [],
      templates: [],
      settings: {
        onboarding: {
          version: 1,
          tutorial: {
            workWeek: true,
            createTask: true,
            board: 'done',
          },
        },
      },
      analytics: {},
    }),
    /settings\.onboarding\.tutorial\.board must be a boolean/
  );

  assert.throws(
    () => normalizePlanwerkData({
      tasks: [],
      projects: [],
      templates: [],
      settings: {
        onboarding: {
          version: 1,
          tutorial: {
            workWeek: true,
            createTask: true,
            board: true,
            autofill: 'done',
          },
        },
      },
      analytics: {},
    }),
    /settings\.onboarding\.tutorial\.autofill must be a boolean/
  );

  assert.throws(
    () => normalizePlanwerkData({
      tasks: [],
      projects: [],
      templates: [],
      settings: {
        onboarding: {
          version: 1,
          tutorial: {
            workWeek: true,
            createTask: true,
            board: true,
            cleanup: 'done',
          },
        },
      },
      analytics: {},
    }),
    /settings\.onboarding\.tutorial\.cleanup must be a boolean/
  );

  assert.throws(
    () => normalizePlanwerkData({
      tasks: [],
      projects: [],
      templates: [],
      settings: {
        onboarding: {
          version: 1,
          tutorial: {
            workWeek: true,
            createTask: true,
            board: true,
            autofill: true,
            cleanup: true,
            reflection: 'done',
          },
        },
      },
      analytics: {},
    }),
    /settings\.onboarding\.tutorial\.reflection must be a boolean/
  );

  assert.throws(
    () => normalizePlanwerkData({
      tasks: [],
      projects: [],
      templates: [],
      settings: {
        onboarding: {
          version: 1,
          tutorial: {
            workWeek: true,
            createTask: true,
            board: true,
            autofill: true,
            cleanup: true,
            lookback: 'done',
          },
        },
      },
      analytics: {},
    }),
    /settings\.onboarding\.tutorial\.lookback must be a boolean/
  );

  assert.throws(
    () => normalizePlanwerkData({
      tasks: [],
      projects: [],
      templates: [],
      settings: {
        onboarding: {
          version: 1,
          tutorial: {
            workWeek: true,
            createTask: true,
            board: true,
            autofill: true,
            cleanup: true,
            goals: 'done',
          },
        },
      },
      analytics: {},
    }),
    /settings\.onboarding\.tutorial\.goals must be a boolean/
  );

  assert.throws(
    () => normalizePlanwerkData({
      tasks: [],
      projects: [],
      templates: [],
      settings: {
        onboarding: {
          version: 1,
          tutorial: { board: false },
          hints: {
            bulkTaskShortcut: {
              firstTaskCreated: 'yes',
            },
          },
        },
      },
      analytics: {},
    }),
    /settings\.onboarding\.hints\.bulkTaskShortcut\.firstTaskCreated must be a boolean/
  );

  assert.throws(
    () => normalizePlanwerkData({
      tasks: [],
      projects: [],
      templates: [],
      settings: {
        onboarding: {
          version: 1,
          tutorial: { board: false },
          hints: {
            bulkTaskShortcut: {
              shown: 'yes',
            },
          },
        },
      },
      analytics: {},
    }),
    /settings\.onboarding\.hints\.bulkTaskShortcut\.shown must be a boolean/
  );

  assert.throws(
    () => normalizePlanwerkData({
      tasks: [],
      projects: [],
      templates: [],
      settings: {
        onboarding: {
          version: 1,
          tutorial: { board: false },
          hints: {
            weeklyReflectionReminder: {
              shown: 'yes',
            },
          },
        },
      },
      analytics: {},
    }),
    /settings\.onboarding\.hints\.weeklyReflectionReminder\.shown must be a boolean/
  );

  assert.throws(
    () => normalizePlanwerkData({
      tasks: [],
      projects: [],
      templates: [],
      settings: {
        onboarding: {
          version: 1,
          tutorial: { board: false },
          hints: {
            weeklyReflectionReminder: {
              shown: false,
              cleanupTutorialCompletedAt: 'yesterday',
            },
          },
        },
      },
      analytics: {},
    }),
    /settings\.onboarding\.hints\.weeklyReflectionReminder\.cleanupTutorialCompletedAt must be a finite number/
  );
});

test('rejects invalid default due date offsets in settings', () => {
  assert.throws(
    () => normalizePlanwerkData({
      tasks: [],
      projects: [],
      templates: [],
      settings: { defaultDueDateOffsetDays: -1 },
      analytics: {},
    }),
    /settings\.defaultDueDateOffsetDays/
  );

  assert.throws(
    () => normalizePlanwerkData({
      tasks: [],
      projects: [],
      templates: [],
      settings: { defaultDueDateOffsetDays: 1.5 },
      analytics: {},
    }),
    /settings\.defaultDueDateOffsetDays/
  );
});

test('rejects planwerk JSON files above the local size limit', async () => {
  const root = await makeTempDir();
  const packagePath = path.join(root, 'Huge.planwerk');
  await fs.mkdir(packagePath);
  await fs.writeFile(
    path.join(packagePath, 'manifest.json'),
    JSON.stringify({ format: 'planwerk', version: 1 }, null, 2)
  );
  await fs.writeFile(
    path.join(packagePath, 'tasks.json'),
    `[{"id":"task_1","title":"${'x'.repeat(PLANWERK_JSON_FILE_MAX_BYTES)}"}]`
  );

  await assert.rejects(
    () => loadPlanwerkPackage(packagePath),
    /too large/
  );
});

test('rejects symlinked planwerk JSON members while loading', { skip: process.platform === 'win32' }, async () => {
  const root = await makeTempDir();
  const packagePath = path.join(root, 'Linked.planwerk');
  const outsidePath = path.join(root, 'outside-tasks.json');
  await fs.mkdir(packagePath);
  await fs.writeFile(
    path.join(packagePath, 'manifest.json'),
    JSON.stringify({ format: 'planwerk', version: 1 }, null, 2)
  );
  await fs.writeFile(outsidePath, JSON.stringify([{ id: 'task_1', title: 'Outside data' }]));
  await fs.symlink(outsidePath, path.join(packagePath, 'tasks.json'));

  await assert.rejects(
    () => loadPlanwerkPackage(packagePath),
    /must be a regular file/
  );
});

test('rejects symlinked planwerk JSON members while calculating package signatures', { skip: process.platform === 'win32' }, async () => {
  const root = await makeTempDir();
  const packagePath = path.join(root, 'SignatureLinked.planwerk');
  const outsidePath = path.join(root, 'outside-tasks.json');
  await writePlanwerkPackage(packagePath, {
    tasks: [{ id: 'task_1', title: 'Before' }],
    projects: [],
    templates: [],
    settings: {},
    analytics: {},
  });
  await fs.writeFile(outsidePath, JSON.stringify([{ id: 'task_2', title: 'Outside data' }]));
  await fs.rm(path.join(packagePath, 'tasks.json'));
  await fs.symlink(outsidePath, path.join(packagePath, 'tasks.json'));

  await assert.rejects(
    () => getPlanwerkPackageSignature(packagePath),
    /must be a regular file/
  );
});

test('writes through exclusive random temp files without following stale predictable symlinks', { skip: process.platform === 'win32' }, async () => {
  const root = await makeTempDir();
  const packagePath = path.join(root, 'TempSymlink.planwerk');
  const outsidePath = path.join(root, 'outside.txt');
  await writePlanwerkPackage(packagePath, {
    tasks: [{ id: 'task_1', title: 'Before' }],
    projects: [],
    templates: [],
    settings: {},
    analytics: {},
  });
  await fs.writeFile(outsidePath, 'outside-original', 'utf8');
  await fs.symlink(outsidePath, path.join(packagePath, 'tasks.json.tmp'));

  await writePlanwerkPackage(packagePath, {
    tasks: [{ id: 'task_1', title: 'After' }],
    projects: [],
    templates: [],
    settings: {},
    analytics: {},
  });

  assert.equal(await fs.readFile(outsidePath, 'utf8'), 'outside-original');
  assert.equal((await loadPlanwerkPackage(packagePath)).data.tasks[0].title, 'After');
  assert.equal((await fs.lstat(path.join(packagePath, 'tasks.json.tmp'))).isSymbolicLink(), true);
});

test('keeps planwerk JSON members private after creation and rewrite', { skip: process.platform === 'win32' }, async () => {
  const root = await makeTempDir();
  const packagePath = path.join(root, 'Private.planwerk');
  const data = {
    tasks: [{ id: 'task_1', title: 'Private task' }],
    projects: [],
    templates: [],
    settings: {},
    analytics: {},
  };

  await writePlanwerkPackage(packagePath, data);
  const tasksPath = path.join(packagePath, 'tasks.json');
  assert.equal((await fs.stat(tasksPath)).mode & 0o777, 0o600);

  await fs.chmod(tasksPath, 0o666);
  await writePlanwerkPackage(packagePath, data);
  assert.equal((await fs.stat(tasksPath)).mode & 0o777, 0o600);
});

test('concurrent saves use distinct temp files and leave complete JSON members', async () => {
  const root = await makeTempDir();
  const packagePath = path.join(root, 'Concurrent.planwerk');
  const writes = Array.from({ length: 8 }, (_, index) => writePlanwerkPackage(packagePath, {
    tasks: [{ id: 'task_1', title: `Run ${index}` }],
    projects: [],
    templates: [],
    settings: {},
    analytics: {},
  }));

  await Promise.all(writes);

  const loaded = await loadPlanwerkPackage(packagePath);
  assert.match(loaded.data.tasks[0].title, /^Run [0-7]$/);
  assert.deepEqual(
    (await fs.readdir(packagePath)).filter(fileName => fileName.endsWith('.tmp')),
    []
  );
});

test('normalizes new package paths to the .planwerk suffix', () => {
  assert.equal(ensurePlanwerkExtension('/tmp/My Week'), '/tmp/My Week.planwerk');
  assert.equal(ensurePlanwerkExtension('/tmp/My Week.planwerk'), '/tmp/My Week.planwerk');
  assert.equal(ensurePlanwerkExtension('/tmp/My Week.PLANWERK'), '/tmp/My Week.PLANWERK');
});

test('recognizes only .planwerk package paths', () => {
  assert.equal(isPlanwerkPackagePath('/tmp/My Week.planwerk'), true);
  assert.equal(isPlanwerkPackagePath('/tmp/My Week.PLANWERK'), true);
  assert.equal(isPlanwerkPackagePath('/tmp/My Week'), false);
  assert.equal(isPlanwerkPackagePath('/tmp/My Week.planwerk.backup'), false);
});

test('rejects valid manifests outside .planwerk directories', async () => {
  const root = await makeTempDir();
  const packagePath = path.join(root, 'PlainFolder');
  await fs.mkdir(packagePath);
  await fs.writeFile(
    path.join(packagePath, 'manifest.json'),
    JSON.stringify({ format: 'planwerk', version: 1 }, null, 2)
  );

  await assert.rejects(
    () => loadPlanwerkPackage(packagePath),
    /Please select a \.planwerk file/
  );
});

test('identifies missing planwerk package errors', async () => {
  const root = await makeTempDir();
  const packagePath = path.join(root, 'Missing.planwerk');

  await assert.rejects(
    async () => {
      try {
        await loadPlanwerkPackage(packagePath);
      } catch (error) {
        assert.equal(isMissingPlanwerkPackageError(error), true);
        throw error;
      }
    },
    /ENOENT/
  );

  assert.equal(isMissingPlanwerkPackageError(new Error('not found')), false);
});

test('package signature changes when one JSON file changes', async () => {
  const root = await makeTempDir();
  const packagePath = path.join(root, 'Signature.planwerk');
  await writePlanwerkPackage(packagePath, {
    tasks: [{ id: 'task_1', title: 'Before' }],
    projects: [],
    templates: [],
    settings: {},
    analytics: {},
  });

  const before = await getPlanwerkPackageSignature(packagePath);
  await new Promise(resolve => setTimeout(resolve, 10));
  await fs.writeFile(
    path.join(packagePath, 'tasks.json'),
    `${JSON.stringify([{ id: 'task_1', title: 'After' }], null, 2)}\n`
  );
  const after = await getPlanwerkPackageSignature(packagePath);

  assert.notEqual(after.signature, before.signature);
  assert.ok(after.updatedAt);
});

test('copies a conflict version beside the current planwerk package', async () => {
  const root = await makeTempDir();
  const packagePath = path.join(root, 'Conflict.planwerk');
  const data = {
    tasks: [{ id: 'task_1', title: 'External' }],
    projects: [],
    templates: [],
    settings: {},
    analytics: {},
  };
  await writePlanwerkPackage(packagePath, data);

  const copied = await copyPlanwerkPackageWithTimestamp(packagePath, data, new Date(2026, 4, 4, 19, 30, 12));

  assert.equal(path.dirname(copied.path), root);
  assert.match(path.basename(copied.path), /^Conflict\.external-2026-05-04-19-30-12\.planwerk$/);
  assert.equal(copied.data.tasks[0].title, 'External');
});
