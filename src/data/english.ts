export const projectDetails = {
  'data-systems': {
    name: 'TriviumDB', eyebrow: 'TRIVIUMDB / EMBEDDED DATABASE', kind: 'trivium',
    title: 'Vectors, graphs, and documents in one memory core.',
    description: 'An AI-native embedded database in Rust that lets semantic vectors, JSON documents, and graph relationships work over the same data. It provides a unified foundation for long-term agent memory, RAG, and local knowledge bases.',
    repository: 'https://github.com/YoKONCy/TriviumDB', license: 'Apache-2.0',
    tags: ['Rust', 'Python', 'Node.js'],
    figure: 'Use vectors to find similarity, documents to retain detail, and graphs to connect context.',
    sections: [
      { title: 'One record, three views.', paragraphs: ['A conversation carries meaning, source text, time, and relationships. TriviumDB binds vector data, JSON documents, and labeled graph edges to one node identity, reducing synchronization and result stitching across separate databases.'] },
      { title: 'Organize retrieval as a path.', features: [
        ['RETRIEVAL', 'Recall by meaning and by keyword', 'Combine dense vectors with BM25 text search, while QuIVer provides approximate nearest-neighbor acceleration.'],
        ['RELATIONS', 'Follow relationships into context', 'Continue from a retrieved node across labeled, weighted edges to connect people, events, documents, and concepts.'],
        ['QUERY LANGUAGE', 'Compose hybrid queries with TQL', 'One language connects vector retrieval, property filters, graph expansion, set operations, and aggregation.'],
        ['PERSISTENCE', 'Keep every view in one lifecycle', 'Write-ahead logging, transactions, and atomic publication manage vectors, documents, and graph relationships together.']
      ] },
      { title: 'Embed the database and keep data close.', paragraphs: ['TriviumDB runs in process through Rust, Python, or Node.js. Rom mode stores data in one portable .tdb file; Mmap mode separates vector and document storage for demand mapping.', 'The same model can organize conversational memory, personal knowledge, RAG document retrieval, and relationship memory for game characters.'] }
    ]
  },
  'agent-platform': {
    name: 'infOS', eyebrow: 'INFOS / AI COMPANION RUNTIME', kind: 'infos',
    title: 'Let memory continue. Bring companionship into everyday life.',
    description: 'An open-source runtime centered on a primary AI companion, organizing identity, long-term memory, workspaces, conversations, and tools. It powers persistent dialogue and desktop interaction for PeroperoChat.',
    repository: 'https://github.com/YoKONCy/infOS', license: 'Apache-2.0',
    tags: ['TypeScript', 'Rust', 'Desktop'],
    figure: 'Identity, memory, context, and tools working through one runtime.',
    sections: [
      { title: 'From one conversation to a continuing relationship.', paragraphs: ['A companion needs to remember shared experiences and understand what is happening now. infOS organizes identity, memory, context, and capabilities around one primary agent while keeping resource boundaries explicit for each session and scenario.'] },
      { title: 'Remember, reason, and continue the work.', features: [
        ['MEMORY', 'Turn shared experience into memory', 'Structure conversations as sourced events, then retrieve relevant experiences through semantics and relationships.'],
        ['CONTEXT', 'Build every prompt with provenance', 'Combine identity, recent messages, recalled memory, and available tools while recording which resources were used.'],
        ['EXECUTION', 'Turn intent into executable steps', 'A tool protocol supports conditions, loops, parallel work, and error handling, with capabilities governed by role and context.'],
        ['EXTENSIBILITY', 'Grow the companion through skills', 'Skills, tools, hooks, and MCP services add behavior without collapsing everything into one application.']
      ] },
      { title: 'One core across different experiences.', paragraphs: ['A TypeScript and Rust architecture supports desktop, web, and independent backend deployment. TriviumDB connects vector retrieval, events, and relationships underneath the memory layer.', 'PeroperoChat is the companion-facing experience: Live2D characters, custom identity, conversation, and long-term memory brought into everyday desktop interaction.'] }
    ]
  },
  // Varin grew out of Piarium (the old repository redirects here). Copy follows
  // the project's own README and docs; links and repository facts are metadata.
  varin: {
    name: 'Varin', eyebrow: 'VARIN / AGENT WORKSPACE', kind: 'varin',
    title: 'Bring models, tools, and projects into one workspace.',
    description: 'An open-source workspace for AI agents. Investigate a problem, write code, read papers, or build an interactive explanation with an agent, then review the work in the same conversation. Varin runs on desktop and the web, with a mobile client for connecting to your Host.',
    repository: 'https://github.com/Youzini-afk/Varin', license: 'AGPL-3.0',
    readmes: {
      'zh-cn': 'https://github.com/Youzini-afk/Varin/blob/main/.github/readme/README.zh-CN.md',
      'zh-hant': 'https://github.com/Youzini-afk/Varin/blob/main/.github/readme/README.zh-TW.md',
      ja: 'https://github.com/Youzini-afk/Varin/blob/main/.github/readme/README.ja.md',
      fr: 'https://github.com/Youzini-afk/Varin/blob/main/.github/readme/README.fr.md'
    },
    startLinks: [
      'https://github.com/Youzini-afk/Varin/releases',
      'https://github.com/Youzini-afk/Varin/blob/main/docs/ops/cloud-deployment.md',
      'https://github.com/Youzini-afk/Varin/blob/main/packages/mobile/README.md',
      'https://github.com/Youzini-afk/Varin/blob/main/docs/ops/varin-extension-authoring.md'
    ],
    tags: ['Rust', 'TypeScript', 'Desktop', 'Web', 'Mobile'],
    status: 'In active development before 1.0',
    figure: 'Models, tools, files, and projects meet in one Rust runtime; workbenches present the work on desktop, web, and mobile.',
    sections: [
      { title: 'One workspace for the whole piece of work.', paragraphs: ['Varin’s harness connects the model to tools, context, permissions, background work, and child agents. A native Rust runtime stores conversations and execution records, and the shared Application Host supplies model connections and workspace services.'] },
      { title: 'What you can do in Varin.', features: [
        ['TASKS', 'Work through a task', 'Streaming conversations, queued messages, plans, child agents, and scheduled follow-ups.'],
        ['PROJECTS', 'Develop a project', 'Edit files, inspect diffs, use Git and worktrees, run terminals, and search code with language and retrieval tools.'],
        ['RESEARCH', 'Read and research', 'Search the web and scholarly sources, read PDFs, and keep source material alongside the conversation.'],
        ['VISUALS', 'Make something visual', 'Generate and edit images, and create interactive HTML charts and small tools inside a message.'],
        ['SETUP', 'Choose your setup', 'Connect cloud or local models, set permissions, and configure instructions, skills, and MCP servers.'],
        ['DEVICES', 'Work across machines', 'Use a local workspace, or connect to a remote Host from desktop, a browser, or mobile.']
      ] },
      { title: 'Four workbenches, one shared state.', paragraphs: ['Each workbench arranges the same conversations, files, and running work for a different kind of task. Workbenches are ordinary built-in extensions that can be disabled or replaced; switching one does not change the model, the permissions, or work already under way.'], workbenches: [
        ['Agent', 'Conversation and tasks at the centre, with the editor beside the chat.', 'Desktop · Web · Mobile'],
        ['IDE', 'The editor at the centre, alongside Git, terminals, and language tools.', 'Desktop · Web'],
        ['Research', 'A layout for searching, reading papers, and keeping sources at hand.', 'Desktop · Web · Mobile'],
        ['Bot', 'Bot conversations with their own ownership and knowledge.', 'Desktop · Web · Mobile']
      ] },
      { title: 'A workspace you can extend.', paragraphs: ['Common tools are declared directly. Other capabilities have an index and on-demand descriptions, so discovering a tool keeps the declaration prefix stable. Extensions can add tools, model adapters, panels, and entire workbench layouts.', 'Plans and knowledge are kept by a private KnowledgeStore process built on TriviumDB.'] },
      { title: 'Start here.', paragraphs: ['Varin is in active development before 1.0, and the release notes describe each published build. Back up important application data before upgrading.'], start: [
        ['DESKTOP', 'Windows, macOS, or Linux', 'Download the installer for your operating system and CPU architecture.', 'Download a release'],
        ['SELF-HOSTED', 'Your own machine or server', 'Run it with Docker and use it in a browser, with persistent storage, passwords, and remote access.', 'Self-host with Docker'],
        ['MOBILE', 'iOS or Android', 'The mobile client connects to an existing Host.', 'Mobile setup'],
        ['EXTEND', 'Build extensions', 'Start from the authoring guide, the SDK, or working examples to add capabilities.', 'Extension authoring guide']
      ] }
    ]
  }
} as const;

// Research domains named in the home page strip. They no longer have separate
// pages; the research directory and papers carry the work itself.
export const researchDomains = ['Databases', 'Retrieval', 'Vectors', 'Quantization', 'Post-training', 'Mathematics'] as const;

