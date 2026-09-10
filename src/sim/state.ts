/** Tipos do estado do jogo e estado inicial (GDD §3, §8.1, §8.3, §11). */
import { ECONOMIA } from "../content/era1";
import { NUCLEO } from "../content/era1-nucleo";

export type UsinaId = "cataVento" | "painelSolar" | "turbinaEolica";
export type MelhoriaId = "laminasDeFibra" | "rastreamentoSolar" | "grade7x7";
export type Melhorias = Record<MelhoriaId, boolean>;

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

/** Uma casa da grade. `null` = vazia. O centro (`indiceReceptor(lado)`) é sempre o Receptor. */
export type Casa =
  | { tipo: "receptor" }
  | { tipo: "peca"; id: PecaId }
  | { tipo: "entulho"; id: PecaId; desdeMs: number }
  | null;

/** Fluxos de calor no tick da última Cascata, para o card explicativo (GDD §5). */
export interface UltimaCascata {
  tempoMs: number;
  /** Calor entrando dos espelhos, em u/s. */
  entradaUs: number;
  /** Dissipação dos radiadores + consumo das turbinas, em u/s. */
  saidaUs: number;
}

export interface NucleoState {
  /** Lado da grade: 5, ou 7 com a Grade 7×7. */
  lado: number;
  /** `lado × lado` casas, linha a linha. */
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
  ultimaCascata: UltimaCascata | null;
}

/** Eventos de um tick ou de uma ação, para a UI reagir (cards). Limpos a cada tick; não vão para o save. */
export type EventoJogo =
  | { tipo: "primeiroCarregamento" }
  | { tipo: "primeiraCompra"; item: PecaId | "bateria" }
  | { tipo: "melhoriaComprada"; id: MelhoriaId }
  | { tipo: "cascata"; entradaUs: number; saidaUs: number };

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
  /** Melhorias nomeadas compradas (GDD §8.2, §8.3). */
  melhorias: Melhorias;
  /** `Date.now()` do último save; 0 = nunca salvo. Base do cálculo offline (GDD §7). */
  salvoEmMs: number;
  /** Ids dos cards explicativos já mostrados. */
  cardsVistos: string[];
  /** Fila de eventos do tick/ação corrente (não persiste). */
  eventos: EventoJogo[];
}

/** Versão do formato de save. Incrementar ao mudar a forma do estado. */
export const VERSAO_SAVE = 4;

export function melhoriasIniciais(): Melhorias {
  return { laminasDeFibra: false, rastreamentoSolar: false, grade7x7: false };
}

/** Índice do Receptor: o centro de uma grade `lado × lado` (lado ímpar). */
export function indiceReceptor(lado: number): number {
  return (lado * lado - 1) / 2;
}

/** Lado de uma grade a partir do número de casas. */
export function ladoDaGrade(grade: readonly unknown[]): number {
  return Math.round(Math.sqrt(grade.length));
}

export function gradeVazia(lado: number = NUCLEO.ladoInicial): Casa[] {
  const grade: Casa[] = new Array(lado * lado).fill(null);
  grade[indiceReceptor(lado)] = { tipo: "receptor" };
  return grade;
}

export function nucleoInicial(): NucleoState {
  return {
    lado: NUCLEO.ladoInicial,
    grade: gradeVazia(),
    calorU: 0,
    tempoAcimaDoLimiteMs: 0,
    scramRestanteMs: 0,
    estabilidade: 0,
    modoSeguro: false,
    receptorCeramico: false,
    cascatas: 0,
    ultimaCascataMs: null,
    ultimaCascata: null,
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
    melhorias: melhoriasIniciais(),
    salvoEmMs: 0,
    cardsVistos: [],
    eventos: [],
  };
}
