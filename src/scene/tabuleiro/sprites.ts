/**
 * Catálogo de sprites do tabuleiro (ilha): porte de `30-sprites.js` da amostra "ilha-tabuleiro".
 * Cada sprite desenha relativo ao seu ponto do chão — câmera, translação e escala já aplicadas no ctx —
 * e cresce para cima (y negativo). Sem `Math.random`/`Date.now`: a animação vem do `t` recebido (s) e a
 * variação vem do estado. Só Canvas 2D: nada de DOM, React, Phaser ou store.
 */

import {
  PALETA,
  alfa,
  clamp01,
  clarear,
  corRampa,
  elipse,
  escurecer,
  frac,
  misturar,
  retArred,
  type Lod,
} from "./base";

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
const A = alfa;
const E = escurecer;
const M = misturar;
const C = clarear;

// ---------------------------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------------------------

export type NomeSprite =
  | "casaNucleo"
  | "heliostato"
  | "turbinaVapor"
  | "radiador"
  | "tanque"
  | "receptor"
  | "entulho"
  | "cataVento"
  | "turbinaEolica"
  | "painelSolar"
  | "casaVila"
  | "bateria"
  | "arvore"
  | "pinheiro"
  | "arbusto"
  | "pedra"
  | "pantano"
  | "montanha"
  | "pico"
  | "subestacao"
  | "cristal"
  | "placaBloqueio"
  | "bipe"
  | "brasa"
  | "particula";

export const NOMES_SPRITES: readonly NomeSprite[] = [
  "casaNucleo",
  "heliostato",
  "turbinaVapor",
  "radiador",
  "tanque",
  "receptor",
  "entulho",
  "cataVento",
  "turbinaEolica",
  "painelSolar",
  "casaVila",
  "bateria",
  "arvore",
  "pinheiro",
  "arbusto",
  "pedra",
  "pantano",
  "montanha",
  "pico",
  "subestacao",
  "cristal",
  "placaBloqueio",
  "bipe",
  "brasa",
  "particula",
];

export type Teto = "coral" | "sun" | "sky";
export type PapelBipe = "operador" | "manutencao" | "cientista";
export type ExpressaoBipe = "neutro" | "alarmado" | "apontando" | "cansado";
export type Realce = "valido" | "invalido";

/** Estado de desenho de um sprite. Só `lod` é obrigatório; cada sprite lê os campos que lhe cabem. */
export interface EstadoSprite {
  lod: Lod;
  /** casaNucleo, heliostato: anel da plataforma (1 = mais claro; espelhos 2/3 mais escuros). */
  anel?: 1 | 2 | 3;
  /** casaNucleo: realce de posicionamento (`leaf` / `coral`, α pulsando em 2 s). */
  realce?: Realce | null;
  /** casaNucleo: arestas externas da plataforma [NE, SE, SW, NW] (fio `sky` 2 px). */
  bordas?: readonly [boolean, boolean, boolean, boolean];
  /** heliostato: ponto do chão (mundo) para onde o espelho gira. */
  alvo?: readonly [number, number];
  /** heliostato: varredura de brilho de 0,6 s a cada 6 s. */
  rastreamento?: boolean;
  /** heliostato: defasagem da varredura (s); cataVento/turbinaEolica: voltas iniciais; bipe: 0..1 (balanço, piscar). */
  fase?: number;
  /** turbinaVapor: 0..1, velocidade do volante (padrão 1). */
  consumo?: number;
  /** turbinaVapor, receptor: SCRAM (cinza-azulado, parado, sem glow). */
  scram?: boolean;
  /** radiador: 0..1, clareia as aletas. */
  atividade?: number;
  /** tanque: 0..1, nível na rampa de calor. subestacao: nível da construção (isoladores). */
  nivel?: number;
  /** receptor: temperatura 0..1,2 na rampa de calor (pulso acima de 0,9). */
  T?: number;
  /** entulho: contorno `leaf` (remoção grátis). */
  gratis?: boolean;
  /** entulho: instante de nascimento (s) → pop de 250 ms ease-out-back. */
  t0?: number;
  /** cataVento (1,2 voltas/s × vel), turbinaEolica (0,4 voltas/s × vel). Padrão 1. */
  vel?: number;
  /** casaVila: cor do telhado (padrão `coral`). */
  teto?: Teto;
  /** casaVila 0 porta / 1 janelas / 2 chaminé; arvore 0..2 (deslocamento da copa); pedra 0..2 (silhueta). */
  variante?: number;
  /** arvore, pinheiro, cristal: escala local (padrão 1). */
  escala?: number;
  /** bateria: 0..1, barras acesas = ceil(carga·3) (padrão 1). */
  carga?: number;
  /** placaBloqueio: preço formatado (o texto vive nos callouts da cena; não é desenhado aqui). */
  preco?: string;
  /** placaBloqueio: nome da região (idem). */
  nome?: string;
  /** bipe: papel → cor do corpo (padrão `operador`). */
  papel?: PapelBipe;
  /** bipe: expressão só por olho, antena e braço (padrão `neutro`). */
  expressao?: ExpressaoBipe;
  /** brasa, particula: 1 → 0 ao longo da vida. */
  vida?: number;
  /** particula: cor (padrão `sun`). */
  cor?: string;
  /** Desenha o sprite inteiro em α 0,35 (prévia do que vai numa ilha fechada). */
  fantasma?: boolean;
  /** Obstáculo em remoção: 0..1 (barra de tempo por cima). */
  progresso?: number;
  /** Usina sem escoamento: marca de alerta. */
  semEscoamento?: boolean;
  /** cristal (piscar), brasa (raio), particula (deriva): variação determinística. */
  seed?: number;
  /** Zoom da câmera: em `longe` receptor, cataVento, turbinaEolica e placaBloqueio medem em px de tela. */
  zoom?: number;
  /** Reservado (a amostra não usa; o pop do entulho vem de `t0`). */
  pop?: number;
}

/** Feixe do espelho (`de`, ponto do chão) ao centro da esfera (`para`, ponto do chão), em coordenadas de mundo. */
export interface Feixe {
  de: readonly [number, number];
  para: readonly [number, number];
  /** 0..1; abaixo de 0,25 não desenha. */
  forca: number;
  /** Fase do ponto que corre pelo feixe (0..1). */
  fase: number;
  lod: Lod;
  /** Zoom da câmera (espessura em px de tela em `longe`; modo mapa abaixo de 0,22). */
  zoom: number;
}

/** Alturas (px de mundo) acima do ponto do chão usadas pelo feixe. */
export const ALTURAS = { espelho: 18, esfera: 126 } as const;

// ---------------------------------------------------------------------------------------------
// Paleta local (direção §2): ajustes e cores novas entram aqui, nunca em base.ts.
// ---------------------------------------------------------------------------------------------

const P = {
  ...PALETA,
  torre: "#3b44a6",
  torre2: "#4f5ac8",
  pa: "#f7f9ff",
  radiadorAleta: "#aeb6e6",
  painel: "#2d4bd9",
  painelBrilho: "#8fe3ff",
  vilaParede: "#f3e7c9",
  vilaParede2: "#cdbf9e",
  bateriaCaixa: "#e4e8ff",
  scram: "#7c86b0",
  copa: "#3fb36a",
  copa2: "#2f9c60",
  junco: "#5ec975",
  lodo: "#3c7a6a",
  lodo2: "#2d5f55",
  neve: "#eef3ff",
  poste: "#c9cfff",
} as const;

const TETOS: Record<Teto, string> = { coral: P.coral, sun: P.sun, sky: P.sky };
const porTeto = (f: (cor: string) => string): Record<Teto, string> => ({
  coral: f(TETOS.coral),
  sun: f(TETOS.sun),
  sky: f(TETOS.sky),
});

// Aletas do radiador por atividade (11 degraus) e mescla entulho → rampa(0,7) da brasa (6 degraus).
const aletas: string[] = [];
const aletasEsc: string[] = [];
for (let i = 0; i <= 10; i++) {
  aletas[i] = M(P.radiadorAleta, P.ink, i / 10);
  aletasEsc[i] = E(aletas[i], 0.25);
}
const brasaFim: string[] = [];
for (let i = 0; i <= 5; i++) brasaFim[i] = M(P.entulho, corRampa(0.7), i / 5);

/** Cores derivadas, calculadas uma única vez (nada de misturar() no caminho quente). */
const D = {
  sky2: M(P.sky, P.navy2, 0.25),
  sky3: M(P.sky, P.navy2, 0.45),
  skyBrilho: A(P.ink, 0.6),
  skyVarredura: A(P.ink, 0.5),
  skyReflexo: A(P.ink, 0.55),
  entulhoBorda: E(P.entulho, 0.3),
  painelBorda: E(P.painel, 0.35),
  painelGrade: A(P.sky, 0.35),
  painelBrilho: A(P.painelBrilho, 0.7),
  vilaBorda: E(P.vilaParede2, 0.35),
  tetos: TETOS,
  tetoSW: porTeto((c) => E(c, 0.18)),
  tetoSE: porTeto((c) => E(c, 0.3)),
  tetoCume: porTeto((c) => C(c, 0.3)),
  bateriaSW: P.tanque,
  bateriaSE: P.tanque2,
  bateriaBorda: E(P.tanque2, 0.3),
  leafApagado: A(P.leaf, 0.25),
  rochaTopo: C(P.rocha, 0.2),
  voidHalo1: A(P.void, 0.1),
  voidHalo2: A(P.void, 0.18),
  tanqueBorda: E(P.tanque2, 0.3),
  tanqueTampa: C(P.tanque, 0.25),
  carcacaTampa: C(P.turbinaCarcaca, 0.35),
  carcacaBorda: E(P.tanque2, 0.25),
  vaporClaro: A(P.ink, 0.55),
  fusteDir: P.torre,
  fusteEsq: P.torre2,
  fustePonto: A(P.ink, 0.12),
  coroaTopo: C(P.torre2, 0.2),
  scramEscuro: E(P.scram, 0.3),
  scramAnel: A(P.ink, 0.5),
  malha: A(P.ink, 0.06),
  arestaPlat: A(P.sky, 0.35),
  realceValido: A(P.leaf, 0.35),
  realceInvalido: A(P.coral, 0.35),
  laranjaHalo: A(P.laranja, 0.15),
  aletas,
  aletasEsc,
  baseSW: E(P.casaAnel1, 0.18),
  baseSE: E(P.casaAnel1, 0.34),
  scramMiolo: C(P.scram, 0.25),
  brasaFim,
  bipe: {
    operador: { cor: P.sky, borda: "#2b8fd6" },
    manutencao: { cor: P.leaf, borda: "#35ad60" },
    cientista: { cor: P.sun, borda: P.gold },
  } satisfies Record<PapelBipe, { cor: string; borda: string }>,
  bipeSombra: "rgba(7,10,30,.5)",
  turbinaMastroBorda: E(P.turbinaCarcaca, 0.25),
  feixePonto: P.ink,
  feixeMapa: A(P.sun, 0.3),
};

// ---------------------------------------------------------------------------------------------
// Rampa de calor com cache por centésimo (0..1,2) — evita misturar() por frame.
// ---------------------------------------------------------------------------------------------

const iRampa = (T: number): number => Math.max(0, Math.min(120, Math.round((T || 0) * 100)));

function cacheRampa(derivar: (cor: string) => string): (T: number) => string {
  const cache: (string | undefined)[] = [];
  return (T) => {
    const i = iRampa(T);
    return cache[i] ?? (cache[i] = derivar(corRampa(i / 100)));
  };
}

const rampa = cacheRampa((c) => c);
const rampaMiolo = cacheRampa((c) => M(c, P.solMiolo, 0.6));
const rampaClaro = cacheRampa((c) => C(c, 0.3));
// halos da esfera em 'lighter' com alfa baixo (r 23 α .20, r 32 α .09): somam luz sem embarrar o verde em oliva
// (em source-over o halo virava um anel cor de tabaco sobre a grama); em 'longe' os valores antigos.
const halo1 = cacheRampa((c) => A(c, 0.2));
const halo2 = cacheRampa((c) => A(c, 0.09));
const haloLonge1 = cacheRampa((c) => A(c, 0.35));
const haloLonge2 = cacheRampa((c) => A(c, 0.14));
const HALO3 = A(P.solMiolo, 0.06);

const easeOutBack = (k: number): number => {
  const c = 1.70158;
  const u = k - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};

// ---------------------------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------------------------

type Ctx = CanvasRenderingContext2D;
type Ponto = readonly [number, number];

/** Barra de tempo chapada (largura `w`, 0..1) centrada em (x, y): remoção de obstáculo em curso. */
function barraProgresso(ctx: Ctx, x: number, y: number, w: number, k: number): void {
  const h = 5;
  retArred(ctx, x - w / 2, y, w, h, h / 2);
  ctx.fillStyle = A(P.navy, 0.75);
  ctx.fill();
  ctx.strokeStyle = A(P.ink, 0.35);
  ctx.lineWidth = 1;
  ctx.stroke();
  const largura = Math.max(0, Math.min(1, k)) * (w - 4);
  if (largura > 0) {
    retArred(ctx, x - w / 2 + 2, y + 1, largura, h - 2, (h - 2) / 2);
    ctx.fillStyle = P.leaf;
    ctx.fill();
  }
}

/** Sombra chapada elíptica deslocada (+desloc, +desloc). Só chamar em `perto`. */
export function sombra(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, desloc = 4): void {
  ctx.fillStyle = P.sombra;
  elipse(ctx, cx + desloc, cy + desloc, rx, ry);
  ctx.fill();
}

function circulo(ctx: Ctx, x: number, y: number, r: number, cor: string): void {
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function elipseCheia(ctx: Ctx, x: number, y: number, rx: number, ry: number, cor: string): void {
  ctx.fillStyle = cor;
  elipse(ctx, x, y, rx, ry);
  ctx.fill();
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, cor: string): void {
  ctx.fillStyle = cor;
  ctx.fillRect(x, y, w, h);
}

/** Polígono de cantos arredondados (arcTo entre pontos médios). `alvo` = ctx ou Path2D. */
function poligonoArred(alvo: Ctx | Path2D, pts: readonly Ponto[], r: number): void {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % n];
    const p2 = pts[(i + 2) % n];
    if (i === 0) alvo.moveTo((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
    alvo.arcTo(p1[0], p1[1], (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, r);
  }
  alvo.closePath();
}

function pathArred(pts: readonly Ponto[], r: number): Path2D {
  const p = new Path2D();
  poligonoArred(p, pts, r);
  return p;
}

function pathRet(x: number, y: number, w: number, h: number, r: number): Path2D {
  const p = new Path2D();
  retArred(p, x, y, w, h, r);
  return p;
}

/**
 * Losango (topo de uma casa) centrado em x = 0 com meia-largura `a` e meia-profundidade `b` em fração de casa, base em y0.
 * ex = (32, 16), ey = (−32, 16): N = −a·ex − b·ey, E = a·ex − b·ey, S = a·ex + b·ey, W = −a·ex + b·ey.
 */
function losangoCentrado(ctx: Ctx, a: number, b: number, y0: number): void {
  ctx.beginPath();
  ctx.moveTo(32 * (b - a), y0 - 16 * (a + b));
  ctx.lineTo(32 * (a + b), y0 + 16 * (a - b));
  ctx.lineTo(32 * (a - b), y0 + 16 * (a + b));
  ctx.lineTo(-32 * (a + b), y0 + 16 * (b - a));
  ctx.closePath();
}

/** Caixa isométrica extrudada `h` px para cima a partir de y0. Luz de cima-esquerda: SW mais claro que SE. */
function caixa(ctx: Ctx, a: number, b: number, h: number, topo: string, sw: string, se: string, y0 = 0): void {
  const Nx = 32 * (b - a);
  const Ny = y0 - 16 * (a + b);
  const Ex = 32 * (a + b);
  const Ey = y0 + 16 * (a - b);
  const Sx = 32 * (a - b);
  const Sy = y0 + 16 * (a + b);
  const Wx = -32 * (a + b);
  const Wy = y0 + 16 * (b - a);
  ctx.fillStyle = sw;
  ctx.beginPath();
  ctx.moveTo(Wx, Wy);
  ctx.lineTo(Sx, Sy);
  ctx.lineTo(Sx, Sy - h);
  ctx.lineTo(Wx, Wy - h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = se;
  ctx.beginPath();
  ctx.moveTo(Sx, Sy);
  ctx.lineTo(Ex, Ey);
  ctx.lineTo(Ex, Ey - h);
  ctx.lineTo(Sx, Sy - h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = topo;
  ctx.beginPath();
  ctx.moveTo(Nx, Ny - h);
  ctx.lineTo(Ex, Ey - h);
  ctx.lineTo(Sx, Sy - h);
  ctx.lineTo(Wx, Wy - h);
  ctx.closePath();
  ctx.fill();
}

/** Contorno do perímetro externo de uma caixa (1 px na matiz escura), só em `perto`. */
function contornoCaixa(ctx: Ctx, a: number, b: number, h: number, cor: string, y0 = 0): void {
  const Nx = 32 * (b - a);
  const Ny = y0 - 16 * (a + b);
  const Ex = 32 * (a + b);
  const Ey = y0 + 16 * (a - b);
  const Sx = 32 * (a - b);
  const Sy = y0 + 16 * (a + b);
  const Wx = -32 * (a + b);
  const Wy = y0 + 16 * (b - a);
  ctx.strokeStyle = cor;
  ctx.lineWidth = 1;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(Wx, Wy - h);
  ctx.lineTo(Nx, Ny - h);
  ctx.lineTo(Ex, Ey - h);
  ctx.lineTo(Ex, Ey);
  ctx.lineTo(Sx, Sy);
  ctx.lineTo(Wx, Wy);
  ctx.closePath();
  ctx.stroke();
}

/** Paralelogramo sobre a face SW (u ao longo de W→S em 0..1, v = altura em px) — janelas, portas, barras. */
function retFaceSW(ctx: Ctx, a: number, b: number, u0: number, u1: number, v0: number, v1: number, cor: string): void {
  const Wx = -32 * (a + b);
  const Wy = 16 * (b - a);
  const Sx = 32 * (a - b);
  const Sy = 16 * (a + b);
  const dx = Sx - Wx;
  const dy = Sy - Wy;
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.moveTo(Wx + dx * u0, Wy + dy * u0 - v0);
  ctx.lineTo(Wx + dx * u1, Wy + dy * u1 - v0);
  ctx.lineTo(Wx + dx * u1, Wy + dy * u1 - v1);
  ctx.lineTo(Wx + dx * u0, Wy + dy * u0 - v1);
  ctx.closePath();
  ctx.fill();
}

/** Paralelogramo sobre a face SE (u ao longo de S→E em 0..1). */
function retFaceSE(ctx: Ctx, a: number, b: number, u0: number, u1: number, v0: number, v1: number, cor: string): void {
  const Sx = 32 * (a - b);
  const Sy = 16 * (a + b);
  const Ex = 32 * (a + b);
  const Ey = 16 * (a - b);
  const dx = Ex - Sx;
  const dy = Ey - Sy;
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.moveTo(Sx + dx * u0, Sy + dy * u0 - v0);
  ctx.lineTo(Sx + dx * u1, Sy + dy * u1 - v0);
  ctx.lineTo(Sx + dx * u1, Sy + dy * u1 - v1);
  ctx.lineTo(Sx + dx * u0, Sy + dy * u0 - v1);
  ctx.closePath();
  ctx.fill();
}

/** Cilindro vertical de largura w (x centrado em 0) de y0 até y0−h, tampa elíptica ry. */
function cilindro(ctx: Ctx, w: number, h: number, ry: number, esq: string, dir: string, tampa: string, y0 = 0): void {
  const r = w / 2;
  ctx.fillStyle = esq;
  ctx.beginPath();
  ctx.moveTo(-r, y0 - h);
  ctx.lineTo(0, y0 - h);
  ctx.lineTo(0, y0);
  ctx.ellipse(0, y0, r, ry, 0, Math.PI / 2, Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = dir;
  ctx.beginPath();
  ctx.moveTo(0, y0 - h);
  ctx.lineTo(r, y0 - h);
  ctx.lineTo(r, y0);
  ctx.ellipse(0, y0, r, ry, 0, 0, Math.PI / 2);
  ctx.closePath();
  ctx.fill();
  elipseCheia(ctx, 0, y0 - h, r, ry, tampa);
}

// ---------------------------------------------------------------------------------------------
// Caminhos estáticos (Path2D) — construídos uma vez, desenhados com transformações do ctx.
// `Path2D` só existe no navegador: a construção fica para a primeira chamada, não para o import
// (o sim roda testes em Node e pode importar `ALTURAS`/`NOMES_SPRITES` daqui).
// ---------------------------------------------------------------------------------------------

interface CaminhosPedra {
  sil: Path2D;
  topo: Path2D;
  dir: Path2D;
}

interface Caminhos {
  /** pá do cata-vento (a partir do cubo, eixo +x) */
  paCata: Path2D;
  paEolica: Path2D;
  entulho1: Path2D;
  entulho2: Path2D;
  pedras: readonly [CaminhosPedra, CaminhosPedra, CaminhosPedra];
  pinheiro: readonly [Path2D, Path2D, Path2D];
  pinheiroLonge: Path2D;
  cristal1: Path2D;
  cristal2: Path2D;
  fustePontos: Path2D;
  bracoBipe: Path2D;
  bracoApontando: Path2D;
  espelho: Path2D;
  paCataLongeGrande: Path2D;
  paEolicaLonge: Path2D;
  /** pá fina do volante (retArred 7×2,5 a partir do cubo) */
  paVapor: Path2D;
}

function construirCaminhos(): Caminhos {
  const paEolica = new Path2D();
  paEolica.moveTo(3, -3.2);
  paEolica.lineTo(28, -2.6);
  paEolica.quadraticCurveTo(38, -1.5, 38, 0);
  paEolica.quadraticCurveTo(38, 1.5, 28, 2.6);
  paEolica.lineTo(3, 3.2);
  paEolica.closePath();
  const fustePontos = new Path2D();
  for (let y = -100; y <= -12; y += 8) {
    fustePontos.moveTo(4, y);
    fustePontos.arc(4, y, 1, 0, TAU);
  }
  return {
    paCata: pathRet(2, -2.5, 14, 5, 2.5),
    paEolica,
    entulho1: pathArred([[-7, -1], [-3, -4], [4, -4], [7, 0], [4, 4], [-5, 3]], 2.5),
    entulho2: pathArred([[-5, 0], [-2, -3], [3, -3], [5, 0], [2, 3], [-3, 3]], 2),
    pedras: [
      {
        sil: pathArred([[-10, 1], [-7, -5], [0, -8], [7, -6], [10, 0], [6, 4], [-4, 4]], 2),
        topo: pathArred([[-7, -5], [0, -8], [7, -6], [3, -3], [-4, -2]], 1.5),
        dir: pathArred([[7, -6], [10, 0], [6, 4], [3, -3]], 1.5),
      },
      {
        sil: pathArred([[-8, 2], [-6, -6], [1, -10], [6, -7], [8, 0], [5, 4], [-3, 4]], 2),
        topo: pathArred([[-6, -6], [1, -10], [6, -7], [2, -4], [-3, -3]], 1.5),
        dir: pathArred([[6, -7], [8, 0], [5, 4], [2, -4]], 1.5),
      },
      {
        sil: pathArred([[-12, 1], [-8, -5], [0, -7], [8, -6], [12, -1], [8, 3], [-4, 3]], 2),
        topo: pathArred([[-8, -5], [0, -7], [8, -6], [4, -2], [-4, -1]], 1.5),
        dir: pathArred([[8, -6], [12, -1], [8, 3], [4, -2]], 1.5),
      },
    ],
    pinheiro: [
      pathArred([[-13, -6], [13, -6], [0, -22]], 3),
      pathArred([[-10, -16], [10, -16], [0, -32]], 3),
      pathArred([[-7, -26], [7, -26], [0, -42]], 2.5),
    ],
    pinheiroLonge: pathArred([[-13, 0], [13, 0], [0, -40]], 3),
    cristal1: pathArred([[-5, 0], [5, 0], [1, -22]], 1.5),
    cristal2: pathArred([[3, 0], [11, 0], [8, -14]], 1.5),
    fustePontos,
    bracoBipe: pathRet(-2.5, -5.5, 5, 11, 2.5),
    bracoApontando: pathRet(0, -2.5, 13, 5, 2.5),
    espelho: pathRet(-8, -15, 16, 30, 3),
    paCataLongeGrande: pathRet(1, -3, 16, 6, 3),
    paEolicaLonge: pathRet(2, -2.5, 22, 5, 2.5),
    paVapor: pathRet(2, -1.25, 7, 2.5, 1.25),
  };
}

let caminhosCache: Caminhos | undefined;
const caminhos = (): Caminhos => (caminhosCache ??= construirCaminhos());

// Gradientes do feixe por força (11 degraus), em espaço normalizado 0..1 (o ctx é escalado pelo comprimento).
// perto: 'lighter' .22 → .50 (soma luz à grama em vez de embarrar em tabaco) + núcleo 1 px A(ink,.45);
// longe: source-over .35 → .55 (o feixe é "o movimento da ilha em longe", precisa aparecer)
const GRAD_FEIXE: (CanvasGradient | undefined)[] = [];
const GRAD_FEIXE_LONGE: (CanvasGradient | undefined)[] = [];
function gradFeixe(ctx: Ctx, forca: number, longe: boolean): CanvasGradient {
  const i = Math.round(clamp01(forca) * 10);
  const arr = longe ? GRAD_FEIXE_LONGE : GRAD_FEIXE;
  let g = arr[i];
  if (!g) {
    g = ctx.createLinearGradient(0, 0, 1, 0);
    if (longe) {
      g.addColorStop(0, A(P.sun, 0.35));
      g.addColorStop(1, A(P.sun, 0.4 + (0.15 * i) / 10));
    } else {
      g.addColorStop(0, A(P.sun, 0.22));
      g.addColorStop(1, A(P.sun, 0.35 + (0.15 * i) / 10));
    }
    arr[i] = g;
  }
  return g;
}
const FEIXE_NUCLEO = A(P.ink, 0.45);

// ---------------------------------------------------------------------------------------------
// Sprites — cada função desenha relativa ao ponto do chão (0, 0), já com escala aplicada.
// (cx, cy) são o ponto do chão em mundo, para quem precisa de direção absoluta (heliostato).
// ---------------------------------------------------------------------------------------------

type FnSprite = (ctx: Ctx, e: EstadoSprite, t: number, longe: boolean, cx: number, cy: number) => void;

/** Braço do Bipe: cápsula girada com sombra chapada +1,5. */
function bracoBipe(ctx: Ctx, x: number, y: number, ang: number, path: Path2D, cor: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = D.bipeSombra;
  ctx.translate(1.5, 1.5);
  ctx.fill(path);
  ctx.translate(-1.5, -1.5);
  ctx.fillStyle = cor;
  ctx.fill(path);
  ctx.restore();
}

const S: Record<NomeSprite, FnSprite> = {
  // Losango da plataforma do Núcleo; anel 1 um tom mais claro; malha fina; realce de posicionamento.
  casaNucleo(ctx, e, t, longe) {
    ctx.fillStyle = e.anel === 1 ? P.casaAnel1 : P.casa;
    losangoCentrado(ctx, 0.5, 0.5, 0);
    ctx.fill();
    ctx.strokeStyle = D.malha;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (longe) return;
    if (e.bordas) {
      ctx.strokeStyle = D.arestaPlat;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      const px = [0, 32, 0, -32]; // N, E, S, W
      const py = [-16, 0, 16, 0];
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        if (e.bordas[i]) {
          ctx.moveTo(px[i], py[i]);
          ctx.lineTo(px[(i + 1) % 4], py[(i + 1) % 4]);
        }
      }
      ctx.stroke();
    }
    if (e.realce) {
      const ok = e.realce === "valido";
      ctx.globalAlpha = 0.9 + 0.1 * Math.sin(t * Math.PI);
      ctx.fillStyle = ok ? D.realceValido : D.realceInvalido;
      losangoCentrado(ctx, 0.42, 0.42, 0);
      ctx.fill();
      ctx.strokeStyle = ok ? P.leaf : P.coral;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },

  // Espelho sobre poste, girado para o alvo; anel 2/3 mais escuros; varredura de brilho a cada 6 s com rastreamento.
  heliostato(ctx, e, t, longe, cx, cy) {
    const PATH = caminhos();
    let ang = -Math.PI / 2;
    if (e.alvo) ang = Math.atan2((e.alvo[1] - cy) * 2, e.alvo[0] - cx); // ângulo no plano do chão (y desachatado)
    const cor = e.anel === 3 ? D.sky3 : e.anel === 2 ? D.sky2 : P.sky;
    // o poste fica 4 px para o lado oposto ao alvo (só em x): o espelho "pende" para a torre e a rotação lê como direção
    const px = -Math.cos(ang) * 4;
    // inclinação: a placa fica mais "de frente" quanto mais o alvo está ao lado (scale y = .5 + .15·cos(ang))
    const incl = 0.5 + 0.15 * Math.cos(ang);
    if (!longe) {
      sombra(ctx, 0, 0, 14, 6);
      rect(ctx, px - 2, -15, 4, 15, P.torre2);
      // aro de rotação no topo do poste
      elipseCheia(ctx, px, -15, 4, 2, P.casaAnel1);
      // espessura do espelho: mesma forma 2 px abaixo, na matiz escura
      ctx.save();
      ctx.translate(0, -16);
      ctx.scale(1, incl);
      ctx.rotate(ang);
      ctx.fillStyle = P.aguaFunda;
      ctx.fill(PATH.espelho);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(0, -18);
    ctx.scale(1, incl);
    ctx.rotate(ang);
    ctx.fillStyle = cor;
    ctx.fill(PATH.espelho);
    if (!longe) {
      // faixa diagonal de reflexo fixa (4 px) + varredura de rastreamento
      ctx.save();
      ctx.clip(PATH.espelho);
      ctx.fillStyle = D.skyReflexo;
      ctx.beginPath();
      ctx.moveTo(-8, 4);
      ctx.lineTo(8, -10);
      ctx.lineTo(8, -6);
      ctx.lineTo(-8, 8);
      ctx.closePath();
      ctx.fill();
      if (e.rastreamento) {
        const k = frac((t + (e.fase || 0)) / 6) * 10; // 0..10; varredura nos primeiros 0,6 s (k < 1)
        if (k < 1) {
          ctx.fillStyle = D.skyVarredura;
          ctx.fillRect(-8, -18 + 36 * k, 16, 6);
        }
      }
      ctx.restore();
      ctx.strokeStyle = P.aguaFunda;
      ctx.lineWidth = 1.5;
      ctx.stroke(PATH.espelho);
      // brilho só na aresta virada para a torre (+x local aponta para o alvo)
      ctx.strokeStyle = D.skyBrilho;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(6.5, -12);
      ctx.lineTo(6.5, 12);
      ctx.stroke();
    }
    ctx.restore();
  },

  // Turbina a vapor: cilindro deitado sobre base, volante com pás girando ∝ consumo; parado e cinza em SCRAM.
  turbinaVapor(ctx, e, t, longe) {
    const PATH = caminhos();
    const consumo = e.scram ? 0 : clamp01(e.consumo ?? 1);
    if (!longe) {
      sombra(ctx, 0, 0, 16, 7);
      caixa(ctx, 0.3, 0.3, 3, P.casaAnel1, D.baseSW, D.baseSE);
    }
    cilindro(ctx, 24, 22, 5, P.turbinaCarcaca, P.tanque2, longe ? P.tanque : D.carcacaTampa, -4);
    if (!longe) {
      // aro da carcaça (contorno do cilindro na matiz escura)
      ctx.strokeStyle = D.carcacaBorda;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-12, -26);
      ctx.lineTo(-12, -4);
      ctx.ellipse(0, -4, 12, 5, 0, Math.PI, 0, true);
      ctx.lineTo(12, -26);
      ctx.stroke();
      elipse(ctx, 0, -26, 12, 5);
      ctx.stroke();
    }
    // volante: disco tanque2 com aro casaAnel1, 3 pás finas `pa` girando ∝ consumo e cubo sun — o amarelo fica só no
    // cubo, coerente com o cata-vento (o disco sun com raios gold lia como rodela de laranja e competia com a esfera)
    const corCubo = e.scram ? D.scramEscuro : P.sun;
    rect(ctx, -2, -30, 4, 6, P.torre2); // eixo
    if (!longe) circulo(ctx, 1.5, -32.5, 10, D.carcacaBorda); // sombra chapada do disco
    circulo(ctx, 0, -34, 10, e.scram ? P.scram : P.tanque2);
    if (!longe) {
      ctx.strokeStyle = P.casaAnel1;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, -34, 10, 0, TAU);
      ctx.stroke();
      ctx.save();
      ctx.translate(0, -34);
      ctx.rotate(t * consumo * 6);
      ctx.fillStyle = e.scram ? D.scramMiolo : P.pa;
      for (let k = 0; k < 3; k++) {
        ctx.fill(PATH.paVapor);
        ctx.rotate(TAU / 3);
      }
      ctx.restore();
      circulo(ctx, 0, -34, 3, corCubo);
      // vapor: 3 círculos claros r 4/6/8 subindo em 1,6 s, defasados
      if (!e.scram && consumo > 0.05) {
        for (let i = 0; i < 3; i++) {
          const k = frac(t / 1.6 + i / 3);
          const r = 4 + 2 * i;
          ctx.globalAlpha = 0.9 * (1 - k);
          circulo(ctx, 9 + 4 * Math.sin(k * 5 + i), -46 - 26 * k, r * (0.5 + 0.5 * k), D.vaporClaro);
        }
        ctx.globalAlpha = 1;
      }
    }
  },

  // Tanque: cilindro em pé com nível pintado na rampa de calor.
  tanque(ctx, e, _t, longe) {
    const nivel = clamp01(e.nivel || 0);
    if (!longe) sombra(ctx, 0, 0, 12, 6);
    cilindro(ctx, 20, 32, 4, P.tanque, P.tanque2, D.tanqueTampa, 0);
    if (nivel > 0.02) {
      const cor = rampa(nivel);
      const h = 28 * nivel;
      rect(ctx, -7, -2 - h, 14, h, cor);
      elipseCheia(ctx, 0, -2, 7, 2.8, cor);
      if (!longe) {
        rect(ctx, -6, -2 - h, 2, h, rampaClaro(nivel));
        if (nivel >= 0.99) rect(ctx, -7, -30, 14, 2, P.ink);
      }
    }
    if (!longe) {
      rect(ctx, -11, -11, 22, 2.5, P.casaAnel1);
      rect(ctx, -11, -22, 22, 2.5, P.casaAnel1);
      ctx.strokeStyle = D.tanqueBorda;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-10, -32);
      ctx.lineTo(-10, 0);
      ctx.moveTo(10, -32);
      ctx.lineTo(10, 0);
      ctx.stroke();
    }
  },

  // Radiador: base baixa, duas colunas e aletas que clareiam com a atividade.
  radiador(ctx, e, _t, longe) {
    const ia = Math.round(clamp01(e.atividade || 0) * 10);
    const corAleta = D.aletas[ia];
    if (longe) {
      rect(ctx, -18, -26, 36, 24, corAleta);
      rect(ctx, -18, -28, 36, 3, P.tanque2);
      return;
    }
    sombra(ctx, 0, 0, 22, 7);
    caixa(ctx, 0.4, 0.25, 3, P.casaAnel1, D.baseSW, D.baseSE);
    // radiador de parede: 6 aletas VERTICAIS 3×22 a cada 6 px, colunas escuras entre elas, topo tanque2
    const escAleta = D.aletasEsc[ia];
    rect(ctx, -18, -27, 36, 24, escAleta);
    for (let i = 0; i < 6; i++) {
      const x = -17 + i * 6;
      rect(ctx, x, -26, 3.2, 22, corAleta);
    }
    rect(ctx, -19, -29, 38, 3, P.tanque2);
    rect(ctx, -19, -5, 38, 2, P.torre2);
    rect(ctx, -19, -27, 1.5, 22, P.torre2);
    rect(ctx, 17.5, -27, 1.5, 22, P.torre2);
  },

  // Torre solar + esfera na rampa de calor; glow chapado em degraus; pulso acima de 0,9; SCRAM cinza-azulado com anel pontilhado.
  receptor(ctx, e, t, longe) {
    const T = e.T ?? 0;
    const scram = !!e.scram;
    const corEsfera = scram ? P.scram : rampa(T);
    const pulso = !scram && T > 0.9 ? 1 + 0.08 * Math.sin(t * 8) : 1;
    if (longe) {
      // em longe/mapa a esfera e os halos são medidos em px de TELA (÷ zoom): o herói não pode virar um ponto
      const z = e.zoom || 1;
      const resp = 1 + 0.08 * Math.sin(t * Math.PI); // pulso ±8 % em 2 s
      const rE = Math.max(18, 7 / z);
      const rM = Math.max(8, 3 / z);
      const rH1 = Math.max(23, 16 / z) * resp;
      const rH2 = Math.max(32, 26 / z) * resp;
      const fw = Math.max(8, 3 / z);
      rect(ctx, -fw / 2, -108, fw, 104, P.torre2);
      if (!scram) {
        circulo(ctx, 0, -126, rH2, haloLonge2(T));
        circulo(ctx, 0, -126, rH1, haloLonge1(T));
      }
      circulo(ctx, 0, -126, rE, corEsfera);
      circulo(ctx, -rE * 0.17, -126 - rE * 0.17, rM, scram ? D.scramMiolo : rampaMiolo(T));
      return;
    }
    const PATH = caminhos();
    sombra(ctx, 0, 0, 20, 9, 6);
    elipseCheia(ctx, 0, 0, 16, 8, P.torre2);
    elipseCheia(ctx, 0, -2, 12, 6, P.torre);
    // fuste
    rect(ctx, -7, -108, 7, 104, D.fusteEsq);
    rect(ctx, 0, -108, 7, 104, D.fusteDir);
    ctx.fillStyle = D.fustePonto;
    ctx.fill(PATH.fustePontos);
    for (let i = 1; i <= 3; i++) rect(ctx, -9, -30 * i - 1.5, 18, 3, P.casaAnel1);
    // coroa
    elipseCheia(ctx, 0, -108, 12, 6, P.torre);
    elipseCheia(ctx, 0, -110, 12, 6, D.coroaTopo);
    rect(ctx, -2, -120, 4, 10, P.torre2);
    // esfera: halos chapados em degraus, aditivos (T > 0,9 ganha um terceiro degrau em solMiolo)
    if (!scram) {
      ctx.globalCompositeOperation = "lighter";
      if (T > 0.9) circulo(ctx, 0, -126, 40 * pulso, HALO3);
      circulo(ctx, 0, -126, 32 * pulso, halo2(T));
      circulo(ctx, 0, -126, 23 * pulso, halo1(T));
      ctx.globalCompositeOperation = "source-over";
    }
    circulo(ctx, 0, -126, 18, corEsfera);
    circulo(ctx, -3, -129, 8, scram ? D.scramMiolo : rampaMiolo(T));
    if (scram) {
      ctx.strokeStyle = D.scramAnel;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 5]);
      ctx.lineDashOffset = -t * 10;
      ctx.beginPath();
      ctx.arc(0, -126, 24, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    } else if (T > 0.05) {
      // partículas de calor subindo da esfera
      const n = 3 + Math.round(clamp01(T) * 3);
      for (let i = 0; i < n; i++) {
        const k = frac(t * 0.45 + i / n);
        ctx.globalAlpha = 0.7 * (1 - k);
        circulo(ctx, 7 * Math.sin(k * 6 + i * 2), -146 - 30 * k, 2.5 * (1 - k * 0.6), corEsfera);
      }
      ctx.globalAlpha = 1;
    }
  },

  // Entulho: dois pedaços opacos com contorno E(entulho,.3) 1,5 px (leaf quando grátis); pop só de escala (ease-out-back, 250 ms).
  entulho(ctx, e, t, longe) {
    if (e.t0 != null) {
      if (t < e.t0) return;
      const k = clamp01((t - e.t0) / 0.25);
      if (k < 1) {
        const sc = Math.max(0.05, easeOutBack(k));
        ctx.scale(sc, sc);
      }
    }
    const PATH = caminhos();
    const borda = e.gratis ? P.leaf : D.entulhoBorda;
    ctx.fillStyle = P.entulho;
    ctx.lineJoin = "round";
    ctx.save();
    ctx.translate(-6, -3);
    ctx.fill(PATH.entulho1);
    if (!longe) {
      ctx.strokeStyle = borda;
      ctx.lineWidth = 1.5;
      ctx.stroke(PATH.entulho1);
    }
    ctx.restore();
    ctx.save();
    ctx.translate(8, 2);
    ctx.fillStyle = P.entulho;
    ctx.fill(PATH.entulho2);
    if (!longe) {
      ctx.strokeStyle = borda;
      ctx.lineWidth = 1.5;
      ctx.stroke(PATH.entulho2);
    }
    ctx.restore();
  },

  // Cata-vento: mastro fino, cubo amarelo, 3 pás brancas. Fase avança vel·1,2 voltas/s.
  cataVento(ctx, e, t, longe) {
    const PATH = caminhos();
    const ang = ((e.fase || 0) + t * (e.vel ?? 1) * 1.2) * TAU;
    if (longe) {
      const z = e.zoom || 1;
      const esc = Math.max(1, 0.18 / Math.max(z, 0.05)); // ≥ 6 px de tela: cresce abaixo de zoom 0,33
      rect(ctx, -1.5 * esc, -34, 3 * esc, 34, P.turbinaCarcaca);
      ctx.save();
      ctx.translate(0, -36);
      ctx.scale(esc, esc);
      ctx.fillStyle = P.pa;
      for (let k = 0; k < 3; k++) {
        ctx.rotate(k ? TAU / 3 : ang);
        ctx.fill(PATH.paCataLongeGrande);
      }
      ctx.restore();
      circulo(ctx, 0, -36, 4 * esc, P.sun);
      return;
    }
    sombra(ctx, 0, 0, 8, 4);
    rect(ctx, -1, -36, 2, 36, P.turbinaCarcaca);
    rect(ctx, 0, -36, 1, 36, D.turbinaMastroBorda);
    ctx.save();
    ctx.translate(0, -36);
    ctx.fillStyle = P.pa;
    for (let k = 0; k < 3; k++) {
      ctx.rotate(k ? TAU / 3 : ang);
      ctx.fill(PATH.paCata);
    }
    ctx.restore();
    circulo(ctx, 0, -36, 3.5, P.sun);
    circulo(ctx, -1, -37, 1.2, P.solMiolo);
  },

  // Turbina eólica: mastro alto em trapézio, nacele, cubo e 3 pás longas a 0,4 volta/s.
  turbinaEolica(ctx, e, t, longe) {
    const PATH = caminhos();
    const ang = ((e.fase || 0) + t * (e.vel ?? 1) * 0.4) * TAU;
    if (longe) {
      // silhueta distinta do cata-vento: mastro 3 px de TELA, nacele tanque2 8×5, pás 1,8× (22×5) e cubo sun de 3 px de tela
      const z = e.zoom || 1;
      const mw = Math.max(4, 3 / z);
      const esc = Math.max(1, 0.3 / Math.max(z, 0.05));
      rect(ctx, -mw / 2, -92, mw, 92, P.turbinaCarcaca);
      ctx.fillStyle = P.tanque2;
      retArred(ctx, -6, -93, 8 * Math.max(1, esc * 0.8), 5 * Math.max(1, esc * 0.8), 2);
      ctx.fill();
      ctx.save();
      ctx.translate(4, -90);
      ctx.scale(esc, esc);
      ctx.fillStyle = P.pa;
      for (let k = 0; k < 3; k++) {
        ctx.rotate(k ? TAU / 3 : ang);
        ctx.fill(PATH.paEolicaLonge);
      }
      ctx.restore();
      circulo(ctx, 4, -90, Math.max(3, 3 / z), P.sun);
      return;
    }
    sombra(ctx, 0, 0, 12, 5, 6);
    elipseCheia(ctx, 0, 0, 7, 3.5, P.torre2);
    ctx.fillStyle = P.turbinaCarcaca;
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.lineTo(3, 0);
    ctx.lineTo(1.5, -88);
    ctx.lineTo(-1.5, -88);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = D.turbinaMastroBorda;
    ctx.beginPath();
    ctx.moveTo(1, 0);
    ctx.lineTo(3, 0);
    ctx.lineTo(1.5, -88);
    ctx.lineTo(0.5, -88);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = P.tanque2;
    retArred(ctx, -8, -97.5, 12, 7, 3);
    ctx.fill();
    ctx.save();
    ctx.translate(4, -90);
    ctx.fillStyle = P.pa;
    for (let k = 0; k < 3; k++) {
      ctx.rotate(k ? TAU / 3 : ang);
      ctx.fill(PATH.paEolica);
    }
    ctx.restore();
    circulo(ctx, 4, -90, 4, P.sun);
    circulo(ctx, 2.8, -91.2, 1.4, P.solMiolo);
  },

  // Painel solar: placa azul-escura inclinada sobre duas pernas, grade e faixa de brilho na aresta superior.
  painelSolar(ctx, _e, _t, longe) {
    if (!longe) {
      sombra(ctx, 0, 0, 18, 6, 6);
      rect(ctx, -18, -2, 3, 9, P.torre2);
      rect(ctx, 15, -9, 3, 13, P.torre2);
    }
    ctx.fillStyle = P.painel;
    ctx.beginPath();
    ctx.moveTo(-22, 2);
    ctx.lineTo(22, -8);
    ctx.lineTo(22, -22);
    ctx.lineTo(-22, -12);
    ctx.closePath();
    ctx.fill();
    if (longe) return;
    ctx.strokeStyle = D.painelBorda;
    ctx.lineWidth = 1;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.strokeStyle = D.painelGrade;
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      const x = -22 + (44 * i) / 4;
      ctx.moveTo(x, 2 - (10 * i) / 4);
      ctx.lineTo(x, -12 - (10 * i) / 4);
    }
    ctx.moveTo(-22, -5);
    ctx.lineTo(22, -15);
    ctx.stroke();
    ctx.fillStyle = D.painelBrilho;
    ctx.beginPath();
    ctx.moveTo(-22, -12);
    ctx.lineTo(22, -22);
    ctx.lineTo(22, -18);
    ctx.lineTo(-22, -8);
    ctx.closePath();
    ctx.fill();
  },

  // Casa da vila: caixinha isométrica com telhado colorido; variante 0 porta, 1 janelas, 2 chaminé.
  casaVila(ctx, e, _t, longe) {
    const teto: Teto = e.teto ?? "coral";
    const variante = e.variante || 0;
    const corTeto = D.tetos[teto];
    if (longe) {
      caixa(ctx, 0.32, 0.32, 22, P.vilaParede, P.vilaParede, P.vilaParede2);
      caixa(ctx, 0.36, 0.36, 6, corTeto, D.tetoSW[teto], D.tetoSE[teto], -22);
      return;
    }
    sombra(ctx, 0, 0, 18, 8, 6);
    caixa(ctx, 0.32, 0.32, 22, P.vilaParede, P.vilaParede, P.vilaParede2);
    if (variante === 0) retFaceSW(ctx, 0.32, 0.32, 0.38, 0.62, 0, 10, P.navy2);
    else if (variante === 1) {
      retFaceSW(ctx, 0.32, 0.32, 0.2, 0.4, 8, 13, P.sun);
      retFaceSW(ctx, 0.32, 0.32, 0.6, 0.8, 8, 13, P.sun);
    } else retFaceSW(ctx, 0.32, 0.32, 0.35, 0.65, 0, 9, P.navy2);
    retFaceSE(ctx, 0.32, 0.32, 0.35, 0.65, 7, 12, P.sun);
    contornoCaixa(ctx, 0.32, 0.32, 22, D.vilaBorda);
    caixa(ctx, 0.36, 0.36, 6, corTeto, D.tetoSW[teto], D.tetoSE[teto], -22);
    // cumeeira: aresta NW do topo do telhado
    ctx.strokeStyle = D.tetoCume[teto];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-32 * 0.72, -28);
    ctx.lineTo(0, -28 - 16 * 0.72);
    ctx.stroke();
    if (variante === 2) {
      rect(ctx, 6, -40, 4, 8, P.tanque2);
      rect(ctx, 5, -41, 6, 2, P.tanque);
    }
  },

  // Bateria: caixa clara com 3 barras `leaf` na face SE e terminal amarelo.
  bateria(ctx, e, _t, longe) {
    const carga = clamp01(e.carga ?? 1);
    const acesas = Math.ceil(carga * 3);
    if (!longe) sombra(ctx, 0, 0, 14, 6);
    caixa(ctx, 0.28, 0.2, 22, P.bateriaCaixa, D.bateriaSW, D.bateriaSE);
    for (let i = 0; i < 3; i++) {
      retFaceSE(ctx, 0.28, 0.2, 0.12 + i * 0.28, 0.3 + i * 0.28, 5, 17, i < acesas ? P.leaf : D.leafApagado);
    }
    if (longe) return;
    contornoCaixa(ctx, 0.28, 0.2, 22, D.bateriaBorda);
    circulo(ctx, 0, -29.7, 3, P.sun);
  },

  // Árvore: tronco roxo, copa de três círculos com sombra interna chapada e realce.
  arvore(ctx, e, _t, longe) {
    const sc = e.escala || 1;
    const v = e.variante || 0;
    if (sc !== 1) ctx.scale(sc, sc);
    if (longe) {
      circulo(ctx, 0, -24, 15, P.copa);
      return;
    }
    sombra(ctx, 0, 0, 12, 5);
    rect(ctx, -2, -14, 4, 15, P.rocha2);
    rect(ctx, 0, -14, 2, 15, P.rocha3);
    const ox = v === 1 ? -3 : v === 2 ? 3 : 0;
    ctx.fillStyle = P.copa2;
    ctx.beginPath();
    ctx.arc(3 + ox, -24, 12, 0, TAU);
    ctx.moveTo(-5 + ox, -18);
    ctx.arc(-5 + ox, -18, 10, 0, TAU);
    ctx.moveTo(11 + ox, -19);
    ctx.arc(11 + ox, -19, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = P.copa;
    ctx.beginPath();
    ctx.arc(ox, -26, 12, 0, TAU);
    ctx.moveTo(-8 + ox, -20);
    ctx.arc(-8 + ox, -20, 10, 0, TAU);
    ctx.moveTo(8 + ox, -21);
    ctx.arc(8 + ox, -21, 9, 0, TAU);
    ctx.fill();
    circulo(ctx, -4 + ox, -31, 4.5, P.leaf);
  },

  // Pinheiro: três triângulos arredondados em tons de verde.
  pinheiro(ctx, e, _t, longe) {
    const PATH = caminhos();
    const sc = e.escala || 1;
    if (sc !== 1) ctx.scale(sc, sc);
    if (longe) {
      ctx.fillStyle = P.copa;
      ctx.fill(PATH.pinheiroLonge);
      return;
    }
    sombra(ctx, 0, 0, 12, 5);
    rect(ctx, -2, -8, 4, 9, P.rocha2);
    ctx.fillStyle = P.copa2;
    ctx.fill(PATH.pinheiro[0]);
    ctx.fillStyle = P.copa;
    ctx.fill(PATH.pinheiro[1]);
    ctx.fillStyle = P.grama2;
    ctx.fill(PATH.pinheiro[2]);
  },

  // Arbusto: dois círculos e um realce.
  arbusto(ctx, _e, _t, longe) {
    if (longe) {
      circulo(ctx, 0, -6, 8, P.grama2);
      return;
    }
    sombra(ctx, 0, 0, 9, 4);
    ctx.fillStyle = P.copa2;
    ctx.beginPath();
    ctx.arc(-2, -4, 7, 0, TAU);
    ctx.moveTo(7, -4);
    ctx.arc(7, -4, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = P.grama2;
    ctx.beginPath();
    ctx.arc(-4, -6, 7, 0, TAU);
    ctx.moveTo(5, -6);
    ctx.arc(5, -6, 6, 0, TAU);
    ctx.fill();
    circulo(ctx, -5, -9, 3, P.leaf);
  },

  // Pedra roxo-azulada: silhueta arredondada com faceta clara no topo e escura à direita.
  pedra(ctx, e, _t, longe) {
    const PATH = caminhos();
    const p = PATH.pedras[Math.abs(Math.round(e.variante || 0)) % 3];
    if (longe) {
      ctx.fillStyle = P.rocha;
      ctx.fill(p.sil);
      return;
    }
    sombra(ctx, 0, 0, 11, 4);
    ctx.fillStyle = P.rocha;
    ctx.fill(p.sil);
    ctx.fillStyle = D.rochaTopo;
    ctx.fill(p.topo);
    ctx.fillStyle = P.rocha2;
    ctx.fill(p.dir);
    ctx.strokeStyle = P.rocha3;
    ctx.lineWidth = 1;
    ctx.stroke(p.sil);
  },


  // Pântano: poça de lodo em dois tons com juncos e dois brilhos.
  pantano(ctx, _e, t, longe) {
    elipseCheia(ctx, 0, 0, 26, 13, P.lodo2);
    elipseCheia(ctx, -2, -2, 21, 10, P.lodo);
    if (longe) return;
    ctx.strokeStyle = A(P.agua2, 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-4, -3, 9, 4, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = P.junco;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const x = -14 + i * 7;
      const h = 12 + (i % 3) * 5;
      const b = Math.sin(t * 1.2 + i) * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, -2);
      ctx.quadraticCurveTo(x + b, -2 - h * 0.6, x + b * 2, -2 - h);
      ctx.stroke();
    }
  },

  // Montanha 2×2: maciço de rocha com neve no topo, ocupando quatro casas (o ponto do chão é o canto norte).
  montanha(ctx, e, _t, longe) {
    const p = e.progresso;
    if (!longe) sombra(ctx, 32, 16, 44, 22, 6);
    // silhueta: base losangular de 2×2 casas, cume acima do centro
    ctx.fillStyle = P.rocha;
    ctx.beginPath();
    ctx.moveTo(-62, 2);
    ctx.lineTo(0, -62);
    ctx.lineTo(62, 2);
    ctx.lineTo(32, 32);
    ctx.lineTo(0, 16);
    ctx.lineTo(-32, 32);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = P.rocha2;
    ctx.beginPath();
    ctx.moveTo(0, -62);
    ctx.lineTo(62, 2);
    ctx.lineTo(32, 32);
    ctx.lineTo(0, 16);
    ctx.closePath();
    ctx.fill();
    if (longe) return;
    ctx.fillStyle = P.neve;
    ctx.beginPath();
    ctx.moveTo(0, -62);
    ctx.lineTo(20, -40);
    ctx.lineTo(10, -36);
    ctx.lineTo(0, -44);
    ctx.lineTo(-10, -36);
    ctx.lineTo(-20, -40);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = P.rocha3;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -62);
    ctx.lineTo(0, 16);
    ctx.stroke();
    if (p !== undefined) barraProgresso(ctx, 0, -74, 44, p);
  },

  // Pico permanente: agulha de rocha alta com brilho de vento em volta.
  pico(ctx, e, t, longe) {
    if (!longe) sombra(ctx, 0, 0, 16, 7);
    ctx.fillStyle = P.rocha;
    ctx.beginPath();
    ctx.moveTo(-16, 4);
    ctx.lineTo(0, -56);
    ctx.lineTo(16, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = P.rocha2;
    ctx.beginPath();
    ctx.moveTo(0, -56);
    ctx.lineTo(16, 4);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();
    if (longe) return;
    ctx.fillStyle = P.neve;
    ctx.beginPath();
    ctx.moveTo(0, -56);
    ctx.lineTo(7, -38);
    ctx.lineTo(0, -42);
    ctx.lineTo(-7, -38);
    ctx.closePath();
    ctx.fill();
    // rajadas: dois arcos que correm em 3 s
    ctx.strokeStyle = A(P.sky, 0.45);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let i = 0; i < 2; i++) {
      const k = frac(t / 3 + i * 0.5 + (e.fase ?? 0));
      const y = -46 + k * 30;
      const l = 10 + k * 14;
      ctx.globalAlpha = 0.8 * (1 - k);
      ctx.beginPath();
      ctx.moveTo(12, y);
      ctx.quadraticCurveTo(12 + l * 0.6, y - 3, 12 + l, y - 1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },

  // Subestação: pórtico de dois postes com transformador, isoladores e um arco de energia quando escoa.
  subestacao(ctx, e, t, longe) {
    const nivel = Math.max(0, Math.round(e.nivel ?? 0));
    if (!longe) sombra(ctx, 0, 0, 16, 7);
    caixa(ctx, 0.3, 0.22, 14, P.tanque, D.bateriaSW, D.bateriaSE);
    if (longe) {
      rect(ctx, -1.5, -34, 3, 20, P.poste);
      return;
    }
    contornoCaixa(ctx, 0.3, 0.22, 14, D.bateriaBorda);
    // pórtico
    rect(ctx, -11, -40, 3, 27, P.poste);
    rect(ctx, 8, -40, 3, 27, P.poste);
    rect(ctx, -11, -42, 22, 3, P.poste);
    ctx.strokeStyle = D.fustePonto;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-9.5, -36);
    ctx.lineTo(9.5, -36);
    ctx.moveTo(-9.5, -30);
    ctx.lineTo(9.5, -30);
    ctx.stroke();
    // isoladores: um por nível (0 → 1)
    for (let i = 0; i <= nivel && i < 4; i++) circulo(ctx, -7 + i * 5, -44, 2, P.sun);
    // arco de energia
    const k = frac(t * 0.8);
    ctx.strokeStyle = A(P.sun, 0.8 * (1 - Math.abs(k * 2 - 1)));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, -39);
    ctx.quadraticCurveTo(0, -33 - 4 * Math.sin(k * Math.PI), 9, -39);
    ctx.stroke();
  },

  // Cristal: dois prismas `void` com halo chapado (fica em longe) e brilho piscante.
  cristal(ctx, e, t, longe) {
    const PATH = caminhos();
    const sc = e.escala || 1;
    if (sc !== 1) ctx.scale(sc, sc);
    ctx.globalCompositeOperation = "lighter";
    if (!longe) circulo(ctx, 0, -8, 14, D.voidHalo1);
    circulo(ctx, 0, -8, 9, D.voidHalo2);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = P.cristal;
    ctx.fill(PATH.cristal1);
    ctx.fill(PATH.cristal2);
    if (longe) return;
    ctx.strokeStyle = P.cristal2;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(1, -21);
    ctx.lineTo(4.6, -1);
    ctx.moveTo(8, -13);
    ctx.lineTo(10.5, -1);
    ctx.stroke();
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + (e.seed || 0));
    circulo(ctx, 0, -15, 1.5, P.ink);
    ctx.globalAlpha = 1;
  },

  // Placa de bloqueio de região: moeda no chão (aro gold), r 14 em perto; em longe r 7 px de TELA.
  // O preço e o nome ficam na pílula de tela (callouts da cena), legível em qualquer zoom ≥ 0,2.
  placaBloqueio(ctx, e, _t, longe) {
    if (longe) {
      const z = e.zoom || 1;
      const r = 7 / z;
      circulo(ctx, 0, -r * 0.5, r, P.gold);
      circulo(ctx, 0, -r * 0.5, r - 1.5 / z, P.sun);
      circulo(ctx, -r * 0.25, -r * 0.75, r * 0.3, P.solMiolo);
      return;
    }
    sombra(ctx, 0, 0, 12, 5);
    circulo(ctx, 0, -8, 14, P.gold);
    circulo(ctx, 0, -8, 12, P.sun);
    circulo(ctx, -3, -11, 4, P.solMiolo);
    ctx.fillStyle = P.gold;
    ctx.font = "600 13px Outfit, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("₵", 0, -7.5);
  },

  // Bipe: robô esférico (fator 0,4 sobre o viewBox 100×112 de Bipe.tsx). Um olho, uma antena, dois braços, sem pernas.
  bipe(ctx, e, t, longe) {
    const papel = D.bipe[e.papel ?? "operador"];
    const cor = papel.cor;
    const fase = e.fase || 0;
    const ex = e.expressao ?? "neutro";
    const alarmado = ex === "alarmado";
    const apontando = ex === "apontando";
    const cansado = ex === "cansado";
    const bob = 3 * Math.sin(t * Math.PI + fase * TAU);
    const oy = -20 + bob;
    const rOlho = alarmado ? 7 : 6;
    const olhoX = apontando ? 2.5 : 0;
    const olhoY = oy - 0.8;
    if (longe) {
      circulo(ctx, 0, oy, 14, cor);
      rect(ctx, -1, oy - 20, 2, 7, cor);
      circulo(ctx, 0, oy - 20, 2.5, alarmado ? P.coral : cor);
      circulo(ctx, olhoX, olhoY, rOlho, P.navy);
      return;
    }
    const PATH = caminhos();
    // sombra no chão (encolhe quando sobe)
    ctx.fillStyle = P.sombraForte;
    elipse(ctx, 2, 1, 10 - Math.abs(bob) * 0.3, 2.5);
    ctx.fill();
    // braços: cápsulas separadas 3 px do corpo (fora do disco r 14), sombra chapada +1,5 — nada recorta o corpo
    bracoBipe(ctx, -19.5, oy + 5, 22 * RAD, PATH.bracoBipe, cor);
    if (apontando) bracoBipe(ctx, 17, oy + 1, 0, PATH.bracoApontando, cor);
    else bracoBipe(ctx, 19.5, oy + 5, -22 * RAD, PATH.bracoBipe, cor);
    // antena (haste 1,5×6 + bolinha r 3,5)
    rect(ctx, -0.75, oy - 20, 1.5, 7, cor);
    circulo(ctx, 0, oy - 21, alarmado ? 3.5 + 0.8 * Math.sin(t * 8) : 3.5, alarmado ? P.coral : cor);
    // corpo: sombra chapada, esfera, contorno 2 px na matiz derivada (o corpo cobre qualquer sombra dos braços)
    circulo(ctx, 1.5, oy + 1.5, 14, D.bipeSombra);
    circulo(ctx, 0, oy, 14, cor);
    ctx.strokeStyle = papel.borda;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, oy, 13, 0, TAU);
    ctx.stroke();
    // olho: piscar de 120 ms a cada 4 s
    const piscando = frac((t + fase * 4) / 4) < 0.03;
    if (!piscando) {
      circulo(ctx, olhoX, olhoY, rOlho, P.navy);
      circulo(ctx, olhoX - 2, olhoY - 2, 1.5, P.ink);
      if (cansado) rect(ctx, olhoX - rOlho - 0.5, olhoY - rOlho - 0.5, rOlho * 2 + 1, rOlho + 0.5, cor);
    } else {
      ctx.strokeStyle = P.navy;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(olhoX - rOlho, olhoY);
      ctx.lineTo(olhoX + rOlho, olhoY);
      ctx.stroke();
    }
  },

  // Brasa da Cascata: halo laranja e núcleo na rampa; mescla para `entulho` no fim da vida.
  brasa(ctx, e) {
    const vida = clamp01(e.vida ?? 1);
    const r = Math.max(1, (4 + 2 * (e.seed || 0)) * (0.4 + 0.6 * vida));
    ctx.globalCompositeOperation = "lighter";
    circulo(ctx, 0, 0, r * 2.2, D.laranjaHalo);
    ctx.globalCompositeOperation = "source-over";
    circulo(ctx, 0, 0, r, vida > 0.25 ? rampa(0.6 + 0.4 * vida) : D.brasaFim[Math.round(vida * 20)]);
  },

  // Partícula de calor: sobe e some.
  particula(ctx, e) {
    const vida = clamp01(e.vida ?? 1);
    const cor = e.cor ?? P.sun;
    ctx.globalAlpha = vida * 0.6;
    circulo(ctx, 4 * Math.sin(vida * 6 + (e.seed || 0)), -40 * (1 - vida), 2 + 2 * (1 - vida), cor);
    ctx.globalAlpha = 1;
  },
};

// ---------------------------------------------------------------------------------------------
// Feixe: linha translúcida `sun` do espelho ao centro da esfera. Desenhado em coordenadas de mundo
// (a câmera já está aplicada; nada de translate/scale do sprite). Antes dos objetos.
// ---------------------------------------------------------------------------------------------

export function desenharFeixe(ctx: Ctx, feixe: Feixe, t: number): void {
  const forca = clamp01(feixe.forca);
  if (forca < 0.25) return;
  const longe = feixe.lod === "longe";
  const z = feixe.zoom || 1;
  const mapa = z < 0.22;
  const x0 = feixe.de[0];
  const y0 = feixe.de[1] - ALTURAS.espelho;
  const x1 = feixe.para[0];
  const y1 = feixe.para[1] - ALTURAS.esfera;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.scale(len, 1);
  // perto: 2 px em 'lighter' + núcleo 1 px ink; longe: 2 px de TELA (α .35–.55); modo mapa: 1 px de tela α .3
  ctx.lineCap = "butt";
  if (mapa) {
    ctx.strokeStyle = D.feixeMapa;
    ctx.lineWidth = 1 / z;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(1, 0);
    ctx.stroke();
  } else if (longe) {
    ctx.strokeStyle = gradFeixe(ctx, forca, true);
    ctx.lineWidth = 2 / z;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(1, 0);
    ctx.stroke();
  } else {
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = gradFeixe(ctx, forca, false);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(1, 0);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = FEIXE_NUCLEO;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(1, 0);
    ctx.stroke();
  }
  ctx.restore();
  // ponto viajante: r 3 em perto; em longe a partir de zoom 0,3 (r 2 px de tela)
  if (!longe) {
    const k = frac(t / 1.2 + feixe.fase);
    circulo(ctx, x0 + dx * k, y0 + dy * k, 3, D.feixePonto);
  } else if (z >= 0.3) {
    const k = frac(t / 1.2 + feixe.fase);
    circulo(ctx, x0 + dx * k, y0 + dy * k, 2 / z, D.feixePonto);
  }
}

// ---------------------------------------------------------------------------------------------
// Entrada única
// ---------------------------------------------------------------------------------------------

/**
 * Desenha `nome` com o ponto do chão em (cx, cy) (mundo) e escala `s` (1 = casa 64×32).
 * A câmera já deve estar aplicada no ctx. `fantasma` desenha tudo em α 0,35.
 */
export function desenharSprite(
  nome: NomeSprite,
  ctx: Ctx,
  cx: number,
  cy: number,
  s: number,
  estado: EstadoSprite,
  t: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  if (s !== 1) ctx.scale(s, s);
  if (estado.fantasma) ctx.globalAlpha = 0.35;
  S[nome](ctx, estado, t, estado.lod === "longe", cx, cy);
  ctx.restore();
}
