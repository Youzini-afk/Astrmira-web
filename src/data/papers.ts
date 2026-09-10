export interface Paper {
  slug: string;
  arxiv: string;
  version: string;
  title: string;
  heading: string;
  summary: string;
  authors: string[];
  submitted: string;
  updated: string;
  category: string;
  themes: string[];
  tags: string[];
  artwork: 'decisions' | 'moves' | 'covariance' | 'quiver';
  caption: string;
  sections: { title: string; paragraphs: string[] }[];
  related: string[];
}

// Editorial order: recent work first, then its representation and system foundations.
// Descriptions are grounded in the linked arXiv abstracts and versioned full texts.
export const papers: Paper[] = [
  {
    slug: 'low-bit-decisions',
    arxiv: '2609.09854',
    version: 'v1',
    title: 'When Does Low-Bit Quantization Preserve the Decisions of Vector Search?',
    heading: '压缩之后，搜索还会做出相同的选择吗？',
    summary: '把量化误差放回排序与图剪枝的具体决策中，用比较间隔、误差相关性与执行轨迹，刻画低比特搜索的可靠性。',
    authors: ['Wenxuan Xiao', 'Xu Cao'],
    submitted: '2026-09-09',
    updated: '2026-09-09',
    category: 'VECTOR SEARCH',
    themes: ['vectors', 'theory'],
    tags: ['向量检索', '决策稳定性', '量化理论'],
    artwork: 'decisions',
    caption: '一次比较是否改变，取决于量化误差是否跨过它的决策边界。',
    sections: [
      {
        title: '从距离误差，到一次具体的选择',
        paragraphs: [
          '向量搜索不断做出选择：哪个候选更近，哪条边需要保留。平均误差和全局排序相关性难以解释这些局部选择为何失效。这项研究把分析单位落到算法实际执行的比较上。',
          '关键是两个候选原本相隔多远，以及量化误差是否足以越过这个间隔。论文将比较翻转的风险分解为边界附近的概率质量与校准残差的尾部概率，并纳入共享查询或图节点带来的误差相关性。',
        ],
      },
      {
        title: '把局部决策连接到图的执行轨迹',
        paragraphs: [
          '对固定候选顺序下的 Vamana 邻居选择，论文证明：在冻结的精确状态上，每个候选的剪枝动作一致，当且仅当近似重放得到相同的邻居列表。这样便能把一次局部比较与具体的图结构变化联系起来。',
          '当分布假设难以成立时，独立留出数据块提供另一条路径：为已经固定的量化规则估计选择性失效风险。二值编码、RaBitQ、Lucene BBQ 与乘积量化可以通过同一种决策接口接受分析。',
        ],
      },
      {
        title: '让量化的选择，更贴近搜索本身',
        paragraphs: [
          '在学习型、经典与合成表示上的实验中，标准化比较间隔比全局排序相关性更能预测排序和剪枝的翻转。研究覆盖固定候选集合与冻结执行轨迹；完整搜索的召回率还取决于候选覆盖。',
        ],
      },
    ],
    related: ['covariance-binary-quantization', 'quiver'],
  },
  {
    slug: 'contextual-quantization',
    arxiv: '2609.09867',
    version: 'v1',
    title: 'Contextual Utility of Quantization Moves in Extreme Low-Bit LLMs',
    heading: '同一次量化改动，为何会改变好坏？',
    summary: '研究极低比特大模型中一次离散改动的真实收益：沿改动自身的路径评估，并在持续变化的模型状态上组合决策。',
    authors: ['Wenxuan Xiao', 'Xu Cao'],
    submitted: '2026-09-09',
    updated: '2026-09-09',
    category: 'LOW-BIT LLMS',
    themes: ['llms'],
    tags: ['大模型量化', '后训练', '离散优化'],
    artwork: 'moves',
    caption: '改动的收益来自它走过的路径，也取决于此前的改动把模型带到了哪里。',
    sections: [
      {
        title: '重构更接近，模型未必更好',
        paragraphs: [
          '后训练量化会调整有限的编码，让权重或激活的重构误差降低。但模型最终面对的是预测损失与任务表现。论文研究的是：在位数不变的前提下，如何判断一次合法的离散编码改动是否真正有益。',
          '收益首先取决于改动本身的位移。只在起点计算梯度会遗漏沿途的曲率；在这次改动自己的中点计算梯度，能更准确地判断终点损失的变化方向。Llama-3.2 的低比特实验检验了这一差异。',
        ],
      },
      {
        title: '改动之间，也会相互影响',
        paragraphs: [
          '对合法量化状态的穷举显示，多个改动的组合收益可由近似二次结构描述。即使两两交互项很小，也可能改变多目标下的最优取舍；同一次改动在不同状态中，甚至会从有益变为有害。',
          '逐个读取改动的中点，可以修复局部选择。组合范围扩大后，则需要从实际到达的状态重新评估，并检查真实终点。论文中的终点评估束搜索找到了优于更大规模一次性更新的稀疏改动。',
        ],
      },
      {
        title: '从静态打分，走向随状态更新的优化',
        paragraphs: [
          '这项工作把量化优化推进到“几次改动”的粒度：明确优化目标，沿各自路径判断收益，再随着状态变化重新组合。实验同时考察任务准确率和留出数据上的困惑度，连接局部选择与模型实际表现。',
        ],
      },
    ],
    related: ['low-bit-decisions', 'covariance-binary-quantization'],
  },
  {
    slug: 'covariance-binary-quantization',
    arxiv: '2605.17524',
    version: 'v2',
    title: 'Covariance Structure and Coordinate Heterogeneity Govern Binary Quantization of Contrastive Embeddings',
    heading: '少到一两个比特，什么信息仍被保留？',
    summary: '从协方差结构与坐标差异出发，解释二值量化的排序能力，以及额外一位和随机旋转为什么在不同表示上作用不同。',
    authors: ['Wenxuan Xiao'],
    submitted: '2026-05-17',
    updated: '2026-05-29',
    category: 'REPRESENTATION GEOMETRY',
    themes: ['vectors', 'theory'],
    tags: ['表示几何', '二值量化', '协方差'],
    artwork: 'covariance',
    caption: '坐标各自的变化幅度，以及坐标之间的关系，共同影响压缩后的排序信息。',
    sections: [
      {
        title: '相反的设计，为什么都能奏效？',
        paragraphs: [
          '有的二值量化系统先随机旋转向量，有的保留原始坐标轴；同样是一两个比特，不同表示上的检索表现也相差很大。论文从对比学习表示的统计结构出发，分析这些现象背后的共同机制。',
        ],
      },
      {
        title: '区分坐标之间的关系与坐标自身的差异',
        paragraphs: [
          '在高斯模型下，完整协方差结构影响排序保真度，仅看各坐标的方差会遗漏坐标间相关性积累的信号。坐标方差的不均匀性则影响设计选择：幅度比特能补充多少信息，随机旋转会帮助还是削弱现有编码。',
          '旋转让方差更均匀，可以适配依赖各向同性的距离校正，也可能消除另一类编码利用的坐标差异。论文据此推导近似排序保真度表达式，并提出跨模型、跨维度的经验缩放关系。',
        ],
      },
      {
        title: '把表示结构变成系统设计的依据',
        paragraphs: [
          '覆盖 9 个嵌入家族、18 个数据集的实验检验了协方差、幅度比特与旋转的作用。研究为编码方式与预处理的选择提供统计依据，其解析预测依赖文中明确的高斯模型和近似条件。',
        ],
      },
    ],
    related: ['low-bit-decisions', 'quiver'],
  },
  {
    slug: 'quiver',
    arxiv: '2605.02171',
    version: 'v3',
    title: 'QuIVer: Rethinking ANN Graph Topology via Training-Free Binary Quantization',
    heading: 'QuIVer：让二值编码直接构建搜索图。',
    summary: '在免训练的两比特空间中完成建图、剪枝与搜索，只在最终重排时读取完整向量，探索紧凑索引的能力与适用边界。',
    // The full-text author line includes Peidong Zhu; the abstract metadata omits him.
    authors: ['Wenxuan Xiao', 'Peidong Zhu', 'Zhiyou Wang', 'Chengcheng Li'],
    submitted: '2026-05-04',
    updated: '2026-05-17',
    category: 'SEARCH SYSTEMS',
    themes: ['vectors'],
    tags: ['近似近邻搜索', '图索引', '二值量化'],
    artwork: 'quiver',
    caption: '用紧凑的二值图完成导航，再用原始向量精排少量候选。',
    sections: [
      {
        title: '让量化参与图的形成',
        paragraphs: [
          'QuIVer 研究一个直接的问题：二值量化能否成为图索引本身的度量空间？它用符号位和幅度位组成免训练的两比特编码，让 Vamana 的选边、多样性剪枝和搜索导航都在量化空间中完成。',
        ],
      },
      {
        title: '紧凑导航，精确重排',
        paragraphs: [
          '查询先编码成二值签名，通过位运算访问图中的候选；最后才读取原始 float32 向量进行重排。这将频繁访问的签名与邻接表，同只在末端使用的完整向量分开，减少搜索热路径的内存负担。',
          '系统不需要训练码本或旋转矩阵。量化同时参与构建与导航，使索引拓扑、计算路径和内存组织可以围绕紧凑表示一起设计。',
        ],
      },
      {
        title: '系统能力，与数据几何一起考察',
        paragraphs: [
          '在 12 个百万规模数据集上的评估显示，效果强烈依赖表示分布：余弦空间中的对比学习嵌入更适合这种拓扑，部分多模态表示次之，而欧氏原生特征和无结构分布表现较差。',
          '这项工作给出压缩、吞吐与数据兼容性之间的实证取舍，为向量数据库选择量化原生图索引提供适用依据，也构成后续量化理论研究的系统起点。',
        ],
      },
    ],
    related: ['covariance-binary-quantization', 'low-bit-decisions'],
  },
];

export const paperUrl = (paper: Paper) => `/research/papers/${paper.slug}/`;
export const arxivUrl = (paper: Paper) => `https://arxiv.org/abs/${paper.arxiv}`;
