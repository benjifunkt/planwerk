const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

const readSource = (relativePath) => (
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
);

test('global styles leave scrollbars native while preserving scroll containers', () => {
  const cssSource = readSource('index.css');
  const boardSource = readSource('components/Board.tsx');
  const columnSource = readSource('components/ColumnView.tsx');

  assert.match(cssSource, /:root\s*\{[\s\S]*color-scheme: light;/);
  assert.match(cssSource, /\.dark\s*\{[\s\S]*color-scheme: dark;/);
  assert.doesNotMatch(cssSource, /::-webkit-scrollbar/);
  assert.doesNotMatch(cssSource, /scrollbar-(?:width|color)/);
  assert.match(boardSource, /overflow-x-auto overflow-y-hidden/);
  assert.match(columnSource, /overflow-y-auto overflow-x-hidden/);
});

test('board resets horizontal scroll to the current visible day when its size changes', () => {
  const boardSource = readSource('components/Board.tsx');
  const columnSource = readSource('components/ColumnView.tsx');

  assert.match(boardSource, /const boardRef = useRef<HTMLDivElement>\(null\)/);
  assert.match(boardSource, /const backlogColumnRef = useRef<HTMLDivElement>\(null\)/);
  assert.match(boardSource, /const currentDayColumnRef = useRef<HTMLDivElement>\(null\)/);
  assert.match(boardSource, /const currentDayId = DAY_COLUMN_BY_NATIVE_DAY\[new Date\(\)\.getDay\(\)\]/);
  assert.match(boardSource, /const maxScrollLeft = Math\.max\(0, board\.scrollWidth - board\.clientWidth\)/);
  assert.match(boardSource, /const pinnedBacklogWidth = backlogPinned/);
  assert.match(boardSource, /currentDayLeft - pinnedBacklogWidth/);
  assert.match(boardSource, /board\.scrollLeft = Math\.min\(maxScrollLeft, Math\.max\(0, targetScrollLeft\)\)/);
  assert.match(boardSource, /if \(!currentDayColumn\) \{\s+board\.scrollLeft = 0/);
  assert.match(boardSource, /useLayoutEffect\(\(\) => \{/);
  assert.match(boardSource, /new ResizeObserver/);
  assert.match(boardSource, /resizeObserver\.observe\(board\)/);
  assert.match(boardSource, /window\.requestAnimationFrame\(alignCurrentDay\)/);
  assert.match(boardSource, /resizeObserver\.disconnect\(\)/);
  assert.match(boardSource, /const handleWindowFocus = \(\) => \{/);
  assert.match(boardSource, /window\.addEventListener\('focus', handleWindowFocus\)/);
  assert.match(boardSource, /window\.removeEventListener\('focus', handleWindowFocus\)/);
  assert.match(boardSource, /ref=\{boardRef\}/);
  assert.match(boardSource, /columnRef=\{col\.id === 'backlog' \? backlogColumnRef : col\.id === currentDayId \? currentDayColumnRef : undefined\}/);
  assert.doesNotMatch(boardSource, /behavior:\s*['"]smooth['"]/);

  assert.match(columnSource, /columnRef\?: React\.Ref<HTMLDivElement>/);
  assert.match(columnSource, /ref=\{columnRef\}/);
});
