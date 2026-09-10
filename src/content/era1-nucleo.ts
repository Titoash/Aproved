/**
 * Conteúdo da Era 1 — camada Núcleo: Torre Solar (GDD §4.2, §5, §7, §8.3, §10).
 * Só dados. Regras de posicionamento entram como dado (`aneis`, `efeitoSoAdjacente`),
 * não como `if` espalhado pela UI.
 */
import type { PecaId } from "../sim/state";

export type Anel = 1 | 2 | 3;

export interface PecaDef {
  id: PecaId;
  nome: string;
  nomePlural: string;
  descricao: string;
  custo: number;
  /** Anéis onde a peça pode ser colocada (anel 1 = 8 vizinhas do Receptor, diagonais incluídas; anel 3 só existe no 7×7). */
  aneis: readonly Anel[];
  /** A peça só produz efeito se estiver adjacente ao Receptor (anel 1). */
  efeitoSoAdjacente: boolean;
}

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

export const PECAS: Record<PecaId, PecaDef> = {
  heliostato: {
    id: "heliostato",
    nome: "Heliostato",
    nomePlural: "Heliostatos",
    descricao: "Espelho que concentra sol no Receptor: +4 u/s no anel 1, +2 u/s no anel 2, +1 u/s no anel 3.",
    custo: 30,
    aneis: [1, 2, 3],
    efeitoSoAdjacente: false,
  },
  turbina: {
    id: "turbina",
    nome: "Turbina a vapor",
    nomePlural: "Turbinas a vapor",
    descricao: "Só adjacente ao Receptor. Consome 12 % do calor por segundo e gera 0,8 kW por u.",
    custo: 50,
    aneis: [1],
    efeitoSoAdjacente: true,
  },
  radiador: {
    id: "radiador",
    nome: "Radiador",
    nomePlural: "Radiadores",
    descricao: "Dissipa 6 u/s do Receptor se adjacente.",
    custo: 40,
    aneis: [1, 2],
    efeitoSoAdjacente: true,
  },
  tanque: {
    id: "tanque",
    nome: "Tanque de sal fundido",
    nomePlural: "Tanques de sal fundido",
    descricao: "Adjacente ao Receptor: +150 u de capacidade compartilhada. Amortece picos, esfria a média.",
    custo: 60,
    aneis: [1, 2],
    efeitoSoAdjacente: true,
  },
};

export const ORDEM_PECAS: readonly PecaId[] = ["heliostato", "turbina", "radiador", "tanque"];

/* ------------------------------------------------------------------ */
/* Balança do Calor (GDD §4.2) e Estabilidade (GDD §6, §7)              */
/* ------------------------------------------------------------------ */

export type FaixaCalorId = "frio" | "normal" | "ouro" | "alerta" | "critico";

export interface FaixaCalor {
  id: FaixaCalorId;
  nome: string;
  /** Limite superior de T = Q ÷ capacidade. */
  ate: number;
  ateInclusivo: boolean;
  /** Multiplicador de pesquisa. */
  pesquisa: number;
  /** Estabilidade ganha por minuto de operação nesta faixa. */
  estabilidadePorMinuto: number;
}

/**
 *   T < 40 %          frio      pesquisa ×0,5
 *   40 % ≤ T < 70 %   normal    ×1
 *   70 % ≤ T ≤ 90 %   ouro      ×1,3, Estabilidade acelerada
 *   90 % < T ≤ 100 %  alerta    ×1
 *   T > 100 %         crítico   conta o cronômetro da Cascata
 */
export const FAIXAS_CALOR: readonly FaixaCalor[] = [
  { id: "frio", nome: "Frio", ate: 0.4, ateInclusivo: false, pesquisa: 0.5, estabilidadePorMinuto: 1.5 },
  { id: "normal", nome: "Normal", ate: 0.7, ateInclusivo: false, pesquisa: 1, estabilidadePorMinuto: 1.5 },
  { id: "ouro", nome: "Zona de ouro", ate: 0.9, ateInclusivo: true, pesquisa: 1.3, estabilidadePorMinuto: 2.5 },
  { id: "alerta", nome: "Alerta", ate: 1, ateInclusivo: true, pesquisa: 1, estabilidadePorMinuto: 1.5 },
  { id: "critico", nome: "Crítico", ate: Infinity, ateInclusivo: true, pesquisa: 1, estabilidadePorMinuto: 0 },
];

/** Cascata (GDD §5). */
export const CASCATA = {
  /** T acima deste valor conta o cronômetro. */
  limiarT: 1,
  /** Tempo contínuo acima do limiar até a Cascata, em ms. */
  atrasoMs: 5000,
  perdaEstabilidade: 30,
  scramMs: 20_000,
  /** Fração da carga da bateria perdida. */
  perdaBateria: 0.1,
  /** Reconstruir uma peça de entulho custa esta fração do preço. */
  fracaoReconstrucao: 0.5,
  /** Limpar entulho sem reconstruir é grátis depois deste tempo. */
  limpezaGratisMs: 30_000,
} as const;

/** Modo seguro (GDD §5): SCRAM automático e potência reduzida. */
export const MODO_SEGURO = {
  limiarT: 0.95,
  fatorPotencia: 0.7,
} as const;

/** Rampa de calor (GDD §10): corpo negro, do frio ao branco em 100 %. */
export const RAMPA_CALOR: readonly { t: number; cor: string }[] = [
  { t: 0, cor: "#3A6FF2" },
  { t: 0.5, cor: "#FFD23F" },
  { t: 0.85, cor: "#FF7A1A" },
  { t: 1, cor: "#FFFFFF" },
];
