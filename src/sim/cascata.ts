/** Cascata e SCRAM (GDD §5): cronômetro, efeitos, entulho e modo seguro. */
import { CASCATA } from "../content/regras";
import { definicaoDaPeca } from "../content/eras";
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
 * a ≤ 100 %.
 *
 * Durante o SCRAM o cronômetro zera **se nada mais estiver entrando**: não faz
 * sentido punir quem apertou o botão e não tem como reagir. Na Era 1 a entrada
 * em SCRAM é sempre 0, então o comportamento é o de sempre. Na Era 2, o calor
 * de decaimento continua entrando mesmo com a fissão parada — e aí a Cascata
 * acontece durante o SCRAM, que é justamente o que o GDD §8.5.5 exige.
 */
export function atualizarCronometro(
  tempoAcimaMs: number,
  tAntes: number,
  tDepois: number,
  dtMs: number,
  scram: boolean,
  /** u/s ainda entrando apesar do SCRAM (calor de decaimento). 0 na Era 1. */
  entradaEmScramUs = 0,
): number {
  if (!acimaDoLimite(tDepois)) return 0;
  if (scram && entradaEmScramUs <= 0) return 0;
  if (!acimaDoLimite(tAntes)) return 0;
  return tempoAcimaMs + dtMs;
}

export function deveCascatear(tempoAcimaMs: number): boolean {
  return tempoAcimaMs >= CASCATA.atrasoMs;
}

/** Liga o SCRAM: 20 s sem espelhos, sem turbinas, sem pesquisa, sem potência. */
export function scram(nucleo: NucleoState): NucleoState {
  return { ...nucleo, scramRestanteMs: CASCATA.scramMs, tempoAcimaDoLimiteMs: 0 };
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
    scramRestanteMs: CASCATA.scramMs,
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
  return definicaoDaPeca(casa.id).custo * CASCATA.fracaoReconstrucao;
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
