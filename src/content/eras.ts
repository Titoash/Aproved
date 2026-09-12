/**
 * Registry das eras: o único lugar que sabe quais eras existem e qual conteúdo
 * é de qual. `src/sim/` importa **daqui**, nunca de `era1.ts` ou `era2.ts`
 * direto — é isso que faz a simulação funcionar para qualquer era (GDD §6).
 */
import type { Era, NucleoState, PecaId, UsinaId } from "../sim/state";
import { BATERIA, ORDEM_USINAS, USINAS, VILA } from "./era1";
import { NUCLEO_TORRE_SOLAR } from "./era1-nucleo";
import { BANCO_DE_BATERIAS, CIDADE, ECONOMIA_ERA2, ORDEM_USINAS_ERA2, USINAS_ERA2 } from "./era2";
import { NUCLEO_REATOR_PWR } from "./era2-nucleo";
import { ECONOMIA } from "./era1";
import type { DefinicaoEra, DefinicaoNucleo, PecaDef, UsinaDef } from "./tipos";

export const ERAS: Readonly<Record<Era, DefinicaoEra>> = {
  1: {
    id: 1,
    nome: "Vento e Sol",
    cenario: "colina",
    precoBase: ECONOMIA.precoBase,
    demandaInicialKw: ECONOMIA.demandaInicialKw,
    consumidor: VILA,
    bateria: BATERIA,
    nucleo: NUCLEO_TORRE_SOLAR,
  },
  2: {
    id: 2,
    nome: "Fissão",
    cenario: "cidade e rio",
    precoBase: ECONOMIA_ERA2.precoBase,
    demandaInicialKw: ECONOMIA_ERA2.demandaInicialKw,
    consumidor: CIDADE,
    bateria: BANCO_DE_BATERIAS,
    nucleo: NUCLEO_REATOR_PWR,
  },
};

export const ERAS_EM_ORDEM: readonly Era[] = [1, 2];

/** Núcleo assumido quando o chamador não informa qual: o da Era 1. */
export const NUCLEO_PADRAO: DefinicaoNucleo = ERAS[1].nucleo;

/** A última era implementada. Não há "próxima era" a partir dela. */
export const ULTIMA_ERA: Era = 2;

export function defDaEra(era: Era): DefinicaoEra {
  return ERAS[era];
}

/** A era seguinte, ou `null` se esta for a última implementada. */
export function proximaEra(era: Era): Era | null {
  return era < ULTIMA_ERA ? ((era + 1) as Era) : null;
}

/* ------------------------------------------------------------------ */
/* Núcleo                                                             */
/* ------------------------------------------------------------------ */

const NUCLEOS: readonly DefinicaoNucleo[] = [NUCLEO_TORRE_SOLAR, NUCLEO_REATOR_PWR];

/**
 * A definição de Núcleo de uma grade. Vem do `tipo` guardado no próprio Núcleo,
 * não da era do estado: é a grade que diz o que ela é, e assim uma grade da
 * Era 1 continua sendo lida corretamente mesmo fora do seu contexto (num teste,
 * num save antigo, no meio de uma transição).
 */
export function defDoNucleo(nucleo: Pick<NucleoState, "tipo">): DefinicaoNucleo {
  return NUCLEOS.find((n) => n.tipo === nucleo.tipo) ?? NUCLEO_TORRE_SOLAR;
}

/** Definição de uma peça dentro de um Núcleo; `undefined` se a peça não é daquela era. */
export function pecaDe(def: DefinicaoNucleo, id: PecaId): PecaDef | undefined {
  return def.pecas[id];
}

/**
 * Definição de uma peça procurando em todas as eras. Serve para o save e para a
 * UI, que precisam ler o nome e o preço de uma peça sem saber de que era ela é.
 */
export function definicaoDaPeca(id: PecaId): PecaDef {
  for (const n of NUCLEOS) {
    const def = n.pecas[id];
    if (def) return def;
  }
  throw new Error(`Peça sem definição em nenhuma era: ${id}`);
}

/* ------------------------------------------------------------------ */
/* Rede                                                               */
/* ------------------------------------------------------------------ */

/** Catálogo de usinas de todas as eras: a Era 1 continua na lista depois dela (GDD §8.5.1). */
export const USINAS_TODAS: Readonly<Record<UsinaId, UsinaDef>> = { ...USINAS, ...USINAS_ERA2 };

/** Ordem de exibição: as usinas da era em que entraram, na ordem em que entraram. */
export const ORDEM_USINAS_TODAS: readonly UsinaId[] = [...ORDEM_USINAS, ...ORDEM_USINAS_ERA2];

/** As usinas que já apareceram até a era informada. */
export function usinasAte(era: Era): readonly UsinaId[] {
  return ORDEM_USINAS_TODAS.filter((id) => USINAS_TODAS[id].era <= era);
}
