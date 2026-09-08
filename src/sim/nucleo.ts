/**
 * Núcleo da Era 1 — Torre Solar (GDD §8.3): geometria da grade, espelhos efetivos,
 * capacidade, balanço de calor, equilíbrio e potência. Funções puras.
 */
import { NUCLEO, PECAS, RECEPTOR_CERAMICO } from "../content/era1-nucleo";
import type { Casa, PecaId } from "./state";

export type AnelIndice = 0 | 1 | 2;

/** 0 = Receptor; 1 = as 8 vizinhas (diagonais incluídas); 2 = as 16 restantes. */
export function anel(indice: number): AnelIndice {
  const centro = (NUCLEO.lado - 1) / 2;
  const x = indice % NUCLEO.lado;
  const y = Math.floor(indice / NUCLEO.lado);
  const d = Math.max(Math.abs(x - centro), Math.abs(y - centro));
  return Math.min(2, d) as AnelIndice;
}

export function adjacenteAoReceptor(indice: number): boolean {
  return anel(indice) === 1;
}

export interface Contagem {
  espelhosAnel1: number;
  espelhosAnel2: number;
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
    turbinas: 0,
    radiadoresAdjacentes: 0,
    tanquesAdjacentes: 0,
    pecas: 0,
    entulhos: 0,
  };
  grade.forEach((casa, i) => {
    if (!casa || casa.tipo === "receptor") return;
    if (casa.tipo === "entulho") {
      c.entulhos++;
      return;
    }
    c.pecas++;
    const adjacente = adjacenteAoReceptor(i);
    switch (casa.id) {
      case "heliostato":
        if (adjacente) c.espelhosAnel1++;
        else c.espelhosAnel2++;
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

/** `h`: espelhos do anel 1 contam 1, do anel 2 contam `pesoEspelhoAnel2`. */
export function espelhosEfetivos(grade: readonly Casa[]): number {
  const c = contar(grade);
  return c.espelhosAnel1 + c.espelhosAnel2 * NUCLEO.pesoEspelhoAnel2;
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
 */
export function balancoDeCalor(grade: readonly Casa[], calorU: number, emScram = false): number {
  const c = contar(grade);
  const h = c.espelhosAnel1 + c.espelhosAnel2 * NUCLEO.pesoEspelhoAnel2;
  const entrada = emScram ? 0 : NUCLEO.calorEspelhoAnel1 * h;
  const dissipacao = NUCLEO.dissipacaoRadiador * c.radiadoresAdjacentes;
  const consumo = emScram ? 0 : NUCLEO.consumoTurbina * c.turbinas * calorU;
  return entrada - dissipacao - consumo;
}

/**
 * Q*: calor em que dQ/dt = 0. Sem turbinas não há consumo proporcional a Q:
 * devolve `Infinity` se o calor só sobe, `0` se só desce ou nada acontece.
 */
export function equilibrioU(grade: readonly Casa[]): number {
  const c = contar(grade);
  const h = c.espelhosAnel1 + c.espelhosAnel2 * NUCLEO.pesoEspelhoAnel2;
  const liquido = NUCLEO.calorEspelhoAnel1 * h - NUCLEO.dissipacaoRadiador * c.radiadoresAdjacentes;
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
export function passoCalor(grade: readonly Casa[], calorU: number, dtS: number, emScram = false): number {
  return Math.max(0, calorU + balancoDeCalor(grade, calorU, emScram) * dtS);
}

/* ------------------------------------------------------------------ */
/* Posicionamento                                                     */
/* ------------------------------------------------------------------ */

export type Validacao = { ok: true } | { ok: false; motivo: string };

export function podeColocar(grade: readonly Casa[], indice: number, pecaId: PecaId): Validacao {
  if (!Number.isInteger(indice) || indice < 0 || indice >= grade.length) return { ok: false, motivo: "Fora da grade." };
  if (indice === NUCLEO.indiceReceptor) return { ok: false, motivo: "O Receptor é fixo." };
  const casa = grade[indice];
  if (casa?.tipo === "entulho") return { ok: false, motivo: "Limpe o entulho primeiro." };
  if (casa) return { ok: false, motivo: "Casa ocupada." };
  const def = PECAS[pecaId];
  const a = anel(indice);
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
  return grade.map((casa, i) =>
    casa && casa.tipo === "peca" && adjacenteAoReceptor(i) ? { tipo: "entulho", id: casa.id, desdeMs: tempoMs } : casa,
  );
}
