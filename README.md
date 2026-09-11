# Astrmira 官网 (The Research Observatory)

Astrmira（幻梦星芒）官方网站工程，基于 **Astro 静态优先架构** 构建，专为部署至 **Cloudflare Pages** 设计，兼具出版物级审美、沉浸式天体交互与顶级的 SEO / AI 可检索性。

---

## 目录结构

```
Astrmira-web/
├── public/                 # 静态资源与 Favicon
├── src/
│   ├── styles/
│   │   └── global.css      # 全局深墨色(#090c12)与象牙白(#eeeae1)设计变量
│   ├── layouts/
│   │   └── Layout.astro    # 统一母版（SEO Meta、JSON-LD、星空微粒子画布）
│   ├── components/
│   │   ├── Header.astro    # 悬浮顶部导航（支持移动端折叠）
│   │   ├── MiraHero.astro  # 首屏中央字标、品牌主张与开场控制
│   │   ├── StarCompanion.astro # 【核心交互】3D天体 -> 梵高笔触 -> 极简几何蜕变与随屏伴随体
│   │   ├── ProjectSection.astro # 三大业务方向（数据系统、Agent平台、联合研究）
│   │   ├── ResearchSection.astro # 可解释原理交互实验室（向量近邻、量化、Agent闭环）
│   │   ├── OriginSection.astro   # NASA Mira (Omicron Ceti) 13光年星尾与品牌渊源
│   │   ├── CollabSection.astro   # 合作对话引导
│   │   └── Footer.astro    # 宏大水印与页脚信息
│   └── pages/
│       ├── index.astro     # 官网首页
│       ├── projects.astro  # 项目与系统研发专门列表与详情
│       ├── research.astro  # 学术研究论文与方向检索
│       ├── about.astro     # 公司使命、价值与变星之源
│       └── contact.astro   # 深度合作与简报生成页
├── astro.config.mjs        # Astro 配置文件（默认纯静态输出）
├── wrangler.toml           # Cloudflare Pages 配置文件
└── package.json
```

---

## 本地开发与调试

在 `D:\project\Astrmira\Astrmira-web` 目录下执行：

```bash
# 启动本地热重载开发服务器
npm run dev

# 编译纯静态生产文件（产物输出至 dist/）
npm run build

# 本地预览构建产物
npm run preview
```

## 国际化

- 默认语言为简体中文，继续使用现有的 `/`、`/projects/`、`/research/` 等 URL。
- 英文页面使用 `/en/` 前缀，并为现有页面提供一一对应的静态路由。
- 首次访问根据 `navigator.languages` 在中文和英文间选择；导航中的语言开关会记录用户选择，并覆盖后续自动识别。
- 页面输出独立的 `lang`、canonical 与 `hreflang`，语言链接通过 `src/i18n.ts` 统一生成。
- 新增语言时应先补齐页面内容和对应静态路由，再加入 `astro.config.mjs` 的 `i18n.locales`。

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
