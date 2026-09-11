# Astrmira 官网

Astrmira（幻梦星芒）官方网站，使用 **Astro 静态架构**，部署到 **Cloudflare Pages**。正文直接输出为 HTML，星空与粒子交互作为渐进增强；站点地图、结构化信息与 Markdown 正文由构建流程生成。

---

## 目录结构

```
Astrmira-web/
├── public/                 # 静态资源与 Favicon
├── src/
│   ├── styles/
│   │   ├── global.css      # 基础样式与设计变量
│   │   ├── controls.css    # 按钮、文字链接、筛选和标签的共用样式
│   │   └── responsive.css  # 手机、平板、横屏、安全区域与触摸适配
│   ├── layouts/
│   │   └── Layout.astro    # 统一母版（SEO Meta、JSON-LD、星空微粒子画布）
│   ├── components/
│   │   ├── Header.astro    # 导航、移动菜单与七语言选择器
│   │   ├── StarCompanion.astro # 随滚动飞行、留下星尾并停靠的星体
│   │   ├── ProjectCard.astro # TriviumDB、infOS、Piarium 共用卡片
│   │   ├── PaperCarousel.astro # 可横向翻阅的论文卡片
│   │   ├── AboutPage.astro # 关于页共用结构
│   │   ├── ContactPage.astro # 七语言联系页、邮箱与来信建议
│   │   ├── pages/          # 国际化首页、列表、详情和合作页模板
│   │   └── Footer.astro    # 宏大水印与页脚信息
│   ├── data/               # 项目、论文元数据与基础文案
│   ├── i18n/
│   │   ├── routing.js      # 语言定义、路径转换与首次访问识别
│   │   ├── base-content.ts # 英文基础内容结构
│   │   ├── content.ts      # 翻译完整性校验与服务端读取
│   │   ├── ui.ts           # 中英文共用交互文案
│   │   └── messages/       # 繁体中文、日、韩、法、德完整翻译
│   └── pages/
│       ├── index.astro     # 简体中文首页
│       ├── projects/       # 简体中文项目列表与详情
│       ├── research/       # 简体中文论文、研究方向与详情
│       ├── about.astro     # 关于页入口
│       ├── collaborate.astro # 邮箱联系与合作页
│       └── [locale]/[...path].astro # 六种带语言前缀的静态页面
├── astro.config.mjs        # Astro 配置文件（默认纯静态输出）
├── wrangler.toml           # Cloudflare Pages 配置文件
└── package.json
```

---

## 本地开发与调试

在 `D:\project\Astrmira\Astrmira-web` 目录下执行：

```bash
# 启动本地热重载开发服务器
npm run dev -- --background

# 编译纯静态生产文件（产物输出至 dist/）
npm run build

# 本地预览构建产物
npm run preview
```

## 国际化

- 默认语言为简体中文，继续使用现有的 `/`、`/projects/`、`/research/` 等 URL。
- 其余语言分别使用 `/zh-hant/`（繁體中文）、`/en/`（English）、`/ja/`（日本語）、`/ko/`（한국어）、`/fr/`（Français）、`/de/`（Deutsch）。每种语言有 20 个页面，共 140 个静态路由。
- 语言菜单按 `navigator.languages` 的顺序标出推荐语言，无匹配时推荐英文。中文优先遵循 `Hans` / `Hant` 脚本；没有脚本时，台湾、香港、澳门推荐繁体，其他中文环境推荐简体。日、韩、法、德、英语的地区变体使用对应语言。
- 每个网址保持其发布语言，加载时不自动重定向，以便搜索引擎和读者稳定访问所有版本。地球图标打开语言菜单，点击切换后将选择保存到 `localStorage`，下次推荐优先遵循该选择。切换保留页面路径、查询参数和锚点；存储不可用时仍可切换，禁用 JavaScript 时仍有原生菜单与链接。
- 每页输出独立的 `lang`、canonical、七语言 `hreflang` 以及默认入口 `x-default`。语言定义、路径生成和浏览器识别共用 `src/i18n/routing.js`，Astro 配置直接读取同一份定义。
- 英文与五种新语言共用 `src/components/pages/` 模板，由动态路由在构建时生成。页面长文案只参与静态构建，浏览器仅接收当前语言的交互文案，不下载所有翻译。原有简体中文页面保留。
- 翻译文件在 `src/i18n/messages/`，对应 `base-content.ts` 的结构。品牌、仓库、许可证标识、论文原题和作者等元数据共用；展示文案全部提供翻译，数组长度和 `{count}`、`{language}` 等占位符必须一致，缺失会直接使构建失败。
- 增加内容时同步更新五份翻译；新增语言需补齐翻译、扩展 `src/i18n.ts` 类型并加入 `routing.js` 的 `LOCALES`，路由和菜单会自动生成。
- 验证：`node --test tests/*.test.js`；构建后运行 `node scripts/check-i18n-browser.mjs`，检查全部路由、语言识别、选择记忆、链接、移动菜单、无 JS 导航、本地化筛选、目录与联系邮箱复制。需要现有 Playwright 和 Edge，可设置 `PLAYWRIGHT_MODULE` 指向模块路径。

## SEO 与 AI 读取

- `src/pages/404.astro` 输出根目录 `404.html`，使 Cloudflare Pages 对不存在的 URL 返回真正的 404，避免将所有未知路径回退到首页并返回 200。
- `src/layouts/Layout.astro` 与 `src/seo/metadata.ts` 输出 canonical、七语言 hreflang、页面独立描述、Open Graph / Twitter 分享信息，以及 Organization、WebSite、WebPage、BreadcrumbList、项目源码和论文结构化信息。论文另有作者、发布日期、arXiv ID 与版本 PDF 的引用元数据。
- `/contact/` 及其语言版本保留为可访问的别名，canonical 指向同语言 `/collaborate/`，避免重复收录。
- `integrations/discovery.mjs` 在 Astro 构建完成后读取实际生成的 HTML。它自动生成 `robots.txt`、含 133 个正式 URL 的 `sitemap.xml`、`llms.txt`、`llms-full.txt`，以及每个正式页面的 `index.md`。例如 `/projects/data-systems/index.md` 对应 `/projects/data-systems/`。新增页面会跟随构建进入目录，不需要维护第二份正文。
- Markdown 保留公开正文、标题、图注和引用链接，去掉画布、SVG 点线、脚本、按钮及隐藏的交互状态；所有链接转换为绝对地址。每页 HTML 通过 `rel="alternate"` 指向 Markdown，Markdown 响应通过 HTTP `Link` 标记对应的 HTML canonical。
- `_headers` 在构建时补上文本、Markdown 与 XML 的正确类型，保留已有自定义规则。未添加爬虫禁令，也没有修改 Cloudflare 账号的机器人策略。
- 本地验证：`npm run build` 后运行 `node scripts/check-seo.mjs`；浏览器语言行为使用 `node scripts/check-i18n-browser.mjs`。这些发现文件只在生产构建中生成，使用 `npm run preview` 查看。
- 线上核对 `robots.txt` 和 `sitemap.xml` 的正文与 Content-Type、未知路径的 404、Markdown 的正文及 canonical 响应头。提交 [站点地图](https://www.astrmira.com/sitemap.xml) 到搜索平台需要站点所有者的 Search Console / Webmaster Tools 权限。AI 搜索的收录仍遵循各服务的抓取策略，`llms.txt` 是辅助阅读入口，并非搜索收录的替代条件。

相关规则：[Cloudflare Pages 的 404 与 SPA 回退](https://developers.cloudflare.com/pages/configuration/serving-pages/)、[Google 多语言网站指南](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)、[Google 的 AI 搜索与网站说明](https://developers.google.com/search/docs/appearance/ai-features)。

## 联系邮箱

- `/collaborate/` 与 `/contact/` 使用同一联系页，七种语言共用 `src/components/ContactPage.astro`。页面展示邮箱、合作方向与来信建议，客户使用自己的邮箱撰写。
- 收件地址通过 `PUBLIC_CONTACT_EMAIL` 配置，默认 `contact@astrmira.com`。本地可以复制 `.env.example` 为 `.env`；Cloudflare Pages 中在项目的构建环境变量里设置该值，然后重新构建部署。地址是公开信息，不需要邮件密码或 API 密钥。
- 邮箱在静态构建时写入 HTML，修改环境变量需要重新构建；只接受一个邮箱地址，错误配置会使构建失败，避免发布不可用的联系方式。
- 「复制邮箱」只操作剪贴板，不跳转邮件应用，不提交内容。剪贴板不可用时选中地址并提示手动复制；禁用 JavaScript 时仍显示地址和复制说明。

## 手机与平板

- 共用的响应式布局位于 `src/styles/responsive.css`，卡片内部样式保留在各组件中。项目卡片在 1100px 以下分两列，720px 以下单列；导航在 900px 以下收起；详情目录在 1000px 以下折叠到正文上方。
- 首屏使用稳定的小视口高度，背景画布使用大视口高度，地址栏伸缩不重建粒子。真正的窗口尺寸、方向或像素密度变化仍会重新测量字形和星尾。
- 手机使用原生触摸滚动和横向翻阅；按钮按触摸设备扩大点击区域，保留页面缩放。横屏和设备安全区域分别适配。
- 构建后运行 `node scripts/check-responsive-browser.mjs`，检查中英文代表页面在 8 种尺寸下的布局，以及触摸、导航、目录、邮箱复制、旋转与无 JavaScript 导航。需要 Playwright 和已安装的 Edge；可用 `PLAYWRIGHT_MODULE` 指定现有 Playwright 模块路径。可选 `--screenshots=<目录>` 保存截图。
- 多语言排版可追加 `--locales=zh-hant,ja,ko,fr,de --sizes=320x568,820x1180,1440x900`；`node scripts/check-glyph-clarity.mjs --locales=zh-Hant,ja,ko,fr,de` 验证新增语言的移动端原生像素字形与背景动画隔离。

## 控件与卡片

- `controls.css` 区分浅色主按钮、轻量次按钮和文字链接；筛选、标签为胶囊形，图形区域使用更柔和的圆角。键盘聚焦状态与触摸目标保持可辨认、可操作。
- 项目卡只为图形提供浅底，标题、说明和标签直接排在页面上；论文卡先展示标题与摘要，再展示研究图形，保留横向翻阅和独立的 arXiv 链接。没有截断正文。
- 悬停反馈使用 CSS 的颜色、边缘与小幅位移，不增加指针追踪脚本；触摸设备不启用悬停缩放，减少动态偏好继续禁用过渡动画。卡片自身样式集中在各自组件中。

---

## 部署到 Cloudflare Pages (CF)

本工程完全支持 Cloudflare Pages 的纯静态极速分发，有两种部署方式：

### 方式 A：GitHub 联动自动化部署（推荐）
1. 将当前项目初始化 Git 并推送到你的 GitHub / GitLab 仓库；
2. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)；
3. 进入 **Workers & Pages** &rarr; **Create application** &rarr; **Pages** &rarr; **Connect to Git**；
4. 选中你的代码仓库，Framework preset 选择 **Astro**：
   * **Build command**: `npm run build`
   * **Build output directory**: `dist`
5. 点击 **Save and Deploy** 即可。以后每次 `git push` 会自动触发 Cloudflare 全球边缘网络更新。

### 方式 B：使用 Wrangler 命令行直接部署
1. 确保已运行过构建：
   ```bash
   npm run build
   ```
2. 执行部署命令：
   ```bash
   npx wrangler pages deploy dist --project-name astrmira
   ```
   *(首次使用会提示在浏览器授权登录 Cloudflare 账号，完成后几秒内即可上线)*
