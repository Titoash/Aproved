/**
 * Transição de era (GDD §6, §8.4, §8.5.1). Funções puras.
 *
 * O portão pede as três coisas juntas: Estabilidade cheia, pesquisa acumulada e
 * créditos. Passar de era não gasta a pesquisa (🔬 é requisito, nunca custo),
 * mas gasta os créditos.
 */
import { defDaEra, proximaEra } from "../content/eras";
import { TRANSICAO_ERA2 } from "../content/era2";
import { gradeVazia, type Era, type GameState, type NucleoState } from "./state";

export interface RequisitosEra {
  estabilidade: number;
  pesquisa: number;
  creditos: number;
}

/** Requisitos para sair da era informada. `null` quando não há era seguinte. */
export function requisitosParaAvancar(era: Era): RequisitosEra | null {
  return proximaEra(era) === null ? null : TRANSICAO_ERA2;
}

/** O que ainda falta para o portão abrir, para a UI mostrar em vez de só desabilitar. */
export interface FaltaParaAvancar {
  estabilidade: number;
  pesquisa: number;
  creditos: number;
}

export function faltaParaAvancar(state: GameState): FaltaParaAvancar | null {
  const req = requisitosParaAvancar(state.era);
  if (!req) return null;
  return {
    estabilidade: Math.max(0, req.estabilidade - (state.nucleo?.estabilidade ?? 0)),
    pesquisa: Math.max(0, req.pesquisa - state.pesquisa),
    creditos: Math.max(0, req.creditos - state.creditos),
  };
}

export function podeAvancarEra(state: GameState): boolean {
  const falta = faltaParaAvancar(state);
  return !!falta && falta.estabilidade === 0 && falta.pesquisa === 0 && falta.creditos === 0;
}

/**
 * Entra na era seguinte (GDD §8.5.1).
 *
 * Atravessam: ₵ (menos o custo), 🔬, usinas, vilas, baterias, melhorias e
 * `cardsVistos`. Zeram: o Núcleo inteiro — a Torre Solar é substituída pelo
 * Reator, peças e entulho somem —, a Estabilidade, o calor, o SCRAM e o
 * cronômetro da Cascata.
 *
 * A demanda base soma a demanda inaugural da era nova. Sem esse salto, `r`
 * explodiria no instante da troca e o jogador cairia em saturação sem ter feito
 * nada — seria punido por progredir.
 */
export function avancarEra(state: GameState): GameState | null {
  const seguinte = proximaEra(state.era);
  const req = requisitosParaAvancar(state.era);
  if (seguinte === null || !req || !podeAvancarEra(state)) return null;

  const def = defDaEra(seguinte);
  const nucleo: NucleoState = {
    tipo: def.nucleo.tipo,
    lado: def.nucleo.ladoInicial,
    grade: gradeVazia(def.nucleo.ladoInicial),
    calorU: 0,
    tempoAcimaDoLimiteMs: 0,
    scramRestanteMs: 0,
    estabilidade: 0,
    // O modo seguro é preferência do jogador: atravessa.
    modoSeguro: state.nucleo?.modoSeguro ?? false,
    // O Receptor cerâmico era uma peça da Torre Solar; não vem junto.
    receptorCeramico: false,
    cascatas: state.nucleo?.cascatas ?? 0,
    ultimaCascataMs: null,
    ultimaCascata: null,
  };

  return {
    ...state,
    era: seguinte,
    creditos: state.creditos - req.creditos,
    rede: { ...state.rede, demandaBaseKw: state.rede.demandaBaseKw + def.demandaInicialKw },
    nucleo,
    eventos: [...state.eventos, { tipo: "eraAvancada", era: seguinte }],
  };
}
