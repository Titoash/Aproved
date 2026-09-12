/** Custos de unidades e melhorias (GDD §7). */
import { MELHORIA } from "../content/regras";

export interface CustoDef {
  custoBase: number;
  crescimento: number;
}

/**
 * Custo da próxima unidade quando o jogador já possui `quantidadeAtual`:
 * `custoBase × crescimento^n`, com n = unidades já possuídas (a 1ª custa `custoBase`).
 */
export function custoUnidade(def: CustoDef, quantidadeAtual: number): number {
  return def.custoBase * Math.pow(def.crescimento, quantidadeAtual);
}

/**
 * Custo da próxima melhoria quando a usina está no `nivelAtual`:
 * `custoBase × 3^nível` para o nível que será comprado (GDD §7).
 */
export function custoMelhoria(def: { custoBase: number }, nivelAtual: number): number {
  return def.custoBase * Math.pow(MELHORIA.crescimento, nivelAtual + 1);
}

/** Fator aplicado à potência base de uma usina no nível dado: `1 + 0,5 × nível`. */
export function fatorMelhoria(nivel: number): number {
  return 1 + MELHORIA.bonusPorNivel * nivel;
}
