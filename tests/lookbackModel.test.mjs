import assert from 'node:assert/strict';
import test from 'node:test';

process.env.TZ = 'Europe/Berlin';

const modelModuleUrl = new URL('../components/lookback/lookbackModel.ts', import.meta.url);
const lookbackCombinedStatusModuleUrl = new URL('../i18n/lookbackCombinedStatus.ts', import.meta.url);

test('lookback model exposes the planned pure helper boundary', async () => {
  const model = await import(modelModuleUrl).catch(() => null);

  assert.ok(model, 'lookback model module should exist');
  assert.equal(typeof model.getLookbackAvailability, 'function');
  assert.equal(typeof model.getCombinedStatusKey, 'function');
  assert.equal(typeof model.getCombinedStatusTextKey, 'function');
  assert.equal(typeof model.mergeProjectConcerns, 'function');
  assert.equal(typeof model.getProjectAwardIds, 'function');
});

test('lookback availability stays locked until the first reflection', async () => {
  const { getLookbackAvailability } = await import(modelModuleUrl);
  const availability = getLookbackAvailability(null, Date.UTC(2026, 0, 31, 12));

  assert.deepEqual(availability, {
    last2Weeks: {
      isUnlocked: false,
      unlockAt: null,
      daysRemaining: null,
      lockReason: 'needsFirstReflection',
    },
    last3Months: {
      isUnlocked: false,
      unlockAt: null,
      daysRemaining: null,
      lockReason: 'waitingForFirstReflection',
    },
    overall: {
      isUnlocked: false,
      unlockAt: null,
      daysRemaining: null,
      lockReason: 'waitingForFirstReflection',
    },
  });
});

test('lookback availability unlocks at 21 days and three clamped calendar months', async () => {
  const { getLookbackAvailability } = await import(modelModuleUrl);
  const firstReflectionAt = new Date(2026, 0, 31, 12).getTime();
  const initial = getLookbackAvailability(firstReflectionAt, firstReflectionAt);

  assert.equal(initial.last2Weeks.isUnlocked, true);
  assert.equal(initial.last3Months.daysRemaining, 21);
  assert.equal(initial.overall.daysRemaining, 89);
  assert.equal(initial.overall.unlockAt, new Date(2026, 3, 30, 12).getTime());

  const threeWeeksLater = getLookbackAvailability(
    firstReflectionAt,
    firstReflectionAt + (21 * 24 * 60 * 60 * 1000)
  );
  assert.equal(threeWeeksLater.last3Months.isUnlocked, true);
  assert.equal(threeWeeksLater.last3Months.daysRemaining, 0);

  const threeMonthsLater = getLookbackAvailability(firstReflectionAt, new Date(2026, 3, 30, 12).getTime());
  assert.equal(threeMonthsLater.overall.isUnlocked, true);
  assert.equal(threeMonthsLater.overall.daysRemaining, 0);
});

test('calendar month clamping preserves local wall-clock time across daylight saving', async () => {
  const { addCalendarMonthsClamped } = await import(modelModuleUrl);
  const firstReflectionAt = new Date(2026, 0, 31, 12, 0, 0).getTime();
  const unlockAt = addCalendarMonthsClamped(firstReflectionAt, 3);

  assert.equal(unlockAt, new Date(2026, 3, 30, 12, 0, 0).getTime());
});

test('summary status keeps the existing shared thresholds', async () => {
  const { getSummaryStatus } = await import(modelModuleUrl);

  assert.equal(getSummaryStatus(0.9, 0), 'reprioritize');
  assert.equal(getSummaryStatus(2.8, 40), 'reprioritize');
  assert.equal(getSummaryStatus(1.4, 0), 'recalibrate');
  assert.equal(getSummaryStatus(2.8, 30), 'recalibrate');
  assert.equal(getSummaryStatus(2, 0), 'keepEye');
  assert.equal(getSummaryStatus(2.8, 20), 'keepEye');
  assert.equal(getSummaryStatus(2.6, 10), 'veryStrong');
  assert.equal(getSummaryStatus(2.5, 10), 'goodRange');
});

test('combined status key keeps fixed period order and marks locked cards', async () => {
  const { getCombinedStatusKey } = await import(modelModuleUrl);
  const sections = [
    { id: 'last2Weeks', summaryData: { status: 'goodRange' } },
    { id: 'last3Months', summaryData: { status: 'noReflections' } },
    { id: 'overall', summaryData: { status: 'veryStrong' } },
  ];
  const availability = {
    last2Weeks: { isUnlocked: true },
    last3Months: { isUnlocked: true },
    overall: { isUnlocked: false },
  };

  assert.equal(
    getCombinedStatusKey(sections, availability),
    'goodRange|noReflections|locked'
  );
});

test('combined status text keys normalize locked periods to no reflections', async () => {
  const { getCombinedStatusTextKey } = await import(modelModuleUrl);

  assert.equal(
    getCombinedStatusTextKey('locked|locked|locked', []),
    'analytics.combinedStatus.noReflections.noReflections.noReflections'
  );
  assert.equal(
    getCombinedStatusTextKey('goodRange|noReflections|locked', []),
    'analytics.combinedStatus.goodRange.noReflections.noReflections'
  );
  assert.equal(
    getCombinedStatusTextKey('goodRange|veryStrong|veryStrong', []),
    'analytics.combinedStatus.goodRange.veryStrong.veryStrong'
  );
});

test('combined status text key uses the all useful exception only for fully useful recent strong periods', async () => {
  const { getCombinedStatusTextKey } = await import(modelModuleUrl);
  const sections = [
    { id: 'last2Weeks', summaryData: { status: 'veryStrong', usefulPercent: 100 } },
    { id: 'last3Months', summaryData: { status: 'veryStrong', usefulPercent: 100 } },
    { id: 'overall', summaryData: { status: 'veryStrong', usefulPercent: 80 } },
  ];

  assert.equal(
    getCombinedStatusTextKey('veryStrong|veryStrong|veryStrong', sections),
    'analytics.combinedStatus.veryStrong.veryStrong.veryStrong.allUsefulRecent'
  );
  assert.equal(
    getCombinedStatusTextKey('veryStrong|veryStrong|veryStrong', [
      { id: 'last2Weeks', summaryData: { status: 'veryStrong', usefulPercent: 100 } },
      { id: 'last3Months', summaryData: { status: 'veryStrong', usefulPercent: 99 } },
      { id: 'overall', summaryData: { status: 'veryStrong', usefulPercent: 100 } },
    ]),
    'analytics.combinedStatus.veryStrong.veryStrong.veryStrong'
  );
  assert.equal(
    getCombinedStatusTextKey('veryStrong|goodRange|veryStrong', sections),
    'analytics.combinedStatus.veryStrong.goodRange.veryStrong'
  );
});

test('combined status translations keep matching German and English key sets', async () => {
  const { lookbackCombinedStatusDe, lookbackCombinedStatusEn } = await import(lookbackCombinedStatusModuleUrl);
  const englishKeys = Object.keys(lookbackCombinedStatusEn).sort();
  const germanKeys = Object.keys(lookbackCombinedStatusDe).sort();

  assert.equal(englishKeys.length, 157);
  assert.deepEqual(germanKeys, englishKeys);
  assert.ok(englishKeys.includes('analytics.combinedStatus.veryStrong.veryStrong.veryStrong.allUsefulRecent'));
});

test('project awards include every score and duration tie', async () => {
  const { getProjectAwardIds } = await import(modelModuleUrl);
  const projects = [
    { projectId: 'alpha', AverageValue: 2.5, Duration: 60 },
    { projectId: 'beta', AverageValue: 2, Duration: 120 },
    { projectId: 'gamma', AverageValue: 2.5, Duration: 120 },
  ];

  assert.deepEqual(getProjectAwardIds(projects), {
    mostSuccessful: ['alpha', 'gamma'],
    mostTime: ['beta', 'gamma'],
  });
  assert.deepEqual(getProjectAwardIds([]), {
    mostSuccessful: [],
    mostTime: [],
  });
});

test('project data includes duration distributions and sorts projects by longest duration first', async () => {
  const { buildLookbackSections } = await import(modelModuleUrl);
  const now = Date.UTC(2026, 5, 23, 12);
  const recent = now - (24 * 60 * 60 * 1000);
  const tasks = [
    { id: 'zulu', isDone: true, reflectionValue: 3, duration: 10, projectId: 'zulu', completedAt: recent, reflectedAt: recent, updatedAt: recent },
    { id: 'alpha', isDone: true, reflectionValue: 3, duration: 10, projectId: 'alpha', completedAt: recent, reflectedAt: recent, updatedAt: recent },
    { id: 'useful', isDone: true, reflectionValue: 3, duration: 90, projectId: 'middle', completedAt: recent, reflectedAt: recent, updatedAt: recent },
    { id: 'somewhat', isDone: true, reflectionValue: 2, duration: 30, projectId: 'middle', completedAt: recent, reflectedAt: recent, updatedAt: recent },
    { id: 'not-useful', isDone: true, reflectionValue: 1, duration: 30, projectId: 'middle', completedAt: recent, reflectedAt: recent, updatedAt: recent },
    { id: 'zero', isDone: true, reflectionValue: 3, duration: 0, projectId: 'zero', completedAt: recent, reflectedAt: recent, updatedAt: recent },
  ];
  const [last2Weeks] = buildLookbackSections(
    tasks,
    [
      { id: 'zulu', name: 'Zulu' },
      { id: 'alpha', name: 'Alpha' },
      { id: 'middle', name: 'Middle' },
      { id: 'zero', name: 'Zero' },
    ],
    'Unknown',
    now
  );

  assert.deepEqual(last2Weeks.projectData.map(project => project.name), ['Middle', 'Alpha', 'Zulu']);
  assert.deepEqual(last2Weeks.projectData.find(project => project.projectId === 'middle'), {
    projectId: 'middle',
    name: 'Middle',
    AverageValue: 2,
    Duration: 150,
    distributionData: [
      { key: 'NotUseful', minutes: 30, percent: 20 },
      { key: 'Somewhat', minutes: 30, percent: 20 },
      { key: 'Useful', minutes: 90, percent: 60 },
    ],
  });
});

test('project concern classification follows recent scores and improvement thresholds', async () => {
  const { classifyProjectConcern } = await import(modelModuleUrl);

  assert.equal(classifyProjectConcern(null, 0.5), null);
  assert.equal(classifyProjectConcern(0.99, 0.5), 'urgent');
  assert.equal(classifyProjectConcern(1, null), 'warning');
  assert.equal(classifyProjectConcern(1.99, 2.5), 'warning');
  assert.equal(classifyProjectConcern(2, 1.61), 'warning');
  assert.equal(classifyProjectConcern(2, 1.6), 'improved');
  assert.equal(classifyProjectConcern(2.19, 1.8), 'warning');
  assert.equal(classifyProjectConcern(2.2, 1.8), 'improved');
  assert.equal(classifyProjectConcern(2.4, 2), null);
  assert.equal(classifyProjectConcern(2.4, null), null);
});

test('project concerns classify projects once from unlocked recent period scores', async () => {
  const { mergeProjectConcerns } = await import(modelModuleUrl);
  const sections = [
    {
      id: 'last2Weeks',
      projectData: [
        { projectId: 'alpha', name: 'Zulu urgent', AverageValue: 0.99 },
        { projectId: 'beta', name: 'Beta warning', AverageValue: 1 },
        { projectId: 'gamma', name: 'Gamma improved', AverageValue: 2.2 },
        { projectId: 'delta', name: 'Alpha warning', AverageValue: 2.19 },
        { projectId: 'epsilon', name: 'No concern', AverageValue: 2.4 },
      ],
    },
    {
      id: 'last3Months',
      projectData: [
        { projectId: 'alpha', name: 'Zulu urgent', AverageValue: 0.5 },
        { projectId: 'beta', name: 'Beta warning', AverageValue: 0.5 },
        { projectId: 'gamma', name: 'Gamma improved', AverageValue: 1.8 },
        { projectId: 'delta', name: 'Alpha warning', AverageValue: 1.8 },
        { projectId: 'epsilon', name: 'No concern', AverageValue: 2 },
        { projectId: 'three-months-only', name: 'No recent data', AverageValue: 0.2 },
      ],
    },
    {
      id: 'overall',
      projectData: [{ projectId: 'overall-only', name: 'Ignored overall', AverageValue: 0 }],
    },
  ];
  const bothRecentPeriods = {
    last2Weeks: { isUnlocked: true },
    last3Months: { isUnlocked: true },
    overall: { isUnlocked: true },
  };

  assert.deepEqual(mergeProjectConcerns(sections, bothRecentPeriods), {
    urgent: [{ projectId: 'alpha', name: 'Zulu urgent' }],
    warning: [
      { projectId: 'delta', name: 'Alpha warning' },
      { projectId: 'beta', name: 'Beta warning' },
    ],
    improved: [{ projectId: 'gamma', name: 'Gamma improved' }],
  });

  assert.deepEqual(mergeProjectConcerns(sections, {
    ...bothRecentPeriods,
    last3Months: { isUnlocked: false },
  }), {
    urgent: [{ projectId: 'alpha', name: 'Zulu urgent' }],
    warning: [{ projectId: 'beta', name: 'Beta warning' }],
    improved: [],
  });

  assert.deepEqual(mergeProjectConcerns(sections, {
    ...bothRecentPeriods,
    last2Weeks: { isUnlocked: false },
  }), {
    urgent: [],
    warning: [],
    improved: [],
  });
});

test('lookback sections preserve the three windows and project ids', async () => {
  const { buildLookbackSections } = await import(modelModuleUrl);
  const now = Date.UTC(2026, 5, 22, 12);
  const day = 24 * 60 * 60 * 1000;
  const tasks = [
    {
      id: 'recent', isDone: true, reflectionValue: 3, duration: 60, projectId: 'alpha',
      completedAt: now - day, reflectedAt: now - day, updatedAt: now - day,
    },
    {
      id: 'twenty-days', isDone: true, reflectionValue: 1, duration: 30, projectId: 'beta',
      completedAt: now - (20 * day), reflectedAt: now - (20 * day), updatedAt: now - (20 * day),
    },
    {
      id: 'old', isDone: true, reflectionValue: 2, duration: 15, projectId: 'alpha',
      completedAt: now - (120 * day), reflectedAt: now - (120 * day), updatedAt: now - (120 * day),
    },
  ];
  const sections = buildLookbackSections(
    tasks,
    [{ id: 'alpha', name: 'Alpha' }, { id: 'beta', name: 'Beta' }],
    'Unknown',
    now
  );

  assert.deepEqual(sections.map(section => section.id), ['last2Weeks', 'last3Months', 'overall']);
  assert.equal(sections[0].distributionTotalMinutes, 60);
  assert.equal(sections[0].summaryData.status, 'veryStrong');
  assert.equal(sections[1].distributionTotalMinutes, 90);
  assert.deepEqual(
    sections[1].projectData.map(project => project.projectId),
    ['alpha', 'beta']
  );
  assert.equal(sections[2].distributionTotalMinutes, 105);
});

test('lookback windows use the reflection date before an older completion date', async () => {
  const { buildLookbackSections } = await import(modelModuleUrl);
  const now = Date.UTC(2026, 5, 23, 12);
  const day = 24 * 60 * 60 * 1000;
  const tasks = [{
    id: 'recently-reflected',
    isDone: true,
    reflectionValue: 2,
    duration: 90,
    projectId: 'alpha',
    completedAt: now - (20 * day),
    reflectedAt: now - day,
    updatedAt: now - day,
  }];
  const sections = buildLookbackSections(
    tasks,
    [{ id: 'alpha', name: 'Alpha' }],
    'Unknown',
    now
  );

  assert.equal(sections[0].distributionTotalMinutes, 90);
  assert.deepEqual(sections[0].projectData.map(project => project.projectId), ['alpha']);
});
