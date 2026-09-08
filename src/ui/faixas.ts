/** Cor de cada faixa de `r` (GDD §10): apagão coral, zona de ouro `--sun`, saturação `--sky`. */
import type { FaixaId } from "../sim/rede";

export const COR_FAIXA: Record<FaixaId, string> = {
  apagao: "var(--coral)",
  neutroBaixo: "var(--muted)",
  zonaDeOuro: "var(--sun)",
  neutroAlto: "var(--muted)",
  saturacao: "var(--sky)",
};
