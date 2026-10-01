/**
 * Parte D da Sessão 9: remoção com N Bipes em paralelo, Equipe de manutenção, Máquinas pesadas e
 * Escavadeiras, seleção em área e a fila andando offline (GDD Parte 1 §7, §8.5; Parte 2 §3.2, §6).
 */
import { describe, expect, it } from "vitest";
import { OBSTACULOS, SELECAO_AREA } from "../../content/era1-arquipelago";
import { NIVEL_EQUIPE } from "../../content/melhorias";
import { efeitosDe } from "../efeitos";
import { arquipelagoDaEra1 } from "../gerarArquipelago";
import { avaliarMelhoria, custoProximoNivel, melhorar } from "../melhorias";
import { bipesDe, comprarIlha, obstaculoEm, orcarArea, removerArea, removerObstaculo, retanguloDaArea, tempoRemocaoMs } from "../mundo";
import { calcularOffline } from "../offline";
import { desserializar, serializar } from "../save";
import type { TipoObstaculo } from "../../content/era1-arquipelago";
import type { GameState, RemocaoEmCurso } from "../state";
import { avancarTicks, tick } from "../tick";
import { estadoLimpo } from "./ajuda";

const arq = arquipelagoDaEra1();
const n = arq.n;

/** As primeiras `quantos` casas da ilha principal com obstáculo do tipo. */
function casas(s: GameState, tipo: TipoObstaculo, quantos: number): number[] {
  const achadas = arq.ilhas[0].casas.filter((i) => obstaculoEm(s.mundo, i) === tipo).slice(0, quantos);
  if (achadas.length < quantos) throw new Error(`só ${achadas.length} ${tipo}`);
  return achadas;
}

/** Põe na fila, uma por uma, as casas dadas. */
function enfileirar(s: GameState, alvos: readonly number[]): GameState {
  return alvos.reduce((atual, i) => removerObstaculo(atual, i)!, s);
}

/** Retângulo que cobre as casas dadas. */
function retanguloDe(indices: readonly number[]) {
  const xs = indices.map((i) => i % n);
  const ys = indices.map((i) => Math.floor(i / n));
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

describe("tempos e Bipes (§8.5, v0.8)", () => {
  it("os tempos novos: arbusto 0,5 s, árvore 1,5 s, pedra 4 s, pântano 5 s, montanha 15 s", () => {
    const tempos = (["arbusto", "arvore", "pedra", "pantano", "montanha"] as const).map((t) => OBSTACULOS[t].tempoMs);
    expect(tempos).toEqual([500, 1_500, 4_000, 5_000, 15_000]);
  });

  it("Equipe de manutenção: ₵ 150 × 2ⁿ, máximo 4, de 2 a 6 Bipes", () => {
    const alvo = { tipo: "equipe" } as const;
    let s = estadoLimpo();
    expect(bipesDe(s)).toBe(2);
    const custos: number[] = [];
    for (let k = 0; k < NIVEL_EQUIPE.maximo; k++) {
      custos.push(custoProximoNivel(s, alvo));
      s = melhorar(s, alvo)!;
    }
    expect(custos).toEqual([150, 300, 600, 1_200]);
    expect(bipesDe(s)).toBe(6);
    expect(avaliarMelhoria(s, alvo).motivo).toBe("Nível máximo (4): 6 Bipes");
    expect(melhorar(s, alvo)).toBeNull();
  });

  it("Máquinas pesadas divide por 2; com Escavadeiras, por 4", () => {
    const base = estadoLimpo();
    const tempo = (pesquisados: string[]) => tempoRemocaoMs("arvore", efeitosDe({ ...base, pesquisados: [...base.pesquisados, ...pesquisados] }));
    expect(tempo([])).toBe(1_500);
    expect(tempo(["maquinasPesadas"])).toBe(750);
    expect(tempo(["maquinasPesadas", "escavadeiras"])).toBe(375);
  });

  it("comprar a Equipe põe o Bipe novo na fila na hora", () => {
    const s0 = enfileirar(estadoLimpo(), casas(estadoLimpo(), "arbusto", 3));
    expect(s0.mundo.remocoes[2].fimMs).toBe(0);
    const s1 = melhorar(s0, { tipo: "equipe" })!;
    expect(s1.mundo.remocoes[2]).toMatchObject({ inicioMs: s0.tempoMs, fimMs: s0.tempoMs + 500, bipe: 2 });
  });
});

describe("fila paralela", () => {
  it("nunca dois Bipes na mesma remoção, nem mais em curso que Bipes", () => {
    let s = enfileirar(estadoLimpo(), [...casas(estadoLimpo(), "arbusto", 5), ...casas(estadoLimpo(), "arvore", 4)]);
    for (let k = 0; k < 80; k++) {
      s = tick(s);
      const emCurso = s.mundo.remocoes.filter((r) => r.fimMs > 0);
      expect(emCurso.length).toBeLessThanOrEqual(bipesDe(s));
      expect(new Set(emCurso.map((r) => r.bipe)).size).toBe(emCurso.length);
    }
    expect(s.mundo.remocoes).toEqual([]);
  });

  it("o mesmo resultado com 50 ticks de 100 ms e com 1 tick de 5 s, com a fila no meio", () => {
    const s0 = enfileirar(estadoLimpo(), [...casas(estadoLimpo(), "arvore", 3), ...casas(estadoLimpo(), "pedra", 2), ...casas(estadoLimpo(), "arbusto", 4)]);
    const devagar = avancarTicks(s0, 50);
    const deUmaVez = tick(s0, 5_000);
    expect(devagar.mundo.remocoes.length).toBeGreaterThan(0);
    expect(devagar.mundo.removidos.length).toBeGreaterThan(0);
    expect(deUmaVez.mundo.removidos.slice().sort()).toEqual(devagar.mundo.removidos.slice().sort());
    expect(deUmaVez.mundo.remocoes).toEqual(devagar.mundo.remocoes);
  });

  it("o Bipe que termina pega a próxima no instante em que terminou, não no tick seguinte", () => {
    const s0 = enfileirar(estadoLimpo(), casas(estadoLimpo(), "arbusto", 3));
    // tick de 125 ms: o arbusto acaba aos 500 ms, no meio do 4º tick
    let s = s0;
    for (let k = 0; k < 5; k++) s = tick(s, 125);
    const terceira = s.mundo.remocoes[0];
    expect(terceira.inicioMs).toBe(500);
    expect(terceira.fimMs).toBe(1_000);
  });
});

describe("seleção em área (§8.5)", () => {
  it("o retângulo para em 8 casas por eixo a partir de onde o gesto começou", () => {
    const a = 20 * n + 20;
    const r = retanguloDaArea(a, 40 * n + 5, n);
    expect(r.x1 - r.x0 + 1).toBe(SELECAO_AREA.ladoMax);
    expect(r.y1 - r.y0 + 1).toBe(SELECAO_AREA.ladoMax);
    expect(r).toEqual({ x0: 13, y0: 20, x1: 20, y1: 27 });
    expect(retanguloDaArea(a, a, n)).toEqual({ x0: 20, y0: 20, x1: 20, y1: 20 });
  });

  it("orça a soma de ₵ e o tempo com os Bipes; ignora o que já está na fila", () => {
    const s0 = estadoLimpo(10_000);
    const arbustos = casas(s0, "arbusto", 3);
    const ret = retanguloDe(arbustos);
    const orcamento = orcarArea(s0, ret);
    expect(orcamento.alvos).toEqual(expect.arrayContaining(arbustos));
    const custo = orcamento.alvos.reduce((soma, i) => soma + OBSTACULOS[obstaculoEm(s0.mundo, i)!].custo, 0);
    expect(orcamento.custo).toBe(custo);
    expect(orcamento.ok).toBe(true);
    // duração: fila repartida entre 2 Bipes
    const tempos = orcamento.alvos.map((i) => OBSTACULOS[obstaculoEm(s0.mundo, i)!].tempoMs);
    const bipes = [0, 0];
    for (const t of tempos) bipes[bipes[0] <= bipes[1] ? 0 : 1] += t;
    expect(orcamento.duracaoMs).toBe(Math.max(...bipes));
    // o que já está na fila não entra de novo
    const comUm = removerObstaculo(s0, arbustos[0])!;
    const depois = orcarArea(comUm, ret);
    expect(depois.alvos).not.toContain(arbustos[0]);
    expect(depois.ignorados).toBe(orcamento.ignorados + 1);
  });

  it("ilha fechada e pico ficam de fora; a montanha que encosta entra uma vez, com a 🔬 dela", () => {
    const ancora = arq.montanhas[0];
    const fechada = orcarArea(estadoLimpo(1e6), { x0: ancora % n, y0: Math.floor(ancora / n), x1: (ancora % n) + 1, y1: Math.floor(ancora / n) + 1 });
    expect(fechada.alvos).toEqual([]);
    expect(fechada.motivo).toBe("Nada para remover nesta área");
    const aberta = { ...comprarIlha(estadoLimpo(1e6), "pedreira")!, pesquisa: 100 };
    // só o canto sudeste da montanha dentro do retângulo
    const r = { x0: (ancora % n) + 1, y0: Math.floor(ancora / n) + 1, x1: (ancora % n) + 1, y1: Math.floor(ancora / n) + 1 };
    const o = orcarArea(aberta, r);
    expect(o.alvos).toEqual([ancora]);
    expect(o.pesquisa).toBe(OBSTACULOS.montanha.pesquisa);
    expect(orcarArea({ ...aberta, pesquisa: 5 }, r).motivo).toBe("Precisa de 🔬 20");
    const aVentania = comprarIlha(estadoLimpo(1e6), "ventania")!;
    const pico = arq.ilhas[1].casas.find((i) => obstaculoEm(aVentania.mundo, i) === "pico")!;
    const soPico = orcarArea(aVentania, retanguloDe([pico]));
    expect(soPico.alvos).toEqual([]);
    expect(soPico.ignorados).toBe(1);
  });

  it("tudo ou nada: sem ₵ para a área inteira recusa; com, cobra numa transição só", () => {
    const s0 = estadoLimpo(10_000);
    const ret = retanguloDe(casas(s0, "arvore", 4));
    const o = orcarArea(s0, ret);
    expect(removerArea({ ...s0, creditos: o.custo - 1 }, ret)).toBeNull();
    const s1 = removerArea(s0, ret)!;
    expect(s0.creditos - s1.creditos).toBe(o.custo);
    expect(s1.mundo.remocoes.map((r) => r.indice)).toEqual(o.alvos);
    expect(s1.mundo.remocoes.filter((r) => r.fimMs > 0)).toHaveLength(Math.min(2, o.alvos.length));
  });
});

describe("offline e save da fila", () => {
  it("8 h fora esvaziam a fila e o relatório conta os obstáculos", () => {
    const alvos = [...casas(estadoLimpo(), "arvore", 3), ...casas(estadoLimpo(), "pedra", 2)];
    const s0 = { ...enfileirar(estadoLimpo(), alvos), salvoEmMs: 1_000 };
    const { state, relatorio } = calcularOffline(s0, 1_000 + 8 * 3_600_000);
    expect(state.mundo.remocoes).toEqual([]);
    for (const i of alvos) expect(obstaculoEm(state.mundo, i)).toBeNull();
    expect(relatorio.obstaculosRemovidos).toBe(5);
    expect(relatorio.cristal).toBe(false);
    expect(state.eventos).toEqual(s0.eventos);
  });

  it("dez segundos fora andam só o que dá em dez segundos", () => {
    const pedras = casas(estadoLimpo(), "pedra", 5);
    const s0 = { ...enfileirar(estadoLimpo(), pedras), salvoEmMs: 1_000 };
    const { state, relatorio } = calcularOffline(s0, 11_000);
    // 2 Bipes × 4 s: duas rodadas completas (8 s) e a terceira em curso
    expect(relatorio.obstaculosRemovidos).toBe(4);
    expect(state.mundo.remocoes).toHaveLength(1);
    expect(state.mundo.remocoes[0].fimMs).toBe(12_000);
  });

  it("o Bipe de cada remoção sobrevive à ida e volta", () => {
    const s0 = enfileirar(estadoLimpo(), casas(estadoLimpo(), "arvore", 3));
    const lido = desserializar(serializar(s0, 1_000), 1_000);
    expect(lido.mundo.remocoes).toEqual(s0.mundo.remocoes);
  });

  it("fila de um save v8: a em curso ganha o Bipe 0; repetidas, removidas e de tipo errado saem", () => {
    const s0 = estadoLimpo();
    const [a, b, c] = casas(s0, "arvore", 3);
    const bruto = JSON.parse(serializar({ ...s0, mundo: { ...s0.mundo, removidos: [c] } }, 1_000));
    const fila: Partial<RemocaoEmCurso>[] = [
      { indice: a, tipo: "arvore", inicioMs: 0, fimMs: 3_000 },
      { indice: a, tipo: "arvore", inicioMs: 0, fimMs: 0 },
      { indice: b, tipo: "pedra", inicioMs: 0, fimMs: 0 },
      { indice: c, tipo: "arvore", inicioMs: 0, fimMs: 0 },
    ];
    bruto.mundo.remocoes = fila;
    const lido = desserializar(JSON.stringify(bruto), 1_000);
    expect(lido.mundo.remocoes).toEqual([{ indice: a, tipo: "arvore", inicioMs: 0, fimMs: 3_000, bipe: 0 }]);
  });
});
