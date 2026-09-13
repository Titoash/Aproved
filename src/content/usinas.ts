/**
 * As usinas das duas eras num registro só. Quem recebe um `UsinaId` qualquer lê daqui; quem monta a
 * paleta de uma era lê a ordem da era. As usinas da Era 1 continuam valendo na Era 2 — são os "kW
 * baratos que ocupam casa" (GDD Parte 2 §3.1).
 */
import { ORDEM_USINAS_ERA1, USINAS_ERA1, type UsinaDef } from "./era1";
import { ORDEM_USINAS_ERA2, USINAS_ERA2 } from "./era2";
import type { UsinaId } from "../sim/state";

export type { UsinaDef };
export { ORDEM_USINAS_ERA1, ORDEM_USINAS_ERA2 };

export const USINAS: Record<UsinaId, UsinaDef> = { ...USINAS_ERA1, ...USINAS_ERA2 };

/** Usinas que a paleta mostra na era (a Era 2 acrescenta, não substitui). */
export function ordemUsinas(era: 1 | 2): readonly UsinaId[] {
  return era === 2 ? [...ORDEM_USINAS_ERA1, ...ORDEM_USINAS_ERA2] : ORDEM_USINAS_ERA1;
}

export const ORDEM_USINAS: readonly UsinaId[] = [...ORDEM_USINAS_ERA1, ...ORDEM_USINAS_ERA2];

/** Lado em casas da usina (2 = construção 2×2). */
export const ladoUsina = (id: UsinaId): number => USINAS[id].lado ?? 1;
