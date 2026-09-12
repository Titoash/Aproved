/**
 * Cálculo offline (GDD §7): balanço congelado do save vezes o tempo ausente.
 * Não roda ticks, não compra nada, nunca cascateia.
 */
import { MODO_SEGURO, OFFLINE } from "../content/regras";
import { defDoNucleo } from "../content/eras";
import { faixaDeCalor, pesquisaPorSegundo, temperatura } from "./calor";
import { limitarEstabilidade } from "./estabilidade";
import { calorPorEspelho } from "./melhorias";
import { capacidadeU, equilibrioU, potenciaNucleoKw } from "./nucleo";
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

  if (nucleo) {
    const def = defDoNucleo(nucleo);
    const calorEspelho = nucleo.tipo === "torreSolar" ? calorPorEspelho(state.melhorias) : undefined;
    const capacidade = capacidadeU(nucleo.grade, nucleo.receptorCeramico, def);
    // T* já com o decaimento das peças gastas no instante do save (GDD §8.5.7).
    const qEquilibrio = equilibrioU(nucleo.grade, calorEspelho, state.tempoMs, def);
    const tEq = temperatura(qEquilibrio, capacidade);
    tEquilibrio = tEq;

    if (tEq >= MODO_SEGURO.limiarT) {
      // Modo seguro obrigatório: a configuração dispararia o SCRAM, então fica desligado o tempo todo.
      nucleoDesligado = true;
    } else {
      potenciaNucleo = potenciaNucleoKw(nucleo.grade, qEquilibrio, def) * OFFLINE.fatorNucleo;
      pesquisaPorS = pesquisaPorSegundo(potenciaNucleo, tEq, def);
      if (potenciaNucleo > 0) estabilidadePorS = (faixaDeCalor(tEq).estabilidadePorMinuto / 60) * OFFLINE.fatorNucleo;
    }

    const limiteQ = capacidade * MODO_SEGURO.limiarT;
    const qVolta = Number.isFinite(qEquilibrio) ? Math.min(qEquilibrio, limiteQ) : limiteQ;
    nucleo = {
      ...nucleo,
      calorU: qVolta,
      tempoAcimaDoLimiteMs: 0,
      scramRestanteMs: 0,
      estabilidade: limitarEstabilidade(nucleo.estabilidade + estabilidadePorS * segundos),
    };
  }

  const balanco = balancoRede(state.rede, {
    potenciaNucleoKw: potenciaNucleo,
    melhorias: state.melhorias,
    semBateria: true,
    era: state.era,
  });
  const creditos = balanco.receitaPorSegundo * OFFLINE.fatorRede * segundos;
  const pesquisa = pesquisaPorS * segundos;
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
