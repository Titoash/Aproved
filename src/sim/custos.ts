/** Custos de unidades e melhorias (GDD §7). */
import { MELHORIA } from "../content/era1";

export interface CustoDef {
  custoBase: number;
  crescimento: number;
}

/**
 * Custo da próxima unidade quando o jogador já possui `quantidadeAtual`.
 * A 1ª unidade custa `custoBase`; a n-ésima custa `custoBase × crescimento^(n−1)`.
 */
export function custoUnidade(def: CustoDef, quantidadeAtual: number): number {
  return def.custoBase * Math.pow(def.crescimento, quantidadeAtual);
}

/**
 * Custo da próxima melhoria quando a usina está no `nivelAtual`.
 * Nível 1 custa `custoBase × custoMult`; cada nível seguinte custa
 * `crescimento` vezes o anterior.
 */
export function custoMelhoria(def: { custoBase: number }, nivelAtual: number): number {
  return def.custoBase * MELHORIA.custoMult * Math.pow(MELHORIA.crescimento, nivelAtual);
}

/** Fator aplicado à potência base de uma usina no nível dado. */
export function fatorMelhoria(nivel: number): number {
  return 1 + MELHORIA.bonusPorNivel * nivel;
}
