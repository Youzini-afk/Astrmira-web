import test from 'node:test';
import assert from 'node:assert/strict';
import { headingSlug, activeHeadingAt } from '../src/scripts/article-toc.js';

test('heading anchors retain Chinese text and normalize punctuation consistently', () => {
  assert.equal(headingSlug('一次存储，三种视角。'), '一次存储-三种视角');
  assert.equal(headingSlug('  TQL / Query Language  '), 'tql-query-language');
  assert.equal(headingSlug('！'), 'heading');
});

test('the active chapter follows the reading line, including large scroll jumps', () => {
  const headings = [{ id: 'overview', top: -600 }, { id: 'model', top: -200 }, { id: 'queries', top: 110 }, { id: 'usage', top: 800 }];
  assert.equal(activeHeadingAt(headings, 110), 'queries');
  assert.equal(activeHeadingAt(headings.map(item => ({ ...item, top: item.top - 700 })), 110), 'usage');
  assert.equal(activeHeadingAt([{ id: 'overview', top: 300 }], 110), 'overview');
});

test('side-by-side feature headings retain the clicked column without influencing later chapters', () => {
  const headings = [{ id: 'queries', top: -300 }, { id: 'left', top: 110 }, { id: 'right', top: 110 }, { id: 'usage', top: 600 }];
  assert.equal(activeHeadingAt(headings, 110), 'left');
  assert.equal(activeHeadingAt(headings, 110, 'left', 'right'), 'right');
  assert.equal(activeHeadingAt(headings, 110, 'right'), 'right');
  assert.equal(activeHeadingAt(headings.map(item => ({ ...item, top: item.top - 500 })), 110, 'right', 'right'), 'usage');
});

test('visual heading position wins over document order when a feature grid wraps', () => {
  assert.equal(activeHeadingAt([{ id: 'lower', top: 100 }, { id: 'upper', top: 80 }], 110), 'lower');
  assert.equal(activeHeadingAt([], 110), undefined);
});
