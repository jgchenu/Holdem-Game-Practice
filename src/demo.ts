/** A fixed presentation sequence, not a poker rules engine or a betting simulator. */
export const stages = [
  {
    id: "ready",
    label: "静心 · 入席",
    action: "入席试炼",
    title: "一念静，万象明",
    tip: "先静下心。轻触「入席试炼」，感受你的第一手牌。",
    pot: 0,
  },
  {
    id: "preflop",
    label: "起手 · 藏锋",
    action: "观翻牌",
    title: "藏锋于手，观势于心",
    tip: "红桃 A 与 K，是同花大牌。轻触手牌可抬起细看。",
    pot: 30,
  },
  {
    id: "flop",
    label: "翻牌 · 观势",
    action: "观转牌",
    title: "三张公共牌，局势初现",
    tip: "Q♥、7♣、2♦ 是大家共享的牌。此时你还没有对子。",
    pot: 150,
  },
  {
    id: "turn",
    label: "转牌 · 蓄势",
    action: "观河牌",
    title: "尚未成牌，也有可能",
    tip: "J♥ 出现。若河牌是 10♥，你的五张牌将组成皇家同花顺。",
    pot: 270,
  },
  {
    id: "river",
    label: "河牌 · 明心",
    action: "演示结算",
    title: "同花顺成，心境自明",
    tip: "A♥ K♥ Q♥ J♥ 10♥：同一花色，连续五张。这是固定演示的结果。",
    pot: 270,
  },
  {
    id: "complete",
    label: "终局 · 悟道",
    action: "再修一局",
    title: "以牌入道，以心观局",
    tip: "这次体验展示了发牌、翻牌与结算。真实对局不会保证出现好牌。",
    pot: 0,
  },
] as const;

export type Phase = (typeof stages)[number]["id"];
export {
  readPreferences,
  savePreferences,
  defaultPreferences,
  type Preferences,
} from "./preferences";
