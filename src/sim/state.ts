/** Tipos do estado do jogo e estado inicial (GDD §3, §8.1, §8.3, §8.5, §11). */
import { ECONOMIA } from "../content/era1";
import { ILHAS_INICIAIS, type IlhaId, type TipoObstaculo } from "../content/era1-arquipelago";
import { NUCLEO } from "../content/era1-nucleo";
import { arquipelagoDaEra1 } from "./gerarArquipelago";

export type UsinaId = "cataVento" | "painelSolar" | "turbinaEolica";
export type MelhoriaId = "laminasDeFibra" | "rastreamentoSolar" | "grade7x7";
export type Melhorias = Record<MelhoriaId, boolean>;

/** Tudo o que o jogador coloca casa a casa no arquipélago (GDD §2.1, v0.6). */
export type TipoConstrucao = UsinaId | "vila" | "bateria" | "subestacao";

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

/**
 * Rede guardada no save. As **contagens são derivadas** das construções do mundo (GDD §2.1, v0.6):
 * aqui só ficam o nível de melhoria de cada usina e a carga da bateria.
 */
export interface RedeState {
  usinas: Record<UsinaId, { nivel: number }>;
  bateria: { kwh: number };
}

/** Forma derivada, com as contagens do mundo: é o que as fórmulas de §4.1 consomem. */
export interface RedeDerivada {
  usinas: Record<UsinaId, UsinaEstado>;
  vilas: number;
  bateria: BateriaEstado;
}

/* ------------------------------------------------------------------ */
/* Mundo (GDD §2.4, v0.6)                                             */
/* ------------------------------------------------------------------ */

export interface Construcao {
  tipo: TipoConstrucao;
  /** Nível da construção. Por enquanto só a subestação evolui (teto ×2ⁿ, custo ×3ⁿ). */
  nivel: number;
  colocadoEmMs: number;
}

/** Uma remoção de obstáculo na fila; só a primeira está em curso (um Bipe de manutenção de cada vez). */
export interface RemocaoEmCurso {
  indice: number;
  tipo: TipoObstaculo;
  /** `tempoMs` do jogo em que começou; 0 = ainda esperando a vez. */
  inicioMs: number;
  /** `tempoMs` do jogo em que termina; 0 = ainda esperando a vez. */
  fimMs: number;
}

export interface MundoState {
  /** Casa (`y·n + x`) → construção. */
  construcoes: Record<number, Construcao>;
  /** Casas cujo obstáculo de nascença já saiu. O que resta é o do mapa menos estas. */
  removidos: number[];
  /** Fila de remoção; a primeira está em curso. */
  remocoes: RemocaoEmCurso[];
  /** Casas de rocha com cristal, abertas por montanhas dinamitadas (GDD §8.6, §9). */
  cristais: number[];
  ilhasAbertas: IlhaId[];
  /** Ilhas ligadas à rede principal por cabo submarino → nível do cabo (0 = recém-ligado). */
  cabos: Partial<Record<IlhaId, number>>;
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
  | { tipo: "primeiraCompra"; item: PecaId | "bateria" | "subestacao" }
  | { tipo: "melhoriaComprada"; id: MelhoriaId }
  | { tipo: "cascata"; entradaUs: number; saidaUs: number }
  | { tipo: "ilhaAberta"; id: IlhaId }
  | { tipo: "nucleoDesbloqueado" }
  | { tipo: "obstaculoRemovido"; indice: number; cristal: boolean };

export interface GameState {
  versao: number;
  tempoMs: number;
  creditos: number;
  /** Pesquisa acumulada (🔬). Desbloqueios comparam com este total; nada é gasto (a árvore é a Sessão 7). */
  pesquisa: number;
  era: 1;
  rede: RedeState;
  mundo: MundoState;
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
export const VERSAO_SAVE = 7;

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

/** A ilha principal nasce com a aldeia e uma subestação ao lado (GDD §8.5). */
export function mundoInicial(): MundoState {
  const arq = arquipelagoDaEra1();
  const construcoes: Record<number, Construcao> = {};
  for (const i of arq.inicio.aldeia) construcoes[i] = { tipo: "vila", nivel: 0, colocadoEmMs: 0 };
  construcoes[arq.inicio.subestacao] = { tipo: "subestacao", nivel: 0, colocadoEmMs: 0 };
  return { construcoes, removidos: [], remocoes: [], cristais: [], ilhasAbertas: [...ILHAS_INICIAIS], cabos: {} };
}

export function estadoInicial(): GameState {
  return {
    versao: VERSAO_SAVE,
    tempoMs: 0,
    creditos: ECONOMIA.creditosIniciais,
    pesquisa: 0,
    era: 1,
    rede: {
      usinas: { cataVento: { nivel: 0 }, painelSolar: { nivel: 0 }, turbinaEolica: { nivel: 0 } },
      bateria: { kwh: 0 },
    },
    mundo: mundoInicial(),
    nucleo: null,
    melhorias: melhoriasIniciais(),
    salvoEmMs: 0,
    cardsVistos: [],
    eventos: [],
  };
}
