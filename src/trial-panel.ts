import { cardText, rankOf, rankText, suitOf, suits, type Card } from './core/cards';
import { observe, streetNames, type Action } from './core/poker';
import { attemptTrial, startTrial, trials, type TrialId } from './trials';

const card = (value: Card) => `<span class="trial-card ${[1, 3].includes(suitOf(value)) ? 'red' : ''}" aria-label="${cardText(value)}"><b>${rankText(rankOf(value))}</b><i>${suits[suitOf(value)]}</i></span>`;

export function openTrialPanel(host: HTMLElement, id: TrialId, back: () => void, award: (id: TrialId) => Promise<boolean>) {
  let run = startTrial(id), saving = false;
  const meta = trials.find(t => t.id === id)!;
  function render() {
    const view = observe(run.state, run.hero), legal = view.legal;
    host.innerHTML = `<button class="text-button" id="trial-back">← 返回修炼阁</button>
      <p class="quiz-count">问心试炼 · 预设局面</p><h3 class="trial-title">${meta.title}</h3><p class="trial-goal">${meta.goal}</p>
      <section class="trial-table" aria-label="独立试炼桌">
        <div class="trial-table-heading"><span>${streetNames[view.street]}</span><span>${view.result ? '已结算' : '桌面投入'} <strong>${view.result?.total ?? view.pot}</strong></span></div>
        <div class="trial-board" aria-label="公共牌">${view.board.length ? view.board.map(card).join('') : '<span class="trial-unopened">公共牌尚未发出</span>'}</div>
        <div class="trial-seats">${view.players.map((p, i) => `<div class="trial-seat ${i === run.hero ? 'is-hero' : ''}"><span>${i === run.hero ? '你 · 大盲' : p.name}<small>${p.folded ? '已弃牌' : p.allIn ? '已全下' : p.lastAction || '等待'}</small></span><span class="trial-hole" aria-label="${i === run.hero ? '你的底牌' : p.hole ? '摊牌底牌' : '对手底牌未公开'}">${p.hole ? p.hole.map(card).join('') : '<span class="trial-card-back">◇</span><span class="trial-card-back">◇</span>'}</span><span class="trial-stack">${p.stack}<small>已投入 ${p.totalBet}</small></span></div>`).join('')}</div>
      </section>
      ${view.result ? `<div class="trial-pots">${view.result.pots.filter(p => !p.refund).map((p, i) => `<div><span>${i === 0 ? '主池' : '边池'} <strong>${p.amount}</strong></span><small>${p.eligible.includes(run.hero) ? '你可竞争' : '仅对手竞争'}</small></div>`).join('')}</div>` : ''}
      <p class="trial-boundary">独立试炼灵石，不影响当前牌局。只练规则与操作，不评估跟注或加注是否盈利。</p>
      <div id="trial-feedback" class="trial-feedback ${run.passed ? 'passed' : ''}" role="status">${run.attempted ? `<span class="trial-seal" aria-hidden="true">${run.passed ? '悟' : '修'}</span><div><strong>${run.passed ? '试炼达成' : '再观一步'}</strong><p>${run.message}</p></div>` : ''}</div>
      ${run.attempted ? '<div class="trial-result-actions"><button class="secondary-button" id="trial-retry">重新尝试</button><button class="primary-button" id="trial-done">收起试炼</button></div>' : `<form id="trial-form" class="trial-controls">
        ${legal?.canRaise ? `<label class="trial-raise-label">本轮总投入<input id="trial-amount" inputmode="numeric" type="number" step="1" min="${view.currentBet + 1}" max="${legal.maxTo}" value="" placeholder="输入总额"/><small id="trial-addition">确认前核对总额与追加额</small></label><button type="submit" class="primary-button" id="trial-raise">${view.currentBet ? '确认加注' : '确认下注'}</button>` : ''}
        <div class="trial-action-row"><button type="button" class="secondary-button" id="trial-fold">弃牌</button><button type="button" class="primary-button" id="trial-call" aria-label="${legal?.canCheck ? "试炼过牌" : `试炼跟注 ${legal?.call}`}">${legal?.canCheck ? '过牌' : `跟注 ${legal?.call}${legal?.call === view.players[run.hero].stack ? ' · 全下' : ''}`}</button></div></form>`}`;
    host.querySelector('#trial-back')!.addEventListener('click', back);
    host.querySelector('#trial-done')?.addEventListener('click', back);
    host.querySelector('#trial-retry')?.addEventListener('click', () => { run = startTrial(id); resetView(); });
    host.querySelector('#trial-fold')?.addEventListener('click', () => void submit({ type: 'fold' }));
    host.querySelector('#trial-call')?.addEventListener('click', () => void submit({ type: legal!.canCheck ? 'check' : 'call' }));
    const amount = host.querySelector<HTMLInputElement>('#trial-amount');
    amount?.addEventListener('input', () => {
      const value = amount.valueAsNumber;
      host.querySelector('#trial-addition')!.textContent = Number.isSafeInteger(value) && value > view.players[run.hero].streetBet
        ? `本次追加 ${value - view.players[run.hero].streetBet} 灵石` : '请输入本轮总投入的整数';
    });
    host.querySelector('#trial-form')?.addEventListener('submit', event => {
      event.preventDefault();
      if (amount) void submit({ type: 'raise', to: amount.valueAsNumber });
    });
  }
  function revealResultControls() {
    const dialog = host.closest('dialog');
    // Scroll to the content end so the sheet's safe-area padding stays below the buttons.
    if (dialog) dialog.scrollTop = dialog.scrollHeight;
    else host.querySelector('.trial-result-actions')?.scrollIntoView({ block: 'end' });
  }
  async function submit(action: Action) {
    if (saving || run.attempted) return;
    try { run = attemptTrial(run, action); }
    catch {
      const legal = observe(run.state, run.hero).legal;
      host.querySelector('#trial-feedback')!.textContent = action.type === 'raise' && legal
        ? `本次加注不合法。足额再加注至少到 ${legal.minTo}；仅筹码不足时可按规则全下。`
        : '这个行动当前不可用，请检查桌面投入。';
      return;
    }
    saving = true;
    render();
    const feedback = host.querySelector<HTMLElement>('#trial-feedback')!;
    const buttons = [...host.querySelectorAll<HTMLButtonElement>('.trial-result-actions button')];
    buttons.forEach(button => { button.disabled = true; });
    feedback.tabIndex = -1;
    feedback.focus({ preventScroll: true });
    revealResultControls();
    if (run.passed) {
      const ok = await award(id);
      // Closing or changing the panel during a native storage flush must not update a new view.
      if (!ok && feedback.isConnected && host.contains(feedback)) {
        const note = document.createElement('p'); note.className = 'input-error';
        note.textContent = '本次达成仍可查看，进度保存失败。请稍后重试。';
        feedback.append(note);
        revealResultControls();
      }
    }
    saving = false;
    buttons.forEach(button => { button.disabled = false; });
  }
  function resetView() {
    render();
    const dialog = host.closest('dialog');
    if (dialog) dialog.scrollTop = 0;
    host.querySelector<HTMLButtonElement>('#trial-back')!.focus({ preventScroll: true });
  }
  resetView();
}
