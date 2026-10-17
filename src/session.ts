import { createHand, isValidHand, type HandState } from "./core/poker";
import { readStorage,writeStorage } from './storage';

export const playerNames = [
  "你",
  "顾长风",
  "苏照月",
  "沈听澜",
  "陆知微",
  "江临雪",
];
const key = "wendao:practice:v1";
export interface SavedSession {
  hand: HandState | null;
  paused: boolean;
  corrupt: boolean;
}
export function loadSession(): SavedSession {
  try {
    const raw = readStorage(key);
    if (!raw) return { hand: null, paused: false, corrupt: false };
    if (raw.length > 400_000) throw new Error("存档过大");
    const saved = JSON.parse(raw);
    if (
      saved.version !== 1 ||
      !isValidHand(saved.hand) ||
      saved.hand.players.length !== 6
    )
      throw new Error("无效存档");
    // A restored active hand always waits for explicit user resume.
    return {
      hand: saved.hand,
      paused: saved.hand.street !== "complete",
      corrupt: false,
    };
  } catch {
    return { hand: null, paused: false, corrupt: true };
  }
}
export function saveSession(hand: HandState | null): boolean {
  try {
    return hand ? writeStorage(key, JSON.stringify({ version: 1, hand })) : true;
  } catch {
    return false;
  }
}
export function nextHand(previous: HandState | null): {
  hand: HandState;
  refilled: boolean;
} {
  const stacks = previous?.players.map((p) => (p.stack > 0 ? p.stack : 1000));
  return {
    hand: createHand({
      names: playerNames,
      stacks,
      dealer: previous ? (previous.dealer + 1) % 6 : 0,
      handNumber: (previous?.handNumber || 0) + 1,
    }),
    refilled: !!previous?.players.some((p) => p.stack === 0),
  };
}
