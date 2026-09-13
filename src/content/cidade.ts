/**
 * A cidade das duas eras num lugar só: a escada de densidades completa (aldeia → arcologia) e os
 * prédios que consomem e fazem ciência. Quem precisa de uma densidade qualquer lê daqui.
 */
import { DENSIDADES_ERA1 } from "./cidade-era1";
import { DENSIDADES_ERA2 } from "./cidade-era2";
import type { DensidadeDef } from "./cidade-tipos";

export type { Densidade, DensidadeDef } from "./cidade-tipos";
export { BAIRRO, LABORATORIO, UNIVERSIDADE } from "./cidade-era1";
export { DISTRITO_INDUSTRIAL, INSTITUTO } from "./era2";

export const DENSIDADES: readonly DensidadeDef[] = [...DENSIDADES_ERA1, ...DENSIDADES_ERA2];
