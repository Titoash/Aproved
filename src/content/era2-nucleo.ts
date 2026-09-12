/**
 * Conteúdo da Era 2 — camada Núcleo: Reator PWR (GDD §8.5.3, §8.5.4, §8.5.5).
 * Só dados. As regras (queima, decaimento, balanço) vivem em `src/sim/`.
 */
import type { PecaEra2Id } from "../sim/state";
import type { DefinicaoNucleo, PecaDef } from "./tipos";

/** Constantes do Reator PWR (GDD §8.5.3). */
export const REATOR = {
  /** A grade da Era 2 nasce 7×7: o jogador já pagou pela geometria maior. */
  ladoInicial: 7,
  /** Capacidade do Vaso, em u. */
  capacidadeVasoU: 1000,
  /** Calor que uma Vareta do anel 1 injeta, em u/s. */
  calorVaretaAnel1: 40,
  /** Uma Vareta do anel 2 vale esta fração (20 u/s). */
  pesoVaretaAnel2: 0.5,
  /** Nenhuma peça da Era 2 aceita o anel 3 — é espaço reservado para a Era 3. */
  pesoAnel3: 0,
  /** Dissipação de uma Bomba adjacente, em u/s. */
  dissipacaoBomba: 60,
  /** Fração do calor armazenado que cada Gerador de vapor consome por segundo. */
  consumoGerador: 0.12,
  /** kW gerados por u consumida pelo Gerador (dez vezes a turbina da Era 1). */
  kwPorUnidade: 8,
  /** Capacidade que um Pressurizador adjacente soma, em u. */
  capacidadePressurizadorU: 1500,
  pesquisaPorKw: 0.1,
} as const;

/** Combustível e decaimento (GDD §8.5.4, §8.5.5). */
export const COMBUSTIVEL = {
  /** 0,25 %/s no anel 1 → 400 s; no anel 2 queima pelo peso → 800 s. */
  taxaPorSegundo: 0.0025,
  /** Recarregar custa 60 % do preço da peça. */
  fracaoRecarga: 0.6,
  /** Abaixo disto o jogo avisa que a vareta está acabando. */
  limiarAviso: 0.2,
  decaimento: {
    /** Os ~7 % reais de potência de decaimento logo após o desligamento. */
    fracao: 0.07,
    meiaVidaMs: 90_000,
    /** ≈ 6 meias-vidas depois, o decaimento conta como zero e a peça sai. */
    corteUs: 0.05,
  },
} as const;

export const PECAS_ERA2: Record<PecaEra2Id, PecaDef> = {
  vareta: {
    id: "vareta",
    nome: "Vareta de combustível",
    nomePlural: "Varetas de combustível",
    descricao: "Fissão: +40 u/s no anel 1, +20 u/s no anel 2. O combustível acaba — e depois ela continua quente.",
    custo: 400,
    aneis: [1, 2],
    efeitoSoAdjacente: false,
    papel: "aquece",
    valor: REATOR.calorVaretaAnel1,
    queima: true,
  },
  geradorDeVapor: {
    id: "geradorDeVapor",
    nome: "Gerador de vapor",
    nomePlural: "Geradores de vapor",
    descricao: "Só adjacente ao Vaso. Consome 12 % do calor por segundo e gera 8 kW por u.",
    custo: 700,
    aneis: [1],
    efeitoSoAdjacente: true,
    papel: "converte",
    valor: 0,
  },
  bomba: {
    id: "bomba",
    nome: "Bomba de refrigerante",
    nomePlural: "Bombas de refrigerante",
    descricao: "Dissipa 60 u/s do Vaso se adjacente. É ela que segura o calor de decaimento quando a fissão para.",
    custo: 550,
    aneis: [1, 2],
    efeitoSoAdjacente: true,
    papel: "dissipa",
    valor: REATOR.dissipacaoBomba,
  },
  pressurizador: {
    id: "pressurizador",
    nome: "Pressurizador",
    nomePlural: "Pressurizadores",
    descricao: "Adjacente ao Vaso: +1 500 u de capacidade compartilhada. Custa uma casa do anel 1.",
    custo: 800,
    aneis: [1, 2],
    efeitoSoAdjacente: true,
    papel: "armazena",
    valor: REATOR.capacidadePressurizadorU,
  },
};

export const ORDEM_PECAS_ERA2: readonly PecaEra2Id[] = ["vareta", "geradorDeVapor", "bomba", "pressurizador"];

/** O Reator PWR como definição de Núcleo — o que o sim lê (GDD §8.5.3). */
export const NUCLEO_REATOR_PWR: DefinicaoNucleo = {
  tipo: "reatorPwr",
  nomeCentro: "Vaso do reator",
  ladoInicial: REATOR.ladoInicial,
  capacidadeCentroU: REATOR.capacidadeVasoU,
  pesosAnel: [1, REATOR.pesoVaretaAnel2, REATOR.pesoAnel3],
  consumoConversor: REATOR.consumoGerador,
  kwPorUnidade: REATOR.kwPorUnidade,
  pesquisaPorKw: REATOR.pesquisaPorKw,
  pecas: PECAS_ERA2,
  ordemPecas: ORDEM_PECAS_ERA2,
  combustivel: COMBUSTIVEL,
};
