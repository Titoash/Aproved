/**
 * Conteúdo da Era 1 — camada Rede (GDD §7, §8.1, §8.2).
 * Só dados: nenhuma regra aqui. A simulação e a UI leem deste arquivo.
 */
import type { UsinaId } from "../sim/state";

export interface Desbloqueio {
  /** Desbloqueia ao possuir pelo menos N unidades da usina indicada. */
  usina?: [UsinaId, number];
  /** Pesquisa (🔬) necessária. Sem efeito na Sessão 1: fica só como campo. */
  pesquisa?: number;
}

export interface UsinaDef {
  id: UsinaId;
  nome: string;
  nomePlural: string;
  descricao: string;
  custoBase: number;
  /** Fator de crescimento do custo por unidade comprada (GDD §7). */
  crescimento: number;
  potenciaKw: number;
  desbloqueio?: Desbloqueio;
}

export interface ItemDef {
  nome: string;
  nomePlural: string;
  descricao: string;
  custoBase: number;
  crescimento: number;
  desbloqueio?: Desbloqueio;
}

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

/** Melhoria por nível (GDD §7): custo `custoBase × 3^nível`, produção `× (1 + 0,5 × nível)`. */
export const MELHORIA = {
  crescimento: 3,
  bonusPorNivel: 0.5,
} as const;

/** GDD §8.2. */
export const USINAS: Record<UsinaId, UsinaDef> = {
  cataVento: {
    id: "cataVento",
    nome: "Cata-vento",
    nomePlural: "Cata-ventos",
    descricao: "Um moinho de madeira que gira com a brisa. Pouco, mas constante.",
    custoBase: 15,
    crescimento: 1.15,
    potenciaKw: 1,
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

/** GDD §8.2: Bateria ₵ 80, +20 kWh de capacidade, 🔬 20. */
export const BATERIA: ItemDef & { capacidadeKwh: number } = {
  nome: "Bateria",
  nomePlural: "Baterias",
  descricao: "Guarda o excedente e cobre o déficit.",
  custoBase: 80,
  crescimento: 1.15,
  capacidadeKwh: 20,
  desbloqueio: { pesquisa: 20 },
};

/* ------------------------------------------------------------------ */
/* Balança Oferta × Demanda (GDD §4.1)                                 */
/* ------------------------------------------------------------------ */

export type FaixaId = "apagao" | "neutroBaixo" | "zonaDeOuro" | "neutroAlto" | "saturacao";

export interface FaixaR {
  id: FaixaId;
  nome: string;
  /** Limite superior da faixa. */
  ate: number;
  /** Se o limite superior pertence à faixa. */
  ateInclusivo: boolean;
  multiplicador: number;
}

/**
 * Faixas da razão r = oferta ÷ demanda, em ordem crescente.
 *
 *   r < 0,8          apagão        ×0,5   (multa contratual)
 *   0,8 ≤ r < 0,9    neutro        ×1
 *   0,9 ≤ r ≤ 1,1    zona de ouro  ×1,25
 *   1,1 < r ≤ 1,25   neutro        ×1
 *   r > 1,25         saturação     ×0,75  (excedente vai para a bateria, o resto é desperdiçado)
 */
export const FAIXAS_R: readonly FaixaR[] = [
  { id: "apagao", nome: "Apagão", ate: 0.8, ateInclusivo: false, multiplicador: 0.5 },
  { id: "neutroBaixo", nome: "Neutro", ate: 0.9, ateInclusivo: false, multiplicador: 1 },
  { id: "zonaDeOuro", nome: "Zona de ouro", ate: 1.1, ateInclusivo: true, multiplicador: 1.25 },
  { id: "neutroAlto", nome: "Neutro", ate: 1.25, ateInclusivo: true, multiplicador: 1 },
  { id: "saturacao", nome: "Saturação", ate: Infinity, ateInclusivo: true, multiplicador: 0.75 },
];
