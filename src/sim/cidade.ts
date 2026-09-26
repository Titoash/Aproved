/**
 * Cidade: densidade, evolução, população e ciência da população (GDD §2.5, §7, §8.6; v0.6 e v0.8).
 * TypeScript puro. Nenhum número aqui — tudo vem de `content/cidade*.ts`.
 *
 * A densidade é **da cidade** (v0.8): um botão evolui todos os bairros de uma vez, ao custo da evolução
 * × N bairros, em ₵ e 🔬. É por gasto, nunca por satisfação: bairro mais denso pede mais kW, abriga mais
 * gente e **paga mais por kW** — e é o único jeito de a população crescer (§7).
 *
 * Bairro novo nasce na densidade da cidade e paga a aldeia (₵ 40 × 1,25ⁿ) **mais o que a cidade pagou
 * por bairro para chegar lá**, em ₵ e 🔬 (Sessão 9). Assim é indiferente evoluir antes ou depois de
 * construir; com o "× 2,5^(d−1)" só em ₵ da v0.8, evoluir com um bairro e construir o resto depois
 * pagava a 🔬 da evolução uma vez em vez de N vezes.
 */
import { UNIVERSIDADE } from "../content/cidade-era1";
import { DENSIDADES, type Densidade, type DensidadeDef } from "../content/cidade";
import { NO_POR_ID } from "../content/arvore";
import type { GameState, MundoState } from "./state";

/** Definição de uma densidade (1 = aldeia … 6 = arcologia), limitada à escada. */
export function defDaDensidade(densidade: number): DensidadeDef {
  const i = Math.max(1, Math.min(DENSIDADES.length, Math.floor(densidade))) - 1;
  return DENSIDADES[i];
}

/** A densidade da cidade do estado. */
export function defDaCidade(state: GameState): DensidadeDef {
  return defDaDensidade(state.cidade.densidade);
}

/** Bairros colocados, contados direto do mundo (sem depender do cache da análise). */
export function contarBairros(mundo: MundoState): number {
  let n = 0;
  for (const chave of Object.keys(mundo.construcoes)) if (mundo.construcoes[Number(chave)].tipo === "bairro") n++;
  return n;
}

/** O que a cidade pagou **por bairro** para ir da aldeia até a densidade `d`: a soma das evoluções. */
export function custoAcumuladoPorBairro(densidade: number): { creditos: number; pesquisa: number } {
  let creditos = 0;
  let pesquisa = 0;
  for (let d = 1; d < densidade; d++) {
    const evolucao = defDaDensidade(d).evolucao;
    if (!evolucao) break;
    creditos += evolucao.creditos;
    pesquisa += evolucao.pesquisa;
  }
  return { creditos, pesquisa };
}

export interface CustoEvolucaoCidade {
  creditos: number;
  pesquisa: number;
  bairros: number;
}

/** Custo de evoluir a cidade inteira: a evolução de um bairro × N bairros. `null` na densidade máxima. */
export function custoEvolucaoCidade(state: GameState): CustoEvolucaoCidade | null {
  const evolucao = defDaCidade(state).evolucao;
  if (!evolucao) return null;
  const bairros = contarBairros(state.mundo);
  return { creditos: evolucao.creditos * bairros, pesquisa: evolucao.pesquisa * bairros, bairros };
}

export interface RecusaEvolucao {
  ok: boolean;
  motivo: string | null;
}

export function avaliarEvolucaoCidade(state: GameState): RecusaEvolucao {
  const atual = defDaCidade(state);
  const custo = custoEvolucaoCidade(state);
  if (!custo) return { ok: false, motivo: `${atual.nome}: não há densidade acima` };
  // Sem bairro, a evolução sairia de graça (0 × custo) e o bairro novo nasceria nela.
  if (custo.bairros === 0) return { ok: false, motivo: "Coloque um bairro primeiro" };
  // As densidades 5 e 6 pedem nó da árvore da Era 2 (GDD Parte 2 §4.1).
  const proxima = defDaDensidade(atual.densidade + 1);
  if (proxima.no && !state.pesquisados.includes(proxima.no)) {
    return { ok: false, motivo: `Exige o nó "${NO_POR_ID[proxima.no]?.nome ?? proxima.no}"` };
  }
  if (state.creditos < custo.creditos) return { ok: false, motivo: "₵ insuficientes" };
  if (state.pesquisa < custo.pesquisa) return { ok: false, motivo: `Precisa de 🔬 ${custo.pesquisa}` };
  return { ok: true, motivo: null };
}

export function podeEvoluirCidade(state: GameState): boolean {
  return avaliarEvolucaoCidade(state).ok;
}

/** Gasta ₵ + 🔬 × N e sobe a cidade inteira um degrau de densidade (GDD §8.6, v0.8). Função pura. */
export function evoluirCidade(state: GameState): GameState | null {
  if (!podeEvoluirCidade(state)) return null;
  const custo = custoEvolucaoCidade(state)!;
  const densidade = (state.cidade.densidade + 1) as Densidade;
  return {
    ...state,
    creditos: state.creditos - custo.creditos,
    pesquisa: state.pesquisa - custo.pesquisa,
    cidade: { densidade },
    eventos: [...state.eventos, { tipo: "cidadeEvoluida", densidade, bairros: custo.bairros }],
  };
}

/** População da cidade: N bairros × a população da densidade. */
export function populacaoDaCidade(bairros: number, densidade: number): number {
  return bairros * defDaDensidade(densidade).populacao;
}

/** Quantas universidades a população sustenta: 1 por 2 000 habitantes, a partir de 1 000 (GDD §8.6). */
export function limiteUniversidades(populacao: number): number {
  if (populacao < UNIVERSIDADE.populacaoMinima) return 0;
  return Math.max(1, Math.floor(populacao / UNIVERSIDADE.populacaoPorUnidade));
}

/**
 * 🔬/s de **uma** universidade: `0,5 × √(alunos ÷ 1 000)`, com `alunos = população ÷ universidades ativas`
 * (GDD §8.6, ajuste 3 da Sessão 7). Quatro universidades dividindo 16 400 habitantes rendem 4 🔬/s no
 * total, não 8: a ciência cresce com gente, não com prédio.
 */
export function pesquisaUniversidade(populacao: number, universidades = 1): number {
  const ativas = Math.max(1, universidades);
  const alunos = Math.max(0, populacao) / ativas;
  return UNIVERSIDADE.pesquisaBase * Math.sqrt(alunos / UNIVERSIDADE.populacaoReferencia);
}
