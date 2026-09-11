import test from 'node:test';
import assert from 'node:assert/strict';
import { matchLocale, preferredLocale, localePath, LOCALES } from '../src/i18n/routing.js';

test('Chinese language matching respects explicit scripts before regions', () => {
  for (const tag of ['zh-Hant', 'zh-TW', 'zh-HK', 'zh-MO', 'zh_Hant_CN']) assert.equal(matchLocale(tag), 'zh-hant', tag);
  for (const tag of ['zh', 'zh-CN', 'zh-SG', 'zh-Hans', 'zh-Hans-TW']) assert.equal(matchLocale(tag), 'zh-cn', tag);
});

test('language priorities and regional variants select a supported translation', () => {
  for (const [tag, expected] of [['ja-JP', 'ja'], ['ko-KR', 'ko'], ['fr-CA', 'fr'], ['de-AT', 'de'], ['en-GB', 'en']]) assert.equal(matchLocale(tag), expected);
  assert.equal(preferredLocale(['es-ES', 'fr-CA', 'en-US']), 'fr');
  assert.equal(preferredLocale(['en-US', 'zh-TW']), 'en');
  assert.equal(preferredLocale(['es-ES', 'it-IT']), 'en');
  assert.equal(preferredLocale([]), 'en');
});

test('every language switch replaces the prefix and preserves the page, query, and fragment', () => {
  for (const source of LOCALES) for (const target of LOCALES) {
    const suffix = '/research/papers/quiver/?ref=paper&lang=en#section-overview';
    const sourcePath = (source.id === 'zh-cn' ? '' : '/' + source.id) + suffix;
    const targetPath = (target.id === 'zh-cn' ? '' : '/' + target.id) + suffix;
    assert.equal(localePath(sourcePath, target.id), targetPath);
  }
  assert.equal(localePath('/en', 'zh-cn'), '/');
  assert.equal(localePath('/', 'zh-hant'), '/zh-hant/');
  assert.equal(localePath('/fr/about?from=home#about-name', 'de'), '/de/about/?from=home#about-name');
});
