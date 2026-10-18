import test from 'node:test';
import assert from 'node:assert/strict';
import { tutorialAction, tutorialHand, tutorialHero } from '../../src/onboarding';
import { legalActions } from '../../src/core/poker';

test('从零教学使用真实行动依次走过3/1/1发牌、五张比牌与独立弃牌', () => {
  const initial = tutorialHand(4);
  assert.equal(initial.players.reduce((n,p) => n+p.totalBet,0),60);
  assert.equal(legalActions(initial,tutorialHero)?.canCheck,true);
  const checked = tutorialAction(4,{type:'check'});
  assert.equal(checked.board.length,3);
  assert.equal(checked.players[tutorialHero].totalBet,20);
  const flop=tutorialHand(6);assert.equal(legalActions(flop,tutorialHero)?.call,20);
  assert.equal(tutorialAction(6,{type:'call'}).players[tutorialHero].totalBet,40);
  const turn=tutorialHand(7);assert.equal(turn.board.length,4);assert.equal(legalActions(turn,tutorialHero)?.minTo,40);
  assert.equal(tutorialAction(7,{type:'raise',to:40}).players[tutorialHero].totalBet,80);
  assert.equal(tutorialHand(8).board.length,5);
  const showdown=tutorialHand(9);assert.equal(showdown.street,'complete');
  assert.equal(showdown.result?.hands[tutorialHero].name,'一对');
  assert.equal(showdown.result?.hands[tutorialHero].values[0],13);
  assert.equal(showdown.result?.hands[tutorialHero].cards.length,5);
  assert.equal(showdown.result?.payouts[tutorialHero],240);
  assert.equal(showdown.players.reduce((n,p)=>n+p.stack,0),3000);
  const folded=tutorialAction(10,{type:'fold'});assert.equal(folded.players[tutorialHero].folded,true);assert.equal(folded.players[tutorialHero].stack,980);
  assert.throws(()=>tutorialAction(4,{type:'call'}));
  assert.deepEqual(tutorialHand(4),initial,'重新进入教学不会改变固定起始局面');
});
