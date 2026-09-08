/**
 * Balança da Rede (GDD §4.1): potência ofertada, demanda, razão `r`,
 * multiplicador de preço por faixa, bateria e receita.
 */
import { BATERIA, ECONOMIA, FAIXAS_R, USINAS, VILA, type FaixaR } from "../content/era1";
import { fatorMelhoria } from "./custos";
import type { BateriaEstado, RedeState, UsinaEstado, UsinaId } from "./state";

/* ------------------------------------------------------------------ */
/* Faixas de r (tabela em content/era1.ts)                            */
/* ------------------------------------------------------------------ */

export type { FaixaId, FaixaR } from "../content/era1";

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
  /** Oferta total: usinas da Rede + potência do Núcleo. */
  ofertaKw: number;
  ofertaUsinasKw: number;
  ofertaNucleoKw: number;
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

/** `potenciaNucleoKw` é a potência do Núcleo que entra na oferta (GDD §2.3). */
export function balancoRede(rede: RedeState, potenciaNucleoKw = 0): BalancoRede {
  const ofertaUsinasKw = potenciaOfertadaKw(rede);
  const ofertaKw = ofertaUsinasKw + Math.max(0, potenciaNucleoKw);
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
    ofertaUsinasKw,
    ofertaNucleoKw: Math.max(0, potenciaNucleoKw),
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
 * produção (usinas + Núcleo) → venda até a demanda → bateria (excedente/déficit) → receita com multiplicador de r.
 */
export function passoRede(rede: RedeState, dtMs: number, potenciaNucleoKw = 0): PassoRede {
  const dtS = dtMs / 1000;
  const balanco = balancoRede(rede, potenciaNucleoKw);
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
