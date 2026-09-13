/**
 * Tabuleiros das escalas cósmicas (direcao.md §8): planeta, sistema, galáxia, universo e multiverso.
 * Cada tabuleiro vive em unidades de mundo com a origem no centro da forma-mãe (raio ≈ 300–345) e é
 * desenhado em coordenadas de TELA pela câmera: tela = mundo·zoom + (tx, ty). `ajustarCameraEscala`
 * enquadra a forma-mãe com 8 % de margem (no desktop 1280×800 o zoom fica ≈ 1). Linhas, placas e marcador
 * têm espessura/tamanho de tela (px ÷ zoom). Uma ideia por tabuleiro, formas grandes, sem texto além do
 * rótulo do nível e das placas. Geometria fixa montada uma vez (Path2D) na primeira chamada; no caminho
 * quente nada é alocado além do que o canvas exige. Animação via `t`, desligada com `movimentoReduzido()`.
 * A ilha (nível 0) é do terreno: aqui `desenharEscala("ilha", …)` não faz nada.
 *
 * Transformação: aplica `ctx.transform(zoom, 0, 0, zoom, tx, ty)` sobre a corrente (identidade ou DPR) e
 * restaura ao fim.
 */
import { NIVEIS, type NivelId } from "../../content/escalas";
import { PALETA, alfa, clarear, escurecer, frac, misturar, movimentoReduzido, retArred, rnd, ruido, type Camera } from "./base";

export type NivelEscala = Exclude<NivelId, "ilha">;

/** Retângulo de tela [x, y, w, h] em px CSS. */
export type Reserva = readonly [number, number, number, number];

export interface OpcoesEscala {
  /** No jogo o nível abre pela potência instalada; aqui só se desenha o resultado. */
  desbloqueado: boolean;
  /** Rótulo da potência que abre o nível ("10²⁶ W"). */
  potenciaTexto: string;
  /** Tipo Kardashev ("Tipo II"). */
  tipo: string;
  titulo: string;
  /** Instante `t` (s) da chegada ao nível: o marcador pulsa nos 500 ms seguintes. */
  chegada?: number;
  /** Retângulos de tela ocupados por controles/minimapa: placas e rótulo desviam deles. */
  reservas?: readonly Reserva[];
}

/** Paleta local (direcao.md §2): ajustes entram aqui, nunca em base.ts. */
const P = {
  ...PALETA,
  oceano: "#1e5bd6",
  oceano2: "#0f2f7a",
  fundoGalaxia: "#140b38",
  bordaBloqueio: "rgba(244,246,255,.35)",
} as const;

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
const SEED = 0x60e5ca;
const FONTE = (px: number): string => `600 ${px}px Outfit, "Segoe UI", system-ui, sans-serif`;
const FONTE_PLACA = FONTE(11);
const FONTE_PRECO = FONTE(13);
const FONTE_MARCADOR = FONTE(12);
const FONTE_NIVEL = FONTE(14);
const FONTE_MOEDA = FONTE(10);
const SEM_TRACO: number[] = [];

// tracejados em px de tela: os arrays são mutados por zoom (nada alocado por quadro)
const TRACO_VAGA = [4, 4];
const TRACO_ORBITA = [2, 6];
const TRACO_FINO = [3, 4];
let zTraco = 0;
function tracos(z: number): void {
  if (zTraco === z) return;
  zTraco = z;
  TRACO_VAGA[0] = TRACO_VAGA[1] = 4 / z;
  TRACO_ORBITA[0] = 2 / z;
  TRACO_ORBITA[1] = 6 / z;
  TRACO_FINO[0] = 3 / z;
  TRACO_FINO[1] = 4 / z;
}

type Vec = [number, number];
/** Rascunho de posição (evita alocar por vaga). */
const vec: Vec = [0, 0];

/** Cores derivadas calculadas uma vez (nada de alfa/misturar no caminho quente). */
const D = {
  navy55: alfa(P.navy, 0.55),
  navy5: alfa(P.navy, 0.5),
  ion35: alfa(P.ion, 0.35),
  ion15: alfa(P.ion, 0.15),
  ion1: alfa(P.ion, 0.1),
  ion3: alfa(P.ion, 0.3),
  ion4: alfa(P.ion, 0.4),
  ion45: alfa(P.ion, 0.45),
  ion5: alfa(P.ion, 0.5),
  ion22: alfa(P.ion, 0.22),
  ion28: alfa(P.ion, 0.28),
  ion8: alfa(P.ion, 0.8),
  ink06: alfa(P.ink, 0.06),
  ink12: alfa(P.ink, 0.12),
  ink35: alfa(P.ink, 0.35),
  ink6: alfa(P.ink, 0.6),
  ink7: alfa(P.ink, 0.7),
  ink9: alfa(P.ink, 0.9),
  sun35: alfa(P.sun, 0.35),
  sun3: alfa(P.sun, 0.3),
  sun25: alfa(P.sun, 0.25),
  gold05: alfa(P.gold, 0.05),
  gold12: alfa(P.gold, 0.12),
  gold25: alfa(P.gold, 0.25),
  gold5: alfa(P.gold, 0.5),
  gold6: alfa(P.gold, 0.6),
  gold85: alfa(P.gold, 0.85),
  goldEsc: escurecer(P.gold, 0.25),
  goldMiolo: misturar(P.gold, P.solMiolo, 0.4),
  void06: alfa(P.void, 0.06),
  void15: alfa(P.void, 0.15),
  void35: alfa(P.void, 0.35),
  muted45: alfa(P.muted, 0.45),
  muted8: alfa(P.muted, 0.8),
  muted9: alfa(P.muted, 0.9),
  tanque75: alfa(P.tanque2, 0.75),
  nuvem: alfa(P.turbinaCarcaca, 0.5),
  oceano2_6: alfa(P.oceano2, 0.6),
  vagaTerra: misturar(P.grama2, P.navy, 0.55),
  poeira: alfa(P.fundoGalaxia, 0.4),
  plasma12: alfa(P.plasma, 0.12),
  plasma5: alfa(P.plasma, 0.5),
  cristal35: alfa(P.cristal2, 0.35),
  card92: alfa(P.card, 0.92),
  card85: alfa(P.card, 0.85),
} as const;

/** Cor do ponto no rótulo do nível (a cor do Tipo). */
const COR_NIVEL: Record<NivelId, string> = {
  ilha: P.leaf,
  planeta: P.sky,
  sistema: P.gold,
  galaxia: P.void,
  universo: P.ion,
  multiverso: P.plasma,
};

/** Raio da forma-mãe em unidades de mundo (a ilha usa o padrão 340 só para o enquadramento). */
const RAIO: Record<NivelId, number> = {
  ilha: 340,
  planeta: 335,
  sistema: 345,
  galaxia: 330,
  universo: 330,
  multiverso: 330,
};

/* ------------------------------------------------------------------ */
/* Vagas e utilidades de geometria                                     */
/* ------------------------------------------------------------------ */

type EstadoVaga = "bloqueada" | "comprada" | "atual";

interface Vaga {
  x: number;
  y: number;
  r: number;
  estado: EstadoVaga;
  /** Instante da compra, para o pop de 250 ms. */
  t0?: number;
  /** Preço em ₵ (só o planeta, que é desbloqueado). */
  preco?: string;
}

interface Tabuleiro {
  readonly vagas: readonly Vaga[];
  /** Índices das vagas (planeta/galáxia/universo/multiverso: menos a atual) da mais perto à mais longe do marcador. */
  readonly ordem: readonly number[];
  /** As duas vagas que levam a placa "precisa de …" quando o nível está bloqueado. */
  readonly placasBloq: readonly [number, number];
  /** Posição de mundo do marcador "você está aqui" no instante `ta`. */
  marcador(ta: number, out: Vec): void;
  /** Posição de mundo da vaga `i` no instante `ta` (só quem gira/flutua define). */
  posVaga?(i: number, ta: number, out: Vec): void;
  desenhar(ctx: CanvasRenderingContext2D, z: number, ta: number, t: number, reduzido: boolean): void;
}

type Ruido = (x: number, y: number) => number;

/** Blob orgânico: polígono de `n` pontos em torno de (0,0) com raios (rx, ry) deformados por ruído. */
function blob(path: Path2D, rx: number, ry: number, ru: Ruido, sx: number, sy: number, amp: number, n: number): void {
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * TAU;
    const d = 1 - amp / 2 + amp * ru(sx + Math.cos(a) * 2.3, sy + Math.sin(a) * 2.3);
    const x = Math.cos(a) * rx * d;
    const y = Math.sin(a) * ry * d;
    if (k === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.closePath();
}

function circulo(path: Path2D, x: number, y: number, r: number): void {
  path.moveTo(x + r, y);
  path.arc(x, y, r, 0, TAU);
}

/** Índices das vagas, menos a atual, da mais perto à mais longe dela. */
function ordenarPorDistancia(vagas: readonly Vaga[], atual: Vaga): number[] {
  return vagas
    .map((_, i) => i)
    .filter((i) => vagas[i] !== atual)
    .sort((i, j) => Math.hypot(vagas[i].x - atual.x, vagas[i].y - atual.y) - Math.hypot(vagas[j].x - atual.x, vagas[j].y - atual.y));
}

/**
 * Placas dos níveis bloqueados: 2 vagas da metade externa (não cobrem o centro), a mais perto do marcador e,
 * entre as externas, a mais distante dessa primeira.
 */
function escolherPlacas(vagas: readonly Vaga[], ordem: readonly number[]): [number, number] {
  let rmax = 0;
  for (const v of vagas) rmax = Math.max(rmax, Math.hypot(v.x, v.y));
  const externas = ordem.filter((i) => Math.hypot(vagas[i].x, vagas[i].y) >= rmax * 0.55);
  const i1 = externas.length > 0 ? externas[0] : ordem[0];
  const a = vagas[i1];
  let i2 = i1;
  let dm = -1;
  for (const i of externas) {
    const d = Math.hypot(vagas[i].x - a.x, vagas[i].y - a.y);
    if (d > dm) {
      dm = d;
      i2 = i;
    }
  }
  return [i1, i2];
}

/** Vaga bloqueada genérica: disco com véu navy e contorno tracejado em px de tela. */
function vagaBloqueada(ctx: CanvasRenderingContext2D, z: number, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = D.navy55;
  ctx.fill();
  ctx.setLineDash(TRACO_VAGA);
  ctx.lineWidth = 1 / z;
  ctx.strokeStyle = P.bordaBloqueio;
  ctx.stroke();
  ctx.setLineDash(SEM_TRACO);
}

/** Vaga comprada genérica: cor do nível α .85, contorno escurecido, pop de 250 ms (ease-out-back) desde `t0`. */
function vagaComprada(ctx: CanvasRenderingContext2D, z: number, x: number, y: number, r: number, cor: string, t: number, t0: number | undefined, reduzido: boolean): void {
  let e = 1;
  if (t0 !== undefined && !reduzido) {
    const k = Math.max(0, Math.min(1, (t - t0) / 0.25));
    const c1 = 1.70158;
    const c3 = c1 + 1;
    e = 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
  }
  ctx.beginPath();
  ctx.arc(x, y, r * e, 0, TAU);
  ctx.fillStyle = alfa(cor, 0.85);
  ctx.fill();
  ctx.lineWidth = 1.5 / z;
  ctx.strokeStyle = escurecer(cor, 0.25);
  ctx.stroke();
}

/* ===================================================================================== */
/* 1 · PLANETA: globo com continentes, ilhas-vaga, terminador, nuvens e atmosfera         */
/* ===================================================================================== */

interface Continente {
  path: Path2D;
  cx: number;
  cy: number;
  rot: number;
}

interface VagaPlaneta extends Vaga {
  path: Path2D;
}

interface Nuvem {
  x0: number;
  y: number;
  e: number;
}

/** Preços em ₵ por distância da ilha atual (perto = barato). */
const PRECOS_PLANETA = ["24 mil", "61 mil", "150 mil", "380 mil", "920 mil", "2,3 mi", "5,8 mi", "14 mi", "36 mi", "90 mi", "220 mi"];

class Planeta implements Tabuleiro {
  readonly R = 300;
  readonly vagas: VagaPlaneta[] = [];
  readonly ordem: number[];
  readonly placasBloq: readonly [number, number];
  readonly continentes: Continente[] = [];
  readonly nuvens: Nuvem[] = [];
  readonly grade = new Path2D();
  readonly atual: VagaPlaneta;
  /** Gradiente de dois azuis (luz de cima-esquerda), em coordenadas de mundo; criado na primeira chamada (precisa do ctx). */
  private grad: CanvasGradient | null = null;

  constructor() {
    const R = this.R;
    const r = rnd(SEED + 1);
    const ru = ruido(SEED + 2);
    // 6 continentes: elipses deformadas por ruído
    const pontos: [number, number, number][] = [];
    for (let c = 0; c < 6; c++) {
      let cx = 0;
      let cy = 0;
      let rx = 0;
      let ry = 0;
      let ok = false;
      for (let tent = 0; tent < 40 && !ok; tent++) {
        const a = r() * TAU;
        const d = r() * R * 0.72;
        cx = Math.cos(a) * d;
        cy = Math.sin(a) * d;
        rx = R * (0.2 + r() * 0.16);
        ry = rx * (0.5 + r() * 0.45);
        ok = true;
        for (const p of pontos) {
          if (Math.hypot(p[0] - cx, p[1] - cy) < (p[2] + rx) * 0.8) {
            ok = false;
            break;
          }
        }
      }
      pontos.push([cx, cy, rx]);
      const path = new Path2D();
      const rot = r() * Math.PI;
      // constrói o blob no sistema local e guarda a transformação (translate + rotate)
      blob(path, rx, ry, ru, c * 13 + 3, c * 7 + 11, 0.8, 40);
      this.continentes.push({ path, cx, cy, rot });
    }
    // 12 ilhas-vaga (blobs 0,04–0,07R), fora dos continentes
    for (let i = 0; i < 12; i++) {
      let x = 0;
      let y = 0;
      let ok = false;
      for (let tent = 0; tent < 60 && !ok; tent++) {
        const a = r() * TAU;
        const d = R * (0.12 + r() * 0.74);
        x = Math.cos(a) * d;
        y = Math.sin(a) * d;
        ok = true;
        for (const p of pontos) {
          if (Math.hypot(p[0] - x, p[1] - y) < p[2] * 1.25 + R * 0.06) {
            ok = false;
            break;
          }
        }
        for (const v of this.vagas) {
          if (Math.hypot(v.x - x, v.y - y) < R * 0.2) {
            ok = false;
            break;
          }
        }
      }
      const rr = R * (0.04 + r() * 0.03);
      const path = new Path2D();
      blob(path, rr, rr * (0.7 + r() * 0.3), ru, 50 + i * 9, 40 + i * 5, 0.9, 20);
      this.vagas.push({ x, y, r: rr, path, estado: "bloqueada", preco: "" });
    }
    // a ilha atual: a mais visível (lado iluminado, perto do centro)
    let melhor = 0;
    let md = 1e9;
    this.vagas.forEach((v, i) => {
      const d = Math.hypot(v.x + R * 0.25, v.y + R * 0.1);
      if (d < md) {
        md = d;
        melhor = i;
      }
    });
    this.atual = this.vagas[melhor];
    this.atual.estado = "atual";
    this.ordem = ordenarPorDistancia(this.vagas, this.atual);
    this.ordem.forEach((i, k) => {
      this.vagas[i].preco = PRECOS_PLANETA[k];
    });
    this.placasBloq = escolherPlacas(this.vagas, this.ordem);
    // 4 nuvens: 3 elipses cada, deslizando a 2 px/s
    for (let n = 0; n < 4; n++) {
      const x0 = r() * R * 2.4;
      const y = (r() - 0.5) * R * 1.5;
      const e = R * (0.12 + r() * 0.08);
      this.nuvens.push({ x0, y, e });
    }
    // grade de 30° (uma Path2D)
    const g = this.grade;
    for (let k = -2; k <= 2; k++) {
      const yy = R * Math.sin(k * 30 * RAD);
      g.moveTo(-R, yy);
      g.lineTo(R, yy);
    }
    for (let k = 1; k <= 2; k++) {
      const rx = R * Math.sin(k * 30 * RAD);
      g.moveTo(rx, 0);
      g.ellipse(0, 0, rx, R, 0, 0, TAU);
    }
    g.moveTo(0, -R);
    g.lineTo(0, R);
  }

  marcador(_ta: number, out: Vec): void {
    out[0] = this.atual.x;
    out[1] = this.atual.y;
  }

  desenhar(ctx: CanvasRenderingContext2D, z: number, ta: number): void {
    const R = this.R;
    if (!this.grad) {
      const gr = ctx.createRadialGradient(-R * 0.4, -R * 0.4, 0, -R * 0.1, -R * 0.1, R * 1.35);
      gr.addColorStop(0, clarear(P.oceano, 0.18));
      gr.addColorStop(0.55, P.oceano);
      gr.addColorStop(1, misturar(P.oceano, P.oceano2, 0.55));
      this.grad = gr;
    }
    // atmosfera: anel 6 em R+3 (A(ion,.35)) e fio 1 px de tela em R+12; sem glow
    ctx.strokeStyle = D.ion35;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, R + 3, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = D.ion15;
    ctx.lineWidth = 1 / z;
    ctx.beginPath();
    ctx.arc(0, 0, R + 12, 0, TAU);
    ctx.stroke();
    // disco + clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.fillStyle = this.grad;
    ctx.fill();
    ctx.clip();
    // continentes
    ctx.fillStyle = P.grama2;
    ctx.strokeStyle = P.gramaEsc;
    ctx.lineWidth = 1.5 / z;
    ctx.lineJoin = "round";
    for (const c of this.continentes) {
      ctx.save();
      ctx.translate(c.cx, c.cy);
      ctx.rotate(c.rot);
      ctx.fill(c.path);
      ctx.stroke(c.path);
      ctx.restore();
    }
    // grade de 30°
    ctx.strokeStyle = D.ink06;
    ctx.lineWidth = 1 / z;
    ctx.stroke(this.grade);
    // ilhas-vaga: bloqueadas = terra escurecida + tracejado; atual = grama viva
    for (const v of this.vagas) {
      ctx.save();
      ctx.translate(v.x, v.y);
      if (v.estado === "bloqueada") {
        ctx.fillStyle = D.vagaTerra;
        ctx.fill(v.path);
        ctx.setLineDash(TRACO_VAGA);
        ctx.lineWidth = 1 / z;
        ctx.strokeStyle = P.bordaBloqueio;
        ctx.stroke(v.path);
        ctx.setLineDash(SEM_TRACO);
      } else {
        ctx.fillStyle = v.estado === "atual" ? P.grama : P.grama2;
        ctx.fill(v.path);
        ctx.lineWidth = 1.5 / z;
        ctx.strokeStyle = P.gramaEsc;
        ctx.stroke(v.path);
      }
      ctx.restore();
    }
    // nuvens (2 px/s, envolvem pelo disco); a que passar a menos de 1,3·e do marcador é pulada (não cobre o "você está aqui")
    ctx.fillStyle = D.nuvem;
    ctx.beginPath();
    for (const n of this.nuvens) {
      const nx = -R * 1.2 + ((n.x0 + ta * 2) % (R * 2.4));
      const ny = n.y;
      const e = n.e;
      if (Math.hypot(nx - this.atual.x, ny - this.atual.y) < 1.3 * e) continue;
      ctx.moveTo(nx + e, ny);
      ctx.ellipse(nx, ny, e, e * 0.28, 0, 0, TAU);
      ctx.moveTo(nx + e * 0.5 + e * 0.55, ny - e * 0.15);
      ctx.ellipse(nx + e * 0.5, ny - e * 0.15, e * 0.55, e * 0.28, 0, 0, TAU);
      ctx.moveTo(nx - e * 0.4 + e * 0.45, ny - e * 0.1);
      ctx.ellipse(nx - e * 0.4, ny - e * 0.1, e * 0.45, e * 0.24, 0, 0, TAU);
    }
    ctx.fill();
    // terminador: crescente à direita-baixo (luz de cima-esquerda) = disco menos círculo deslocado
    ctx.fillStyle = D.oceano2_6;
    ctx.beginPath();
    ctx.rect(-R, -R, R * 2, R * 2);
    ctx.moveTo(-R * 0.45 + R * 1.02, -R * 0.1);
    ctx.arc(-R * 0.45, -R * 0.1, R * 1.02, 0, TAU, true);
    ctx.fill("evenodd");
    // brilho de borda no lado iluminado
    ctx.strokeStyle = D.ink12;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, R - 1.5, Math.PI * 0.95, Math.PI * 1.55);
    ctx.stroke();
    ctx.restore();
  }
}

/* ===================================================================================== */
/* 2 · SISTEMA: Sol no centro, órbitas pontilhadas, enxame de Dyson, planetas, cinturão   */
/* ===================================================================================== */

interface VagaSistema extends Vaga {
  anel: number;
  a0: number;
  a1: number;
}

interface Anel {
  ro: number;
  contorno: Path2D;
}

/** [órbita, raio, cor, ângulo inicial, velocidade angular rad/s]; metade escurecida, anel no 4º. */
interface PlanetaOrbital {
  ro: number;
  r: number;
  cor: string;
  a0: number;
  v: number;
  atual?: boolean;
  anel?: boolean;
}

class Sistema implements Tabuleiro {
  readonly RS = 70;
  readonly orbitas = [130, 175, 225, 275, 330];
  readonly vagas: VagaSistema[] = [];
  readonly ordem: number[];
  readonly placasBloq: readonly [number, number];
  readonly aneis: Anel[] = [];
  readonly planetas: PlanetaOrbital[];
  readonly atual: PlanetaOrbital;
  readonly cinturao = new Path2D();
  readonly raios = new Path2D();

  constructor() {
    const r = rnd(SEED + 5);
    // enxame de Dyson: UM anel de 12 arcos de 28° (6 px de espessura) na órbita 130; a 175 fica só a linha tracejada
    {
      const ro = 130;
      const n = 12;
      const contorno = new Path2D();
      const passo = TAU / n;
      const folga = 2 * RAD;
      const meia = 3;
      for (let i = 0; i < n; i++) {
        const a0 = i * passo + folga / 2;
        const a1 = (i + 1) * passo - folga / 2;
        const am = (a0 + a1) / 2;
        contorno.moveTo(Math.cos(a0) * (ro + meia), Math.sin(a0) * (ro + meia));
        contorno.arc(0, 0, ro + meia, a0, a1);
        contorno.lineTo(Math.cos(a1) * (ro - meia), Math.sin(a1) * (ro - meia));
        contorno.arc(0, 0, ro - meia, a1, a0, true);
        contorno.closePath();
        this.vagas.push({ x: Math.cos(am) * ro, y: Math.sin(am) * ro, r: meia + 2, anel: ro, a0, a1, estado: "bloqueada" });
      }
      this.aneis.push({ ro, contorno });
    }
    this.planetas = [
      { ro: 225, r: 12, cor: P.rocha2, a0: 1.2, v: 0.06 },
      { ro: 275, r: 16, cor: P.rocha, a0: 4.1, v: 0.045 },
      { ro: 275, r: 20, cor: P.sky, a0: 5.6, v: 0.045, atual: true },
      { ro: 330, r: 24, cor: P.gold, a0: 2.6, v: 0.03, anel: true },
    ];
    this.atual = this.planetas[2];
    // cinturão: 400 pontos r ≈ 1 em r 300 ± 12
    for (let i = 0; i < 400; i++) {
      const a = r() * TAU;
      const d = 300 + (r() - 0.5) * 24;
      circulo(this.cinturao, Math.cos(a) * d, Math.sin(a) * d, 0.7 + r() * 0.6);
    }
    // 12 raios 3×22 a partir de 1,08·RS (Path2D girado por quadro)
    const RS = this.RS;
    for (let i = 0; i < 12; i++) {
      const a = (i * TAU) / 12;
      const c0 = Math.cos(a);
      const s0 = Math.sin(a);
      const nx = -s0 * 1.5;
      const ny = c0 * 1.5;
      const r0 = RS * 1.08;
      const r1 = r0 + 22;
      this.raios.moveTo(c0 * r0 + nx, s0 * r0 + ny);
      this.raios.lineTo(c0 * r1 + nx * 0.3, s0 * r1 + ny * 0.3);
      this.raios.lineTo(c0 * r1 - nx * 0.3, s0 * r1 - ny * 0.3);
      this.raios.lineTo(c0 * r0 - nx, s0 * r0 - ny);
      this.raios.closePath();
    }
    // ordem das placas: vagas mais próximas do planeta atual no t = 0
    const ax = Math.cos(this.atual.a0) * this.atual.ro;
    const ay = Math.sin(this.atual.a0) * this.atual.ro;
    const vs = this.vagas;
    this.ordem = vs.map((_, i) => i).sort((i, j) => Math.hypot(vs[i].x - ax, vs[i].y - ay) - Math.hypot(vs[j].x - ax, vs[j].y - ay));
    // duas placas no anel: a vaga mais perto do planeta atual e a mais afastada dela (lados opostos, sem cobrir o Sol)
    const i1 = this.ordem[0];
    const a = vs[i1];
    let i2 = i1;
    let dm = -1;
    vs.forEach((v, i) => {
      const d = Math.hypot(v.x - a.x, v.y - a.y);
      if (d > dm) {
        dm = d;
        i2 = i;
      }
    });
    this.placasBloq = [i1, i2];
  }

  marcador(ta: number, out: Vec): void {
    const p = this.atual;
    const a = p.a0 + ta * p.v;
    out[0] = Math.cos(a) * p.ro;
    out[1] = Math.sin(a) * p.ro;
  }

  desenhar(ctx: CanvasRenderingContext2D, z: number, ta: number, _t: number, reduzido: boolean): void {
    const RS = this.RS;
    // coroa inteira em 'lighter': gold α .25/.12/.05 a 1,3r/1,8r/2,3r, respirando; o fundo quente (nebOuro) é do Fundo
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const resp = reduzido ? 1 : 1 + 0.04 * Math.sin(ta * Math.PI);
    ctx.fillStyle = D.gold05;
    ctx.beginPath();
    ctx.arc(0, 0, RS * 2.3 * resp, 0, TAU);
    ctx.fill();
    ctx.fillStyle = D.gold12;
    ctx.beginPath();
    ctx.arc(0, 0, RS * 1.8 * resp, 0, TAU);
    ctx.fill();
    ctx.fillStyle = D.gold25;
    ctx.beginPath();
    ctx.arc(0, 0, RS * 1.3 * resp, 0, TAU);
    ctx.fill();
    ctx.restore();
    // 12 raios a 1°/s
    ctx.save();
    ctx.rotate(ta * RAD);
    ctx.fillStyle = D.gold6;
    ctx.fill(this.raios);
    ctx.restore();
    ctx.strokeStyle = D.sun35;
    ctx.lineWidth = 1.5 / z;
    ctx.beginPath();
    ctx.arc(0, 0, RS * 1.5, 0, TAU);
    ctx.stroke();
    ctx.setLineDash(TRACO_ORBITA);
    ctx.lineDashOffset = (-ta * 6) / z;
    ctx.strokeStyle = D.sun3;
    ctx.lineWidth = 1.25 / z;
    ctx.beginPath();
    ctx.arc(0, 0, RS * 1.95, 0, TAU);
    ctx.stroke();
    // órbitas tracejadas [2,6] A(ion,.35) correndo (1 px de tela)
    ctx.strokeStyle = D.ion35;
    ctx.lineWidth = 1 / z;
    for (const ro of this.orbitas) {
      ctx.lineDashOffset = (-ta * 4) / z;
      ctx.beginPath();
      ctx.arc(0, 0, ro, 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash(SEM_TRACO);
    // cinturão (gira devagar)
    ctx.save();
    ctx.rotate(ta * 0.004);
    ctx.fillStyle = D.muted45;
    ctx.fill(this.cinturao);
    ctx.restore();
    // enxame: um anel de 12 arcos de 28° a 6 px em A(ion,.4), contorno tracejado (bloqueadas); comprados em gold com losangos
    for (const an of this.aneis) {
      ctx.fillStyle = D.ion4;
      ctx.fill(an.contorno);
      ctx.setLineDash(TRACO_VAGA);
      ctx.lineWidth = 1 / z;
      ctx.strokeStyle = P.bordaBloqueio;
      ctx.stroke(an.contorno);
      ctx.setLineDash(SEM_TRACO);
    }
    for (const v of this.vagas) {
      if (v.estado !== "comprada") continue;
      ctx.beginPath();
      ctx.arc(0, 0, v.anel + 3, v.a0, v.a1);
      ctx.arc(0, 0, v.anel - 3, v.a1, v.a0, true);
      ctx.closePath();
      ctx.fillStyle = D.gold85;
      ctx.fill();
      ctx.lineWidth = 1 / z;
      ctx.strokeStyle = D.goldEsc;
      ctx.stroke();
      ctx.fillStyle = P.solMiolo;
      for (let a = v.a0 + 4 * RAD; a < v.a1; a += 8 * RAD) {
        const x = Math.cos(a) * v.anel;
        const y = Math.sin(a) * v.anel;
        ctx.beginPath();
        ctx.moveTo(x - 3, y);
        ctx.lineTo(x, y - 1.5);
        ctx.lineTo(x + 3, y);
        ctx.lineTo(x, y + 1.5);
        ctx.closePath();
        ctx.fill();
      }
    }
    // planetas (metade oposta ao Sol escurecida; anel de 2 px no quarto)
    for (const p of this.planetas) {
      const a = p.a0 + ta * p.v;
      const x = Math.cos(a) * p.ro;
      const y = Math.sin(a) * p.ro;
      if (p.anel) {
        ctx.strokeStyle = D.tanque75;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, y, p.r * 1.9, p.r * 0.55, -0.4, Math.PI * 0.95, Math.PI * 2.05);
        ctx.stroke();
      }
      ctx.fillStyle = p.cor;
      ctx.beginPath();
      ctx.arc(x, y, p.r, 0, TAU);
      ctx.fill();
      if (p.atual) {
        ctx.fillStyle = P.grama2;
        ctx.beginPath();
        ctx.ellipse(x - p.r * 0.3, y - p.r * 0.25, p.r * 0.42, p.r * 0.28, 0.6, 0, TAU);
        ctx.ellipse(x + p.r * 0.35, y + p.r * 0.3, p.r * 0.25, p.r * 0.18, -0.3, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = D.navy5;
      ctx.beginPath();
      ctx.arc(x, y, p.r, a - Math.PI / 2, a + Math.PI / 2);
      ctx.fill();
      if (p.anel) {
        ctx.strokeStyle = D.tanque75;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, y, p.r * 1.9, p.r * 0.55, -0.4, -Math.PI * 0.05, Math.PI * 0.95);
        ctx.stroke();
      }
      if (p.atual) {
        ctx.strokeStyle = D.ion5;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, p.r + 3, 0, TAU);
        ctx.stroke();
      }
    }
    // disco do Sol, miolo, 3 manchas
    ctx.fillStyle = P.sun;
    ctx.beginPath();
    ctx.arc(0, 0, RS, 0, TAU);
    ctx.fill();
    ctx.fillStyle = P.solMiolo;
    ctx.beginPath();
    ctx.arc(-RS * 0.08, -RS * 0.08, RS * 0.55, 0, TAU);
    ctx.fill();
    ctx.fillStyle = D.gold5;
    ctx.beginPath();
    ctx.ellipse(RS * 0.45, RS * 0.35, RS * 0.16, RS * 0.11, 0.5, 0, TAU);
    ctx.moveTo(-RS * 0.5 + RS * 0.11, RS * 0.48);
    ctx.ellipse(-RS * 0.5, RS * 0.48, RS * 0.11, RS * 0.08, -0.4, 0, TAU);
    ctx.moveTo(RS * 0.2 + RS * 0.09, -RS * 0.62);
    ctx.ellipse(RS * 0.2, -RS * 0.62, RS * 0.09, RS * 0.07, 0.2, 0, TAU);
    ctx.fill();
  }
}

/* ===================================================================================== */
/* 3 · GALÁXIA: espiral logarítmica de dois braços (void / ion) feita de pontos; sistemas como vagas */
/* ===================================================================================== */

interface VagaGalaxia extends Vaga {
  braco: number;
  k: number;
}

class Galaxia implements Tabuleiro {
  readonly vagas: VagaGalaxia[] = [];
  readonly ordem: number[];
  readonly placasBloq: readonly [number, number];
  readonly fitas: Path2D[] = [];
  readonly discosVoid = new Path2D();
  readonly discosIon = new Path2D();
  readonly estrelas: readonly [Path2D, Path2D, Path2D] = [new Path2D(), new Path2D(), new Path2D()];
  readonly aglomerados = new Path2D();
  readonly poeira = new Path2D();
  readonly atual: VagaGalaxia;
  private readonly atualIndice: number;

  constructor() {
    const r = rnd(SEED + 7);
    const TH = 3.6 * Math.PI;
    const esp = (th: number): number => 30 * Math.exp(0.2 * th);
    const meiaLarg = (u: number): number => 12 + 20 * u;
    // fita afilada (vai a 0 nas duas pontas): meia(u) = (12 + 20u)·sin(πu)^0,5; só um leve fundo α .15 sob os discos
    const meia = (u: number): number => meiaLarg(u) * Math.sqrt(Math.sin(Math.PI * u));
    for (let b = 0; b < 2; b++) {
      const fase = b * Math.PI;
      const fita = new Path2D();
      const N = 90;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const th = u * TH;
        const rr = esp(th) + meia(u);
        const a = th + fase;
        if (i) fita.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else fita.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      for (let i = N; i >= 0; i--) {
        const u = i / N;
        const th = u * TH;
        const rr = Math.max(4, esp(th) - meia(u));
        const a = th + fase;
        fita.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      fita.closePath();
      this.fitas.push(fita);
    }
    // braços (direção §8): 80 discos por braço, r 6 → 14, alternando void / ion, compostos em 'lighter' α .35
    for (let b = 0; b < 2; b++) {
      const fase = b * Math.PI;
      for (let i = 0; i < 80; i++) {
        const u = i / 79;
        const th = u * TH;
        const rr = esp(th) + (r() - 0.5) * meiaLarg(u) * 0.6;
        const a = th + fase + (r() - 0.5) * 0.04;
        circulo(i % 2 ? this.discosIon : this.discosVoid, Math.cos(a) * rr, Math.sin(a) * rr, (6 + 8 * u) * Math.sqrt(Math.sin(Math.PI * u) * 0.6 + 0.4));
      }
    }
    // 400 estrelas r 0,8–1,6 ao longo das fitas com ruído; 12 aglomerados r 8–14
    for (let b = 0; b < 2; b++) {
      const fase = b * Math.PI;
      for (let i = 0; i < 200; i++) {
        const u = Math.pow(r(), 0.85);
        const th = u * TH;
        const rr = esp(th) + (r() - 0.5) * 2 * meia(u) * 1.1;
        const a = th + fase + (r() - 0.5) * 0.05;
        circulo(this.estrelas[i % 3], Math.cos(a) * rr, Math.sin(a) * rr, 0.8 + r() * 0.8);
      }
      for (let i = 0; i < 6; i++) {
        const u = 0.15 + r() * 0.8;
        const th = u * TH;
        const rr = esp(th) + (r() - 0.5) * meia(u);
        const a = th + fase;
        circulo(this.aglomerados, Math.cos(a) * rr, Math.sin(a) * rr, 8 + r() * 6);
      }
      // 12 vagas por braço, sobre a linha central da espiral
      for (let k = 0; k < 12; k++) {
        const th = (0.1 + k * 0.075) * TH;
        const rr = esp(th);
        const a = th + fase;
        this.vagas.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr, r: 9, estado: "bloqueada", braco: b, k });
      }
    }
    // halo de estrelas esparsas do disco
    for (let i = 0; i < 160; i++) {
      const a = r() * TAU;
      const d = Math.sqrt(r()) * 300;
      circulo(this.estrelas[2], Math.cos(a) * d, Math.sin(a) * d, 0.6 + r() * 0.8);
    }
    // poeira: 40 discos fundoGalaxia α .4 sobre os braços
    for (let i = 0; i < 40; i++) {
      const b = i % 2;
      const u = 0.2 + r() * 0.7;
      const th = u * TH;
      const rr = esp(th) + (r() - 0.5) * meiaLarg(u);
      const a = th + b * Math.PI;
      circulo(this.poeira, Math.cos(a) * rr, Math.sin(a) * rr, 4 + r() * 6);
    }
    this.atualIndice = 7;
    this.atual = this.vagas[this.atualIndice];
    this.atual.estado = "atual";
    this.ordem = ordenarPorDistancia(this.vagas, this.atual);
    this.placasBloq = escolherPlacas(this.vagas, this.ordem);
  }

  /** 0,3°/s. */
  rot(ta: number): number {
    return ta * RAD * 0.3;
  }

  posVaga(i: number, ta: number, out: Vec): void {
    const v = this.vagas[i];
    const c = Math.cos(this.rot(ta));
    const s = Math.sin(this.rot(ta));
    out[0] = v.x * c - v.y * s;
    out[1] = v.x * s + v.y * c;
  }

  marcador(ta: number, out: Vec): void {
    this.posVaga(this.atualIndice, ta, out);
  }

  /** Só os braços (discos) e o bojo, para as miniaturas do multiverso. */
  silhueta(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = D.void35;
    ctx.fill(this.discosVoid);
    ctx.fillStyle = D.ion3;
    ctx.fill(this.discosIon);
    ctx.restore();
    ctx.fillStyle = P.gold;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, TAU);
    ctx.fill();
  }

  desenhar(ctx: CanvasRenderingContext2D, z: number, ta: number, t: number, reduzido: boolean): void {
    ctx.save();
    ctx.rotate(this.rot(ta));
    // halo chapado do disco + fita afilada bem fraca (α .15) + os braços de discos em 'lighter'
    ctx.fillStyle = D.void06;
    ctx.beginPath();
    ctx.arc(0, 0, 310, 0, TAU);
    ctx.fill();
    ctx.fillStyle = D.void15;
    for (const f of this.fitas) ctx.fill(f);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = D.void35;
    ctx.fill(this.discosVoid);
    ctx.fillStyle = D.ion28;
    ctx.fill(this.discosIon);
    ctx.restore();
    // poeira escura sobre os braços
    ctx.fillStyle = D.poeira;
    ctx.fill(this.poeira);
    // estrelas em 3 baldes de opacidade; aglomerados em lighter
    ctx.fillStyle = D.ink9;
    ctx.fill(this.estrelas[0]);
    ctx.fillStyle = D.ink6;
    ctx.fill(this.estrelas[1]);
    ctx.fillStyle = D.ink35;
    ctx.fill(this.estrelas[2]);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = D.ion22;
    ctx.fill(this.aglomerados);
    ctx.restore();
    // bojo em 'lighter': gold α .05/.12/.25 (r 90/64/40) e miolo opaco (r 22/11)
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = D.gold05;
    ctx.beginPath();
    ctx.arc(0, 0, 90, 0, TAU);
    ctx.fill();
    ctx.fillStyle = D.gold12;
    ctx.beginPath();
    ctx.arc(0, 0, 64, 0, TAU);
    ctx.fill();
    ctx.fillStyle = D.gold25;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = D.goldMiolo;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, TAU);
    ctx.fill();
    ctx.fillStyle = P.solMiolo;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, TAU);
    ctx.fill();
    // vagas (sistemas): ponto ink r 2,5 + anel tracejado [3,4] r 8 A(ink,.35), sem preenchimento; comprada ion α .85; atual = estrela viva
    ctx.setLineDash(TRACO_FINO);
    ctx.lineWidth = 1 / z;
    ctx.strokeStyle = D.ink35;
    ctx.beginPath();
    for (const v of this.vagas) {
      if (v.estado !== "bloqueada") continue;
      ctx.moveTo(v.x + 8, v.y);
      ctx.arc(v.x, v.y, 8, 0, TAU);
    }
    ctx.stroke();
    ctx.setLineDash(SEM_TRACO);
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    for (const v of this.vagas) {
      if (v.estado !== "bloqueada") continue;
      ctx.moveTo(v.x + 2.5, v.y);
      ctx.arc(v.x, v.y, 2.5, 0, TAU);
    }
    ctx.fill();
    for (const v of this.vagas) {
      if (v.estado === "comprada") vagaComprada(ctx, z, v.x, v.y, v.r, P.ion, t, v.t0, reduzido);
      else if (v.estado === "atual") {
        ctx.fillStyle = D.sun35;
        ctx.beginPath();
        ctx.arc(v.x, v.y, v.r + 3, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

/* ===================================================================================== */
/* 4 · UNIVERSO: teia cósmica, filamentos ion ligando nós, vazios escuros, galáxias como vagas */
/* ===================================================================================== */

interface No {
  x: number;
  y: number;
  r: number;
  vaga: boolean;
  pulsa: boolean;
  fase: number;
}

interface Vazio {
  x: number;
  y: number;
  r: number;
}

interface VagaUniverso extends Vaga {
  no: No;
}

class Universo implements Tabuleiro {
  readonly vagas: VagaUniverso[] = [];
  readonly ordem: number[];
  readonly placasBloq: readonly [number, number];
  readonly vazios: Vazio[] = [];
  readonly nos: No[] = [];
  readonly ligacoes = new Path2D();
  readonly aglomerados = new Path2D();
  readonly pNos = new Path2D();
  readonly pHalos = new Path2D();
  readonly pHalos2 = new Path2D();
  readonly miniEspiral = new Path2D();
  readonly atual: VagaUniverso;

  constructor() {
    const r = rnd(SEED + 11);
    const R = 300;
    // 6 vazios (sem nós dentro)
    for (let i = 0; i < 6; i++) {
      let x = 0;
      let y = 0;
      let rv = 0;
      let ok = false;
      for (let tent = 0; tent < 80 && !ok; tent++) {
        const a = r() * TAU;
        const d = Math.sqrt(r()) * R * 0.8;
        x = Math.cos(a) * d;
        y = Math.sin(a) * d;
        rv = 34 + r() * 26;
        ok = true;
        for (const v of this.vazios) {
          if (Math.hypot(v.x - x, v.y - y) < v.r + rv + 36) {
            ok = false;
            break;
          }
        }
      }
      this.vazios.push({ x, y, r: rv });
    }
    // 44 nós fora dos vazios, separados de ≥ 30
    const nos = this.nos;
    for (let i = 0; i < 44; i++) {
      let x = 0;
      let y = 0;
      let ok = false;
      for (let tent = 0; tent < 200 && !ok; tent++) {
        const a = r() * TAU;
        const d = Math.sqrt(r()) * R;
        x = Math.cos(a) * d;
        y = Math.sin(a) * d;
        ok = true;
        for (const v of this.vazios) {
          if (Math.hypot(v.x - x, v.y - y) < v.r + 8) {
            ok = false;
            break;
          }
        }
        if (ok) {
          for (const n of nos) {
            if (Math.hypot(n.x - x, n.y - y) < 30) {
              ok = false;
              break;
            }
          }
        }
      }
      const rn = 3 + r() * 4;
      const fase = r() * TAU;
      nos.push({ x, y, r: rn, vaga: false, pulsa: false, fase });
    }
    // 16 vagas (galáxias) entre os nós; 3 nós pulsam
    for (let k = 0; k < 16; k++) {
      const n = nos[Math.floor(k * 2.75) % 44];
      n.vaga = true;
      n.r = 7;
      this.vagas.push({ x: n.x, y: n.y, r: 7, estado: "bloqueada", no: n });
    }
    for (let k = 0; k < 3; k++) {
      const n = nos[(6 + k * 15) % 44];
      if (!n.vaga) n.pulsa = true;
    }
    // ligações: cada nó com os 3 mais próximos; quadráticas com controle perpendicular; 6–10 "aglomerados" r 1 ao longo de cada curva
    const chaves = new Set<number>();
    const lig = this.ligacoes;
    const agl = this.aglomerados;
    for (let i = 0; i < nos.length; i++) {
      const ordem: [number, number][] = nos
        .map((n, j): [number, number] => [Math.hypot(n.x - nos[i].x, n.y - nos[i].y), j])
        .filter((p) => p[1] !== i)
        .sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < 3; k++) {
        const j = ordem[k][1];
        const key = Math.min(i, j) * 64 + Math.max(i, j);
        if (chaves.has(key)) continue;
        chaves.add(key);
        const a = nos[i];
        const b = nos[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const px = -dy / d;
        const py = dx / d;
        const k2 = (r() - 0.5) * d * 0.45;
        const cx = (a.x + b.x) / 2 + px * k2;
        const cy = (a.y + b.y) / 2 + py * k2;
        lig.moveTo(a.x, a.y);
        lig.quadraticCurveTo(cx, cy, b.x, b.y);
        const np = 6 + Math.floor(r() * 5);
        for (let q = 1; q <= np; q++) {
          const u = q / (np + 1) + (r() - 0.5) * 0.04;
          const m = 1 - u;
          const qx = m * m * a.x + 2 * m * u * cx + u * u * b.x + (r() - 0.5) * 4;
          const qy = m * m * a.y + 2 * m * u * cy + u * u * b.y + (r() - 0.5) * 4;
          circulo(agl, qx, qy, 0.8 + r() * 0.6);
        }
      }
    }
    // nós e halos em Path2D (os que pulsam ficam de fora, desenhados por quadro); halos em 2 degraus (2,5× e 4×)
    for (const n of nos) {
      if (n.vaga || n.pulsa) continue;
      circulo(this.pNos, n.x, n.y, n.r);
      circulo(this.pHalos, n.x, n.y, n.r * 2.5);
      circulo(this.pHalos2, n.x, n.y, n.r * 4);
    }
    // mini-espiral (2 braços) para dentro das vagas
    const me = this.miniEspiral;
    for (let b = 0; b < 2; b++) {
      for (let i = 0; i <= 24; i++) {
        const th = (i / 24) * 2.6 * Math.PI;
        const rr = 0.55 * Math.exp(0.33 * th);
        const a = th + b * Math.PI;
        if (i === 0) me.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else me.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
    }
    this.atual = this.vagas[6];
    this.atual.estado = "atual";
    this.ordem = ordenarPorDistancia(this.vagas, this.atual);
    this.placasBloq = escolherPlacas(this.vagas, this.ordem);
  }

  marcador(_ta: number, out: Vec): void {
    out[0] = this.atual.x;
    out[1] = this.atual.y;
  }

  /** Filamentos + nós (sem vagas), para as miniaturas do multiverso. */
  silhueta(ctx: CanvasRenderingContext2D, z: number): void {
    ctx.lineCap = "round";
    ctx.strokeStyle = D.ion45;
    ctx.lineWidth = 1.5 / z;
    ctx.stroke(this.ligacoes);
    ctx.fillStyle = P.ion;
    ctx.fill(this.pNos);
  }

  desenhar(ctx: CanvasRenderingContext2D, z: number, ta: number, t: number, reduzido: boolean): void {
    // vazios sem preenchimento: a ausência de filamentos diz
    // filamentos: 2 traços (8 px A(ion,.10) + 1,5 px A(ion,.45)) com aglomerados r 1 ao longo das curvas
    ctx.lineCap = "round";
    ctx.strokeStyle = D.ion1;
    ctx.lineWidth = 8 / z;
    ctx.stroke(this.ligacoes);
    ctx.strokeStyle = D.ion45;
    ctx.lineWidth = 1.5 / z;
    ctx.stroke(this.ligacoes);
    ctx.fillStyle = D.ink7;
    ctx.fill(this.aglomerados);
    // halos em 2 degraus (lighter) e nós
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = D.ion1;
    ctx.fill(this.pHalos2);
    ctx.fillStyle = D.ion3;
    ctx.fill(this.pHalos);
    ctx.restore();
    ctx.fillStyle = P.ion;
    ctx.fill(this.pNos);
    for (const n of this.nos) {
      if (!n.pulsa) continue;
      const e = 1 + 0.18 * Math.sin(ta * 2 + n.fase);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = D.ion1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * 4 * e, 0, TAU);
      ctx.fill();
      ctx.fillStyle = D.ion3;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * 2.5 * e, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = P.ion;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * e, 0, TAU);
      ctx.fill();
    }
    // vagas (galáxias): tracejado + mini-espiral void 1 px
    for (const v of this.vagas) {
      if (v.estado === "bloqueada") vagaBloqueada(ctx, z, v.x, v.y, v.r);
      else if (v.estado === "comprada") vagaComprada(ctx, z, v.x, v.y, v.r, P.ion, t, v.t0, reduzido);
      else {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = D.ion35;
        ctx.beginPath();
        ctx.arc(v.x, v.y, v.r * 2.2, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = D.ion5;
        ctx.beginPath();
        ctx.arc(v.x, v.y, v.r, 0, TAU);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.rotate(v.no.fase + (v.estado === "atual" ? ta * 0.3 : 0));
      ctx.strokeStyle = v.estado === "atual" ? P.ink : P.void;
      ctx.lineWidth = 1 / z;
      ctx.stroke(this.miniEspiral);
      ctx.restore();
    }
  }
}

/* ===================================================================================== */
/* 5 · MULTIVERSO: bolhas translúcidas (plasma/void) de tamanhos variados ligadas por pontes finas */
/* ===================================================================================== */

type Miniatura = "espiral" | "teia" | "planeta" | "sistema";
const MINIATURAS: readonly Miniatura[] = ["espiral", "teia", "planeta", "sistema"];

interface Bolha {
  x: number;
  y: number;
  r: number;
  /** 12 pontos ion dentro (Path2D local). */
  pts: Path2D;
  fase: number;
  tom: string;
  /** Flutuação do quadro (±4 px) e respiração (±2 %). */
  dx: number;
  dy: number;
  e: number;
}

interface Ponte {
  a: Bolha;
  b: Bolha;
  curva: number;
  fase: number;
}

interface VagaMultiverso extends Vaga {
  bolha: Bolha;
  mini: Miniatura;
}

class Multiverso implements Tabuleiro {
  readonly vagas: VagaMultiverso[] = [];
  readonly ordem: number[];
  readonly placasBloq: readonly [number, number];
  readonly bolhas: Bolha[] = [];
  readonly pontes: Ponte[] = [];
  readonly atual: VagaMultiverso;
  private readonly atualIndice: number;
  /** Miniaturas (15 %) para cada bolha dizer "universo": espiral, teia, planeta, sistema, em ciclo. */
  private readonly galaxia: Galaxia;
  private readonly universo: Universo;
  private readonly planeta: Planeta;

  constructor() {
    const r = rnd(SEED + 13);
    const R = 300;
    const raios = [104, 90, 82, 72, 66, 58, 52, 46, 40];
    const bolhas = this.bolhas;
    raios.forEach((raio, i) => {
      let rb = raio;
      let x = 0;
      let y = 0;
      let ok = false;
      // colocação por rejeição; se não couber em 300 tentativas, encolhe 8 % e tenta de novo
      while (!ok) {
        for (let tent = 0; tent < 300 && !ok; tent++) {
          const a = r() * TAU;
          const d = r() * (R - rb);
          x = Math.cos(a) * d;
          y = Math.sin(a) * d;
          ok = true;
          for (const b of bolhas) {
            if (Math.hypot(b.x - x, b.y - y) < b.r + rb + 18) {
              ok = false;
              break;
            }
          }
        }
        if (!ok) rb *= 0.92;
      }
      const pts = new Path2D();
      for (let k = 0; k < 12; k++) {
        const a = r() * TAU;
        const d = Math.sqrt(r()) * rb * 0.8;
        circulo(pts, Math.cos(a) * d, Math.sin(a) * d, 1.2 + r() * 1.3);
      }
      const fase = r() * TAU;
      bolhas.push({ x, y, r: rb, pts, fase, tom: i % 3 === 2 ? P.void : P.plasma, dx: 0, dy: 0, e: 1 });
    });
    // pontes: cada bolha liga às 2 mais próximas (sem repetir)
    const chaves = new Set<number>();
    bolhas.forEach((b, i) => {
      const ordem: [number, number][] = bolhas
        .map((o, j): [number, number] => [Math.hypot(o.x - b.x, o.y - b.y), j])
        .filter((p) => p[1] !== i)
        .sort((a, c) => a[0] - c[0]);
      for (let k = 0; k < 2; k++) {
        const j = ordem[k][1];
        const key = Math.min(i, j) * 16 + Math.max(i, j);
        if (chaves.has(key)) continue;
        chaves.add(key);
        const curva = (r() - 0.5) * 0.5;
        const fase = r();
        this.pontes.push({ a: b, b: bolhas[j], curva, fase });
      }
    });
    // vagas = bolhas; a atual ganha a teia em miniatura
    bolhas.forEach((b, i) => this.vagas.push({ x: b.x, y: b.y, r: b.r, estado: "bloqueada", bolha: b, mini: MINIATURAS[i % 4] }));
    this.atualIndice = 2;
    this.atual = this.vagas[this.atualIndice];
    this.atual.estado = "atual";
    this.ordem = ordenarPorDistancia(this.vagas, this.atual);
    this.placasBloq = escolherPlacas(this.vagas, this.ordem);
    this.universo = obterUniverso();
    this.galaxia = obterGalaxia();
    this.planeta = obterPlaneta();
  }

  private miniatura(ctx: CanvasRenderingContext2D, z: number, tipo: Miniatura, rb: number): void {
    const e = (rb / 300) * 0.15 * 5; // 15 % da bolha ≈ forma-mãe (raio 300) reduzida
    ctx.save();
    ctx.scale(e, e);
    if (tipo === "espiral") this.galaxia.silhueta(ctx);
    else if (tipo === "teia") this.universo.silhueta(ctx, z * e);
    else if (tipo === "planeta") {
      ctx.fillStyle = P.oceano;
      ctx.beginPath();
      ctx.arc(0, 0, 300, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, 300, 0, TAU);
      ctx.clip();
      ctx.fillStyle = P.grama2;
      for (const c of this.planeta.continentes) {
        ctx.save();
        ctx.translate(c.cx, c.cy);
        ctx.rotate(c.rot);
        ctx.fill(c.path);
        ctx.restore();
      }
      ctx.restore();
      ctx.strokeStyle = D.ion5;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(0, 0, 306, 0, TAU);
      ctx.stroke();
    } else {
      ctx.fillStyle = P.sun;
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = D.ion5;
      ctx.lineWidth = 4 / e / z;
      for (const ro of [130, 225, 330]) {
        ctx.beginPath();
        ctx.arc(0, 0, ro, 0, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = P.sky;
      ctx.beginPath();
      ctx.arc(225, 0, 20, 0, TAU);
      ctx.fill();
      ctx.fillStyle = P.gold;
      ctx.beginPath();
      ctx.arc(-233, 233, 24, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Flutuação lenta (±4 px em ~20 s) e respiração ±2 % em 4 s. */
  private mover(ta: number): void {
    for (const b of this.bolhas) {
      b.dx = Math.sin(ta * 0.31 + b.fase) * 4;
      b.dy = Math.cos(ta * 0.23 + b.fase * 1.7) * 4;
      b.e = 1 + 0.02 * Math.sin((ta * TAU) / 4 + b.fase);
    }
  }

  posVaga(i: number, ta: number, out: Vec): void {
    const b = this.vagas[i].bolha;
    out[0] = b.x + Math.sin(ta * 0.31 + b.fase) * 4;
    out[1] = b.y + Math.cos(ta * 0.23 + b.fase * 1.7) * 4;
  }

  marcador(ta: number, out: Vec): void {
    this.posVaga(this.atualIndice, ta, out);
  }

  desenhar(ctx: CanvasRenderingContext2D, z: number, ta: number): void {
    this.mover(ta);
    // pontes: quadráticas em 2 degraus (5 px α .12 + 1,5 px α .5) entre as bordas, com 3 pontos correndo a 0,2/s
    ctx.lineCap = "round";
    ctx.fillStyle = P.ion;
    for (const p of this.pontes) {
      const ax = p.a.x + p.a.dx;
      const ay = p.a.y + p.a.dy;
      const bx = p.b.x + p.b.dx;
      const by = p.b.y + p.b.dy;
      const dx = bx - ax;
      const dy = by - ay;
      const d = Math.hypot(dx, dy);
      const ux = dx / d;
      const uy = dy / d;
      const x0 = ax + ux * p.a.r * p.a.e;
      const y0 = ay + uy * p.a.r * p.a.e;
      const x1 = bx - ux * p.b.r * p.b.e;
      const y1 = by - uy * p.b.r * p.b.e;
      const cx = (x0 + x1) / 2 - uy * d * p.curva;
      const cy = (y0 + y1) / 2 + ux * d * p.curva;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.lineWidth = 5 / z;
      ctx.strokeStyle = D.plasma12;
      ctx.stroke();
      ctx.lineWidth = 1.5 / z;
      ctx.strokeStyle = D.plasma5;
      ctx.stroke();
      for (let k = 0; k < 3; k++) {
        const u = frac(ta * 0.2 + p.fase + k / 3);
        const m = 1 - u;
        const px = m * m * x0 + 2 * m * u * cx + u * u * x1;
        const py = m * m * y0 + 2 * m * u * cy + u * u * y1;
        ctx.beginPath();
        ctx.arc(px, py, 2 / z, 0, TAU);
        ctx.fill();
      }
    }
    // bolhas
    for (const v of this.vagas) {
      const b = v.bolha;
      const x = b.x + b.dx;
      const y = b.y + b.dy;
      const rb = b.r * b.e;
      const atual = v.estado === "atual";
      const tom = atual ? P.sun : b.tom;
      ctx.fillStyle = alfa(b.tom, atual ? 0.22 : 0.16);
      ctx.beginPath();
      ctx.arc(x, y, rb, 0, TAU);
      ctx.fill();
      // conteúdo: a bolha atual leva a teia a 92 %; as outras, uma miniatura própria a 15 % (espiral, teia, planeta, sistema)
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, rb, 0, TAU);
      ctx.clip();
      ctx.translate(x, y);
      if (atual) {
        const e = (rb / 300) * 0.92;
        ctx.scale(e, e);
        ctx.strokeStyle = D.ion4;
        ctx.lineWidth = 1.5 / (z * e);
        ctx.stroke(this.universo.ligacoes);
        ctx.fillStyle = P.ion;
        ctx.fill(this.universo.pNos);
      } else {
        ctx.globalAlpha = 0.75;
        this.miniatura(ctx, z, v.mini, rb);
      }
      ctx.restore();
      // pontos ion dentro
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(b.e, b.e);
      ctx.fillStyle = D.ion8;
      ctx.fill(b.pts);
      ctx.restore();
      // borda 2 px de tela (tracejada quando bloqueada) + anel interno 1 px a 0,9R; reflexo arco 60° em cima-esquerda
      if (v.estado === "bloqueada") ctx.setLineDash(TRACO_VAGA);
      ctx.strokeStyle = alfa(tom, atual ? 0.9 : 0.6);
      ctx.lineWidth = 2 / z;
      ctx.beginPath();
      ctx.arc(x, y, rb, 0, TAU);
      ctx.stroke();
      ctx.setLineDash(SEM_TRACO);
      ctx.strokeStyle = alfa(tom, 0.3);
      ctx.lineWidth = 1 / z;
      ctx.beginPath();
      ctx.arc(x, y, rb * 0.9, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = D.cristal35;
      ctx.lineWidth = 3 / z;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(x, y, rb - 5 / z, Math.PI * 1.1, Math.PI * 1.43);
      ctx.stroke();
    }
  }
}

/* ------------------------------------------------------------------ */
/* Instâncias preguiçosas (geometria montada na primeira chamada)      */
/* ------------------------------------------------------------------ */

let planeta: Planeta | null = null;
let sistema: Sistema | null = null;
let galaxia: Galaxia | null = null;
let universo: Universo | null = null;
let multiverso: Multiverso | null = null;

function obterPlaneta(): Planeta {
  planeta ??= new Planeta();
  return planeta;
}
function obterSistema(): Sistema {
  sistema ??= new Sistema();
  return sistema;
}
function obterGalaxia(): Galaxia {
  galaxia ??= new Galaxia();
  return galaxia;
}
function obterUniverso(): Universo {
  universo ??= new Universo();
  return universo;
}
function obterMultiverso(): Multiverso {
  multiverso ??= new Multiverso();
  return multiverso;
}

function tabuleiroDe(id: NivelId): Tabuleiro | null {
  switch (id) {
    case "planeta":
      return obterPlaneta();
    case "sistema":
      return obterSistema();
    case "galaxia":
      return obterGalaxia();
    case "universo":
      return obterUniverso();
    case "multiverso":
      return obterMultiverso();
    default:
      return null;
  }
}

/** Posição de mundo da vaga `i` no instante `ta`. */
function posicaoVaga(tab: Tabuleiro, i: number, ta: number, out: Vec): void {
  if (tab.posVaga) tab.posVaga(i, ta, out);
  else {
    const v = tab.vagas[i];
    out[0] = v.x;
    out[1] = v.y;
  }
}

/* ------------------------------------------------------------------ */
/* Elementos em px de tela: placas, marcador, rótulo do nível          */
/* ------------------------------------------------------------------ */

/** Cache de measureText: chave fonte + texto. */
const larguras = new Map<string, number>();
function largura(ctx: CanvasRenderingContext2D, fonte: string, texto: string): number {
  const k = fonte + "|" + texto;
  let w = larguras.get(k);
  if (w === undefined) {
    ctx.font = fonte;
    w = ctx.measureText(texto).width;
    larguras.set(k, w);
  }
  return w;
}

/** Retângulos já ocupados na tela (rótulo do marcador + placas + reservas), para empurrar placas que colidem. */
const RETS = new Float64Array(16 * 4);
let nRets = 0;
function reservar(x: number, y: number, w: number, h: number): void {
  if (nRets >= 16) return;
  RETS[nRets * 4] = x;
  RETS[nRets * 4 + 1] = y;
  RETS[nRets * 4 + 2] = w;
  RETS[nRets * 4 + 3] = h;
  nRets++;
}

/** Devolve o y (topo) livre: sobe a caixa até não cruzar nenhum retângulo reservado (margem 8 px, até 6 passagens). */
function livre(x: number, y0: number, w: number, h: number): number {
  let y = y0;
  for (let passo = 0; passo < 6; passo++) {
    let bateu = false;
    for (let i = 0; i < nRets; i++) {
      const rx = RETS[i * 4];
      const ry = RETS[i * 4 + 1];
      const rw = RETS[i * 4 + 2];
      const rh = RETS[i * 4 + 3];
      if (x < rx + rw + 8 && x + w + 8 > rx && y < ry + rh + 8 && y + h + 8 > ry) {
        y = ry - h - 8;
        bateu = true;
      }
    }
    if (!bateu) break;
  }
  return y;
}

/**
 * Placa acima da vaga: (wx, wy) em mundo, `rTela` = raio da vaga em px de tela; (sx, sy) = posição em tela;
 * a caixa fica dentro da largura `W` da tela e é empurrada para cima se colidir com outra.
 */
function desenharPlaca(ctx: CanvasRenderingContext2D, z: number, wx: number, wy: number, rTela: number, texto: string, moeda: boolean, sx: number, sy: number, W: number): void {
  ctx.save();
  ctx.translate(wx, wy);
  ctx.scale(1 / z, 1 / z);
  const fonte = moeda ? FONTE_PRECO : FONTE_PLACA;
  const tw = largura(ctx, fonte, texto);
  const w = Math.max(84, Math.ceil(tw) + 20 + (moeda ? 22 : 0));
  const h = 28;
  let x = -w / 2;
  let y = -rTela - 12 - h;
  x += Math.max(0, 8 - (sx + x)) - Math.max(0, sx + x + w - (W - 8));
  y = livre(sx + x, sy + y, w, h) - sy;
  reservar(sx + x, sy + y, w, h);
  ctx.strokeStyle = D.muted8;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -rTela - 2);
  ctx.lineTo(0, y + h);
  ctx.stroke();
  retArred(ctx, x, y, w, h, 6);
  ctx.fillStyle = D.card92;
  ctx.fill();
  ctx.strokeStyle = P.cardBorda;
  ctx.stroke();
  let tx = x + 10;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  if (moeda) {
    ctx.fillStyle = P.sun;
    ctx.beginPath();
    ctx.arc(tx + 8, y + h / 2, 8, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = P.gold;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = P.navy;
    ctx.font = FONTE_MOEDA;
    ctx.textAlign = "center";
    ctx.fillText("₵", tx + 8, y + h / 2 + 0.5);
    ctx.textAlign = "left";
    tx += 22;
  }
  ctx.fillStyle = P.ink;
  ctx.font = fonte;
  ctx.fillText(texto, tx, y + h / 2 + 0.5);
  ctx.restore();
}

/** Marcador "você está aqui" (px de tela): ponto sun/gold, halo lighter, anel pulsante, rótulo com guia a 45°. */
function desenharMarcador(ctx: CanvasRenderingContext2D, z: number, wx: number, wy: number, t: number, rotulo: string, chegada: number | undefined, sx: number, sy: number, W: number, reduzido: boolean): void {
  ctx.save();
  ctx.translate(wx, wy);
  ctx.scale(1 / z, 1 / z);
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = D.sun25;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  const k = reduzido ? 0.35 : frac(t / 2);
  ctx.strokeStyle = alfa(P.sun, 0.8 * (1 - k));
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 8 + 6 * k, 0, TAU);
  ctx.stroke();
  if (chegada !== undefined && t - chegada < 0.5 && t >= chegada) {
    // pulso de chegada r 8 → 28 em 500 ms
    const q = (t - chegada) / 0.5;
    ctx.strokeStyle = alfa(P.sun, 0.9 * (1 - q));
    ctx.lineWidth = 2.5 * (1 - q) + 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, 8 + 20 * q, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = P.sun;
  ctx.strokeStyle = P.gold;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // guia 18 px a 45° para cima-direita (ou cima-esquerda se não couber na tela) + trecho horizontal + rótulo
  const tw = largura(ctx, FONTE_MARCADOR, rotulo);
  const lado = sx + 42 + tw > W - 8 ? -1 : 1;
  ctx.strokeStyle = D.muted9;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(4 * lado, -4);
  ctx.lineTo(16.7 * lado, -16.7);
  ctx.lineTo(28 * lado, -16.7);
  ctx.stroke();
  ctx.font = FONTE_MARCADOR;
  ctx.textBaseline = "middle";
  ctx.textAlign = lado > 0 ? "left" : "right";
  let bx = lado > 0 ? 30 : -30 - tw - 12;
  bx += Math.max(0, 8 - (sx + bx)) - Math.max(0, sx + bx + tw + 12 - (W - 8)); // dentro da tela
  ctx.fillStyle = D.navy55;
  retArred(ctx, bx, -26, tw + 12, 19, 5);
  ctx.fill();
  reservar(sx + bx, sy - 26, tw + 12, 19);
  reservar(sx - 20, sy - 20, 40, 40); // raio de 20 px em volta do ponto: nenhuma placa encosta no marcador
  ctx.fillStyle = P.ink;
  ctx.fillText(rotulo, lado > 0 ? bx + 6 : bx + tw + 6, -16.5);
  ctx.restore();
}

interface RotuloNivel {
  /** "Tipo II · Sistema · precisa de 10²⁶ W" (bloqueado) ou "Tipo I · Planeta". */
  rotulo: string;
  /** Forma curta, a mesma das placas: "Tipo II · precisa de 10²⁶ W". */
  placa: string;
  desbloqueado: boolean;
  cor: string;
}

/**
 * Rótulo do nível (px de tela, fora da câmera): canto inferior esquerdo no desktop, subindo se colidir com uma
 * reserva (controles/minimapa); no celular (w < 600) no topo esquerdo, em 26 px de altura e fonte 12.
 */
function desenharRotuloNivel(ctx: CanvasRenderingContext2D, w: number, h: number, info: RotuloNivel, reservas: readonly Reserva[] | undefined): void {
  const pequeno = w < 600;
  ctx.save();
  // cabe em 14 px? senão 12 px; senão a forma curta
  let fonte = pequeno ? FONTE_MARCADOR : FONTE_NIVEL;
  let texto = info.rotulo;
  let tw = largura(ctx, fonte, texto);
  if (tw + 34 > w - 32) {
    fonte = FONTE_MARCADOR;
    tw = largura(ctx, fonte, texto);
  }
  if (tw + 34 > w - 32) {
    texto = info.desbloqueado ? info.rotulo : info.placa;
    tw = largura(ctx, fonte, texto);
  }
  ctx.font = fonte;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const ph = pequeno ? 26 : 30;
  const pw = tw + 34;
  const x = pequeno ? 12 : 16;
  let y = pequeno ? 12 : h - 16 - ph;
  if (reservas) {
    for (let passo = 0; passo < 3; passo++) {
      let bateu = false;
      for (const q of reservas) {
        if (x < q[0] + q[2] && x + pw > q[0] && y < q[1] + q[3] && y + ph > q[1]) {
          y = q[1] - 8 - ph;
          bateu = true;
        }
      }
      if (!bateu) break;
    }
  }
  retArred(ctx, x, y, pw, ph, 8);
  ctx.fillStyle = D.card85;
  ctx.fill();
  ctx.strokeStyle = P.cardBorda;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = info.desbloqueado ? info.cor : alfa(info.cor, 0.55);
  ctx.beginPath();
  ctx.arc(x + 14, y + ph / 2, 4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = info.desbloqueado ? P.ink : P.muted;
  ctx.fillText(texto, x + 26, y + ph / 2 + 0.5);
  ctx.restore();
}

/** Título do nível anterior (o marcador diz "Ilha · você está aqui" no planeta). */
function tituloAnterior(id: NivelId): string {
  const i = NIVEIS.findIndex((n) => n.id === id);
  return NIVEIS[Math.max(0, i - 1)].titulo;
}

/** Placa de uma vaga (só se bloqueada e com a vaga dentro do palco: com pan/zoom a vaga pode sair). */
function placa(ctx: CanvasRenderingContext2D, tab: Tabuleiro, i: number, z: number, ta: number, cam: Camera, w: number, h: number, texto: string | null): void {
  const v = tab.vagas[i];
  if (v.estado !== "bloqueada") return;
  posicaoVaga(tab, i, ta, vec);
  const sx = vec[0] * z + cam.tx;
  const sy = vec[1] * z + cam.ty;
  const m = v.r * z + 24;
  if (sx < -m || sx > w + m || sy < -m || sy > h + m) return;
  desenharPlaca(ctx, z, vec[0], vec[1], v.r * z, texto ?? (v.preco || "—"), texto === null, sx, sy, w);
}

/** Quadrante da tela (0–3) em que a vaga `i` cai. */
function quadrante(tab: Tabuleiro, i: number, z: number, ta: number, cam: Camera, w: number, h: number): number {
  posicaoVaga(tab, i, ta, vec);
  return (vec[0] * z + cam.tx < w / 2 ? 0 : 1) + (vec[1] * z + cam.ty < h / 2 ? 0 : 2);
}

/* ------------------------------------------------------------------ */
/* API                                                                  */
/* ------------------------------------------------------------------ */

/** Câmera que enquadra a forma-mãe do nível com 8 % de margem, centrada no palco. */
export function ajustarCameraEscala(id: NivelId, w: number, h: number): Camera {
  return { zoom: (Math.min(w, h) * 0.42) / RAIO[id], tx: w / 2, ty: h / 2, w, h };
}

/** Posição (px de tela) do marcador "você está aqui": âncora da transição entre níveis. `null` na ilha. */
export function marcadorEscala(id: NivelId, t: number, cam: Camera): [number, number] | null {
  const tab = tabuleiroDe(id);
  if (!tab) return null;
  tab.marcador(movimentoReduzido() ? 0 : t, vec);
  return [vec[0] * cam.zoom + cam.tx, vec[1] * cam.zoom + cam.ty];
}

/**
 * Desenha o tabuleiro do nível com a câmera `cam` (sobre a transformação corrente), depois o marcador, as placas
 * e o rótulo do nível em px de tela. Na ilha não faz nada.
 */
export function desenharEscala(id: NivelId, ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cam: Camera, opcoes: OpcoesEscala): void {
  const tab = tabuleiroDe(id);
  if (!tab) return;
  const reduzido = movimentoReduzido();
  const ta = reduzido ? 0 : t;
  const z = cam.zoom;
  const textoPlaca = `${opcoes.tipo} · precisa de ${opcoes.potenciaTexto}`;
  tracos(z);
  ctx.save();
  ctx.transform(z, 0, 0, z, cam.tx, cam.ty);
  ctx.setLineDash(SEM_TRACO);
  ctx.lineJoin = "round";
  tab.desenhar(ctx, z, ta, t, reduzido);
  nRets = 0;
  if (opcoes.reservas) for (const q of opcoes.reservas) reservar(q[0], q[1], q[2], q[3]); // controles e minimapa: as placas não passam por cima
  // marcador: o nível anterior como ponto brilhante (reserva o rótulo antes das placas)
  tab.marcador(ta, vec);
  desenharMarcador(ctx, z, vec[0], vec[1], t, `${tituloAnterior(id)} · você está aqui`, opcoes.chegada, vec[0] * z + cam.tx, vec[1] * z + cam.ty, w, reduzido);
  if (opcoes.desbloqueado) {
    // nível desbloqueado: pílula de preço nas 3 vagas mais baratas (= mais próximas da ilha atual); as outras só a
    // moeda r 5 sun. Todas as moedas primeiro, as placas depois: uma placa cobre a moeda vizinha, nunca o contrário.
    for (let k = 3; k < tab.ordem.length; k++) {
      const i = tab.ordem[k];
      const v = tab.vagas[i];
      if (v.estado !== "bloqueada") continue;
      posicaoVaga(tab, i, ta, vec);
      ctx.save();
      ctx.translate(vec[0], vec[1] - v.r);
      ctx.scale(1 / z, 1 / z);
      ctx.fillStyle = P.sun;
      ctx.beginPath();
      ctx.arc(0, -8, 5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = P.gold;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
    for (let k = 0; k < 3 && k < tab.ordem.length; k++) placa(ctx, tab, tab.ordem[k], z, ta, cam, w, h, null);
  } else {
    // nível bloqueado: 2 placas "Tipo N · precisa de …" espalhadas (a vaga mais perto do marcador e uma afastada)
    placa(ctx, tab, tab.placasBloq[0], z, ta, cam, w, h, textoPlaca);
    // no celular: no máximo 1 placa por quadrante (a segunda só se cair noutro quadrante da tela)
    const ok = w >= 600 || quadrante(tab, tab.placasBloq[0], z, ta, cam, w, h) !== quadrante(tab, tab.placasBloq[1], z, ta, cam, w, h);
    if (ok) placa(ctx, tab, tab.placasBloq[1], z, ta, cam, w, h, textoPlaca);
  }
  ctx.restore();
  desenharRotuloNivel(
    ctx,
    w,
    h,
    {
      rotulo: opcoes.desbloqueado ? `${opcoes.tipo} · ${opcoes.titulo}` : `${opcoes.tipo} · ${opcoes.titulo} · precisa de ${opcoes.potenciaTexto}`,
      placa: textoPlaca,
      desbloqueado: opcoes.desbloqueado,
      cor: COR_NIVEL[id],
    },
    opcoes.reservas,
  );
}
