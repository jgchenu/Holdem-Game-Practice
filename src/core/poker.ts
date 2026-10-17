import { evaluate, type Card, type HandRank, shuffledDeck } from "./cards";

export type Street = "preflop" | "flop" | "turn" | "river" | "complete";
export type Action =
  { type: "fold" | "check" | "call" } | { type: "raise"; to: number };
export interface Player {
  name: string;
  stack: number;
  startingStack: number;
  hole: Card[];
  folded: boolean;
  allIn: boolean;
  streetBet: number;
  totalBet: number;
  lastAction: string;
}
export interface LogEntry {
  seat: number;
  street: Street;
  text: string;
  amount: number;
  type: string;
  potBefore: number;
}
export interface PotResult {
  amount: number;
  winners: number[];
  eligible: number[];
  refund: boolean;
}
export interface Result {
  pots: PotResult[];
  payouts: number[];
  hands: Record<number, HandRank>;
  showdown: boolean;
  total: number;
}
export interface HandState {
  version: 1;
  handNumber: number;
  street: Street;
  dealer: number;
  smallBlind: number;
  bigBlind: number;
  players: Player[];
  board: Card[];
  burn: Card[];
  deck: Card[];
  actor: number | null;
  currentBet: number;
  lastFullRaise: number;
  actedAt: (number | null)[];
  pending: number[];
  log: LogEntry[];
  result: Result | null;
}
export interface LegalActions {
  call: number;
  owed: number;
  canCheck: boolean;
  canRaise: boolean;
  minTo: number;
  maxTo: number;
  shortAllIn: boolean;
}
export const streetNames: Record<Street, string> = {
  preflop: "起手",
  flop: "翻牌",
  turn: "转牌",
  river: "河牌",
  complete: "终局",
};
export const potSize = (state: HandState) =>
  state.street === "complete"
    ? 0
    : state.players.reduce((sum, p) => sum + p.totalBet, 0);
const eligible = (p: Player) => !p.folded && !p.allIn && p.hole.length > 0;

export function nextSeat(
  state: HandState,
  after: number,
  predicate: (p: Player, i: number) => boolean,
): number {
  for (let offset = 1; offset <= state.players.length; offset++) {
    const i = (after + offset) % state.players.length;
    if (predicate(state.players[i], i)) return i;
  }
  return -1;
}

export function createHand(options: {
  names: string[];
  stacks?: number[];
  dealer?: number;
  deck?: Card[];
  handNumber?: number;
  bigBlind?: number;
}): HandState {
  const { names } = options;
  const stacks = options.stacks || names.map(() => 1000);
  if (
    names.length < 2 ||
    names.length > 6 ||
    stacks.length !== names.length ||
    stacks.some((n) => !Number.isSafeInteger(n) || n < 0) ||
    stacks.filter((n) => n > 0).length < 2
  )
    throw new Error("需要至少两名有灵石的玩家");
  const deck = options.deck ? [...options.deck] : shuffledDeck();
  if (
    deck.length !== 52 ||
    new Set(deck).size !== 52 ||
    deck.some((card) => !Number.isInteger(card) || card < 0 || card > 51)
  )
    throw new Error("牌堆必须包含52张不同的牌");
  const bb = options.bigBlind ?? 20;
  if (!Number.isSafeInteger(bb) || bb < 2 || bb % 2 !== 0)
    throw new Error("大盲注必须为偶数");
  const state: HandState = {
    version: 1,
    handNumber: options.handNumber || 1,
    street: "preflop",
    dealer: options.dealer ?? 0,
    smallBlind: bb / 2,
    bigBlind: bb,
    players: names.map((name, i) => ({
      name,
      stack: stacks[i],
      startingStack: stacks[i],
      hole: [],
      folded: stacks[i] === 0,
      allIn: false,
      streetBet: 0,
      totalBet: 0,
      lastAction: stacks[i] ? "" : "离席",
    })),
    board: [],
    burn: [],
    deck,
    actor: null,
    currentBet: bb,
    lastFullRaise: bb,
    actedAt: names.map(() => null),
    pending: [],
    log: [],
    result: null,
  };
  if (
    !Number.isInteger(state.dealer) ||
    state.dealer < 0 ||
    state.dealer >= names.length
  )
    throw new Error("庄位无效");
  if (!state.players[state.dealer].stack)
    state.dealer = nextSeat(state, state.dealer, (p) => p.stack > 0);
  const live = stacks.filter((n) => n > 0).length;
  const sbSeat =
    live === 2
      ? state.dealer
      : nextSeat(state, state.dealer, (p) => p.stack > 0);
  const bbSeat = nextSeat(state, sbSeat, (p) => p.stack > 0);
  // Deal clockwise from the small blind, one card each pass.
  for (let pass = 0; pass < 2; pass++) {
    let seat = sbSeat;
    for (let i = 0; i < live; i++) {
      state.players[seat].hole.push(state.deck.shift()!);
      seat = nextSeat(state, seat, (p) => p.startingStack > 0);
    }
  }
  pay(state, sbSeat, Math.min(state.smallBlind, state.players[sbSeat].stack));
  state.players[sbSeat].lastAction = "小盲";
  pay(state, bbSeat, Math.min(bb, state.players[bbSeat].stack));
  state.players[bbSeat].lastAction = "大盲";
  state.pending = state.players.flatMap((p, i) => (eligible(p) ? [i] : []));
  progress(state, bbSeat);
  return state;
}

export function legalActions(
  state: HandState,
  seat = state.actor,
): LegalActions | null {
  if (
    state.street === "complete" ||
    seat === null ||
    seat !== state.actor ||
    !eligible(state.players[seat])
  )
    return null;
  const player = state.players[seat];
  const owed = Math.max(0, state.currentBet - player.streetBet);
  const maxTo = player.stack + player.streetBet;
  const minTo =
    state.currentBet < state.bigBlind
      ? state.bigBlind
      : state.currentBet + state.lastFullRaise;
  const reopened =
    state.actedAt[seat] === null ||
    state.currentBet - state.actedAt[seat]! >= state.lastFullRaise;
  const opponentCanRespond = state.players.some(
    (p, i) => i !== seat && eligible(p),
  );
  return {
    call: Math.min(owed, player.stack),
    owed,
    canCheck: owed === 0,
    canRaise: reopened && opponentCanRespond && maxTo > state.currentBet,
    minTo,
    maxTo,
    shortAllIn: maxTo < minTo,
  };
}

function pay(state: HandState, seat: number, amount: number) {
  const player = state.players[seat];
  player.stack -= amount;
  player.streetBet += amount;
  player.totalBet += amount;
  player.allIn = player.stack === 0;
}

/** The input state remains unchanged if an action is rejected. Raise amounts are street totals. */
export function act(
  previous: HandState,
  seat: number,
  action: Action,
): HandState {
  const legal = legalActions(previous, seat);
  if (!legal) throw new Error("尚未轮到该玩家行动");
  if (action.type === "check" && !legal.canCheck)
    throw new Error("需要跟注或弃牌");
  if (action.type === "call" && legal.canCheck) throw new Error("当前应当过牌");
  if (
    action.type === "raise" &&
    (!legal.canRaise ||
      !Number.isSafeInteger(action.to) ||
      action.to <= previous.currentBet ||
      action.to > legal.maxTo ||
      (action.to < legal.minTo && action.to !== legal.maxTo))
  )
    throw new Error("加注金额不合法");
  const state = structuredClone(previous);
  const player = state.players[seat];
  const before = state.currentBet;
  let amount = 0;
  let text = "";
  if (action.type === "fold") {
    player.folded = true;
    text = "弃牌";
  }
  if (action.type === "check") text = "过牌";
  if (action.type === "call") {
    amount = legal.call;
    pay(state, seat, amount);
    text = player.allIn ? `全下跟注 ${amount}` : `跟注 ${amount}`;
  }
  if (action.type === "raise") {
    amount = action.to - player.streetBet;
    pay(state, seat, amount);
    const fullRaise = action.to >= legal.minTo;
    if (fullRaise) {
      state.lastFullRaise =
        before < state.bigBlind ? action.to : action.to - before;
      state.actedAt.fill(null);
    }
    state.currentBet = action.to;
    state.pending = state.players.flatMap((p, i) =>
      i !== seat && eligible(p) ? [i] : [],
    );
    text = `${player.allIn ? "全下至" : before === 0 ? "下注" : "加注至"} ${action.to}`;
  }
  state.actedAt[seat] =
    action.type === "check" && before === 0 ? null : state.currentBet;
  state.pending = state.pending.filter(
    (i) => i !== seat && eligible(state.players[i]),
  );
  player.lastAction = text;
  state.log.push({
    seat,
    street: state.street,
    type: action.type,
    text,
    amount,
    potBefore: potSize(previous),
  });
  progress(state, seat);
  return state;
}

function progress(state: HandState, after: number) {
  while (state.street !== "complete") {
    const remaining = state.players.flatMap((p, i) =>
      !p.folded && p.hole.length ? [i] : [],
    );
    if (remaining.length === 1) {
      finish(state, false);
      return;
    }
    const active = remaining.filter((i) => eligible(state.players[i]));
    state.pending = state.pending.filter((i) => eligible(state.players[i]));
    if (active.length <= 1)
      state.pending = state.pending.filter(
        (i) => state.players[i].streetBet < state.currentBet,
      );
    if (state.pending.length) {
      state.actor = nextSeat(state, after, (_p, i) =>
        state.pending.includes(i),
      );
      return;
    }
    if (state.street === "river") {
      finish(state, true);
      return;
    }
    state.burn.push(state.deck.shift()!);
    const count = state.street === "preflop" ? 3 : 1;
    for (let i = 0; i < count; i++) state.board.push(state.deck.shift()!);
    state.street =
      state.street === "preflop"
        ? "flop"
        : state.street === "flop"
          ? "turn"
          : "river";
    state.currentBet = 0;
    state.lastFullRaise = state.bigBlind;
    state.actedAt.fill(null);
    state.players.forEach((p) => {
      p.streetBet = 0;
      p.lastAction = p.folded ? "弃牌" : p.allIn ? "全下" : "";
    });
    state.pending = active.length > 1 ? [...active] : [];
    after = state.dealer;
  }
}

function finish(state: HandState, showdown: boolean) {
  const total = state.players.reduce((sum, p) => sum + p.totalBet, 0);
  const result: Result = {
    total,
    pots: [],
    payouts: state.players.map(() => 0),
    hands: {},
    showdown,
  };
  const remaining = state.players.flatMap((p, i) =>
    !p.folded && p.hole.length ? [i] : [],
  );
  if (!showdown) {
    result.pots.push({
      amount: total,
      winners: remaining,
      eligible: remaining,
      refund: false,
    });
    result.payouts[remaining[0]] = total;
  } else {
    remaining.forEach((i) => {
      result.hands[i] = evaluate([...state.players[i].hole, ...state.board]);
    });
    const levels = [
      ...new Set(state.players.map((p) => p.totalBet).filter((n) => n > 0)),
    ].sort((a, b) => a - b);
    let previous = 0;
    for (const level of levels) {
      const contributors = state.players.flatMap((p, i) =>
        p.totalBet >= level ? [i] : [],
      );
      const amount = (level - previous) * contributors.length;
      previous = level;
      const eligibleSeats = contributors.filter(
        (i) => !state.players[i].folded,
      );
      if (!eligibleSeats.length) throw new Error("底池无合法获胜者");
      const best = Math.max(...eligibleSeats.map((i) => result.hands[i].score));
      const winners = eligibleSeats.filter(
        (i) => result.hands[i].score === best,
      );
      const split = Math.floor(amount / winners.length);
      let odd = amount % winners.length;
      winners.forEach((i) => {
        result.payouts[i] += split;
      });
      // Odd chips go clockwise from the button, among tied winners.
      for (let offset = 1; offset <= state.players.length && odd; offset++) {
        const i = (state.dealer + offset) % state.players.length;
        if (winners.includes(i)) {
          result.payouts[i]++;
          odd--;
        }
      }
      result.pots.push({
        amount,
        winners,
        eligible: eligibleSeats,
        refund: contributors.length === 1,
      });
    }
  }
  state.players.forEach((p, i) => {
    p.stack += result.payouts[i];
  });
  state.result = result;
  state.street = "complete";
  state.actor = null;
  state.pending = [];
}

export interface Observation {
  handNumber: number;
  street: Street;
  dealer: number;
  actor: number | null;
  bigBlind: number;
  currentBet: number;
  pot: number;
  board: Card[];
  players: (Omit<Player, "hole"> & { hole: Card[] | null })[];
  legal: LegalActions | null;
  result: Result | null;
  log: LogEntry[];
}
/** Single visibility boundary for both bots and the renderer. No deck, burns or other private cards. */
export function observe(state: HandState, viewer: number): Observation {
  return {
    handNumber: state.handNumber,
    street: state.street,
    dealer: state.dealer,
    actor: state.actor,
    bigBlind: state.bigBlind,
    currentBet: state.currentBet,
    pot: potSize(state),
    board: [...state.board],
    players: state.players.map((p, i) => ({
      ...p,
      hole:
        i === viewer || (state.result?.showdown && !p.folded)
          ? [...p.hole]
          : null,
    })),
    legal: legalActions(state, viewer),
    result: state.result ? structuredClone(state.result) : null,
    log: state.log.map(entry => ({...entry})),
  };
}

/** Reject corrupted / incompatible local saves before exposing a resumed hand. */
export function isValidHand(value: unknown): value is HandState {
  try {
    const s = value as HandState;
    if (
      s.version !== 1 ||
      !["preflop", "flop", "turn", "river", "complete"].includes(s.street) ||
      s.players.length < 2 ||
      s.players.length > 6
    )
      return false;
    if (
      !Number.isInteger(s.dealer) ||
      s.dealer < 0 ||
      s.dealer >= s.players.length ||
      !Number.isSafeInteger(s.bigBlind) ||
      s.bigBlind < 2 ||
      s.smallBlind !== s.bigBlind / 2 ||
      !Number.isSafeInteger(s.handNumber) ||
      s.handNumber < 1
    )
      return false;
    const cards = [
      ...s.deck,
      ...s.board,
      ...s.burn,
      ...s.players.flatMap((p) => p.hole),
    ];
    if (
      cards.length !== 52 ||
      new Set(cards).size !== 52 ||
      cards.some((c) => !Number.isInteger(c) || c < 0 || c > 51)
    )
      return false;
    if (
      s.players.some(
        (p) =>
          typeof p.name !== "string" ||
          p.name.length > 30 ||
          typeof p.folded !== "boolean" ||
          typeof p.allIn !== "boolean" ||
          typeof p.lastAction !== "string" ||
          ![0, 2].includes(p.hole.length) ||
          [p.stack, p.startingStack, p.totalBet, p.streetBet].some(
            (n) => !Number.isSafeInteger(n) || n < 0,
          ) ||
          p.streetBet > p.totalBet,
      )
    )
      return false;
    if (
      s.players.reduce(
        (sum, p) => sum + p.stack + (s.street === "complete" ? 0 : p.totalBet),
        0,
      ) !== s.players.reduce((sum, p) => sum + p.startingStack, 0)
    )
      return false;
    if (
      s.actedAt.length !== s.players.length ||
      s.actedAt.some(
        (n) => n !== null && (!Number.isSafeInteger(n) || n < 0),
      ) ||
      !Number.isSafeInteger(s.currentBet) ||
      s.currentBet < 0 ||
      !Number.isSafeInteger(s.lastFullRaise) ||
      s.lastFullRaise < s.bigBlind
    )
      return false;
    if (
      !Array.isArray(s.log) ||
      s.log.length > 500 ||
      s.log.some(
        (e) =>
          !Number.isInteger(e.seat) ||
          e.seat < 0 ||
          e.seat >= s.players.length ||
          typeof e.text !== "string" ||
          e.text.length > 80,
      )
    )
      return false;
    const expected = {
      preflop: 0,
      flop: 3,
      turn: 4,
      river: 5,
      complete: s.board.length,
    }[s.street];
    if (
      s.board.length !== expected ||
      ![0, 3, 4, 5].includes(s.board.length) ||
      s.pending.some(
        (i) => !Number.isInteger(i) || i < 0 || i >= s.players.length,
      )
    )
      return false;
    if (s.street === "complete")
      return (
        s.actor === null &&
        !!s.result &&
        s.result.payouts.length === s.players.length &&
        s.result.payouts.every((n) => Number.isSafeInteger(n) && n >= 0) &&
        s.result.payouts.reduce((a, b) => a + b, 0) === s.result.total
      );
    return (
      s.actor !== null &&
      s.pending.includes(s.actor) &&
      !!legalActions(s) &&
      s.result === null
    );
  } catch {
    return false;
  }
}
