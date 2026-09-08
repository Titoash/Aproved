/** Rampa de calor (GDD §10): interpola as paradas de `RAMPA_CALOR`. */
import { RAMPA_CALOR } from "../content/era1-nucleo";

function hexParaRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function corDaRampaRgb(t: number): [number, number, number] {
  const paradas = RAMPA_CALOR;
  if (t <= paradas[0].t) return hexParaRgb(paradas[0].cor);
  for (let i = 1; i < paradas.length; i++) {
    const a = paradas[i - 1];
    const b = paradas[i];
    if (t <= b.t) {
      const f = (t - a.t) / (b.t - a.t);
      const ca = hexParaRgb(a.cor);
      const cb = hexParaRgb(b.cor);
      return [0, 1, 2].map((k) => Math.round(ca[k] + (cb[k] - ca[k]) * f)) as [number, number, number];
    }
  }
  return hexParaRgb(paradas[paradas.length - 1].cor);
}

/** Cor numérica (0xRRGGBB) para o Phaser. */
export function corDaRampa(t: number): number {
  const [r, g, b] = corDaRampaRgb(t);
  return (r << 16) | (g << 8) | b;
}

/** Cor CSS para a UI. */
export function corDaRampaCss(t: number): string {
  const [r, g, b] = corDaRampaRgb(t);
  return `rgb(${r}, ${g}, ${b})`;
}
