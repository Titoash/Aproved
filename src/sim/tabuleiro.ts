/**
 * Ilha-tabuleiro (GDD §2.4, §8.5): vagas por região, alocação determinística das usinas nas vagas e locais compráveis.
 * TypeScript puro. A geometria vem de `gerarIlha`; o que muda com o jogador é `state.tabuleiro`.
 */
import { CATEGORIA_VAGA, REGIOES, VAGAS, regiaoDef, type CategoriaVaga } from "../content/era1-tabuleiro";
import { ilhaDaEra1 } from "./gerarIlha";
import { casaDoIndice, indiceCasa, naPlataforma, type Ilha, type Regiao, type RegiaoId } from "./ilha";
import type { GameState, RedeState, UsinaId } from "./state";

export type ItemVaga = UsinaId | "vila" | "bateria";

export interface Vaga {
  x: number;
  y: number;
  regiao: RegiaoId;
  categoria: CategoriaVaga;
}

export interface Colocacao extends Vaga {
  item: ItemVaga;
}

export const CATEGORIAS: readonly CategoriaVaga[] = ["vento", "sol", "vila", "bateria"];

const VIZINHOS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

type VagasRegiao = Record<CategoriaVaga, Vaga[]>;

const cache = new WeakMap<Ilha, Map<RegiaoId, VagasRegiao>>();

function vazio(): VagasRegiao {
  return { vento: [], sol: [], vila: [], bateria: [] };
}

function regiaoPorId(ilha: Ilha, id: RegiaoId): Regiao {
  const r = ilha.regioes.find((x) => x.id === id);
  if (!r) throw new Error(`Região ${id} não existe nesta ilha.`);
  return r;
}

/** Casa livre para uma vaga: terra, sem água, sem caminho, fora da plataforma, longe da borda. */
function livre(ilha: Ilha, x: number, y: number, distMin: number): boolean {
  if (x < 0 || y < 0 || x >= ilha.n || y >= ilha.n) return false;
  const i = indiceCasa(ilha.n, x, y);
  return ilha.terra[i] === 1 && ilha.agua[i] === 0 && ilha.caminho[i] === 0 && !naPlataforma(ilha.plataforma, x, y) && ilha.distBorda[i] >= distMin;
}

function encostaNoCaminho(ilha: Ilha, x: number, y: number): boolean {
  for (const [dx, dy] of VIZINHOS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= ilha.n || ny >= ilha.n) continue;
    if (ilha.caminho[indiceCasa(ilha.n, nx, ny)] === 1) return true;
  }
  return false;
}

const cheb = (a: readonly [number, number], b: readonly [number, number]) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

/** Escolhe até `n` casas da lista ordenada mantendo distância de Chebyshev ≥ 2 entre elas; depois completa com ≥ 1. */
function espacar(cand: readonly [number, number][], n: number, ocupadas: Set<number>, nCasa: number): [number, number][] {
  const escolhidas: [number, number][] = [];
  for (const passo of [2, 1]) {
    for (const c of cand) {
      if (escolhidas.length >= n) break;
      if (ocupadas.has(indiceCasa(nCasa, c[0], c[1]))) continue;
      if (escolhidas.some((e) => cheb(e, c) < passo)) continue;
      escolhidas.push(c);
      ocupadas.add(indiceCasa(nCasa, c[0], c[1]));
    }
  }
  return escolhidas;
}

/**
 * Vagas de uma região por categoria, determinísticas pela geometria.
 * Fileiras em quincôncio ordenadas pela distância ao centro da região; numa região com caminhos, vilas e baterias
 * encostam neles. Regiões mistas repartem a mesma lista na ordem `vento, sol, vila` do conteúdo.
 */
export function vagasDaRegiao(ilha: Ilha, id: RegiaoId): VagasRegiao {
  let porIlha = cache.get(ilha);
  if (!porIlha) {
    porIlha = new Map();
    cache.set(ilha, porIlha);
  }
  const pronto = porIlha.get(id);
  if (pronto) return pronto;

  const def = regiaoDef(id);
  const regiao = regiaoPorId(ilha, id);
  const resultado = vazio();
  const ocupadas = new Set<number>();
  const centro = regiao.centro;
  const dist = (x: number, y: number) => Math.hypot(x + 0.5 - (centro[0] + 0.5), y + 0.5 - (centro[1] + 0.5));

  const temCaminho = regiao.casas.some((i) => ilha.caminho[i] === 1);
  if (temCaminho) {
    // praça = casa de caminho mais perto do centro
    let praca: [number, number] = centro;
    let dm = Infinity;
    for (const i of regiao.casas) {
      if (ilha.caminho[i] !== 1) continue;
      const [x, y] = casaDoIndice(ilha.n, i);
      const d = dist(x, y);
      if (d < dm) {
        dm = d;
        praca = [x, y];
      }
    }
    const cand: [number, number][] = [];
    for (const i of regiao.casas) {
      const [x, y] = casaDoIndice(ilha.n, i);
      if (!livre(ilha, x, y, VAGAS.distanciaMinimaBorda.vila) || !encostaNoCaminho(ilha, x, y)) continue;
      cand.push([x, y]);
    }
    cand.sort((a, b) => Math.hypot(a[0] - praca[0], a[1] - praca[1]) - Math.hypot(b[0] - praca[0], b[1] - praca[1]) || indiceCasa(ilha.n, a[0], a[1]) - indiceCasa(ilha.n, b[0], b[1]));
    for (const categoria of ["vila", "bateria"] as const) {
      const n = def.vagas[categoria] ?? 0;
      if (n === 0) continue;
      resultado[categoria] = espacar(cand, n, ocupadas, ilha.n).map(([x, y]) => ({ x, y, regiao: id, categoria }));
    }
  }

  // quincôncio para as demais categorias (e para vila/bateria sem caminho)
  const fileira: [number, number][] = [];
  for (const i of regiao.casas) {
    const [x, y] = casaDoIndice(ilha.n, i);
    if (!VAGAS.quincuncio(x, y) || ocupadas.has(i)) continue;
    fileira.push([x, y]);
  }
  fileira.sort((a, b) => dist(a[0], a[1]) - dist(b[0], b[1]) || indiceCasa(ilha.n, a[0], a[1]) - indiceCasa(ilha.n, b[0], b[1]));
  let cursor = 0;
  for (const categoria of CATEGORIAS) {
    const n = def.vagas[categoria] ?? 0;
    if (n === 0 || resultado[categoria].length > 0) continue;
    const distMin = VAGAS.distanciaMinimaBorda[categoria];
    const lista: Vaga[] = [];
    while (lista.length < n && cursor < fileira.length) {
      const [x, y] = fileira[cursor++];
      if (!livre(ilha, x, y, distMin)) continue;
      const i = indiceCasa(ilha.n, x, y);
      if (ocupadas.has(i)) continue;
      ocupadas.add(i);
      lista.push({ x, y, regiao: id, categoria });
    }
    resultado[categoria] = lista;
  }

  porIlha.set(id, resultado);
  return resultado;
}

/** Vagas de uma categoria nas regiões desbloqueadas, na ordem de desbloqueio (a ordem é o que mantém a alocação estável). */
export function vagasDesbloqueadas(ilha: Ilha, desbloqueadas: readonly RegiaoId[], categoria: CategoriaVaga): Vaga[] {
  const lista: Vaga[] = [];
  for (const id of desbloqueadas) lista.push(...vagasDaRegiao(ilha, id)[categoria]);
  return lista;
}

export function vagasTotais(ilha: Ilha, desbloqueadas: readonly RegiaoId[], categoria: CategoriaVaga): number {
  return vagasDesbloqueadas(ilha, desbloqueadas, categoria).length;
}

/** Quantas unidades ocupam a categoria (as vagas do vento são divididas entre cata-ventos e turbinas eólicas). */
export function ocupadas(rede: RedeState, categoria: CategoriaVaga): number {
  switch (categoria) {
    case "vento":
      return rede.usinas.cataVento.quantidade + rede.usinas.turbinaEolica.quantidade;
    case "sol":
      return rede.usinas.painelSolar.quantidade;
    case "vila":
      return rede.vilas;
    case "bateria":
      return rede.bateria.unidades;
  }
}

export function temVaga(state: GameState, categoria: CategoriaVaga, ilha: Ilha = ilhaDaEra1()): boolean {
  return ocupadas(state.rede, categoria) < vagasTotais(ilha, state.tabuleiro.regioesDesbloqueadas, categoria);
}

export function vagasLivres(state: GameState, categoria: CategoriaVaga, ilha: Ilha = ilhaDaEra1()): number {
  return Math.max(0, vagasTotais(ilha, state.tabuleiro.regioesDesbloqueadas, categoria) - ocupadas(state.rede, categoria));
}

/**
 * Ocupa `n` vagas do item, região por região na ordem de desbloqueio; dentro de cada região, do início ou do fim.
 * Só passa para a região seguinte quando a atual não tem mais vaga livre: desbloquear um local nunca move ninguém.
 */
function ocupar(porRegiao: readonly Vaga[][], usadas: Set<number>, item: ItemVaga, n: number, doFim: boolean, saida: Colocacao[], nCasa: number): number {
  let restam = n;
  for (const lista of porRegiao) {
    let k = doFim ? lista.length - 1 : 0;
    while (restam > 0 && k >= 0 && k < lista.length) {
      const v = lista[k];
      k += doFim ? -1 : 1;
      const i = indiceCasa(nCasa, v.x, v.y);
      if (usadas.has(i)) continue;
      usadas.add(i);
      saida.push({ ...v, item });
      restam--;
    }
    if (restam === 0) break;
  }
  return restam;
}

/**
 * Onde cada unidade da Rede fica na ilha, só a partir das contagens (nada de arrastar).
 * Cata-ventos enchem as vagas de vento a partir do início de cada região; turbinas eólicas, a partir do fim:
 * comprar um tipo nunca move o outro, e abrir um local nunca move ninguém.
 * Unidades além das vagas (saves antigos) não aparecem, mas continuam produzindo (`excedentes`).
 */
export function alocacao(ilha: Ilha, desbloqueadas: readonly RegiaoId[], rede: RedeState): Colocacao[] {
  const saida: Colocacao[] = [];
  const usadas = new Set<number>();
  const por = (categoria: CategoriaVaga) => desbloqueadas.map((id) => vagasDaRegiao(ilha, id)[categoria]);
  const vento = por("vento");
  ocupar(vento, usadas, "cataVento", rede.usinas.cataVento.quantidade, false, saida, ilha.n);
  ocupar(vento, usadas, "turbinaEolica", rede.usinas.turbinaEolica.quantidade, true, saida, ilha.n);
  ocupar(por("sol"), usadas, "painelSolar", rede.usinas.painelSolar.quantidade, false, saida, ilha.n);
  ocupar(por("vila"), usadas, "vila", rede.vilas, false, saida, ilha.n);
  ocupar(por("bateria"), usadas, "bateria", rede.bateria.unidades, false, saida, ilha.n);
  return saida;
}

/** Unidades sem vaga por categoria (só acontece em saves de antes da ilha). */
export function excedentes(ilha: Ilha, desbloqueadas: readonly RegiaoId[], rede: RedeState): Record<CategoriaVaga, number> {
  const r = { vento: 0, sol: 0, vila: 0, bateria: 0 };
  for (const c of CATEGORIAS) r[c] = Math.max(0, ocupadas(rede, c) - vagasTotais(ilha, desbloqueadas, c));
  return r;
}

/* ------------------------------------------------------------------ */
/* Locais compráveis                                                  */
/* ------------------------------------------------------------------ */

export function custoRegiao(id: RegiaoId): number | null {
  return regiaoDef(id).preco ?? null;
}

export function regiaoDesbloqueada(state: GameState, id: RegiaoId): boolean {
  return state.tabuleiro.regioesDesbloqueadas.includes(id);
}

export function regioesBloqueadas(state: GameState): RegiaoId[] {
  return REGIOES.filter((r) => !regiaoDesbloqueada(state, r.id)).map((r) => r.id);
}

export function podeDesbloquearRegiao(state: GameState, id: RegiaoId): boolean {
  const custo = custoRegiao(id);
  return custo !== null && !regiaoDesbloqueada(state, id) && state.creditos >= custo;
}

export function desbloquearRegiao(state: GameState, id: RegiaoId): GameState | null {
  if (!podeDesbloquearRegiao(state, id)) return null;
  const custo = custoRegiao(id) ?? 0;
  return {
    ...state,
    creditos: state.creditos - custo,
    tabuleiro: { regioesDesbloqueadas: [...state.tabuleiro.regioesDesbloqueadas, id] },
    eventos: [...state.eventos, { tipo: "regiaoDesbloqueada", id }],
  };
}

/** O local bloqueado mais barato que tem vaga da categoria — a dica do botão "sem vaga". */
export function proximaRegiaoComVaga(state: GameState, categoria: CategoriaVaga): RegiaoId | null {
  const candidatas = regioesBloqueadas(state)
    .map((id) => regiaoDef(id))
    .filter((r) => (r.vagas[categoria] ?? 0) > 0 && r.preco !== undefined)
    .sort((a, b) => (a.preco ?? 0) - (b.preco ?? 0));
  return candidatas[0]?.id ?? null;
}

export const categoriaDoItem = (item: ItemVaga): CategoriaVaga => CATEGORIA_VAGA[item];
