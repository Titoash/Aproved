/** Balança do Calor (GDD §4.2): temperatura T = Q ÷ capacidade e faixas. */
import { FAIXAS_CALOR, NUCLEO, type FaixaCalor } from "../content/era1-nucleo";
import { capacidadeDoNucleo } from "./motor";
import type { NucleoState } from "./state";

export function temperatura(calorU: number, capacidade: number): number {
  if (capacidade <= 0) return 0;
  return calorU / capacidade;
}

export function temperaturaNucleo(nucleo: NucleoState): number {
  return temperatura(nucleo.calorU, capacidadeDoNucleo(nucleo));
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

/**
 * Pesquisa/s = potência do Núcleo × fator da era × multiplicador da faixa (GDD §7 e Parte 2 §5.1).
 * O fator é 0,1 na Era 1 e 0,01 na Era 2: a potência subiu ×50, a pesquisa ×5.
 */
export function pesquisaPorSegundo(potenciaNucleoKw: number, t: number, porKw: number = NUCLEO.pesquisaPorKw): number {
  return potenciaNucleoKw * porKw * multiplicadorPesquisa(t);
}

export type DicaEquilibrio = "adicionarEspelhos" | "tirarEspelho" | null;

/**
 * Dica derivada de `T*` (o equilíbrio), não do `T` atual: abaixo da zona de ouro
 * pede espelhos; acima do limite pede menos calor; dentro, nada.
 */
export function dicaDeEquilibrio(tEquilibrio: number): DicaEquilibrio {
  if (!Number.isFinite(tEquilibrio)) return tEquilibrio > 0 ? "tirarEspelho" : null;
  const ouro = FAIXAS_CALOR.find((f) => f.id === "ouro");
  const inicioOuro = ouro ? FAIXAS_CALOR[FAIXAS_CALOR.indexOf(ouro) - 1].ate : 0.7;
  if (tEquilibrio < inicioOuro) return "adicionarEspelhos";
  if (tEquilibrio > 1) return "tirarEspelho";
  return null;
}
