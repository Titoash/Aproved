/**
 * Balança da Rede (GDD §4.1): potência ofertada, demanda, razão `r`,
 * multiplicador de preço por faixa, bateria e receita.
 */
import { BATERIA, ECONOMIA, USINAS, VILA } from "../content/era1";
import { fatorMelhoria } from "./custos";
import type { BateriaEstado, RedeState, UsinaEstado, UsinaId } from "./state";

/* ------------------------------------------------------------------ */
/* Faixas de r                                                        */
/* ------------------------------------------------------------------ */

export type FaixaId = "apagao" | "escassez" | "equilibrio" | "excedente" | "saturacao";

export interface FaixaR {
  id: FaixaId;
  nome: string;
  /** Limite superior da faixa. */
  ate: number;
  /** Se o limite superior pertence à faixa. */
  ateInclusivo: boolean;
  multiplicador: number;
}

/**
 * Faixas da razão r = oferta ÷ demanda, em ordem crescente (GDD §4.1).
 *
 *   r < 0,8          apagão      ×0,5
 *   0,8 ≤ r < 0,95   escassez    ×1
 *   0,95 ≤ r ≤ 1,05  equilíbrio  ×1,25
 *   1,05 < r ≤ 1,25  excedente   ×1
 *   r > 1,25         saturação   ×0,75
 */
export const FAIXAS_R: readonly FaixaR[] = [
  { id: "apagao", nome: "Apagão", ate: 0.8, ateInclusivo: false, multiplicador: 0.5 },
  { id: "escassez", nome: "Escassez", ate: 0.95, ateInclusivo: false, multiplicador: 1 },
  { id: "equilibrio", nome: "Equilíbrio", ate: 1.05, ateInclusivo: true, multiplicador: 1.25 },
  { id: "excedente", nome: "Excedente", ate: 1.25, ateInclusivo: true, multiplicador: 1 },
  { id: "saturacao", nome: "Saturação", ate: Infinity, ateInclusivo: true, multiplicador: 0.75 },
];

export function faixaDeR(r: number): FaixaR {
  for (const faixa of FAIXAS_R) {
    if (faixa.ateInclusivo ? r <= faixa.ate : r < faixa.ate) return faixa;
  }
  return FAIXAS_R[FAIXAS_R.length - 1];
}

export function multiplicadorPreco(r: number): number {
  return faixaDeR(r).multiplicador;
}

/* ------------------------------------------------------------------ */
/* Oferta e demanda                                                   */
/* ------------------------------------------------------------------ */

export function potenciaUsina(id: UsinaId, estado: UsinaEstado): number {
  return USINAS[id].potenciaKw * estado.quantidade * fatorMelhoria(estado.nivel);
}

export function potenciaOfertadaKw(rede: RedeState): number {
  let total = 0;
  for (const id of Object.keys(rede.usinas) as UsinaId[]) {
    total += potenciaUsina(id, rede.usinas[id]);
  }
  return total;
}

export function demandaKw(rede: RedeState): number {
  return rede.demandaBaseKw + rede.vilas * VILA.demandaKw;
}

export function razaoOfertaDemanda(ofertaKw: number, demanda: number): number {
  if (demanda <= 0) return ofertaKw > 0 ? Infinity : 1;
  return ofertaKw / demanda;
}

export function capacidadeBateriaKwh(unidades: number): number {
  return unidades * BATERIA.capacidadeKwh;
}

/* ------------------------------------------------------------------ */
/* Bateria                                                            */
/* ------------------------------------------------------------------ */

export interface ResultadoBateria {
  bateria: BateriaEstado;
  carregadoKwh: number;
  descarregadoKwh: number;
}

/**
 * Carrega com o excedente e descarrega no déficit, respeitando a capacidade.
 * `dtH` é o intervalo em horas de rede.
 */
export function atualizarBateria(
  bateria: BateriaEstado,
  excedenteKw: number,
  deficitKw: number,
  dtH: number,
): ResultadoBateria {
  const espaco = Math.max(0, bateria.capacidadeKwh - bateria.kwh);
  const carregadoKwh = Math.min(Math.max(0, excedenteKw) * dtH, espaco);
  const disponivel = bateria.kwh + carregadoKwh;
  const descarregadoKwh = Math.min(Math.max(0, deficitKw) * dtH, disponivel);
  const kwh = disponivel - descarregadoKwh;
  return {
    bateria: { ...bateria, kwh },
    carregadoKwh,
    descarregadoKwh,
  };
}

/* ------------------------------------------------------------------ */
/* Balanço e passo da rede                                            */
/* ------------------------------------------------------------------ */

export interface BalancoRede {
  ofertaKw: number;
  demandaKw: number;
  r: number;
  faixa: FaixaR;
  multiplicador: number;
  /** Parte da oferta vendida diretamente (até a demanda). */
  vendaDiretaKw: number;
  excedenteKw: number;
  deficitKw: number;
  /** Fluxo instantâneo da bateria: > 0 carregando, < 0 descarregando. */
  fluxoBateriaKw: number;
  /** Estimativa de receita por segundo real no estado atual. */
  receitaPorSegundo: number;
}

export function balancoRede(rede: RedeState): BalancoRede {
  const ofertaKw = potenciaOfertadaKw(rede);
  const demanda = demandaKw(rede);
  const r = razaoOfertaDemanda(ofertaKw, demanda);
  const faixa = faixaDeR(r);
  const vendaDiretaKw = Math.min(ofertaKw, demanda);
  const excedenteKw = ofertaKw - vendaDiretaKw;
  const deficitKw = demanda - vendaDiretaKw;

  const { bateria } = rede;
  let fluxoBateriaKw = 0;
  if (excedenteKw > 0 && bateria.kwh < bateria.capacidadeKwh) fluxoBateriaKw = excedenteKw;
  else if (deficitKw > 0 && bateria.kwh > 0) fluxoBateriaKw = -deficitKw;

  const vendidoKw = vendaDiretaKw + Math.max(0, -fluxoBateriaKw);
  const receitaPorSegundo =
    vendidoKw * ECONOMIA.horasPorSegundo * ECONOMIA.precoBaseKwh * faixa.multiplicador;

  return {
    ofertaKw,
    demandaKw: demanda,
    r,
    faixa,
    multiplicador: faixa.multiplicador,
    vendaDiretaKw,
    excedenteKw,
    deficitKw,
    fluxoBateriaKw,
    receitaPorSegundo,
  };
}

export interface PassoRede {
  rede: RedeState;
  balanco: BalancoRede;
  vendidoKwh: number;
  carregadoKwh: number;
  descarregadoKwh: number;
  receita: number;
}

/**
 * Um passo da rede, sempre nesta ordem:
 * produção → venda até a demanda → bateria (excedente/déficit) → receita com multiplicador de r.
 */
export function passoRede(rede: RedeState, dtMs: number): PassoRede {
  const dtH = (dtMs / 1000) * ECONOMIA.horasPorSegundo;
  const balanco = balancoRede(rede);
  const bat = atualizarBateria(rede.bateria, balanco.excedenteKw, balanco.deficitKw, dtH);
  const vendidoKwh = balanco.vendaDiretaKw * dtH + bat.descarregadoKwh;
  const receita = vendidoKwh * ECONOMIA.precoBaseKwh * balanco.multiplicador;
  return {
    rede: { ...rede, bateria: bat.bateria },
    balanco,
    vendidoKwh,
    carregadoKwh: bat.carregadoKwh,
    descarregadoKwh: bat.descarregadoKwh,
    receita,
  };
}
