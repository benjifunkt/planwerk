const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');

const readSource = (relativePath) => (
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
);

test('main sidebar uses a single effective collapsed state on narrow windows', () => {
  const source = readSource('App.tsx');

  assert.match(source, /SIDEBAR_EXPANDED_MEDIA_QUERY = '\(min-width: 768px\)'/);
  assert.match(source, /effectiveSidebarCollapsed = sidebarCollapsed \|\| !isSidebarExpandable/);
  assert.match(source, /if \(!isSidebarExpandable\) return;/);
  assert.match(source, /effectiveSidebarCollapsed \? 'w-16' : 'w-64'/);
  assert.match(source, /effectiveSidebarCollapsed \? 'absolute top-1 right-1'/);

  assert.doesNotMatch(source, /w-16 md:w-64/);
  assert.doesNotMatch(source, /sidebarCollapsed \? 'absolute -top-1 -right-1'/);
});

test('board sidebar button icon uses vertical lines with the short line on the right', () => {
  const source = readSource('App.tsx');

  assert.match(source, /<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeWidth=\{2\} d="M6 4v16M12 4v16M18 4v7" \/><\/svg>/);
  assert.doesNotMatch(source, /d="M4 6h16M4 12h16m-7 6h7"/);
});

test('main sidebar separator sits between cleanup and settings actions', () => {
  const source = readSource('App.tsx');
  const sidebarActionBlock = source.match(/<div className="mt-auto flex flex-col gap-2[\s\S]*?<button\s+onClick=\{\(\) => handleNavigateToView\('settings'\)\}[\s\S]*?title=\{t\('app\.settings'\)\}/)?.[0] ?? '';

  assert.doesNotMatch(sidebarActionBlock, /<div className="mt-auto flex flex-col gap-2 pt-4 border-t-2 border-black\/10 dark:border-white\/10">/);
  assert.match(sidebarActionBlock, /<div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">\s*<button\s+onClick=\{\(\) => handleNavigateToView\('settings'\)\}/);
  assert.match(sidebarActionBlock, /className=\{`w-full flex items-center \$\{effectiveSidebarCollapsed \? 'justify-center' : 'gap-3'\}/);
});
