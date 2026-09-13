/**
 * Conteúdo da Era 2 — camada Núcleo: Reator PWR (GDD Parte 2 §5).
 * Só dados. O motor de calor é o mesmo da Torre Solar (`T = Q ÷ capacidade`, faixas, Cascata,
 * Estabilidade): o que muda é o que injeta calor — combustível finito e calor de decaimento.
 */
import type { PecaDef } from "./era1-nucleo";
import type { PecaEra2Id } from "../sim/state";

/** Constantes do Reator PWR (GDD Parte 2 §5.1 e §5.2). */
export const REATOR = {
  /** ₵ do Vaso de pressão: a entrada da era e o primeiro sumidouro dela (GDD Parte 2 §2). */
  custoVaso: 200_000,
  /** Capacidade do Vaso, em u. */
  capacidadeVasoU: 500,
  /** Lado inicial da grade na Era 2 (o nó "Reator 7×7" reabre o 7×7). */
  ladoInicial: 5,
  /** Fração do calor armazenado que cada turbina de alta pressão consome por segundo. */
  consumoTurbina: 0.12,
  /** kW gerados por u consumida pela turbina de alta pressão. */
  kwPorUnidade: 8,
  /** Capacidade que uma Piscina adjacente ao Vaso soma, em u. */
  capacidadePiscinaU: 250,
  /** Dissipação de uma Torre de resfriamento adjacente, em u/s. */
  dissipacaoTorre: 30,
  /** Pesquisa/s = kW do Núcleo × este fator × multiplicador da faixa (a Era 1 usava 0,1). */
  pesquisaPorKw: 0.01,
} as const;

/** Combustível e decaimento (GDD Parte 2 §5.2). */
export const VARETA = {
  /** Segundos de combustível de uma vareta nova (a barra de controle e o MOX esticam). */
  combustivelS: 600,
  /** Calor injetado por anel, em u/s: anel 1, anel 2, anel 3. */
  injecaoPorAnelUs: [20, 10, 5] as const,
  /**
   * Fração do calor nominal que uma vareta gasta continua soltando no primeiro instante.
   * Física: ao parar a fissão, os produtos de fissão seguem decaindo — ≈ 7 % da potência térmica
   * logo depois do desligamento e ≈ 1 % depois de uma hora.
   */
  fracaoDecaimento: 0.07,
  /** Meia-vida do calor de decaimento, em s. */
  meiaVidaS: 60,
  /** ₵ da troca de uma vareta gasta (é o combustível novo). */
  custoTroca: 8_000,
  /** Só se troca quando o decaimento cai abaixo desta fração do nominal (≈ 3 meias-vidas, 180 s). */
  limiarTroca: 0.01,
  /** A barra de controle vizinha corta o calor da vareta e dobra a vida dela. */
  fatorBarraCalor: 0.5,
  fatorBarraVida: 2,
} as const;

/** SCRAM da Era 2 (GDD Parte 2 §5.2): 60 s de parada mínima + 30 s para religar. */
export const SCRAM_ERA2 = {
  minimoMs: 60_000,
  religarMs: 30_000,
  /** Duração total do desligamento. */
  totalMs: 90_000,
} as const;

export const PECAS_ERA2: Record<PecaEra2Id, PecaDef> = {
  vareta: {
    id: "vareta",
    nome: "Vareta de combustível",
    nomePlural: "Varetas de combustível",
    descricao: "Injeta 20 u/s no anel 1, 10 u/s no anel 2 e 5 u/s no anel 3, por 600 s. Depois fica quente e gasta.",
    custo: 10_000,
    aneis: [1, 2, 3],
    efeitoSoAdjacente: false,
  },
  barraControle: {
    id: "barraControle",
    nome: "Barra de controle",
    nomePlural: "Barras de controle",
    descricao: "As varetas nas 8 vizinhas rendem −50 % de calor e duram o dobro. Duas barras vizinhas não somam.",
    custo: 6_000,
    aneis: [1, 2, 3],
    efeitoSoAdjacente: false,
  },
  turbinaAlta: {
    id: "turbinaAlta",
    nome: "Turbina a vapor de alta pressão",
    nomePlural: "Turbinas a vapor de alta pressão",
    descricao: "Só encostada no Vaso. Consome 12 % do calor por segundo e devolve 8 kW por u.",
    custo: 15_000,
    aneis: [1],
    efeitoSoAdjacente: true,
  },
  torreResfriamento: {
    id: "torreResfriamento",
    nome: "Torre de resfriamento",
    nomePlural: "Torres de resfriamento",
    descricao: "Dissipa 30 u/s do Vaso. É o que segura T depois de um SCRAM.",
    custo: 12_000,
    aneis: [1],
    efeitoSoAdjacente: true,
  },
  piscina: {
    id: "piscina",
    nome: "Piscina de resfriamento",
    nomePlural: "Piscinas de resfriamento",
    descricao: "+250 u de capacidade. As varetas gastas nas 8 vizinhas trocam na hora, e o decaimento delas vai para a piscina.",
    custo: 20_000,
    aneis: [1],
    efeitoSoAdjacente: true,
  },
};

export const ORDEM_PECAS_ERA2: readonly PecaEra2Id[] = ["vareta", "barraControle", "turbinaAlta", "torreResfriamento", "piscina"];
