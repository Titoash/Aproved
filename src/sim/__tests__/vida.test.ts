/**
 * O que a cena precisa para o jogo "parecer vivo" (GDD §10.1, parte F da Sessão 9): a análise diz quem
 * consome, por qual subestação e com que fatia da receita; os eventos de vários ticks não se perdem; a
 * remoção diz o que caiu.
 */
import { describe, expect, it } from "vitest";
import { LABORATORIO } from "../../content/cidade-era1";
import { OBSTACULOS } from "../../content/era1-arquipelago";
import { arquipelagoDaEra1 } from "../gerarArquipelago";
import { obstaculoEm, removerObstaculo } from "../mundo";
import { analisar } from "../producao";
import { avancarTicks } from "../tick";
import { comBairros, estadoLimpo, plantar } from "./ajuda";

const arq = arquipelagoDaEra1();

describe("consumidores na análise", () => {
  it("bairros atendidos somam fatia 1; a ciência rende 🔬 e não paga", () => {
    const s = plantar(comBairros(estadoLimpo(), 3), "laboratorio", 2);
    const a = analisar(s);
    const bairros = a.consumidores.filter((c) => c.tipo === "bairro");
    const labs = a.consumidores.filter((c) => c.tipo === "laboratorio");
    expect(bairros).toHaveLength(3);
    expect(bairros.reduce((soma, c) => soma + c.peso, 0)).toBeCloseTo(1, 10);
    for (const c of bairros) expect(c.peso).toBeCloseTo(1 / 3, 10);
    expect(labs).toHaveLength(2);
    for (const c of labs) {
      expect(c.peso).toBe(0);
      expect(c.pesquisaPorSegundo).toBeCloseTo(LABORATORIO.pesquisaPorSegundo, 10);
    }
    expect(labs.reduce((soma, c) => soma + c.pesquisaPorSegundo, 0)).toBeCloseTo(a.pesquisaPorSegundo, 10);
    // cada um sabe qual subestação o atende
    for (const c of a.consumidores) expect(s.mundo.construcoes[c.subestacao]?.tipo).toBe("subestacao");
  });

  it("bairro sem subestação no alcance não aparece", () => {
    const s = comBairros(estadoLimpo(), 2);
    const semSub = { ...s, mundo: { ...s.mundo, construcoes: Object.fromEntries(Object.entries(s.mundo.construcoes).filter(([, c]) => c.tipo !== "subestacao")) } };
    expect(analisar(semSub).consumidores).toEqual([]);
  });
});

describe("eventos de vários ticks", () => {
  it("avancarTicks entrega todos os eventos do caminho, não só os do último tick", () => {
    const s0 = estadoLimpo(1000);
    const arbustos = arq.ilhas[0].casas.filter((i) => obstaculoEm(s0.mundo, i) === "arbusto").slice(0, 3);
    const s1 = arbustos.reduce((s, i) => removerObstaculo(s, i)!, s0);
    // 2 Bipes: dois caem aos 0,5 s, o terceiro a 1 s; em 20 ticks os três eventos chegam juntos
    const fim = avancarTicks(s1, 20);
    const caidos = fim.eventos.filter((e) => e.tipo === "obstaculoRemovido");
    expect(caidos).toHaveLength(3);
    expect(caidos.map((e) => (e.tipo === "obstaculoRemovido" ? e.obstaculo : null))).toEqual(["arbusto", "arbusto", "arbusto"]);
    expect(OBSTACULOS.arbusto.tempoMs * 2).toBeLessThanOrEqual(2_000);
  });

  it("um tick só continua limpando a fila de eventos", () => {
    const s = estadoLimpo();
    expect(avancarTicks({ ...s, eventos: [{ tipo: "ilhaAberta", id: "ventania" }] }, 1).eventos).toEqual([]);
  });
});
