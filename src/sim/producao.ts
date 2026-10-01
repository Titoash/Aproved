/**
 * O que o mundo produz e o que a rede consegue escoar (GDD §2.4, §7, v0.6; Parte 2 §3). TypeScript puro.
 *
 * Produção de uma usina = base × nível do tipo × nós da árvore × terreno × esteira × sombra × picos.
 * Os níveis são **por tipo** (v0.8, `state.melhorias`): usinas, subestações, cabos e ciência.
 * Uma usina só vende se estiver no alcance de uma subestação com folga no teto; o resto é desperdiçado e
 * aparece como "sem escoamento" (o sumidouro de §7). Um bairro só pede energia se tiver subestação no
 * alcance. Ilha sem cabo submarino só alimenta os bairros dela mesma.
 *
 * A Era 2 acrescenta três coisas ao mundo, sem mexer em nenhuma fórmula de §4.1: construções **2×2**
 * (a construção vive na âncora e ocupa quatro casas), **mar raso** como casa colocável (cada casa de
 * mar pertence à ilha cujo litoral está mais perto) e **custo de operação** (a térmica a gás queima
 * ₵/s enquanto liga, e isso entra no extrato como despesa).
 *
 * As contagens da Rede são **derivadas** daqui. O resultado é memoizado por identidade de
 * `mundo`/`melhorias`/efeitos: o tick não recalcula à toa.
 */
import { BATERIA } from "../content/era1";
import { USINAS } from "../content/usinas";
import { BATERIA_REDE, DISTRITO_INDUSTRIAL, INSTITUTO, SUBESTACAO_138, SUBESTACAO_OFFSHORE, TERMICA } from "../content/era2";
import { CRISTAL } from "../content/era1-arquipelago";
import { LABORATORIO, UNIVERSIDADE } from "../content/cidade-era1";
import { CABO, OBSTACULOS, ORDEM_OBSTACULOS, SUBESTACAO, TERRENOS, VIZINHANCA, type IlhaId, type TipoObstaculo, type TipoTerreno } from "../content/era1-arquipelago";
import { defDaDensidade, limiteUniversidades, pesquisaUniversidade } from "./cidade";
import { ORDEM_TERRENOS, indiceCasa, type Arquipelago } from "./arquipelago";
import { fatorCiencia, fatorUsina } from "./niveis";
import { efeitosDe, efeitosNeutros, type EfeitosArvore } from "./efeitos";
import { arquipelagoDaEra1 } from "./gerarArquipelago";
import type { CidadeState, Construcao, GameState, MelhoriasState, MundoState, RedeDerivada, TipoConstrucao, UsinaId } from "./state";

const USINAS_VENTO: readonly UsinaId[] = ["cataVento", "turbinaEolica", "eolicaOffshore"];
const USINAS_SOL: readonly UsinaId[] = ["painelSolar", "fazendaSolar"];
/** Construções que fazem sombra nos painéis vizinhos (GDD §2.4). */
const CONSTRUCOES_ALTAS: readonly TipoConstrucao[] = ["turbinaEolica", "eolicaOffshore", "termicaGas"];
const VIZINHOS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export const ehUsina = (tipo: TipoConstrucao): tipo is UsinaId => tipo in USINAS;
export const ehVento = (tipo: TipoConstrucao): boolean => USINAS_VENTO.includes(tipo as UsinaId);
export const ehSolar = (tipo: TipoConstrucao): boolean => USINAS_SOL.includes(tipo as UsinaId);
export const ehAlto = (tipo: TipoConstrucao): boolean => CONSTRUCOES_ALTAS.includes(tipo);

/* ------------------------------------------------------------------ */
/* Subestações das duas eras (GDD §8.5 e Parte 2 §3.2)                 */
/* ------------------------------------------------------------------ */

export interface EscoamentoDef {
  nome: string;
  descricao: string;
  custoBase: number;
  crescimento: number;
  alcance: number;
  tetoKw: number;
  custoNivel: number;
  tetoNivel: number;
  nivelMax: number;
  /** Vai em casa de mar raso (subestação offshore). */
  agua?: boolean;
}

export const ESCOAMENTO: Record<"subestacao" | "subestacao138" | "subestacaoOffshore", EscoamentoDef> = {
  subestacao: SUBESTACAO,
  subestacao138: SUBESTACAO_138,
  subestacaoOffshore: { ...SUBESTACAO_OFFSHORE, agua: true },
};

export const ehSubestacao = (tipo: TipoConstrucao): tipo is keyof typeof ESCOAMENTO => tipo in ESCOAMENTO;

/** Teto de uma subestação do tipo no nível dado: teto base × 2ⁿ (GDD §8.5, Parte 2 §3.2). */
export function tetoDeSubestacao(tipo: keyof typeof ESCOAMENTO, nivel: number): number {
  const def = ESCOAMENTO[tipo];
  return def.tetoKw * Math.pow(def.tetoNivel, nivel);
}

/** Lado em casas da construção: 2 = 2×2 da Era 2 (GDD Parte 2 §3.1, §4.2). */
export function ladoConstrucao(tipo: TipoConstrucao): number {
  if (ehUsina(tipo)) return USINAS[tipo].lado ?? 1;
  if (tipo === "distritoIndustrial") return DISTRITO_INDUSTRIAL.lado;
  if (tipo === "institutoPesquisa") return INSTITUTO.lado;
  return 1;
}

/** Casas ocupadas por uma construção ancorada nesta casa (a âncora é o canto noroeste). */
export function casasDaConstrucao(ancora: number, tipo: TipoConstrucao, n: number): number[] {
  const lado = ladoConstrucao(tipo);
  if (lado === 1) return [ancora];
  const x = ancora % n;
  const y = Math.floor(ancora / n);
  const casas: number[] = [];
  for (let dy = 0; dy < lado; dy++) for (let dx = 0; dx < lado; dx++) casas.push((y + dy) * n + x + dx);
  return casas;
}

/** A construção **colocável só em água** (eólica e subestação offshore). */
export function ehDeAgua(tipo: TipoConstrucao): boolean {
  if (ehUsina(tipo)) return USINAS[tipo].agua === true;
  return tipo === "subestacaoOffshore";
}

/* ------------------------------------------------------------------ */
/* Ocupação: a âncora de cada casa                                     */
/* ------------------------------------------------------------------ */

/** Casa → âncora da construção que ocupa a casa. Memoizado por identidade do mundo. */
const ocupacaoCache = new WeakMap<MundoState, Map<number, number>>();

export function ocupacaoDe(mundo: MundoState, arq: Arquipelago = arquipelagoDaEra1()): Map<number, number> {
  let mapa = ocupacaoCache.get(mundo);
  if (!mapa) {
    mapa = new Map();
    for (const chave of Object.keys(mundo.construcoes)) {
      const ancora = Number(chave);
      for (const casa of casasDaConstrucao(ancora, mundo.construcoes[ancora].tipo, arq.n)) mapa.set(casa, ancora);
    }
    ocupacaoCache.set(mundo, mapa);
  }
  return mapa;
}

/** Âncora da construção que ocupa esta casa (ela mesma, ou o canto noroeste de uma 2×2). */
export function ancoraEm(mundo: MundoState, indice: number, arq: Arquipelago = arquipelagoDaEra1()): number | null {
  return ocupacaoDe(mundo, arq).get(indice) ?? null;
}

/** Construção que ocupa esta casa, mesmo que a âncora seja outra. */
export function construcaoQueOcupa(mundo: MundoState, indice: number, arq: Arquipelago = arquipelagoDaEra1()): Construcao | null {
  const ancora = ancoraEm(mundo, indice, arq);
  return ancora === null ? null : mundo.construcoes[ancora];
}

/* ------------------------------------------------------------------ */
/* Conjuntos memoizados do mundo                                       */
/* ------------------------------------------------------------------ */

/** Conjunto das casas já desmatadas, memoizado por identidade do mundo (o `includes` custa caro no tick). */
const removidosCache = new WeakMap<MundoState, Set<number>>();

export function removidosDe(mundo: MundoState): Set<number> {
  let conjunto = removidosCache.get(mundo);
  if (!conjunto) {
    conjunto = new Set(mundo.removidos);
    removidosCache.set(mundo, conjunto);
  }
  return conjunto;
}

/** Obstáculo ainda de pé nesta casa (o de nascença menos os já removidos). */
export function obstaculoEm(mundo: MundoState, indice: number, arq: Arquipelago = arquipelagoDaEra1()): TipoObstaculo | null {
  const o = arq.obstaculos[indice];
  if (o === 255) return null;
  if (removidosDe(mundo).has(indice)) return null;
  return ORDEM_OBSTACULOS[o];
}

export function terrenoEm(indice: number, arq: Arquipelago = arquipelagoDaEra1()): TipoTerreno | null {
  const t = arq.terreno[indice];
  return t === 255 ? null : ORDEM_TERRENOS[t];
}

/** Casa de rocha com cristal, aberta por uma montanha dinamitada (GDD §8.6, §9). */
export function temCristal(mundo: MundoState, indice: number): boolean {
  return cristaisDe(mundo).has(indice);
}

/** Conjunto das casas de cristal, memoizado por identidade do mundo (o `includes` custa caro no tick). */
const cristaisCache = new WeakMap<MundoState, Set<number>>();

export function cristaisDe(mundo: MundoState): Set<number> {
  let conjunto = cristaisCache.get(mundo);
  if (!conjunto) {
    conjunto = new Set(mundo.cristais);
    cristaisCache.set(mundo, conjunto);
  }
  return conjunto;
}

/** Terreno de jogo de uma casa: a montanha dinamitada deixa **rocha** (GDD §8.5, ajuste 2). */
export function terrenoDeJogo(mundo: MundoState, indice: number, arq: Arquipelago = arquipelagoDaEra1()): TipoTerreno | null {
  if (temCristal(mundo, indice)) return "rocha";
  return terrenoEm(indice, arq);
}

export function ilhaDaCasa(indice: number, arq: Arquipelago = arquipelagoDaEra1()): IlhaId | null {
  const q = ilhaEfetivaDe(arq)[indice];
  return q < 0 ? null : arq.ilhas[q].id;
}

/* ------------------------------------------------------------------ */
/* Mar: raso, fundo e a ilha dona de cada casa de água                 */
/* ------------------------------------------------------------------ */

/** Até esta distância da terra o mar é **raso** — as três faixas já desenhadas na cena. */
export const PROFUNDIDADE_RASA = 3;

export const ehMar = (indice: number, arq: Arquipelago): boolean => arq.terra[indice] !== 1;
export const ehMarRaso = (indice: number, arq: Arquipelago): boolean =>
  ehMar(indice, arq) && arq.distMar[indice] >= 1 && arq.distMar[indice] <= PROFUNDIDADE_RASA;

/**
 * Ilha de cada casa, **incluindo o mar**: uma casa de água pertence à ilha cujo litoral está mais
 * perto, e no empate à de menor índice (GDD Parte 2 §3.1). Busca em largura a partir da terra, uma
 * vez por arquipélago.
 */
const ilhaEfetivaCache = new WeakMap<Arquipelago, Int8Array>();

export function ilhaEfetivaDe(arq: Arquipelago): Int8Array {
  let mapa = ilhaEfetivaCache.get(arq);
  if (mapa) return mapa;
  const n = arq.n;
  mapa = new Int8Array(arq.ilha);
  const fila: number[] = [];
  for (let i = 0; i < n * n; i++) if (arq.ilha[i] >= 0) fila.push(i);
  let inicio = 0;
  while (inicio < fila.length) {
    const fim = fila.length;
    for (let k = inicio; k < fim; k++) {
      const i = fila[k];
      const x = i % n;
      const y = Math.floor(i / n);
      for (const [dx, dy] of VIZINHOS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const j = indiceCasa(n, nx, ny);
        if (mapa[j] >= 0) continue;
        mapa[j] = mapa[i];
        fila.push(j);
      }
    }
    inicio = fim;
  }
  ilhaEfetivaCache.set(arq, mapa);
  return mapa;
}

/* ------------------------------------------------------------------ */
/* Análise                                                            */
/* ------------------------------------------------------------------ */

export interface UsinaAnalise {
  indice: number;
  tipo: UsinaId;
  terreno: TipoTerreno;
  /** kW que a usina produz. */
  brutoKw: number;
  /** kW que chegam à rede (limitados pelo alcance e pelo teto das subestações). */
  escoadoKw: number;
  fatorTerreno: number;
  fatorEsteira: number;
  fatorSombra: number;
  fatorPico: number;
  /** Casa da subestação que a escoa; `null` = sem escoamento. */
  subestacao: number | null;
  /** ₵/s de combustível enquanto liga (térmica a gás; 0 nas outras). */
  custoPorSegundo: number;
  /** Fração do tempo ligada: a térmica só queima o que vende (a chaminé da cena fumega com ela). 1 nas outras. */
  fracaoLigada: number;
}

/**
 * Quem consome, para a cena (GDD §10.1, parte F da Sessão 9): o fio da subestação até ele e o que ele rende.
 * `peso` é a fatia dele na receita (demanda × tarifa); a ciência não paga tarifa e rende `pesquisaPorSegundo`.
 */
export interface ConsumidorAnalise {
  indice: number;
  tipo: TipoConstrucao;
  /** Casa da subestação que o atende. */
  subestacao: number;
  /** Fatia da receita (soma 1 entre bairros e distritos atendidos; 0 na ciência). */
  peso: number;
  /** 🔬/s dele, já com nível e cristal (0 em bairros e distritos). */
  pesquisaPorSegundo: number;
}

export interface CaboAnalise {
  ilha: IlhaId;
  nivel: number;
  tetoKw: number;
  /** kW que passam pelo cabo neste instante (exportados + importados). */
  usadoKw: number;
  /** Da ilha para a rede principal. */
  exportadoKw: number;
  /** Da rede principal para a ilha. */
  importadoKw: number;
}

export interface SubestacaoAnalise {
  indice: number;
  tipo: keyof typeof ESCOAMENTO;
  nivel: number;
  alcance: number;
  tetoKw: number;
  usadoKw: number;
}

export interface AnaliseMundo {
  usinas: UsinaAnalise[];
  porCasa: Map<number, UsinaAnalise>;
  subestacoes: SubestacaoAnalise[];
  /** Quantas construções de cada tipo existem. */
  contagem: Record<TipoConstrucao, number>;
  /** kW produzidos, escoados ou não (é o que conta como potência instalada no medidor Kardashev). */
  brutoKw: number;
  /** kW que entram na balança da Rede. */
  ofertaKw: number;
  /** kW produzidos sem para onde ir (GDD §7: nada acumula sem sumidouro). */
  semEscoamentoKw: number;
  /** Demanda dos consumidores atendidos por subestação. */
  demandaKw: number;
  /** Bairros sem subestação no alcance: não pedem nem pagam. */
  bairrosSemEscoamento: number;
  /** Distritos industriais sem subestação de 138 kV no alcance (GDD Parte 2 §4.2). */
  distritosSemEscoamento: number;
  /** Habitantes: a soma da população da densidade de cada bairro (GDD §8.6). */
  populacao: number;
  /** Tarifa média, ponderada pela demanda dos consumidores atendidos (GDD §7, §8.6). */
  tarifa: number;
  /** 🔬/s de laboratórios, universidades e institutos ligados (o Núcleo entra à parte, no tick). */
  pesquisaPorSegundo: number;
  /** ₵/s de combustível das térmicas: é o custo que a receita líquida desconta (GDD Parte 2 §1). */
  custoOperacaoPorSegundo: number;
  /** Universidades que a população sustenta (1 por 2 000 habitantes). */
  limiteUniversidades: number;
  /** Universidades ligadas e dentro do limite. */
  universidadesAtivas: number;
  /** Bairros em ilha sem cabo cuja energia vem só da própria ilha. */
  ilhasIsoladas: IlhaId[];
  /** Consumidores atendidos, com a subestação e a fatia de cada um (cena: fios, "+₵", "+🔬"). */
  consumidores: ConsumidorAnalise[];
  /** Cabos ligados e o quanto de cada teto está em uso (GDD §8.5). */
  cabos: CaboAnalise[];
}

function contagemVazia(): Record<TipoConstrucao, number> {
  return {
    cataVento: 0,
    painelSolar: 0,
    turbinaEolica: 0,
    eolicaOffshore: 0,
    fazendaSolar: 0,
    termicaGas: 0,
    bairro: 0,
    bateria: 0,
    subestacao: 0,
    laboratorio: 0,
    universidade: 0,
    subestacao138: 0,
    subestacaoOffshore: 0,
    bateriaRede: 0,
    distritoIndustrial: 0,
    institutoPesquisa: 0,
  };
}

export function tetoSubestacao(nivel: number): number {
  return tetoDeSubestacao("subestacao", nivel);
}

/**
 * Teto de escoamento do cabo submarino, em kW: 30 kW no nível 0, ×2 por nível (GDD §8.5) e ×10 com o
 * nó "Cabo HVDC" (GDD Parte 2 §3.2) — sem ele, as ilhas de fora não escoam MW.
 */
export function tetoCabo(nivel: number, efeitos: EfeitosArvore = efeitosNeutros()): number {
  return CABO.tetoKw * Math.pow(CABO.tetoNivel, nivel) * efeitos.tetoCaboFator;
}

/** Alcance da subestação em casas (Chebyshev). */
export const alcanceSubestacao = (efeitos: EfeitosArvore = efeitosNeutros()): number => efeitos.alcanceSubestacao;

/** Análise completa do mundo. Use `analisar(state)`: esta versão não usa cache. */
export function analisarMundo(
  mundo: MundoState,
  melhorias: MelhoriasState,
  efeitos: EfeitosArvore,
  densidadeDaCidade: number,
  arq: Arquipelago = arquipelagoDaEra1(),
): AnaliseMundo {
  const n = arq.n;
  const { demandaBairroFator: fatorDemandaBairro, tarifaFator: fatorTarifa } = efeitos;
  const ilhaDe = ilhaEfetivaDe(arq);
  const contagem = contagemVazia();
  const usinas: UsinaAnalise[] = [];
  const porCasa = new Map<number, UsinaAnalise>();
  const subestacoes: SubestacaoAnalise[] = [];
  const bairros: number[] = [];
  const distritos: number[] = [];
  /** Laboratórios, universidades e institutos, em ordem de casa. */
  const ciencia: number[] = [];
  const termicas: number[] = [];
  const casas = Object.keys(mundo.construcoes)
    .map(Number)
    .sort((a, b) => a - b);

  const obstaculo = (i: number): TipoObstaculo | null => obstaculoEm(mundo, i, arq);

  // 1. produção bruta por usina. Uma construção 2×2 vive na âncora e ocupa as quatro casas: o terreno
  //    é o da âncora, mas os vizinhos contam a partir de qualquer uma das quatro (GDD Parte 2 §3.1).
  for (const i of casas) {
    const c = mundo.construcoes[i];
    contagem[c.tipo]++;
    if (c.tipo === "bairro") bairros.push(i);
    else if (c.tipo === "distritoIndustrial") distritos.push(i);
    else if (c.tipo === "laboratorio" || c.tipo === "universidade" || c.tipo === "institutoPesquisa") ciencia.push(i);
    else if (ehSubestacao(c.tipo)) {
      const def = ESCOAMENTO[c.tipo];
      // O nível é do tipo, não da unidade (v0.8): todas as subestações do tipo sobem juntas.
      const nivel = melhorias.subestacoes[c.tipo];
      subestacoes.push({
        indice: i,
        tipo: c.tipo,
        nivel,
        alcance: c.tipo === "subestacao" ? efeitos.alcanceSubestacao : def.alcance,
        tetoKw: tetoDeSubestacao(c.tipo, nivel),
        usadoKw: 0,
      });
    }
    if (!ehUsina(c.tipo)) continue;
    if (c.tipo === "termicaGas") termicas.push(i);
    const proprias = casasDaConstrucao(i, c.tipo, n);
    const terreno = terrenoDeJogo(mundo, i, arq) ?? "planicie";
    const vento = ehVento(c.tipo);
    const sol = ehSolar(c.tipo);
    let eolicosVizinhos = 0;
    let altosVizinhos = 0;
    let picosVizinhos = 0;
    for (const casa of proprias) {
      const x = casa % n;
      const y = Math.floor(casa / n);
      for (const [dx, dy] of VIZINHOS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const j = indiceCasa(n, nx, ny);
        if (proprias.includes(j)) continue;
        const viz = construcaoQueOcupa(mundo, j, arq);
        if (viz && ehVento(viz.tipo)) eolicosVizinhos++;
        if (viz && ehAlto(viz.tipo)) altosVizinhos++;
        const obs = obstaculo(j);
        if (obs) {
          if (OBSTACULOS[obs].alto) altosVizinhos++;
          if (obs === "pico") picosVizinhos++;
        }
      }
    }
    const fatorTerreno = USINAS[c.tipo].agua ? 1 : vento ? TERRENOS[terreno].vento : TERRENOS[terreno].sol;
    const fatorEsteira = vento ? Math.max(VIZINHANCA.esteiraMinima, 1 - efeitos.esteiraPorVizinho * eolicosVizinhos) : 1;
    const fatorSombra = sol ? Math.max(VIZINHANCA.sombraMinima, 1 - VIZINHANCA.sombraPorVizinho * altosVizinhos) : 1;
    const fatorPico = vento ? 1 + VIZINHANCA.ventoPorPico * picosVizinhos : 1;
    const base = USINAS[c.tipo].potenciaKw * fatorUsina(melhorias.usinas[c.tipo]) * efeitos.potencia[c.tipo];
    const analise: UsinaAnalise = {
      indice: i,
      tipo: c.tipo,
      terreno,
      brutoKw: base * fatorTerreno * fatorEsteira * fatorSombra * fatorPico,
      escoadoKw: 0,
      fatorTerreno,
      fatorEsteira,
      fatorSombra,
      fatorPico,
      subestacao: null,
      custoPorSegundo: 0,
      fracaoLigada: 1,
    };
    usinas.push(analise);
    for (const casa of proprias) porCasa.set(casa, analise);
  }

  // 2. escoamento: cada subestação varre só as casas do próprio alcance, não a lista inteira de usinas
  for (const sub of subestacoes) {
    const ilhaSub = ilhaDe[sub.indice];
    const sx = sub.indice % n;
    const sy = Math.floor(sub.indice / n);
    const vistas = new Set<UsinaAnalise>();
    for (let dy = -sub.alcance; dy <= sub.alcance && sub.usadoKw < sub.tetoKw; dy++) {
      const y = sy + dy;
      if (y < 0 || y >= n) continue;
      for (let dx = -sub.alcance; dx <= sub.alcance && sub.usadoKw < sub.tetoKw; dx++) {
        const x = sx + dx;
        if (x < 0 || x >= n) continue;
        const j = indiceCasa(n, x, y);
        if (ilhaDe[j] !== ilhaSub) continue;
        const u = porCasa.get(j);
        if (!u || vistas.has(u) || u.escoadoKw >= u.brutoKw) continue;
        vistas.add(u);
        const cabe = Math.min(u.brutoKw - u.escoadoKw, sub.tetoKw - sub.usadoKw);
        if (cabe <= 0) continue;
        u.escoadoKw += cabe;
        sub.usadoKw += cabe;
        if (u.subestacao === null) u.subestacao = sub.indice;
      }
    }
  }

  // 2b. a térmica a gás não queima à toa: sem escoamento ela desliga, e com escoamento parcial só
  //     produz (e só paga combustível) o que consegue vender (GDD Parte 2 §3.1).
  let custoOperacaoPorSegundo = 0;
  for (const u of usinas) {
    const def = USINAS[u.tipo];
    if (def.combustivelPorSegundo === undefined) continue;
    const fracao = u.brutoKw > 0 ? u.escoadoKw / u.brutoKw : 0;
    if (u.subestacao !== null) u.subestacao = u.escoadoKw > 0 ? u.subestacao : null;
    u.brutoKw = u.escoadoKw;
    u.fracaoLigada = fracao;
    u.custoPorSegundo = def.combustivelPorSegundo * fracao * efeitos.combustivelFator;
    custoOperacaoPorSegundo += u.custoPorSegundo;
  }

  // 3. quem consome: bairros (por densidade), distritos industriais e a ciência.
  //    Tudo isso só entra na conta com subestação no alcance — a energia não anda sem fio (GDD §2.4).
  const porTipoDeSubestacao = new Map<TipoConstrucao, number[]>();
  for (const s of subestacoes) {
    const lista = porTipoDeSubestacao.get(s.tipo) ?? [];
    lista.push(s.indice);
    porTipoDeSubestacao.set(s.tipo, lista);
  }
  /** Casa da subestação (do tipo exigido, quando exigido) no alcance desta casa e na mesma ilha; `null` sem. */
  const subestacaoPerto = (casa: number, exigida?: TipoConstrucao): number | null => {
    const ilhaCasa = ilhaDe[casa];
    if (ilhaCasa < 0) return null;
    const x = casa % n;
    const y = Math.floor(casa / n);
    for (const s of subestacoes) {
      if (exigida !== undefined && s.tipo !== exigida) continue;
      if (ilhaDe[s.indice] !== ilhaCasa) continue;
      if (Math.max(Math.abs((s.indice % n) - x), Math.abs(Math.floor(s.indice / n) - y)) <= s.alcance) return s.indice;
    }
    return null;
  };
  const temSubestacaoPerto = (casa: number, exigida?: TipoConstrucao): boolean => subestacaoPerto(casa, exigida) !== null;
  const consumidores: ConsumidorAnalise[] = [];
  void porTipoDeSubestacao;

  let bairrosSemEscoamento = 0;
  const demandaPorIlha = new Map<number, number>();
  let populacao = 0;
  let tarifaPonderada = 0;
  let demandaConsumidoresKw = 0;

  /** Bairro a até 2 casas de uma térmica sente a fumaça (ou a cogeração): tarifa ± 10 %. */
  const fatorTermica = (casa: number): number => {
    if (termicas.length === 0) return 1;
    const x = casa % n;
    const y = Math.floor(casa / n);
    for (const t of termicas) {
      for (const c of casasDaConstrucao(t, "termicaGas", n)) {
        if (Math.max(Math.abs((c % n) - x), Math.abs(Math.floor(c / n) - y)) <= TERMICA.alcanceVizinhanca) {
          return 1 + efeitos.deltaTarifaTermica;
        }
      }
    }
    return 1;
  };

  // Todos os bairros na densidade da cidade (v0.8).
  const def = defDaDensidade(densidadeDaCidade);
  for (const b of bairros) {
    populacao += def.populacao;
    const ilhaB = ilhaDe[b];
    const sub = subestacaoPerto(b);
    if (sub === null) {
      bairrosSemEscoamento++;
      continue;
    }
    const demanda = def.demandaKw * fatorDemandaBairro;
    demandaConsumidoresKw += demanda;
    const fatia = demanda * def.tarifa * fatorTermica(b);
    tarifaPonderada += fatia;
    consumidores.push({ indice: b, tipo: "bairro", subestacao: sub, peso: fatia, pesquisaPorSegundo: 0 });
    demandaPorIlha.set(ilhaB, (demandaPorIlha.get(ilhaB) ?? 0) + demanda);
  }

  // Distrito industrial: demanda grande e tarifa alta, mas só com subestação de 138 kV no alcance.
  let distritosSemEscoamento = 0;
  for (const d of distritos) {
    const sub = subestacaoPerto(d, "subestacao138");
    if (sub === null) {
      distritosSemEscoamento++;
      continue;
    }
    const demanda = DISTRITO_INDUSTRIAL.demandaKw * fatorDemandaBairro;
    demandaConsumidoresKw += demanda;
    tarifaPonderada += demanda * DISTRITO_INDUSTRIAL.tarifa;
    consumidores.push({ indice: d, tipo: "distritoIndustrial", subestacao: sub, peso: demanda * DISTRITO_INDUSTRIAL.tarifa, pesquisaPorSegundo: 0 });
    demandaPorIlha.set(ilhaDe[d], (demandaPorIlha.get(ilhaDe[d]) ?? 0) + demanda);
  }

  // A fatia de cada consumidor na receita: normalizada para somar 1.
  if (tarifaPonderada > 0) for (const c of consumidores) c.peso /= tarifaPonderada;

  // Tarifa média ponderada pela demanda: quem pede mais pesa mais na conta (GDD §7).
  const tarifa = (demandaConsumidoresKw > 0 ? tarifaPonderada / demandaConsumidoresKw : 1) * fatorTarifa;

  // Ciência: laboratório, universidade e instituto consomem kW e geram 🔬. A universidade precisa de
  // gente — só valem as que a população sustenta —, e sobre cristal tudo rende +50 % (GDD §8.6, §9).
  const limite = limiteUniversidades(populacao);
  const cristais = cristaisDe(mundo);
  let pesquisaPorSegundo = 0;
  // Duas passadas: o rendimento de cada universidade depende de quantas estão ativas (os alunos se
  // dividem entre elas, ajuste 3 da Sessão 7), então primeiro se sabe quantas são.
  const universidades: number[] = [];
  for (const i of ciencia) {
    if (mundo.construcoes[i].tipo !== "universidade") continue;
    if (!temSubestacaoPerto(i)) continue;
    if (universidades.length >= limite) break;
    universidades.push(i);
  }
  const universidadesAtivas = universidades.length;
  const porUniversidade = pesquisaUniversidade(populacao, universidadesAtivas);
  for (const i of ciencia) {
    const c = mundo.construcoes[i];
    const ilhaC = ilhaDe[i];
    const sub = subestacaoPerto(i);
    if (sub === null) continue;
    const bonus = casasDaConstrucao(i, c.tipo, n).some((casa) => cristais.has(casa)) ? 1 + CRISTAL.bonusCiencia : 1;
    // Nível do tipo de ciência (v0.9): +25 % de 🔬 por nível, antes do cristal.
    const nivelCiencia = c.tipo === "laboratorio" || c.tipo === "universidade" || c.tipo === "institutoPesquisa" ? melhorias.ciencia[c.tipo] : 0;
    const somar = (pesquisa: number, consumo: number) => {
      const rende = pesquisa * fatorCiencia(nivelCiencia) * bonus;
      pesquisaPorSegundo += rende;
      consumidores.push({ indice: i, tipo: c.tipo, subestacao: sub, peso: 0, pesquisaPorSegundo: rende });
      demandaPorIlha.set(ilhaC, (demandaPorIlha.get(ilhaC) ?? 0) + consumo);
      demandaConsumidoresKw += consumo;
    };
    if (c.tipo === "laboratorio") {
      somar(LABORATORIO.pesquisaPorSegundo, LABORATORIO.consumoKw);
      continue;
    }
    if (c.tipo === "institutoPesquisa") {
      somar(INSTITUTO.pesquisaPorSegundo, INSTITUTO.consumoKw);
      continue;
    }
    if (!universidades.includes(i)) continue;
    somar(porUniversidade, UNIVERSIDADE.consumoKw);
  }

  // 4. cada ilha fora da principal é uma mini-rede: o que sobra (ou falta) só atravessa pelo cabo, e o
  //    cabo tem teto próprio (GDD §8.5). Sem cabo, o teto é zero: a ilha só alimenta os próprios bairros.
  const ilhasIsoladas: IlhaId[] = [];
  const cabos: CaboAnalise[] = [];
  let brutoKw = 0;
  const escoadoPorIlha = new Map<number, number>();
  for (const u of usinas) {
    brutoKw += u.brutoKw;
    const q = ilhaDe[u.indice];
    escoadoPorIlha.set(q, (escoadoPorIlha.get(q) ?? 0) + u.escoadoKw);
  }
  let ofertaKw = escoadoPorIlha.get(0) ?? 0;
  let demandaEfetiva = demandaPorIlha.get(0) ?? 0;
  for (let q = 1; q < arq.ilhas.length; q++) {
    const ilhaId = arq.ilhas[q].id;
    if (!mundo.ilhasAbertas.includes(ilhaId)) continue;
    const oferta = escoadoPorIlha.get(q) ?? 0;
    const demanda = demandaPorIlha.get(q) ?? 0;
    const local = Math.min(oferta, demanda);
    ofertaKw += local;
    demandaEfetiva += local;
    if (mundo.cabos[ilhaId] === undefined) {
      if (oferta > local || demanda > local) ilhasIsoladas.push(ilhaId);
      continue;
    }
    // Todos os cabos no mesmo nível (v0.8): `mundo.cabos` só marca quem está ligado.
    const nivel = melhorias.cabos;
    const teto = tetoCabo(nivel, efeitos);
    const exportado = Math.min(oferta - local, teto);
    const importado = Math.min(demanda - local, teto);
    ofertaKw += exportado;
    demandaEfetiva += importado;
    cabos.push({ ilha: ilhaId, nivel, tetoKw: teto, usadoKw: exportado + importado, exportadoKw: exportado, importadoKw: importado });
  }

  return {
    usinas,
    porCasa,
    subestacoes,
    contagem,
    brutoKw,
    ofertaKw,
    semEscoamentoKw: Math.max(0, brutoKw - ofertaKw),
    demandaKw: demandaEfetiva,
    bairrosSemEscoamento,
    distritosSemEscoamento,
    populacao,
    tarifa,
    pesquisaPorSegundo,
    custoOperacaoPorSegundo,
    limiteUniversidades: limite,
    universidadesAtivas,
    ilhasIsoladas,
    cabos,
    consumidores,
  };
}

/* ------------------------------------------------------------------ */
/* Cache por identidade                                               */
/* ------------------------------------------------------------------ */

interface Entrada {
  /** Só o que muda a produção: os níveis por tipo, a cidade e os efeitos da árvore. A carga da bateria não entra. */
  melhorias: MelhoriasState;
  cidade: CidadeState;
  efeitos: EfeitosArvore;
  analise: AnaliseMundo;
}

const cache = new WeakMap<MundoState, Entrada>();

/**
 * Análise do mundo do estado, memoizada enquanto o objeto `mundo`, as melhorias, a cidade e os efeitos da
 * árvore não mudarem de identidade. O tick troca `rede` a cada passo (a carga da bateria), e ela não entra na chave.
 */
export function analisar(state: GameState): AnaliseMundo {
  const pronto = cache.get(state.mundo);
  const efeitos = efeitosDe(state);
  if (pronto && pronto.melhorias === state.melhorias && pronto.cidade === state.cidade && pronto.efeitos === efeitos) return pronto.analise;
  const analise = analisarMundo(state.mundo, state.melhorias, efeitos, state.cidade.densidade);
  cache.set(state.mundo, { melhorias: state.melhorias, cidade: state.cidade, efeitos, analise });
  return analise;
}

/* ------------------------------------------------------------------ */
/* Contagens derivadas                                                */
/* ------------------------------------------------------------------ */

export function capacidadeBateriaKwh(unidades: number, efeitos: EfeitosArvore = efeitosNeutros()): number {
  return unidades * BATERIA.capacidadeKwh * efeitos.capacidadeBateriaFator;
}

/**
 * Capacidade e potência da bateria somando as duas eras: a bateria da Era 1 (+20 kWh, ±10 kW) e a
 * bateria de rede (+2 000 kWh, ±1 000 kW, ×2 com "Rede inteligente"). A regra da faixa efetiva de
 * §4.1 não muda — a bateria continua transformando falha em neutro, nunca em ouro.
 */
export function bateriaDoMundo(analise: AnaliseMundo, efeitos: EfeitosArvore = efeitosNeutros()): { unidades: number; capacidadeKwh: number; potenciaKw: number } {
  const unidades = analise.contagem.bateria;
  const deRede = analise.contagem.bateriaRede;
  return {
    unidades: unidades + deRede,
    capacidadeKwh: capacidadeBateriaKwh(unidades, efeitos) + deRede * BATERIA_REDE.capacidadeKwh * efeitos.bateriaRedeFator,
    potenciaKw: unidades * BATERIA.potenciaKw + deRede * BATERIA_REDE.potenciaKw * efeitos.bateriaRedeFator,
  };
}

/** Rede na forma que as fórmulas de §4.1 consomem, com as contagens vindas do mundo. */
export function derivarRede(state: GameState, analise: AnaliseMundo = analisar(state)): RedeDerivada {
  const efeitos = efeitosDe(state);
  const bat = bateriaDoMundo(analise, efeitos);
  const usinas = {} as RedeDerivada["usinas"];
  for (const id of Object.keys(USINAS) as UsinaId[]) {
    usinas[id] = { quantidade: analise.contagem[id], nivel: state.melhorias.usinas[id] };
  }
  return {
    usinas,
    bairros: analise.contagem.bairro,
    bateria: { ...bat, kwh: Math.min(state.rede.bateria.kwh, bat.capacidadeKwh) },
  };
}

export function quantidadeDe(state: GameState, tipo: TipoConstrucao): number {
  return analisar(state).contagem[tipo];
}
