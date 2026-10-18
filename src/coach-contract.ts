import { cardText, evaluate, type Card } from "./core/cards";
import { type Observation, type Street } from "./core/poker";

export const coachTopics = ["situation", "price", "review"] as const;
export type CoachTopic = (typeof coachTopics)[number];
export interface CoachSnapshot {
  version: 1;
  handNumber: number;
  street: Street;
  dealer: number;
  actor: number | null;
  heroCards: Card[];
  board: Card[];
  players: {
    stack: number;
    totalBet: number;
    folded: boolean;
    allIn: boolean;
  }[];
  legal: {
    call: number;
    minTo: number;
    maxTo: number;
    canCheck: boolean;
    canRaise: boolean;
  } | null;
  actions: { seat: number; street: Street; type: string; amount: number }[];
  net: number | null;
}
/** Explicit allowlist: never serialize an Observation, HandState, deck or opponent holes. */
export function coachSnapshot(view: Observation): CoachSnapshot {
  return {
    version: 1,
    handNumber: view.handNumber,
    street: view.street,
    dealer: view.dealer,
    actor: view.actor,
    heroCards: [...(view.players[0].hole || [])],
    board: [...view.board],
    players: view.players.map((p) => ({
      stack: p.stack,
      totalBet: p.totalBet,
      folded: p.folded,
      allIn: p.allIn,
    })),
    legal: view.legal
      ? {
          call: view.legal.call,
          minTo: view.legal.minTo,
          maxTo: view.legal.maxTo,
          canCheck: view.legal.canCheck,
          canRaise: view.legal.canRaise,
        }
      : null,
    actions: view.log
      .slice(-64)
      .map((e) => ({
        seat: e.seat,
        street: e.street,
        type: e.type,
        amount: e.amount,
      })),
    net: view.result
      ? view.players[0].stack - view.players[0].startingStack
      : null,
  };
}

const streets = ["preflop", "flop", "turn", "river", "complete"];
const integer = (v: unknown): v is number =>
  Number.isSafeInteger(v) &&
  (v as number) >= 0 &&
  (v as number) <= 1_000_000_000;
function object(v: unknown, keys: string[]): v is Record<string, unknown> {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).length === keys.length &&
    keys.every((key) => Object.hasOwn(v, key))
  );
}
function cards(v: unknown, max: number): v is Card[] {
  return (
    Array.isArray(v) && v.length <= max && v.every((n) => integer(n) && n < 52)
  );
}
export function validCoachRequest(
  value: unknown,
): value is { topic: CoachTopic; snapshot: CoachSnapshot } {
  if (
    !object(value, ["topic", "snapshot"]) ||
    !coachTopics.includes(value.topic as CoachTopic)
  )
    return false;
  const s = value.snapshot;
  if (
    !object(s, [
      "version",
      "handNumber",
      "street",
      "dealer",
      "actor",
      "heroCards",
      "board",
      "players",
      "legal",
      "actions",
      "net",
    ])
  )
    return false;
  if (
    s.version !== 1 ||
    !integer(s.handNumber) ||
    s.handNumber === 0 ||
    !streets.includes(s.street as string)
  )
    return false;
  if (!Array.isArray(s.players) || s.players.length < 2 || s.players.length > 6)
    return false;
  const seats = s.players.length;
  if (
    !integer(s.dealer) ||
    s.dealer >= seats ||
    !(s.actor === null || (integer(s.actor) && s.actor < seats))
  )
    return false;
  if (
    !cards(s.heroCards, 2) ||
    ![0, 2].includes(s.heroCards.length) ||
    !cards(s.board, 5)
  )
    return false;
  const visible = [...s.heroCards, ...s.board];
  if (new Set(visible).size !== visible.length) return false;
  if (
    !s.players.every(
      (p) =>
        object(p, ["stack", "totalBet", "folded", "allIn"]) &&
        integer(p.stack) &&
        integer(p.totalBet) &&
        typeof p.folded === "boolean" &&
        typeof p.allIn === "boolean",
    )
  )
    return false;
  if (
    s.legal !== null &&
    !(
      s.actor === 0 &&
      object(s.legal, ["call", "minTo", "maxTo", "canCheck", "canRaise"]) &&
      integer(s.legal.call) &&
      integer(s.legal.minTo) &&
      integer(s.legal.maxTo) &&
      typeof s.legal.canCheck === "boolean" &&
      typeof s.legal.canRaise === "boolean"
    )
  )
    return false;
  if (
    !Array.isArray(s.actions) ||
    s.actions.length > 64 ||
    !s.actions.every(
      (e) =>
        object(e, ["seat", "street", "type", "amount"]) &&
        integer(e.seat) &&
        e.seat < seats &&
        streets.includes(e.street as string) &&
        ["fold", "check", "call", "raise"].includes(e.type as string) &&
        integer(e.amount),
    )
  )
    return false;
  return (
    s.net === null ||
    (Number.isSafeInteger(s.net) && Math.abs(s.net as number) <= 1_000_000_000)
  );
}

/** All numeric facts are produced by code. The model only explains this verified calculation. */
export function coachFacts(s: CoachSnapshot) {
  const hero = s.players[0];
  const cap = hero.totalBet + (s.legal?.call || 0);
  const eligibleAfterCall = s.players.reduce(
    (sum, p, i) => sum + (i === 0 ? cap : Math.min(cap, p.totalBet)),
    0,
  );
  const best =
    s.heroCards.length === 2 && s.board.length >= 3
      ? evaluate([...s.heroCards, ...s.board]).name
      : null;
  return {
    street: s.street,
    handNumber: s.handNumber,
    heroCards: s.heroCards.map(cardText),
    board: s.board.map(cardText),
    bestHand: best,
    pot:
      s.street === "complete"
        ? null
        : s.players.reduce((sum, p) => sum + p.totalBet, 0),
    heroStack: hero.stack,
    call: s.legal?.call ?? null,
    eligiblePotAfterCall: s.legal?.call ? eligibleAfterCall : null,
    directPricePercent:
      s.legal?.call && eligibleAfterCall
        ? Math.round((s.legal.call / eligibleAfterCall) * 1000) / 10
        : null,
    minRaiseTo: s.legal?.canRaise ? s.legal.minTo : null,
    maxRaiseTo: s.legal?.canRaise ? s.legal.maxTo : null,
    net: s.net,
    boundary:
      "直接价格不是胜率；未计后续下注、范围、抽水。只使用本人的底牌与公开信息，不能判断对手的确切底牌。",
  };
}
