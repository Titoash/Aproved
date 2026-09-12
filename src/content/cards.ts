/** Registro de todos os cards explicativos, de todas as eras. */
import { CARDS_ERA1, type CardDef } from "./cards-era1";
import { CARDS_ERA2 } from "./cards-era2";

export type { BipeExpressao, BipePapel, CardDef, TelaCard } from "./cards-era1";
export { cardParaEvento } from "./cards-era1";

export const CARDS: Record<string, CardDef> = { ...CARDS_ERA1, ...CARDS_ERA2 };
