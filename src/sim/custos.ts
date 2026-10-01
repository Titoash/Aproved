/** Custo por unidade colocada (GDD §7). Os níveis por tipo estão em `sim/niveis.ts` (v0.8). */

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
