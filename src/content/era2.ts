/**
 * Conteúdo da Era 2 — camada Rede (GDD §8.5.1, §8.5.2).
 * Só dados. Preço base 0,1: mais watts, menos ₵ por watt (GDD §7).
 */
import type { UsinaId } from "../sim/state";
import type { ItemDef, UsinaDef } from "./tipos";

export const ECONOMIA_ERA2 = {
  /** ₵ por kW·s — um décimo da Era 1 (GDD §7). */
  precoBase: 0.1,
  /** Demanda que a cidade inicial acrescenta à base ao inaugurar a era. */
  demandaInicialKw: 800,
} as const;

/** Portão de saída da Era 1 (GDD §8.4). */
export const TRANSICAO_ERA2 = {
  estabilidade: 100,
  pesquisa: 3000,
  creditos: 50_000,
} as const;

export const USINAS_ERA2: Record<"hidreletrica" | "termeletricaGas" | "usinaNuclear", UsinaDef> = {
  hidreletrica: {
    id: "hidreletrica",
    nome: "Hidrelétrica de rio",
    nomePlural: "Hidrelétricas de rio",
    descricao: "Uma barragem no rio que corta a cidade. Constante, como o cata-vento era — mas cem vezes maior.",
    custoBase: 1500,
    crescimento: 1.15,
    potenciaKw: 100,
    era: 2,
  },
  termeletricaGas: {
    id: "termeletricaGas",
    nome: "Termelétrica a gás",
    nomePlural: "Termelétricas a gás",
    descricao: "Queima gás para girar turbina. Suja, barata de construir, responde rápido.",
    custoBase: 6000,
    crescimento: 1.15,
    potenciaKw: 300,
    desbloqueio: { pesquisa: 3500 },
    era: 2,
  },
  usinaNuclear: {
    id: "usinaNuclear",
    nome: "Usina nuclear",
    nomePlural: "Usinas nucleares",
    descricao: "O que você está aprendendo a operar no Núcleo, em escala comercial.",
    custoBase: 20_000,
    crescimento: 1.15,
    potenciaKw: 900,
    desbloqueio: { pesquisa: 6000 },
    era: 2,
  },
};

export const ORDEM_USINAS_ERA2: readonly UsinaId[] = ["hidreletrica", "termeletricaGas", "usinaNuclear"];

/** GDD §8.5.2: Cidade ₵ 4 000, +800 kW de demanda, custo cresce ×1,25. */
export const CIDADE: ItemDef & { demandaKw: number } = {
  nome: "Cidade",
  nomePlural: "Cidades",
  descricao: "Um distrito inteiro ligado à rede. Aumenta muito a demanda.",
  custoBase: 4000,
  crescimento: 1.25,
  demandaKw: 800,
};

/** GDD §8.5.2: Banco de baterias ₵ 8 000, +2 000 kWh e ±1 000 kW por unidade. */
export const BANCO_DE_BATERIAS: ItemDef & { capacidadeKwh: number; potenciaKw: number } = {
  nome: "Banco de baterias",
  nomePlural: "Bancos de baterias",
  descricao: "Cem baterias da Era 1 num galpão. Segura a balança na escala da cidade.",
  custoBase: 8000,
  crescimento: 1.15,
  capacidadeKwh: 2000,
  potenciaKw: 1000,
};
