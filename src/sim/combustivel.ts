/**
 * Combustível das peças que queimam (GDD §8.5.4). Funções puras.
 *
 * Uma peça que queima nasce cheia e gasta `taxaPorSegundo` ponderado pelo anel:
 * no anel 1 queima a taxa inteira, no anel 2 queima na proporção do peso — a
 * mesma proporção do calor que injeta. Quem rende metade dura o dobro.
 *
 * Ao chegar a zero a peça fica **gasta**: para de fissionar e passa a emitir só
 * calor de decaimento (ver `decaimento.ts`). O relógio do decaimento começa em
 * `paradaEmMs`, carimbado aqui no instante da exaustão.
 */
import type { DefinicaoNucleo } from "../content/tipos";
import { pecaDe } from "../content/eras";
import { anel } from "./nucleo";
import { ladoDaGrade, type Casa, type EstadoCombustivel, type EventoJogo } from "./state";

/**
 * Abaixo disto o combustível conta como zero. Somar 4 000 passos de 2,5e-4 deixa
 * um resíduo da ordem de 1e-13; sem este corte a vareta ficaria "quase gasta"
 * para sempre e o calor de decaimento — que é a era inteira — nunca começaria.
 * O valor é milhões de vezes menor que o que se queima num tick.
 */
const EPSILON_COMBUSTIVEL = 1e-9;

/** Combustível de uma peça nova: cheia e fissionando. */
export function combustivelCheio(): EstadoCombustivel {
  return { restante: 1, paradaEmMs: null };
}

/** A casa é uma peça que queima? O entulho não queima: já perdeu o que tinha. */
export function queima(casa: Casa, def: DefinicaoNucleo): boolean {
  return !!casa && casa.tipo === "peca" && !!pecaDe(def, casa.id)?.queima;
}

/** Sem combustível restante — para de fissionar e só emite decaimento. */
export function estaGasta(casa: Casa): boolean {
  return !!casa && casa.tipo === "peca" && !!casa.combustivel && casa.combustivel.restante <= 0;
}

/**
 * Fração do combustível que a peça no anel `a` queima por segundo. Segue o peso
 * do anel, o mesmo que pondera o calor: anel 1 queima a taxa cheia, anel 2 a
 * metade dela. Um anel de peso 0 não queima (não injeta nada).
 */
export function taxaDeQueima(a: number, def: DefinicaoNucleo): number {
  const combustivel = def.combustivel;
  if (!combustivel) return 0;
  return combustivel.taxaPorSegundo * (def.pesosAnel[a - 1] ?? 0);
}

/**
 * Queima o combustível de uma grade inteira por `dtS` segundos. Devolve a mesma
 * referência quando nada muda, para o tick não recriar a grade a cada 100 ms.
 * Em SCRAM a fissão para, então o combustível também não queima.
 */
export function queimarGrade(
  grade: readonly Casa[],
  dtS: number,
  tempoMs: number,
  def: DefinicaoNucleo,
  emScram = false,
): readonly Casa[] {
  if (!def.combustivel || dtS <= 0 || emScram) return grade;
  const lado = ladoDaGrade(grade);
  let mudou = false;
  const nova = grade.map((casa, i) => {
    if (!casa || casa.tipo !== "peca" || !casa.combustivel || casa.combustivel.restante <= 0) return casa;
    if (!pecaDe(def, casa.id)?.queima) return casa;
    const gasto = taxaDeQueima(anel(i, lado), def) * dtS;
    if (gasto <= 0) return casa;
    const bruto = casa.combustivel.restante - gasto;
    const restante = bruto <= EPSILON_COMBUSTIVEL ? 0 : bruto;
    mudou = true;
    // Ao esgotar, carimba o instante: é daí que o decaimento conta.
    const paradaEmMs = restante <= 0 ? (casa.combustivel.paradaEmMs ?? tempoMs) : casa.combustivel.paradaEmMs;
    return { ...casa, combustivel: { restante, paradaEmMs } };
  });
  return mudou ? nova : grade;
}

/**
 * Marca as peças que queimam como paradas em `tempoMs`, sem mexer no
 * combustível. É o que o SCRAM faz: a fissão cessa, o decaimento começa a
 * contar mesmo com combustível sobrando (GDD §8.5.5).
 */
export function pararFissao(grade: readonly Casa[], tempoMs: number, def: DefinicaoNucleo): readonly Casa[] {
  if (!def.combustivel) return grade;
  let mudou = false;
  const nova = grade.map((casa) => {
    if (!queima(casa, def) || casa?.tipo !== "peca") return casa;
    const atual = casa.combustivel ?? combustivelCheio();
    if (atual.paradaEmMs !== null) return casa;
    mudou = true;
    return { ...casa, combustivel: { ...atual, paradaEmMs: tempoMs } };
  });
  return mudou ? nova : grade;
}

/**
 * Retoma a fissão das peças que ainda têm combustível: zera o relógio do
 * decaimento. É o fim do SCRAM. As gastas continuam paradas.
 */
export function retomarFissao(grade: readonly Casa[], def: DefinicaoNucleo): readonly Casa[] {
  if (!def.combustivel) return grade;
  let mudou = false;
  const nova = grade.map((casa) => {
    if (casa?.tipo !== "peca" || !casa.combustivel) return casa;
    if (casa.combustivel.paradaEmMs === null || casa.combustivel.restante <= 0) return casa;
    mudou = true;
    return { ...casa, combustivel: { ...casa.combustivel, paradaEmMs: null } };
  });
  return mudou ? nova : grade;
}

/** Recarregar custa uma fração do preço da peça (GDD §8.5.4). */
export function custoRecarga(casa: Casa, def: DefinicaoNucleo): number {
  if (casa?.tipo !== "peca" || !def.combustivel) return 0;
  const peca = pecaDe(def, casa.id);
  return peca ? peca.custo * def.combustivel.fracaoRecarga : 0;
}

/** Recarrega a peça: combustível cheio e relógio de decaimento zerado. */
export function recarregar(grade: readonly Casa[], indice: number, def: DefinicaoNucleo): Casa[] | null {
  const casa = grade[indice];
  if (!queima(casa, def) || casa?.tipo !== "peca") return null;
  // Recarregar uma vareta cheia não faz nada: não há o que repor.
  if (casa.combustivel && casa.combustivel.restante >= 1 && casa.combustivel.paradaEmMs === null) return null;
  const nova = grade.slice();
  nova[indice] = { ...casa, combustivel: combustivelCheio() };
  return nova;
}

/**
 * Eventos que a queima de um tick produz, comparando a grade antes e depois.
 * Separado de `queimarGrade` para ela seguir sendo uma função de grade em
 * grade: quem quer os eventos pede, quem não quer não paga.
 */
export function eventosDaQueima(antes: readonly Casa[], depois: readonly Casa[], def: DefinicaoNucleo): EventoJogo[] {
  if (antes === depois || !def.combustivel) return [];
  const limiar = def.combustivel.limiarAviso;
  const eventos: EventoJogo[] = [];
  antes.forEach((casaAntes, i) => {
    if (casaAntes?.tipo !== "peca" || !casaAntes.combustivel) return;
    const casaDepois = depois[i];
    if (casaDepois?.tipo !== "peca" || !casaDepois.combustivel) return;
    const a = casaAntes.combustivel.restante;
    const d = casaDepois.combustivel.restante;
    if (a > 0 && d <= 0) eventos.push({ tipo: "varetaGasta", indice: i });
    else if (a > limiar && d <= limiar) eventos.push({ tipo: "combustivelBaixo", indice: i });
  });
  return eventos;
}
