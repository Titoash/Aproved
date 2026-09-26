/**
 * Cálculo offline (GDD §7): balanço congelado do save vezes o tempo ausente.
 * Não roda ticks, não compra nada, nunca cascateia.
 *
 * Na Era 2 o balanço do Núcleo **não** fica congelado: as varetas esgotam durante a ausência (GDD
 * Parte 2 §5.2), então a ausência é integrada em trechos até a última vareta acabar e o decaimento
 * cair; só depois o Núcleo fica num estado só. Antes disso o reator rendia a janela inteira com
 * combustível para dez minutos (defeito achado na revisão da v0.9).
 */
import { OFFLINE } from "../content/era1";
import { MODO_SEGURO } from "../content/era1-nucleo";
import { faixaDeCalor, pesquisaPorSegundo, temperatura } from "./calor";
import { limitarEstabilidade } from "./estabilidade";
import { efeitosDe } from "./efeitos";
import { equilibrioMotor, motorDoNucleo, potenciaMotor } from "./motor";
import { VARETA } from "../content/era2-nucleo";
import { avancarVaretasOffline, fatorVidaVareta } from "./reator";
import type { EfeitosArvore } from "./efeitos";
import { analisar, derivarRede } from "./producao";
import { balancoRede } from "./rede";
import type { GameState, NucleoState } from "./state";

export interface RelatorioOffline {
  duracaoMs: number;
  creditos: number;
  pesquisa: number;
  /** Pontos de Estabilidade ganhos. */
  estabilidade: number;
  /** O Núcleo ficou desligado porque `T*` do equilíbrio passaria do limiar do modo seguro. */
  nucleoDesligado: boolean;
  /** `T*` do equilíbrio da grade salva (`null` sem Núcleo). */
  tEquilibrio: number | null;
}

/** `min(agora − salvoEmMs, 8 h)`; relógio para trás ou save sem carimbo contam como 0. */
export function janelaOfflineMs(salvoEmMs: number, agoraMs: number): number {
  if (!(salvoEmMs > 0) || !Number.isFinite(agoraMs)) return 0;
  return Math.min(OFFLINE.janelaMaxMs, Math.max(0, agoraMs - salvoEmMs));
}

/** Um trecho da ausência com o Núcleo num estado só. Os números já vêm com o fator do modo seguro. */
export interface TrechoNucleoOffline {
  segundos: number;
  potenciaKw: number;
  pesquisaPorS: number;
  estabilidadePorS: number;
}

/** Taxas do Núcleo no equilíbrio da grade, em modo seguro (GDD §7). O SCRAM em curso não conta. */
function taxasNoEquilibrio(nucleo: NucleoState, efeitos: EfeitosArvore, tempoMs: number): Omit<TrechoNucleoOffline, "segundos"> & { t: number } {
  const motor = motorDoNucleo({ ...nucleo, scramRestanteMs: 0, scramInicioMs: null }, efeitos, tempoMs);
  const q = equilibrioMotor(motor);
  const t = temperatura(q, motor.capacidadeU);
  const potenciaKw = potenciaMotor(motor, q) * OFFLINE.fatorNucleo;
  const pesquisaPorS = pesquisaPorSegundo(potenciaKw, t, motor.pesquisaPorKw);
  const estabilidadePorS = potenciaKw > 0 ? (faixaDeCalor(t).estabilidadePorMinuto / 60) * OFFLINE.fatorNucleo : 0;
  return { potenciaKw, pesquisaPorS, estabilidadePorS, t };
}

/**
 * Trechos do Núcleo durante `segundos` de ausência. Na Era 1 (e num reator sem vareta) é um trecho só.
 * Na Era 2 a ausência é integrada em passos de `OFFLINE.passoReatorS` até a última vareta esgotar e mais
 * `OFFLINE.caudaMeiasVidas` meias-vidas de decaimento; o resto da janela é um trecho só. Como as varetas
 * só esgotam e o decaimento só cai, `T` nunca sobe durante a ausência: quem começa abaixo do limiar do
 * modo seguro continua abaixo. Função pura.
 */
export function trechosDoNucleoOffline(nucleo: NucleoState, efeitos: EfeitosArvore, tempoInicialMs: number, segundos: number): TrechoNucleoOffline[] {
  const constante = (): TrechoNucleoOffline[] => {
    const { t: _t, ...taxas } = taxasNoEquilibrio(nucleo, efeitos, tempoInicialMs);
    return [{ segundos, ...taxas }];
  };
  if (segundos <= 0) return [];
  if (nucleo.era !== 2) return constante();

  let temVareta = false;
  let ultimaS = 0;
  nucleo.grade.forEach((casa, i) => {
    if (!casa || casa.tipo === "receptor" || casa.id !== "vareta" || !casa.vareta) return;
    temVareta = true;
    if (casa.tipo !== "peca" || casa.vareta.gastaDesdeMs !== null) return;
    ultimaS = Math.max(ultimaS, casa.vareta.restanteS * fatorVidaVareta(nucleo.grade, i, nucleo.lado, efeitos));
  });
  if (!temVareta) return constante();

  const horizonte = Math.min(segundos, ultimaS + OFFLINE.caudaMeiasVidas * VARETA.meiaVidaS);
  const trechos: TrechoNucleoOffline[] = [];
  const noInstante = (s: number, duracao: number) => {
    const grade = avancarVaretasOffline(nucleo, s, tempoInicialMs, efeitos);
    const { t: _t, ...taxas } = taxasNoEquilibrio({ ...nucleo, grade }, efeitos, tempoInicialMs + s * 1000);
    trechos.push({ segundos: duracao, ...taxas });
  };
  for (let s = 0; s < horizonte; s += OFFLINE.passoReatorS) {
    const duracao = Math.min(OFFLINE.passoReatorS, horizonte - s);
    noInstante(s + duracao / 2, duracao);
  }
  if (horizonte < segundos) noInstante(horizonte, segundos - horizonte);
  return trechos;
}

export function calcularOffline(state: GameState, agoraMs: number): { state: GameState; relatorio: RelatorioOffline } {
  const duracaoMs = janelaOfflineMs(state.salvoEmMs, agoraMs);
  const segundos = duracaoMs / 1000;

  let trechos: TrechoNucleoOffline[] = [];
  let nucleoDesligado = false;
  let tEquilibrio: number | null = null;
  let nucleo = state.nucleo;

  const efeitos = efeitosDe(state);
  const analise = analisar(state);

  if (nucleo) {
    // O motor é o da configuração salva rodando em modo seguro (GDD §7). O SCRAM que estivesse em
    // curso não conta: ele zera na volta, e o que interessa é o equilíbrio da grade.
    const motor = motorDoNucleo({ ...nucleo, scramRestanteMs: 0, scramInicioMs: null }, efeitos, state.tempoMs);
    const capacidade = motor.capacidadeU;
    const qEquilibrio = equilibrioMotor(motor);
    const tEq = temperatura(qEquilibrio, capacidade);
    tEquilibrio = tEq;

    // Modo seguro obrigatório: uma configuração que dispararia o SCRAM fica desligada o tempo todo.
    if (tEq >= MODO_SEGURO.limiarT) nucleoDesligado = true;
    else trechos = trechosDoNucleoOffline(nucleo, efeitos, state.tempoMs, segundos);

    const estabilidadeGanha = trechos.reduce((soma, tr) => soma + tr.estabilidadePorS * tr.segundos, 0);
    const limiteQ = capacidade * MODO_SEGURO.limiarT;
    const qVolta = Number.isFinite(qEquilibrio) ? Math.min(qEquilibrio, limiteQ) : limiteQ;
    // O tempo passa no combustível mesmo com o jogo fechado (GDD Parte 2 §5.2): uma vareta que
    // acabaria no meio da ausência é marcada como gasta no instante exato em que acabou.
    const grade = nucleo.era === 2 && !nucleoDesligado ? avancarVaretasOffline(nucleo, segundos, state.tempoMs, efeitos) : nucleo.grade;
    nucleo = {
      ...nucleo,
      grade,
      calorU: qVolta,
      tempoAcimaDoLimiteMs: 0,
      scramRestanteMs: 0,
      scramInicioMs: null,
      estabilidade: limitarEstabilidade(nucleo.estabilidade + estabilidadeGanha),
    };
  }
  if (trechos.length === 0 && segundos > 0) trechos = [{ segundos, potenciaKw: 0, pesquisaPorS: 0, estabilidadePorS: 0 }];

  const rede = derivarRede(state, analise);
  let creditos = 0;
  let pesquisa = 0;
  for (const tr of trechos) {
    const balanco = balancoRede(rede, {
      potenciaNucleoKw: tr.potenciaKw,
      efeitos,
      semBateria: true,
      ofertaUsinasKw: analise.ofertaKw,
      demandaKw: analise.demandaKw,
      tarifa: analise.tarifa,
      custoOperacaoPorSegundo: analise.custoOperacaoPorSegundo,
    });
    // Térmicas a gás também cobram combustível offline, com o mesmo fator da receita (GDD Parte 2 §5.2).
    creditos += (balanco.receitaPorSegundo - balanco.custoPorSegundo) * OFFLINE.fatorRede * tr.segundos;
    // Laboratórios e universidades rendem offline com o mesmo fator da Rede (decisão da Sessão 7).
    pesquisa += (tr.pesquisaPorS + analise.pesquisaPorSegundo * OFFLINE.fatorRede) * tr.segundos;
  }
  const estabilidade = nucleo && state.nucleo ? nucleo.estabilidade - state.nucleo.estabilidade : 0;

  return {
    state: {
      ...state,
      tempoMs: state.tempoMs + duracaoMs,
      creditos: state.creditos + creditos,
      pesquisa: state.pesquisa + pesquisa,
      nucleo,
    },
    relatorio: { duracaoMs, creditos, pesquisa, estabilidade, nucleoDesligado, tEquilibrio },
  };
}
