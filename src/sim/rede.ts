/**
 * Balança da Rede (GDD §4.1): potência ofertada, demanda, razão `r`,
 * multiplicador de preço por faixa, bateria e receita.
 */
import { BATERIA, ECONOMIA, VILA } from "../content/era1";
import { BANCO_DE_BATERIAS, CIDADE } from "../content/era2";
import { FAIXAS_R, type FaixaR } from "../content/regras";
import { defDaEra, USINAS_TODAS } from "../content/eras";
import { fatorMelhoria } from "./custos";
import { fatorPotenciaUsina } from "./melhorias";
import { TICK_MS } from "./tempo";
import type { BateriaEstado, Era, Melhorias, RedeState, UsinaEstado, UsinaId } from "./state";

/* ------------------------------------------------------------------ */
/* Faixas de r (tabela em content/regras.ts)                          */
/* ------------------------------------------------------------------ */

export type { FaixaId, FaixaR } from "../content/regras";

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

export function potenciaUsina(id: UsinaId, estado: UsinaEstado, melhorias?: Melhorias): number {
  return USINAS_TODAS[id].potenciaKw * estado.quantidade * fatorMelhoria(estado.nivel) * fatorPotenciaUsina(melhorias, id);
}

export function potenciaOfertadaKw(rede: RedeState, melhorias?: Melhorias): number {
  let total = 0;
  for (const id of Object.keys(rede.usinas) as UsinaId[]) {
    total += potenciaUsina(id, rede.usinas[id], melhorias);
  }
  return total;
}

export function demandaKw(rede: RedeState): number {
  return rede.demandaBaseKw + rede.vilas * VILA.demandaKw + rede.cidades * CIDADE.demandaKw;
}

export function razaoOfertaDemanda(ofertaKw: number, demanda: number): number {
  if (demanda <= 0) return ofertaKw > 0 ? Infinity : 1;
  return ofertaKw / demanda;
}

/** Capacidade total: baterias da Era 1 mais bancos da Era 2. */
export function capacidadeBateriaKwh(unidades: number, bancos = 0): number {
  return unidades * BATERIA.capacidadeKwh + bancos * BANCO_DE_BATERIAS.capacidadeKwh;
}

/** Potência máxima de carga ou descarga, em kW: ±10 kW por unidade (GDD §4.1). */
export function potenciaBateriaKw(bateria: BateriaEstado): number {
  return bateria.unidades * BATERIA.potenciaKw + bateria.bancos * BANCO_DE_BATERIAS.potenciaKw;
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

/** kW que a bateria consegue cobrir de um déficit em `dtS`: limitado pela potência e pela energia guardada. */
export function cobrivelKw(bateria: BateriaEstado, deficitKw: number, dtS: number): number {
  if (deficitKw <= 0 || dtS <= 0) return 0;
  const porEnergia = bateria.kwh / (ECONOMIA.kwhPorKwSegundo * dtS);
  return Math.max(0, Math.min(deficitKw, potenciaBateriaKw(bateria), porEnergia));
}

/** kW de excedente que a bateria consegue absorver em `dtS`: limitado pela potência e pelo espaço. */
export function absorvivelKw(bateria: BateriaEstado, excedenteKw: number, dtS: number): number {
  if (excedenteKw <= 0 || dtS <= 0) return 0;
  const espaco = Math.max(0, bateria.capacidadeKwh - bateria.kwh);
  const porEspaco = espaco / (ECONOMIA.kwhPorKwSegundo * dtS);
  return Math.max(0, Math.min(excedenteKw, potenciaBateriaKw(bateria), porEspaco));
}

/**
 * Carrega com o excedente e descarrega no déficit, respeitando capacidade e potência.
 * `dtS` é o intervalo em segundos reais.
 */
export function atualizarBateria(
  bateria: BateriaEstado,
  excedenteKw: number,
  deficitKw: number,
  dtS: number,
): ResultadoBateria {
  const carregadoKwh = energiaBateriaKwh(absorvivelKw(bateria, excedenteKw, dtS), dtS);
  const descarregadoKwh = energiaBateriaKwh(cobrivelKw(bateria, deficitKw, dtS), dtS);
  const kwh = Math.max(0, Math.min(bateria.capacidadeKwh, bateria.kwh + carregadoKwh - descarregadoKwh));
  return {
    bateria: { ...bateria, kwh },
    carregadoKwh,
    descarregadoKwh,
  };
}

/* ------------------------------------------------------------------ */
/* Balanço e passo da rede                                            */
/* ------------------------------------------------------------------ */

export interface OpcoesBalanco {
  /** Potência do Núcleo que entra na oferta (GDD §2.3). */
  potenciaNucleoKw?: number;
  /** Intervalo do tick, em s: limita o que a bateria cobre/absorve por energia. */
  dtS?: number;
  melhorias?: Melhorias;
  /** Offline (GDD §7): a bateria nem carrega nem descarrega. */
  semBateria?: boolean;
  /** Era corrente: decide o preço da energia (GDD §7). Sem ela, Era 1. */
  era?: Era;
}

export interface BalancoRede {
  /** Oferta total: usinas da Rede + potência do Núcleo. */
  ofertaKw: number;
  ofertaUsinasKw: number;
  ofertaNucleoKw: number;
  demandaKw: number;
  /** r bruto = oferta ÷ demanda, sem a bateria. */
  r: number;
  rBruto: number;
  faixaBruta: FaixaR;
  /** Faixa efetiva: a bateria transforma falha em neutro, nunca em ouro (GDD §4.1). */
  faixa: FaixaR;
  multiplicador: number;
  /** Parte da oferta vendida diretamente (até a demanda). */
  vendaDiretaKw: number;
  excedenteKw: number;
  deficitKw: number;
  /** Déficit que a bateria cobre neste tick. */
  cobertoKw: number;
  /** Excedente que a bateria absorve neste tick. */
  absorvidoKw: number;
  /** Fluxo instantâneo da bateria: > 0 carregando, < 0 descarregando. */
  fluxoBateriaKw: number;
  /** Por que a faixa efetiva difere da bruta, quando difere. */
  motivoBateria: "cobrindo" | "absorvendo" | null;
  /** Estimativa de receita por segundo real no estado atual. */
  receitaPorSegundo: number;
}

/** Tick padrão para o limite de energia da bateria, quando o chamador não informa. */
const DT_PADRAO_S = TICK_MS / 1000;
const EPSILON_KW = 1e-9;

export function balancoRede(rede: RedeState, opcoes: OpcoesBalanco = {}): BalancoRede {
  const potenciaNucleoKw = Math.max(0, opcoes.potenciaNucleoKw ?? 0);
  const dtS = opcoes.dtS ?? DT_PADRAO_S;
  const ofertaUsinasKw = potenciaOfertadaKw(rede, opcoes.melhorias);
  const ofertaKw = ofertaUsinasKw + potenciaNucleoKw;
  const demanda = demandaKw(rede);
  const rBruto = razaoOfertaDemanda(ofertaKw, demanda);
  const faixaBruta = faixaDeR(rBruto);
  const vendaDiretaKw = Math.min(ofertaKw, demanda);
  const excedenteKw = ofertaKw - vendaDiretaKw;
  const deficitKw = demanda - vendaDiretaKw;

  const cobertoKw = opcoes.semBateria ? 0 : cobrivelKw(rede.bateria, deficitKw, dtS);
  const absorvidoKw = opcoes.semBateria ? 0 : absorvivelKw(rede.bateria, excedenteKw, dtS);

  // Faixa efetiva (GDD §4.1): ouro fica ouro; falha vira neutro se a bateria segura tudo.
  let faixa = faixaBruta;
  let motivoBateria: BalancoRede["motivoBateria"] = null;
  if (faixaBruta.id !== "zonaDeOuro") {
    if (deficitKw > EPSILON_KW && cobertoKw >= deficitKw - EPSILON_KW && faixaBruta.id === "apagao") {
      faixa = faixaDeR(0.8);
      motivoBateria = "cobrindo";
    } else if (excedenteKw > EPSILON_KW && absorvidoKw >= excedenteKw - EPSILON_KW && faixaBruta.id === "saturacao") {
      faixa = faixaDeR(1.25);
      motivoBateria = "absorvendo";
    }
  }

  const vendidoKw = vendaDiretaKw + cobertoKw;
  // Receita/s = potência vendida (kW) × preço (₵ por kW·s) × multiplicador da balança (GDD §7).
  const receitaPorSegundo = vendidoKw * defDaEra(opcoes.era ?? 1).precoBase * faixa.multiplicador;

  return {
    ofertaKw,
    ofertaUsinasKw,
    ofertaNucleoKw: potenciaNucleoKw,
    demandaKw: demanda,
    r: rBruto,
    rBruto,
    faixaBruta,
    faixa,
    multiplicador: faixa.multiplicador,
    vendaDiretaKw,
    excedenteKw,
    deficitKw,
    cobertoKw,
    absorvidoKw,
    fluxoBateriaKw: absorvidoKw - cobertoKw,
    motivoBateria,
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
export function passoRede(rede: RedeState, dtMs: number, opcoes: Omit<OpcoesBalanco, "dtS"> = {}): PassoRede {
  const dtS = dtMs / 1000;
  const balanco = balancoRede(rede, { ...opcoes, dtS });
  const bat = opcoes.semBateria
    ? { bateria: rede.bateria, carregadoKwh: 0, descarregadoKwh: 0 }
    : atualizarBateria(rede.bateria, balanco.excedenteKw, balanco.deficitKw, dtS);
  const vendidoKwS = balanco.vendaDiretaKw * dtS + bat.descarregadoKwh / ECONOMIA.kwhPorKwSegundo;
  const receita = vendidoKwS * defDaEra(opcoes.era ?? 1).precoBase * balanco.multiplicador;
  return {
    rede: { ...rede, bateria: bat.bateria },
    balanco,
    vendidoKwS,
    carregadoKwh: bat.carregadoKwh,
    descarregadoKwh: bat.descarregadoKwh,
    receita,
  };
}
