import { act, createHand, legalActions, type Action, type HandState } from './core/poker';

export const tutorialLastStep = 11;
export const tutorialHero = 2;
/** A fixed three-seat teaching hand. Dealing, money and comparison use the real engine. */
export function tutorialHand(step: number): HandState {
  // Deal order: small blind, big blind (you), dealer; then burns and 3/1/1 board cards.
  const first = [31, 11, 25, 19, 10, 9, 0, 50, 18, 26, 1, 33, 2, 40];
  const deck = [...first, ...Array.from({ length: 52 }, (_, i) => i).filter(i => !first.includes(i))];
  let state = createHand({ names: ['长风', '照月', '你'], dealer: 0, deck });
  const move = (action: Action) => { state = act(state, state.actor!, action); };
  if (step === 10) {
    move({ type: 'raise', to: 40 }); move({ type: 'call' });
    return state;
  }
  move({ type: 'call' }); move({ type: 'call' });
  if (step >= 5) { move({ type: 'check' }); move({ type: 'raise', to: 20 }); }
  if (step >= 7) { move({ type: 'call' }); move({ type: 'call' }); move({ type: 'raise', to: 20 }); }
  if (step >= 8) { move({ type: 'raise', to: 40 }); move({ type: 'call' }); move({ type: 'call' }); move({ type: 'check' }); }
  if (step >= 9) { move({ type: 'check' }); move({ type: 'check' }); }
  return state;
}
export function tutorialAction(step: number, action: Action): HandState {
  const wanted: Record<number, Action> = { 4: { type: 'check' }, 6: { type: 'call' }, 7: { type: 'raise', to: 40 }, 8: { type: 'check' }, 10: { type: 'fold' } };
  const target = wanted[step];
  if (!target || action.type !== target.type || (action.type === 'raise' && action.to !== 40)) throw new Error('这一步请先练习师父指定的操作；这不是策略优劣判断。');
  const state = tutorialHand(step);
  if (!legalActions(state, tutorialHero)) throw new Error('教学行动尚未准备好');
  return act(state, tutorialHero, action);
}
