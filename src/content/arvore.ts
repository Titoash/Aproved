/**
 * A árvore de pesquisa das duas eras num lugar só (GDD §8.6 e Parte 2 §6).
 *
 * Os nós da Era 1 continuam valendo na Era 2: quem comprou "Torre mais alta" continua com cata-ventos
 * 40 % melhores. O que a era faz é **abrir** os nós dela — um nó da Era 2 só fica disponível com o
 * reator construído.
 */
import { NOS_ERA1, RAMOS_ERA1 } from "./arvore-era1";
import { NOS_ERA2, RAMOS_ERA2 } from "./arvore-era2";
import type { NoDef, RamoDef } from "./arvore-tipos";

export type { EfeitoNo, NoDef, RamoDef, RamoId } from "./arvore-tipos";
export { NOS_ERA1, NOS_ERA2, RAMOS_ERA1, RAMOS_ERA2 };

export const NOS: readonly NoDef[] = [...NOS_ERA1, ...NOS_ERA2];
export const RAMOS: readonly RamoDef[] = [...RAMOS_ERA1, ...RAMOS_ERA2];

export const NO_POR_ID: Record<string, NoDef> = Object.fromEntries(NOS.map((n) => [n.id, n]));

/** Nós que já nascem pesquisados: o laboratório é a primeira ciência e não pode custar 🔬. */
export const NOS_INICIAIS: readonly string[] = ["laboratorio"];

export const nosDaEra = (era: 1 | 2): readonly NoDef[] => NOS.filter((n) => n.era === era);
export const ramosDaEra = (era: 1 | 2): readonly RamoDef[] => RAMOS.filter((r) => r.era === era);
