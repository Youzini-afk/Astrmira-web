import { LOCALES, localePath, type Locale } from '../i18n';
import { getContent, getUi } from '../i18n/content';
import { papers, arxivUrl } from '../data/papers';
import { projectDetails, researchFields } from '../data/english';
import { resolveContactEmail } from '../config/contact.js';

export function structuredData({ title, description, route, locale, canonical, site }: {
  title: string; description: string; route: string; locale: Locale; canonical: URL; site: URL;
}) {
  const ui = getUi(locale);
  const lang = LOCALES.find(item => item.id === locale)!.lang;
  const url = canonical.href;
  const absolute = (path: string) => new URL(path, site).href;
  const localized = (path: string) => absolute(localePath(path, locale));
  const organizationId = absolute('/#organization');
  const siteId = absolute('/#website');
  const pageId = url + '#webpage';
  const paper = route.startsWith('research/papers/') ? papers.find(p => p.slug === route.split('/').at(-1)) : undefined;
  const project = route.startsWith('projects/') ? projectDetails[route.split('/').at(-1) as keyof typeof projectDetails] : undefined;
  const graph: Record<string, any>[] = [
    {
      '@type': 'Organization', '@id': organizationId, name: 'Astrmira', alternateName: '幻梦星芒', url: absolute('/'),
      description: locale === 'zh-cn' ? 'Astrmira（幻梦星芒）围绕数据、计算与智能的基础问题开展研究，并构建开放的系统与工具。' : getContent(locale).home.description,
      logo: { '@type': 'ImageObject', url: absolute('/apple-touch-icon.png'), width: 180, height: 180 },
      email: resolveContactEmail(import.meta.env.PUBLIC_CONTACT_EMAIL),
    },
    { '@type': 'WebSite', '@id': siteId, name: 'Astrmira', alternateName: '幻梦星芒', url: absolute('/'), publisher: { '@id': organizationId }, inLanguage: LOCALES.map(item => item.lang) },
    {
      '@type': route === 'about' ? 'AboutPage' : route === 'collaborate' ? 'ContactPage' : ['projects', 'research'].includes(route) ? 'CollectionPage' : 'WebPage',
      '@id': pageId, url, name: title, description, inLanguage: lang,
      isPartOf: { '@id': siteId }, about: { '@id': organizationId },
      primaryImageOfPage: { '@type': 'ImageObject', url: absolute('/social-card.png'), width: 1200, height: 630 },
    },
  ];
  const page = graph[2];
  if (paper) {
    const id = arxivUrl(paper);
    const translated = locale === 'zh-cn' ? paper : getContent(locale).papers[paper.slug];
    page.mainEntity = { '@id': id };
    graph.push({
      '@type': 'ScholarlyArticle', '@id': id, url: id, headline: paper.title, alternativeHeadline: translated.heading,
      abstract: translated.summary, author: paper.authors.map(name => ({ '@type': 'Person', name })),
      datePublished: paper.submitted, dateModified: paper.updated, version: paper.version,
      identifier: { '@type': 'PropertyValue', propertyID: 'arXiv', value: paper.arxiv },
      encoding: { '@type': 'MediaObject', contentUrl: `https://arxiv.org/pdf/${paper.arxiv}${paper.version}`, encodingFormat: 'application/pdf' },
      subjectOf: { '@id': pageId },
    });
  } else if (project) {
    const id = url + '#software';
    page.mainEntity = { '@id': id };
    const licenses: Record<string, string> = { 'Apache-2.0': 'https://www.apache.org/licenses/LICENSE-2.0', 'AGPL-3.0': 'https://www.gnu.org/licenses/agpl-3.0.html' };
    const license = licenses[project.license];
    graph.push({ '@type': 'SoftwareSourceCode', '@id': id, name: project.name, description, url, codeRepository: project.repository, ...(license ? { license } : {}) });
  } else if (route === 'research' || route === 'projects') {
    const entries = route === 'research'
      ? papers.map(p => ({ name: p.title, url: localized(`/research/papers/${p.slug}/`) }))
      : Object.entries(projectDetails).map(([slug, p]) => ({ name: p.name, url: localized(`/projects/${slug}/`) }));
    page.mainEntity = { '@type': 'ItemList', itemListElement: entries.map((entry, index) => ({ '@type': 'ListItem', position: index + 1, ...entry })) };
  }
  if (route !== 'home') {
    const items = [{ name: ui.nav.home, item: localized('/') }];
    const group = route.split('/')[0];
    if (route.includes('/') && (group === 'projects' || group === 'research')) items.push({ name: ui.nav[group], item: localized(`/${group}/`) });
    const field = route.split('/')[1] as keyof typeof researchFields;
    const fieldName = researchFields[field] ? (locale === 'zh-cn' ? ({ databases: '数据库', retrieval: '检索', vectors: '向量', quantization: '量化', 'post-training': '后训练', mathematics: '数学' }[field]) : getContent(locale).fields[field][0]) : undefined;
    const labels: Record<string, string> = ui.nav;
    const name = paper?.title || project?.name || fieldName || labels[route] || title.split(' — ')[0];
    items.push({ name, item: url });
    page.breadcrumb = { '@id': url + '#breadcrumb' };
    graph.push({ '@type': 'BreadcrumbList', '@id': url + '#breadcrumb', itemListElement: items.map((entry, index) => ({ '@type': 'ListItem', position: index + 1, ...entry })) });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}
