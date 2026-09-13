/**
 * Desenho da ilha-tabuleiro em Canvas 2D (direção §4): sombra no espaço, penhasco, topo por região, lago,
 * caminhos da vila, plataforma elevada do Núcleo, regiões bloqueadas, minimapa e hit-test.
 *
 * Só desenha: a geometria vem de `sim/gerarIlha` e o estado (regiões desbloqueadas, lado jogável da grade)
 * chega por `opcoes`. Sem `Math.random`/`Date.now`: tudo sai de `rnd`/`ruido` e do `t` recebido.
 * Coordenadas: casa (x, y) inteira em [0, n); mundo em px no zoom 1 via `iso`. `desenharTerreno` aplica a
 * câmera a partir de `cam` e restaura a transformação do chamador ao sair.
 *
 * Caches (liberados por `liberarCacheTerreno`):
 *  • geometria (Path2D) por ilha, montada uma vez;
 *  • chão estático num offscreen por canvas de destino, chaveado por (zoom, LOD, dpr, tamanho, estado);
 *  • silhueta do minimapa num offscreen 4×, refeita só se tamanho ou estado mudarem.
 * O único uso de DOM fica em `criarTela` (fallback quando não há `OffscreenCanvas`).
 */
import { indiceCasa, naPlataforma, type Ilha, type Plataforma, type Regiao, type RegiaoId, type TipoRegiao } from "../../sim/ilha";
import { ISO, PALETA, alfa, centro, clarear, desiso, elipse, escurecer, iso, lodDe, misturar, retArred, rnd, ruido, type Camera } from "./base";

// ---------------------------------------------------------------------------------------------
// Paleta local (direção §2): ajustes do terreno entram aqui, nunca em base.ts.
// ---------------------------------------------------------------------------------------------
const P = { ...PALETA, malha: "rgba(13,18,48,.07)" };
// bloqueadas: topo M(tom, navy2, .6) (sem cinza), véu A(navy2,.40), hachura A(ink,.10) 1,5 px de tela a cada 10 px, borda tracejada A(ink,.45)
const VEU_BLOQUEIO = alfa(P.navy2, 0.4);
const HACHURA = alfa(P.ink, 0.1);
const BORDA_BLOQUEIO = alfa(P.ink, 0.45);
/** Tom do topo por tipo de região. */
export const TOM: Record<TipoRegiao, string> = {
  nucleo: P.grama,
  vento: P.gramaVento,
  sol: P.gramaSol,
  vila: P.grama2,
  lago: P.grama,
  floresta: P.gramaFloresta,
  livre: P.grama,
};
/** Bloqueadas: M(tom, navy2, .6) mantém a matiz roxo-navy da paleta (nada de cinza-chumbo). */
const bloquear = (tom: string): string => misturar(tom, P.navy2, 0.6);
const TOM_BLOQUEADO: Record<TipoRegiao, string> = {
  nucleo: bloquear(TOM.nucleo),
  vento: bloquear(TOM.vento),
  sol: bloquear(TOM.sol),
  vila: bloquear(TOM.vila),
  lago: bloquear(TOM.lago),
  floresta: bloquear(TOM.floresta),
  livre: bloquear(TOM.livre),
};
const COR_FACE = { sw: P.rocha, se: P.rocha2 };
/** Anéis da plataforma, do centro para fora (o 3.º vale para os seguintes). */
const COR_ANEL = [P.casaAnel1, P.casa, escurecer(P.casa, 0.14)];
/** Anel externo fora da grade jogável (grade 5×5): mais escuro e pontilhado. */
const COR_ANEL_BLOQUEADO = escurecer(P.casa, 0.4);
const COR_PONTO_BLOQUEADO = P.muted;
const COR_PLAT_SW = escurecer(P.casa, 0.22);
const COR_PLAT_SE = escurecer(P.casa, 0.42);
const COR_FIO_TRAS = clarear(P.grama, 0.3);
const COR_FIO_FRENTE = clarear(P.gramaLabio, 0.35);
const COR_PONTO_SW = escurecer(P.rocha, 0.4);
const COR_PONTO_SE = escurecer(P.rocha2, 0.4);
const MINI_BORDA = alfa(P.ink, 0.3);
const MINI_RECT = alfa(P.ink, 0.06);

// ---------------------------------------------------------------------------------------------
// Constantes da grade
// ---------------------------------------------------------------------------------------------
const HW = ISO.W / 2;
const HH = ISO.H / 2;
/** Elevação da plataforma do Núcleo, em px de mundo. */
export const ELEV_PLAT = 8;
/** Rebaixo da água em relação à grama, em px de mundo. */
export const REBAIXO_AGUA = 4;
/** Abaixo deste zoom (sub-regra de `longe`) entra o modo mapa: caminhos viram linha, sem hachura. */
const ZOOM_MAPA = 0.22;
/** Lados de uma casa: 0 NE (vizinho y−1), 1 SE (x+1), 2 SW (y+1), 3 NW (x−1). */
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
/** Vértice inicial/final de cada lado (sentido horário na grade; interior à direita). */
const VA: Ponto[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
const VB: Ponto[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [0, 0],
];

type Ponto = [number, number];
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface Bbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OpcoesTerreno {
  /** Regiões desbloqueadas: as outras recebem tom rebaixado, véu, hachura e contorno tracejado. */
  desbloqueadas: ReadonlySet<RegiaoId>;
  /** Lado jogável da grade do Núcleo (5 ou 7): os anéis da plataforma além dele são desenhados bloqueados. */
  ladoGrade: number;
  /** Limita o dpr do offscreen do chão (a camada de transição usa 1). */
  chaoDpr?: number;
  /** Na transição, o offscreen "ilha inteira" vale também reduzido (zoom menor que o do cache) sem rebuild. */
  chaoEscalavel?: boolean;
}

// ---------------------------------------------------------------------------------------------
// Utilidades de malha e de caminho
// ---------------------------------------------------------------------------------------------
interface Aresta {
  ai: number;
  aj: number;
  bi: number;
  bj: number;
}

/** Arestas de borda de um conjunto de casas (`pertence(i)` sobre o índice), no sentido horário da grade. */
function arestasDe(n: number, pertence: (i: number) => boolean): Aresta[] {
  const out: Aresta[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!pertence(indiceCasa(n, x, y))) continue;
      for (let k = 0; k < 4; k++) {
        const nx = x + DX[k];
        const ny = y + DY[k];
        if (nx >= 0 && ny >= 0 && nx < n && ny < n && pertence(indiceCasa(n, nx, ny))) continue;
        out.push({ ai: x + VA[k][0], aj: y + VA[k][1], bi: x + VB[k][0], bj: y + VB[k][1] });
      }
    }
  }
  return out;
}

/**
 * Encadeia arestas de borda em laços fechados (listas de vértices [i, j]). Em vértice com duas saídas
 * (toque diagonal) prefere o giro mais à direita, que mantém o laço colado ao interior. Buracos saem
 * anti-horários, então o preenchimento nonzero já os exclui.
 */
function lacosDe(n: number, arestas: Aresta[]): Ponto[][] {
  const vk = (i: number, j: number) => j * (n + 1) + i;
  const porInicio = new Map<number, Aresta[]>();
  for (const a of arestas) {
    const k = vk(a.ai, a.aj);
    const lista = porInicio.get(k);
    if (lista) lista.push(a);
    else porInicio.set(k, [a]);
  }
  const usada = new Set<Aresta>();
  const lacos: Ponto[][] = [];
  for (const a0 of arestas) {
    if (usada.has(a0)) continue;
    const laco: Ponto[] = [];
    let a: Aresta | null = a0;
    while (a && !usada.has(a)) {
      usada.add(a);
      laco.push([a.ai, a.aj]);
      const di = a.bi - a.ai;
      const dj = a.bj - a.aj;
      const cand = porInicio.get(vk(a.bi, a.bj));
      let melhor: Aresta | null = null;
      let giroMax = -9;
      if (cand) {
        for (const c of cand) {
          if (usada.has(c)) continue;
          const ci = c.bi - c.ai;
          const cj = c.bj - c.aj;
          const giro = Math.atan2(di * cj - dj * ci, di * ci + dj * cj);
          if (giro > giroMax) {
            giroMax = giro;
            melhor = c;
          }
        }
      }
      a = melhor;
    }
    if (laco.length > 2) lacos.push(laco);
  }
  return lacos;
}

/**
 * Laço de vértices da malha → pontos de mundo suavizados: polígono dos pontos médios (apaga a escadinha) + Chaikin ×passadas.
 * Simétrico em relação ao sentido de percurso: laços vizinhos (regiões) produzem os mesmos pontos na fronteira comum.
 */
function suavizar(laco: Ponto[], passadas = 2, dy = 0): Ponto[] {
  let pts: Ponto[] = laco.map(([i, j]) => [(i - j) * HW, (i + j) * HH + dy]);
  let out: Ponto[] = [];
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k];
    const b = pts[(k + 1) % pts.length];
    out.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  }
  pts = out;
  for (let p = 0; p < passadas; p++) {
    out = [];
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k];
      const b = pts[(k + 1) % pts.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    pts = out;
  }
  return pts;
}

function pathDePontos(lacos: Ponto[][]): Path2D {
  const p = new Path2D();
  for (const l of lacos) {
    for (let k = 0; k < l.length; k++) {
      if (k) p.lineTo(l[k][0], l[k][1]);
      else p.moveTo(l[k][0], l[k][1]);
    }
    p.closePath();
  }
  return p;
}

const pathSuave = (lacos: Ponto[][], passadas: number, dy: number): Path2D => pathDePontos(lacos.map((l) => suavizar(l, passadas, dy)));

function bboxDe(lacos: Ponto[][]): Bbox {
  const b: Bbox = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const l of lacos) {
    for (const q of l) {
      if (q[0] < b.x0) b.x0 = q[0];
      if (q[0] > b.x1) b.x1 = q[0];
      if (q[1] < b.y0) b.y0 = q[1];
      if (q[1] > b.y1) b.y1 = q[1];
    }
  }
  return b;
}

function quad(p: Path2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): void {
  p.moveTo(x1, y1);
  p.lineTo(x2, y2);
  p.lineTo(x3, y3);
  p.lineTo(x4, y4);
  p.closePath();
}

/** Losango da casa (x, y) com recuo `ins` (fração) e deslocamento vertical dy, num Path2D. */
function losangoEm(p: Path2D, x: number, y: number, ins: number, dy: number): void {
  const a = iso(x + ins, y + ins);
  const b = iso(x + 1 - ins, y + ins);
  const c = iso(x + 1 - ins, y + 1 - ins);
  const d = iso(x + ins, y + 1 - ins);
  quad(p, a[0], a[1] + dy, b[0], b[1] + dy, c[0], c[1] + dy, d[0], d[1] + dy);
}

/** Quadrilátero do bloco de casas [x0, x0+lado) × [y0, y0+lado), deslocado dy px. */
function quadCasas(x0: number, y0: number, lado: number, dy: number): Path2D {
  const p = new Path2D();
  const a = iso(x0, y0);
  const b = iso(x0 + lado, y0);
  const c = iso(x0 + lado, y0 + lado);
  const d = iso(x0, y0 + lado);
  quad(p, a[0], a[1] + dy, b[0], b[1] + dy, c[0], c[1] + dy, d[0], d[1] + dy);
  return p;
}

function segmento(p: Path2D, i1: number, j1: number, i2: number, j2: number, dy = 0): void {
  p.moveTo((i1 - j1) * HW, (i1 + j1) * HH + dy);
  p.lineTo((i2 - j2) * HW, (i2 + j2) * HH + dy);
}

function pathDe(mapa: Map<string, Path2D>, cor: string): Path2D {
  let p = mapa.get(cor);
  if (!p) {
    p = new Path2D();
    mapa.set(cor, p);
  }
  return p;
}

const chaveConjunto = (s: ReadonlySet<RegiaoId>): string => Array.from(s).sort().join(",");
const chaveEstado = (o: OpcoesTerreno): string => `${o.ladoGrade}|${chaveConjunto(o.desbloqueadas)}`;

// ---------------------------------------------------------------------------------------------
// Telas offscreen: OffscreenCanvas quando existe; senão, um <canvas> solto (único uso de DOM do módulo).
// ---------------------------------------------------------------------------------------------
interface Tela {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  g: Ctx2D;
}

function criarTela(w: number, h: number): Tela {
  if (typeof OffscreenCanvas === "function") {
    const canvas = new OffscreenCanvas(w, h);
    const g = canvas.getContext("2d");
    if (!g) throw new Error("Terreno: OffscreenCanvas sem contexto 2D");
    return { canvas, g };
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Terreno: canvas sem contexto 2D");
  return { canvas, g };
}

/** Pontilhado r 1 em grade de 6 px de mundo, desenhado em 4× para ficar nítido em zoom alto. */
function padraoPontos(ctx: CanvasRenderingContext2D, cor: string): CanvasPattern | null {
  const { canvas, g } = criarTela(48, 48);
  g.scale(4, 4);
  g.fillStyle = cor;
  g.beginPath();
  g.moveTo(4, 3);
  g.arc(3, 3, 1, 0, 7);
  g.moveTo(10, 9);
  g.arc(9, 9, 1, 0, 7);
  g.fill();
  const pat = ctx.createPattern(canvas, "repeat");
  if (pat && typeof DOMMatrix === "function") pat.setTransform(new DOMMatrix().scale(0.25));
  return pat;
}

// ---------------------------------------------------------------------------------------------
// Cache de geometria (Path2D) por ilha: montado uma vez, na primeira chamada.
// ---------------------------------------------------------------------------------------------
interface Banda {
  y: number;
  cor: string;
  p: Path2D;
  banda: Path2D;
  veios: Path2D;
  sw: boolean;
}

interface Cristal {
  x: number;
  y: number;
  dir: number;
  k: number;
  fase: number;
  grande: boolean;
}

interface Tom {
  cor: string;
  p: Path2D;
}

interface RegiaoCache {
  r: Regiao;
  p: Path2D;
  tonsPerto: Tom[];
  tonsLonge: Tom[];
  hachura: Path2D;
  centro: Ponto;
}

interface Mini {
  tela: Tela;
  w: number;
  h: number;
  chave: string;
}

interface CacheTerreno {
  plataforma: Plataforma;
  pIlha: Path2D;
  bandas: Banda[];
  pFioFrente: Path2D;
  pFioTras: Path2D;
  pLabio: Path2D;
  pUniaoSW: Path2D;
  pUniaoSE: Path2D;
  pEstalactites: Path2D;
  cristais: Cristal[];
  regioes: RegiaoCache[];
  pMalha: Path2D;
  pLago: Path2D;
  /** Centros (x, y intercalados) de 1 em cada 3 casas de água, para as ondulações. */
  aguaCentros: number[];
  pCaminho: Path2D;
  pCaminhoLinha: Path2D;
  pPlatBase: Path2D;
  pPlatTopo: Path2D;
  /** Anéis da plataforma, do centro (índice 0 = anel 1) para fora, já elevados. */
  pAneis: Path2D[];
  pPlatMalha: Path2D;
  pPlatSW: Path2D;
  pPlatSE: Path2D;
  bboxTopo: Bbox;
  bbox: Bbox;
  /** Padrões (precisam de um contexto de destino): criados na primeira chamada de `desenharTerreno`. */
  padroes: { sw: CanvasPattern | null; se: CanvasPattern | null; bloqueado: CanvasPattern | null } | null;
  mini: Mini | null;
}

let caches = new WeakMap<Ilha, CacheTerreno>();

function cacheDe(ilha: Ilha): CacheTerreno {
  let c = caches.get(ilha);
  if (!c) {
    c = montarCache(ilha);
    caches.set(ilha, c);
  }
  return c;
}

function garantirPadroes(c: CacheTerreno, ctx: CanvasRenderingContext2D): void {
  if (c.padroes) return;
  c.padroes = { sw: padraoPontos(ctx, COR_PONTO_SW), se: padraoPontos(ctx, COR_PONTO_SE), bloqueado: padraoPontos(ctx, COR_PONTO_BLOQUEADO) };
}

function montarCache(ilha: Ilha): CacheTerreno {
  const { n, terra, agua, caminho, altura, plataforma: pl } = ilha;
  const r = rnd(ilha.semente * 3 + 17);
  const ruP = ruido(ilha.semente * 5 + 77);
  const eTerra = (i: number) => terra[i] === 1;
  const eAgua = (i: number) => agua[i] === 1;
  const eCaminho = (i: number) => caminho[i] === 1;

  // --- contorno da ilha (suavizado) e sombra
  const lacosTerra = lacosDe(n, arestasDe(n, eTerra)).map((l) => suavizar(l));
  const pIlha = pathDePontos(lacosTerra);

  // --- penhasco: bandas extrudadas do contorno suavizado. Segmento com dx < 0 (percurso horário, interior à direita)
  //     tem a normal externa apontando para baixo na tela = face visível; dy < 0 → face SW (rocha), dy > 0 → SE (rocha2).
  //     Cada trecho contíguo da mesma face vira um polígono (topo → base com profundidade p = 72 + 12·ruído).
  const prof = (x: number, y: number) => 72 + 12 * ruP(x * 0.004 + 200, y * 0.008 + 200);
  const bandas: Banda[] = [];
  const pFioFrente = new Path2D();
  const pFioTras = new Path2D();
  const pLabio = new Path2D();
  const frentePts: Ponto[] = []; // pontos do contorno da frente (para estalactites)
  for (const l of lacosTerra) {
    const m = l.length;
    const classe = new Int8Array(m); // 0 = trás, 1 = SW, 2 = SE
    for (let k = 0; k < m; k++) {
      const a = l[k];
      const b = l[(k + 1) % m];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      classe[k] = dx < 0 ? (dy < 0 ? 1 : 2) : 0;
    }
    // começa num segmento de trás para os trechos não ficarem partidos no índice 0
    let ini = 0;
    while (ini < m && classe[ini] !== 0) ini++;
    if (ini === m) ini = 0;
    let k = 0;
    while (k < m) {
      const cl = classe[(ini + k) % m];
      let len = 1;
      while (len < m - k && classe[(ini + k + len) % m] === cl) len++;
      const idxs: Ponto[] = [];
      for (let q = 0; q <= len; q++) idxs.push(l[(ini + k + q) % m]);
      if (cl === 0) {
        for (let q = 0; q < idxs.length - 1; q++) {
          const a = idxs[q];
          const b = idxs[q + 1];
          pFioTras.moveTo(a[0], a[1]);
          pFioTras.lineTo(b[0], b[1]);
        }
      } else {
        const p = new Path2D();
        const banda = new Path2D();
        let somaY = 0;
        for (let q = 0; q < idxs.length; q++) {
          const pt = idxs[q];
          if (q) p.lineTo(pt[0], pt[1]);
          else p.moveTo(pt[0], pt[1]);
          somaY += pt[1];
        }
        for (let q = idxs.length - 1; q >= 0; q--) {
          const pt = idxs[q];
          p.lineTo(pt[0], pt[1] + prof(pt[0], pt[1]));
        }
        p.closePath();
        for (let q = 0; q < idxs.length; q++) {
          const pt = idxs[q];
          const pq = prof(pt[0], pt[1]);
          if (q) banda.lineTo(pt[0], pt[1] + pq - 24);
          else banda.moveTo(pt[0], pt[1] + pq - 24);
        }
        for (let q = idxs.length - 1; q >= 0; q--) {
          const pt = idxs[q];
          banda.lineTo(pt[0], pt[1] + prof(pt[0], pt[1]));
        }
        banda.closePath();
        for (let q = 0; q < idxs.length; q++) {
          const pt = idxs[q];
          if (q) pLabio.lineTo(pt[0], pt[1]);
          else pLabio.moveTo(pt[0], pt[1]);
        }
        for (let q = idxs.length - 1; q >= 0; q--) {
          const pt = idxs[q];
          pLabio.lineTo(pt[0], pt[1] + 5);
        }
        pLabio.closePath();
        for (let q = 0; q < idxs.length - 1; q++) {
          const a = idxs[q];
          const b = idxs[q + 1];
          pFioFrente.moveTo(a[0], a[1]);
          pFioFrente.lineTo(b[0], b[1]);
          frentePts.push(a);
        }
        // veios: 1 a cada ~3 segmentos, zigue-zague descendo pela face
        const veios = new Path2D();
        for (let q = 1; q < idxs.length - 1; q += 3) {
          if (r() >= 0.5) continue;
          const pt = idxs[q];
          let vx = pt[0];
          let vy = pt[1] + 4;
          veios.moveTo(vx, vy);
          const lado = r() < 0.5 ? 1 : -1;
          for (let z = 0; z < 5; z++) {
            vx += lado * (z % 2 ? 4 : -4) + (r() - 0.5) * 3;
            vy += 7 + r() * 4;
            veios.lineTo(vx, vy);
          }
        }
        bandas.push({ y: somaY / idxs.length, cor: cl === 1 ? COR_FACE.sw : COR_FACE.se, p, banda, veios, sw: cl === 1 });
      }
      k += len;
    }
  }
  bandas.sort((a, b) => a.y - b.y); // pintor: trás → frente
  const pUniaoSW = new Path2D();
  const pUniaoSE = new Path2D();
  for (const b of bandas) (b.sw ? pUniaoSW : pUniaoSE).addPath(b.p);

  // --- estalactites e cristais: pontos mais baixos do contorno da frente, espaçados na horizontal.
  //     Desempate por jitter fixo por ponto (comparador consistente).
  let yMax = -Infinity;
  for (const q of frentePts) if (q[1] > yMax) yMax = q[1];
  const cand = frentePts
    .filter((q) => q[1] >= yMax - 110)
    .map((q) => ({ q, j: r() }))
    .sort((a, b) => b.q[1] - a.q[1] || a.j - b.j)
    .map((e) => e.q);
  const escolhidas: Ponto[] = [];
  for (const q of cand) {
    if (escolhidas.length >= 5) break;
    if (escolhidas.every((g) => Math.abs(g[0] - q[0]) >= 150)) escolhidas.push(q);
  }
  const pEstalactites = new Path2D();
  const cristais: Cristal[] = [];
  escolhidas.forEach((q, k) => {
    const mx = q[0];
    const my = q[1] + prof(q[0], q[1]);
    pEstalactites.moveTo(mx - 9, my - 2);
    pEstalactites.lineTo(mx + 9, my - 2);
    pEstalactites.lineTo(mx + 1.5, my + 26);
    pEstalactites.closePath();
    if (k < 3) cristais.push({ x: mx + 1, y: my + 16, dir: 1, k: 1, fase: r() * 6.28, grande: true }); // pendurado na ponta
    else cristais.push({ x: mx + (r() - 0.5) * 20, y: q[1] + 14, dir: 1, k: 0.8, fase: r() * 6.28, grande: true }); // incrustado na face
  });
  for (let k = 0; k < 5; k++) {
    // cristais pequenos (só em 'perto'), em pontos aleatórios da frente
    if (!cand.length) break;
    const q = cand[Math.floor(r() * cand.length)];
    cristais.push({ x: q[0] + (r() - 0.5) * 24, y: q[1] + 10 + r() * 14, dir: 1, k: 0.45, fase: r() * 6.28, grande: false });
  }

  // --- regiões: contorno suavizado + tons de altura por casa (clipados pela região no desenho) + hachura
  const regioes: RegiaoCache[] = ilha.regioes.map((reg) => {
    const sr = new Set(reg.casas);
    const lacos = lacosDe(
      n,
      arestasDe(n, (i) => sr.has(i)),
    ).map((l) => suavizar(l));
    const p = pathDePontos(lacos);
    const tonsPerto = new Map<string, Path2D>();
    const tonsLonge = new Map<string, Path2D>();
    const chaveTom = new Map<number, string>();
    for (const i of reg.casas) {
      const x = i % n;
      const y = (i / n) | 0;
      if (agua[i] || naPlataforma(pl, x, y)) continue;
      const nivel = Math.round((altura[i] - 0.5) * 6); // −3..3
      let cor = chaveTom.get(nivel);
      if (!cor) {
        cor = misturar(TOM[reg.tipo], nivel > 0 ? "#ffffff" : P.gramaEsc, Math.abs(nivel) * 0.027);
        chaveTom.set(nivel, cor);
      }
      if (nivel !== 0) losangoEm(pathDe(tonsLonge, cor), x, y, 0, 0);
      const corX = misturar(cor, (x + y) % 2 ? "#000000" : "#ffffff", 0.03);
      losangoEm(pathDe(tonsPerto, corX), x, y, 0, 0);
    }
    // hachura diagonal (usada só quando bloqueada): linhas a cada 10 px de mundo cobrindo o bbox do contorno
    const bb = bboxDe(lacos);
    const hachura = new Path2D();
    for (let d = bb.x0 - (bb.y1 - bb.y0); d < bb.x1; d += 10) {
      hachura.moveTo(d, bb.y0);
      hachura.lineTo(d + (bb.y1 - bb.y0), bb.y1);
    }
    return {
      r: reg,
      p,
      tonsPerto: Array.from(tonsPerto, ([cor, path]) => ({ cor, p: path })),
      tonsLonge: Array.from(tonsLonge, ([cor, path]) => ({ cor, p: path })),
      hachura,
      centro: centro(reg.centro[0], reg.centro[1]),
    };
  });

  // --- malha sutil (arestas NE e NW das casas de grama)
  const pMalha = new Path2D();
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = indiceCasa(n, x, y);
      if (!terra[i] || agua[i] || naPlataforma(pl, x, y)) continue;
      segmento(pMalha, x, y, x + 1, y);
      segmento(pMalha, x, y, x, y + 1);
    }
  }

  // --- água: um único contorno suavizado (sem malha interna); ondulações em 1 de cada 3 casas
  const pLago = pathSuave(lacosDe(n, arestasDe(n, eAgua)), 2, 0);
  const aguaCentros: number[] = [];
  let na = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!agua[indiceCasa(n, x, y)]) continue;
      if (na++ % 3) continue;
      const [cx, cy] = centro(x, y);
      aguaCentros.push(cx, cy);
    }
  }

  // --- caminhos da vila: contorno suavizado (1 passada, para o corredor não afinar) + linha central para o modo mapa
  const pCaminho = pathSuave(lacosDe(n, arestasDe(n, eCaminho)), 1, 0);
  const pCaminhoLinha = new Path2D();
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = indiceCasa(n, x, y);
      if (!caminho[i]) continue;
      const a = centro(x, y);
      if (x + 1 < n && caminho[indiceCasa(n, x + 1, y)]) {
        const b = centro(x + 1, y);
        pCaminhoLinha.moveTo(a[0], a[1]);
        pCaminhoLinha.lineTo(b[0], b[1]);
      }
      if (y + 1 < n && caminho[indiceCasa(n, x, y + 1)]) {
        const b = centro(x, y + 1);
        pCaminhoLinha.moveTo(a[0], a[1]);
        pCaminhoLinha.lineTo(b[0], b[1]);
      }
    }
  }

  // --- plataforma do Núcleo (elevada), anéis, malha, faces
  const up = -ELEV_PLAT;
  const { x0, y0, lado, meio } = pl;
  const pPlatBase = quadCasas(x0, y0, lado, 0);
  const pPlatTopo = quadCasas(x0, y0, lado, up);
  const nAneis = (lado + 1) >> 1;
  const pAneis = Array.from({ length: nAneis }, () => new Path2D());
  const pPlatMalha = new Path2D();
  for (let y = y0; y < y0 + lado; y++) {
    for (let x = x0; x < x0 + lado; x++) {
      const anel = Math.max(Math.abs(x - meio), Math.abs(y - meio)) + 1;
      losangoEm(pAneis[Math.min(anel, nAneis) - 1], x, y, 0, up);
      segmento(pPlatMalha, x, y, x + 1, y, up);
      segmento(pPlatMalha, x, y, x, y + 1, up);
      if (x === x0 + lado - 1) segmento(pPlatMalha, x + 1, y, x + 1, y + 1, up);
      if (y === y0 + lado - 1) segmento(pPlatMalha, x, y + 1, x + 1, y + 1, up);
    }
  }
  const pPlatSW = new Path2D();
  const pPlatSE = new Path2D();
  {
    const a = iso(x0, y0 + lado);
    const b = iso(x0 + lado, y0 + lado);
    const d = iso(x0 + lado, y0);
    quad(pPlatSW, a[0], a[1] + up, b[0], b[1] + up, b[0], b[1], a[0], a[1]);
    quad(pPlatSE, b[0], b[1] + up, d[0], d[1] + up, d[0], d[1], b[0], b[1]);
  }

  // --- limites em mundo (topo da ilha; e com penhasco + sombra)
  const bboxTopo = bboxDe(lacosTerra);
  const bbox: Bbox = { x0: bboxTopo.x0 - 4, y0: bboxTopo.y0 - ELEV_PLAT, x1: bboxTopo.x1 + 16, y1: bboxTopo.y1 + 150 + 12 };

  return {
    plataforma: pl,
    pIlha,
    bandas,
    pFioFrente,
    pFioTras,
    pLabio,
    pUniaoSW,
    pUniaoSE,
    pEstalactites,
    cristais,
    regioes,
    pMalha,
    pLago,
    aguaCentros,
    pCaminho,
    pCaminhoLinha,
    pPlatBase,
    pPlatTopo,
    pAneis,
    pPlatMalha,
    pPlatSW,
    pPlatSE,
    bboxTopo,
    bbox,
    padroes: null,
    mini: null,
  };
}

// ---------------------------------------------------------------------------------------------
// Desenho do chão (em coordenadas de mundo; a transformação já está aplicada no contexto recebido)
// ---------------------------------------------------------------------------------------------
const DASH = [10, 8];

function desenharCristal(ctx: CanvasRenderingContext2D, cr: Cristal, t: number, perto: boolean): void {
  const { k, x, y, dir: d } = cr;
  if (cr.grande || perto) {
    // halo em degraus (void), aditivo
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = alfa(P.void, 0.1);
    elipse(ctx, x, y + d * 8 * k, 14 * k, 14 * k);
    ctx.fill();
    ctx.fillStyle = alfa(P.void, 0.18);
    elipse(ctx, x, y + d * 8 * k, 9 * k, 9 * k);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.fillStyle = P.cristal;
  ctx.strokeStyle = P.cristal;
  ctx.lineJoin = "round";
  ctx.lineWidth = 3 * k;
  ctx.beginPath();
  ctx.moveTo(x - 5 * k, y);
  ctx.lineTo(x + 5 * k, y);
  ctx.lineTo(x + 1 * k, y + d * 22 * k);
  ctx.closePath();
  ctx.moveTo(x + 3 * k, y);
  ctx.lineTo(x + 11 * k, y);
  ctx.lineTo(x + 8 * k, y + d * 14 * k);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = P.cristal2;
  ctx.lineWidth = 2 * k;
  ctx.beginPath();
  ctx.moveTo(x + 5 * k, y);
  ctx.lineTo(x + 1 * k, y + d * 22 * k);
  ctx.stroke();
  if (perto) {
    ctx.fillStyle = alfa(P.ink, 0.5 + 0.5 * Math.sin(t * 3 + cr.fase));
    elipse(ctx, x - 1 * k, y + d * 7 * k, 1.6 * k, 1.6 * k);
    ctx.fill();
  }
}

/**
 * Chão estático (sombra, penhasco, topo, lago, caminhos, plataforma, véus). O que anima (ondulações, cristais,
 * tracejado das bloqueadas) fica fora, em `desenharTerreno`. `lw(px)` converte px de tela em px de mundo.
 */
function desenharChao(g: Ctx2D, c: CacheTerreno, perto: boolean, mapa: boolean, lw: (px: number) => number, opcoes: OpcoesTerreno): void {
  const livre = (R: RegiaoCache) => opcoes.desbloqueadas.has(R.r.id);

  // 1. sombra chapada da ilha no espaço (duas cópias, a segunda mais fraca e mais baixa)
  g.fillStyle = P.sombraIlha;
  g.translate(12, 130);
  g.fill(c.pIlha);
  g.globalAlpha = 0.25;
  g.translate(0, 20);
  g.fill(c.pIlha);
  g.globalAlpha = 1;
  g.translate(-12, -150);

  // 2. penhasco: bandas de trás para a frente (preenchimento, faixa inferior rocha3, veios)
  for (const f of c.bandas) {
    g.fillStyle = f.cor;
    g.fill(f.p);
    g.fillStyle = P.rocha3;
    if (!perto) g.globalAlpha = 0.5;
    g.fill(f.banda);
    g.globalAlpha = 1;
    if (perto) {
      g.strokeStyle = P.rocha3;
      g.lineWidth = 2;
      g.stroke(f.veios);
    }
  }
  if (perto && c.padroes?.sw && c.padroes.se) {
    // pontilhado da rocha
    g.globalAlpha = 0.35;
    g.fillStyle = c.padroes.sw;
    g.fill(c.pUniaoSW);
    g.fillStyle = c.padroes.se;
    g.fill(c.pUniaoSE);
    g.globalAlpha = 1;
  }
  g.fillStyle = P.gramaLabio; // lábio de grama pendurado na borda
  g.fill(c.pLabio);
  g.fillStyle = P.rocha3; // estalactites (rocha3) sob as faces da frente
  g.fill(c.pEstalactites);

  // 3. topo: base contínua, depois cada região (tom base + tons de altura clipados pelo contorno suavizado)
  g.fillStyle = P.grama;
  g.fill(c.pIlha);
  for (const R of c.regioes) {
    const desbloqueada = livre(R);
    g.fillStyle = desbloqueada ? TOM[R.r.tipo] : TOM_BLOQUEADO[R.r.tipo];
    g.fill(R.p);
    if (!desbloqueada) continue;
    const tons = perto ? R.tonsPerto : R.tonsLonge;
    if (!tons.length) continue;
    g.save();
    g.clip(R.p);
    for (const tom of tons) {
      g.fillStyle = tom.cor;
      g.fill(tom.p);
    }
    g.restore();
  }

  // 4. lago: faixa de areia fora, água, borda aguaFunda por dentro do perímetro
  g.lineJoin = "round";
  g.lineCap = "round";
  g.strokeStyle = P.areia;
  g.lineWidth = 12;
  g.stroke(c.pLago);
  g.fillStyle = P.agua;
  g.fill(c.pLago);
  g.save();
  g.clip(c.pLago);
  g.strokeStyle = P.aguaFunda;
  g.lineWidth = 8;
  g.stroke(c.pLago);
  g.restore();

  // 5. caminhos da vila: contorno em 'perto', traço arredondado na cor do caminho, preenchimento; no modo mapa, só a linha
  if (mapa) {
    g.strokeStyle = P.caminho;
    g.lineWidth = lw(2);
    g.stroke(c.pCaminhoLinha);
  } else {
    if (perto) {
      g.strokeStyle = P.caminhoBorda;
      g.lineWidth = 8 + lw(2);
      g.stroke(c.pCaminho);
    }
    g.strokeStyle = P.caminho;
    g.lineWidth = 8;
    g.stroke(c.pCaminho);
    g.fillStyle = P.caminho;
    g.fill(c.pCaminho);
  }

  // 6. malha sutil (só perto, clipada pela ilha) e fios da borda (trás: claro; frente: lábio claro)
  if (perto) {
    g.save();
    g.clip(c.pIlha);
    g.strokeStyle = P.malha;
    g.lineWidth = lw(1);
    g.stroke(c.pMalha);
    g.restore();
  }
  g.strokeStyle = COR_FIO_TRAS;
  g.lineWidth = Math.max(2, lw(1.2));
  g.stroke(c.pFioTras);
  g.strokeStyle = COR_FIO_FRENTE;
  g.lineWidth = Math.max(1.5, lw(1));
  g.stroke(c.pFioFrente);

  // 7. plataforma do Núcleo: faces, base contínua, anéis (os além da grade jogável ficam bloqueados: mais escuros e
  //    pontilhados), malha, aresta externa (1 px de tela em longe, 2 em perto) e aresta da grade jogável quando menor
  g.fillStyle = COR_PLAT_SW;
  g.fill(c.pPlatSW);
  g.fillStyle = COR_PLAT_SE;
  g.fill(c.pPlatSE);
  g.fillStyle = P.casa;
  g.fill(c.pPlatTopo);
  const anelMax = (opcoes.ladoGrade + 1) >> 1;
  const nAneis = c.pAneis.length;
  for (let a = 1; a <= nAneis; a++) {
    g.fillStyle = a > anelMax ? COR_ANEL_BLOQUEADO : COR_ANEL[Math.min(a, COR_ANEL.length) - 1];
    g.fill(c.pAneis[a - 1]);
  }
  if (anelMax < nAneis && c.padroes?.bloqueado) {
    g.globalAlpha = 0.45;
    g.fillStyle = c.padroes.bloqueado;
    for (let a = anelMax + 1; a <= nAneis; a++) g.fill(c.pAneis[a - 1]);
    g.globalAlpha = 1;
  }
  g.strokeStyle = alfa(P.ink, 0.06);
  g.lineWidth = Math.max(1, lw(1));
  g.stroke(c.pPlatMalha);
  g.strokeStyle = alfa(P.sky, perto ? 0.35 : 0.6);
  g.lineWidth = perto ? 2 : lw(1);
  g.stroke(c.pPlatTopo);
  if (anelMax < nAneis) {
    const { meio } = c.plataforma;
    const lg = opcoes.ladoGrade;
    g.stroke(quadCasas(meio - (lg >> 1), meio - (lg >> 1), lg, -ELEV_PLAT));
  }

  // 8. regiões bloqueadas: véu + hachura diagonal (clipada, 1,5 px de tela); o contorno tracejado anima e fica fora do cache
  for (const R of c.regioes) {
    if (livre(R)) continue;
    g.fillStyle = VEU_BLOQUEIO;
    g.fill(R.p);
    if (!mapa) {
      g.save();
      g.clip(R.p);
      g.strokeStyle = HACHURA;
      g.lineWidth = lw(1.5);
      g.stroke(R.hachura);
      g.restore();
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Cache do chão: um offscreen por canvas de destino, de 1,5w × 1,5h px CSS (margem de 25 % por lado), chaveado por
// (zoom, LOD, dpr, tamanho, estado). Dois modos:
//   • "ilha inteira": quando a ilha cabe no offscreen, ele é montado centrado na ilha e vale para qualquer pan (blit 1:1);
//     na transição (opcoes.chaoEscalavel) vale também reduzido sem rebuild;
//   • "janela": em zoom alto, o offscreen cobre o viewport + margem; no pan só o deslocamento muda (drawImage) e o
//     rebuild acontece quando o viewport sai da margem ou o zoom muda.
// ---------------------------------------------------------------------------------------------
interface CacheChao {
  tela: Tela;
  ilha: Ilha | null;
  zc: number;
  wx0: number;
  wy0: number;
  inteira: boolean;
  perto: boolean;
  mapa: boolean;
  dpr: number;
  W: number;
  H: number;
  chave: string;
}

const chaos = new Map<HTMLCanvasElement, CacheChao>();

export function desenharTerreno(ctx: CanvasRenderingContext2D, ilha: Ilha, cam: Camera, t: number, opcoes: OpcoesTerreno): void {
  const c = cacheDe(ilha);
  garantirPadroes(c, ctx);
  const z = cam.zoom || 1;
  const perto = lodDe(z) === "perto";
  const mapa = z < ZOOM_MAPA;
  const lw = (px: number) => px / z;
  const cv = ctx.canvas;
  const w = cam.w || cv.clientWidth || cv.width;
  const h = cam.h || cv.clientHeight || cv.height;
  const tx = cam.tx || 0;
  const ty = cam.ty || 0;
  let dpr = cv.width / w;
  if (opcoes.chaoDpr) dpr = Math.min(dpr, opcoes.chaoDpr);
  const W = Math.ceil(w * 1.5);
  const H = Math.ceil(h * 1.5);
  const b = c.bbox;
  const chave = chaveEstado(opcoes);
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  let ch = chaos.get(cv);
  if (!ch) {
    ch = { tela: criarTela(1, 1), ilha: null, zc: 0, wx0: 0, wy0: 0, inteira: false, perto: false, mapa: false, dpr: 0, W: 0, H: 0, chave: "" };
    chaos.set(cv, ch);
  }
  const mesmo = ch.ilha === ilha && ch.perto === perto && ch.mapa === mapa && ch.dpr === dpr && ch.W === W && ch.H === H && ch.chave === chave;
  let valido = false;
  if (mesmo) {
    const mesmoZoom = Math.abs(z - ch.zc) < 1e-9;
    // ilha inteira: vale no mesmo zoom (blit 1:1); durante a transição (chaoEscalavel) também reduzido (z < zc)
    if (ch.inteira) valido = mesmoZoom || (opcoes.chaoEscalavel === true && z < ch.zc);
    else valido = mesmoZoom && -tx / z >= ch.wx0 && (w - tx) / z <= ch.wx0 + W / ch.zc && -ty / z >= ch.wy0 && (h - ty) / z <= ch.wy0 + H / ch.zc;
  }
  if (!valido) {
    const zFit = Math.min(W / (b.x1 - b.x0), H / (b.y1 - b.y0));
    const inteira = z <= zFit;
    const zc = z;
    if (inteira) {
      ch.wx0 = (b.x0 + b.x1) / 2 - W / 2 / zc;
      ch.wy0 = (b.y0 + b.y1) / 2 - H / 2 / zc;
    } else {
      ch.wx0 = -tx / z - (w * 0.25) / z;
      ch.wy0 = -ty / z - (h * 0.25) / z;
    }
    ch.zc = zc;
    ch.inteira = inteira;
    ch.ilha = ilha;
    ch.perto = perto;
    ch.mapa = mapa;
    ch.dpr = dpr;
    ch.W = W;
    ch.H = H;
    ch.chave = chave;
    const pw = Math.ceil(W * dpr);
    const ph = Math.ceil(H * dpr);
    const { canvas, g } = ch.tela;
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, pw, ph);
    g.setTransform(dpr * zc, 0, 0, dpr * zc, -ch.wx0 * zc * dpr, -ch.wy0 * zc * dpr);
    g.lineJoin = "round";
    g.lineCap = "round";
    desenharChao(g, c, perto, mapa, (px) => px / zc, opcoes);
  }
  // blit: canto do offscreen em tela = (wx0·z + tx, wy0·z + ty), escala z/zc (em px do dispositivo)
  {
    const k = z / ch.zc;
    const dprCv = cv.width / w;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(ch.tela.canvas, (ch.wx0 * z + tx) * dprCv, (ch.wy0 * z + ty) * dprCv, W * k * dprCv, H * k * dprCv);
    ctx.setTransform(dprCv * z, 0, 0, dprCv * z, dprCv * tx, dprCv * ty);
  }

  // ondulações da água (só perto): um arco por 3 casas, oscilando com t
  if (perto && c.aguaCentros.length) {
    ctx.strokeStyle = alfa(P.agua2, 0.6);
    ctx.lineWidth = lw(1.5);
    ctx.beginPath();
    for (let i = 0; i < c.aguaCentros.length; i += 2) {
      const cx = c.aguaCentros[i];
      const cy = c.aguaCentros[i + 1];
      const o = 6 * Math.sin(t * 0.4 + cx * 0.05);
      ctx.moveTo(cx + o - 10, cy - 2);
      ctx.quadraticCurveTo(cx + o - 4, cy - 6, cx + o + 2, cy - 2);
    }
    ctx.stroke();
  }

  // cristais do penhasco (grandes sempre; pequenos só perto)
  for (const cr of c.cristais) if (cr.grande || perto) desenharCristal(ctx, cr, t, perto);

  // contorno das bloqueadas: 2 px de tela, tracejado [10,8] A(ink,.45) em qualquer LOD (corre em perto)
  ctx.strokeStyle = BORDA_BLOQUEIO;
  ctx.lineWidth = lw(2);
  DASH[0] = lw(10);
  DASH[1] = lw(8);
  ctx.setLineDash(DASH);
  ctx.lineDashOffset = perto ? -t * lw(8) : 0;
  for (const R of c.regioes) if (!opcoes.desbloqueadas.has(R.r.id)) ctx.stroke(R.p);
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  ctx.restore();
}

/** Descarta todos os caches (geometria, chão e minimapa). A próxima chamada reconstrói. */
export function liberarCacheTerreno(): void {
  for (const ch of chaos.values()) {
    ch.tela.canvas.width = 1;
    ch.tela.canvas.height = 1;
  }
  chaos.clear();
  caches = new WeakMap<Ilha, CacheTerreno>();
}

// ---------------------------------------------------------------------------------------------
// Minimapa: silhueta + regiões + lago + Núcleo + retângulo da câmera, em (0,0)-(w,h) do ctx recebido.
// ---------------------------------------------------------------------------------------------
function ajusteMinimapa(c: CacheTerreno, w: number, h: number): { s: number; ox: number; oy: number } {
  const b = c.bboxTopo;
  const m = 6;
  const s = Math.min((w - 2 * m) / (b.x1 - b.x0), (h - 2 * m) / (b.y1 - b.y0));
  return { s, ox: (w - (b.x1 - b.x0) * s) / 2 - b.x0 * s, oy: (h - (b.y1 - b.y0) * s) / 2 - b.y0 * s };
}

/**
 * A silhueta (regiões, lago, plataforma) é desenhada uma vez num offscreen em 4× e reduzida com imageSmoothing: os contornos
 * suavizados (Chaikin) chegam ao minimapa sem escadinha. Só o retângulo da câmera e o ponto do Núcleo são por quadro.
 */
function garantirMini(c: CacheTerreno, w: number, h: number, livres: ReadonlySet<RegiaoId>): Mini {
  const chave = chaveConjunto(livres);
  if (c.mini && c.mini.w === w && c.mini.h === h && c.mini.chave === chave) return c.mini;
  const SS = 4;
  const tela = criarTela(Math.ceil(w * SS), Math.ceil(h * SS));
  const g = tela.g;
  const { s, ox, oy } = ajusteMinimapa(c, w, h);
  g.setTransform(SS, 0, 0, SS, 0, 0);
  const recorte = new Path2D();
  retArred(recorte, 0, 0, w, h, 12);
  g.clip(recorte);
  g.translate(ox, oy);
  g.scale(s, s);
  g.lineJoin = "round";
  g.fillStyle = P.grama;
  g.fill(c.pIlha);
  for (const R of c.regioes) {
    const livre = livres.has(R.r.id);
    g.fillStyle = livre ? TOM[R.r.tipo] : P.navy2;
    g.fill(R.p);
    if (!livre) {
      g.strokeStyle = MINI_BORDA;
      g.lineWidth = 1 / s;
      g.stroke(R.p);
    }
  }
  g.fillStyle = P.agua;
  g.fill(c.pLago);
  g.fillStyle = P.casa;
  g.fill(c.pPlatBase);
  c.mini = { tela, w, h, chave };
  return c.mini;
}

/** Sem `desbloqueadas`, todas as regiões são desenhadas livres. */
export function desenharMinimapa(ctx: CanvasRenderingContext2D, ilha: Ilha, cam: Camera, w: number, h: number, desbloqueadas?: ReadonlySet<RegiaoId>): void {
  const c = cacheDe(ilha);
  const livres = desbloqueadas ?? new Set(ilha.regioes.map((r) => r.id));
  const { s, ox, oy } = ajusteMinimapa(c, w, h);
  const mini = garantirMini(c, w, h, livres);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(mini.tela.canvas, 0, 0, w, h);
  ctx.restore();
  const { meio } = ilha.plataforma;
  const [nx, ny] = centro(meio, meio);
  ctx.fillStyle = P.sun;
  elipse(ctx, ox + nx * s, oy + ny * s, 3, 3);
  ctx.fill();
  // retângulo da câmera
  if (cam.w && cam.h && cam.zoom) {
    const x0 = -cam.tx / cam.zoom;
    const y0 = -cam.ty / cam.zoom;
    const x1 = (cam.w - cam.tx) / cam.zoom;
    const y1 = (cam.h - cam.ty) / cam.zoom;
    ctx.save();
    retArred(ctx, 0, 0, w, h, 12);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(ox + x0 * s, oy + y0 * s, (x1 - x0) * s, (y1 - y0) * s);
    ctx.fillStyle = MINI_RECT;
    ctx.fill();
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}

/** Ponto do minimapa (mx, my) → coordenadas de mundo (para arrastar a câmera pelo minimapa). */
export function minimapaParaMundo(ilha: Ilha, mx: number, my: number, w: number, h: number): [number, number] {
  const { s, ox, oy } = ajusteMinimapa(cacheDe(ilha), w, h);
  return [(mx - ox) / s, (my - oy) / s];
}

/** Limites da ilha em mundo: topo (para enquadrar) e total (com penhasco e sombra). */
export function limitesIlha(ilha: Ilha): { topo: Bbox; total: Bbox } {
  const c = cacheDe(ilha);
  return { topo: c.bboxTopo, total: c.bbox };
}

/** Hit-test: plataforma (elevada) primeiro, depois o chão. Devolve [x, y] ou null. */
export function casaEm(ilha: Ilha, wx: number, wy: number): [number, number] | null {
  const pl = ilha.plataforma;
  let [fx, fy] = desiso(wx, wy + ELEV_PLAT);
  let x = Math.floor(fx);
  let y = Math.floor(fy);
  if (naPlataforma(pl, x, y)) return [x, y];
  [fx, fy] = desiso(wx, wy);
  x = Math.floor(fx);
  y = Math.floor(fy);
  if (x < 0 || y < 0 || x >= ilha.n || y >= ilha.n) return null;
  return ilha.terra[indiceCasa(ilha.n, x, y)] ? [x, y] : null;
}
