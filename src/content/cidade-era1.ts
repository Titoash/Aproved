/**
 * Cidade, laboratório e universidade da Era 1 (GDD §2.5, §7, §8.6, v0.6).
 * Só dados: nenhuma regra aqui. `sim/cidade.ts` e `sim/producao.ts` leem daqui.
 */

export type { Densidade, DensidadeDef } from "./cidade-tipos";
import type { DensidadeDef } from "./cidade-tipos";

/**
 * GDD §8.6. A curva de evolução é quase exponencial de propósito: ₵ ×2,5 e 🔬 ×5 por degrau, contra
 * demanda ×2,5 e população ×4. Evoluir nunca acontece sozinho — é decisão do jogador (§2.5).
 */
export const DENSIDADES_ERA1: readonly DensidadeDef[] = [
  {
    densidade: 1,
    nome: "Aldeia",
    nomePlural: "Aldeias",
    descricao: "Casas baixas em volta de um caminho de terra.",
    demandaKw: 8,
    populacao: 100,
    tarifa: 1,
    evolucao: { creditos: 250, pesquisa: 30 },
  },
  {
    densidade: 2,
    nome: "Vila",
    nomePlural: "Vilas",
    descricao: "Ruas, comércio e a primeira escola.",
    demandaKw: 20,
    populacao: 400,
    tarifa: 1.15,
    evolucao: { creditos: 625, pesquisa: 150 },
  },
  {
    densidade: 3,
    nome: "Cidade",
    nomePlural: "Cidades",
    descricao: "Prédios de quatro andares e um bairro industrial.",
    demandaKw: 48,
    populacao: 1_600,
    tarifa: 1.3,
    evolucao: { creditos: 1_562, pesquisa: 600 },
  },
  {
    densidade: 4,
    nome: "Metrópole",
    nomePlural: "Metrópoles",
    descricao: "Torres, metrô e consumo que não dorme.",
    demandaKw: 110,
    populacao: 6_400,
    tarifa: 1.5,
    // A partir daqui é Era 2 (GDD Parte 2 §4.1): o degrau custa ×25 em ₵ e ×5 em 🔬.
    evolucao: { creditos: 97_650, pesquisa: 3_000 },
  },
];

/** Bairro novo: ₵ 40 × 1,25ⁿ, 1 casa, precisa de subestação no alcance (GDD §8.6). */
export const BAIRRO = {
  nome: "Bairro",
  nomePlural: "Bairros",
  descricao: "Gente ligada à rede. Pede energia, paga por ela e pode evoluir.",
  custoBase: 40,
  crescimento: 1.25,
} as const;

/** Laboratório: a primeira ciência, antes do Núcleo (GDD §2.5, §8.6). */
export const LABORATORIO = {
  nome: "Laboratório",
  nomePlural: "Laboratórios",
  descricao: "🔬 0,2/s enquanto consome 2 kW. A primeira ciência vem daqui, antes da Torre.",
  custoBase: 60,
  crescimento: 1.25,
  pesquisaPorSegundo: 0.2,
  consumoKw: 2,
} as const;

/**
 * Universidade: liberada com 1 000 habitantes, no máximo 1 por 2 000 (GDD §8.6).
 * 🔬/s = `pesquisaBase × √(alunos ÷ populacaoReferencia)`, e **alunos = população ÷ universidades ativas**
 * (ajuste 3 da Sessão 7): mais gente, mais ciência — com retorno decrescente, que é o que a raiz quer
 * dizer, e sem multiplicar a ciência por abrir prédio novo sem gente nova.
 */
export const UNIVERSIDADE = {
  nome: "Universidade",
  nomePlural: "Universidades",
  descricao: "🔬 0,5/s pela raiz dos alunos (população ÷ universidades), consumindo 5 kW. 1 por 2 000 habitantes.",
  custoBase: 400,
  crescimento: 1.5,
  pesquisaBase: 0.5,
  populacaoReferencia: 1_000,
  consumoKw: 5,
  /** População total para liberar a primeira. */
  populacaoMinima: 1_000,
  /** Habitantes por universidade permitida. */
  populacaoPorUnidade: 2_000,
} as const;
