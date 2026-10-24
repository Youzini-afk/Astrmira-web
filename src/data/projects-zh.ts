import { projectDetails } from './english';

// Simplified Chinese copy for project pages rendered by the shared detail template.
// Repository facts and links come from the English record; only display text lives here.
export const varinChinese = {
  ...projectDetails.varin,
  eyebrow: 'VARIN / AGENT WORKSPACE',
  title: '把模型、工具和项目，放进同一个工作台。',
  description: '开源的通用 Agent 工作台。你可以和 Agent 一起排查问题、编写代码、查阅论文，或制作交互式说明，并在同一段对话里查看过程与结果。Varin 提供桌面端和网页端，也有连接 Host 的移动客户端。',
  tags: ['Rust', 'TypeScript', '桌面', '网页', '移动端'],
  status: '1.0 之前的活跃开发阶段',
  figure: '模型、工具、文件与项目汇入同一个 Rust 运行时，再由不同工作台在桌面、网页与移动端呈现。',
  sections: [
    { title: '一个工作空间，容纳整项工作。', paragraphs: ['Varin 的 Harness 负责连接模型、工具、上下文、权限、后台工作和子 Agent。原生 Rust 运行时保存会话与执行记录，共享的 Application Host 提供模型连接和工作区服务。'] },
    { title: '用 Varin 做什么。', features: [
      ['TASKS', '推进一项任务', '流式对话、消息队列、计划、子 Agent 和定时接续。'],
      ['PROJECTS', '开发项目', '文件编辑、差异查看、Git 与 worktree、终端，以及代码检索和语言工具。'],
      ['RESEARCH', '阅读与研究', '网页与学术检索、PDF 阅读，在对话旁保留原始材料。'],
      ['VISUALS', '制作可视化内容', '生成和编辑图像，在消息中制作交互式 HTML 图表和小工具。'],
      ['SETUP', '组织自己的工具', '连接云端或本地模型，设置权限，配置指令、skills 和 MCP 服务。'],
      ['DEVICES', '跨设备工作', '使用本地工作区，或从桌面、浏览器和移动端连接远程 Host。'],
    ] },
    { title: '四种工作台，共用一份状态。', paragraphs: ['内置的 Agent、IDE、Research 和 Bot 工作台为不同任务提供相应布局，共用同一份会话、文件和运行中的工作。工作台由普通内置扩展提供，可以停用或替换；切换工作台不会改变模型、权限或已经开始的工作。'], workbenches: [
      ['Agent', '以对话和任务为中心，编辑器放在聊天旁边。', '桌面 · 网页 · 移动端'],
      ['IDE', '编辑器居中，配合 Git、终端与语言工具。', '桌面 · 网页'],
      ['Research', '面向检索、阅读论文和保留原始材料的布局。', '桌面 · 网页 · 移动端'],
      ['Bot', 'Bot 会话拥有独立的归属与知识。', '桌面 · 网页 · 移动端'],
    ] },
    { title: '可以扩展的工作台。', paragraphs: ['常用工具直接声明，其他可用能力通过索引和按需说明提供，读取说明时保持工具声明前缀稳定。扩展可以添加工具、模型适配器、面板，乃至整套工作台布局。', '计划与知识由私有的 KnowledgeStore 进程保存，底层使用 TriviumDB。'] },
    { title: '从这里开始。', paragraphs: ['Varin 正处于 1.0 之前的活跃开发阶段，发布说明记录各发行版的内容。升级前请备份重要的应用数据。'], start: [
      ['DESKTOP', 'Windows、macOS 或 Linux', '选择与你的系统和 CPU 架构对应的安装包。', '下载发行版'],
      ['SELF-HOSTED', '自己的电脑或服务器', '用 Docker 部署并通过浏览器访问，包含持久化目录、密码和远程访问配置。', 'Docker 自托管'],
      ['MOBILE', 'iOS 或 Android', '移动客户端连接已有的 Host。', '移动端配置'],
      ['EXTEND', '开发扩展', '从扩展作者指南、SDK 或示例开始，为工作台添加能力。', '扩展作者指南'],
    ] },
  ],
};
