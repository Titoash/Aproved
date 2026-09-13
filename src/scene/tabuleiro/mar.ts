/**
 * O mar do arquipélago (GDD §10, v0.6): dois azuis com ondulação lenta, água rasa no litoral, espuma na borda
 * e os cabos submarinos tracejados. Só desenha; a geometria vem de `sim/gerarArquipelago`.
 *
 * `desenharMar` roda em coordenadas de mundo (a câmera já aplicada); `desenharCeu` em px de tela.
 * Nada de `Math.random`/`Date.now`: a animação vem do `t` (s).
 */
import type { Arquipelago } from "../../sim/arquipelago";
import { ISO, PALETA, alfa, clarear, entardecer, escurecer, iso, movimentoReduzido, type Camera } from "./base";

const P = {
  ...PALETA,
  marFundo: "#1c56b4",
  marFundo2: "#123f8c",
  marRaso: "#2b8fd6",
  marRaso2: "#4cc9f0",
  espuma: "#dff3ff",
  ceuAlto: "#0d1230",
  ceuBaixo: "#3b57b5",
} as const;

/** Entardecer da Era 2 (GDD Parte 2 §8): os mesmos azuis um passo mais escuros e o Sol baixo. */
const P2 = {
  marFundo: "#123a7e",
  marFundo2: "#0c2a5e",
  marRaso: "#22679b",
  marRaso2: "#3c9fc4",
  espuma: "#c3ddef",
  ceuAlto: "#0b0d26",
  ceuBaixo: "#7a3f7a",
} as const;

/** Cor do mar/céu da era em curso. */
const cor = (chave: keyof typeof P2): string => (entardecer() ? P2[chave] : P[chave]);

const TAU = Math.PI * 2;

interface CacheMar {
  /** Losango que cobre a grade inteira com folga. */
  pMar: Path2D;
  /** Faixas de água rasa por distância à terra. */
  pRaso: Path2D[];
  /** Contorno da terra, para a espuma. */
  pEspuma: Path2D;
  /** Extremos em px de mundo. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const caches = new WeakMap<Arquipelago, CacheMar>();

function losangoDe(p: Path2D, x: number, y: number): void {
  const a = iso(x, y);
  const b = iso(x + 1, y);
  const c = iso(x + 1, y + 1);
  const d = iso(x, y + 1);
  p.moveTo(a[0], a[1]);
  p.lineTo(b[0], b[1]);
  p.lineTo(c[0], c[1]);
  p.lineTo(d[0], d[1]);
  p.closePath();
}

function montar(arq: Arquipelago): CacheMar {
  const n = arq.n;
  const folga = 6;
  const pMar = new Path2D();
  const cantos = [iso(-folga, -folga), iso(n + folga, -folga), iso(n + folga, n + folga), iso(-folga, n + folga)];
  pMar.moveTo(cantos[0][0], cantos[0][1]);
  for (let i = 1; i < cantos.length; i++) pMar.lineTo(cantos[i][0], cantos[i][1]);
  pMar.closePath();

  const pRaso = [new Path2D(), new Path2D(), new Path2D()];
  const pEspuma = new Path2D();
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      if (arq.terra[i] === 1) continue;
      const d = arq.distMar[i];
      if (d >= 1 && d <= 3) losangoDe(pRaso[d - 1], x, y);
      if (d === 1) losangoDe(pEspuma, x, y);
    }
  }
  const c = { pMar, pRaso, pEspuma, x0: cantos[3][0], y0: cantos[0][1], x1: cantos[1][0], y1: cantos[2][1] };
  caches.set(arq, c);
  return c;
}

const cacheDe = (arq: Arquipelago): CacheMar => caches.get(arq) ?? montar(arq);

/**
 * Mar em coordenadas de mundo: fundo em dois azuis, faixas de água rasa até 3 casas da terra, espuma na borda
 * e ondulação (linhas claras que sobem devagar). Em zoom baixo a ondulação some.
 */
export function desenharMar(ctx: CanvasRenderingContext2D, arq: Arquipelago, cam: Camera, t: number): void {
  const c = cacheDe(arq);
  const z = cam.zoom || 1;
  const reduzido = movimentoReduzido();
  ctx.save();

  // 1. fundo: o mar não acaba — cobre o palco inteiro, com gradiente vertical entre os dois azuis
  const vx0 = -cam.tx / z;
  const vy0 = -cam.ty / z;
  const vx1 = (cam.w - cam.tx) / z;
  const vy1 = (cam.h - cam.ty) / z;
  const g = ctx.createLinearGradient(0, Math.min(vy0, c.y0), 0, Math.max(vy1, c.y1));
  g.addColorStop(0, cor("marFundo2"));
  g.addColorStop(0.55, cor("marFundo"));
  g.addColorStop(1, cor("marFundo2"));
  ctx.fillStyle = g;
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);

  // 1b. brilho do Sol na água: mancha quente no alto à esquerda (a luz dos sprites vem de lá)
  // Na Era 2 o Sol está baixo: o brilho na água desce e esquenta.
  const gx = vx0 + (vx1 - vx0) * 0.28;
  const gy = vy0 + (vy1 - vy0) * (entardecer() ? 0.55 : 0.16);
  const gr = (vx1 - vx0) * 0.42;
  const brilho = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
  brilho.addColorStop(0, alfa(P.sun, 0.16));
  brilho.addColorStop(0.55, alfa(P.sun, 0.05));
  brilho.addColorStop(1, alfa(P.sun, 0));
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = brilho;
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  ctx.globalCompositeOperation = "source-over";

  // 2. água rasa: três faixas cada vez mais claras junto à terra
  const tons = [alfa(cor("marRaso2"), 0.55), alfa(cor("marRaso"), 0.5), alfa(cor("marRaso"), 0.28)];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = tons[i];
    ctx.fill(c.pRaso[i]);
  }

  // 3. ondulação: linhas horizontais claras que avançam 1 casa a cada 6 s (só de perto)
  if (z > 0.3) {
    const passo = ISO.H * 2;
    const desl = reduzido ? 0 : ((t / 6) % 1) * passo;
    ctx.strokeStyle = alfa(cor("marRaso2"), z > 0.6 ? 0.14 : 0.08);
    ctx.lineWidth = 2 / z;
    ctx.beginPath();
    for (let y = Math.floor(vy0 / passo) * passo + desl; y < vy1; y += passo) {
      const largura = vx1 - vx0;
      const meio = (vx0 + vx1) / 2;
      for (let k = -1; k <= 1; k += 2) {
        const x = meio + k * largura * 0.45;
        ctx.moveTo(x - 26, y);
        ctx.quadraticCurveTo(x, y - 5, x + 26, y);
      }
      ctx.moveTo(meio - 26, y + passo / 2);
      ctx.quadraticCurveTo(meio, y + passo / 2 - 5, meio + 26, y + passo / 2);
    }
    ctx.stroke();
  }

  // 4. espuma: contorno claro das casas de mar coladas na terra
  ctx.strokeStyle = alfa(cor("espuma"), 0.45);
  ctx.lineWidth = 1.5 / z;
  ctx.stroke(c.pEspuma);
  ctx.restore();
}

export interface CaboCena {
  /** Casas de mar atravessadas. */
  casas: readonly number[];
  /** Litoral de partida (na ilha) e de chegada (na rede principal). */
  de: number;
  para: number;
  ligado: boolean;
}

/** Cabos submarinos: linha tracejada sob a água; ligada em `sun`, apenas prevista em `muted`. */
export function desenharCabos(ctx: CanvasRenderingContext2D, arq: Arquipelago, cabos: readonly CaboCena[], cam: Camera, t: number): void {
  if (cabos.length === 0) return;
  const z = cam.zoom || 1;
  const n = arq.n;
  ctx.save();
  ctx.lineCap = "round";
  for (const cabo of cabos) {
    if (cabo.casas.length === 0) continue;
    // do litoral de partida ao de chegada, passando pelas casas de mar: o cabo precisa ser visto
    const pontos = [cabo.de, ...cabo.casas, cabo.para].map((casa) => iso((casa % n) + 0.5, Math.floor(casa / n) + 0.5));
    ctx.beginPath();
    pontos.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
    ctx.setLineDash([10 / z, 8 / z]);
    ctx.lineDashOffset = cabo.ligado ? -((t * 18) % 18) / z : 0;
    ctx.strokeStyle = cabo.ligado ? alfa(P.sun, 0.95) : alfa(P.muted, 0.55);
    // espessura com piso em px de tela: de longe o cabo não some
    ctx.lineWidth = Math.max(cabo.ligado ? 3 : 2, 2.5 / z);
    ctx.stroke();
    ctx.setLineDash([]);
    // caixas de conexão nas duas pontas
    const cor = cabo.ligado ? P.sun : P.muted;
    for (const p of [pontos[0], pontos[pontos.length - 1]]) {
      const r = Math.max(4, 5 / z);
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.ellipse(p[0], p[1] - r * 0.6, r, r * 0.6, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = alfa(P.navy, 0.6);
      ctx.beginPath();
      ctx.ellipse(p[0], p[1] - r * 0.6, r * 0.45, r * 0.28, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Alcance de uma subestação: elipse pontilhada de raio `alcance` casas (Chebyshev vira losango na projeção). */
export function desenharAlcance(ctx: CanvasRenderingContext2D, x: number, y: number, alcance: number, cam: Camera, cheio: boolean): void {
  const z = cam.zoom || 1;
  const a = iso(x - alcance, y - alcance);
  const b = iso(x + alcance + 1, y - alcance);
  const c = iso(x + alcance + 1, y + alcance + 1);
  const d = iso(x - alcance, y + alcance + 1);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.lineTo(c[0], c[1]);
  ctx.lineTo(d[0], d[1]);
  ctx.closePath();
  ctx.fillStyle = alfa(cheio ? P.coral : P.sun, 0.1);
  ctx.fill();
  ctx.setLineDash([8 / z, 6 / z]);
  ctx.strokeStyle = alfa(cheio ? P.coral : P.sun, 0.7);
  ctx.lineWidth = 2 / z;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Céu (px de tela)                                                    */
/* ------------------------------------------------------------------ */

/** Céu do nível do arquipélago: gradiente do navy do HUD ao azul do horizonte, com o Sol alto à esquerda. */
export function desenharCeu(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cam: Camera): void {
  const reduzido = movimentoReduzido();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, cor("ceuAlto"));
  g.addColorStop(0.62, escurecer(cor("ceuBaixo"), 0.35));
  g.addColorStop(1, cor("ceuBaixo"));
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Sol alto, à direita da reserva da escada (a luz dos sprites continua vindo de cima-esquerda).
  const sx = w * 0.32 + cam.tx * 0.04;
  const sy = h * (entardecer() ? 0.42 : 0.14) + cam.ty * 0.03;
  const pulso = reduzido ? 0 : Math.sin(t * 0.6) * 2;
  ctx.globalCompositeOperation = "lighter";
  for (let i = 3; i >= 1; i--) {
    ctx.fillStyle = alfa(P.sun, 0.05 * i);
    ctx.beginPath();
    ctx.arc(sx, sy, 52 + i * 26 + pulso, 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = P.sun;
  ctx.beginPath();
  ctx.arc(sx, sy, 34, 0, TAU);
  ctx.fill();
  ctx.fillStyle = clarear(P.sun, 0.5);
  ctx.beginPath();
  ctx.arc(sx - 8, sy - 8, 18, 0, TAU);
  ctx.fill();
  ctx.restore();
}
