import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPage, createSitemap } from '../integrations/discovery.mjs';
import { canonicalPath, markdownPath } from '../src/seo/paths.js';

test('readable export keeps real text, citations and links while excluding visual and hidden states', () => {
  const url = 'https://www.astrmira.com/research/papers/example/';
  const html = `<html lang="zh-CN"><head><title>Astrmira · 研究</title><link rel="canonical" href="${url}"><meta name="description" content="正文摘要"></head><body><header>Navigation</header><main><h1>Astr<em>mira</em></h1><p>误差 &amp; 信息：不是同一件事。</p><svg><text>VISUAL_NOISE</text></svg><div hidden>NO_RESULTS</div><span aria-hidden="true">DECORATION</span><button>CONTROL</button><script>PRIVATE_SCRIPT</script><p><a href="/projects/data-systems/">TriviumDB</a></p><dl><dt>作者</dt><dd><span>Alice</span><span>Bob</span></dd></dl><figure><figcaption>保留图注。</figcaption></figure><a href="https://arxiv.org/abs/2605.02171v3">论文原文</a></main><footer>Footer</footer></body></html>`;
  const page = extractPage(html, url);
  assert.equal(page.lang, 'zh-CN');
  assert.ok(page.body.includes('# Astrmira'));
  assert.ok(page.body.includes('误差 & 信息：不是同一件事。'));
  assert.ok(page.body.includes('https://www.astrmira.com/projects/data-systems/'));
  assert.ok(page.body.includes('Alice · Bob') && page.body.includes('保留图注。'));
  assert.ok(page.body.includes('https://arxiv.org/abs/2605.02171v3'));
  for (const hidden of ['VISUAL_NOISE', 'NO_RESULTS', 'DECORATION', 'CONTROL', 'PRIVATE_SCRIPT', 'Navigation', 'Footer']) assert.ok(!page.body.includes(hidden), hidden);
});

test('aliases and noindex pages do not enter discovery outputs', () => {
  assert.equal(extractPage('<meta name="robots" content="noindex, follow"><main>Missing</main>', 'https://www.astrmira.com/404.html'), null);
  assert.equal(extractPage('<link rel="canonical" href="https://www.astrmira.com/collaborate/"><main>Contact</main>', 'https://www.astrmira.com/contact/'), null);
  assert.equal(canonicalPath('/fr/contact/', 'fr'), '/fr/collaborate/');
  assert.equal(canonicalPath('/en/projects/contact/', 'en'), '/en/projects/contact/');
  assert.equal(markdownPath('/'), '/index.md');
  assert.equal(markdownPath('/ja/research/papers/quiver/'), '/ja/research/papers/quiver/index.md');
});

test('cards become readable sections instead of invalid multiline Markdown links', () => {
  const url = 'https://www.astrmira.com/projects/';
  const page = extractPage(`<title>Projects</title><link rel="canonical" href="${url}"><main><h1>Projects</h1><a href="/projects/data-systems/"><h2>TriviumDB</h2><p>A shared data core.</p></a><div class="topic-list"><span>Rust</span><span>Python</span></div></main>`, url);
  assert.ok(page.body.includes('## TriviumDB'));
  assert.ok(page.body.includes('<https://www.astrmira.com/projects/data-systems/>'));
  assert.ok(page.body.includes('Rust · Python'));
  assert.ok(!page.body.includes('[\n'));
});

test('sitemap escapes XML characters and keeps reciprocal language references', () => {
  const sitemap = createSitemap([{ url: 'https://example.org/?a=1&b=2', alternate: [{ lang: 'en', url: 'https://example.org/en/?a=1&b=2' }] }]);
  assert.ok(sitemap.includes('<loc>https://example.org/?a=1&amp;b=2</loc>'));
  assert.ok(sitemap.includes('hreflang="en" href="https://example.org/en/?a=1&amp;b=2"'));
  assert.ok(!sitemap.includes('<lastmod>'), 'Do not invent freshness dates on every build.');
});
