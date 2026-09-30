/** Tipos do estado do jogo e estado inicial (GDD §3, §8.1, §8.3, §8.5, §11). */
import { NOS_INICIAIS } from "../content/arvore";
import { ECONOMIA } from "../content/era1";
import { ILHAS_INICIAIS, type IlhaId, type TipoObstaculo } from "../content/era1-arquipelago";
import { NUCLEO } from "../content/era1-nucleo";
import type { TipoCiencia } from "../content/melhorias";
import { OCORRENCIAS, type OcorrenciaId } from "../content/ocorrencias";
import type { Densidade } from "../content/cidade-tipos";
import { arquipelagoDaEra1 } from "./gerarArquipelago";

export type UsinaEra1Id = "cataVento" | "painelSolar" | "turbinaEolica";
/** Usinas da Era 2 (GDD Parte 2 §3.1). A eólica offshore vai no mar raso; as outras duas ocupam 2×2. */
export type UsinaEra2Id = "eolicaOffshore" | "fazendaSolar" | "termicaGas";
export type UsinaId = UsinaEra1Id | UsinaEra2Id;

/** Tudo o que o jogador coloca casa a casa no arquipélago (GDD §2.1, v0.6; Parte 2 §3.2 e §4.2). */
export type TipoConstrucao =
  | UsinaId
  | "bairro"
  | "bateria"
  | "subestacao"
  | "laboratorio"
  | "universidade"
  | "subestacao138"
  | "subestacaoOffshore"
  | "bateriaRede"
  | "distritoIndustrial"
  | "institutoPesquisa";

export interface UsinaEstado {
  quantidade: number;
  nivel: number;
}

export interface BateriaEstado {
  /** Carga atual, em kWh. */
  kwh: number;
  capacidadeKwh: number;
  /** Unidades de bateria somadas (Era 1 + bateria de rede). */
  unidades: number;
  /** Potência máxima de carga/descarga, em kW (GDD §4.1; a bateria de rede soma ±1 000 kW). */
  potenciaKw: number;
}

/**
 * Rede guardada no save. As **contagens são derivadas** das construções do mundo (GDD §2.1, v0.6) e os
 * níveis das usinas moram em `melhorias` (v0.8): aqui só fica a carga da bateria.
 */
export interface RedeState {
  bateria: { kwh: number };
}

/** Os três tipos de subestação (GDD §8.5 e Parte 2 §3.2). */
export type TipoSubestacao = "subestacao" | "subestacao138" | "subestacaoOffshore";

/**
 * Melhorias incrementais **por tipo** (GDD Parte 1 §7.1, v0.8): um nível por tipo, nunca por unidade.
 * Os números (custos, efeitos, máximos) estão em `content/melhorias.ts`; as ações, em `sim/melhorias.ts`.
 * Sempre substituída por um objeto novo, nunca mutada: os caches de `efeitosDe` e `analisar` dependem disso.
 */
export interface MelhoriasState {
  /** Produção +50 % por nível. */
  usinas: Record<UsinaId, number>;
  /** +10 % na grandeza da peça (calor, kW por u, dissipação, capacidade). A Barra de controle fica em 0. */
  pecas: Record<PecaId, number>;
  /** Teto ×2 por nível, para todas as subestações do tipo. */
  subestacoes: Record<TipoSubestacao, number>;
  /** Teto ×2 por nível, para todos os cabos submarinos. */
  cabos: number;
  /** 🔬 +25 % por nível (v0.9). */
  ciencia: Record<TipoCiencia, number>;
  /** Equipe de manutenção: um Bipe a mais por nível (§8.5, v0.8). */
  equipe: number;
}

/** Forma derivada, com as contagens do mundo: é o que as fórmulas de §4.1 consomem. */
export interface RedeDerivada {
  usinas: Record<UsinaId, UsinaEstado>;
  bairros: number;
  bateria: BateriaEstado;
}

/* ------------------------------------------------------------------ */
/* Mundo (GDD §2.4, v0.6)                                             */
/* ------------------------------------------------------------------ */

export interface Construcao {
  tipo: TipoConstrucao;
  /**
   * Sempre 0 desde o save v9: os níveis são por tipo (`melhorias`) e a densidade é da cidade (`cidade`),
   * v0.8. O campo fica para não reescrever a colocação, a migração v5 → v6 e a cena.
   */
  nivel: number;
  colocadoEmMs: number;
}

/**
 * Uma remoção de obstáculo na fila. Cada Bipe livre pega a próxima que espera (§8.5, v0.8); as que têm
 * `fimMs > 0` estão em curso, uma por Bipe.
 */
export interface RemocaoEmCurso {
  indice: number;
  tipo: TipoObstaculo;
  /** `tempoMs` do jogo em que começou; 0 = ainda esperando a vez. */
  inicioMs: number;
  /** `tempoMs` do jogo em que termina; 0 = ainda esperando a vez. */
  fimMs: number;
  /** Qual Bipe trabalha nela (0, 1, …); só nas em curso. A cena usa para saber quem anda até onde. */
  bipe?: number;
}

export interface MundoState {
  /** Casa (`y·n + x`) → construção. */
  construcoes: Record<number, Construcao>;
  /** Casas cujo obstáculo de nascença já saiu. O que resta é o do mapa menos estas. */
  removidos: number[];
  /** Fila de remoção, em ordem de chegada; as com `fimMs > 0` estão em curso. */
  remocoes: RemocaoEmCurso[];
  /** Casas de rocha com cristal, abertas por montanhas dinamitadas (GDD §8.6, §9). */
  cristais: number[];
  ilhasAbertas: IlhaId[];
  /** Ilhas ligadas à rede principal por cabo submarino. O valor é sempre 0: o nível é global (v0.8). */
  cabos: Partial<Record<IlhaId, number>>;
}

/* ------------------------------------------------------------------ */
/* Núcleo                                                             */
/* ------------------------------------------------------------------ */

/** Peças da Torre Solar (Era 1, GDD §8.3). */
export type PecaEra1Id = "heliostato" | "turbina" | "radiador" | "tanque";
/** Peças do Reator PWR (Era 2, GDD Parte 2 §5.1). */
export type PecaEra2Id = "vareta" | "barraControle" | "turbinaAlta" | "torreResfriamento" | "piscina";
export type PecaId = PecaEra1Id | PecaEra2Id;

/** Combustível de uma vareta (GDD Parte 2 §5.2). Só varetas têm. */
export interface VaretaEstado {
  /** Segundos de combustível que restam, na régua nominal (600 s). Consome só com o reator ligado. */
  restanteS: number;
  /** `tempoMs` em que esgotou; `null` enquanto ainda há combustível. Base do calor de decaimento. */
  gastaDesdeMs: number | null;
}

/**
 * Uma casa da grade. `null` = vazia. O centro (`indiceReceptor(lado)`) é sempre a peça fixa da era:
 * o Receptor na Era 1, o Vaso de pressão na Era 2 (mesmo marcador, arte e números por era).
 */
export type Casa =
  | { tipo: "receptor" }
  | { tipo: "peca"; id: PecaId; vareta?: VaretaEstado }
  | { tipo: "entulho"; id: PecaId; desdeMs: number; vareta?: VaretaEstado }
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
  /** Era do Núcleo: 1 = Torre Solar, 2 = Reator PWR. Espelha `GameState.era` (escritas juntas). */
  era: 1 | 2;
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
  /** `tempoMs` do começo do SCRAM em curso; `null` fora dele. Na Era 2 as varetas decaem a partir daqui. */
  scramInicioMs: number | null;
  /** Trocas de vareta feitas com o calor na zona de ouro (capítulo "Troca escalonada" da Era 2). */
  trocasEmFaixa: number;
  /** 0–100 %. */
  estabilidade: number;
  modoSeguro: boolean;
  receptorCeramico: boolean;
  cascatas: number;
  /** `tempoMs` da última Cascata, para a cena disparar a onda de choque. */
  ultimaCascataMs: number | null;
  ultimaCascata: UltimaCascata | null;
}

/* ------------------------------------------------------------------ */
/* Ocorrências (GDD Parte 1 §4.4 e Parte 2 §5.4, v0.9)                  */
/* ------------------------------------------------------------------ */

/** Oferta ou Ocorrência em curso. Uma por vez. */
export interface OcorrenciaEmCurso {
  id: OcorrenciaId;
  /** "oferta": esperando o aceite (60 s); "ativa": o jogador opera o controle. */
  fase: "oferta" | "ativa";
  /** `tempoMs` do começo da fase: a oferta conta a janela; a ativa, o perfil e a duração. */
  inicioMs: number;
  /** Carga das turbinas (Era 1) ou potência das varetas ativas (Era 2); 1 = 100 %. Só vale na fase ativa. */
  controle: number;
  /** ms da fase ativa com a meta cumprida. */
  naMetaMs: number;
  /** Potência bruta do Núcleo no aceite, em kW: a referência da meta de potência (Seguimento de carga). */
  potenciaRefKw: number;
  /** A oferta saiu depois de um SCRAM (o cartão do Xenônio diz a causa). */
  aposScram: boolean;
}

/** Ocorrência superada esperando a escolha da recompensa (🛡 ou 🔬). */
export interface RecompensaPendente {
  id: OcorrenciaId;
  /** 🔬 da escolha "🔬": 60 s da 🔬/s total no instante em que a Ocorrência foi superada. */
  pesquisa: number;
}

export interface OcorrenciasState {
  /**
   * Relógio dos 4 min: acumulador de tempo de tick (não um carimbo de `tempoMs`, que o offline avança).
   * Só anda com o Núcleo desbloqueado e sem oferta, Ocorrência ou recompensa pendente; volta a 0 no fim de
   * cada uma (superada ou não) e na oferta recusada ou expirada.
   */
  relogioMs: number;
  /** Semente do sorteio (`sim/aleatorio.ts`); avança a cada sorteio. */
  semente: number;
  /** A primeira oferta do save já saiu (ela é a Nuvem, ou o Xenônio num save que chega já na Era 2). */
  primeiraOfertaFeita: boolean;
  /** Houve SCRAM na Era 2 desde a última oferta: a próxima é o Xenônio. */
  xenonioPendente: boolean;
  atual: OcorrenciaEmCurso | null;
  recompensa: RecompensaPendente | null;
  /** Quantas o jogador superou (para o relatório e a simulação). */
  superadas: number;
}

export function ocorrenciasIniciais(): OcorrenciasState {
  return {
    relogioMs: 0,
    semente: OCORRENCIAS.sementeInicial,
    primeiraOfertaFeita: false,
    xenonioPendente: false,
    atual: null,
    recompensa: null,
    superadas: 0,
  };
}

/** Eventos de um tick ou de uma ação, para a UI reagir (cards). Limpos a cada tick; não vão para o save. */
export type EventoJogo =
  | { tipo: "primeiroCarregamento" }
  | { tipo: "primeiraCompra"; item: PecaId | TipoConstrucao }
  | { tipo: "cascata"; entradaUs: number; saidaUs: number }
  | { tipo: "ilhaAberta"; id: IlhaId }
  | { tipo: "nucleoDesbloqueado" }
  | { tipo: "obstaculoRemovido"; indice: number; obstaculo: TipoObstaculo; cristal: boolean }
  /** A cidade inteira subiu uma densidade (v0.8). */
  | { tipo: "cidadeEvoluida"; densidade: Densidade; bairros: number }
  | { tipo: "noPesquisado"; id: string }
  | { tipo: "capituloConcluido"; id: string }
  /** A Torre virou Reator: começa a Era 2 (GDD Parte 2 §2). */
  | { tipo: "eraMudou"; era: 2 }
  | { tipo: "varetaEsgotada"; indice: number }
  | { tipo: "varetaTrocada"; indice: number }
  | { tipo: "scram"; era: 1 | 2 }
  /** Um tipo subiu de nível (v0.8): o diário da cena registra. */
  | { tipo: "melhoria"; alvo: AlvoMelhoria; nivel: number }
  /** Uma Ocorrência foi oferecida (Parte 1 §4.4): o 🔥 pulsa, e a primeira abre o card. */
  | { tipo: "ocorrenciaOferecida"; id: OcorrenciaId }
  /** Uma Ocorrência aceita terminou: superada (a escolha da recompensa aparece) ou não. */
  | { tipo: "ocorrenciaTerminou"; id: OcorrenciaId; superada: boolean }
  /** O jogador escolheu a recompensa. */
  | { tipo: "recompensaEscolhida"; id: OcorrenciaId; recompensa: "estabilidade" | "pesquisa"; valor: number };

export interface GameState {
  versao: number;
  tempoMs: number;
  creditos: number;
  /** Saldo de Pesquisa (🔬). É **gasto** na árvore, na evolução da cidade e nas montanhas (v0.6). */
  pesquisa: number;
  /** Nós da árvore já comprados (GDD §8.6). Substituiu as melhorias nomeadas. */
  pesquisados: string[];
  /** Capítulos já concluídos, em ordem (GDD §12, v0.6). */
  capitulos: string[];
  /** Era em curso (GDD Parte 2 §2). Fonte da verdade; `nucleo.era` é o espelho. */
  era: 1 | 2;
  rede: RedeState;
  /** Níveis por tipo (v0.8). */
  melhorias: MelhoriasState;
  /** Densidade da cidade (v0.8). */
  cidade: CidadeState;
  mundo: MundoState;
  /** `null` enquanto o Núcleo não foi desbloqueado. */
  nucleo: NucleoState | null;
  /** Oferta, Ocorrência em curso, relógio e sorteio (v0.9). */
  ocorrencia: OcorrenciasState;
  /** `Date.now()` do último save; 0 = nunca salvo. Base do cálculo offline (GDD §7). */
  salvoEmMs: number;
  /** Ids dos cards explicativos já mostrados. */
  cardsVistos: string[];
  /** Fila de eventos do tick/ação corrente (não persiste). */
  eventos: EventoJogo[];
}

/** Versão do formato de save. Incrementar ao mudar a forma do estado. */
export const VERSAO_SAVE = 10;

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
    era: 1,
    lado: NUCLEO.ladoInicial,
    grade: gradeVazia(),
    calorU: 0,
    tempoAcimaDoLimiteMs: 0,
    scramRestanteMs: 0,
    scramInicioMs: null,
    trocasEmFaixa: 0,
    estabilidade: 0,
    modoSeguro: false,
    receptorCeramico: false,
    cascatas: 0,
    ultimaCascataMs: null,
    ultimaCascata: null,
  };
}

/** A ilha principal nasce com a aldeia e uma subestação ao lado (GDD §8.5). */
/**
 * A cidade (GDD §8.6, v0.8): a densidade é **da cidade**, não de cada bairro. Evoluir a cidade evolui
 * todos os bairros de uma vez; bairro novo nasce na densidade dela.
 */
export interface CidadeState {
  /** 1 = aldeia … 4 = metrópole (Era 1); 5 = megacidade, 6 = arcologia (Era 2). */
  densidade: Densidade;
}

/** O que um nível compra: um tipo inteiro, nunca uma unidade (v0.8). */
export type AlvoMelhoria =
  | { tipo: "usina"; id: UsinaId }
  | { tipo: "peca"; id: PecaId }
  | { tipo: "subestacao"; id: TipoSubestacao }
  | { tipo: "cabos" }
  | { tipo: "ciencia"; id: TipoCiencia }
  | { tipo: "equipe" };

/** Todos os tipos no nível 0. */
export function melhoriasIniciais(): MelhoriasState {
  return {
    usinas: { cataVento: 0, painelSolar: 0, turbinaEolica: 0, eolicaOffshore: 0, fazendaSolar: 0, termicaGas: 0 },
    pecas: { heliostato: 0, turbina: 0, radiador: 0, tanque: 0, vareta: 0, barraControle: 0, turbinaAlta: 0, torreResfriamento: 0, piscina: 0 },
    subestacoes: { subestacao: 0, subestacao138: 0, subestacaoOffshore: 0 },
    cabos: 0,
    ciencia: { laboratorio: 0, universidade: 0, institutoPesquisa: 0 },
    equipe: 0,
  };
}

export function mundoInicial(): MundoState {
  const arq = arquipelagoDaEra1();
  const construcoes: Record<number, Construcao> = {};
  for (const i of arq.inicio.aldeia) construcoes[i] = { tipo: "bairro", nivel: 0, colocadoEmMs: 0 };
  construcoes[arq.inicio.subestacao] = { tipo: "subestacao", nivel: 0, colocadoEmMs: 0 };
  return { construcoes, removidos: [], remocoes: [], cristais: [], ilhasAbertas: [...ILHAS_INICIAIS], cabos: {} };
}

export function estadoInicial(): GameState {
  return {
    versao: VERSAO_SAVE,
    tempoMs: 0,
    creditos: ECONOMIA.creditosIniciais,
    pesquisa: 0,
    pesquisados: [...NOS_INICIAIS],
    capitulos: [],
    era: 1,
    rede: { bateria: { kwh: 0 } },
    melhorias: melhoriasIniciais(),
    cidade: { densidade: 1 },
    mundo: mundoInicial(),
    nucleo: null,
    ocorrencia: ocorrenciasIniciais(),
    salvoEmMs: 0,
    cardsVistos: [],
    eventos: [],
  };
}
