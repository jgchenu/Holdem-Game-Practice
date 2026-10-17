import { evaluate, rankOf, suitOf } from "./cards";
import { type Action, type Observation } from "./poker";

/** Lightweight, deliberately varied practice opponents; not a solver or an LLM. */
export function chooseAction(
  view: Observation,
  seat: number,
  random = Math.random,
): Action {
  const legal = view.legal;
  const hole = view.players[seat].hole;
  if (!legal || !hole || hole.length !== 2) throw new Error("缺少玩家可见信息");
  const ranks = hole.map(rankOf).sort((a, b) => b - a);
  const pair = ranks[0] === ranks[1];
  let strength = pair ? 0.48 + ranks[0] / 30 : (ranks[0] + ranks[1]) / 42;
  if (!pair && suitOf(hole[0]) === suitOf(hole[1])) strength += 0.06;
  if (view.board.length >= 3) {
    const hand = evaluate([...hole, ...view.board]);
    strength = [0.18, 0.48, 0.66, 0.76, 0.82, 0.86, 0.91, 0.97, 0.99][
      hand.category
    ];
    // Board-only strength does not imply exclusive ownership of that hand.
    if (view.board.length === 5 && hand.score === evaluate(view.board).score)
      strength = 0.28;
  }
  const aggression = [0, 0.38, 0.16, 0.52, 0.28, 0.35][seat] ?? 0.3;
  const tolerance = seat === 4 ? 0.2 : 0;
  const price = legal.call / Math.max(1, view.pot + legal.call);
  const roll = random();
  if (legal.canRaise && strength > 0.58 && roll < aggression) {
    const target = Math.min(
      legal.maxTo,
      Math.max(
        legal.minTo,
        view.currentBet + Math.max(view.bigBlind, Math.round(view.pot * 0.45)),
      ),
    );
    if (target >= legal.minTo || target === legal.maxTo)
      return { type: "raise", to: target };
  }
  if (legal.canCheck) return { type: "check" };
  if (strength + tolerance < price + 0.19 && roll > 0.15)
    return { type: "fold" };
  if (
    legal.call > view.players[seat].stack * 0.45 &&
    strength < 0.55 &&
    roll > 0.15 + tolerance
  )
    return { type: "fold" };
  return { type: "call" };
}
