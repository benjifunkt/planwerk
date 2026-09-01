import assert from 'node:assert/strict';
import test from 'node:test';

const layoutModuleUrl = new URL(
  '../components/lookback/lookbackDistributionLayout.ts',
  import.meta.url
);
const layout = await import(layoutModuleUrl).catch(() => null);

const getHelper = () => {
  assert.ok(layout, 'lookback distribution layout helper should exist');
  assert.equal(typeof layout.getClampedDistributionLabelLeft, 'function');
  return layout.getClampedDistributionLabelLeft;
};

test('distribution label stays aligned with a segment when enough space remains', () => {
  const getClampedLeft = getHelper();

  assert.equal(getClampedLeft(1000, 180, 40), 400);
  assert.equal(getClampedLeft(1000, 200, 80), 800);
});

test('distribution label moves left when a tiny right segment has too little room', () => {
  const getClampedLeft = getHelper();

  assert.equal(getClampedLeft(1000, 180, 98), 820);
  assert.equal(getClampedLeft(1000, 180, 92), 820);
});

test('distribution label stays inside the left edge and handles a label wider than the bar', () => {
  const getClampedLeft = getHelper();

  assert.equal(getClampedLeft(1000, 180, 0), 0);
  assert.equal(getClampedLeft(240, 320, 98), 0);
});
