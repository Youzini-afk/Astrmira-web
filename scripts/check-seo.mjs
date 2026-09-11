import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';
import { attr, findNodes, textContent } from '../integrations/discovery.mjs';
import { LOCALES } from '../src/i18n/routing.js';
import { markdownPath } from '../src/seo/paths.js';
import { papers } from '../src/data/papers.ts';

const root = path.resolve('dist');
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(full));
    else if (entry.name.endsWith('.html')) result.push(full);
  }
  return result;
}
const sitemap = await readFile(path.join(root, 'sitemap.xml'), 'utf8');
const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
assert.equal(locations.length, new Set(locations).size);
const index = await readFile(path.join(root, 'llms.txt'), 'utf8');
const full = await readFile(path.join(root, 'llms-full.txt'), 'utf8');
const robots = await readFile(path.join(root, 'robots.txt'), 'utf8');
assert.match(robots, /^User-agent: \*\nAllow: \/\n/m);
assert.ok(robots.includes('Sitemap: https://www.astrmira.com/sitemap.xml'));
assert.ok(!robots.includes('<html'));
const visited = [];
let aliases = 0;
for (const file of await files(root)) {
  const pathname = '/' + path.relative(root, file).split(path.sep).join('/').replace(/index\.html$/, '');
  const html = await readFile(file, 'utf8');
  const document = parse(html);
  const first = predicate => findNodes(document, predicate)[0];
  const meta = name => attr(first(n => n.tagName === 'meta' && (attr(n, 'name') === name || attr(n, 'property') === name)) || {}, 'content');
  if (pathname === '/404.html') {
    assert.ok(meta('robots').includes('noindex'));
    assert.ok(!html.includes('bootstrapLocale'), 'The 404 response must not redirect to another missing page.');
    continue;
  }
  const canonical = attr(first(n => n.tagName === 'link' && attr(n, 'rel') === 'canonical'), 'href');
  if (canonical !== 'https://www.astrmira.com' + pathname) {
    assert.ok(pathname.endsWith('/contact/') && canonical.endsWith('/collaborate/'));
    assert.ok(!locations.includes('https://www.astrmira.com' + pathname));
    aliases++; continue;
  }
  visited.push(canonical);
  assert.ok(locations.includes(canonical), pathname);
  assert.equal(findNodes(document, n => n.tagName === 'h1').length, 1, pathname);
  assert.ok(meta('description'), pathname);
  assert.equal(meta('og:url'), canonical);
  assert.equal(meta('og:title'), textContent(first(n => n.tagName === 'title')));
  assert.equal(meta('og:description'), meta('description'));
  assert.equal(meta('twitter:card'), 'summary_large_image');
  await access(path.join(root, new URL(meta('og:image')).pathname));
  assert.ok(!html.includes('location.replace('), 'Reading a page must not trigger a language redirect.');
  const alternates = findNodes(document, n => n.tagName === 'link' && attr(n, 'hreflang'));
  assert.equal(alternates.length, LOCALES.length + 1);
  for (const alt of alternates) assert.ok(locations.includes(attr(alt, 'href')), pathname);
  const readablePath = markdownPath(pathname);
  assert.equal(attr(first(n => n.tagName === 'link' && attr(n, 'type') === 'text/markdown'), 'href'), 'https://www.astrmira.com' + readablePath);
  const md = await readFile(path.join(root, readablePath), 'utf8');
  assert.ok(md.includes('Source: ' + canonical));
  assert.ok(index.includes('https://www.astrmira.com' + readablePath));
  assert.ok(full.includes(md.trim()), pathname);
  assert.ok(!md.includes('<svg') && !md.includes('data-research-item'));
  const graph = JSON.parse(textContent(first(n => n.tagName === 'script' && attr(n, 'type') === 'application/ld+json')))['@graph'];
  assert.ok(graph.find(n => n['@type'] === 'Organization').email);
  assert.ok(graph.find(n => n['@type'] === 'WebSite'));
  const paper = papers.find(p => pathname.includes('/papers/' + p.slug + '/'));
  if (paper) {
    const article = graph.find(n => n['@type'] === 'ScholarlyArticle');
    assert.equal(article.headline, paper.title);
    assert.deepEqual(article.author.map(a => a.name), paper.authors);
    assert.equal(article.version, paper.version);
    assert.equal(article.dateModified, paper.updated);
    assert.equal(meta('citation_title'), paper.title);
    assert.equal(meta('citation_pdf_url'), 'https://arxiv.org/pdf/' + paper.arxiv + paper.version);
    assert.ok(md.includes(paper.title) && md.includes(paper.arxiv));
    for (const author of paper.authors) assert.ok(md.includes(author));
  }
}
assert.deepEqual(visited.sort(), [...locations].sort());
assert.equal(aliases, LOCALES.length);
assert.ok(locations.includes('https://www.astrmira.com/'));
const headers = await readFile(path.join(root, '_headers'), 'utf8');
assert.ok(headers.includes('Content-Type: text/markdown; charset=utf-8'));
assert.ok(headers.includes('Link: <https://www.astrmira.com/:splat>; rel="canonical"'));
console.log(`PASS: ${visited.length} canonical pages, ${aliases} aliases, sitemap, robots, readable exports, multilingual metadata, citations and sharing cards.`);
