import { cardText, rankOf, rankText, suitOf, suits, handNames } from './core/cards';
import { observe, type Action } from './core/poker';
import { tutorialAction, tutorialHand, tutorialHero, tutorialLastStep } from './onboarding';
import { readStorage, writeStorage, flushStorage, storageHealthy } from './storage';

const key = 'wendao:onboarding:v1';
function progress() {
  try { const p = JSON.parse(readStorage(key) || '{}'); return Number.isInteger(p.step) && p.step >= 0 && p.step <= tutorialLastStep ? p.step as number : 0; }
  catch { return 0; }
}
export const onboardingComplete = () => progress() === tutorialLastStep;
const lessons = [
  ['先别急着上桌', '德州扑克，就是用手里的牌和桌上的牌，凑出更强的五张。师父陪你走一遍，暂时不用背术语。', '这里的灵石只是练习筹码。其他人全弃牌时，最后留下的人也能直接赢走底池，不用摊牌。教学是固定牌局，不影响你原来的手牌和灵石。'],
  ['先认识你的两张底牌', '只有你自己能看到的两张牌，叫“底牌”。点一下自己的牌，记住它们。', '这次是 K♠ 和 Q♠。别人的背面牌不能偷看；到最后摊牌时才会公开。'],
  ['牌上的字和图案怎么看', '点数从小到大：2、3、4、5、6、7、8、9、10、J、Q、K、A。J、Q、K、A 分别是 11、12、13、14。', '♠ ♥ ♣ ♦ 是四种花色，花色之间不分大小。A 也能在 A、2、3、4、5 这条顺子里当最小的牌。'],
  ['桌子中间的灵石池', '大家这一手投进去的灵石，放在中间，叫“底池”。最后的赢家获得它；平手时可能平分。', '开局先有两人强制投入：小盲 10、大盲 20，位置每手轮换。这次你已投了大盲 20，另外两人也跟到 20，所以池里共 60。教学用三人桌，练习桌有六人，基本规则相同。'],
  ['第一招 · 过牌', '现在大家都投到 20，你也已经投了 20，不欠任何差额。此时可以“过牌”：免费把行动交给下一位。', '跟注是补差额；没有差额时，不用再跟一次。请点“过牌”，看看前三张公共牌。'],
  ['三张公共牌，大家一起用', '桌上同时翻出的三张牌，叫“翻牌”。后面还会再发一张“转牌”和一张“河牌”，一共五张公共牌。', '这些牌每个人都能用。你手里有一张 K，桌上也有一张 K，已经能组成“一对 K”。点一下公共牌继续。'],
  ['第二招 · 跟注', '翻牌后开始新一轮投入。照月刚投了 20，你这一轮还没投入，所以跟注需要补 20。', '跟注的意思是把本轮投入补到一样多，不是额外再加一份盲注。本次请跟注 20；这只是练操作，不代表跟注一定划算。'],
  ['第三招 · 加注', '第四张公共牌已经发出。照月本轮投了 20；你可以把本轮金额提高到 40，这叫“加注到 40”。', '你本轮还没投入，所以这次实际拿出 40。若前面没人下注，首次投入叫“下注”；有人下注后提高金额才叫“加注”。请练习加注到 40。'],
  ['第五张牌：河牌', '现在五张公共牌都齐了。前面的人已经过牌，你也不用补灵石，可以免费过牌。', '请再过一次牌。等仍在场的人都行动完，我们一起看看谁的五张牌更强。'],
  ['最后比的是最好的五张', '你有两张底牌，加上五张公共牌，共七张候选牌。程序从中选出最强的五张；可以用两张、一张，甚至不用底牌。', '这手你的一对 K 大过照月的一对 7，也大过长风的高牌，所以拿到底池。结果是预设教学例子，不能保证你在随机牌局获胜。'],
  ['第四招 · 弃牌', '换一个独立小例子：你已投大盲 20，有人把金额提高到 40。你不想继续时，可以“弃牌”。', '弃牌后不能再争这一手的底池，之前投入的 20 留在池里，但剩余的 980 仍是你的。弃牌不是输掉全部灵石，也不是做错了。'],
  ['第一手，已经看懂了', '两张底牌自己看，五张公共牌大家用，最后从七张里选最好的五张。行动时先看“还需补多少”，再决定过牌、跟注、加注或弃牌。', '随机练习桌不会保证你赢。先慢慢玩一手，不懂就暂停找师父；修炼阁的九课会继续讲牌型、位置和投入价格。'],
];

export function openOnboarding(host: HTMLElement, close: () => void) {
  let step = progress(), busy = false;
  const card = (c: number, selected = false) => `<span class="trial-card ${[1, 3].includes(suitOf(c)) ? 'red' : ''} ${selected ? 'tutorial-best' : ''}" aria-label="${cardText(c)}"><b>${rankText(rankOf(c))}</b><i>${suits[suitOf(c)]}</i></span>`;
  function render() {
    const state = tutorialHand(step), view = observe(state, tutorialHero), best = step === 9 ? state.result!.hands[tutorialHero].cards : [];
    const [title, copy, detail] = lessons[step];
    const target = step === 1 ? '点击你的两张底牌' : step === 5 ? '点击三张公共牌' : step === 4 || step === 8 ? '过牌 · 不加灵石' : step === 6 ? '跟注 · 补 20 灵石' : step === 7 ? '加注到 40 · 本次拿出 40' : step === 10 ? '弃牌 · 保留剩余 980' : step === 0 ? '师父带我学第一手 →' : step === tutorialLastStep ? '回到练习桌 →' : '明白了，继续 →';
    const pot = view.result?.total ?? view.pot;
    host.innerHTML = `<div class="tutorial-progress"><span>零基础带练 · ${step + 1} / ${lessons.length}</span><span>预设教学</span><div><i style="width:${(step + 1) / lessons.length * 100}%"></i></div></div>
      <div class="tutorial-scroll"><p class="eyebrow">青玄师父 · 一步一步来</p><h3 id="tutorial-step-title" tabindex="-1">${title}</h3><p class="tutorial-copy">${copy}</p>
      ${step > 0 && step < tutorialLastStep ? `<section class="tutorial-table" aria-label="三人教学桌"><div class="trial-table-heading"><span>${step === 10 ? '另一个弃牌例子' : step < 5 ? '公共牌还没发出' : step < 7 ? '翻牌 · 3 张' : step < 8 ? '转牌 · 4 张' : '河牌 · 5 张'}</span><span>灵石池 <strong>${pot}</strong></span></div><div class="tutorial-opponents">${view.players.slice(0,2).map(p => `<div><span>${p.name}</span><div>${p.hole ? p.hole.map(c => card(c)).join('') : '<span class="trial-card-back">◇</span><span class="trial-card-back">◇</span>'}</div><small>本轮投入 ${p.streetBet}</small></div>`).join('')}</div><button type="button" class="tutorial-board" id="tutorial-board" aria-label="点击三张公共牌" ${step === 5 ? '' : 'disabled'}>${view.board.length ? view.board.map(c => card(c, best.includes(c))).join('') : '<span class="trial-unopened">这里会依次放 3 + 1 + 1 张公共牌</span>'}</button><button type="button" class="tutorial-hole" id="tutorial-hole" aria-label="点击你的两张底牌" ${step === 1 ? '' : 'disabled'}>${view.players[tutorialHero].hole!.map(c => card(c, best.includes(c))).join('')}</button><p class="tutorial-wallet">你 · 剩余 ${view.players[tutorialHero].stack} 灵石<span>本轮已投入 ${view.players[tutorialHero].streetBet}</span></p></section>` : `<div class="tutorial-welcome"><span class="seal">道</span><p>${step === 0 ? '先看懂，再落子' : '知进退，也是修行'}</p><span>认识牌面 → 亲手行动 → 看懂输赢</span></div>`}
      <p class="tutorial-detail">${detail}</p>${step === 9 ? `<p class="tutorial-five">金框标出你最终使用的五张牌：${best.map(cardText).join('、')}。</p><details class="tutorial-ranks"><summary>想看牌型大小时，再展开</summary><p>从强到弱：${[...handNames].reverse().join(' ＞ ')}。同类牌型再比具体点数，花色不决定输赢。</p></details>` : ''}
      <p class="tutorial-boundary">固定局面只用于讲规则，师父指定的行动不是盈利建议。原练习桌的手牌和灵石保持不变。</p><p id="tutorial-feedback" role="status"></p></div>
      <div class="tutorial-actions">${step > 0 && step < tutorialLastStep ? '<button type="button" id="tutorial-prev" class="text-button">← 上一步</button>' : ''}<button type="button" id="tutorial-next" class="primary-button">${target}</button>${step === tutorialLastStep ? '<button type="button" id="tutorial-replay" class="text-button">再跟师父学一遍</button>' : ''}</div>`;
    host.querySelector('#tutorial-prev')?.addEventListener('click', () => void go(step - 1));
    host.querySelector('#tutorial-replay')?.addEventListener('click', () => void go(0));
    const next = () => {
      if (step === tutorialLastStep) { close(); return; }
      const action: Action | null = step === 4 || step === 8 ? { type: 'check' } : step === 6 ? { type: 'call' } : step === 7 ? { type: 'raise', to: 40 } : step === 10 ? { type: 'fold' } : null;
      if (action) tutorialAction(step, action);
      void go(step + 1);
    };
    host.querySelector('#tutorial-next')!.addEventListener('click', next);
    host.querySelector('#tutorial-hole')?.addEventListener('click', next);
    host.querySelector('#tutorial-board')?.addEventListener('click', next);
    host.querySelector<HTMLElement>('#tutorial-step-title')!.focus({ preventScroll: true });
  }
  async function go(value: number) {
    if (busy) return;
    busy = true; step = value;
    const ok = writeStorage(key, JSON.stringify({ step }));
    render();
    const feedback = host.querySelector<HTMLElement>('#tutorial-feedback')!;
    const controls = [...host.querySelectorAll<HTMLButtonElement>('button')];
    controls.forEach(b => { b.disabled = true; });
    await flushStorage();
    if (feedback.isConnected && (!ok || !storageHealthy())) feedback.textContent = '本次可以继续学，但教学进度暂时无法保存。';
    busy = false;
    // Re-enable only actions belonging to this step; decorative card areas stay disabled.
    controls.filter(b => !['tutorial-hole','tutorial-board'].includes(b.id) || b.id === (step === 1 ? 'tutorial-hole' : step === 5 ? 'tutorial-board' : '')).forEach(b => { b.disabled = false; });
  }
  render();
}
