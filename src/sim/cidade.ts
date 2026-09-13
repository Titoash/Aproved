/**
 * Cidade: densidade dos bairros, evolução, população e tarifa (GDD §2.5, §7, §8.6, v0.6).
 * TypeScript puro. Nenhum número aqui — tudo vem de `content/cidade-era1.ts`.
 *
 * A evolução é **por gasto** (₵ + 🔬), nunca por satisfação: bairro mais denso pede mais kW, abriga
 * mais gente e **paga mais por kW**. É o único jeito de a população crescer (GDD §7: "população só
 * cresce com bairro evoluído").
 */
import { DENSIDADES, UNIVERSIDADE, type DensidadeDef } from "../content/cidade-era1";
import type { Construcao, GameState, MundoState } from "./state";

/** Definição da densidade de um bairro a partir do nível da construção (0 = aldeia). */
export function densidadeDoNivel(nivel: number): DensidadeDef {
  return DENSIDADES[Math.max(0, Math.min(DENSIDADES.length - 1, Math.floor(nivel)))];
}

export function densidadeDe(c: Construcao): DensidadeDef {
  return densidadeDoNivel(c.nivel);
}

/** Custo de evoluir um bairro deste nível; `null` na metrópole. */
export function custoEvolucao(nivel: number): { creditos: number; pesquisa: number } | null {
  return densidadeDoNivel(nivel).evolucao;
}

export interface RecusaEvolucao {
  ok: boolean;
  motivo: string | null;
}

export function avaliarEvolucao(state: GameState, indice: number): RecusaEvolucao {
  const c = state.mundo.construcoes[indice];
  if (!c || c.tipo !== "bairro") return { ok: false, motivo: "Só bairros evoluem" };
  const custo = custoEvolucao(c.nivel);
  if (!custo) return { ok: false, motivo: "Metrópole: não há densidade acima" };
  if (state.creditos < custo.creditos) return { ok: false, motivo: "₵ insuficientes" };
  if (state.pesquisa < custo.pesquisa) return { ok: false, motivo: `Precisa de 🔬 ${custo.pesquisa}` };
  return { ok: true, motivo: null };
}

export function podeEvoluirBairro(state: GameState, indice: number): boolean {
  return avaliarEvolucao(state, indice).ok;
}

/** Gasta ₵ + 🔬 e sobe um degrau de densidade (GDD §8.6). Função pura. */
export function evoluirBairro(state: GameState, indice: number): GameState | null {
  if (!podeEvoluirBairro(state, indice)) return null;
  const c = state.mundo.construcoes[indice];
  const custo = custoEvolucao(c.nivel);
  if (!custo) return null;
  const construcoes = { ...state.mundo.construcoes, [indice]: { ...c, nivel: c.nivel + 1 } };
  return {
    ...state,
    creditos: state.creditos - custo.creditos,
    pesquisa: state.pesquisa - custo.pesquisa,
    mundo: { ...state.mundo, construcoes },
    eventos: [...state.eventos, { tipo: "bairroEvoluido", indice, densidade: densidadeDoNivel(c.nivel + 1).densidade }],
  };
}

/** População total: a soma da população da densidade de cada bairro colocado. */
export function populacaoDoMundo(mundo: MundoState): number {
  let total = 0;
  for (const chave of Object.keys(mundo.construcoes)) {
    const c = mundo.construcoes[Number(chave)];
    if (c.tipo === "bairro") total += densidadeDe(c).populacao;
  }
  return total;
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
