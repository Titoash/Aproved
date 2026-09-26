/**
 * Desbloqueios da Rede (GDD §8.2, §8.6). Colocar e remover prédios vive em `sim/mundo.ts` (GDD §2.1,
 * v0.6); os níveis por tipo, em `sim/melhorias.ts` (v0.8). Funções puras.
 */
import { type Desbloqueio } from "../content/era1";
import { pesquisado } from "./arvore";
import { desbloqueioDe } from "./mundo";
import { quantidadeDe } from "./producao";
import type { GameState, TipoConstrucao } from "./state";

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
