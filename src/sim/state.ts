/** Tipos do estado do jogo e estado inicial (GDD §3, §8.1, §8.3, §11). */
import { ECONOMIA } from "../content/era1";
import { defDaEra } from "../content/eras";

/** Eras implementadas (GDD §6, §8). */
export type Era = 1 | 2;

export type UsinaEra1Id = "cataVento" | "painelSolar" | "turbinaEolica";
export type UsinaEra2Id = "hidreletrica" | "termeletricaGas" | "usinaNuclear";
/**
 * Todas as usinas de todas as eras. A Rede guarda uma entrada por usina desde o
 * começo: as da Era 2 ficam em zero até a era chegar, e as da Era 1 continuam
 * na lista depois dela (GDD §8.5.1 — o custo inflacionado já as aposenta).
 */
export type UsinaId = UsinaEra1Id | UsinaEra2Id;
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
  /** Baterias da Era 1 (20 kWh, ±10 kW cada). */
  unidades: number;
  /** Bancos de baterias da Era 2 (2 000 kWh, ±1 000 kW cada). */
  bancos: number;
}

export interface RedeState {
  usinas: Record<UsinaId, UsinaEstado>;
  /** Vilas da Era 1 (+8 kW cada). */
  vilas: number;
  /** Cidades da Era 2 (+800 kW cada). */
  cidades: number;
  demandaBaseKw: number;
  bateria: BateriaEstado;
}

/* ------------------------------------------------------------------ */
/* Núcleo                                                             */
/* ------------------------------------------------------------------ */

/** Torre Solar (GDD §8.3). */
export type PecaEra1Id = "heliostato" | "turbina" | "radiador" | "tanque";
/** Reator PWR (GDD §8.5). */
export type PecaEra2Id = "vareta" | "geradorDeVapor" | "bomba" | "pressurizador";
export type PecaId = PecaEra1Id | PecaEra2Id;

/** Qual Núcleo a grade representa. Decide peças, constantes e nome do centro. */
export type NucleoTipo = "torreSolar" | "reatorPwr";

/**
 * Combustível de uma peça que queima (Vareta, GDD §8.5.4). Só as peças que
 * queimam carregam este campo; as da Era 1 não têm nada a mais.
 */
export interface EstadoCombustivel {
  /** Fração restante, de 1 (cheia) a 0 (gasta). */
  restante: number;
  /**
   * `tempoMs` em que a peça parou de fissionar — exaustão do combustível ou
   * início do SCRAM, o que vier primeiro. `null` enquanto está fissionando.
   * É a origem do relógio do calor de decaimento (GDD §8.5.5).
   */
  paradaEmMs: number | null;
}

/**
 * Uma casa da grade. `null` = vazia. O centro (`indiceReceptor(lado)`) é sempre a
 * peça central — Receptor na Era 1, Vaso na Era 2; o nome vem do conteúdo da era.
 */
export type Casa =
  | { tipo: "receptor" }
  | { tipo: "peca"; id: PecaId; combustivel?: EstadoCombustivel }
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
  /** Qual Núcleo é este: Torre Solar (Era 1) ou Reator PWR (Era 2). */
  tipo: NucleoTipo;
  /** Lado da grade: 5, ou 7 com a Grade 7×7 (a Era 2 nasce 7×7). */
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
  | { tipo: "cascata"; entradaUs: number; saidaUs: number }
  | { tipo: "eraAvancada"; era: Era };

export interface GameState {
  versao: number;
  tempoMs: number;
  creditos: number;
  /** Pesquisa acumulada (🔬). Desbloqueios comparam com este total; nada é gasto. */
  pesquisa: number;
  era: Era;
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
export const VERSAO_SAVE = 5;

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

export function gradeVazia(lado: number = defDaEra(1).nucleo.ladoInicial): Casa[] {
  const grade: Casa[] = new Array(lado * lado).fill(null);
  grade[indiceReceptor(lado)] = { tipo: "receptor" };
  return grade;
}

export function nucleoInicial(): NucleoState {
  return {
    tipo: "torreSolar",
    lado: defDaEra(1).nucleo.ladoInicial,
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
        hidreletrica: { quantidade: 0, nivel: 0 },
        termeletricaGas: { quantidade: 0, nivel: 0 },
        usinaNuclear: { quantidade: 0, nivel: 0 },
      },
      vilas: 0,
      cidades: 0,
      demandaBaseKw: defDaEra(1).demandaInicialKw,
      bateria: { kwh: 0, capacidadeKwh: 0, unidades: 0, bancos: 0 },
    },
    nucleo: null,
    melhorias: melhoriasIniciais(),
    salvoEmMs: 0,
    cardsVistos: [],
    eventos: [],
  };
}
