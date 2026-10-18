import { cardText, handNames, rankOf, rankText, suitOf, suits, type Card } from './core/cards';

interface HandExample {
  category: number;
  cards: Card[];
  keyCards: number[];
  description: string;
  compare: string;
}

const c = (rank: number, suit: number) => suit * 13 + rank - 2;
/** Five-card examples, in strength order. The rule engine verifies them in unit tests. */
export const handExamples: HandExample[] = [
  { category: 8, cards: [c(10,0),c(9,0),c(8,0),c(7,0),c(6,0)], keyCards: [0,1,2,3,4], description: '五张点数连着，花色也全一样。', compare: '同为同花顺，比最大的一张。A、K、Q、J、10 同花，叫“皇家同花顺”，是最大的同花顺。' },
  { category: 7, cards: [c(14,0),c(14,1),c(14,2),c(14,3),c(7,0)], keyCards: [0,1,2,3], description: '四张点数相同，另带一张。这是四条 A。', compare: '先比四张的点数；一样再比剩下的一张。' },
  { category: 6, cards: [c(13,0),c(13,1),c(13,2),c(2,0),c(2,3)], keyCards: [0,1,2,3,4], description: '三张相同 + 两张相同，也就是“三条带一对”。', compare: '先比三张的点数，再比那一对。所以三个 K 带两个 2，大过三个 Q 带两个 A。' },
  { category: 5, cards: [c(14,1),c(11,1),c(8,1),c(5,1),c(2,1)], keyCards: [0,1,2,3,4], description: '五张花色相同，点数不用连着。这里都是红桃。', compare: '从最大的一张开始逐张比点数。花色本身不分高低。' },
  { category: 4, cards: [c(9,0),c(8,1),c(7,2),c(6,3),c(5,0)], keyCards: [0,1,2,3,4], description: '五张点数连着，花色可以不同。这是 9 到 5 的顺子。', compare: '比最大的一张。A、2、3、4、5 是最小的顺子，只算 5 大；Q、K、A、2、3 不算顺子。' },
  { category: 3, cards: [c(8,0),c(8,1),c(8,2),c(13,3),c(2,0)], keyCards: [0,1,2], description: '三张点数相同，另外两张不成对。这是三条 8。', compare: '先比三张的点数；一样再把剩下两张从大到小逐张比。' },
  { category: 2, cards: [c(13,0),c(13,1),c(4,2),c(4,3),c(9,0)], keyCards: [0,1,2,3], description: '有两组对子，另带一张。这里是一对 K 加一对 4。', compare: '先比大对子，再比小对子，最后比剩下的一张。' },
  { category: 1, cards: [c(13,0),c(13,1),c(11,2),c(7,3),c(3,0)], keyCards: [0,1], description: '两张点数相同，另外三张各不相同。这是一对 K。', compare: '先比对子点数。一对 K 大过一对 Q；对子一样，再把剩下三张从大到小逐张比。' },
  { category: 0, cards: [c(14,0),c(11,1),c(8,2),c(6,3),c(3,0)], keyCards: [0], description: '没有凑成上面任何一种，就比单张点数。这里最大是 A。', compare: '从最大的一张开始逐张比，直到分出高低；不是只看第一张。' },
];

export function renderHandGuide(expanded = false) {
  return `<details class="hand-guide" ${expanded ? 'open' : ''}>
    <summary><span>九种牌型图鉴<small>看示例牌，认识每一种</small></span><span class="hand-guide-toggle" aria-hidden="true">＋</span></summary>
    <div class="hand-guide-body"><p class="hand-guide-intro">从强到弱排列 · 先看牌型，再比点数<br>每组都是五张示例牌，不是你正在玩的手牌。金线标出组成牌型的关键牌，其他牌也可能决定输赢。不用一次背完。</p>
    <ol class="hand-guide-list">${handExamples.map((example, index) => `<li data-hand-category="${example.category}">
      <div class="hand-guide-heading"><span class="hand-guide-order">${String(index + 1).padStart(2,'0')}</span><h4>${handNames[example.category]}</h4>${index === 0 ? '<span class="hand-guide-badge">最强</span>' : ''}</div>
      <div class="hand-guide-cards" role="group" aria-label="${handNames[example.category]}示例：${example.cards.map(cardText).join('、')}">${example.cards.map((card, i) => `<span aria-hidden="true" class="trial-card ${[1,3].includes(suitOf(card)) ? 'red' : ''} ${example.keyCards.includes(i) ? 'hand-guide-key' : ''}"><b>${rankText(rankOf(card))}</b><i>${suits[suitOf(card)]}</i></span>`).join('')}</div>
      <p>${example.description}</p><details class="hand-guide-compare"><summary>同牌型怎么比？</summary><p>${example.compare}</p></details>
    </li>`).join('')}</ol>
    <div class="hand-guide-ties"><strong>五张都一样大，就平手</strong><p>只比最终最好的五张，不比第六、七张，也不比花色。比如两人都用桌上的 A、K、Q、J、10 组成顺子，就平手。可争夺的底池通常平分。</p></div></div>
  </details>`;
}
