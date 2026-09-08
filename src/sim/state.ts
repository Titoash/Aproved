/** Tipos do estado do jogo e estado inicial (GDD §3, §8.1, §11). */
import { ECONOMIA } from "../content/era1";

export type UsinaId = "cataVento" | "painelSolar" | "turbinaEolica";

export interface UsinaEstado {
  quantidade: number;
  nivel: number;
}

export interface BateriaEstado {
  /** Carga atual, em kWh. */
  kwh: number;
  capacidadeKwh: number;
  unidades: number;
}

export interface RedeState {
  usinas: Record<UsinaId, UsinaEstado>;
  vilas: number;
  demandaBaseKw: number;
  bateria: BateriaEstado;
}

export interface GameState {
  versao: number;
  tempoMs: number;
  creditos: number;
  pesquisa: number;
  era: 1;
  rede: RedeState;
  /** Núcleo (grade) chega na Sessão 2. */
  nucleo: null;
}

/** Versão do formato de save. Incrementar ao mudar a forma do estado. */
export const VERSAO_SAVE = 1;

export function estadoInicial(): GameState {
  return {
    versao: VERSAO_SAVE,
    tempoMs: 0,
    creditos: ECONOMIA.creditosIniciais,
    pesquisa: 0,
    era: 1,
    rede: {
      usinas: {
        cataVento: { quantidade: 0, nivel: 0 },
        painelSolar: { quantidade: 0, nivel: 0 },
        turbinaEolica: { quantidade: 0, nivel: 0 },
      },
      vilas: 0,
      demandaBaseKw: ECONOMIA.demandaInicialKw,
      bateria: { kwh: 0, capacidadeKwh: 0, unidades: 0 },
    },
    nucleo: null,
  };
}
