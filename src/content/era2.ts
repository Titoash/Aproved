/**
 * Conteúdo da Era 2 — camada Rede e cidade (GDD Parte 2 §3 e §4). Só dados.
 *
 * A escala sobe ×100 (a Era 1 fecha com ≈ 400 kW; a Era 2 mira ≈ 40 MW) e o preço por watt cai ×0,1 —
 * mas **nenhuma fórmula muda**: preço continua ₵ 1 por kW·s × faixa de `r` × tarifa média (GDD §4.1).
 * O que entra de novo é o **custo de operação**: a térmica a gás queima combustível enquanto liga, e
 * isso aparece no extrato como despesa (GDD Parte 2 §1 e §9).
 */
import type { ItemDef, UsinaDef } from "./era1";
import type { UsinaEra2Id } from "../sim/state";

export const USINAS_ERA2: Record<UsinaEra2Id, UsinaDef> = {
  eolicaOffshore: {
    id: "eolicaOffshore",
    nome: "Eólica offshore",
    nomePlural: "Eólicas offshore",
    descricao: "Uma torre fincada no mar raso. Vento limpo e constante, longe de tudo o que freia o ar.",
    custoBase: 4_000,
    crescimento: 1.15,
    potenciaKw: 400,
    desbloqueio: { no: "subestacaoOffshore" },
    /** Só em mar raso (mar fundo com o nó "Fundação flutuante"). */
    agua: true,
    lado: 1,
  },
  fazendaSolar: {
    id: "fazendaSolar",
    nome: "Fazenda solar",
    nomePlural: "Fazendas solares",
    descricao: "Fileiras de painéis num terreno plano inteiro. Ocupa 2×2 e não sobe em colina.",
    custoBase: 6_000,
    crescimento: 1.15,
    potenciaKw: 300,
    lado: 2,
    terrenosProibidos: ["colina"],
  },
  termicaGas: {
    id: "termicaGas",
    nome: "Térmica a gás",
    nomePlural: "Térmicas a gás",
    descricao: "2 000 kW na hora que você quiser — queimando ₵ 300/s de gás. Fumaça derruba a tarifa dos bairros ao lado.",
    custoBase: 25_000,
    crescimento: 1.15,
    potenciaKw: 2_000,
    lado: 2,
    /** ₵ por segundo enquanto liga (≈ 12 % do que ela vende na zona de ouro). */
    combustivelPorSegundo: 300,
  },
};

export const ORDEM_USINAS_ERA2: readonly UsinaEra2Id[] = ["eolicaOffshore", "fazendaSolar", "termicaGas"];

/** Bairros a até esta distância de uma térmica sentem a fumaça (GDD Parte 2 §3.1). */
export const TERMICA = {
  alcanceVizinhanca: 2,
  /** Efeito na tarifa desses bairros: −10 % (vira +10 % com o nó "Cogeração"). */
  deltaTarifa: -0.1,
} as const;

/* ------------------------------------------------------------------ */
/* Escoamento da Era 2 (GDD Parte 2 §3.2)                              */
/* ------------------------------------------------------------------ */

export const SUBESTACAO_138 = {
  nome: "Subestação de 138 kV",
  descricao: "Escoa 5 000 kW num raio de 4 casas. É o que faz MW andarem.",
  custoBase: 30_000,
  crescimento: 1.25,
  alcance: 4,
  tetoKw: 5_000,
  custoNivel: 3,
  tetoNivel: 2,
  nivelMax: 3,
} as const;

export const SUBESTACAO_OFFSHORE = {
  nome: "Subestação offshore",
  descricao: "Plataforma no mar raso: recolhe as eólicas do mar e entrega em terra. Alcance 4, teto 4 000 kW.",
  custoBase: 15_000,
  crescimento: 1.25,
  alcance: 4,
  tetoKw: 4_000,
  custoNivel: 3,
  tetoNivel: 2,
  nivelMax: 2,
} as const;

export const BATERIA_REDE = {
  nome: "Bateria de rede",
  nomePlural: "Baterias de rede",
  descricao: "2 000 kWh e ±1 000 kW num contêiner. Amortece a balança na escala da Era 2.",
  custoBase: 12_000,
  crescimento: 1.25,
  capacidadeKwh: 2_000,
  potenciaKw: 1_000,
  desbloqueio: { no: "bateriaDeRede" },
} as const satisfies ItemDef & { capacidadeKwh: number; potenciaKw: number };

/** O nó "Cabo HVDC" multiplica o teto de **todos** os cabos submarinos (GDD Parte 2 §3.2). */
export const HVDC = { fatorTeto: 10 } as const;

/* ------------------------------------------------------------------ */
/* Consumidores e ciência novos (GDD Parte 2 §4.2)                     */
/* ------------------------------------------------------------------ */

export const DISTRITO_INDUSTRIAL = {
  nome: "Distrito industrial",
  nomePlural: "Distritos industriais",
  descricao: "3 000 kW de demanda que paga ×2,2 por kW. Ocupa 2×2 e exige uma subestação de 138 kV no alcance.",
  custoBase: 60_000,
  crescimento: 1.25,
  demandaKw: 3_000,
  tarifa: 2.2,
  lado: 2,
  desbloqueio: { no: "industriaPesada" },
} as const;

export const INSTITUTO = {
  nome: "Instituto de pesquisa",
  nomePlural: "Institutos de pesquisa",
  descricao: "🔬 3/s consumindo 50 kW. Sobre cristal rende +50 %. Ocupa 2×2.",
  custoBase: 20_000,
  crescimento: 1.25,
  pesquisaPorSegundo: 3,
  consumoKw: 50,
  lado: 2,
  desbloqueio: { no: "institutoDePesquisa" },
} as const;
