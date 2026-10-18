import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, cardText } from '../../src/core/cards';
import { handExamples } from '../../src/hand-guide';

const cards = (text: string) => text.split(' ').map(name => {
  const card = Array.from({ length: 52 }, (_, i) => i).find(c => cardText(c) === name);
  assert.notEqual(card, undefined);
  return card!;
});

test('牌型图鉴的九组示例牌均由真实规则验证，且严格按强弱排列', () => {
  assert.equal(handExamples.length, 9);
  let previous = Infinity;
  for (const example of handExamples) {
    const actual = evaluate(example.cards);
    assert.equal(actual.category, example.category);
    assert.ok(actual.score < previous);
    previous = actual.score;
  }
});

test('图鉴比较说明符合皇家同花顺、葫芦、A低顺、踢脚与公共牌平手规则', () => {
  assert.equal(evaluate(cards('A♠ K♠ Q♠ J♠ 10♠')).name, '皇家同花顺');
  assert.ok(evaluate(cards('K♠ K♥ K♣ 2♠ 2♦')).score > evaluate(cards('Q♠ Q♥ Q♣ A♠ A♦')).score);
  assert.ok(evaluate(cards('6♠ 5♥ 4♣ 3♦ 2♠')).score > evaluate(cards('A♠ 5♥ 4♣ 3♦ 2♠')).score);
  assert.equal(evaluate(cards('Q♠ K♥ A♣ 2♦ 3♠')).category, 0);
  assert.ok(evaluate(cards('K♠ K♥ J♣ 7♦ 3♠')).score > evaluate(cards('K♣ K♦ 10♠ 9♥ 8♣')).score);
  assert.ok(evaluate(cards('A♠ J♥ 8♣ 6♦ 3♠')).score > evaluate(cards('A♥ 10♣ 9♦ 7♠ 4♥')).score);
  const board = cards('A♠ K♥ Q♣ J♦ 10♠');
  assert.equal(evaluate([...board, ...cards('2♥ 3♥')]).score, evaluate([...board, ...cards('8♣ 9♣')]).score);
  assert.equal(evaluate(cards('A♠ J♠ 8♠ 5♠ 2♠')).score, evaluate(cards('A♥ J♥ 8♥ 5♥ 2♥')).score);
});
