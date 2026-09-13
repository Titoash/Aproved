/** Cascata e SCRAM (GDD §5): cronômetro, efeitos, entulho e modo seguro. */
import { CASCATA } from "../content/era1-nucleo";
import { SCRAM_ERA2 } from "../content/era2-nucleo";
import { PECA_POR_ID } from "../content/pecas";
import { perdaCascata } from "./estabilidade";
import { entulharAnel1 } from "./nucleo";
import type { Casa, NucleoState, UltimaCascata } from "./state";

/** Folga numérica: com h = 6 o calor encosta em 100 % e um ulp acima não pode contar. */
const EPSILON_T = 1e-9;

export function emScram(nucleo: NucleoState): boolean {
  return nucleo.scramRestanteMs > 0;
}

export function acimaDoLimite(t: number): boolean {
  return t > CASCATA.limiarT + EPSILON_T;
}

/**
 * Cronômetro contínuo em ms. Conta cada tick passado inteiro acima de 100 %
 * (T acima antes e depois do passo de calor), de modo que a Cascata dispara
 * 5 000 ms depois do tick em que T passou do limite. Zera assim que T volta
 * a ≤ 100 % e também durante o SCRAM (Núcleo desligado não cascateia).
 */
export function atualizarCronometro(
  tempoAcimaMs: number,
  tAntes: number,
  tDepois: number,
  dtMs: number,
  scram: boolean,
): number {
  if (scram || !acimaDoLimite(tDepois)) return 0;
  if (!acimaDoLimite(tAntes)) return 0;
  return tempoAcimaMs + dtMs;
}

export function deveCascatear(tempoAcimaMs: number): boolean {
  return tempoAcimaMs >= CASCATA.atrasoMs;
}

/**
 * Duração do SCRAM na era: 20 s na Torre Solar; no reator são 60 s de parada mínima mais 30 s para
 * religar, e nesse tempo todo as varetas decaem (GDD §5 e Parte 2 §5.2).
 */
export function duracaoScramMs(era: 1 | 2): number {
  return era === 2 ? SCRAM_ERA2.totalMs : CASCATA.scramMs;
}

/** Liga o SCRAM. `tempoMs` marca o começo: é dele que sai o decaimento das varetas na Era 2. */
export function scram(nucleo: NucleoState, tempoMs = 0): NucleoState {
  return { ...nucleo, scramRestanteMs: duracaoScramMs(nucleo.era), scramInicioMs: tempoMs, tempoAcimaDoLimiteMs: 0 };
}

/**
 * Efeitos da Cascata no Núcleo: anel 1 vira entulho, Estabilidade −30, SCRAM 20 s,
 * cronômetro zerado. A perda de bateria (−10 %) é aplicada pelo tick, na Rede.
 * Pesquisa acumulada não é tocada.
 */
export function aplicarCascata(
  nucleo: NucleoState,
  tempoMs: number,
  fluxos: Omit<UltimaCascata, "tempoMs"> = { entradaUs: 0, saidaUs: 0 },
): NucleoState {
  return {
    ...nucleo,
    grade: entulharAnel1(nucleo.grade, tempoMs),
    estabilidade: perdaCascata(nucleo.estabilidade),
    scramRestanteMs: duracaoScramMs(nucleo.era),
    scramInicioMs: tempoMs,
    tempoAcimaDoLimiteMs: 0,
    cascatas: nucleo.cascatas + 1,
    ultimaCascataMs: tempoMs,
    ultimaCascata: { tempoMs, ...fluxos },
  };
}

/* ------------------------------------------------------------------ */
/* Entulho                                                            */
/* ------------------------------------------------------------------ */

export function ehEntulho(casa: Casa): casa is { tipo: "entulho"; id: NonNullable<Casa>["tipo"] extends never ? never : Extract<Casa, { tipo: "entulho" }>["id"]; desdeMs: number } {
  return !!casa && casa.tipo === "entulho";
}

/** Limpar sem reconstruir é grátis depois de `limpezaGratisMs`. */
export function podeLimparEntulho(casa: Casa, tempoMs: number): boolean {
  return ehEntulho(casa) && tempoMs - casa.desdeMs >= CASCATA.limpezaGratisMs;
}

/** Tempo que falta para a limpeza grátis, em ms (0 se já pode). */
export function faltaParaLimpezaMs(casa: Casa, tempoMs: number): number {
  if (!ehEntulho(casa)) return 0;
  return Math.max(0, CASCATA.limpezaGratisMs - (tempoMs - casa.desdeMs));
}

/** Reconstruir custa metade do preço da peça. */
export function custoReconstrucao(casa: Casa): number {
  if (!ehEntulho(casa)) return 0;
  return PECA_POR_ID[casa.id].custo * CASCATA.fracaoReconstrucao;
}

export function limparEntulho(grade: readonly Casa[], indice: number): Casa[] {
  const nova = grade.slice();
  nova[indice] = null;
  return nova;
}

export function reconstruir(grade: readonly Casa[], indice: number): Casa[] {
  const casa = grade[indice];
  if (!ehEntulho(casa)) return grade.slice();
  const nova = grade.slice();
  nova[indice] = { tipo: "peca", id: casa.id };
  return nova;
}
