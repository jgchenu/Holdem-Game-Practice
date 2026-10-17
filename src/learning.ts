import { readStorage,writeStorage } from './storage';
export const lessons = [
  {
    id: "ranks",
    title: "识牌 · 七选五",
    subtitle: "看懂牌型与公共牌",
    questions: [
      {
        prompt: "你的手牌是 A♠ K♦，公共牌是 A♥ 7♣ 2♦。目前组成了什么牌型？",
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
