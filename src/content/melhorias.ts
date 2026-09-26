/**
 * Melhorias incrementais **por tipo** (GDD Parte 1 §7.1, v0.8 e v0.9): repetíveis, em ₵, compradas onde
 * a coisa está. Melhorar cata-vento melhora todos os cata-ventos; subir as subestações sobe todas.
 *
 * Duas convenções de custo, as duas do GDD:
 * - degraus ×3 (usinas, subestações, cabos, ciência): o nível `n + 1` custa `base × 3^(n + 1)` — o
 *   primeiro nível custa a base × 3, como a melhoria de usina sempre custou (§7);
 * - degraus ×2 (peças do Núcleo, equipe de manutenção): o nível `n + 1` custa `fator × base × 2ⁿ` — o
 *   primeiro nível do Heliostato custa ₵ 150 = 5 × ₵ 30 (§8.3).
 * Subestações e cabos usam os números de `ESCOAMENTO` e `CABO` (custo ×3, teto ×2, nível máximo).
 */
import type { PecaId, UsinaId } from "../sim/state";

/** Usinas das duas eras: produção +50 % por nível, máximo 5 por tipo (§7, §7.1). */
export const NIVEL_USINA = {
  crescimento: 3,
  bonusPorNivel: 0.5,
  maximo: 5,
} as const;

/** Peças do Núcleo: +10 % na grandeza da peça por nível, máximo 5 (§8.3, Parte 2 §5.1). */
export const NIVEL_PECA = {
  fatorCusto: 5,
  crescimento: 2,
  bonusPorNivel: 0.1,
  maximo: 5,
} as const;

/** Sem nível: a Barra de controle (é sim ou não). Receptor e Vaso nem são peças compráveis. */
export const PECAS_SEM_NIVEL: readonly PecaId[] = ["barraControle"];

/** Tipos de construção de ciência que têm nível (v0.9). */
export type TipoCiencia = "laboratorio" | "universidade" | "institutoPesquisa";
export const TIPOS_CIENCIA: readonly TipoCiencia[] = ["laboratorio", "universidade", "institutoPesquisa"];

/** Laboratório, universidade e instituto: +25 % de 🔬 por nível, custo × N unidades, máximo 5 (v0.9). */
export const NIVEL_CIENCIA = {
  crescimento: 3,
  bonusPorNivel: 0.25,
  maximo: 5,
} as const;

/** A ordem em que as usinas aparecem nos níveis (a mesma da paleta). */
export const USINAS_COM_NIVEL: readonly UsinaId[] = ["cataVento", "painelSolar", "turbinaEolica", "eolicaOffshore", "fazendaSolar", "termicaGas"];
