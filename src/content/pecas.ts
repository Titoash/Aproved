/**
 * As peças das duas eras num lugar só: quem recebe um `PecaId` qualquer (save, Cascata, callout da
 * cena) lê daqui; quem monta a paleta de uma era lê a ordem da era.
 */
import { ORDEM_PECAS, PECAS, type PecaDef } from "./era1-nucleo";
import { ORDEM_PECAS_ERA2, PECAS_ERA2 } from "./era2-nucleo";
import type { PecaId } from "../sim/state";

export type { PecaDef };

export const PECA_POR_ID: Record<PecaId, PecaDef> = { ...PECAS, ...PECAS_ERA2 };

/** Peças que a paleta do Núcleo mostra na era. */
export function ordemDasPecas(era: 1 | 2): readonly PecaId[] {
  return era === 2 ? ORDEM_PECAS_ERA2 : ORDEM_PECAS;
}

export const TODAS_AS_PECAS: readonly PecaId[] = [...ORDEM_PECAS, ...ORDEM_PECAS_ERA2];
