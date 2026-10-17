import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, evaluateFive, cardText } from "../../src/core/cards";
import {
  createHand,
  act,
  legalActions,
  observe,
  isValidHand,
  restoreHand,
  type HandState,
} from "../../src/core/poker";
import { chooseAction } from "../../src/core/bot";

const names = ["你", "长风", "照月", "听澜", "知微", "临雪"];
const c = (text: string) => {
  for (let i = 0; i < 52; i++) if (cardText(i) === text) return i;
  throw new Error(text);
};
const cards = (text: string) => text.split(" ").map(c);
function playPassive(state: HandState) {
  let steps = 0;
  while (state.actor !== null) {
    assert.ok(++steps < 150);
    const legal = legalActions(state)!;
    state = act(state, state.actor, {
      type: legal.canCheck ? "check" : "call",
    });
  }
  return state;
}
function rig(holes: string[], board: string): number[] {
  const h = holes.map(cards);
  const b = cards(board);
  const used = new Set([...h.flat(), ...b]);
  const rest = Array.from({ length: 52 }, (_, i) => i).filter(
    (i) => !used.has(i),
  );
  const order =
    holes.length === 2 ? [0, 1] : [...holes.keys()].slice(1).concat(0);
  const deck = [0, 1].flatMap((pass) => order.map((i) => h[i][pass]));
  deck.push(
    rest.shift()!,
    ...b.slice(0, 3),
    rest.shift()!,
    b[3],
    rest.shift()!,
    b[4],
    ...rest,
  );
  return deck;
}

test("九种牌型排序、A低顺、踢脚及公共牌平局", () => {
  const hands = [
    "A♠ J♥ 9♣ 5♦ 2♠",
    "A♠ A♥ 9♣ 5♦ 2♠",
    "A♠ A♥ 9♣ 9♦ 2♠",
    "A♠ A♥ A♣ 5♦ 2♠",
    "6♠ 5♥ 4♣ 3♦ 2♠",
    "A♠ J♠ 9♠ 5♠ 2♠",
    "A♠ A♥ A♣ 5♦ 5♠",
    "A♠ A♥ A♣ A♦ 2♠",
    "A♠ K♠ Q♠ J♠ 10♠",
  ].map((hand) => evaluateFive(cards(hand)));
  hands.forEach((hand, i) => {
    assert.equal(hand.category, i);
    if (i) assert.ok(hand.score > hands[i - 1].score);
  });
  assert.equal(evaluate(cards("A♠ 2♥ 3♣ 4♦ 5♠ K♦ Q♥")).values[0], 5);
  assert.ok(
    evaluate(cards("A♠ A♥ K♣ 8♦ 7♠")).score >
      evaluate(cards("A♦ A♣ Q♣ 8♥ 7♦")).score,
  );
  assert.equal(
    evaluate(cards("2♠ 3♥ A♣ K♣ Q♣ J♣ 10♣")).score,
    evaluate(cards("9♦ 8♥ A♣ K♣ Q♣ J♣ 10♣")).score,
  );
  assert.equal(evaluate(cards("A♠ A♥ A♣ K♠ K♥ K♣ 2♦")).name, "葫芦");
});

test("完整回合与大盲选择权，非法动作不改变原状态", () => {
  let s = createHand({ names, dealer: 0 });
  assert.equal(s.actor, 3);
  const before = JSON.stringify(s);
  assert.throws(() => act(s, 0, { type: "call" }));
  assert.throws(() => act(s, 3, { type: "check" }));
  assert.throws(() => act(s, 3, { type: "raise", to: 25 }));
  assert.equal(JSON.stringify(s), before);
  for (let i = 0; i < 5; i++) s = act(s, s.actor!, { type: "call" });
  assert.equal(s.actor, 2);
  assert.equal(s.street, "preflop");
  assert.equal(legalActions(s)!.canCheck, true);
  s = act(s, 2, { type: "check" });
  assert.equal(s.street, "flop");
  assert.equal(s.actor, 1);
  assert.equal(s.board.length, 3);
  s = playPassive(s);
  assert.equal(s.board.length, 5);
  assert.equal(s.burn.length, 3);
  assert.ok(isValidHand(s));
});

test("单挑时庄位下小盲且翻前先行动，翻后大盲先行动", () => {
  let s = createHand({ names: names.slice(0, 2), dealer: 0 });
  assert.equal(s.players[0].streetBet, 10);
  assert.equal(s.actor, 0);
  s = act(s, 0, { type: "call" });
  s = act(s, 1, { type: "check" });
  assert.equal(s.actor, 1);
  assert.equal(s.street, "flop");
});

test("不足额全下不立即重开加注，累计足额后重开且保留最小加注幅度", () => {
  let s = createHand({
    names: names.slice(0, 4),
    stacks: [130, 2000, 2000, 2000],
    dealer: 0,
  });
  s = act(s, 3, { type: "raise", to: 100 });
  s = act(s, 0, { type: "raise", to: 130 });
  s = act(s, 1, { type: "call" });
  s = act(s, 2, { type: "call" });
  assert.equal(s.actor, 3);
  assert.equal(legalActions(s)!.canRaise, false);
  assert.equal(legalActions(s)!.minTo, 210);
  assert.throws(() => act(s, 3, { type: "raise", to: 210 }));
  s = createHand({
    names: names.slice(0, 4),
    stacks: [130, 180, 2000, 2000],
    dealer: 0,
  });
  s = act(s, 3, { type: "raise", to: 100 });
  s = act(s, 0, { type: "raise", to: 130 });
  s = act(s, 1, { type: "raise", to: 180 });
  s = act(s, 2, { type: "call" });
  assert.equal(s.actor, 3);
  assert.equal(legalActions(s)!.canRaise, true);
  assert.equal(legalActions(s)!.minTo, 260);
});

test("过牌后面对不足大盲的全下仍可完成开注", () => {
  let s = createHand({
    names: names.slice(0, 3),
    stacks: [100, 100, 30],
    dealer: 0,
  });
  s = act(s, 0, { type: "call" });
  s = act(s, 1, { type: "call" });
  s = act(s, 2, { type: "check" });
  s = act(s, 1, { type: "check" });
  s = act(s, 2, { type: "raise", to: 10 });
  assert.equal(legalActions(s)!.minTo, 20);
  s = act(s, 0, { type: "call" });
  assert.equal(s.actor, 1);
  assert.equal(legalActions(s)!.canRaise, true);
  s = act(s, 1, { type: "raise", to: 20 });
  assert.equal(s.lastFullRaise, 20);
});

test("全下后自动发完公共牌；主池、边池与未跟注返还分别结算", () => {
  const deck = rig(["Q♠ Q♥", "K♠ K♥", "A♠ A♥"], "2♣ 4♦ 7♠ 9♥ J♣");
  let s = createHand({
    names: names.slice(0, 3),
    stacks: [200, 100, 50],
    deck,
    dealer: 0,
  });
  s = act(s, 0, { type: "raise", to: 200 });
  s = act(s, 1, { type: "call" });
  s = act(s, 2, { type: "call" });
  assert.equal(s.street, "complete");
  assert.equal(s.board.length, 5);
  assert.deepEqual(s.result!.payouts, [100, 100, 150]);
  assert.deepEqual(
    s.players.map((p) => p.stack),
    [100, 100, 150],
  );
  assert.equal(s.result!.pots[2].refund, true);
  assert.ok(isValidHand(s));
});

test("公共牌平局，弃牌投入计入底池，奇数筹码从庄位左侧分配", () => {
  const deck = rig(["2♠ 3♠", "4♠ 5♠", "6♠ 7♠"], "A♣ K♣ Q♣ J♣ 10♣");
  let s = createHand({
    names: names.slice(0, 3),
    stacks: [100, 100, 100],
    deck,
    dealer: 0,
    bigBlind: 2,
  });
  s = act(s, 0, { type: "call" });
  s = act(s, 1, { type: "fold" });
  s = act(s, 2, { type: "check" });
  s = playPassive(s);
  assert.deepEqual(s.result!.payouts, [2, 0, 3]);
  assert.equal(
    s.players.reduce((sum, p) => sum + p.stack, 0),
    300,
  );
});

test("全部对手弃牌直接结算，不泄露底牌", () => {
  let s = createHand({ names });
  while (s.street !== "complete") s = act(s, s.actor!, { type: "fold" });
  assert.equal(s.result!.showdown, false);
  assert.equal(s.board.length, 0);
  assert.equal(
    s.players.reduce((sum, p) => sum + p.stack, 0),
    6000,
  );
  const view = observe(s, 0);
  assert.ok(!("deck" in view));
  assert.ok(!("burn" in view));
  view.players.slice(1).forEach((p) => assert.equal(p.hole, null));
  assert.equal(s.result!.pots[0].amount, 20);
  assert.equal(s.result!.pots[1].amount, 10);
  assert.equal(s.result!.pots[1].refund, true);
});

test("结算存档重算底池、牌型和个人账本，缺损或篡改结果不会进入复盘", () => {
  const settled = playPassive(createHand({ names }));
  assert.ok(restoreHand(settled));
  for (const mutate of [
    (s: HandState) => {
      delete (s.result as any).hands;
    },
    (s: HandState) => {
      s.result!.hands[0].score += 1;
    },
    (s: HandState) => {
      s.result!.pots[0].amount += 1;
    },
    (s: HandState) => {
      s.players[0].stack++;
      s.players[1].stack--;
    },
    (s: HandState) => {
      s.log[0].street = "unknown" as any;
    },
  ]) {
    const corrupt = structuredClone(settled);
    mutate(corrupt);
    assert.equal(isValidHand(corrupt), false);
    assert.equal(restoreHand(corrupt), null);
  }
  const active = createHand({ names });
  active.players[0].stack++;
  active.players[1].stack--;
  assert.equal(
    isValidHand(active),
    false,
    "Global balance alone cannot validate individual wallets",
  );
});

test("旧版单底池弃牌存档可迁移，手牌与灵石保持不变", () => {
  let s = createHand({ names });
  while (s.street !== "complete") s = act(s, s.actor!, { type: "fold" });
  const legacy = structuredClone(s);
  legacy.result!.pots = [
    { ...legacy.result!.pots[0], amount: legacy.result!.total },
  ];
  assert.equal(isValidHand(legacy), true);
  const restored = restoreHand(JSON.parse(JSON.stringify(legacy)))!;
  assert.deepEqual(restored.players, s.players);
  assert.deepEqual(restored.deck, s.deck);
  assert.deepEqual(restored.result, s.result);
  assert.equal(
    legacy.result!.pots.length,
    1,
    "Restoration must not mutate its input",
  );
});

test("随机策略对局始终结束、筹码守恒、牌不重复、观察隔离；存档损坏被拒绝", () => {
  let seed = 4242;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let run = 0; run < 240; run++) {
    let s = createHand({
      names,
      stacks: names.map(() => 20 + Math.floor(random() * 35)),
      dealer: run % 6,
      bigBlind: 2,
    });
    const total = s.players.reduce((sum, p) => sum + p.startingStack, 0);
    let moves = 0;
    while (s.actor !== null) {
      assert.ok(++moves < 250);
      assert.ok(isValidHand(s));
      const seat = s.actor;
      const view = observe(s, seat);
      view.players.forEach((p, i) => {
        if (i !== seat) assert.equal(p.hole, null);
      });
      const legal = legalActions(s)!;
      let action = chooseAction(view, seat, random);
      if (legal.canRaise && random() < 0.15)
        action = { type: "raise", to: legal.maxTo };
      s = act(s, seat, action);
      assert.equal(
        s.players.reduce(
          (sum, p) =>
            sum + p.stack + (s.street === "complete" ? 0 : p.totalBet),
          0,
        ),
        total,
      );
    }
    assert.ok(isValidHand(s));
  }
  const bad = createHand({ names });
  bad.players[0].stack = -1;
  assert.equal(isValidHand(bad), false);
  assert.equal(isValidHand(null), false);
  assert.equal(isValidHand({ version: 1 }), false);
});
