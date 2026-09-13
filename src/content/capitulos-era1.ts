/**
 * Capítulos da Era 1 (GDD §12, v0.6; inspirados nos capítulos do Reactor 2, `docs/analises`).
 * Só dados: a condição é uma estrutura que `sim/capitulos.ts` sabe medir.
 *
 * Um objetivo ativo por vez, curto, sempre com a recompensa à vista. Servem de trilho para quem abre o
 * jogo pela primeira vez e de régua de ritmo para a simulação de 60 minutos (parte F da Sessão 7).
 */
import type { TipoConstrucao } from "../sim/state";
import type { IlhaId, TipoTerreno } from "./era1-arquipelago";

export type CondicaoCapitulo =
  /** Ter `n` construções do tipo (opcionalmente num terreno). */
  | { tipo: "construcoes"; construcao: TipoConstrucao; n: number; terreno?: TipoTerreno }
  /** Ter um bairro na densidade pedida ou acima. */
  | { tipo: "densidade"; minima: number }
  /** População total. */
  | { tipo: "populacao"; n: number }
  /** Nós da árvore comprados (sem contar os que nascem prontos). */
  | { tipo: "pesquisados"; n: number }
  /** Núcleo desbloqueado. */
  | { tipo: "nucleo" }
  /** Peças do Núcleo de um tipo. */
  | { tipo: "pecas"; peca: "heliostato" | "turbina" | "radiador" | "tanque"; n: number }
  /** A balança da Rede na zona de ouro. */
  | { tipo: "zonaDeOuro" }
  /** Estabilidade em `valor` % ou mais. */
  | { tipo: "estabilidade"; valor: number }
  /** Potência instalada, em kW. */
  | { tipo: "potenciaKw"; kw: number }
  /** Ilha aberta pela expedição. */
  | { tipo: "ilhaAberta"; ilha: IlhaId }
  /** Ilha ligada por cabo submarino. */
  | { tipo: "cabo"; ilha: IlhaId }
  /** Obstáculos já removidos. */
  | { tipo: "desmatados"; n: number };

export interface CapituloDef {
  id: string;
  titulo: string;
  /** Uma linha do que fazer. */
  objetivo: string;
  condicao: CondicaoCapitulo;
  recompensa: { creditos?: number; pesquisa?: number };
}

/** A ordem é a ordem do jogo: um capítulo ativo por vez. */
export const CAPITULOS: readonly CapituloDef[] = [
  {
    id: "primeirosVentos",
    titulo: "Os primeiros ventos",
    objetivo: "Coloque 5 cata-ventos.",
    condicao: { tipo: "construcoes", construcao: "cataVento", n: 5 },
    recompensa: { creditos: 40 },
  },
  {
    id: "colina",
    titulo: "Onde o vento passa",
    objetivo: "Coloque 5 cata-ventos numa colina (+25 % de vento).",
    condicao: { tipo: "construcoes", construcao: "cataVento", n: 5, terreno: "colina" },
    recompensa: { creditos: 120 },
  },
  {
    id: "equilibrio",
    titulo: "A balança na faixa",
    objetivo: "Ponha a Rede na zona de ouro (r entre 0,9 e 1,1).",
    condicao: { tipo: "zonaDeOuro" },
    recompensa: { creditos: 150 },
  },
  {
    id: "espaco",
    titulo: "Espaço é conquistado",
    objetivo: "Remova 8 obstáculos.",
    condicao: { tipo: "desmatados", n: 8 },
    recompensa: { creditos: 200 },
  },
  {
    id: "ciencia",
    titulo: "A primeira ciência",
    objetivo: "Coloque 2 laboratórios.",
    condicao: { tipo: "construcoes", construcao: "laboratorio", n: 2 },
    recompensa: { pesquisa: 20 },
  },
  {
    id: "torre",
    titulo: "A Torre",
    objetivo: "Desbloqueie o Núcleo por ₵ 100.",
    condicao: { tipo: "nucleo" },
    recompensa: { creditos: 120 },
  },
  {
    id: "espelhos",
    titulo: "Concentrar o Sol",
    objetivo: "Coloque 4 heliostatos e 2 turbinas na grade.",
    condicao: { tipo: "pecas", peca: "heliostato", n: 4 },
    recompensa: { pesquisa: 25 },
  },
  {
    id: "primeiroNo",
    titulo: "🔬 tem para onde ir",
    objetivo: "Pesquise o primeiro nó da árvore.",
    condicao: { tipo: "pesquisados", n: 1 },
    recompensa: { creditos: 200 },
  },
  {
    id: "vila",
    titulo: "A aldeia vira vila",
    objetivo: "Evolua um bairro para densidade 2.",
    condicao: { tipo: "densidade", minima: 2 },
    recompensa: { creditos: 300, pesquisa: 20 },
  },
  {
    id: "ventania",
    titulo: "A ilha do vento",
    objetivo: "Faça a expedição para Ventania.",
    condicao: { tipo: "ilhaAberta", ilha: "ventania" },
    recompensa: { creditos: 400 },
  },
  {
    id: "caboVentania",
    titulo: "Ligar a Ventania",
    objetivo: "Ligue o cabo submarino de Ventania.",
    condicao: { tipo: "cabo", ilha: "ventania" },
    recompensa: { creditos: 500, pesquisa: 30 },
  },
  {
    id: "cidade",
    titulo: "Uma cidade de verdade",
    objetivo: "Chegue a 2 000 habitantes.",
    condicao: { tipo: "populacao", n: 2_000 },
    recompensa: { creditos: 800 },
  },
  {
    id: "universidade",
    titulo: "Gente pensando",
    objetivo: "Coloque a primeira universidade.",
    condicao: { tipo: "construcoes", construcao: "universidade", n: 1 },
    recompensa: { pesquisa: 120 },
  },
  {
    id: "cemKw",
    titulo: "Cem quilowatts",
    objetivo: "Chegue a 100 kW instalados.",
    condicao: { tipo: "potenciaKw", kw: 100 },
    recompensa: { creditos: 1_200 },
  },
  {
    id: "arvoreFunda",
    titulo: "Ciência aplicada",
    objetivo: "Pesquise 6 nós da árvore.",
    condicao: { tipo: "pesquisados", n: 6 },
    recompensa: { creditos: 1_500, pesquisa: 100 },
  },
  {
    id: "metropole",
    titulo: "A metrópole",
    objetivo: "Leve um bairro à densidade 4.",
    condicao: { tipo: "densidade", minima: 4 },
    recompensa: { creditos: 3_000, pesquisa: 200 },
  },
  {
    id: "estabilidade",
    titulo: "Estabilidade 100 %",
    objetivo: "Opere o Núcleo até a Estabilidade chegar a 100 %.",
    condicao: { tipo: "estabilidade", valor: 100 },
    recompensa: { creditos: 5_000 },
  },
];

export const CAPITULO_POR_ID: Record<string, CapituloDef> = Object.fromEntries(CAPITULOS.map((c) => [c.id, c]));
