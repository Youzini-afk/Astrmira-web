interface AboutCopy {
  title: string;
  description: string;
  headline: [string, string];
  introduction: string;
  record: [string, string][];
  motto: string;
  nameTitle: string;
  nameIntro: string;
  names: { term: string; heading: string; paragraphs: string[] }[];
  nameClose: string;
  attitudeTitle: string;
  attitudeIntro: string;
  principles: { label: string; heading: string; text: string }[];
  practiceTitle: string;
  practice: string[];
  projects: { name: string; path: string; description: string }[];
  collaborationTitle: string;
  collaboration: string[];
  closing: string;
}

export const aboutCopy: Record<'zh-cn' | 'en', AboutCopy> = {
  'zh-cn': {
    title: '关于我们 · 变星、幻梦与求索 — Astrmira 幻梦星芒',
    description: '了解 Astrmira 幻梦星芒的名字与研究理念：对未知保持好奇，从第一性原理出发，以推导、实验和系统实践积累新的理解。',
    headline: ['以好奇仰望星空，', '以研究走近本质。'],
    introduction: 'Astrmira，中文名「幻梦星芒」，是一家以前沿研究与系统研发为核心的企业。我们关注数据、计算与智能中的基础问题，也亲手构建承载这些想法的系统。对未知的想象，推动我们提出问题；对第一性原理的追问，帮助我们一步步接近答案。',
    record: [
      ['天体', 'Omicron Ceti / Mira'],
      ['类型', '长期脉动变星'],
      ['明暗周期', '约 11 个月'],
      ['紫外星尾', '近 13 光年'],
      ['观测', 'GALEX · 紫外巡天'],
    ],
    motto: '星芒会变，求索不息。',
    nameTitle: '名字的故事：Astr · Mira · Mirage',
    nameIntro: '我们把星空、变星与幻梦的意象，放进了同一个名字。它们承载着我们对研究的期待：有向远方发问的好奇，也有走近一个问题、反复观察与验证的耐心。',
    names: [
      {
        term: 'Astr', heading: '星空，让问题保持开放。',
        paragraphs: ['星空让人看见已知之外的辽阔。一个已经能够运行的系统，仍可能藏着尚未理解的规律；一个看似熟悉的问题，换一种观察尺度，也可能显露出新的结构。Astr 是名字里朝向远方的一面，提醒我们为基础问题和长期探索留下空间。'],
      },
      {
        term: 'Mira', heading: '变星，让理解持续生长。',
        paragraphs: [
          'Mira，也称鲸鱼座 ο（Omicron Ceti），是一颗亮度大约每 11 个月经历一次涨落的变星。2007 年公布的 GALEX 紫外影像，还显露出它近 13 光年的绵长星尾。被称作 “The Wonderful Star” 的它，给了我们关于变化与积累的双重想象。',
          '起伏的星光，让我们想到认识需要不断修正；延伸的星尾，让我们想到一次次探索可以留下的积累。新的证据可能改变原有判断，认真留下的推导、实验与代码，却能成为下一次出发的起点。',
        ],
      },
      {
        term: 'Mirage', heading: '幻梦，让想象先走一步。',
        paragraphs: ['在一个想法能够被证明之前，常常先有一个尚不完整的直觉。我们愿意给这样的想象一点空间：设想新的表示，尝试不同的结构，追问习以为常的前提。再把直觉写成清楚的假设，让推导、实验和实际使用帮助它逐渐成形。'],
      },
    ],
    nameClose: '三层意象交织，成为「幻梦星芒」。浪漫的好奇与严谨的求索，共同构成了我们希望保有的研究气质。',
    attitudeTitle: '我们的研究态度',
    attitudeIntro: '面对一个值得投入的问题，我们更关心它由哪些基本关系构成，现有解释能走到哪里，以及怎样获得更可靠的理解。',
    principles: [
      {
        label: 'FIRST PRINCIPLES', heading: '从第一性原理出发。',
        text: '先说清问题、假设与约束，再选择方法。一条检索路径为什么有效，一个压缩后的表示保留了什么，Agent 如何可靠地推进长任务——这些具体的问题，最终都需要回到数据、计算与决策的基本关系。理解机制，才能判断一种方法何时值得使用。',
      },
      {
        label: 'EVIDENCE & REVISION', heading: '让证据推动判断。',
        text: '推导让假设与结论之间的关系更清楚，实验帮助我们检验预期。我们重视对照、复现与失效情形，也把未达到预期的结果当作继续理解问题的线索。当观察与假设不一致时，回到假设本身，把解释修正得更准确。',
      },
      {
        label: 'THEORY & PRACTICE', heading: '在理论与工程之间往返。',
        text: '把方法放进真实系统，才能遇见完整的约束：资源、延迟、状态、维护，以及持续使用中的变化。工程中的这些细节，会反过来提出新的理论问题。我们愿意沿着这条往返的路径，把一个想法理解得更深，也把一个系统做得更扎实。',
      },
      {
        label: 'LONG-TERM CURIOSITY', heading: '为长期问题保留耐心。',
        text: '有些进展来自一个新想法，也有些来自对旧问题更细致的观察。我们看重可以积累的工作：一段清楚的推导、一组可核对的实验、一份能被继续使用的实现。每一步都为后续探索多留一点依据。',
      },
    ],
    practiceTitle: '让研究与系统，相互推动。',
    practice: [
      '我们的研究方向随着问题展开。目前，我们从数据库与检索、向量表示、模型量化等方向持续探索，也关注后训练与数学中的基础问题。论文记录阶段性的发现，系统让这些想法接受更长时间的使用与检验。',
      '这条路径也体现在我们正在建设的开源项目中：从组织数据，到连接记忆与行动，再到支撑复杂任务的持续执行。',
    ],
    projects: [
      { name: 'TriviumDB', path: '/projects/data-systems/', description: '从数据的组织方式出发，让向量、图谱与文档共享一个内核，为检索、记忆与知识应用提供基础。' },
      { name: 'infOS', path: '/projects/agent-platform/', description: '连接长期记忆、上下文与工具能力，探索 AI 伙伴如何在持续的对话和行动中保持连贯。' },
      { name: 'Piarium', path: '/projects/piarium/', description: '构建面向复杂工程任务的 Agent Harness，将代码检索、上下文、协作与验证组织成可持续推进的工作过程。' },
    ],
    collaborationTitle: '让不同的经验，在问题上相遇。',
    collaboration: [
      '基础研究、工程实践与真实场景，各自提供不同的观察角度。我们愿意与研究者、高校团队、开发者和产业伙伴一起，把问题定义得更清楚，把方法放到更充分的条件下检验。',
      '合作可以从一篇论文的讨论、一次方法复现、一项系统实验，或一个长期没有解决的具体难题开始。围绕明确的问题与贡献边界，逐步积累共同的理解，也让能够公开的成果被更多人阅读、检验和继续建设。',
    ],
    closing: '愿每一次认真的探索，都留下一点可以被继续的东西。一篇论文、一段代码、一个新的问题，都是这条星尾的一部分。',
  },
  en: {
    title: 'About Astrmira · Wonder, research and first principles',
    description: 'The story and research philosophy behind Astrmira: curiosity about the unknown, reasoning from first principles, and understanding built through evidence and working systems.',
    headline: ['Grounded in research.', 'Open to wonder.'],
    introduction: 'Astrmira—幻梦星芒 in Chinese—is a company centered on frontier research and systems engineering. We study foundational questions in data, computation, and intelligence, and build systems that put those ideas to work. Imagination helps us ask new questions; reasoning from first principles helps us work toward answers.',
    record: [
      ['OBJECT', 'Omicron Ceti / Mira'],
      ['TYPE', 'Long-period pulsating variable'],
      ['BRIGHTNESS CYCLE', 'About 11 months'],
      ['ULTRAVIOLET TAIL', 'Nearly 13 light-years'],
      ['OBSERVATORY', 'GALEX · Ultraviolet survey'],
    ],
    motto: 'Stars change. Curiosity continues.',
    nameTitle: 'The story of our name: Astr · Mira · Mirage',
    nameIntro: 'Our name brings together the sky, a variable star, and an imagined horizon. They express what we value in research: the curiosity to ask distant questions and the patience to look closely, observe again, and test an idea.',
    names: [
      {
        term: 'Astr', heading: 'The sky keeps the questions open.',
        paragraphs: ['The sky gives a sense of how much lies beyond what we understand. A working system can still contain unexplained patterns; a familiar problem can reveal a different structure when seen at another scale. Astr is the part of our name that looks outward, leaving room for foundational questions and sustained exploration.'],
      },
      {
        term: 'Mira', heading: 'A changing star, a growing understanding.',
        paragraphs: [
          'Mira, also known as Omicron Ceti, is a variable star whose brightness rises and falls over roughly 11 months. Ultraviolet images from GALEX, released in 2007, revealed a tail nearly 13 light-years long. Known as “The Wonderful Star,” Mira gives us an image of both change and accumulation.',
          'Its changing light reminds us to revise our understanding; its extended wake suggests what repeated exploration can leave behind. New evidence may change a conclusion, while carefully recorded reasoning, experiments, and code give the next inquiry somewhere to begin.',
        ],
      },
      {
        term: 'Mirage', heading: 'Let imagination take the first step.',
        paragraphs: ['Before an idea can be demonstrated, there is often an incomplete intuition. We make room for imagining a new representation, trying a different structure, or questioning a familiar premise. Then we turn that intuition into an explicit hypothesis and let reasoning, experiments, and practical use help it take shape.'],
      },
    ],
    nameClose: 'Together, these images become 幻梦星芒. Wonder and rigorous inquiry are both part of the research culture we want to build.',
    attitudeTitle: 'How we approach research',
    attitudeIntro: 'For a question worth pursuing, we ask what basic relationships it involves, how far the existing explanation reaches, and what would lead to a more reliable understanding.',
    principles: [
      { label: 'FIRST PRINCIPLES', heading: 'Begin with the fundamentals.', text: 'Make the question, assumptions, and constraints explicit before choosing a method. Why does a retrieval path work? What survives a compressed representation? How can an agent reliably advance a long task? Each question leads back to relationships between data, computation, and decisions. Understanding the mechanism helps us judge when a method is useful.' },
      { label: 'EVIDENCE & REVISION', heading: 'Let evidence change the judgment.', text: 'Derivations make reasoning explicit; experiments test its predictions. We value comparisons, replication, and cases where a method fails. An unexpected result is a clue to the problem. When observations disagree with a hypothesis, we return to that hypothesis and work toward a more accurate explanation.' },
      { label: 'THEORY & PRACTICE', heading: 'Move between theory and engineering.', text: 'A real system exposes a fuller set of constraints: resources, latency, state, maintenance, and changes during sustained use. Those engineering details can raise new theoretical questions. Working in both directions helps us understand an idea more deeply and build a more dependable system.' },
      { label: 'LONG-TERM CURIOSITY', heading: 'Give lasting questions time.', text: 'Progress can come from a new idea or a closer look at an old problem. We value work that others can build on: a clear derivation, experiments that can be examined, and an implementation that remains useful. Each step gives future exploration firmer ground.' },
    ],
    practiceTitle: 'Let research and systems inform each other.',
    practice: [
      'Our research directions develop with the questions. Current interests include databases and retrieval, vector representations, and model quantization, alongside foundational questions in post-training and mathematics. Papers record findings along the way; systems give ideas a longer encounter with practical use.',
      'This approach also shapes the open-source projects we are building: from organizing data, to connecting memory with action, to supporting sustained work on complex tasks.',
    ],
    projects: [
      { name: 'TriviumDB', path: '/projects/data-systems/', description: 'A shared core for vectors, graphs, and documents, providing a foundation for retrieval, memory, and knowledge applications.' },
      { name: 'infOS', path: '/projects/agent-platform/', description: 'Long-term memory, context, and tools brought together to explore how an AI companion can remain coherent across ongoing conversations and actions.' },
      { name: 'Piarium', path: '/projects/piarium/', description: 'An Agent Harness for complex engineering tasks, organizing code retrieval, context, collaboration, and verification into work that can keep moving forward.' },
    ],
    collaborationTitle: 'Bring different experience to a shared question.',
    collaboration: [
      'Foundational research, engineering, and real-world use each offer a different view. We welcome conversations with researchers, university teams, developers, and industry partners to define questions more precisely and test methods under a wider range of conditions.',
      'A collaboration can begin with a paper discussion, a replication, a systems experiment, or a concrete problem that has resisted a solution. With a clear question and shared expectations about contributions, we can build understanding together and make suitable results available for others to read, examine, and extend.',
    ],
    closing: 'We hope each careful exploration leaves something that can be carried forward. A paper, a piece of code, or a new question can all become part of that continuing trail.',
  },
};
