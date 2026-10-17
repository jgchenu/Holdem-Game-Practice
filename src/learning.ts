import { readStorage, writeStorage } from "./storage";
export const lessons = [
  {
    id: "ranks",
    stage: 0,
    title: "识牌 · 七选五",
    subtitle: "看懂牌型与公共牌",
    questions: [
      {
        prompt:
          "你的手牌是 A♠ K♦，公共牌是 A♥ 7♣ 2♦。目前组成了什么牌型？",
        choices: ["高牌", "一对", "两对"],
        answer: 1,
        why: "手中的 A♠ 与公共牌 A♥ 组成一对。其余三张取可用的最高牌。",
      },
      {
        prompt:
          "公共牌已经是 A♣ K♣ Q♣ J♣ 10♣。两位玩家分别拿着 2♠ 3♥ 和 9♦ 8♥，谁赢？",
        choices: ["第一位", "第二位", "平分底池"],
        answer: 2,
        why: "两人都可直接使用五张公共牌，组成同样的皇家同花顺；不要求必须用自己的底牌。",
      },
    ],
  },
  {
    id: "actions",
    stage: 0,
    title: "知进退 · 正确行动",
    subtitle: "过牌、跟注与弃牌",
    questions: [
      {
        prompt: "轮到你时，本轮没有人下注。你想免费继续看牌，应该怎么做？",
        choices: ["过牌", "跟注", "必须加注"],
        answer: 0,
        why: "无需补入筹码时可以过牌。跟注用于补齐已有下注。",
      },
      {
        prompt:
          "对手本轮下注到 60，你已经投入 20。若继续跟注，还需要多少灵石？",
        choices: ["20", "40", "60"],
        answer: 1,
        why: "跟注只需补足差额：60 − 20 = 40。跟注不是再投入完整的 60。",
      },
    ],
  },
  {
    id: "position",
    stage: 0,
    title: "观位 · 后发先知",
    subtitle: "庄位与行动顺序",
    questions: [
      {
        prompt: "标准六人桌翻前，谁先行动？",
        choices: ["庄家", "小盲位", "大盲位左侧第一位"],
        answer: 2,
        why: "翻前由大盲左侧第一位开始；大盲在未被加注时仍有过牌或加注的选择权。",
      },
      {
        prompt: "为什么在其他条件相同时，后行动通常有信息优势？",
        choices: ["可以知道对手底牌", "能先看到更多人的行动", "牌力会自动变强"],
        answer: 1,
        why: "后行动者可以先观察其他玩家如何行动；位置不会改变牌，也不会揭示隐藏底牌。",
      },
    ],
  },
  {
    id: "pot-odds",
    stage: 1,
    title: "衡利 · 底池赔率",
    subtitle: "先算成本，再谈判断",
    questions: [
      {
        prompt:
          "河牌时，底池原有 100，对手下注 50。你需要跟注 50，且没有其他玩家行动。只看这一笔跟注的直接赔率，盈亏平衡胜率是多少？",
        choices: ["25%", "约 33%", "50%"],
        answer: 0,
        why: "跟注后总池是 100 + 50 + 50 = 200；成本为 50，门槛是 50 ÷ 200 = 25%。这不是你的实际胜率。",
      },
      {
        prompt: "算出 25% 的跟注门槛后，是否就应该跟注？",
        choices: [
          "一定应该",
          "还需估计对手范围与自己的胜率",
          "只看自己的牌型名字",
        ],
        answer: 1,
        why: "赔率只是价格。河牌跟注还要比较自己对对手范围的胜率；多人、后续加注和抽水也会改变计算条件。",
      },
    ],
  },
  {
    id: "draws",
    stage: 1,
    title: "观变 · 听牌与范围",
    subtitle: "区分机会和确定性",
    questions: [
      {
        prompt:
          "翻牌时，你的两张底牌与三张公共牌中恰有四张黑桃。只考虑下一张牌形成同花，且不掌握其他底牌，有多少张黑桃补牌？",
        choices: ["8 张", "9 张", "13 张"],
        answer: 1,
        why: "一门花色共 13 张，已知 4 张，剩 9 张；未知牌 47 张，下一张为黑桃的概率是 9/47，约 19.1%。成同花不保证赢。",
      },
      {
        prompt: "对手一次加注，能否确定他持有 A A？",
        choices: [
          "能，加注就是 A A",
          "不能，应考虑多种可能手牌",
          "能，后行动可看穿底牌",
        ],
        answer: 1,
        why: "行动提供线索，不能揭示隐藏底牌。用一个可能范围思考，并随公共牌和行动更新判断。",
      },
    ],
  },
  {
    id: "sizing",
    stage: 1,
    title: "落子 · 下注尺度",
    subtitle: "投入、风险与合法加注",
    questions: [
      {
        prompt:
          "本轮先有人下注到 40，随后对手加注到 100（增加 60）。你有足够筹码，再加注的最小本轮总额是多少？",
        choices: ["120", "160", "200"],
        answer: 1,
        why: "最小再加注幅度等于最近一次足额加注的增量 60，因此至少到 100 + 60 = 160。不是把总额简单翻倍。",
      },
      {
        prompt:
          "加注面板显示本轮总投入 160，而你本轮已经投入 40。这次会追加多少灵石？",
        choices: ["40", "120", "160"],
        answer: 1,
        why: "本轮总投入包括此前的 40，因此这次再追加 160 − 40 = 120。确认前同时检查总额、追加额和剩余筹码。",
      },
    ],
  },
  {
    id: "side-pots",
    stage: 2,
    title: "分池 · 全下与边池",
    subtitle: "每一份投入都有归属",
    questions: [
      {
        prompt:
          "三人最终分别投入 100、300、300，且都未弃牌。投入 100 的玩家最多竞争多少灵石的底池？",
        choices: ["100", "300", "700"],
        answer: 1,
        why: "主池为三人各 100，共 300；另两人多出的各 200 组成 400 的边池。短码玩家不能赢取未覆盖的边池。",
      },
      {
        prompt:
          "河牌甲下注 500，乙只有 200 并全下跟注，没有其他玩家。甲多出的 300 如何处理？",
        choices: ["全部算作赢利", "返还给甲", "自动消失"],
        answer: 1,
        why: "没有对手匹配的 300 返还给甲。双方匹配的投入才用于竞争；返还不是赢得对手的灵石。",
      },
    ],
  },
  {
    id: "value-bluff",
    stage: 2,
    title: "辨意 · 价值与诈唬",
    subtitle: "理解下注的目的",
    questions: [
      {
        prompt: "你在河牌下注，希望更弱的牌跟注。这主要属于什么目的？",
        choices: ["价值下注", "诈唬", "免费摊牌"],
        answer: 0,
        why: "价值下注希望从更弱手牌的跟注中获益。能否达到目的，要结合对手范围和尺度判断。",
      },
      {
        prompt: "一次河牌诈唬希望对手的哪些手牌弃牌？",
        choices: [
          "只让比你更弱的牌弃牌",
          "让本来能赢你的牌弃牌",
          "让全部底牌公开",
        ],
        answer: 1,
        why: "诈唬的收益来自更强手牌的弃牌；对手愿意弃掉多少牌，以及你承担的下注风险，都会影响是否值得。",
      },
    ],
  },
  {
    id: "review",
    stage: 2,
    title: "明心 · 决策与波动",
    subtitle: "用过程复盘一手牌",
    questions: [
      {
        prompt:
          "你用明显领先的牌全下，却被河牌反超。单凭这次输牌，能否认定全下错误？",
        choices: [
          "能，输了就是错",
          "不能，要回看行动时的信息与风险",
          "不能，因为全下永远正确",
        ],
        answer: 1,
        why: "结果受随机发牌影响。复盘要使用当时可知的信息，分析范围、成本、有效筹码和可选行动，避免用后来出现的牌倒推答案。",
      },
      {
        prompt: "连输几手后，你开始急于追回灵石。更合适的练习方式是什么？",
        choices: ["立刻提高下注", "暂停并回顾关键决策", "相信下一手必定获胜"],
        answer: 1,
        why: "先暂停能帮助恢复判断。独立洗牌不会因为此前连输而保证下一手获胜；本练习使用虚拟灵石，不涉及兑换。",
      },
    ],
  },
] as const;

export function loadLearning(): string[] {
  try {
    const ids = JSON.parse(readStorage("wendao:learning:v1") || "[]");
    return Array.isArray(ids)
      ? [
          ...new Set(
            ids.filter((id: unknown) => lessons.some((l) => l.id === id)),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}
export function saveLearning(ids: string[]): boolean {
  try {
    return writeStorage("wendao:learning:v1", JSON.stringify(ids));
  } catch {
    return false;
  }
}

export const learningStages = [
  { title: "炼气 · 识牌", detail: "认清牌面与行动" },
  { title: "筑基 · 观势", detail: "衡量价格与风险" },
  { title: "金丹 · 明心", detail: "理解目的，复盘过程" },
] as const;

export function isLessonUnlocked(
  index: number,
  completed: readonly string[],
): boolean {
  const lesson = lessons[index];
  return (
    !!lesson &&
    lessons.every((l) => l.stage >= lesson.stage || completed.includes(l.id))
  );
}
export function learningRealm(completed: readonly string[]): string {
  if (lessons.every((l) => completed.includes(l.id))) return "金丹 · 圆满";
  if (lessons.filter((l) => l.stage < 2).every((l) => completed.includes(l.id)))
    return "金丹 · 明心";
  if (
    lessons.filter((l) => l.stage === 0).every((l) => completed.includes(l.id))
  )
    return "筑基 · 入门";
  return "炼气 · 识牌";
}
