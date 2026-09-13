/**
 * Fundo espacial do tabuleiro (direcao.md §3): gradiente por nível → nebulosas → estrelas com paralaxe →
 * Sol e planeta de fundo (só na ilha) → grão. Desenha em coordenadas de TELA (px CSS; a transformação
 * corrente é a identidade ou só o fator de DPR). Tudo o que é caro (gradientes, nebulosas, estrelas, grão)
 * fica em cache por tamanho e por nível e só é refeito no resize; nada é alocado por quadro. Geometria via
 * `rnd`, animação via `t`; com `movimentoReduzido()` não há cintilação, respiração nem giro.
 * Canvas offscreen via `OffscreenCanvas` (sem `document`).
 */
import type { NivelId } from "../../content/escalas";
import { desenharCeu } from "./mar";
import { PALETA, alfa, misturar, movimentoReduzido, rnd, type Camera } from "./base";

/** Paleta local (direcao.md §2): ajustes entram aqui, nunca em base.ts. */
const P = {
  ...PALETA,
  oceano: "#1e5bd6",
  oceano2: "#0f2f7a",
  fundoPlaneta: "#0a1642",
  fundoGalaxia: "#140b38",
  fundoUniverso: "#04071a",
  fundoMultiverso: "#1a0a30",
} as const;

/** Matiz por nível: tom do centro do gradiente (a borda é sempre navy), nebulosas e peso das estrelas. */
interface ConfigNivel {
  grad: string;
  /** [matiz de acento, peso]: compostas em 'lighter', a matiz pura em opacidade baixa vira M(acento, navy). */
  neb: readonly (readonly [string, number])[];
  /** Multiplicador de opacidade das estrelas (quanto mais longe, menos "estrelas" fazem sentido). */
  estrelas: number;
  blobs: number;
}

const CONFIG: Record<NivelId, ConfigNivel> = {
  ilha: { grad: P.navy2, neb: [[P.void, 1], [P.sky, 0.8]], estrelas: 1, blobs: 5 },
  planeta: { grad: P.fundoPlaneta, neb: [[P.sky, 1], [P.ion, 0.6]], estrelas: 1, blobs: 4 },
  // sistema: a aura quente em volta do Sol segue o pan/zoom (nebOuro, abaixo); aqui só o gradiente navy2.
  sistema: { grad: P.navy2, neb: [[P.void, 0.7], [P.sky, 0.5]], estrelas: 0.95, blobs: 3 },
  galaxia: { grad: P.fundoGalaxia, neb: [[P.void, 1], [P.plasma, 0.55]], estrelas: 0.85, blobs: 5 },
  universo: { grad: P.fundoUniverso, neb: [[P.ion, 0.8], [P.void, 0.6]], estrelas: 0.65, blobs: 4 },
  multiverso: { grad: P.fundoMultiverso, neb: [[P.plasma, 1], [P.void, 0.8]], estrelas: 0.5, blobs: 5 },
};

/** Paralaxe (fração do deslocamento da câmera): nebulosa 0,05×, estrelas 0,10×, Sol/planeta 0,15×. */
const PARALAXE = { neb: 0.05, estrelas: 0.1, astros: 0.15 } as const;
const TAU = Math.PI * 2;
const SEED = 0x5a7e11;
/** Opacidade padrão do grão (nunca passa de 4 %). */
const GRAO_ALFA = 0.03;
const SEM_TRACO: number[] = [];

/* ------------------------------------------------------------------ */
/* Cache por tamanho (px CSS) e por nível                               */
/* ------------------------------------------------------------------ */

interface Nebulosa {
  canvas: OffscreenCanvas;
  /** Margem para a paralaxe não descobrir a borda. */
  mx: number;
  my: number;
  w: number;
  h: number;
}

/** Gradiente + nebulosa pré-compostos (1:1 com o palco em px físicos), refeitos a cada 8 px de paralaxe. */
interface Base {
  canvas: OffscreenCanvas;
  nx: number;
  ny: number;
}

interface EstrelaGrande {
  x: number;
  y: number;
  seed: number;
  cor: string;
}

interface Estrelas {
  /** Pequenas em 3 baldes de opacidade. */
  p: readonly [Path2D, Path2D, Path2D];
  m: Path2D;
  mSky: Path2D;
  mSun: Path2D;
  g: EstrelaGrande[];
}

interface Cache {
  w: number;
  h: number;
  grad: Map<NivelId, CanvasGradient>;
  /** Só o nível atual e o anterior ficam residentes (a transição alterna os dois a cada quadro). */
  neb: Map<NivelId, Nebulosa>;
  nebOrdem: NivelId[];
  estrelas: Estrelas | null;
  grao: CanvasPattern | null;
  /** Gradiente unitário do blob quente do nível 'sistema'. */
  nebOuro: CanvasGradient | null;
  base: Map<NivelId, Base>;
  baseOrdem: NivelId[];
}

const cache: Cache = {
  w: 0,
  h: 0,
  grad: new Map(),
  neb: new Map(),
  nebOrdem: [],
  estrelas: null,
  grao: null,
  nebOuro: null,
  base: new Map(),
  baseOrdem: [],
};

function encolher(c: OffscreenCanvas): void {
  c.width = 1;
  c.height = 1;
}

function limparPorTamanho(): void {
  cache.grad.clear();
  for (const n of cache.neb.values()) encolher(n.canvas);
  cache.neb.clear();
  cache.nebOrdem.length = 0;
  cache.estrelas = null;
  for (const b of cache.base.values()) encolher(b.canvas);
  cache.base.clear();
  cache.baseOrdem.length = 0;
}

/** Só o tamanho em px CSS importa (o DPR fica na transformação base; as nebulosas são renderizadas em DPR 1). */
function garantirCache(w: number, h: number): void {
  if (cache.w === w && cache.h === h) return;
  cache.w = w;
  cache.h = h;
  limparPorTamanho();
}

/** Solta todos os canvases e gradientes (ao desmontar a cena). */
export function liberarCacheFundo(): void {
  cache.w = 0;
  cache.h = 0;
  limparPorTamanho();
  cache.grao = null;
  cache.nebOuro = null;
}

/* ------------------------------------------------------------------ */
/* Gradiente radial (0,55w, 0,4h), r 0 → 0,9·max(w,h)                  */
/* ------------------------------------------------------------------ */

function gradiente(g: OffscreenCanvasRenderingContext2D, w: number, h: number, nivel: NivelId): CanvasGradient {
  const pronto = cache.grad.get(nivel);
  if (pronto) return pronto;
  const cfg = CONFIG[nivel];
  const cx = 0.55;
  const cy = 0.4;
  const raio = Math.max(w, h) * 0.9;
  const grad = g.createRadialGradient(w * cx, h * cy, 0, w * cx, h * cy, raio);
  // três paradas: o tom do nível domina o meio, o navy segura a borda
  grad.addColorStop(0, cfg.grad);
  grad.addColorStop(0.55, misturar(cfg.grad, P.navy, 0.55));
  grad.addColorStop(1, P.navy);
  cache.grad.set(nivel, grad);
  return grad;
}

/* ------------------------------------------------------------------ */
/* Nebulosas: pré-renderizadas em offscreen, uma vez por nível/tamanho */
/* ------------------------------------------------------------------ */

/**
 * Cada blob = 3 elipses aninhadas com gradiente radial da matiz de acento → 0, compostas em 'lighter' sobre o
 * gradiente. Tamanhos em função do menor lado do palco para não estourar no celular. Renderizadas em DPR 1
 * (são borradas: 4–9× menos memória); só o nível atual e o anterior ficam em cache.
 */
function nebulosas(nivel: NivelId, w: number, h: number): Nebulosa | null {
  const pronta = cache.neb.get(nivel);
  if (pronta) return pronta;
  const cfg = CONFIG[nivel];
  // margem de 20 %: o pan máximo é ~25 % do palco × 0,05
  const mx = Math.ceil(w * 0.2);
  const my = Math.ceil(h * 0.2);
  const W = w + mx * 2;
  const H = h + my * 2;
  const canvas = new OffscreenCanvas(W, H);
  const g = canvas.getContext("2d");
  if (!g) return null;
  const r = rnd(SEED ^ (nivel.length * 7919 + nivel.charCodeAt(0) * 131));
  const esc = Math.max(0.55, Math.min(1.6, Math.min(w, h) / 720));
  const n = cfg.blobs;
  for (let i = 0; i < n; i++) {
    const [cor, peso] = cfg.neb[i % cfg.neb.length];
    const bx = mx + w * (0.08 + r() * 0.84);
    const by = my + h * (0.08 + r() * 0.84);
    const rx0 = (200 + r() * 240) * esc;
    const rot0 = r() * Math.PI;
    // 3 elipses aninhadas (raio decrescente, leve desvio de centro e de ângulo): blob macio sem arestas de
    // disco. Gradiente com 4 paradas para o degrau não aparecer.
    for (let k = 0; k < 3; k++) {
      const rx = rx0 * (1 - k * 0.28);
      const ry = rx * (0.6 + r() * 0.2);
      const ex = bx + (r() - 0.5) * rx0 * 0.35;
      const ey = by + (r() - 0.5) * rx0 * 0.25;
      const rot = rot0 + (r() - 0.5) * 0.8;
      g.save();
      g.translate(ex, ey);
      g.rotate(rot);
      g.scale(1, ry / rx);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      rg.addColorStop(0, alfa(cor, 0.075 * peso));
      rg.addColorStop(0.35, alfa(cor, 0.05 * peso));
      rg.addColorStop(0.7, alfa(cor, 0.018 * peso));
      rg.addColorStop(1, alfa(cor, 0));
      g.fillStyle = rg;
      g.beginPath();
      g.arc(0, 0, rx, 0, TAU);
      g.fill();
      g.restore();
    }
  }
  const neb: Nebulosa = { canvas, mx, my, w: W, h: H };
  cache.neb.set(nivel, neb);
  cache.nebOrdem.push(nivel);
  while (cache.nebOrdem.length > 2) {
    const velho = cache.nebOrdem.shift();
    if (velho === undefined) break;
    const cv = cache.neb.get(velho);
    if (cv) encolher(cv.canvas);
    cache.neb.delete(velho);
  }
  return neb;
}

/* ------------------------------------------------------------------ */
/* Estrelas: Path2D por tamanho/opacidade em [0,w)×[0,h), repetidas por wrap */
/* ------------------------------------------------------------------ */

function estrelas(w: number, h: number): Estrelas {
  if (cache.estrelas) return cache.estrelas;
  const r = rnd(SEED + 77);
  const dens = Math.max(0.35, Math.min(2.2, (w * h) / (1280 * 800)));
  const nP = Math.round(300 * dens);
  const nM = Math.round(60 * dens);
  const nG = Math.max(6, Math.round(10 * dens));
  // P: 3 baldes de opacidade (.5 / .7 / .9) para dar variação sem um Path2D por estrela
  const p: [Path2D, Path2D, Path2D] = [new Path2D(), new Path2D(), new Path2D()];
  for (let i = 0; i < nP; i++) {
    const x = r() * w;
    const y = r() * h;
    const b = Math.floor(r() * 3);
    p[b].moveTo(x + 0.8, y);
    p[b].arc(x, y, 0.8, 0, TAU);
  }
  const m = new Path2D();
  const mSky = new Path2D();
  const mSun = new Path2D();
  for (let i = 0; i < nM; i++) {
    const x = r() * w;
    const y = r() * h;
    const s = r();
    const alvo = s < 0.075 ? mSky : s < 0.15 ? mSun : m;
    alvo.moveTo(x + 1.6, y);
    alvo.arc(x, y, 1.6, 0, TAU);
  }
  const g: EstrelaGrande[] = [];
  for (let i = 0; i < nG; i++) {
    const x = r() * w;
    const y = r() * h;
    const seed = r() * TAU;
    const cor = r() < 0.3 ? P.sky : P.ink;
    g.push({ x, y, seed, cor });
  }
  cache.estrelas = { p, m, mSky, mSun, g };
  return cache.estrelas;
}

/** Desenha um Path2D com wrap (4 cópias deslocadas) para a paralaxe nunca abrir buraco. */
function fillWrap(ctx: CanvasRenderingContext2D, path: Path2D, ox: number, oy: number, w: number, h: number): void {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.fill(path);
  ctx.translate(-w, 0);
  ctx.fill(path);
  ctx.translate(0, -h);
  ctx.fill(path);
  ctx.translate(w, 0);
  ctx.fill(path);
  ctx.restore();
}

const modulo = (v: number, m: number): number => ((v % m) + m) % m;

const ALFAS_P = [0.5, 0.7, 0.9] as const;

function desenharEstrelas(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cam: Camera, mult: number, reduzido: boolean): void {
  const E = estrelas(w, h);
  const ox = modulo(cam.tx * PARALAXE.estrelas, w);
  const oy = modulo(cam.ty * PARALAXE.estrelas, h);
  const cint = reduzido ? 0 : 1;
  // P: cintilação "de grupo" (cada balde respira com uma fase): barata e sutil
  for (let b = 0; b < 3; b++) {
    const a = ALFAS_P[b] + cint * 0.08 * Math.sin(t * 1.3 + b * 2.1);
    ctx.fillStyle = alfa(P.ink, Math.max(0.2, Math.min(1, a * mult)));
    fillWrap(ctx, E.p[b], ox, oy, w, h);
  }
  ctx.fillStyle = alfa(P.ink, 0.9 * mult);
  fillWrap(ctx, E.m, ox, oy, w, h);
  ctx.fillStyle = alfa(P.sky, 0.9 * mult);
  fillWrap(ctx, E.mSky, ox, oy, w, h);
  ctx.fillStyle = alfa(P.sun, 0.9 * mult);
  fillWrap(ctx, E.mSun, ox, oy, w, h);
  // G: poucas, com cruz de 8 px e cintilação individual 1 + .15·sin(t·2 + seed)
  ctx.lineWidth = 1;
  for (const s of E.g) {
    const x = modulo(s.x + ox, w);
    const y = modulo(s.y + oy, h);
    const k = 1 + cint * 0.15 * Math.sin(t * 2 + s.seed);
    const rr = 2.5 * k;
    const cruz = 8 * k;
    ctx.fillStyle = alfa(s.cor, 0.95 * mult);
    ctx.strokeStyle = alfa(s.cor, 0.55 * mult);
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - cruz, y);
    ctx.lineTo(x + cruz, y);
    ctx.moveTo(x, y - cruz);
    ctx.lineTo(x, y + cruz);
    ctx.stroke();
  }
}

/* ------------------------------------------------------------------ */
/* Sol de fundo (nível ilha): canto superior ESQUERDO, ~40 % fora      */
/* ------------------------------------------------------------------ */

/**
 * A luz de toda a cena vem de cima-esquerda (face SW clara, sombras +4,+4), então o Sol fica nesse canto.
 * R = 0,12·min(w,h) no desktop; no celular 0,11·min(w,h) com 60 % fora do palco. Sem contorno, sem sombra,
 * sem blur: halos em degraus aditivos.
 */

/* ------------------------------------------------------------------ */
/* Órbita (ilha): removida com o céu do arquipélago (v0.6)              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Nível sistema: blob nebOuro (M(gold, navy, .78), α .35 → 0) de raio 2,5·RS·zoom centrado no Sol */
/* ------------------------------------------------------------------ */

/** O Sol do sistema fica na origem do mundo das escalas (tela = cam.tx, cam.ty). Gradiente unitário criado uma vez. */
const RS_SISTEMA = 70;

function desenharNebOuro(ctx: CanvasRenderingContext2D, cam: Camera): void {
  if (!cache.nebOuro) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    const cor = misturar(P.gold, P.navy, 0.78);
    g.addColorStop(0, alfa(cor, 0.35));
    g.addColorStop(0.5, alfa(cor, 0.18));
    g.addColorStop(1, alfa(cor, 0));
    cache.nebOuro = g;
  }
  const r = RS_SISTEMA * 2.5 * (cam.zoom || 1);
  ctx.save();
  ctx.translate(cam.tx, cam.ty);
  ctx.scale(r, r);
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = cache.nebOuro;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Grão: pattern 128×128 de ruído (rnd), cacheado; ≤ 4 % de opacidade  */
/* ------------------------------------------------------------------ */

/** Pinta o grão sobre o palco inteiro. Quem chama `desenharFundo` com `comGrao = false` pinta o grão por cima de tudo com esta função. */
export function desenharGrao(ctx: CanvasRenderingContext2D, w: number, h: number, opacidade: number = GRAO_ALFA): void {
  if (!cache.grao) {
    const c = new OffscreenCanvas(128, 128);
    const g = c.getContext("2d");
    if (!g) return;
    const img = g.createImageData(128, 128);
    const d = img.data;
    const r = rnd(SEED + 3);
    for (let i = 0; i < d.length; i += 4) {
      const v = (40 + r() * 215) | 0;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const pat = ctx.createPattern(c, "repeat");
    if (!pat) return;
    cache.grao = pat;
  }
  ctx.save();
  ctx.globalAlpha = Math.min(0.04, opacidade);
  ctx.fillStyle = cache.grao;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Ponto de entrada                                                     */
/* ------------------------------------------------------------------ */

/**
 * Desenha o fundo do nível em coordenadas de tela (px CSS, transformação identidade ou só o DPR).
 * `comGrao = false` deixa o grão para quem chama (pintado por cima de tudo com `desenharGrao`).
 */
export function desenharFundo(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cam: Camera, nivel: NivelId, comGrao = true): void {
  if (w <= 0 || h <= 0) return; // palco ainda sem tamanho: nada a desenhar (e nada a pôr em cache)
  // Nível 0 (Arquipélago, v0.6): céu e horizonte no lugar do espaço; o mar vem com o terreno.
  if (nivel === "ilha") {
    desenharCeu(ctx, w, h, t, cam);
    if (comGrao) desenharGrao(ctx, w, h, GRAO_ALFA);
    return;
  }
  const cfg = CONFIG[nivel];
  const reduzido = movimentoReduzido();
  garantirCache(w, h);
  ctx.save();
  ctx.setLineDash(SEM_TRACO);
  // 1 + 2. gradiente (cacheado, opaco) + nebulosa (offscreen em DPR 1, paralaxe 0,05, 'lighter'). A paralaxe é
  //        quantizada a 8 px: o par fica pré-composto num canvas `base` (1:1 com o palco em px físicos) e só é
  //        refeito a cada 160 px de pan; por quadro, um blit sem escala.
  const neb = nebulosas(nivel, w, h);
  const nx = neb ? Math.round(Math.max(-neb.mx * 2, Math.min(0, -neb.mx + cam.tx * PARALAXE.neb)) / 8) * 8 : 0;
  const ny = neb ? Math.round(Math.max(-neb.my * 2, Math.min(0, -neb.my + cam.ty * PARALAXE.neb)) / 8) * 8 : 0;
  const dpr = Math.max(1, ctx.canvas.width / w);
  let base = cache.base.get(nivel); // um `base` por nível; no máximo 2 residentes (a transição alterna os dois níveis)
  if (!base) {
    base = { canvas: new OffscreenCanvas(1, 1), nx: NaN, ny: NaN };
    cache.base.set(nivel, base);
    cache.baseOrdem.push(nivel);
    while (cache.baseOrdem.length > 2) {
      const velho = cache.baseOrdem.shift();
      if (velho === undefined) break;
      const b = cache.base.get(velho);
      if (b) encolher(b.canvas);
      cache.base.delete(velho);
    }
  }
  const W = Math.ceil(w * dpr);
  const H = Math.ceil(h * dpr);
  const bc = base.canvas;
  if (bc.width !== W || bc.height !== H) {
    bc.width = W;
    bc.height = H;
    base.nx = NaN;
  }
  if (base.nx !== nx || base.ny !== ny) {
    const g = bc.getContext("2d");
    if (g) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = gradiente(g, w, h, nivel);
      g.fillRect(0, 0, w, h);
      if (neb) {
        g.globalCompositeOperation = "lighter";
        g.drawImage(neb.canvas, nx, ny, neb.w, neb.h);
        g.globalCompositeOperation = "source-over";
      }
      base.nx = nx;
      base.ny = ny;
    }
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bc, 0, 0);
  ctx.restore();
  if (nivel === "sistema") desenharNebOuro(ctx, cam);
  // 3. estrelas (paralaxe 0,10, wrap). O Sol e o planeta ficaram no céu do arquipélago (v0.6).
  desenharEstrelas(ctx, w, h, t, cam, cfg.estrelas, reduzido);
  // 6. grão
  if (comGrao) desenharGrao(ctx, w, h, GRAO_ALFA);
  ctx.restore();
}
