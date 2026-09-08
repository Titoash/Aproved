/** Estabilidade (GDD §6, §7): 0–100 %, sobe enquanto o Núcleo opera dentro da faixa. */
import { CASCATA } from "../content/era1-nucleo";

export function limitarEstabilidade(valor: number): number {
  return Math.min(100, Math.max(0, valor));
}

/** Soma `porMinuto` pontos por minuto durante `dtS` segundos. */
export function passoEstabilidade(estabilidade: number, porMinuto: number, dtS: number): number {
  return limitarEstabilidade(estabilidade + (porMinuto / 60) * dtS);
}

/** A Cascata derruba a Estabilidade, com piso em 0. */
export function perdaCascata(estabilidade: number): number {
  return limitarEstabilidade(estabilidade - CASCATA.perdaEstabilidade);
}
