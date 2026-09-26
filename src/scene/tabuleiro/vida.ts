/**
 * "Ver acontecendo" (GDD §10.1, v0.8): os fios da subestação aos consumidores com pulsos de energia e os
 * "+₵" / "+🔬" que sobem dos prédios. Só Canvas 2D e o `t` da cena; os números vêm de `content/vida.ts`.
 *
 * Orçamento: um `beginPath` para todos os fios e um `fill` para todos os pulsos; os flutuantes são no
 * máximo 12 e o texto é formatado só quando nascem.
 */
import { VIDA } from "../../content/vida";
import { PALETA, alfa, clamp01, frac, type Camera } from "./base";

const P = PALETA;
const TAU = Math.PI * 2;
/** Comprimento de uma casa na projeção isométrica (px de mundo). */
const CASA_PX = 36;

/**
 * Fios da subestação a cada consumidor atendido, empacotados `[sx, sy, cx, cy, …]` em px de mundo, com a
 * cor da faixa de `r` e a fração atendida (0..1) acelerando os pulsos. Nada no modo mapa.
 */
export function desenharLigacoes(
  ctx: CanvasRenderingContext2D,
  fios: Float32Array,
  cor: string,
  atendimento: number,
  cam: Camera,
  t: number,
  reduzido: boolean,
): void {
  const total = fios.length / 4;
  if (total === 0) return;
  const z = cam.zoom || 1;
  const vx0 = -cam.tx / z - 40;
  const vy0 = -cam.ty / z - 40;
  const vx1 = (cam.w - cam.tx) / z + 40;
  const vy1 = (cam.h - cam.ty) / z + 40;
  const fora = (x: number, y: number) => x < vx0 || x > vx1 || y < vy0 || y > vy1;
  ctx.save();
  ctx.strokeStyle = alfa(cor, 0.22);
  ctx.lineWidth = Math.max(1, 1.2 / z);
  ctx.beginPath();
  for (let i = 0; i < total; i++) {
    const k = i * 4;
    const sx = fios[k];
    const sy = fios[k + 1];
    const cx = fios[k + 2];
    const cy = fios[k + 3];
    if (fora(sx, sy) && fora(cx, cy)) continue;
    ctx.moveTo(sx, sy);
    ctx.lineTo(cx, cy);
  }
  ctx.stroke();
  if (!reduzido && atendimento > 0) {
    // um pulso por fio, da subestação ao consumidor; mais atendimento, mais rápido
    const vel = VIDA.pulsoVelocidade * CASA_PX * (0.3 + 0.7 * clamp01(atendimento));
    const lado = Math.max(2.5, 3 / z);
    ctx.fillStyle = cor;
    ctx.beginPath();
    for (let i = 0; i < total; i++) {
      const k = i * 4;
      const sx = fios[k];
      const sy = fios[k + 1];
      const cx = fios[k + 2];
      const cy = fios[k + 3];
      if (fora(sx, sy) && fora(cx, cy)) continue;
      const len = Math.hypot(cx - sx, cy - sy) || 1;
      const f = frac((t * vel) / len + i * 0.618);
      ctx.rect(sx + (cx - sx) * f - lado / 2, sy + (cy - sy) * f - lado / 2, lado, lado);
    }
    ctx.fill();
  }
  ctx.restore();
}

/* ---------------------------------------------------------------------------------------------- */
/* Flutuantes "+₵" e "+🔬"                                                                          */
/* ---------------------------------------------------------------------------------------------- */

export interface Flutuante {
  ativo: boolean;
  /** Âncora em px de mundo (o topo do prédio). */
  wx: number;
  wy: number;
  texto: string;
  moeda: boolean;
  /** `t` da cena em que nasceu. */
  t0: number;
}

/** Pool fixo: nada de alocação por quadro. */
export function criarFlutuantes(): Flutuante[] {
  return Array.from({ length: VIDA.flutuantesMax }, () => ({ ativo: false, wx: 0, wy: 0, texto: "", moeda: true, t0: 0 }));
}

export function vagaDeFlutuante(pool: Flutuante[], t: number): Flutuante | null {
  for (const f of pool) {
    if (f.ativo && t - f.t0 > VIDA.flutuanteDuracaoS) f.ativo = false;
    if (!f.ativo) return f;
  }
  return null;
}

export function flutuantesAtivos(pool: readonly Flutuante[], t: number): number {
  let n = 0;
  for (const f of pool) if (f.ativo && t - f.t0 <= VIDA.flutuanteDuracaoS) n++;
  return n;
}

const FONTE_FLUTUANTE = `700 12px Outfit, "Segoe UI", system-ui, sans-serif`;
const FONTE_MOEDA = `700 8px Outfit, "Segoe UI", system-ui, sans-serif`;

/** Frasco de laboratório desenhado (o emoji depende de fonte e sai como quadrado no Chromium sem cor). */
function frasco(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = P.sky;
  ctx.beginPath();
  ctx.moveTo(x - 2, y - 6);
  ctx.lineTo(x + 2, y - 6);
  ctx.lineTo(x + 2, y - 2);
  ctx.lineTo(x + 5, y + 4);
  ctx.quadraticCurveTo(x + 5.5, y + 6, x + 3.5, y + 6);
  ctx.lineTo(x - 3.5, y + 6);
  ctx.quadraticCurveTo(x - 5.5, y + 6, x - 5, y + 4);
  ctx.lineTo(x - 2, y - 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = P.navy;
  ctx.fillRect(x - 3, y + 2, 6, 1.5);
}

/** Desenha os flutuantes vivos em px de tela: sobem e somem ao longo de `flutuanteDuracaoS`. */
export function desenharFlutuantes(ctx: CanvasRenderingContext2D, pool: readonly Flutuante[], cam: Camera, t: number, reduzido: boolean): void {
  let algum = false;
  for (const f of pool) if (f.ativo) algum = true;
  if (!algum) return;
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const f of pool) {
    if (!f.ativo) continue;
    const k = (t - f.t0) / VIDA.flutuanteDuracaoS;
    if (k > 1) {
      f.ativo = false;
      continue;
    }
    const sx = f.wx * cam.zoom + cam.tx;
    const sy = f.wy * cam.zoom + cam.ty - (reduzido ? 0 : VIDA.flutuanteSobePx * k);
    ctx.globalAlpha = 1 - k * k;
    if (f.moeda) {
      ctx.fillStyle = P.sun;
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = P.navy;
      ctx.font = FONTE_MOEDA;
      ctx.textAlign = "center";
      ctx.fillText("₵", sx, sy + 0.5);
      ctx.textAlign = "left";
    } else frasco(ctx, sx, sy);
    ctx.font = FONTE_FLUTUANTE;
    ctx.lineWidth = 3;
    ctx.strokeStyle = alfa(P.navy, 0.8);
    ctx.strokeText(f.texto, sx + 9, sy + 0.5);
    ctx.fillStyle = f.moeda ? P.sun : P.sky;
    ctx.fillText(f.texto, sx + 9, sy + 0.5);
  }
  ctx.restore();
}
