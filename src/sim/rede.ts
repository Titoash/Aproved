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

export type FaixaId = "apagao" | "neutroBaixo" | "zonaDeOuro" | "neutroAlto" | "saturacao";

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
 *   r < 0,8          apagão        ×0,5   (multa contratual)
 *   0,8 ≤ r < 0,9    neutro        ×1
 *   0,9 ≤ r ≤ 1,1    zona de ouro  ×1,25
 *   1,1 < r ≤ 1,25   neutro        ×1
 *   r > 1,25         saturação     ×0,75  (excedente vai para a bateria, o resto é desperdiçado)
 */
export const FAIXAS_R: readonly FaixaR[] = [
  { id: "apagao", nome: "Apagão", ate: 0.8, ateInclusivo: false, multiplicador: 0.5 },
  { id: "neutroBaixo", nome: "Neutro", ate: 0.9, ateInclusivo: false, multiplicador: 1 },
  { id: "zonaDeOuro", nome: "Zona de ouro", ate: 1.1, ateInclusivo: true, multiplicador: 1.25 },
  { id: "neutroAlto", nome: "Neutro", ate: 1.25, ateInclusivo: true, multiplicador: 1 },
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

/** kWh que `kw` durante `dtS` segundos guardam ou tiram da bateria. */
export function energiaBateriaKwh(kw: number, dtS: number): number {
  return kw * dtS * ECONOMIA.kwhPorKwSegundo;
}

/**
 * Carrega com o excedente e descarrega no déficit, respeitando a capacidade.
 * `dtS` é o intervalo em segundos reais.
 */
export function atualizarBateria(
  bateria: BateriaEstado,
  excedenteKw: number,
  deficitKw: number,
  dtS: number,
): ResultadoBateria {
  const espaco = Math.max(0, bateria.capacidadeKwh - bateria.kwh);
  const carregadoKwh = Math.min(energiaBateriaKwh(Math.max(0, excedenteKw), dtS), espaco);
  const disponivel = bateria.kwh + carregadoKwh;
  const descarregadoKwh = Math.min(energiaBateriaKwh(Math.max(0, deficitKw), dtS), disponivel);
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
  // Receita/s = potência vendida (kW) × preço (₵ por kW·s) × multiplicador da balança (GDD §7).
  const receitaPorSegundo = vendidoKw * ECONOMIA.precoBase * faixa.multiplicador;

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
  /** Energia vendida no passo, em kW·s. */
  vendidoKwS: number;
  carregadoKwh: number;
  descarregadoKwh: number;
  receita: number;
}

/**
 * Um passo da rede, sempre nesta ordem:
 * produção → venda até a demanda → bateria (excedente/déficit) → receita com multiplicador de r.
 */
export function passoRede(rede: RedeState, dtMs: number): PassoRede {
  const dtS = dtMs / 1000;
  const balanco = balancoRede(rede);
  const bat = atualizarBateria(rede.bateria, balanco.excedenteKw, balanco.deficitKw, dtS);
  const vendidoKwS = balanco.vendaDiretaKw * dtS + bat.descarregadoKwh / ECONOMIA.kwhPorKwSegundo;
  const receita = vendidoKwS * ECONOMIA.precoBase * balanco.multiplicador;
  return {
    rede: { ...rede, bateria: bat.bateria },
    balanco,
    vendidoKwS,
    carregadoKwh: bat.carregadoKwh,
    descarregadoKwh: bat.descarregadoKwh,
    receita,
  };
}
