import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse, serialize } from 'parse5';
import TurndownService from 'turndown';
import { LOCALES } from '../src/i18n/routing.js';
import { markdownPath } from '../src/seo/paths.js';

export const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value;
export function findNodes(node, predicate) {
  return (predicate(node) ? [node] : []).concat((node.childNodes || []).flatMap(child => findNodes(child, predicate)));
}
export const textContent = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(textContent).join('');
const escapeXml = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const markdownLabel = text => text.replace(/[\[\]\\]/g, '\\$&').replace(/\s+/g, ' ').trim();

// Export what visitors can actually read. No second hand-maintained catalog,
// client execution, canvas pixels, or hidden interaction states are involved.
export function extractPage(html, url) {
  const document = parse(html);
  const first = predicate => findNodes(document, predicate)[0];
  const meta = name => attr(first(n => n.tagName === 'meta' && attr(n, 'name') === name) || {}, 'content');
  if (meta('robots')?.includes('noindex')) return null;
  const canonical = attr(first(n => n.tagName === 'link' && attr(n, 'rel') === 'canonical') || {}, 'href');
  if (!canonical || canonical !== url) return null; // Exclude aliases from discovery.
  const main = first(n => n.tagName === 'main');
  if (!main) throw new Error(`No readable main content: ${url}`);
  const title = textContent(first(n => n.tagName === 'title'));
  const lang = attr(first(n => n.tagName === 'html'), 'lang');
  const alternate = findNodes(document, n => n.tagName === 'link' && attr(n, 'rel') === 'alternate' && attr(n, 'hreflang'))
    .map(n => ({ lang: attr(n, 'hreflang'), url: attr(n, 'href') }));
  const excluded = new Set(['script', 'style', 'svg', 'canvas', 'button', 'input', 'select', 'textarea', 'noscript', 'template']);
  function clean(node) {
    node.childNodes = (node.childNodes || []).filter(child => !excluded.has(child.tagName) && attr(child, 'hidden') === undefined && attr(child, 'aria-hidden') !== 'true');
    for (const child of node.childNodes) {
      if (child.tagName === 'a') {
        const href = child.attrs.find(a => a.name === 'href');
        if (href) href.value = new URL(href.value, url).href;
      }
      clean(child);
    }
    // Preserve the separators supplied by grid/flex layouts. These are metadata
    // groups, not inline fragments such as the Astr + mira wordmark.
    const classes = (attr(node, 'class') || '').split(/\s+/);
    const metadata = node.tagName === 'dd' || classes.some(name => ['topic-list', 'paper-art-meta', 'coordinates', 'domains-inner', 'paper-card-footer'].includes(name));
    if (classes.includes('domains-inner')) node.childNodes = node.childNodes.filter(child => child.tagName !== 'i');
    if (metadata) node.childNodes = node.childNodes.flatMap((child, i) => i && child.tagName ? [{ nodeName: '#text', value: ' · ', parentNode: node }, child] : [child]);
  }
  clean(main);
  const markdown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' });
  markdown.addRule('heading-emphasis', { filter: node => ['EM', 'STRONG'].includes(node.nodeName) && /^H[1-6]$/.test(node.parentNode?.nodeName), replacement: content => content });
  markdown.addRule('linked-card', {
    filter: node => node.nodeName === 'A' && node.querySelector('h1,h2,h3,h4,h5,h6'),
    replacement: (content, node) => '\n\n' + content.trim() + '\n\n<' + node.getAttribute('href') + '>\n\n',
  });
  markdown.addRule('definition-term', { filter: 'dt', replacement: content => '\n\n**' + content.trim() + '**: ' });
  markdown.addRule('definition-value', { filter: 'dd', replacement: content => content.trim() + '\n\n' });
  const body = markdown.turndown(serialize(main));
  if (!body.includes('# ')) throw new Error(`Missing heading in readable content: ${url}`);
  return { url, title, lang, description: meta('description'), alternate, body };
}

export function createSitemap(pages) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + pages.map(page =>
    '  <url>\n    <loc>' + escapeXml(page.url) + '</loc>\n' + page.alternate.map(alt =>
      '    <xhtml:link rel="alternate" hreflang="' + escapeXml(alt.lang) + '" href="' + escapeXml(alt.url) + '" />').join('\n') + '\n  </url>'
  ).join('\n') + '\n</urlset>\n';
}

export default function discovery() {
  let site;
  return {
    name: 'astrmira-discovery',
    hooks: {
      'astro:config:done': ({ config }) => { site = config.site; },
      'astro:build:done': async ({ dir, pages, logger }) => {
        if (!site) throw new Error('A canonical site URL is required to generate discovery files.');
        const root = fileURLToPath(dir);
        const documents = [];
        for (const page of pages) {
          const pathname = '/' + page.pathname.replace(/^\//, '');
          if (pathname === '/404' || pathname === '/404.html' || pathname === '/404/') continue;
          const normalized = pathname.endsWith('/') ? pathname : pathname + '/';
          const file = path.join(root, normalized, 'index.html');
          const document = extractPage(await readFile(file, 'utf8'), new URL(normalized, site).href);
          if (document) documents.push(document);
        }
        documents.sort((a, b) => a.url.localeCompare(b.url));
        const urls = new Set(documents.map(page => page.url));
        for (const page of documents) for (const alt of page.alternate) {
          if (!urls.has(alt.url)) throw new Error(`Alternate URL is not a canonical page: ${alt.url}`);
        }
        for (const page of documents) {
          const output = path.join(root, markdownPath(new URL(page.url).pathname));
          await mkdir(path.dirname(output), { recursive: true });
          await writeFile(output, `Source: ${page.url}\nLanguage: ${page.lang}\n\n${page.body}\n`, 'utf8');
        }
        const mapUrl = new URL('/sitemap.xml', site).href;
        await writeFile(path.join(root, 'sitemap.xml'), createSitemap(documents), 'utf8');
        await writeFile(path.join(root, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${mapUrl}\n`, 'utf8');
        let index = '# Astrmira\n\n> Research and open-source systems in data, computation, and intelligence. 幻梦星芒：围绕数据、计算与智能开展研究和系统实践。\n\n';
        index += 'Each link below is a text version of the corresponding public page, generated from its HTML at build time. Original paper titles, authors, versions, and source links are retained.\n\n';
        index += `- [Sitemap](${mapUrl})\n- [All page text](${new URL('/llms-full.txt', site).href})\n\n`;
        for (const locale of LOCALES) {
          index += `## ${locale.name}\n\n`;
          for (const page of documents.filter(page => page.lang === locale.lang)) {
            index += `- [${markdownLabel(page.title)}](${new URL(markdownPath(new URL(page.url).pathname), site).href}): ${page.description}\n`;
          }
          index += '\n';
        }
        await writeFile(path.join(root, 'llms.txt'), index, 'utf8');
        await writeFile(path.join(root, 'llms-full.txt'), documents.map(page => `# ${page.title}\n\nSource: ${page.url}\nLanguage: ${page.lang}\n\n${page.body}`).join('\n\n---\n\n') + '\n', 'utf8');
        // /path/index.md maps directly to /path/. A single wildcard keeps the
        // canonical response header correct for every locale and nesting depth.
        const headers = `/robots.txt\n  Content-Type: text/plain; charset=utf-8\n\n/sitemap.xml\n  Content-Type: application/xml; charset=utf-8\n\n/llms*.txt\n  Content-Type: text/plain; charset=utf-8\n\n/*index.md\n  Content-Type: text/markdown; charset=utf-8\n  Link: <${new URL('/:splat', site).href}>; rel="canonical"\n`;
        const existingHeaders = await readFile(path.join(root, '_headers'), 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
        await writeFile(path.join(root, '_headers'), existingHeaders + '\n' + headers, 'utf8');
        logger.info(`Generated ${documents.length} canonical URLs and Markdown pages, sitemap.xml, robots.txt and AI reading indexes.`);
      },
    },
  };
}
