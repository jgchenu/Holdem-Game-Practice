import { act, createHand, legalActions, type Action, type HandState } from './core/poker';

export const trials = [
  { id: 'free-check', stage: 0, title: '静观 · 免费过牌', subtitle: '在大盲位保留免费选择', goal: '前面两位都已跟到 20，你的大盲也是 20。请免费继续看翻牌。' },
  { id: 'min-raise', stage: 1, title: '落子 · 最小再加注', subtitle: '分清本轮总额与本次追加', goal: '最近一次足额加注从 40 到 100。你本轮已投入 40，请完成最小再加注，留意实际追加额。' },
  { id: 'short-call', stage: 2, title: '分池 · 短码全下', subtitle: '亲手看清主池与边池', goal: '两位对手各已全下到 300。你已投入 20，剩余 80。本关指定完成全下跟注，观察哪些底池与你有关。' },
] as const;
export type TrialId = typeof trials[number]['id'];
export interface TrialRun {
  id: TrialId;
  hero: number;
  state: HandState;
  attempted: boolean;
  passed: boolean;
  message: string;
}

/** Fixed teaching deals are isolated from the random practice session and its wallet. */
export function startTrial(id: TrialId): TrialRun {
  let state = createHand({
    names: ['长风', '照月', '你'],
    stacks: id === 'short-call' ? [300, 300, 100] : [1000, 1000, 1000],
    dealer: 0,
    deck: Array.from({ length: 52 }, (_, i) => i),
  });
  const step = (action: Action) => { state = act(state, state.actor!, action); };
  if (id === 'free-check') {
    step({ type: 'call' }); step({ type: 'call' });
  } else if (id === 'min-raise') {
    step({ type: 'call' }); step({ type: 'raise', to: 40 });
    step({ type: 'call' }); step({ type: 'raise', to: 100 }); step({ type: 'call' });
  } else {
    step({ type: 'raise', to: 300 }); step({ type: 'call' });
  }
  return { id, hero: 2, state, attempted: false, passed: false, message: '' };
}

export function attemptTrial(run: TrialRun, action: Action): TrialRun {
  if (run.attempted) throw new Error('请重新尝试这场试炼。');
  const legal = legalActions(run.state, run.hero);
  if (!legal) throw new Error('当前没有可执行的试炼行动。');
  const state = act(run.state, run.hero, action);
  const added = state.players[run.hero].totalBet - run.state.players[run.hero].totalBet;
  const passed = run.id === 'free-check' ? action.type === 'check'
    : run.id === 'min-raise' ? action.type === 'raise' && action.to === legal.minTo
    : action.type === 'call';
  let message: string;
  if (!passed) {
    message = '这是合法行动，但尚未完成本关指定的操作目标。可以重试；本关不评价这次行动的策略优劣。';
  } else if (run.id === 'free-check') {
    message = `过牌没有追加灵石，翻牌已发出。免费继续看牌，不代表最终会赢。`;
  } else if (run.id === 'min-raise') {
    message = `最小再加注到 ${legal.minTo}，本次实际追加 ${added}。加注幅度为 60，本轮总额包含之前投入的 40。`;
  } else {
    const pots = state.result!.pots.filter(p => !p.refund);
    const own = pots.filter(p => p.eligible.includes(run.hero)).reduce((n, p) => n + p.amount, 0);
    const other = pots.filter(p => !p.eligible.includes(run.hero)).reduce((n, p) => n + p.amount, 0);
    message = `全下跟注追加 ${added}。你能竞争 ${own} 的主池；另外 ${other} 的边池只由两位对手竞争。全下不等于能赢走整个底池。`;
  }
  return { ...run, state, attempted: true, passed, message };
}
