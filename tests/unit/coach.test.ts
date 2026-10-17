import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { act, createHand, observe } from "../../src/core/poker";
import {
  coachFacts,
  coachSnapshot,
  validCoachRequest,
} from "../../src/coach-contract";
import { createCoachServer } from "../../server/coach-server";

function snapshot() {
  let hand = createHand({ names: ["你", "甲", "乙", "丙", "丁", "戊"] });
  while (hand.actor !== 0) hand = act(hand, hand.actor!, { type: "call" });
  return coachSnapshot(observe(hand, 0));
}
async function listen(server: Server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}
async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

test("师父快照只含本人底牌与公开信息，额外隐藏字段被拒绝", () => {
  const s = snapshot(),
    request = { topic: "situation", snapshot: s };
  assert.equal(validCoachRequest(request), true);
  for (const player of s.players) {
    assert.equal("hole" in player, false);
    assert.equal("name" in player, false);
  }
  assert.equal("deck" in s, false);
  assert.equal("burn" in s, false);
  assert.equal(
    validCoachRequest({ ...request, snapshot: { ...s, deck: [1, 2] } }),
    false,
  );
  assert.equal(
    validCoachRequest({
      ...request,
      snapshot: { ...s, board: [s.heroCards[0], 3, 4] },
    }),
    false,
  );
});

test("直接价格由程序计算，并排除短码无法竞争的高层边池", () => {
  const s = snapshot();
  s.players = [
    { stack: 950, totalBet: 50, folded: false, allIn: false },
    { stack: 900, totalBet: 100, folded: false, allIn: false },
  ];
  s.legal = {
    call: 50,
    minTo: 150,
    maxTo: 1000,
    canCheck: false,
    canRaise: true,
  };
  assert.equal(coachFacts(s).directPricePercent, 25);
  s.players = [
    { stack: 50, totalBet: 50, folded: false, allIn: false },
    { stack: 500, totalBet: 500, folded: false, allIn: false },
    { stack: 500, totalBet: 500, folded: false, allIn: false },
  ];
  const facts = coachFacts(s);
  assert.equal(facts.eligiblePotAfterCall, 300);
  assert.equal(facts.directPricePercent, 16.7);
});

test("兼容接口服务只传允许事实，服务器持有密钥，回传模型文本", async () => {
  let upstreamCalls = 0;
  const upstream = createServer(async (req, res) => {
    upstreamCalls++;
    assert.equal(req.url, "/compatible/v1/chat/completions");
    assert.equal(req.headers.authorization, "Bearer server-only");
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(body.model, "test-model");
    assert.equal(body.stream, false);
    const content = JSON.parse(body.messages[1].content);
    assert.equal(content.facts.heroCards.length, 2);
    assert.equal(JSON.stringify(content).includes("deck"), false);
    assert.equal(
      content.players.some((p: object) => "hole" in p),
      false,
    );
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        choices: [{ message: { content: "先看位置，再衡量价格。" } }],
      }),
    );
  });
  const upstreamUrl = await listen(upstream),
    server = createCoachServer({
      baseUrl: upstreamUrl + "/compatible/v1",
      model: "test-model",
      apiKey: "server-only",
      origins: ["http://localhost:5173"],
    });
  const url = await listen(server);
  const post = (value: unknown, origin = "http://localhost:5173") =>
    fetch(url + "/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify(value),
    });
  try {
    const response = await post({ topic: "situation", snapshot: snapshot() });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).text, "先看位置，再衡量价格。");
    assert.equal(
      (
        await post({
          topic: "situation",
          snapshot: { ...snapshot(), deck: [1] },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await post(
          { topic: "situation", snapshot: snapshot() },
          "https://unapproved.example",
        )
      ).status,
      403,
    );
    assert.equal(upstreamCalls, 1);
  } finally {
    await close(server);
    await close(upstream);
  }
});

test("模型超时和未配置都有明确错误，响应不泄露上游或密钥", async () => {
  const slow = createServer(() => {}),
    upstream = await listen(slow);
  const server = createCoachServer({
    baseUrl: upstream,
    model: "test",
    apiKey: "private-key",
    origins: [],
    timeoutMs: 40,
  });
  const url = await listen(server);
  try {
    const response = await fetch(url + "/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "price", snapshot: snapshot() }),
    });
    assert.equal(response.status, 504);
    assert.deepEqual(await response.json(), { error: "timeout" });
  } finally {
    await close(server);
    await close(slow);
  }
  const missing = createCoachServer({
      baseUrl: "",
      model: "",
      apiKey: "",
      origins: [],
    }),
    missingUrl = await listen(missing);
  try {
    assert.equal(
      (
        await fetch(missingUrl + "/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      503,
    );
  } finally {
    await close(missing);
  }
});
