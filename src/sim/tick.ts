/** Passo de simulação em timestep fixo. */
import { passoRede } from "./rede";
import type { GameState } from "./state";

/** Duração de um tick, em ms. */
export const TICK_MS = 100;
/** Limite do tempo acumulado entre frames (aba em segundo plano). */
export const DT_ACUMULADO_MAX_MS = 5000;

/** Avança o estado em um tick de `dtMs` (normalmente `TICK_MS`). Função pura. */
export function tick(state: GameState, dtMs: number = TICK_MS): GameState {
  const passo = passoRede(state.rede, dtMs);
  return {
    ...state,
    tempoMs: state.tempoMs + dtMs,
    creditos: state.creditos + passo.receita,
    rede: passo.rede,
  };
}

/** Aplica `n` ticks de `TICK_MS`. */
export function avancarTicks(state: GameState, n: number): GameState {
  let atual = state;
  for (let i = 0; i < n; i++) atual = tick(atual, TICK_MS);
  return atual;
}
