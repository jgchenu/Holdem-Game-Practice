/** 0..51: ranks 2..A, suits ♠ ♥ ♣ ♦. No rendering or browser dependencies. */
export type Card = number;
export const suits = ["♠", "♥", "♣", "♦"] as const;
export const rankOf = (card: Card) => (card % 13) + 2;
export const suitOf = (card: Card) => Math.floor(card / 13);
export const rankText = (rank: number) =>
  ({ 11: "J", 12: "Q", 13: "K", 14: "A" })[rank] || String(rank);
export const cardText = (card: Card) =>
  rankText(rankOf(card)) + suits[suitOf(card)];
export const handNames = [
  "高牌",
  "一对",
  "两对",
  "三条",
  "顺子",
  "同花",
  "葫芦",
  "四条",
  "同花顺",
];
export interface HandRank {
  category: number;
  values: number[];
  score: number;
  cards: Card[];
  name: string;
}

export function evaluateFive(cards: Card[]): HandRank {
  if (cards.length !== 5) throw new Error("需要五张牌");
  const ranks = cards.map(rankOf).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  ranks.forEach((rank) => counts.set(rank, (counts.get(rank) || 0) + 1));
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((card) => suitOf(card) === suitOf(cards[0]));
  const unique = [...counts.keys()].sort((a, b) => b - a);
  const straight =
    unique.length === 5
      ? unique[0] - unique[4] === 4
        ? unique[0]
        : unique.join(",") === "14,5,4,3,2"
          ? 5
          : 0
      : 0;
  let category: number;
  let values: number[];
  if (flush && straight) {
    category = 8;
    values = [straight];
  } else if (groups[0][1] === 4) {
    category = 7;
    values = groups.map((g) => g[0]);
  } else if (groups[0][1] === 3 && groups[1][1] === 2) {
    category = 6;
    values = groups.map((g) => g[0]);
  } else if (flush) {
    category = 5;
    values = ranks;
  } else if (straight) {
    category = 4;
    values = [straight];
  } else if (groups[0][1] === 3) {
    category = 3;
    values = groups.map((g) => g[0]);
  } else if (groups[0][1] === 2 && groups[1][1] === 2) {
    category = 2;
    values = groups.map((g) => g[0]);
  } else if (groups[0][1] === 2) {
    category = 1;
    values = groups.map((g) => g[0]);
  } else {
    category = 0;
    values = ranks;
  }
  let score = category;
  for (let i = 0; i < 5; i++) score = score * 15 + (values[i] || 0);
  return {
    category,
    values,
    score,
    cards: [...cards],
    name:
      category === 8 && straight === 14 ? "皇家同花顺" : handNames[category],
  };
}

/** Enumerate the at most 21 five-card subsets, including playing the board. */
export function evaluate(cards: Card[]): HandRank {
  if (
    cards.length < 5 ||
    cards.length > 7 ||
    new Set(cards).size !== cards.length
  )
    throw new Error("需要五至七张不重复的牌");
  let best: HandRank | undefined;
  for (let a = 0; a < cards.length - 4; a++)
    for (let b = a + 1; b < cards.length - 3; b++)
      for (let c = b + 1; c < cards.length - 2; c++)
        for (let d = c + 1; d < cards.length - 1; d++)
          for (let e = d + 1; e < cards.length; e++) {
            const hand = evaluateFive([
              cards[a],
              cards[b],
              cards[c],
              cards[d],
              cards[e],
            ]);
            if (!best || hand.score > best.score) best = hand;
          }
  return best!;
}

/** Fisher-Yates with rejection-sampled crypto integers; deterministic random is injectable in tests. */
export function shuffledDeck(
  randomInt: (max: number) => number = secureInt,
): Card[] {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) {
    const j = randomInt(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i) throw new Error("无效随机数");
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function secureInt(max: number): number {
  const range = 0x100000000;
  const limit = range - (range % max);
  const value = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(value);
  } while (value[0] >= limit);
  return value[0] % max;
}
