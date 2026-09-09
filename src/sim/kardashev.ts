/** Medidor Kardashev (GDD §6): potência instalada em W numa escala log com marcos reais. */
import { ESCALA_KARDASHEV, MARCOS_KARDASHEV, type MarcoKardashev } from "../content/kardashev";
import { formatarNumero, formatarPotencia } from "./formatar";
import type { GameState } from "./state";
import { balancoDoEstado } from "./tick";

/** P = (usinas + Núcleo) × 1000: instalada, não vendida. */
export function potenciaInstaladaW(state: GameState): number {
  const b = balancoDoEstado(state);
  return (b.ofertaUsinasKw + b.ofertaNucleoKw) * 1000;
}

/** Posição 0–1 na barra log de `minW` a `maxW`. */
export function posicaoNaBarra(w: number): number {
  if (!(w > 0)) return 0;
  const { minW, maxW } = ESCALA_KARDASHEV;
  const p = (Math.log10(w) - Math.log10(minW)) / (Math.log10(maxW) - Math.log10(minW));
  return Math.min(1, Math.max(0, p));
}

/** K = (log10 P − 6) ÷ 10 (Sagan). `null` sem potência. */
export function indiceK(w: number): number | null {
  if (!(w > 0)) return null;
  return (Math.log10(w) - ESCALA_KARDASHEV.base) / ESCALA_KARDASHEV.divisor;
}

/** K só é exibido a partir de 1 MW (K ≥ 0); antes disso, "abaixo da escala". */
export function kVisivel(w: number): boolean {
  const k = indiceK(w);
  return k !== null && k >= 0;
}

export function proximoMarco(w: number): MarcoKardashev | null {
  for (const marco of MARCOS_KARDASHEV) if (marco.watts > w) return marco;
  return null;
}

const SOBRESCRITOS: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻",
};

function sobrescrito(n: number): string {
  return String(n).split("").map((c) => SOBRESCRITOS[c] ?? c).join("");
}

/** "1,6×10⁴ W"; acima de 1 MW também o prefixo SI: "1,6×10⁷ W (16 MW)". */
export function formatarWatts(w: number): string {
  if (!(w > 0)) return "0 W";
  const expoente = Math.floor(Math.log10(w));
  let mantissa = w / 10 ** expoente;
  let exp = expoente;
  if (Number(mantissa.toFixed(1)) >= 10) {
    mantissa /= 10;
    exp += 1;
  }
  const cientifica = `${formatarNumero(mantissa, 1)}×10${sobrescrito(exp)} W`;
  // O prefixo SI acompanha o valor arredondado que aparece na notação científica.
  const arredondado = Number(mantissa.toFixed(1)) * 10 ** exp;
  if (arredondado >= 1e6) return `${cientifica} (${formatarPotencia(arredondado / 1000)})`;
  return cientifica;
}
