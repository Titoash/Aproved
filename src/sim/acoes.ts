/** Ações do jogador sobre o estado. Funções puras: devolvem `null` quando a ação não é possível. */
import { BATERIA, USINAS, VILA, type Desbloqueio } from "../content/era1";
import { custoMelhoria, custoUnidade } from "./custos";
import { capacidadeBateriaKwh } from "./rede";
import type { GameState, UsinaId } from "./state";

/** Desbloqueio por quantidade de usina e/ou por pesquisa acumulada (🔬 é requisito, não gasto). */
export function desbloqueado(state: GameState, desbloqueio?: Desbloqueio): boolean {
  if (!desbloqueio) return true;
  if (desbloqueio.usina) {
    const [id, quantidade] = desbloqueio.usina;
    if (state.rede.usinas[id].quantidade < quantidade) return false;
  }
  if (desbloqueio.pesquisa !== undefined && state.pesquisa < desbloqueio.pesquisa) return false;
  return true;
}

export function custoProximaUsina(state: GameState, id: UsinaId): number {
  return custoUnidade(USINAS[id], state.rede.usinas[id].quantidade);
}

export function custoProximaMelhoria(state: GameState, id: UsinaId): number {
  return custoMelhoria(USINAS[id], state.rede.usinas[id].nivel);
}

export function custoProximaVila(state: GameState): number {
  return custoUnidade(VILA, state.rede.vilas);
}

export function custoProximaBateria(state: GameState): number {
  return custoUnidade(BATERIA, state.rede.bateria.unidades);
}

export function podeComprarUsina(state: GameState, id: UsinaId): boolean {
  return desbloqueado(state, USINAS[id].desbloqueio) && state.creditos >= custoProximaUsina(state, id);
}

export function podeMelhorarUsina(state: GameState, id: UsinaId): boolean {
  return state.rede.usinas[id].quantidade > 0 && state.creditos >= custoProximaMelhoria(state, id);
}

export function podeComprarVila(state: GameState): boolean {
  return desbloqueado(state, VILA.desbloqueio) && state.creditos >= custoProximaVila(state);
}

export function podeComprarBateria(state: GameState): boolean {
  return desbloqueado(state, BATERIA.desbloqueio) && state.creditos >= custoProximaBateria(state);
}

export function comprarUsina(state: GameState, id: UsinaId): GameState | null {
  if (!podeComprarUsina(state, id)) return null;
  const custo = custoProximaUsina(state, id);
  const usina = state.rede.usinas[id];
  return {
    ...state,
    creditos: state.creditos - custo,
    rede: {
      ...state.rede,
      usinas: { ...state.rede.usinas, [id]: { ...usina, quantidade: usina.quantidade + 1 } },
    },
  };
}

export function melhorarUsina(state: GameState, id: UsinaId): GameState | null {
  if (!podeMelhorarUsina(state, id)) return null;
  const custo = custoProximaMelhoria(state, id);
  const usina = state.rede.usinas[id];
  return {
    ...state,
    creditos: state.creditos - custo,
    rede: {
      ...state.rede,
      usinas: { ...state.rede.usinas, [id]: { ...usina, nivel: usina.nivel + 1 } },
    },
  };
}

export function comprarVila(state: GameState): GameState | null {
  if (!podeComprarVila(state)) return null;
  const custo = custoProximaVila(state);
  return {
    ...state,
    creditos: state.creditos - custo,
    rede: { ...state.rede, vilas: state.rede.vilas + 1 },
  };
}

export function comprarBateria(state: GameState): GameState | null {
  if (!podeComprarBateria(state)) return null;
  const custo = custoProximaBateria(state);
  const unidades = state.rede.bateria.unidades + 1;
  return {
    ...state,
    creditos: state.creditos - custo,
    rede: {
      ...state.rede,
      bateria: { ...state.rede.bateria, unidades, capacidadeKwh: capacidadeBateriaKwh(unidades) },
    },
  };
}
