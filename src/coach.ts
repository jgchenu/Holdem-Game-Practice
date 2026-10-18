import { cardText, evaluate, rankOf } from "./core/cards";
import { type Observation } from "./core/poker";

/** Deterministic explanations of visible facts, deliberately not strategy scores or equity estimates. */
export function guidance(view: Observation | null, paused: boolean): string {
  if (!view)
    return "先入席，认识自己的两张底牌。也可以点「修炼」学习牌型与行动规则。";
  if (paused) return "牌局已暂停。你的灵石与手牌已经保留，准备好后再继续。";
  if (view.result) {
    const hero = view.players[0];
    const net = hero.stack - hero.startingStack;
    return view.result.showdown
      ? `本手${net >= 0 ? "净得" : "净支出"} ${Math.abs(net)} 灵石。可以查看复盘，回顾当时的信息与行动。`
      : "其余玩家弃牌后即可获胜，无需凑齐五张公共牌。结果不等于决策质量。";
  }
  if (view.players[0].folded)
    return "弃牌后这手不再投入灵石。观察对手如何行动，也是一种修炼。";
  if (view.players[0].allIn)
    return "你已全下。后续不再行动，只参与自己投入金额所对应的底池。";
  if (view.actor !== 0)
    return `${view.players[view.actor!].name} 正在思考。底牌只对自己可见，先观察公开行动。`;
  const legal = view.legal!;
  if (view.board.length >= 3) {
    const rank = evaluate([...view.players[0].hole!, ...view.board]);
    return `当前最佳五张是${rank.name}。${legal.canCheck ? "可以过牌，免费继续观察。" : `继续跟注需 ${legal.call} 灵石；也可以弃牌。`}`;
  }
  const hole = view.players[0].hole!;
  const pair = rankOf(hole[0]) === rankOf(hole[1]);
  return `${hole.map(cardText).join(" ")}${pair ? " 是口袋对子。" : " 是你的两张底牌。"}${legal.canCheck ? "你可以过牌或加注。" : `跟注需补 ${legal.call} 灵石；加注与弃牌也可选择。`}`;
}
