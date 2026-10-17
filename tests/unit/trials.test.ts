import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trials, startTrial, attemptTrial } from '../../src/trials';
import { isValidHand, legalActions, observe } from '../../src/core/poker';
import { isTrialUnlocked, lessons } from '../../src/learning';

test('三场试炼由合法行动到达，未公开底牌隔离，逐境课程解锁', () => {
  for (const trial of trials) {
    const run = startTrial(trial.id);
    assert.ok(isValidHand(run.state));
    assert.equal(run.state.actor, run.hero);
    const view = observe(run.state, run.hero);
    assert.equal(view.players[0].hole, null);
    assert.equal(view.players[1].hole, null);
    assert.equal('deck' in view, false);
    assert.equal(isTrialUnlocked(trial.id, []), false);
    assert.equal(isTrialUnlocked(trial.id, lessons.filter(l => l.stage === trial.stage).map(l => l.id)), true);
  }
});

test('大盲免费过牌进入翻牌；非法行动不改原局面，合法弃牌不记达成', () => {
  const run = startTrial('free-check'), snapshot = structuredClone(run);
  assert.throws(() => attemptTrial(run, { type: 'call' }));
  assert.deepEqual(run, snapshot);
  const folded = attemptTrial(run, { type: 'fold' });
  assert.equal(folded.passed, false);
  const checked = attemptTrial(run, { type: 'check' });
  assert.equal(checked.passed, true);
  assert.equal(checked.state.street, 'flop');
  assert.equal(checked.state.players[2].totalBet, run.state.players[2].totalBet);
  assert.ok(isValidHand(checked.state));
  assert.throws(() => attemptTrial(checked, { type: 'check' }));
});

test('最小再加注按最近足额增量计算，实际只追加差额', () => {
  const run = startTrial('min-raise');
  assert.equal(run.state.currentBet, 100);
  assert.equal(run.state.players[2].streetBet, 40);
  assert.equal(legalActions(run.state)!.minTo, 160);
  assert.throws(() => attemptTrial(run, { type: 'raise', to: 150 }));
  assert.equal(attemptTrial(run, { type: 'raise', to: 200 }).passed, false);
  const raised = attemptTrial(run, { type: 'raise', to: 160 });
  assert.equal(raised.passed, true);
  assert.equal(raised.state.players[2].totalBet - run.state.players[2].totalBet, 120);
  assert.ok(isValidHand(raised.state));
});

test('短码跟注到实际额度，完整发牌和真实分池，达成与输赢无关', () => {
  const run = startTrial('short-call');
  assert.equal(legalActions(run.state)!.call, 80);
  assert.equal(legalActions(run.state)!.canRaise, false);
  assert.equal(attemptTrial(run, { type: 'fold' }).passed, false);
  const called = attemptTrial(run, { type: 'call' });
  assert.equal(called.passed, true);
  assert.equal(called.state.street, 'complete');
  assert.equal(called.state.board.length, 5);
  assert.equal(called.state.players[2].totalBet, 100);
  assert.deepEqual(called.state.result!.pots.map(p => p.amount), [300, 400]);
  assert.ok(called.state.result!.pots[0].eligible.includes(2));
  assert.ok(!called.state.result!.pots[1].eligible.includes(2));
  assert.equal(called.state.players.reduce((n, p) => n + p.stack, 0), 700);
  assert.ok(isValidHand(called.state));
  assert.ok(observe(called.state, 2).players.every(p => p.hole?.length === 2));
});
