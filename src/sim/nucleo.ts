/**
 * Núcleo da Era 1 — Torre Solar (GDD §8.3): geometria da grade, espelhos efetivos,
 * capacidade, balanço de calor, equilíbrio e potência. Funções puras.
 */
import { definicaoDaPeca, NUCLEO, RECEPTOR_CERAMICO } from "../content/era1-nucleo";
import { indiceReceptor, ladoDaGrade, type Casa, type PecaId } from "./state";

export type AnelIndice = 0 | 1 | 2 | 3;

/** 0 = Receptor; 1 = as 8 vizinhas (diagonais incluídas); 2 = as 16 seguintes; 3 = as 24 externas do 7×7. */
export function anel(indice: number, lado: number = NUCLEO.ladoInicial): AnelIndice {
  const centro = (lado - 1) / 2;
  const x = indice % lado;
  const y = Math.floor(indice / lado);
  const d = Math.max(Math.abs(x - centro), Math.abs(y - centro));
  return Math.min(3, d) as AnelIndice;
}

export function adjacenteAoReceptor(indice: number, lado: number = NUCLEO.ladoInicial): boolean {
  return anel(indice, lado) === 1;
}

export interface Contagem {
  espelhosAnel1: number;
  espelhosAnel2: number;
  espelhosAnel3: number;
  turbinas: number;
  radiadoresAdjacentes: number;
  tanquesAdjacentes: number;
  /** Peças intactas (sem contar Receptor e entulho). */
  pecas: number;
  entulhos: number;
}

export function contar(grade: readonly Casa[]): Contagem {
  const c: Contagem = {
    espelhosAnel1: 0,
    espelhosAnel2: 0,
    espelhosAnel3: 0,
    turbinas: 0,
    radiadoresAdjacentes: 0,
    tanquesAdjacentes: 0,
    pecas: 0,
    entulhos: 0,
  };
  const lado = ladoDaGrade(grade);
  grade.forEach((casa, i) => {
    if (!casa || casa.tipo === "receptor") return;
    if (casa.tipo === "entulho") {
      c.entulhos++;
      return;
    }
    c.pecas++;
    const a = anel(i, lado);
    const adjacente = a === 1;
    switch (casa.id) {
      case "heliostato":
        if (a === 1) c.espelhosAnel1++;
        else if (a === 2) c.espelhosAnel2++;
        else c.espelhosAnel3++;
        break;
      case "turbina":
        // A regra de posicionamento já garante anel 1; a contagem respeita o dado mesmo assim.
        if (adjacente) c.turbinas++;
        break;
      case "radiador":
        if (adjacente) c.radiadoresAdjacentes++;
        break;
      case "tanque":
        if (adjacente) c.tanquesAdjacentes++;
        break;
    }
  });
  return c;
}

/** `h` a partir de uma contagem: anel 1 conta 1, anel 2 `pesoEspelhoAnel2`, anel 3 `pesoEspelhoAnel3`. */
export function espelhosEfetivosDe(c: Contagem): number {
  return c.espelhosAnel1 + c.espelhosAnel2 * NUCLEO.pesoEspelhoAnel2 + c.espelhosAnel3 * NUCLEO.pesoEspelhoAnel3;
}

/** `h`: espelhos efetivos da grade. */
export function espelhosEfetivos(grade: readonly Casa[]): number {
  return espelhosEfetivosDe(contar(grade));
}

export function capacidadeU(grade: readonly Casa[], receptorCeramico = false): number {
  const c = contar(grade);
  return (
    NUCLEO.capacidadeReceptorU +
    c.tanquesAdjacentes * NUCLEO.capacidadeTanqueU +
    (receptorCeramico ? RECEPTOR_CERAMICO.capacidadeExtraU : 0)
  );
}

/**
 * dQ/dt, em u/s: entrada dos espelhos − dissipação dos radiadores − consumo das turbinas.
 * Em SCRAM os espelhos não injetam e as turbinas não consomem; os radiadores continuam.
 * `calorEspelho` é o calor por espelho do anel 1 (4 u/s; 5 com o Rastreamento solar).
 */
export function balancoDeCalor(
  grade: readonly Casa[],
  calorU: number,
  emScram = false,
  calorEspelho: number = NUCLEO.calorEspelhoAnel1,
): number {
  const c = contar(grade);
  const h = espelhosEfetivosDe(c);
  const entrada = emScram ? 0 : calorEspelho * h;
  const dissipacao = NUCLEO.dissipacaoRadiador * c.radiadoresAdjacentes;
  const consumo = emScram ? 0 : NUCLEO.consumoTurbina * c.turbinas * calorU;
  return entrada - dissipacao - consumo;
}

/**
 * Q*: calor em que dQ/dt = 0. Sem turbinas não há consumo proporcional a Q:
 * devolve `Infinity` se o calor só sobe, `0` se só desce ou nada acontece.
 */
export function equilibrioU(grade: readonly Casa[], calorEspelho: number = NUCLEO.calorEspelhoAnel1): number {
  const c = contar(grade);
  const h = espelhosEfetivosDe(c);
  const liquido = calorEspelho * h - NUCLEO.dissipacaoRadiador * c.radiadoresAdjacentes;
  if (c.turbinas === 0) return liquido > 0 ? Infinity : 0;
  return Math.max(0, liquido / (NUCLEO.consumoTurbina * c.turbinas));
}

/** Potência bruta: cada turbina gera `consumoTurbina × Q × kwPorUnidade` kW. */
export function potenciaNucleoKw(grade: readonly Casa[], calorU: number): number {
  const c = contar(grade);
  return c.turbinas * NUCLEO.consumoTurbina * Math.max(0, calorU) * NUCLEO.kwPorUnidade;
}

/**
 * Um passo de calor por Euler explícito: `Q += dQ/dt · dt`.
 * Sempre com o `dt` fixo do tick (100 ms). Com t turbinas o passo é estável
 * enquanto `consumoTurbina · t · dt ≪ 1` (hoje 0,012 por turbina); se um dia
 * `t · dt` chegar perto de 1 o método oscila e precisa de passo implícito.
 * O calor pode passar da capacidade: é isso que dispara a Cascata.
 */
export function passoCalor(
  grade: readonly Casa[],
  calorU: number,
  dtS: number,
  emScram = false,
  calorEspelho: number = NUCLEO.calorEspelhoAnel1,
): number {
  return Math.max(0, calorU + balancoDeCalor(grade, calorU, emScram, calorEspelho) * dtS);
}

/* ------------------------------------------------------------------ */
/* Posicionamento                                                     */
/* ------------------------------------------------------------------ */

export type Validacao = { ok: true } | { ok: false; motivo: string };

export function podeColocar(grade: readonly Casa[], indice: number, pecaId: PecaId): Validacao {
  const lado = ladoDaGrade(grade);
  if (!Number.isInteger(indice) || indice < 0 || indice >= grade.length) return { ok: false, motivo: "Fora da grade." };
  if (indice === indiceReceptor(lado)) return { ok: false, motivo: "O Receptor é fixo." };
  const casa = grade[indice];
  if (casa?.tipo === "entulho") return { ok: false, motivo: "Limpe o entulho primeiro." };
  if (casa) return { ok: false, motivo: "Casa ocupada." };
  const def = definicaoDaPeca(pecaId);
  const a = anel(indice, lado);
  if (a === 0 || !def.aneis.includes(a)) {
    return { ok: false, motivo: `${def.nome} só no anel ${def.aneis.join(" ou ")}.` };
  }
  return { ok: true };
}

export function colocar(grade: readonly Casa[], indice: number, pecaId: PecaId): Casa[] {
  const nova = grade.slice();
  nova[indice] = { tipo: "peca", id: pecaId };
  return nova;
}

export function podeRemover(grade: readonly Casa[], indice: number): boolean {
  const casa = grade[indice];
  return !!casa && casa.tipo === "peca";
}

export function remover(grade: readonly Casa[], indice: number): Casa[] {
  const nova = grade.slice();
  nova[indice] = null;
  return nova;
}

/** Transforma as peças do anel 1 em entulho (GDD §5). */
export function entulharAnel1(grade: readonly Casa[], tempoMs: number): Casa[] {
  const lado = ladoDaGrade(grade);
  return grade.map((casa, i) =>
    casa && casa.tipo === "peca" && adjacenteAoReceptor(i, lado) ? { tipo: "entulho", id: casa.id, desdeMs: tempoMs } : casa,
  );
}

/**
 * Embute uma grade `lado × lado` numa `(lado + 2) × (lado + 2)` com deslocamento (+1, +1):
 * `(x, y) → (x + 1) + (y + 1) × novoLado`. Peças, entulho e Receptor preservados.
 */
export function expandirGrade(grade: readonly Casa[]): Casa[] {
  const lado = ladoDaGrade(grade);
  const novoLado = lado + 2;
  const nova: Casa[] = new Array(novoLado * novoLado).fill(null);
  grade.forEach((casa, i) => {
    const x = i % lado;
    const y = Math.floor(i / lado);
    nova[x + 1 + (y + 1) * novoLado] = casa;
  });
  nova[indiceReceptor(novoLado)] = { tipo: "receptor" };
  return nova;
}
