/**
 * Núcleo da Era 1 — Torre Solar (GDD §8.3): geometria da grade, espelhos efetivos,
 * capacidade, balanço de calor, equilíbrio e potência. Funções puras.
 */
import { RECEPTOR_CERAMICO } from "../content/era1-nucleo";
import { NUCLEO_PADRAO, pecaDe } from "../content/eras";
import type { DefinicaoNucleo } from "../content/tipos";
import { indiceReceptor, ladoDaGrade, type Casa, type PecaId } from "./state";

/**
 * Núcleo padrão quando o chamador não informa qual: a Torre Solar. Toda função
 * daqui aceita uma `DefinicaoNucleo` no último parâmetro, então a Era 1 chama
 * como sempre chamou e a Era 2 passa o Reator.
 */
const PADRAO = NUCLEO_PADRAO;

export type AnelIndice = 0 | 1 | 2 | 3;

/** 0 = Receptor; 1 = as 8 vizinhas (diagonais incluídas); 2 = as 16 seguintes; 3 = as 24 externas do 7×7. */
export function anel(indice: number, lado: number = PADRAO.ladoInicial): AnelIndice {
  const centro = (lado - 1) / 2;
  const x = indice % lado;
  const y = Math.floor(indice / lado);
  const d = Math.max(Math.abs(x - centro), Math.abs(y - centro));
  return Math.min(3, d) as AnelIndice;
}

export function adjacenteAoReceptor(indice: number, lado: number = PADRAO.ladoInicial): boolean {
  return anel(indice, lado) === 1;
}

/**
 * Contagem de uma grade **por papel**, não por peça. A Torre Solar e o Reator
 * PWR têm os mesmos quatro papéis com peças diferentes, então tudo daqui para
 * baixo serve para as duas eras sem um único `if` de era.
 */
export interface Contagem {
  /** Peças que aquecem, por anel: índices 0, 1 e 2 para os anéis 1, 2 e 3. */
  aquecedoresPorAnel: [number, number, number];
  /** Peças que convertem calor em potência, adjacentes ao centro. */
  conversores: number;
  /** Peças que dissipam, adjacentes ao centro. */
  dissipadoresAdjacentes: number;
  /** u/s dissipadas ao todo. */
  dissipacaoUs: number;
  /** Peças que armazenam, adjacentes ao centro. */
  armazenadoresAdjacentes: number;
  /** u de capacidade somadas pelos armazenadores. */
  capacidadeExtraU: number;
  /** Peças intactas (sem contar o centro e o entulho). */
  pecas: number;
  entulhos: number;
}

export function contar(grade: readonly Casa[], def: DefinicaoNucleo = PADRAO): Contagem {
  const c: Contagem = {
    aquecedoresPorAnel: [0, 0, 0],
    conversores: 0,
    dissipadoresAdjacentes: 0,
    dissipacaoUs: 0,
    armazenadoresAdjacentes: 0,
    capacidadeExtraU: 0,
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
    const peca = pecaDe(def, casa.id);
    if (!peca) return;
    const a = anel(i, lado);
    const adjacente = a === 1;
    switch (peca.papel) {
      case "aquece":
        c.aquecedoresPorAnel[a - 1]++;
        break;
      case "converte":
        // A regra de posicionamento já garante o anel 1; a contagem respeita o dado mesmo assim.
        if (adjacente) c.conversores++;
        break;
      case "dissipa":
        if (adjacente) {
          c.dissipadoresAdjacentes++;
          c.dissipacaoUs += peca.valor;
        }
        break;
      case "armazena":
        if (adjacente) {
          c.armazenadoresAdjacentes++;
          c.capacidadeExtraU += peca.valor;
        }
        break;
    }
  });
  return c;
}

/** `h` a partir de uma contagem: cada anel pesa o que a era diz (GDD §8.3, §8.5.3). */
export function aquecedoresEfetivosDe(c: Contagem, def: DefinicaoNucleo = PADRAO): number {
  return c.aquecedoresPorAnel.reduce((total, n, i) => total + n * def.pesosAnel[i], 0);
}

/** `h`: aquecedores efetivos da grade (espelhos na Era 1, varetas na Era 2). */
export function aquecedoresEfetivos(grade: readonly Casa[], def: DefinicaoNucleo = PADRAO): number {
  return aquecedoresEfetivosDe(contar(grade, def), def);
}

/** Calor que cada aquecedor do anel 1 injeta, em u/s. Cada era tem um tipo só. */
export function calorBasePorAquecedor(def: DefinicaoNucleo = PADRAO): number {
  const aquecedor = def.ordemPecas.map((id) => def.pecas[id]).find((p) => p?.papel === "aquece");
  return aquecedor?.valor ?? 0;
}

export function capacidadeU(grade: readonly Casa[], receptorCeramico = false, def: DefinicaoNucleo = PADRAO): number {
  const c = contar(grade, def);
  return def.capacidadeCentroU + c.capacidadeExtraU + (receptorCeramico ? RECEPTOR_CERAMICO.capacidadeExtraU : 0);
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
  calorPorAquecedor?: number,
  def: DefinicaoNucleo = PADRAO,
): number {
  const c = contar(grade, def);
  const h = aquecedoresEfetivosDe(c, def);
  const entrada = emScram ? 0 : (calorPorAquecedor ?? calorBasePorAquecedor(def)) * h;
  const consumo = emScram ? 0 : def.consumoConversor * c.conversores * calorU;
  return entrada - c.dissipacaoUs - consumo;
}

/**
 * Q*: calor em que dQ/dt = 0. Sem turbinas não há consumo proporcional a Q:
 * devolve `Infinity` se o calor só sobe, `0` se só desce ou nada acontece.
 */
export function equilibrioU(grade: readonly Casa[], calorPorAquecedor?: number, def: DefinicaoNucleo = PADRAO): number {
  const c = contar(grade, def);
  const h = aquecedoresEfetivosDe(c, def);
  const liquido = (calorPorAquecedor ?? calorBasePorAquecedor(def)) * h - c.dissipacaoUs;
  if (c.conversores === 0) return liquido > 0 ? Infinity : 0;
  return Math.max(0, liquido / (def.consumoConversor * c.conversores));
}

/** Potência bruta: cada turbina gera `consumoTurbina × Q × kwPorUnidade` kW. */
export function potenciaNucleoKw(grade: readonly Casa[], calorU: number, def: DefinicaoNucleo = PADRAO): number {
  const c = contar(grade, def);
  return c.conversores * def.consumoConversor * Math.max(0, calorU) * def.kwPorUnidade;
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
  calorPorAquecedor?: number,
  def: DefinicaoNucleo = PADRAO,
): number {
  return Math.max(0, calorU + balancoDeCalor(grade, calorU, emScram, calorPorAquecedor, def) * dtS);
}

/* ------------------------------------------------------------------ */
/* Posicionamento                                                     */
/* ------------------------------------------------------------------ */

export type Validacao = { ok: true } | { ok: false; motivo: string };

export function podeColocar(grade: readonly Casa[], indice: number, pecaId: PecaId, def: DefinicaoNucleo = PADRAO): Validacao {
  const lado = ladoDaGrade(grade);
  if (!Number.isInteger(indice) || indice < 0 || indice >= grade.length) return { ok: false, motivo: "Fora da grade." };
  if (indice === indiceReceptor(lado)) return { ok: false, motivo: `O ${def.nomeCentro} é fixo.` };
  const casa = grade[indice];
  if (casa?.tipo === "entulho") return { ok: false, motivo: "Limpe o entulho primeiro." };
  if (casa) return { ok: false, motivo: "Casa ocupada." };
  const peca = pecaDe(def, pecaId);
  if (!peca) return { ok: false, motivo: "Peça de outra era." };
  const a = anel(indice, lado);
  if (a === 0 || !peca.aneis.includes(a)) {
    return { ok: false, motivo: `${peca.nome} só no anel ${peca.aneis.join(" ou ")}.` };
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
