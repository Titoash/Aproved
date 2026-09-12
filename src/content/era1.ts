/**
 * Conteúdo da Era 1 — camada Rede (GDD §7, §8.1, §8.2).
 * Só dados: nenhuma regra aqui. A simulação e a UI leem deste arquivo.
 */
import type { MelhoriaId, UsinaEra1Id, UsinaId } from "../sim/state";
import type { ItemDef, UsinaDef } from "./tipos";

export type { Desbloqueio, ItemDef, UsinaDef } from "./tipos";
export { FAIXAS_R, MELHORIA, OFFLINE } from "./regras";
export type { FaixaId, FaixaR } from "./regras";

/** Parâmetros econômicos globais (GDD §7 e §8.1). */
export const ECONOMIA = {
  creditosIniciais: 50,
  /** Demanda da aldeia inicial. */
  demandaInicialKw: 5,
  /** Preço base da energia na Era 1: ₵ por kW·s (GDD §7). */
  precoBase: 1,
  /**
   * Escala da bateria: kWh guardados por kW de excedente durante 1 s real.
   * O valor físico seria 1/3600, mas aí a bateria levaria horas para reagir e
   * o GDD §4.1 quer que ela amorteça oscilações curtas. Com 1, uma bateria de
   * 20 kWh cobre 5 kW de déficit por 4 s. Ver docs/ESTADO.md ("Conflitos").
   */
  kwhPorKwSegundo: 1,
} as const;

/** GDD §8.2. */
export const USINAS: Record<UsinaEra1Id, UsinaDef> = {
  cataVento: {
    id: "cataVento",
    nome: "Cata-vento",
    nomePlural: "Cata-ventos",
    descricao: "Um moinho de madeira que gira com a brisa. Pouco, mas constante.",
    custoBase: 15,
    crescimento: 1.15,
    potenciaKw: 1,
    era: 1,
  },
  painelSolar: {
    id: "painelSolar",
    nome: "Painel solar",
    nomePlural: "Painéis solares",
    descricao: "Placas fotovoltaicas nos telhados da aldeia.",
    custoBase: 60,
    crescimento: 1.15,
    potenciaKw: 3,
    desbloqueio: { usina: ["cataVento", 5] },
    era: 1,
  },
  turbinaEolica: {
    id: "turbinaEolica",
    nome: "Turbina eólica",
    nomePlural: "Turbinas eólicas",
    descricao: "Uma torre de verdade, com pás de trinta metros.",
    custoBase: 120,
    crescimento: 1.15,
    potenciaKw: 6,
    desbloqueio: { pesquisa: 40 },
    era: 1,
  },
};

export const ORDEM_USINAS: readonly UsinaId[] = ["cataVento", "painelSolar", "turbinaEolica"];

/** GDD §8.2: Vila ₵ 40, +8 kW de demanda, custo cresce ×1,25 (GDD §7). */
export const VILA: ItemDef & { demandaKw: number } = {
  nome: "Vila",
  nomePlural: "Vilas",
  descricao: "Um bairro novo ligado à rede. Aumenta a demanda.",
  custoBase: 40,
  crescimento: 1.25,
  demandaKw: 8,
};

/** GDD §8.2 e §4.1: Bateria ₵ 80, +20 kWh de capacidade e ±10 kW de carga/descarga por unidade, 🔬 20. */
export const BATERIA: ItemDef & { capacidadeKwh: number; potenciaKw: number } = {
  nome: "Bateria",
  nomePlural: "Baterias",
  descricao: "Guarda o excedente e cobre o déficit. Segura a balança: transforma falha em neutro.",
  custoBase: 80,
  crescimento: 1.15,
  capacidadeKwh: 20,
  potenciaKw: 10,
  desbloqueio: { pesquisa: 20 },
};

/* ------------------------------------------------------------------ */
/* Melhorias nomeadas (GDD §8.2, §8.3)                                */
/* ------------------------------------------------------------------ */

export type EfeitoMelhoria =
  | { tipo: "potenciaUsinas"; usinas: readonly UsinaId[]; fator: number }
  | { tipo: "calorPorEspelho"; valor: number }
  | { tipo: "gradeLado"; lado: number };

export interface MelhoriaDef {
  id: MelhoriaId;
  nome: string;
  descricao: string;
  custo: number;
  /** 🔬 acumulado exigido (requisito, não gasto). */
  pesquisa?: number;
  camada: "rede" | "nucleo";
  efeito: EfeitoMelhoria;
}

export const MELHORIAS: Record<MelhoriaId, MelhoriaDef> = {
  laminasDeFibra: {
    id: "laminasDeFibra",
    nome: "Lâminas de fibra",
    descricao: "Pás mais leves e mais longas: cata-vento e turbina eólica +25 %.",
    custo: 200,
    camada: "rede",
    efeito: { tipo: "potenciaUsinas", usinas: ["cataVento", "turbinaEolica"], fator: 1.25 },
  },
  rastreamentoSolar: {
    id: "rastreamentoSolar",
    nome: "Rastreamento solar",
    descricao: "Os espelhos seguem o sol: cada um injeta 5 u/s em vez de 4. Muda o equilíbrio — reajuste a grade.",
    custo: 150,
    pesquisa: 30,
    camada: "nucleo",
    efeito: { tipo: "calorPorEspelho", valor: 5 },
  },
  grade7x7: {
    id: "grade7x7",
    nome: "Grade 7×7",
    descricao: "Abre o anel 3: 24 casas novas, só para espelhos, a 1 u/s cada. O 5×5 é preservado no centro. Use com tanques.",
    custo: 800,
    pesquisa: 150,
    camada: "nucleo",
    efeito: { tipo: "gradeLado", lado: 7 },
  },
};

export const ORDEM_MELHORIAS: readonly MelhoriaId[] = ["laminasDeFibra", "rastreamentoSolar", "grade7x7"];

/* ------------------------------------------------------------------ */
/* Balança Oferta × Demanda (GDD §4.1)                                 */
/* ------------------------------------------------------------------ */

