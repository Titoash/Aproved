/**
 * O mar do arquipélago (GDD §10, v0.6): dois azuis com ondulação lenta, água rasa no litoral, espuma na borda
 * e os cabos submarinos tracejados. Só desenha; a geometria vem de `sim/gerarArquipelago`.
 *
 * `desenharMar` roda em coordenadas de mundo (a câmera já aplicada); `desenharCeu` em px de tela.
 * Nada de `Math.random`/`Date.now`: a animação vem do `t` (s).
 */
import type { Arquipelago } from "../../sim/arquipelago";
import { ISO, PALETA, alfa, clarear, escurecer, iso, movimentoReduzido, type Camera } from "./base";

const P = {
  ...PALETA,
  marFundo: "#123a7a",
  marFundo2: "#0e2c5e",
  marRaso: "#2b8fd6",
  marRaso2: "#4cc9f0",
  espuma: "#dff3ff",
  ceuAlto: "#0d1230",
  ceuBaixo: "#3b57b5",
} as const;

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

export function liberarCacheMar(): void {
  // WeakMap: nada a liberar explicitamente; a função existe para simetria com o terreno.
}

/**
 * Mar em coordenadas de mundo: fundo em dois azuis, faixas de água rasa até 3 casas da terra, espuma na borda
 * e ondulação (linhas claras que sobem devagar). Em zoom baixo a ondulação some.
 */
export function desenharMar(ctx: CanvasRenderingContext2D, arq: Arquipelago, cam: Camera, t: number): void {
  const c = cacheDe(arq);
  const z = cam.zoom || 1;
  const reduzido = movimentoReduzido();
  ctx.save();

  // 1. fundo: gradiente vertical entre os dois azuis profundos
  const g = ctx.createLinearGradient(0, c.y0, 0, c.y1);
  g.addColorStop(0, P.marFundo2);
  g.addColorStop(0.55, P.marFundo);
  g.addColorStop(1, P.marFundo2);
  ctx.fillStyle = g;
  ctx.fill(c.pMar);

  // 2. água rasa: três faixas cada vez mais claras junto à terra
  const tons = [alfa(P.marRaso2, 0.55), alfa(P.marRaso, 0.5), alfa(P.marRaso, 0.28)];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = tons[i];
    ctx.fill(c.pRaso[i]);
  }

  // 3. ondulação: linhas horizontais claras que avançam 1 casa a cada 6 s (só de perto)
  if (z > 0.3) {
    const passo = ISO.H * 2;
    const desl = reduzido ? 0 : ((t / 6) % 1) * passo;
    ctx.strokeStyle = alfa(P.marRaso2, z > 0.6 ? 0.14 : 0.08);
    ctx.lineWidth = 2 / z;
    ctx.beginPath();
    for (let y = c.y0 + desl; y < c.y1; y += passo) {
      const largura = (c.x1 - c.x0) / 2;
      const meio = (c.x0 + c.x1) / 2;
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
  ctx.strokeStyle = alfa(P.espuma, 0.45);
  ctx.lineWidth = 1.5 / z;
  ctx.stroke(c.pEspuma);
  ctx.restore();
}

export interface CaboCena {
  /** Casas de mar atravessadas. */
  casas: readonly number[];
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
    ctx.beginPath();
    for (let i = 0; i < cabo.casas.length; i++) {
      const casa = cabo.casas[i];
      const p = iso((casa % n) + 0.5, Math.floor(casa / n) + 0.5);
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    }
    ctx.setLineDash([10 / z, 8 / z]);
    ctx.lineDashOffset = cabo.ligado ? -((t * 18) % 18) / z : 0;
    ctx.strokeStyle = cabo.ligado ? alfa(P.sun, 0.9) : alfa(P.muted, 0.5);
    ctx.lineWidth = (cabo.ligado ? 3 : 2) / z;
    ctx.stroke();
    ctx.setLineDash([]);
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
  g.addColorStop(0, P.ceuAlto);
  g.addColorStop(0.62, escurecer(P.ceuBaixo, 0.35));
  g.addColorStop(1, P.ceuBaixo);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Sol alto à esquerda (a luz de todos os sprites vem de cima-esquerda), com paralaxe fraca.
  const sx = w * 0.16 + cam.tx * 0.04;
  const sy = h * 0.14 + cam.ty * 0.03;
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
