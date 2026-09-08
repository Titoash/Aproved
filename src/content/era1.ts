/**
 * Conteúdo da Era 1 — camada Rede (GDD §8.2).
 *
 * ATENÇÃO: o GDD ainda não está neste repositório. Os números abaixo são
 * PROVISÓRIOS e ficam concentrados aqui para serem trocados pelos valores
 * exatos do GDD §7/§8.2 sem tocar na simulação nem na UI.
 */
import type { UsinaId } from "../sim/state";

export interface Desbloqueio {
  /** Desbloqueia ao possuir pelo menos N unidades da usina indicada. */
  usina?: [UsinaId, number];
  /** Pesquisa necessária. Sem efeito na Sessão 1 (campo reservado). */
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

/** Parâmetros econômicos globais (GDD §3, §7, §8.1). */
export const ECONOMIA = {
  creditosIniciais: 50,
  demandaInicialKw: 5,
  /** Preço base da energia vendida, em ₵ por kWh. */
  precoBaseKwh: 1,
  /**
   * Escala de tempo da rede: 1 s real equivale a 1 h de rede.
   * Assim 5 kW vendidos durante 10 s viram 50 kWh e rendem ₵ 50 a preço 1,0.
   */
  horasPorSegundo: 1,
} as const;

/** Melhorias de usina (GDD §7): custo e bônus por nível. */
export const MELHORIA = {
  /** Custo do nível 1 = custoBase × custoMult. */
  custoMult: 10,
  /** Cada nível seguinte custa este fator a mais que o anterior. */
  crescimento: 3,
  /** Cada nível adiciona esta fração da potência base (0,5 = +50 %). */
  bonusPorNivel: 0.5,
} as const;

export const USINAS: Record<UsinaId, UsinaDef> = {
  cataVento: {
    id: "cataVento",
    nome: "Cata-vento",
    nomePlural: "Cata-ventos",
    descricao: "Um moinho de madeira que gira com a brisa. Pouco, mas constante.",
    custoBase: 10,
    crescimento: 1.15,
    potenciaKw: 1,
  },
  painelSolar: {
    id: "painelSolar",
    nome: "Painel solar",
    nomePlural: "Painéis solares",
    descricao: "Placas fotovoltaicas no telhado da vila.",
    custoBase: 120,
    crescimento: 1.15,
    potenciaKw: 5,
    desbloqueio: { usina: ["cataVento", 5] },
  },
  turbinaEolica: {
    id: "turbinaEolica",
    nome: "Turbina eólica",
    nomePlural: "Turbinas eólicas",
    descricao: "Uma torre de verdade, com pás de trinta metros.",
    custoBase: 1500,
    crescimento: 1.15,
    potenciaKw: 30,
    desbloqueio: { usina: ["painelSolar", 5], pesquisa: 10 },
  },
};

export const ORDEM_USINAS: readonly UsinaId[] = ["cataVento", "painelSolar", "turbinaEolica"];

export const VILA: ItemDef & { demandaKw: number } = {
  nome: "Vila",
  nomePlural: "Vilas",
  descricao: "Um bairro novo ligado à rede. Aumenta a demanda.",
  custoBase: 30,
  crescimento: 1.15,
  demandaKw: 3,
};

export const BATERIA: ItemDef & { capacidadeKwh: number } = {
  nome: "Bateria",
  nomePlural: "Baterias",
  descricao: "Guarda o excedente e cobre o déficit.",
  custoBase: 80,
  crescimento: 1.15,
  capacidadeKwh: 10,
  desbloqueio: { usina: ["cataVento", 3] },
};
