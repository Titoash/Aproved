/** Melhorias nomeadas (GDD §8.2, §8.3): compra única; efeitos lidos no sim, nunca copiados. */
import { MELHORIAS } from "../content/era1";
import { NUCLEO } from "../content/era1-nucleo";
import { melhoriasIniciais, type GameState, type MelhoriaId, type Melhorias, type UsinaId } from "./state";

export function temMelhoria(melhorias: Melhorias | undefined, id: MelhoriaId): boolean {
  return !!melhorias?.[id];
}

/** Fator multiplicativo das melhorias de potência que alcançam a usina. */
export function fatorPotenciaUsina(melhorias: Melhorias | undefined, usinaId: UsinaId): number {
  let fator = 1;
  for (const def of Object.values(MELHORIAS)) {
    if (!temMelhoria(melhorias, def.id)) continue;
    if (def.efeito.tipo === "potenciaUsinas" && def.efeito.usinas.includes(usinaId)) fator *= def.efeito.fator;
  }
  return fator;
}

/** Calor que um Heliostato do anel 1 injeta, em u/s, já com o Rastreamento solar. */
export function calorPorEspelho(melhorias: Melhorias | undefined): number {
  let valor: number = NUCLEO.calorEspelhoAnel1;
  for (const def of Object.values(MELHORIAS)) {
    if (temMelhoria(melhorias, def.id) && def.efeito.tipo === "calorPorEspelho") valor = def.efeito.valor;
  }
  return valor;
}

export function podeComprarMelhoria(state: GameState, id: MelhoriaId): boolean {
  const def = MELHORIAS[id];
  if (temMelhoria(state.melhorias, id)) return false;
  if (state.creditos < def.custo) return false;
  if (def.pesquisa !== undefined && state.pesquisa < def.pesquisa) return false;
  return true;
}

/** Compra única; 🔬 é requisito acumulado, não gasto. */
export function comprarMelhoria(state: GameState, id: MelhoriaId): GameState | null {
  if (!podeComprarMelhoria(state, id)) return null;
  return {
    ...state,
    creditos: state.creditos - MELHORIAS[id].custo,
    melhorias: { ...(state.melhorias ?? melhoriasIniciais()), [id]: true },
  };
}
