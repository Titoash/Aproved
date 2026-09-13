/**
 * O que o mundo produz e o que a rede consegue escoar (GDD §2.4, §7, v0.6). TypeScript puro.
 *
 * Produção de uma usina = base × nível × melhorias × terreno × esteira × sombra × picos.
 * Uma usina só vende se estiver no alcance de uma subestação com folga no teto; o resto é desperdiçado e
 * aparece como "sem escoamento" (o sumidouro de §7). Um bairro só pede energia se tiver subestação no
 * alcance. Ilha sem cabo submarino só alimenta os bairros dela mesma.
 *
 * As contagens da Rede (quantas usinas, quantas vilas, quantas baterias) são **derivadas** daqui.
 * O resultado é memoizado por identidade de `mundo`/`rede`/`melhorias`: o tick não recalcula à toa.
 */
import { BATERIA, USINAS, VILA } from "../content/era1";
import { OBSTACULOS, ORDEM_OBSTACULOS, SUBESTACAO, TERRENOS, VIZINHANCA, type IlhaId, type TipoObstaculo, type TipoTerreno } from "../content/era1-arquipelago";
import { ORDEM_TERRENOS, indiceCasa, type Arquipelago } from "./arquipelago";
import { fatorMelhoria } from "./custos";
import { arquipelagoDaEra1 } from "./gerarArquipelago";
import { fatorPotenciaUsina } from "./melhorias";
import type { Construcao, GameState, Melhorias, MundoState, RedeDerivada, RedeState, TipoConstrucao, UsinaId } from "./state";

const USINAS_VENTO: readonly UsinaId[] = ["cataVento", "turbinaEolica"];
const VIZINHOS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export const ehUsina = (tipo: TipoConstrucao): tipo is UsinaId => tipo in USINAS;
export const ehVento = (tipo: TipoConstrucao): boolean => USINAS_VENTO.includes(tipo as UsinaId);

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

export function ilhaDaCasa(indice: number, arq: Arquipelago = arquipelagoDaEra1()): IlhaId | null {
  const q = arq.ilha[indice];
  return q < 0 ? null : arq.ilhas[q].id;
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
}

export interface SubestacaoAnalise {
  indice: number;
  nivel: number;
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
  /** Demanda dos bairros atendidos por subestação. */
  demandaKw: number;
  /** Bairros sem subestação no alcance: não pedem nem pagam. */
  bairrosSemEscoamento: number;
  /** Bairros em ilha sem cabo cuja energia vem só da própria ilha. */
  ilhasIsoladas: IlhaId[];
}


function contagemVazia(): Record<TipoConstrucao, number> {
  return { cataVento: 0, painelSolar: 0, turbinaEolica: 0, vila: 0, bateria: 0, subestacao: 0 };
}

export function tetoSubestacao(nivel: number): number {
  return SUBESTACAO.tetoKw * Math.pow(SUBESTACAO.tetoNivel, nivel);
}

/** Alcance da subestação em casas (Chebyshev). */
export const alcanceSubestacao = (): number => SUBESTACAO.alcance;

/** Análise completa do mundo. Use `analisar(state)`: esta versão não usa cache. */
export function analisarMundo(mundo: MundoState, rede: RedeState, melhorias: Melhorias | undefined, arq: Arquipelago = arquipelagoDaEra1()): AnaliseMundo {
  const n = arq.n;
  const contagem = contagemVazia();
  const usinas: UsinaAnalise[] = [];
  const porCasa = new Map<number, UsinaAnalise>();
  const subestacoes: SubestacaoAnalise[] = [];
  const bairros: number[] = [];
  const casas = Object.keys(mundo.construcoes)
    .map(Number)
    .sort((a, b) => a - b);

  const construcaoEm = (i: number): Construcao | undefined => mundo.construcoes[i];
  const obstaculo = (i: number): TipoObstaculo | null => obstaculoEm(mundo, i, arq);

  // 1. produção bruta por usina
  for (const i of casas) {
    const c = mundo.construcoes[i];
    contagem[c.tipo]++;
    if (c.tipo === "vila") bairros.push(i);
    if (c.tipo === "subestacao") subestacoes.push({ indice: i, nivel: c.nivel, tetoKw: tetoSubestacao(c.nivel), usadoKw: 0 });
    if (!ehUsina(c.tipo)) continue;
    const x = i % n;
    const y = Math.floor(i / n);
    const terreno = terrenoEm(i, arq) ?? "planicie";
    const vento = ehVento(c.tipo);
    let eolicosVizinhos = 0;
    let altosVizinhos = 0;
    let picosVizinhos = 0;
    for (const [dx, dy] of VIZINHOS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const j = indiceCasa(n, nx, ny);
      const viz = construcaoEm(j);
      if (viz && ehVento(viz.tipo)) eolicosVizinhos++;
      if (viz?.tipo === "turbinaEolica") altosVizinhos++;
      const obs = obstaculo(j);
      if (obs) {
        if (OBSTACULOS[obs].alto) altosVizinhos++;
        if (obs === "pico") picosVizinhos++;
      }
    }
    const fatorTerreno = vento ? TERRENOS[terreno].vento : TERRENOS[terreno].sol;
    const fatorEsteira = vento ? Math.max(VIZINHANCA.esteiraMinima, 1 - VIZINHANCA.esteiraPorVizinho * eolicosVizinhos) : 1;
    const fatorSombra = vento ? 1 : Math.max(VIZINHANCA.sombraMinima, 1 - VIZINHANCA.sombraPorVizinho * altosVizinhos);
    const fatorPico = vento ? 1 + VIZINHANCA.ventoPorPico * picosVizinhos : 1;
    const base = USINAS[c.tipo].potenciaKw * fatorMelhoria(rede.usinas[c.tipo].nivel) * fatorPotenciaUsina(melhorias, c.tipo);
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
    };
    usinas.push(analise);
    porCasa.set(i, analise);
  }

  // 2. escoamento: cada subestação varre só as casas do próprio alcance (7×7), não a lista inteira de usinas
  const alcance = SUBESTACAO.alcance;
  for (const sub of subestacoes) {
    const ilhaSub = arq.ilha[sub.indice];
    const sx = sub.indice % n;
    const sy = Math.floor(sub.indice / n);
    for (let dy = -alcance; dy <= alcance && sub.usadoKw < sub.tetoKw; dy++) {
      const y = sy + dy;
      if (y < 0 || y >= n) continue;
      for (let dx = -alcance; dx <= alcance && sub.usadoKw < sub.tetoKw; dx++) {
        const x = sx + dx;
        if (x < 0 || x >= n) continue;
        const j = indiceCasa(n, x, y);
        if (arq.ilha[j] !== ilhaSub) continue;
        const u = porCasa.get(j);
        if (!u || u.escoadoKw >= u.brutoKw) continue;
        const cabe = Math.min(u.brutoKw - u.escoadoKw, sub.tetoKw - sub.usadoKw);
        if (cabe <= 0) continue;
        u.escoadoKw += cabe;
        sub.usadoKw += cabe;
        if (u.subestacao === null) u.subestacao = sub.indice;
      }
    }
  }

  // 3. bairros com subestação no alcance
  let demandaKw = 0;
  let bairrosSemEscoamento = 0;
  const demandaPorIlha = new Map<number, number>();
  const casasSubestacao = new Set(subestacoes.map((s) => s.indice));
  const temSubestacaoPerto = (casa: number, ilhaCasa: number): boolean => {
    const x = casa % n;
    const y = Math.floor(casa / n);
    for (let dy = -alcance; dy <= alcance; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= n) continue;
      for (let dx = -alcance; dx <= alcance; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= n) continue;
        const j = indiceCasa(n, nx, ny);
        if (casasSubestacao.has(j) && arq.ilha[j] === ilhaCasa) return true;
      }
    }
    return false;
  };
  for (const b of bairros) {
    const ilhaB = arq.ilha[b];
    const atendido = temSubestacaoPerto(b, ilhaB);
    if (!atendido) {
      bairrosSemEscoamento++;
      continue;
    }
    demandaKw += VILA.demandaKw;
    demandaPorIlha.set(ilhaB, (demandaPorIlha.get(ilhaB) ?? 0) + VILA.demandaKw);
  }

  // 4. ilhas sem cabo: só alimentam os próprios bairros; o excedente não tem para onde ir (GDD §8.5)
  const ligada = (q: number): boolean => q === 0 || mundo.cabos.includes(arq.ilhas[q].id);
  const ilhasIsoladas: IlhaId[] = [];
  let ofertaKw = 0;
  let brutoKw = 0;
  const escoadoPorIlha = new Map<number, number>();
  for (const u of usinas) {
    brutoKw += u.brutoKw;
    const q = arq.ilha[u.indice];
    escoadoPorIlha.set(q, (escoadoPorIlha.get(q) ?? 0) + u.escoadoKw);
  }
  let demandaEfetiva = 0;
  for (const [q, kw] of escoadoPorIlha) {
    if (ligada(q)) ofertaKw += kw;
  }
  for (const [q, kw] of demandaPorIlha) {
    if (ligada(q)) demandaEfetiva += kw;
  }
  for (let q = 1; q < arq.ilhas.length; q++) {
    if (ligada(q)) continue;
    const ilhaId = arq.ilhas[q].id;
    if (!mundo.ilhasAbertas.includes(ilhaId)) continue;
    const oferta = escoadoPorIlha.get(q) ?? 0;
    const demanda = demandaPorIlha.get(q) ?? 0;
    if (oferta > 0 || demanda > 0) ilhasIsoladas.push(ilhaId);
    const local = Math.min(oferta, demanda);
    ofertaKw += local;
    demandaEfetiva += local;
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
    ilhasIsoladas,
  };
}

/* ------------------------------------------------------------------ */
/* Cache por identidade                                               */
/* ------------------------------------------------------------------ */

interface Entrada {
  /** Só o que muda a produção: os níveis das usinas e as melhorias. A carga da bateria não entra. */
  niveis: string;
  melhorias: Melhorias | undefined;
  analise: AnaliseMundo;
}

const cache = new WeakMap<MundoState, Entrada>();

const niveisDe = (rede: RedeState): string => `${rede.usinas.cataVento.nivel}|${rede.usinas.painelSolar.nivel}|${rede.usinas.turbinaEolica.nivel}`;

/**
 * Análise do mundo do estado, memoizada enquanto o objeto `mundo`, os níveis das usinas e as melhorias não
 * mudarem. O tick troca `rede` a cada passo (a carga da bateria), então a chave não pode ser a identidade dela.
 */
export function analisar(state: GameState): AnaliseMundo {
  const pronto = cache.get(state.mundo);
  const niveis = niveisDe(state.rede);
  if (pronto && pronto.niveis === niveis && pronto.melhorias === state.melhorias) return pronto.analise;
  const analise = analisarMundo(state.mundo, state.rede, state.melhorias);
  cache.set(state.mundo, { niveis, melhorias: state.melhorias, analise });
  return analise;
}

/* ------------------------------------------------------------------ */
/* Contagens derivadas                                                */
/* ------------------------------------------------------------------ */

export function capacidadeBateriaKwh(unidades: number): number {
  return unidades * BATERIA.capacidadeKwh;
}

/** Rede na forma que as fórmulas de §4.1 consomem, com as contagens vindas do mundo. */
export function derivarRede(state: GameState, analise: AnaliseMundo = analisar(state)): RedeDerivada {
  const unidades = analise.contagem.bateria;
  const capacidadeKwh = capacidadeBateriaKwh(unidades);
  return {
    usinas: {
      cataVento: { quantidade: analise.contagem.cataVento, nivel: state.rede.usinas.cataVento.nivel },
      painelSolar: { quantidade: analise.contagem.painelSolar, nivel: state.rede.usinas.painelSolar.nivel },
      turbinaEolica: { quantidade: analise.contagem.turbinaEolica, nivel: state.rede.usinas.turbinaEolica.nivel },
    },
    vilas: analise.contagem.vila,
    bateria: { unidades, capacidadeKwh, kwh: Math.min(state.rede.bateria.kwh, capacidadeKwh) },
  };
}

export function quantidadeDe(state: GameState, tipo: TipoConstrucao): number {
  return analisar(state).contagem[tipo];
}
