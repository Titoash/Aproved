/**
 * Os capítulos das duas eras. A fila que o HUD mostra é a da **era em curso**: ao construir o reator,
 * a Era 1 fica para trás e "O Vaso" assume (GDD Parte 2 §2).
 */
import { CAPITULOS_ERA1 } from "./capitulos-era1";
import { CAPITULOS_ERA2 } from "./capitulos-era2";
import type { CapituloDef } from "./capitulos-tipos";

export type { CapituloDef, CondicaoCapitulo } from "./capitulos-tipos";
export { CAPITULOS_ERA1, CAPITULOS_ERA2 };

export const CAPITULOS: readonly CapituloDef[] = [...CAPITULOS_ERA1, ...CAPITULOS_ERA2];

export const CAPITULO_POR_ID: Record<string, CapituloDef> = Object.fromEntries(CAPITULOS.map((c) => [c.id, c]));

/** Capítulos da era: os da Era 1 têm `era` ausente (nasceram antes do campo). */
export const capitulosDaEra = (era: 1 | 2): readonly CapituloDef[] => CAPITULOS.filter((c) => (c.era ?? 1) === era);
