/**
 * Ações do jogador sobre a Rede que não são colocação (GDD §7, §8.2): desbloqueios e níveis de melhoria.
 * Colocar e remover prédios vive em `sim/mundo.ts` (GDD §2.1, v0.6). Funções puras.
 */
import { USINAS, type Desbloqueio } from "../content/era1";
import { pesquisado } from "./arvore";
import { custoMelhoria } from "./custos";
import { desbloqueioDe } from "./mundo";
import { quantidadeDe } from "./producao";
import type { GameState, TipoConstrucao, UsinaId } from "./state";

/** Desbloqueio por quantidade de usina colocada e/ou por nó da árvore comprado (GDD §8.6, v0.6). */
export function desbloqueado(state: GameState, desbloqueio?: Desbloqueio): boolean {
  if (!desbloqueio) return true;
  if (desbloqueio.usina) {
    const [id, quantidade] = desbloqueio.usina;
    if (quantidadeDe(state, id) < quantidade) return false;
  }
  if (desbloqueio.no !== undefined && !pesquisado(state, desbloqueio.no)) return false;
  return true;
}

/** O tipo já está disponível na paleta de construção? */
export function tipoDisponivel(state: GameState, tipo: TipoConstrucao): boolean {
  return desbloqueado(state, desbloqueioDe(tipo));
}

export function custoProximaMelhoria(state: GameState, id: UsinaId): number {
  return custoMelhoria(USINAS[id], state.rede.usinas[id].nivel);
}

export function podeMelhorarUsina(state: GameState, id: UsinaId): boolean {
  return quantidadeDe(state, id) > 0 && state.creditos >= custoProximaMelhoria(state, id);
}

/** Nível de melhoria da usina: `custo_base × 3^nível`, produção `× (1 + 0,5 × nível)` (GDD §7). */
export function melhorarUsina(state: GameState, id: UsinaId): GameState | null {
  if (!podeMelhorarUsina(state, id)) return null;
  const custo = custoProximaMelhoria(state, id);
  const usina = state.rede.usinas[id];
  return {
    ...state,
    creditos: state.creditos - custo,
    rede: { ...state.rede, usinas: { ...state.rede.usinas, [id]: { nivel: usina.nivel + 1 } } },
  };
}
