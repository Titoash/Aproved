/** Cards explicativos: só o registro do que já foi visto vive no sim. Gatilhos vêm de `eventos`. */
import type { GameState } from "./state";

export function cardVisto(state: GameState, id: string): boolean {
  return state.cardsVistos.includes(id);
}

export function marcarCardVisto(state: GameState, id: string): GameState {
  if (cardVisto(state, id)) return state;
  return { ...state, cardsVistos: [...state.cardsVistos, id] };
}
