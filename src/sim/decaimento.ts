/**
 * Calor de decaimento (GDD §8.5.5) — o que muda a natureza da balança na Era 2.
 *
 * Uma peça que fissionou continua emitindo calor depois de parar, caindo pela
 * metade a cada meia-vida:
 *
 *     decaimento(t) = fracao × entradaNominal × 2^(−t / meiaVida)
 *
 * `t` conta de `paradaEmMs`, carimbado quando o combustível esgota **ou**
 * quando o SCRAM começa — o que vier primeiro. A consequência é a era inteira:
 * o SCRAM zera a fissão mas não zera a entrada de calor. Na Era 1 o SCRAM
 * sempre salvava; aqui, sem bomba de refrigerante, não salva.
 *
 * Funções puras. Numa era sem combustível tudo aqui devolve 0.
 */
import { pecaDe } from "../content/eras";
import type { DefinicaoNucleo } from "../content/tipos";
import { anel } from "./nucleo";
import { ladoDaGrade, type Casa } from "./state";

/**
 * Decaimento de uma peça, em u/s, `tempoMs` depois de ela parar de fissionar.
 * Devolve 0 se a peça não queima, se ainda está fissionando, ou se o valor caiu
 * abaixo do corte — aí ela está fria e pode sair da grade.
 */
export function decaimentoDaCasa(casa: Casa, indice: number, lado: number, tempoMs: number, def: DefinicaoNucleo): number {
  const combustivel = def.combustivel;
  if (!combustivel || casa?.tipo !== "peca" || !casa.combustivel) return 0;
  const parada = casa.combustivel.paradaEmMs;
  if (parada === null) return 0;
  const peca = pecaDe(def, casa.id);
  if (!peca?.queima) return 0;

  const a = anel(indice, lado);
  const peso = def.pesosAnel[a - 1] ?? 0;
  const nominal = peca.valor * peso;
  const decorridoMs = Math.max(0, tempoMs - parada);
  const { fracao, meiaVidaMs, corteUs } = combustivel.decaimento;
  const valor = fracao * nominal * Math.pow(2, -decorridoMs / meiaVidaMs);
  return valor < corteUs ? 0 : valor;
}

/** Soma do decaimento de toda a grade, em u/s. É um termo de entrada como qualquer outro. */
export function decaimentoDaGrade(grade: readonly Casa[], tempoMs: number, def: DefinicaoNucleo): number {
  if (!def.combustivel) return 0;
  const lado = ladoDaGrade(grade);
  let total = 0;
  grade.forEach((casa, i) => {
    total += decaimentoDaCasa(casa, i, lado, tempoMs, def);
  });
  return total;
}

/** A peça ainda está quente? Só então a remoção é recusada (GDD §8.5.4). */
export function estaQuente(casa: Casa, indice: number, lado: number, tempoMs: number, def: DefinicaoNucleo): boolean {
  return decaimentoDaCasa(casa, indice, lado, tempoMs, def) > 0;
}

/**
 * Quanto tempo, em ms, até o decaimento de uma peça cair abaixo do corte.
 * `0` se ela já está fria. Serve para a UI dizer quanto falta em vez de só
 * recusar a remoção.
 */
export function tempoAteEsfriarMs(casa: Casa, indice: number, lado: number, tempoMs: number, def: DefinicaoNucleo): number {
  const atual = decaimentoDaCasa(casa, indice, lado, tempoMs, def);
  if (atual <= 0 || !def.combustivel) return 0;
  const { meiaVidaMs, corteUs } = def.combustivel.decaimento;
  return Math.max(0, Math.log2(atual / corteUs) * meiaVidaMs);
}
