/** Balança do Calor (GDD §4.2): temperatura T = Q ÷ capacidade e faixas. */
import { FAIXAS_CALOR, NUCLEO, type FaixaCalor } from "../content/era1-nucleo";
import { capacidadeU } from "./nucleo";
import type { NucleoState } from "./state";

export function temperatura(calorU: number, capacidade: number): number {
  if (capacidade <= 0) return 0;
  return calorU / capacidade;
}

export function temperaturaNucleo(nucleo: NucleoState): number {
  return temperatura(nucleo.calorU, capacidadeU(nucleo.grade, nucleo.receptorCeramico));
}

export function faixaDeCalor(t: number): FaixaCalor {
  for (const faixa of FAIXAS_CALOR) {
    if (faixa.ateInclusivo ? t <= faixa.ate : t < faixa.ate) return faixa;
  }
  return FAIXAS_CALOR[FAIXAS_CALOR.length - 1];
}

export function multiplicadorPesquisa(t: number): number {
  return faixaDeCalor(t).pesquisa;
}

/** Pesquisa/s = potência do Núcleo ÷ 10 × multiplicador da faixa (GDD §7). */
export function pesquisaPorSegundo(potenciaNucleoKw: number, t: number): number {
  return potenciaNucleoKw * NUCLEO.pesquisaPorKw * multiplicadorPesquisa(t);
}
