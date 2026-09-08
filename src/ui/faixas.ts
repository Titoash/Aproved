/** Cor de cada faixa de `r` (GDD §10): apagão coral, equilíbrio ouro, saturação céu. */
import type { FaixaId } from "../sim/rede";

export const COR_FAIXA: Record<FaixaId, string> = {
  apagao: "var(--coral)",
  escassez: "var(--neutro)",
  equilibrio: "var(--sun)",
  excedente: "var(--neutro)",
  saturacao: "var(--sky)",
};
