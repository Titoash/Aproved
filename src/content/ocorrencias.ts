/**
 * Ocorrências (GDD Parte 1 §4.4 e Parte 2 §5.4, v0.9): o sub-jogo opcional de operação do Núcleo.
 * Só dados. A regra (relógio, sorteio, controle, meta, recompensa) está em `sim/ocorrencias.ts`; a
 * perturbação entra no motor de calor como multiplicador, e nenhuma fórmula de §4.2, §8.3 ou Parte 2 §5 muda.
 */

export type OcorrenciaEra1Id = "nuvem" | "ceuLimpoFrio" | "turbinaMeiaCargaTorre";
export type OcorrenciaEra2Id = "seguimentoCarga" | "xenonio" | "turbinaMeiaCargaReator";
export type OcorrenciaId = OcorrenciaEra1Id | OcorrenciaEra2Id;

/** Regras comuns às duas eras (Parte 1 §4.4). */
export const OCORRENCIAS = {
  /** Uma oferta a cada 4 min de jogo ativo (acumulador de tempo de tick; o offline não conta). */
  intervaloMs: 240_000,
  /** A oferta fica 60 s no painel; depois expira sem custo. */
  janelaOfertaMs: 60_000,
  /** A meta vale se for cumprida em pelo menos 75 % da duração. */
  fracaoMeta: 0.75,
  /** Recompensa 🛡: pontos de Estabilidade, sem passar de 100. */
  recompensaEstabilidade: 3,
  /** Recompensa 🔬: esta quantidade de segundos da 🔬/s total no instante em que a Ocorrência é superada. */
  recompensaPesquisaS: 60,
  /**
   * "Só se oferece o que se pode ganhar": o sorteio só entra com a Ocorrência se o controle, dentro dos
   * limites, põe o `T*` perturbado perto deste alvo — o meio da zona de ouro — e dentro dela.
   */
  alvoT: 0.8,
  /** Semente de um save novo; cada sorteio a avança (`sim/aleatorio.ts`). */
  sementeInicial: 20_260_930,
} as const;

/** O controle único da Ocorrência, por era. Existe só durante ela e volta a 100 % no fim. */
export interface ControleDef {
  nome: string;
  /** Como o valor aparece no rótulo: "Carga das turbinas · 60 %", "Barras de controle · potência 70 %". */
  rotuloValor: string;
  min: number;
  max: number;
  /** Passo do teclado e do arrasto. */
  passo: number;
  /** Frase curta sob o controle. */
  dica: string;
}

export const CONTROLE: Record<1 | 2, ControleDef> = {
  1: {
    nome: "Carga das turbinas",
    rotuloValor: "",
    min: 0.5,
    max: 1.5,
    passo: 0.01,
    dica: "Carga baixa esquenta o Receptor; carga alta esfria.",
  },
  2: {
    nome: "Barras de controle",
    rotuloValor: "potência",
    min: 0.5,
    max: 1.25,
    passo: 0.01,
    dica: "Para cima: retirar barras, mais potência. Para baixo: inserir, menos potência. O decaimento não muda.",
  },
};

/**
 * Onde a perturbação age no motor. `entrada` é a entrada dos espelhos na Era 1 e **só a injeção das varetas
 * ativas** na Era 2 (o decaimento fica de fora, Parte 2 §5.2). `turbina` é uma turbina com a carga em
 * `valor` (0,5 = uma turbina a 50 %): o fator das turbinas vira `(t − 1 + valor) ÷ t`.
 */
export interface PerturbacaoDef {
  termo: "entrada" | "dissipacao" | "turbina";
  /** Valor no platô. */
  valor: number;
}

/** Perfil no tempo: rampa de entrada, platô e rampa de saída, em segundos. */
export interface PerfilDef {
  entradaS: number;
  saidaS: number;
}

export type MetaDef =
  /** `T` na zona de ouro (70–90 %). */
  | { tipo: "calor" }
  /** Potência do Núcleo entre `de` e `ate` da potência no aceite. */
  | { tipo: "potencia"; de: number; ate: number };

export interface ExigeDef {
  heliostatos?: number;
  turbinas?: number;
  varetasAtivas?: number;
}

export interface OcorrenciaDef {
  id: OcorrenciaId;
  era: 1 | 2;
  nome: string;
  duracaoS: number;
  /** `null` no Seguimento de carga: ele não perturba o motor, é só uma meta de potência. */
  perturbacao: PerturbacaoDef | null;
  perfil: PerfilDef;
  exige: ExigeDef;
  meta: MetaDef;
  /** Frase de física do cartão da oferta (tabelas de Parte 1 §4.4 e Parte 2 §5.4). */
  fisica: string;
  /** A causa que o cartão mostra ("o reator passou a noite em potência baixa"); vazia quando a física já diz. */
  causa?: string;
  /** Causa depois de um SCRAM (só o Xenônio). */
  causaAposScram?: string;
}

/** Rampas de 5 s na entrada e na saída (Parte 1 §4.4). */
const RAMPA_PADRAO: PerfilDef = { entradaS: 5, saidaS: 5 };

export const OCORRENCIAS_DEF: Record<OcorrenciaId, OcorrenciaDef> = {
  nuvem: {
    id: "nuvem",
    era: 1,
    nome: "Nuvem sobre o campo",
    duracaoS: 45,
    perturbacao: { termo: "entrada", valor: 0.6 },
    perfil: RAMPA_PADRAO,
    exige: { heliostatos: 1 },
    meta: { tipo: "calor" },
    fisica:
      "Uma nuvem derruba a luz direta em segundos. Nas torres de verdade o operador reduz a vazão no receptor para a temperatura de saída não despencar.",
  },
  ceuLimpoFrio: {
    id: "ceuLimpoFrio",
    era: 1,
    nome: "Céu limpo e frio",
    duracaoS: 45,
    perturbacao: { termo: "entrada", valor: 1.25 },
    perfil: RAMPA_PADRAO,
    exige: { heliostatos: 1 },
    meta: { tipo: "calor" },
    fisica:
      "Ar frio e seco deixa passar mais luz direta: um dia limpo de inverno pode render mais radiação direta que um dia de verão com névoa.",
  },
  turbinaMeiaCargaTorre: {
    id: "turbinaMeiaCargaTorre",
    era: 1,
    nome: "Turbina em meia carga",
    duracaoS: 30,
    perturbacao: { termo: "turbina", valor: 0.5 },
    perfil: RAMPA_PADRAO,
    exige: { turbinas: 2 },
    meta: { tipo: "calor" },
    fisica:
      "Quando uma turbina perde carga, o calor que ela tirava fica no receptor: ou as outras tiram mais, ou ele passa do limite. Nas torres de verdade o sal quente vai para o tanque, e quando o tanque enche o operador tira espelhos de foco.",
  },
  seguimentoCarga: {
    id: "seguimentoCarga",
    era: 2,
    nome: "Seguimento de carga",
    duracaoS: 60,
    perturbacao: null,
    perfil: RAMPA_PADRAO,
    exige: { varetasAtivas: 1 },
    meta: { tipo: "potencia", de: 0.65, ate: 0.75 },
    fisica: "Reatores na França baixam e sobem a potência todos os dias para acompanhar o consumo, movendo barras de controle.",
    causa: "a rede pede 70 % da potência",
  },
  xenonio: {
    id: "xenonio",
    era: 2,
    nome: "Xenônio",
    duracaoS: 60,
    perturbacao: { termo: "entrada", valor: 0.8 },
    // O xenônio age devagar: desce em 15 s, fica 30 s, volta em 15 s (exceção declarada às rampas de 5 s).
    perfil: { entradaS: 15, saidaS: 15 },
    exige: { varetasAtivas: 1 },
    meta: { tipo: "calor" },
    fisica:
      "Horas depois de um reator baixar a potência ou desligar, o iodo-135 acumulado ainda vira xenônio-135, que engole nêutrons: o reator perde reatividade e o operador retira barras para compensar. No jogo, as horas viram segundos.",
    causa: "o reator passou a noite em potência baixa",
    causaAposScram: "o reator acabou de sair de um SCRAM",
  },
  turbinaMeiaCargaReator: {
    id: "turbinaMeiaCargaReator",
    era: 2,
    nome: "Turbina em meia carga",
    duracaoS: 30,
    perturbacao: { termo: "turbina", valor: 0.5 },
    perfil: RAMPA_PADRAO,
    exige: { turbinas: 2 },
    meta: { tipo: "calor" },
    fisica:
      "Quando a turbina perde carga de repente, o vapor que sobra é desviado direto para o condensador e as barras entram para baixar a potência. Em alguns reatores, como os de Palo Verde, um grupo inteiro de barras cai de uma vez.",
  },
};

/** Ordem do sorteio em cada era (a primeira oferta do save é a primeira da lista: Nuvem ou Xenônio). */
export const OCORRENCIAS_DA_ERA: Record<1 | 2, readonly OcorrenciaId[]> = {
  1: ["nuvem", "ceuLimpoFrio", "turbinaMeiaCargaTorre"],
  2: ["xenonio", "seguimentoCarga", "turbinaMeiaCargaReator"],
};

/** A primeira oferta de cada save: a Nuvem na Era 1; num save que chega à v10 já na Era 2, o Xenônio. */
export const PRIMEIRA_OCORRENCIA: Record<1 | 2, OcorrenciaId> = { 1: "nuvem", 2: "xenonio" };

/** Depois de um SCRAM na Era 2, a próxima oferta é o Xenônio (o poço de iodo de verdade). */
export const OCORRENCIA_APOS_SCRAM: OcorrenciaId = "xenonio";
