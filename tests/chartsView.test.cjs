const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

const readSource = (relativePath) => (
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
);

test('analytics summary status uses softened not useful thresholds', () => {
  const source = readSource('components/lookback/lookbackModel.ts');

  assert.match(source, /notUsefulRate >= 40\) return 'reprioritize'/);
  assert.match(source, /notUsefulRate >= 30\) return 'recalibrate'/);
  assert.match(source, /notUsefulRate >= 20\) return 'keepEye'/);
  assert.match(source, /averageScore >= 2\.6 && notUsefulRate <= 10\) return 'veryStrong'/);

  assert.doesNotMatch(source, /notUsefulRate >= 35/);
  assert.doesNotMatch(source, /notUsefulRate >= 25/);
  assert.doesNotMatch(source, /notUsefulRate >= 15/);
});

test('lookback view uses one selectable three-card overview row', () => {
  const viewSource = readSource('components/ChartsView.tsx');
  const cardSource = readSource('components/lookback/LookbackPeriodCard.tsx');
  const appSource = readSource('App.tsx');

  assert.match(viewSource, /firstReflectionAt: number \| null/);
  assert.match(viewSource, /const \[now, setNow\] = useState\(\(\) => Date\.now\(\)\)/);
  assert.match(viewSource, /window\.setInterval\(updateNow, LOOKBACK_NOW_REFRESH_MS\)/);
  assert.match(viewSource, /window\.addEventListener\('focus', updateNow\)/);
  assert.match(viewSource, /getLookbackAvailability\(firstReflectionAt, now\)/);
  assert.doesNotMatch(viewSource, /getFirstReflectionTimestamp/);
  assert.match(appSource, /firstReflectionAt=\{state\.firstReflectionAt\}/);
  assert.match(viewSource, /const \[selectedPeriodId, setSelectedPeriodId\] = useState<AnalyticsSectionId \| null>\(null\)/);
  assert.match(viewSource, /overflow-x-auto/);
  assert.match(viewSource, /grid-cols-3/);
  assert.match(viewSource, /<LookbackPeriodCard/);
  assert.match(viewSource, /const handleSelectPeriod = \(periodId: AnalyticsSectionId\) => \{/);
  assert.match(viewSource, /if \(selectedPeriodId === periodId\) \{/);
  assert.match(viewSource, /onSelect=\{\(\) => handleSelectPeriod\(section\.id\)\}/);
  assert.match(viewSource, /isRenderingDetails && detailsPeriodId && detailsSection \?/);
  assert.match(viewSource, /<LookbackDetails/);
  assert.match(viewSource, /<LookbackOverview/);

  assert.match(cardSource, /<button/);
  assert.match(cardSource, /disabled=\{!availability\.isUnlocked\}/);
  assert.match(cardSource, /aria-pressed=\{isSelected\}/);
  assert.match(cardSource, /aria-label=\{ariaLabel\}/);
  assert.match(cardSource, /aspect-square/);
  assert.match(cardSource, /hover:-translate-y-1/);
  assert.match(cardSource, /focus-visible:-translate-y-1/);
  assert.match(cardSource, /motion-reduce:hover:translate-y-0/);
  assert.match(cardSource, /motion-reduce:focus-visible:translate-y-0/);
  assert.match(cardSource, /opacity-30 hover:opacity-70 focus-visible:opacity-70/);
  assert.match(cardSource, /absolute inset-x-0 bottom-0/);
  assert.match(cardSource, /absolute inset-x-0 top-0 bottom-\[4\.25rem\] overflow-hidden/);
  assert.doesNotMatch(cardSource, /top-8 flex h-36 justify-center overflow-hidden/);
  assert.match(cardSource, /overflow-hidden border text-left/);
  assert.match(cardSource, /border-neutral-200 dark:border-neutral-700/);
  assert.match(cardSource, /bg-white text-black/);
  assert.doesNotMatch(cardSource, /overflow-hidden border-2 text-left/);
  assert.doesNotMatch(cardSource, /shadow-\[6px_6px_0px_0px/);
  assert.match(cardSource, /absolute inset-x-0 bottom-3 flex h-14 items-center justify-center border-t border-neutral-200 bg-white px-4 text-center dark:border-neutral-700 dark:bg-neutral-900/);
  assert.match(cardSource, /<p className="text-sm font-black leading-tight tracking-tight sm:text-base">/);
  assert.ok(
    cardSource.indexOf('bottom-3 flex h-14') < cardSource.indexOf('absolute inset-x-0 bottom-0'),
    'status block should sit above the bottom distribution bar'
  );
  assert.doesNotMatch(cardSource, /bottom-16 h-0 border-t-2/);
  assert.doesNotMatch(cardSource, /absolute bottom-5 left-4 right-4/);
  assert.match(cardSource, /const lookbackStatusAnimationStartDelays: Record<AnalyticsSectionData\['id'\], number> = \{/);
  assert.match(cardSource, /last2Weeks: 0/);
  assert.match(cardSource, /last3Months: 200/);
  assert.match(cardSource, /overall: 400/);
  assert.match(cardSource, /<LookbackStatusAnimation\s+status=\{section\.summaryData\.status\}\s+variantKey=\{section\.id\}\s+startDelayMs=\{lookbackStatusAnimationStartDelays\[section\.id\]\}\s+\/>/);
  assert.doesNotMatch(cardSource, /<AnimatedLookbackCompassLogo compact \/>/);
});

test('lookback status animations use tiered block towers and keep compass fallback', () => {
  const cardSource = readSource('components/lookback/LookbackPeriodCard.tsx');
  const switchPath = path.join(repoRoot, 'components/lookback/statusAnimations/LookbackStatusAnimation.tsx');
  const blockPath = path.join(repoRoot, 'components/lookback/statusAnimations/LookbackBlockStatusAnimation.tsx');
  const indexPath = path.join(repoRoot, 'components/lookback/statusAnimations/index.ts');
  const switchSource = fs.existsSync(switchPath) ? fs.readFileSync(switchPath, 'utf8') : '';
  const blockSource = fs.existsSync(blockPath) ? fs.readFileSync(blockPath, 'utf8') : '';
  const indexSource = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
  const appSource = readSource('App.tsx');

  assert.match(cardSource, /from '\.\/statusAnimations'/);
  assert.match(switchSource, /status: SummaryStatus/);
  assert.match(switchSource, /variantKey: string/);
  assert.match(switchSource, /startDelayMs\?: number/);
  assert.match(switchSource, /status === 'noReflections'/);
  assert.match(switchSource, /<LookbackBlockStatusAnimation status=\{status\} variantKey=\{variantKey\} startDelayMs=\{startDelayMs\} \/>/);
  assert.match(switchSource, /<AnimatedLookbackCompassLogo compact stopAfterMs=\{LOOKBACK_BLOCK_MAX_RUN_MS\} \/>/);
  assert.match(indexSource, /export \{ LookbackStatusAnimation \} from '\.\/LookbackStatusAnimation';/);
  assert.match(indexSource, /export \{ LookbackBlockStatusAnimation \} from '\.\/LookbackBlockStatusAnimation';/);

  assert.match(blockSource, /type AnimatedBlockStatus = Exclude<SummaryStatus, 'noReflections'>/);
  assert.match(blockSource, /LOOKBACK_BLOCK_TOWER_BASE_CONFIG/);
  assert.match(blockSource, /export const LOOKBACK_BLOCK_MAX_RUN_MS = 60_000/);
  assert.match(blockSource, /columns: 7/);
  assert.match(blockSource, /visibleRows: 5/);
  assert.match(blockSource, /LOOKBACK_BLOCK_STATUS_CONFIG/);
  assert.match(blockSource, /veryStrong: \{/);
  assert.match(blockSource, /activeStartRow: 0/);
  assert.match(blockSource, /activeRows: 5/);
  assert.match(blockSource, /blocksPerRow: 5/);
  assert.match(blockSource, /blockTickMs: 92/);
  assert.match(blockSource, /rowPauseMs: 190/);
  assert.match(blockSource, /colorPercent: 86/);
  assert.match(blockSource, /blackPercent: 14/);
  assert.match(blockSource, /blackEvery: 7/);
  assert.match(blockSource, /goodRange: \{/);
  assert.match(blockSource, /activeStartRow: 1/);
  assert.match(blockSource, /colorPercent: 35/);
  assert.match(blockSource, /blockTickMs: 170/);
  assert.match(blockSource, /rowPauseMs: 360/);
  assert.match(blockSource, /keepEye: \{/);
  assert.match(blockSource, /activeStartRow: 2/);
  assert.match(blockSource, /colorPercent: 0/);
  assert.match(blockSource, /blackPercent: 30/);
  assert.match(blockSource, /blockTickMs: 300/);
  assert.match(blockSource, /rowPauseMs: 630/);
  assert.match(blockSource, /recalibrate: \{/);
  assert.match(blockSource, /activeStartRow: 3/);
  assert.match(blockSource, /colorPercent: 0/);
  assert.match(blockSource, /blackPercent: 45/);
  assert.match(blockSource, /blockTickMs: 550/);
  assert.match(blockSource, /rowPauseMs: 1150/);
  assert.match(blockSource, /reprioritize: \{/);
  assert.match(blockSource, /activeStartRow: 4/);
  assert.match(blockSource, /blackPercent: 10/);
  assert.match(blockSource, /blockTickMs: 1000/);
  assert.match(blockSource, /rowPauseMs: 2000/);
  assert.match(blockSource, /LOOKBACK_BLOCK_COLORS/);
  assert.match(blockSource, /#2383f6/);
  assert.match(blockSource, /#4fd466/);
  assert.match(blockSource, /#ff3048/);
  assert.match(blockSource, /#ffd33d/);
  assert.match(blockSource, /#111111/);
  assert.match(blockSource, /#d8d8d8/);
  assert.match(blockSource, /createSparseRowPlan/);
  assert.match(blockSource, /LOOKBACK_BLOCK_ROW_SEEDS/);
  assert.match(blockSource, /createLookbackBlockVariant/);
  assert.match(blockSource, /variantKey\.split\(''\)/);
  assert.match(blockSource, /rowSeedOffset/);
  assert.match(blockSource, /colorOffset/);
  assert.match(blockSource, /characterOffset/);
  assert.match(blockSource, /columns\.slice\(0, config\.blocksPerRow\)/);
  assert.doesNotMatch(blockSource, /rowIndex \* 2 \+ rowOffset/);
  assert.match(blockSource, /getNextBlockColor/);
  assert.match(blockSource, /trimVisibleRows/);
  assert.match(blockSource, /createInitialBlocks/);
  assert.match(blockSource, /createNextBlock/);
  assert.match(blockSource, /shiftRowsDown/);
  assert.match(blockSource, /advanceBlockTower/);
  assert.match(blockSource, /setAnimationState\(prev => advanceBlockTower\(prev\)\)/);
  assert.match(blockSource, /visibleBlocks = animationState\.blocks\.filter\(block => block\.row <= LOOKBACK_BLOCK_TOWER_BASE_CONFIG\.visibleRows\)/);
  assert.doesNotMatch(blockSource, /visibleBlocks = animationState\.blocks\.filter\(block => block\.row < LOOKBACK_BLOCK_TOWER_BASE_CONFIG\.visibleRows\)/);
  assert.match(blockSource, /currentRowPlan/);
  assert.match(blockSource, /currentColumnIndex/);
  assert.match(blockSource, /isRowPause/);
  assert.match(blockSource, /blockedColors/);
  assert.match(blockSource, /const colorIsAllowed = config\.colorPercent > 0/);
  assert.match(blockSource, /color\.role !== 'color' \|\| colorIsAllowed/);
  assert.match(blockSource, /color\.role === 'black' \|\| color\.role === 'grey'/);
  assert.match(blockSource, /startDelayMs = 0/);
  assert.match(blockSource, /hasAppliedStartDelayRef/);
  assert.match(blockSource, /const initialTickDelayMs = hasAppliedStartDelayRef\.current \? 0 : startDelayMs/);
  assert.match(blockSource, /hasAppliedStartDelayRef\.current = true/);
  assert.match(blockSource, /runStartedAtRef/);
  assert.match(blockSource, /const remainingRunMs = LOOKBACK_BLOCK_MAX_RUN_MS - elapsedRunMs/);
  assert.match(blockSource, /if \(animationState\.isRowPause && remainingRunMs <= animationState\.config\.rowPauseMs\)/);
  assert.match(blockSource, /setAnimationFrozen\(true\)/);
  assert.match(blockSource, /window\.setTimeout/);
  assert.match(blockSource, /animationState\.currentColumnIndex,\n\s+animationState\.currentRowIndex,/);
  assert.doesNotMatch(blockSource, /window\.setInterval/);
  assert.match(blockSource, /lookback-block-status-block-pop/);
  assert.match(blockSource, /lookback-block-status-row-shift/);
  assert.doesNotMatch(blockSource, /lookback-very-strong-conveyor/);
  assert.doesNotMatch(blockSource, /lookback-very-strong-build-row/);
  assert.doesNotMatch(blockSource, /flushSync/);
  assert.match(blockSource, /className="relative h-full w-full overflow-hidden"/);
  assert.match(blockSource, /className="lookback-block-status-tower absolute inset-y-0 -left-\[10%\] -right-\[10%\] overflow-hidden"/);
  assert.match(blockSource, /width: `calc\(100% \/ \$\{LOOKBACK_BLOCK_TOWER_BASE_CONFIG\.columns\} - 2px\)`/);
  assert.match(blockSource, /height: `calc\(100% \/ \$\{LOOKBACK_BLOCK_TOWER_BASE_CONFIG\.visibleRows\} - 2px\)`/);
  assert.match(blockSource, /left = `calc\(\(100% \/ \$\{LOOKBACK_BLOCK_TOWER_BASE_CONFIG\.columns\}\) \* \$\{block\.column\} \+ \$\{block\.jitterX\}px\)`/);
  assert.match(blockSource, /top = `calc\(\(100% \/ \$\{LOOKBACK_BLOCK_TOWER_BASE_CONFIG\.visibleRows\}\) \* \$\{block\.row\} \+ \$\{block\.jitterY\}px\)`/);
  assert.match(blockSource, /className="lookback-block-status-block absolute bg-\[var\(--lookback-block-color\)\] dark:bg-\[var\(--lookback-block-dark-color\)\]"/);
  assert.doesNotMatch(blockSource, /rounded-\[3px\]/);
  assert.match(blockSource, /rotate\(\$\{block\.rotation\}deg\)/);
  assert.match(blockSource, /jitterX/);
  assert.match(blockSource, /jitterY/);
  assert.match(blockSource, /bg-\[var\(--lookback-block-color\)\]/);
  assert.match(blockSource, /dark:bg-\[var\(--lookback-block-dark-color\)\]/);
  assert.match(blockSource, /aria-hidden="true"/);
  assert.match(blockSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(blockSource, /animation: none/);
  assert.match(blockSource, /if \(prefersReducedMotion \|\| animationFrozen\) return/);
  assert.doesNotMatch(blockSource, /VERY_STRONG_ARROW_BLOCKS/);
  assert.doesNotMatch(blockSource, /VERY_STRONG_SPEED_BLOCKS/);
  assert.doesNotMatch(blockSource, /lookback-very-strong-rocket-wobble/);
  assert.doesNotMatch(blockSource, /lookback-very-strong-speed-line/);

  assert.match(appSource, /pendingViewTutorial === 'lookback'\s*\? <AnimatedLookbackCompassLogo \/>/);
  assert.doesNotMatch(appSource, /pendingViewTutorial === 'lookback'\s*\? <LookbackStatusAnimation/);
});

test('lookback overview reveals periods warnings separator and sentence in sequence', () => {
  const viewSource = readSource('components/ChartsView.tsx');
  const cardSource = readSource('components/lookback/LookbackPeriodCard.tsx');
  const overviewSource = readSource('components/lookback/LookbackOverview.tsx');
  const compassSource = readSource('components/animations/AnimatedLookbackCompassLogo.tsx');

  assert.match(viewSource, /const LOOKBACK_REVEAL_ANIMATION_MS = 300/);
  assert.match(viewSource, /const LOOKBACK_DETAILS_EXIT_MS = 300/);
  assert.match(viewSource, /const LOOKBACK_OVERVIEW_RETURN_FADE_MS = 300/);
  assert.match(viewSource, /const LOOKBACK_REVEAL_PAUSE_MS = 500/);
  assert.match(viewSource, /const LOOKBACK_REVEAL_STEP_MS = LOOKBACK_REVEAL_ANIMATION_MS \+ LOOKBACK_REVEAL_PAUSE_MS/);
  assert.doesNotMatch(viewSource, /setOverviewRevealRunId/);
  assert.match(viewSource, /const \[exitingPeriodId, setExitingPeriodId\] = useState<AnalyticsSectionId \| null>\(null\)/);
  assert.match(viewSource, /const \[overviewReturnRunId, setOverviewReturnRunId\] = useState\(0\)/);
  assert.match(viewSource, /window\.setTimeout\(\(\) => \{/);
  assert.match(viewSource, /setExitingPeriodId\(null\)/);
  assert.match(viewSource, /setOverviewReturnRunId\(runId => runId \+ 1\)/);
  assert.match(viewSource, /LOOKBACK_DETAILS_EXIT_MS/);
  assert.match(viewSource, /key=\{section\.id\}/);
  assert.doesNotMatch(viewSource, /<div\s+hidden=\{isShowingDetails\}/);
  assert.match(viewSource, /aria-hidden=\{!isOverviewVisible\}/);
  assert.match(viewSource, /!isOverviewVisible\s+\? 'pointer-events-none absolute inset-x-0 top-0 opacity-0'/);
  assert.match(viewSource, /className=\{isDetailsExiting \? 'lookback-content-exit' : undefined\}/);
  assert.match(viewSource, /@keyframes lookback-content-exit \{/);
  assert.match(viewSource, /from \{ opacity: 1; transform: translateY\(0\); \}/);
  assert.match(viewSource, /to \{ opacity: 0; transform: translateY\(8px\); \}/);
  assert.match(viewSource, /animation: lookback-content-exit \$\{LOOKBACK_DETAILS_EXIT_MS\}ms ease-in both/);
  assert.doesNotMatch(viewSource, /lookback-content-reveal \$\{LOOKBACK_DETAILS_EXIT_MS\}ms ease-in reverse/);
  assert.match(viewSource, /summaryReturnRunId=\{overviewReturnRunId\}/);
  assert.match(viewSource, /returnFadeMs=\{LOOKBACK_OVERVIEW_RETURN_FADE_MS\}/);
  assert.match(viewSource, /@keyframes lookback-overview-return-fade/);
  assert.match(viewSource, /\.lookback-overview-return-fade/);
  assert.match(viewSource, /revealDelayMs=\{sectionIndex \* LOOKBACK_REVEAL_STEP_MS\}/);
  assert.doesNotMatch(viewSource, /revealRunId=\{overviewRevealRunId\}/);
  assert.match(viewSource, /baseRevealIndex=\{analyticsSections\.length\}/);
  assert.match(viewSource, /revealAnimationMs=\{LOOKBACK_REVEAL_ANIMATION_MS\}/);
  assert.match(viewSource, /revealStepMs=\{LOOKBACK_REVEAL_STEP_MS\}/);

  assert.match(cardSource, /revealDelayMs = 0/);
  assert.match(cardSource, /revealRunId = 0/);
  assert.match(cardSource, /lookback-overview-item-reveal/);
  assert.match(cardSource, /'--lookback-reveal-delay-ms': `\$\{revealDelayMs\}ms`/);

  assert.match(overviewSource, /const concernGroups = \[/);
  assert.match(overviewSource, /filter\(\(group\): group is ConcernGroupData => group !== null\)/);
  assert.match(overviewSource, /revealDelayMs=\{\(baseRevealIndex \+ index\) \* revealStepMs\}/);
  assert.match(overviewSource, /const separatorDelayMs = \(baseRevealIndex \+ concernGroups\.length\) \* revealStepMs/);
  assert.match(overviewSource, /lookback-overview-separator-dot/);
  assert.match(overviewSource, /lookback-overview-separator-line-left/);
  assert.match(overviewSource, /transformOrigin: 'right center'/);
  assert.match(overviewSource, /lookback-overview-separator-line-right/);
  assert.match(overviewSource, /transformOrigin: 'left center'/);
  assert.match(overviewSource, /lookback-overview-text-reveal/);
  assert.match(overviewSource, /summaryReturnRunId/);
  assert.match(overviewSource, /returnFadeMs/);
  assert.match(overviewSource, /summaryReturnRunId > 0 \? 'lookback-overview-return-fade' : ''/);
  assert.match(overviewSource, /key=\{`summary-\$\{summaryReturnRunId\}`\}/);
  assert.match(overviewSource, /separatorDelayMs \+ revealAnimationMs \* 2/);

  assert.match(compassSource, /stopAfterMs\?: number/);
  assert.match(compassSource, /if \(stopAfterMs !== undefined && elapsedMs >= stopAfterMs\)/);
  assert.match(compassSource, /setDirection\(0\)/);
});

test('lookback overview shows merged project concerns and one combined sentence', () => {
  const overviewSource = readSource('components/lookback/LookbackOverview.tsx');
  const viewSource = readSource('components/ChartsView.tsx');
  const i18nSource = readSource('i18n.tsx');
  const combinedStatusPath = path.join(repoRoot, 'i18n/lookbackCombinedStatus.ts');
  const combinedStatusSource = fs.existsSync(combinedStatusPath)
    ? fs.readFileSync(combinedStatusPath, 'utf8')
    : '';

  assert.match(viewSource, /mergeProjectConcerns\(analyticsSections, availability\)/);
  assert.match(viewSource, /getCombinedStatusKey\(analyticsSections, availability\)/);
  assert.match(viewSource, /getCombinedStatusTextKey\(combinedStatusKey, analyticsSections\)/);
  assert.match(overviewSource, /projectConcerns\.urgent\.length > 0/);
  assert.match(overviewSource, /projectConcerns\.warning\.length > 0/);
  assert.match(overviewSource, /projectConcerns\.improved\.length > 0/);
  assert.match(overviewSource, /analytics\.projectConcern\.urgentTitle/);
  assert.match(overviewSource, /analytics\.projectConcern\.warningTitle/);
  assert.match(overviewSource, /analytics\.projectConcern\.improvedTitle/);
  assert.match(overviewSource, /sm:justify-center/);
  assert.match(overviewSource, /sm:w-\[calc\(\(100%-2rem\)\/3\)\]/);
  assert.match(overviewSource, /combinedStatusTextKey/);
  assert.match(overviewSource, /t\(combinedStatusTextKey\)/);
  assert.doesNotMatch(overviewSource, /analytics\.combinedStatus\.placeholder/);
  assert.match(overviewSource, /data-status-combination=\{combinedStatusKey\}/);
  assert.match(overviewSource, /data-status-text-key=\{combinedStatusTextKey\}/);

  assert.match(i18nSource, /'analytics\.projectConcern\.improvedTitle': 'Improved'/);
  assert.match(i18nSource, /'analytics\.projectConcern\.improvedTitle': 'Verbessert'/);
  assert.match(i18nSource, /lookbackCombinedStatusEn/);
  assert.match(i18nSource, /lookbackCombinedStatusDe/);
  assert.doesNotMatch(i18nSource, /analytics\.combinedStatus\.placeholder/);
  assert.match(combinedStatusSource, /export const lookbackCombinedStatusEn/);
  assert.match(combinedStatusSource, /export const lookbackCombinedStatusDe/);
  assert.match(combinedStatusSource, /analytics\.combinedStatus\.goodRange\.veryStrong\.veryStrong/);
  assert.match(combinedStatusSource, /Das ist sehr gesund\. Nicht jede Woche muss gleich stark aussehen\./);
  assert.match(combinedStatusSource, /Das ist ein gesundes Bild\. Kleine Abweichungen gehören dazu\./);
  assert.match(combinedStatusSource, /Das wirkt gesund und stabil\. Genau so darf Arbeit auch aussehen\./);
  assert.match(combinedStatusSource, /Sehr stark\. Vergiss nicht, manches darf einfach nur gut tun, ohne nützlich zu sein\./);
});

test('lookback lock guidance and card accessibility are localized', () => {
  const cardSource = readSource('components/lookback/LookbackPeriodCard.tsx');
  const i18nSource = readSource('i18n.tsx');

  assert.match(cardSource, /analytics\.lock\.needsFirstReflection/);
  assert.match(cardSource, /analytics\.lock\.waitingForFirstReflection/);
  assert.match(cardSource, /daysRemaining === 1/);
  assert.match(cardSource, /analytics\.lock\.availableInOneDay/);
  assert.match(cardSource, /analytics\.lock\.availableInDays/);
  assert.match(i18nSource, /'analytics\.lock\.needsFirstReflection': 'Rate one task to start your lookback\.'/);
  assert.match(i18nSource, /'analytics\.lock\.needsFirstReflection': 'Bewerte eine Aufgabe, um deinen Rückblick zu starten\.'/);
  assert.match(i18nSource, /'analytics\.lock\.availableInDays': 'Available in \{count\} days'/);
  assert.match(i18nSource, /'analytics\.lock\.availableInDays': 'In \{count\} Tagen verfügbar'/);
});

test('lookback details use inline percentages, local hover duration, and one legend', () => {
  const detailsSource = readSource('components/lookback/LookbackDetails.tsx');
  const distributionBarPath = path.join(repoRoot, 'components/lookback/LookbackDistributionBar.tsx');
  const distributionBarSource = fs.existsSync(distributionBarPath)
    ? fs.readFileSync(distributionBarPath, 'utf8')
    : '';
  const viewSource = readSource('components/ChartsView.tsx');
  const modelSource = readSource('components/lookback/lookbackModel.ts');
  const i18nSource = readSource('i18n.tsx');
  const packageSource = readSource('package.json');
  const packageLockSource = readSource('package-lock.json');

  assert.match(detailsSource, /analytics\.overallValueDistribution/);
  assert.match(detailsSource, /analytics\.projects/);
  assert.match(detailsSource, /analytics\.projectAward\.mostSuccessful/);
  assert.match(detailsSource, /analytics\.projectAward\.mostTime/);
  assert.match(detailsSource, /analytics\.noProjectData/);
  assert.match(detailsSource, /getProjectAwardIds/);
  assert.match(detailsSource, /<LookbackDistributionBar/);
  assert.match(detailsSource, /project\.distributionData/);
  assert.equal((detailsSource.match(/<LookbackDistributionLegend/g) ?? []).length, 1);
  assert.ok(
    detailsSource.indexOf('<LookbackDistributionLegend') > detailsSource.indexOf("analytics.projects"),
    'the shared legend should render after the project bars'
  );
  assert.match(detailsSource, /motion-reduce:transition-none/);
  assert.doesNotMatch(detailsSource, /ResponsiveContainer|BarChart|from 'recharts'|<Tooltip/);
  assert.doesNotMatch(detailsSource, /analytics\.details|analytics\.weeklyValueBreakdown|analytics\.projectEfficacyRanking|analytics\.projectNote/);
  assert.doesNotMatch(detailsSource, /shadow-/);

  assert.match(distributionBarSource, /useState<DistributionKey \| null>/);
  assert.match(distributionBarSource, /formatMinutes/);
  assert.match(distributionBarSource, /reflection\.somewhatUseful/);
  assert.match(distributionBarSource, /segment\.percent >= 10/);
  assert.match(distributionBarSource, /formatPercentage\(segment\.percent\)/);
  assert.match(distributionBarSource, /onMouseEnter/);
  assert.match(distributionBarSource, /onMouseLeave/);
  assert.match(distributionBarSource, /onFocus/);
  assert.match(distributionBarSource, /onBlur/);
  assert.match(distributionBarSource, /tabIndex=\{0\}/);
  assert.match(distributionBarSource, /activeSegmentStartPercent/);
  assert.match(distributionBarSource, /getClampedDistributionLabelLeft/);
  assert.match(distributionBarSource, /useLayoutEffect/);
  assert.match(distributionBarSource, /useRef/);
  assert.match(distributionBarSource, /new ResizeObserver/);
  assert.match(distributionBarSource, /detailRowRef/);
  assert.match(distributionBarSource, /detailLabelRef/);
  assert.match(distributionBarSource, /clientWidth/);
  assert.match(distributionBarSource, /offsetWidth/);
  assert.match(distributionBarSource, /min-h-5 overflow-hidden/);
  assert.match(distributionBarSource, /lookback-segment-detail-reveal flow-root/);
  assert.match(distributionBarSource, /w-max max-w-full/);
  assert.match(distributionBarSource, /className="mt-1 block whitespace-normal"/);
  assert.match(distributionBarSource, /labelPlacement\?\.segmentKey === activeSegment\.key/);
  assert.match(distributionBarSource, /'visible' : 'invisible'/);
  assert.match(distributionBarSource, /formatMinutes\(activeSegment\.minutes, language\)/);
  assert.match(distributionBarSource, /export const LookbackDistributionLegend/);
  assert.match(distributionBarSource, /flex flex-wrap/);
  assert.match(distributionBarSource, /aria-label=\{ariaLabel\}/);
  assert.match(distributionBarSource, /border border-neutral-200/);
  assert.match(distributionBarSource, /dark:border-neutral/);
  assert.doesNotMatch(distributionBarSource, /showDuration|fixed left-0 top-0|Tooltip/);
  assert.doesNotMatch(distributionBarSource, /lastVisibleSegmentKey|isActiveSegmentAtRightEdge/);
  assert.doesNotMatch(distributionBarSource, /width: `\$\{activeSegment\.percent\}%`/);
  assert.doesNotMatch(detailsSource, /project\.(AverageValue|Duration)/);

  assert.match(viewSource, /getDistributionTextColor/);
  assert.match(viewSource, /@keyframes lookback-segment-detail-reveal/);
  assert.match(viewSource, /translateY\(-100%\)/);
  assert.match(viewSource, /translateY\(0\)/);
  assert.match(viewSource, /animation: lookback-segment-detail-reveal 300ms ease-in-out both/);
  assert.match(viewSource, /\.lookback-segment-detail-reveal \{ animation: none; \}/);
  assert.doesNotMatch(modelSource, /WeeklyValueData|buildWeeklyData|weeklyData/);
  assert.match(i18nSource, /'analytics\.overallValueDistribution': 'Overall Distribution'/);
  assert.match(i18nSource, /'analytics\.overallValueDistribution': 'Gesamtverteilung'/);
  assert.match(i18nSource, /'analytics\.projects': 'Projects'/);
  assert.match(i18nSource, /'analytics\.projects': 'Projekte'/);
  assert.match(i18nSource, /'analytics\.projectAward\.mostSuccessful': 'Most successful'/);
  assert.match(i18nSource, /'analytics\.projectAward\.mostSuccessful': 'Am erfolgreichsten'/);
  assert.match(i18nSource, /'analytics\.projectAward\.mostTime': 'Most time'/);
  assert.match(i18nSource, /'analytics\.projectAward\.mostTime': 'Meiste Zeit'/);
  assert.doesNotMatch(packageSource, /"recharts"/);
  assert.doesNotMatch(packageLockSource, /"recharts"/);
});

test('lookback compass has an opt-in compact card variant and keeps the intro default', () => {
  const animationSource = readSource('components/animations/AnimatedLookbackCompassLogo.tsx');
  const appSource = readSource('App.tsx');

  assert.match(animationSource, /interface AnimatedLookbackCompassLogoProps/);
  assert.match(animationSource, /compact\?: boolean/);
  assert.match(animationSource, /compact = false/);
  assert.match(animationSource, /if \(!compact\) return compass/);
  assert.match(animationSource, /flex h-28 w-64 items-center justify-center overflow-hidden/);
  assert.match(animationSource, /origin-center scale-50/);
  assert.match(appSource, /pendingViewTutorial === 'lookback'\s*\? <AnimatedLookbackCompassLogo \/>/);
  assert.doesNotMatch(appSource, /pendingViewTutorial === 'lookback'\s*\? <AnimatedLookbackCompassLogo compact/);
});
