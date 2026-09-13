/**
 * Base compartilhada do tabuleiro: paleta derivada dos tokens (GDD §10), projeção isométrica 2:1,
 * gerador determinístico e utilidades de desenho em Canvas 2D. Sem DOM além do `matchMedia`.
 */

export const PALETA = {
  // tokens do GDD §10
  navy: "#0d1230",
  navy2: "#241b55",
  ink: "#f4f6ff",
  muted: "#9aa3c7",
  card: "#161b3d",
  cardBorda: "rgba(255,255,255,.08)",
  sun: "#ffd23f",
  sky: "#4cc9f0",
  leaf: "#6be585",
  coral: "#ff6b6b",
  plasma: "#ff4fd8",
  ion: "#7cf5ff",
  void: "#8a5cff",
  gold: "#ffb703",
  laranja: "#ff7a1a",
  // terreno da ilha (GDD §10, v0.5)
  grama: "#72e076",
  grama2: "#55d162",
  gramaEsc: "#35ad60",
  gramaLabio: "#4fc56f",
  gramaVento: "#8bdf7a",
  gramaSol: "#9ede8b",
  gramaFloresta: "#5ec975",
  rocha: "#5b4cb5",
  rocha2: "#3e3488",
  rocha3: "#2c245f",
  cristal: "#8a5cff",
  cristal2: "#c8b6ff",
  agua: "#4cc9f0",
  agua2: "#7cf5ff",
  aguaFunda: "#2b8fd6",
  caminho: "#d6c48e",
  caminhoBorda: "#a28f6a",
  areia: "#e8d9a3",
  // Núcleo
  casa: "#222a66",
  casaAnel1: "#2b3478",
  torre: "#2b3270",
  torre2: "#3a4190",
  turbinaCarcaca: "#e9edff",
  tanque: "#c9cfff",
  tanque2: "#b9bfe8",
  entulho: "#4a5080",
  solMiolo: "#fff3b0",
  sombra: "rgba(9,12,34,.45)",
  sombraForte: "rgba(7,10,30,.55)",
  sombraIlha: "rgba(5,7,24,.6)",
} as const;

export type CorPaleta = keyof typeof PALETA;

/* ------------------------------------------------------------------ */
/* Paleta por era (GDD Parte 2 §8)                                     */
/* ------------------------------------------------------------------ */

let eraVisual: 1 | 2 = 1;

/**
 * Paleta da era em curso. A Era 2 é o **entardecer**: os mesmos tokens com o céu e o mar um passo mais
 * escuros e o Sol baixo na água. Quem desenha o mar e o céu pergunta por aqui.
 */
export function definirEraVisual(era: 1 | 2): void {
  eraVisual = era;
}

export const eraDaCena = (): 1 | 2 => eraVisual;
export const entardecer = (): boolean => eraVisual >= 2;

/** Rampa de calor (corpo negro), a mesma de `content/era1-nucleo.ts`. */
export const RAMPA: readonly (readonly [number, string])[] = [
  [0, "#3A6FF2"],
  [0.5, "#FFD23F"],
  [0.85, "#FF7A1A"],
  [1, "#FFFFFF"],
];

export function hexParaRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function canal(v: number): string {
  return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
}

export function rgbParaHex(r: number, g: number, b: number): string {
  return `#${canal(r)}${canal(g)}${canal(b)}`;
}

export function misturar(a: string, b: string, f: number): string {
  const A = hexParaRgb(a);
  const B = hexParaRgb(b);
  return rgbParaHex(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f);
}

export const escurecer = (h: string, f: number): string => misturar(h, "#000000", f);
export const clarear = (h: string, f: number): string => misturar(h, "#ffffff", f);

export function alfa(h: string, a: number): string {
  const [r, g, b] = hexParaRgb(h);
  return `rgba(${r},${g},${b},${a})`;
}

export function corRampa(t: number): string {
  const v = Math.max(0, Math.min(1, t));
  for (let i = 1; i < RAMPA.length; i++) {
    if (v <= RAMPA[i][0]) {
      const [t0, c0] = RAMPA[i - 1];
      const [t1, c1] = RAMPA[i];
      return misturar(c0, c1, (v - t0) / (t1 - t0));
    }
  }
  return RAMPA[RAMPA.length - 1][1];
}

/** Projeção isométrica 2:1: casa de 64×32 px de mundo no zoom 1. */
export const ISO = { W: 64, H: 32 } as const;

export const iso = (x: number, y: number): [number, number] => [(x - y) * (ISO.W / 2), (x + y) * (ISO.H / 2)];
export const centro = (x: number, y: number): [number, number] => iso(x + 0.5, y + 0.5);
export const desiso = (sx: number, sy: number): [number, number] => [
  (sx / (ISO.W / 2) + sy / (ISO.H / 2)) / 2,
  (sy / (ISO.H / 2) - sx / (ISO.W / 2)) / 2,
];

/** Caminho do losango da casa (x, y), com recuo opcional em fração da casa. */
export function losango(ctx: CanvasRenderingContext2D | Path2D, x: number, y: number, ins = 0): void {
  const a = iso(x + ins, y + ins);
  const b = iso(x + 1 - ins, y + ins);
  const c = iso(x + 1 - ins, y + 1 - ins);
  const d = iso(x + ins, y + 1 - ins);
  if (ctx instanceof Path2D) {
    ctx.moveTo(a[0], a[1]);
  } else {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
  }
  ctx.lineTo(b[0], b[1]);
  ctx.lineTo(c[0], c[1]);
  ctx.lineTo(d[0], d[1]);
  ctx.closePath();
}

export { rnd, ruido } from "../../sim/aleatorio";

export function elipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.closePath();
}

export function retArred(ctx: CanvasRenderingContext2D | Path2D, x: number, y: number, w: number, h: number, raio: number): void {
  const r = Math.min(raio, w / 2, h / 2);
  if (!(ctx instanceof Path2D)) ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const frac = (v: number): number => v - Math.floor(v);

/** `prefers-reduced-motion`: desliga cintilação, giro, pulso e tremor. */
export function movimentoReduzido(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Câmera do tabuleiro: zoom e translação em px CSS; `w`/`h` são o tamanho do palco. */
export interface Camera {
  zoom: number;
  tx: number;
  ty: number;
  w: number;
  h: number;
}

export type Lod = "perto" | "longe";

/** Abaixo deste zoom os objetos viram silhuetas simples. */
export const ZOOM_LONGE = 0.45;
export const lodDe = (zoom: number): Lod => (zoom < ZOOM_LONGE ? "longe" : "perto");
