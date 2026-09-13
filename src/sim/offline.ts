/**
 * Cálculo offline (GDD §7): balanço congelado do save vezes o tempo ausente.
 * Não roda ticks, não compra nada, nunca cascateia.
 */
import { OFFLINE } from "../content/era1";
import { MODO_SEGURO } from "../content/era1-nucleo";
import { faixaDeCalor, pesquisaPorSegundo, temperatura } from "./calor";
import { limitarEstabilidade } from "./estabilidade";
import { efeitosDe } from "./efeitos";
import { equilibrioMotor, motorDoNucleo, potenciaMotor } from "./motor";
import { avancarVaretasOffline } from "./reator";
import { analisar, derivarRede } from "./producao";
import { balancoRede } from "./rede";
import type { GameState } from "./state";

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

export function calcularOffline(state: GameState, agoraMs: number): { state: GameState; relatorio: RelatorioOffline } {
  const duracaoMs = janelaOfflineMs(state.salvoEmMs, agoraMs);
  const segundos = duracaoMs / 1000;

  let potenciaNucleo = 0;
  let pesquisaPorS = 0;
  let estabilidadePorS = 0;
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

    if (tEq >= MODO_SEGURO.limiarT) {
      // Modo seguro obrigatório: a configuração dispararia o SCRAM, então fica desligado o tempo todo.
      nucleoDesligado = true;
    } else {
      potenciaNucleo = potenciaMotor(motor, qEquilibrio) * OFFLINE.fatorNucleo;
      pesquisaPorS = pesquisaPorSegundo(potenciaNucleo, tEq, motor.pesquisaPorKw);
      if (potenciaNucleo > 0) estabilidadePorS = (faixaDeCalor(tEq).estabilidadePorMinuto / 60) * OFFLINE.fatorNucleo;
    }

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
      estabilidade: limitarEstabilidade(nucleo.estabilidade + estabilidadePorS * segundos),
    };
  }

  const balanco = balancoRede(derivarRede(state, analise), {
    potenciaNucleoKw: potenciaNucleo,
    efeitos,
    semBateria: true,
    ofertaUsinasKw: analise.ofertaKw,
    demandaKw: analise.demandaKw,
    tarifa: analise.tarifa,
    custoOperacaoPorSegundo: analise.custoOperacaoPorSegundo,
  });
  // Térmicas a gás também cobram combustível offline, com o mesmo fator da receita (GDD Parte 2 §5.2).
  const creditos = (balanco.receitaPorSegundo - balanco.custoPorSegundo) * OFFLINE.fatorRede * segundos;
  // Laboratórios e universidades rendem offline com o mesmo fator da Rede (decisão da Sessão 7).
  const pesquisa = (pesquisaPorS + analise.pesquisaPorSegundo * OFFLINE.fatorRede) * segundos;
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
