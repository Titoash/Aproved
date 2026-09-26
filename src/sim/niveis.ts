/**
 * Fórmulas puras dos níveis por tipo (GDD Parte 1 §7.1, v0.8). Folha do sim: só lê `content/`, para que
 * a produção, o motor e os efeitos possam usá-la sem ciclo de imports. As ações ficam em `sim/melhorias.ts`.
 */
import { NIVEL_CIENCIA, NIVEL_PECA, NIVEL_USINA } from "../content/melhorias";

/** Produção de uma usina no nível: `× (1 + 0,5 n)` (§7). */
export function fatorUsina(nivel: number): number {
  return 1 + NIVEL_USINA.bonusPorNivel * nivel;
}

/** Grandeza de uma peça do Núcleo no nível: `× (1 + 0,1 n)` (§8.3). */
export function fatorPeca(nivel: number): number {
  return 1 + NIVEL_PECA.bonusPorNivel * nivel;
}

/** 🔬 de um tipo de ciência no nível: `× (1 + 0,25 n)` (v0.9). */
export function fatorCiencia(nivel: number): number {
  return 1 + NIVEL_CIENCIA.bonusPorNivel * nivel;
}

/**
 * Degrau ×3 (usinas, subestações, cabos, ciência): o nível `n + 1` custa `base × 3^(n + 1) × unidades`.
 * `unidades` é 1 para usinas e cabos (a base do cabo já é a soma das rotas) e N para subestações e ciência.
 */
export function custoDegrauTriplo(base: number, nivelAtual: number, crescimento: number, unidades = 1): number {
  return base * Math.pow(crescimento, nivelAtual + 1) * unidades;
}

/**
 * O que um tipo de degrau ×3 já pagou **por unidade** para chegar ao nível `n`: `base × (c¹ + … + cⁿ)`.
 * É o que a unidade nova de subestação ou de ciência paga ao nascer (§7.1, revisão da v0.9): assim tanto
 * faz subir o nível antes ou depois de construir.
 */
export function custoAcumuladoTriplo(base: number, nivel: number, crescimento: number): number {
  let soma = 0;
  for (let k = 1; k <= nivel; k++) soma += base * Math.pow(crescimento, k);
  return soma;
}

/** Degrau ×2 das peças: o nível `n + 1` custa `5 × custo da peça × 2ⁿ` (Heliostato: 150, 300, 600, 1 200, 2 400). */
export function custoNivelPeca(custoDaPeca: number, nivelAtual: number): number {
  return NIVEL_PECA.fatorCusto * custoDaPeca * Math.pow(NIVEL_PECA.crescimento, nivelAtual);
}

/** Teto no nível: `teto base × fator^n` (subestações e cabos). */
export function tetoNoNivel(tetoBase: number, fatorPorNivel: number, nivel: number): number {
  return tetoBase * Math.pow(fatorPorNivel, nivel);
}
