/**
 * Conteúdo da Era 1 — camada Núcleo: Torre Solar (GDD §4.2, §5, §7, §8.3, §10).
 * Só dados. Regras de posicionamento entram como dado (`aneis`, `efeitoSoAdjacente`),
 * não como `if` espalhado pela UI.
 */
import type { PecaEra1Id } from "../sim/state";
import type { DefinicaoNucleo, PecaDef } from "./tipos";

export { CASCATA, FAIXAS_CALOR, MODO_SEGURO } from "./regras";
export type { FaixaCalor, FaixaCalorId } from "./regras";

export type { Anel, PecaDef } from "./tipos";

/** Constantes da Torre Solar (GDD §8.3). */
export const NUCLEO = {
  /** Desbloqueio do Núcleo, em ₵. */
  custoDesbloqueio: 100,
  /** Lado inicial da grade (5×5); a Grade 7×7 é uma melhoria. O Receptor fica no centro. */
  ladoInicial: 5,
  /** Capacidade do Receptor, em u. */
  capacidadeReceptorU: 100,
  /** Calor que um Heliostato do anel 1 injeta, em u/s. */
  calorEspelhoAnel1: 4,
  /** Um Heliostato do anel 2 vale esta fração de um do anel 1 (2 u/s). */
  pesoEspelhoAnel2: 0.5,
  /** Um Heliostato do anel 3 (só no 7×7) vale esta fração (1 u/s). */
  pesoEspelhoAnel3: 0.25,
  /** Dissipação de um Radiador adjacente, em u/s. */
  dissipacaoRadiador: 6,
  /** Fração do calor armazenado que cada Turbina consome por segundo. */
  consumoTurbina: 0.12,
  /** kW gerados por u consumida pela Turbina. */
  kwPorUnidade: 0.8,
  /** Capacidade que um Tanque de sal adjacente soma, em u. */
  capacidadeTanqueU: 150,
  /** Pesquisa/s = potência do Núcleo (kW) × este fator × multiplicador da faixa de calor (GDD §7). */
  pesquisaPorKw: 0.1,
} as const;

/** Melhoria do Núcleo (GDD §8.3). O 🔬 é requisito acumulado, não gasto. */
export const RECEPTOR_CERAMICO = {
  nome: "Receptor cerâmico",
  descricao: "Liga cerâmica no Receptor: +50 u de capacidade.",
  custo: 300,
  pesquisa: 80,
  capacidadeExtraU: 50,
} as const;

export const PECAS: Record<PecaEra1Id, PecaDef> = {
  heliostato: {
    id: "heliostato",
    nome: "Heliostato",
    nomePlural: "Heliostatos",
    descricao: "Espelho que concentra sol no Receptor: +4 u/s no anel 1, +2 u/s no anel 2, +1 u/s no anel 3.",
    custo: 30,
    aneis: [1, 2, 3],
    efeitoSoAdjacente: false,
    papel: "aquece",
    valor: 4,
  },
  turbina: {
    id: "turbina",
    nome: "Turbina a vapor",
    nomePlural: "Turbinas a vapor",
    descricao: "Só adjacente ao Receptor. Consome 12 % do calor por segundo e gera 0,8 kW por u.",
    custo: 50,
    aneis: [1],
    efeitoSoAdjacente: true,
    papel: "converte",
    valor: 0,
  },
  radiador: {
    id: "radiador",
    nome: "Radiador",
    nomePlural: "Radiadores",
    descricao: "Dissipa 6 u/s do Receptor se adjacente.",
    custo: 40,
    aneis: [1, 2],
    efeitoSoAdjacente: true,
    papel: "dissipa",
    valor: 6,
  },
  tanque: {
    id: "tanque",
    nome: "Tanque de sal fundido",
    nomePlural: "Tanques de sal fundido",
    descricao: "Adjacente ao Receptor: +150 u de capacidade compartilhada. Amortece picos, esfria a média.",
    custo: 60,
    aneis: [1, 2],
    efeitoSoAdjacente: true,
    papel: "armazena",
    valor: 150,
  },
};

export const ORDEM_PECAS: readonly PecaEra1Id[] = ["heliostato", "turbina", "radiador", "tanque"];

/** A Torre Solar como definição de Núcleo — o que o sim lê (GDD §8.3). */
export const NUCLEO_TORRE_SOLAR: DefinicaoNucleo = {
  tipo: "torreSolar",
  nomeCentro: "Receptor",
  ladoInicial: NUCLEO.ladoInicial,
  capacidadeCentroU: NUCLEO.capacidadeReceptorU,
  pesosAnel: [1, NUCLEO.pesoEspelhoAnel2, NUCLEO.pesoEspelhoAnel3],
  consumoConversor: NUCLEO.consumoTurbina,
  kwPorUnidade: NUCLEO.kwPorUnidade,
  pesquisaPorKw: NUCLEO.pesquisaPorKw,
  pecas: PECAS,
  ordemPecas: ORDEM_PECAS,
};

/* ------------------------------------------------------------------ */
/* Balança do Calor (GDD §4.2) e Estabilidade (GDD §6, §7)              */
/* ------------------------------------------------------------------ */

/** Rampa de calor (GDD §10): corpo negro, do frio ao branco em 100 %. */
export const RAMPA_CALOR: readonly { t: number; cor: string }[] = [
  { t: 0, cor: "#3A6FF2" },
  { t: 0.5, cor: "#FFD23F" },
  { t: 0.85, cor: "#FF7A1A" },
  { t: 1, cor: "#FFFFFF" },
];
