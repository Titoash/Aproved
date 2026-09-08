/** Tipos do estado do jogo e estado inicial (GDD §3, §8.1, §8.3, §11). */
import { ECONOMIA } from "../content/era1";
import { NUCLEO } from "../content/era1-nucleo";

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

/* ------------------------------------------------------------------ */
/* Núcleo                                                             */
/* ------------------------------------------------------------------ */

export type PecaId = "heliostato" | "turbina" | "radiador" | "tanque";

/** Uma casa da grade. `null` = vazia. O índice 12 é sempre o Receptor. */
export type Casa =
  | { tipo: "receptor" }
  | { tipo: "peca"; id: PecaId }
  | { tipo: "entulho"; id: PecaId; desdeMs: number }
  | null;

export interface NucleoState {
  /** 25 casas, linha a linha. */
  grade: Casa[];
  /** Calor armazenado no Receptor, Q, em u. Pode passar da capacidade. */
  calorU: number;
  /** Cronômetro contínuo com T > 100 %, em ms. Zera ao voltar a ≤ 100 %. */
  tempoAcimaDoLimiteMs: number;
  /** SCRAM em andamento enquanto > 0. */
  scramRestanteMs: number;
  /** 0–100 %. */
  estabilidade: number;
  modoSeguro: boolean;
  receptorCeramico: boolean;
  cascatas: number;
  /** `tempoMs` da última Cascata, para a cena disparar a onda de choque. */
  ultimaCascataMs: number | null;
}

export interface GameState {
  versao: number;
  tempoMs: number;
  creditos: number;
  /** Pesquisa acumulada (🔬). Desbloqueios comparam com este total; nada é gasto. */
  pesquisa: number;
  era: 1;
  rede: RedeState;
  /** `null` enquanto o Núcleo não foi desbloqueado. */
  nucleo: NucleoState | null;
}

/** Versão do formato de save. Incrementar ao mudar a forma do estado. */
export const VERSAO_SAVE = 2;

export function gradeVazia(): Casa[] {
  const grade: Casa[] = new Array(NUCLEO.lado * NUCLEO.lado).fill(null);
  grade[NUCLEO.indiceReceptor] = { tipo: "receptor" };
  return grade;
}

export function nucleoInicial(): NucleoState {
  return {
    grade: gradeVazia(),
    calorU: 0,
    tempoAcimaDoLimiteMs: 0,
    scramRestanteMs: 0,
    estabilidade: 0,
    modoSeguro: false,
    receptorCeramico: false,
    cascatas: 0,
    ultimaCascataMs: null,
  };
}

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
