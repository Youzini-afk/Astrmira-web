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
    repository: 'https://github.com/YoKONCy/infOS', license: 'Open source',
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
  piarium: {
    name: 'Piarium', eyebrow: 'PIARIUM / AGENT HARNESS', kind: 'piarium',
    title: 'Turn model capability into complete execution.',
    description: 'A complete agent harness for complex software engineering. Piarium connects code understanding, context and memory, tool execution, multi-agent coordination, verification, and workspace recovery from first investigation to reviewable delivery.',
    repository: 'https://github.com/Youzini-afk/Piarium', license: 'AGPL-3.0',
    tags: ['Code Intelligence', 'Multi-Agent', 'Desktop', 'Web'],
    figure: 'Understand context, organize execution, and feed verification back into the next action.',
    sections: [
      { title: 'A system that helps models finish the work.', paragraphs: ['A harness determines how a model finds evidence, uses tools, maintains context, and verifies results. Piarium connects that execution system to live code, editor drafts, terminals, task branches, and review evidence.'] },
      { title: 'Engineering capability across the task lifecycle.', features: [
        ['CONTEXT', 'Keep long tasks continuous', 'Layer stable instructions, session history, and dynamic state; retain sources and coverage through context compression.'],
        ['CODE INTELLIGENCE', 'Find the implementation behind a question', 'Combine exact search, symbols, semantic retrieval, and model-selected excerpts with source locations.'],
        ['TOOLS', 'Support complete execution', 'Unify terminals, file editing, language diagnostics, and network tools, including background commands and shared terminal access.'],
        ['COORDINATION', 'Organize parallel work', 'Choose roles and models by task, track durable work threads, and coordinate isolated changes through reviewable integration.'],
        ['VERIFICATION', 'Make delivery traceable', 'Associate commands, tests, builds, diagnostics, and automated review with the task and artifact revision they support.'],
        ['RECOVERY', 'Keep changes reviewable and recoverable', 'Checkpoints, rollback, and undo coordinate tracked files, editor drafts, agent results, and persistent work state.']
      ] },
      { title: 'Work state that outlives one conversation.', paragraphs: ['Plans, task threads, command output, durable knowledge, and workspace revisions keep separate records. The next turn can recover relevant material and preserve the link between a result and its evidence.', 'TriviumDB supplies embedded knowledge and retrieval beneath the harness, connecting project knowledge, code evidence, and accumulated working memory.'] }
    ]
  }
} as const;

export const researchFields = {
  databases: ['Databases', 'Data organization, query execution, and system design—connecting low-level methods with real workloads.', 'How can a data system work better under a concrete workload and resource budget?'],
  retrieval: ['Retrieval', 'How information is discovered, filtered, and ranked so relevant material becomes available at the right moment.', 'How should relevance be defined, and how can retrieval quality be tied to system cost through testable evidence?'],
  vectors: ['Vectors', 'Vector representations, similarity, and search structures as computable relationships inside data spaces.', 'How do representation, metric, and search structure jointly shape a specific task?'],
  quantization: ['Quantization', 'Discrete representations under resource constraints, and the relationship between compactness and retained information.', 'When a representation becomes compact, what must survive and how should its error be measured?'],
  'post-training': ['Post-training', 'Methods and evaluation after pretraining, studying how model capabilities, behavior, and objectives interact.', 'How can explicit data, objectives, and evaluation steer model behavior toward a desired task?'],
  mathematics: ['Mathematics', 'Definitions, structure, and derivation as tools for expressing research questions more clearly.', 'Which structures, assumptions, and boundaries can give an empirical observation a stronger explanation?']
} as const;

