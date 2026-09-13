import { describe, expect, it } from "vitest";
import { DENSIDADES, LABORATORIO, UNIVERSIDADE } from "../../content/cidade-era1";
import { CRISTAL } from "../../content/era1-arquipelago";
import { avaliarEvolucao, custoEvolucao, densidadeDoNivel, evoluirBairro, limiteUniversidades, pesquisaUniversidade, populacaoDoMundo } from "../cidade";
import { analisar } from "../producao";
import { balancoDoEstado, avancarTicks } from "../tick";
import type { GameState } from "../state";
import { estadoLimpo, plantar } from "./ajuda";

/** Sobe o bairro da casa `i` até a densidade pedida, de graça. */
function comDensidade(state: GameState, i: number, densidade: number): GameState {
  const c = state.mundo.construcoes[i];
  return { ...state, mundo: { ...state.mundo, construcoes: { ...state.mundo.construcoes, [i]: { ...c, nivel: densidade - 1 } } } };
}

const casasDe = (s: GameState, tipo: string) =>
  Object.keys(s.mundo.construcoes)
    .map(Number)
    .filter((i) => s.mundo.construcoes[i].tipo === tipo);

describe("densidade dos bairros (GDD §8.6)", () => {
  it("a tabela é a de §8.6: demanda, população e tarifa por densidade", () => {
    expect(DENSIDADES.map((d) => d.demandaKw)).toEqual([8, 20, 48, 110]);
    expect(DENSIDADES.map((d) => d.populacao)).toEqual([100, 400, 1600, 6400]);
    expect(DENSIDADES.map((d) => d.tarifa)).toEqual([1, 1.15, 1.3, 1.5]);
    expect(DENSIDADES.map((d) => d.evolucao?.creditos ?? null)).toEqual([250, 625, 1562, null]);
    expect(DENSIDADES.map((d) => d.evolucao?.pesquisa ?? null)).toEqual([30, 150, 600, null]);
  });

  it("a curva de evolução é quase exponencial: ₵ ×2,5 e 🔬 ×5 por degrau", () => {
    for (let n = 0; n < 2; n++) {
      const a = custoEvolucao(n)!;
      const b = custoEvolucao(n + 1)!;
      expect(b.creditos / a.creditos).toBeCloseTo(2.5, 1);
      expect(b.pesquisa / a.pesquisa).toBeCloseTo(n === 0 ? 5 : 4, 1);
    }
    expect(custoEvolucao(3)).toBeNull(); // metrópole não evolui
  });

  it("evoluir gasta ₵ + 🔬, sobe um degrau e muda demanda, população e tarifa", () => {
    const s0 = plantar(estadoLimpo(0), "bairro", 1);
    const casa = casasDe(s0, "bairro")[0];
    expect(analisar(s0).demandaKw).toBe(DENSIDADES[0].demandaKw);
    expect(analisar(s0).populacao).toBe(DENSIDADES[0].populacao);
    expect(analisar(s0).tarifa).toBe(1);

    expect(evoluirBairro(s0, casa)).toBeNull(); // sem ₵ nem 🔬
    expect(avaliarEvolucao(s0, casa).motivo).toBe("₵ insuficientes");
    const rico = { ...s0, creditos: 1000, pesquisa: 0 };
    expect(avaliarEvolucao(rico, casa).motivo).toBe("Precisa de 🔬 30");

    const pronto = { ...s0, creditos: 1000, pesquisa: 100 };
    const s1 = evoluirBairro(pronto, casa)!;
    expect(s1.creditos).toBe(1000 - DENSIDADES[0].evolucao!.creditos);
    expect(s1.pesquisa).toBe(100 - DENSIDADES[0].evolucao!.pesquisa);
    expect(densidadeDoNivel(s1.mundo.construcoes[casa].nivel).nome).toBe("Vila");
    const a = analisar(s1);
    expect(a.demandaKw).toBe(DENSIDADES[1].demandaKw);
    expect(a.populacao).toBe(DENSIDADES[1].populacao);
    expect(a.tarifa).toBe(DENSIDADES[1].tarifa);
    expect(s1.eventos.at(-1)).toEqual({ tipo: "bairroEvoluido", indice: casa, densidade: 2 });
  });

  it("a tarifa média é ponderada pela demanda dos bairros atendidos", () => {
    const s0 = plantar(estadoLimpo(0), "bairro", 2);
    const [a, b] = casasDe(s0, "bairro");
    const s = comDensidade(comDensidade(s0, a, 1), b, 4);
    // aldeia 8 kW ×1 + metrópole 110 kW ×1,5, ponderado pela demanda
    const esperado = (8 * 1 + 110 * 1.5) / (8 + 110);
    expect(analisar(s).tarifa).toBeCloseTo(esperado, 10);
    expect(analisar(s).populacao).toBe(100 + 6400);
  });

  it("a tarifa entra na receita sem mexer na razão r (GDD §4.1)", () => {
    const base = plantar(plantar(estadoLimpo(0), "bairro", 1), "cataVento", 8);
    const casa = casasDe(base, "bairro")[0];
    const denso = comDensidade(base, casa, 2);
    const b0 = balancoDoEstado(base);
    const b1 = balancoDoEstado(denso);
    // a demanda mudou, então r muda; o que se testa é que a receita traz a tarifa como fator
    expect(b0.tarifa).toBe(1);
    expect(b1.tarifa).toBe(DENSIDADES[1].tarifa);
    expect(b1.receitaPorSegundo).toBeCloseTo((b1.vendaDiretaKw + b1.cobertoKw) * b1.tarifa * b1.multiplicador, 10);
  });

  it("população só cresce com bairro evoluído (GDD §7)", () => {
    const s = plantar(estadoLimpo(0), "bairro", 1);
    const casa = casasDe(s, "bairro")[0];
    const depois = avancarTicks(s, 600); // um minuto de jogo
    expect(populacaoDoMundo(depois.mundo)).toBe(DENSIDADES[0].populacao);
    const evoluido = comDensidade(s, casa, 3);
    expect(populacaoDoMundo(evoluido.mundo)).toBe(DENSIDADES[2].populacao);
  });
});

describe("laboratório e universidade (GDD §8.6)", () => {
  it("o laboratório rende 🔬 e consome kW, e só funciona com subestação no alcance", () => {
    const s = plantar(estadoLimpo(0), "laboratorio", 2);
    const a = analisar(s);
    expect(a.pesquisaPorSegundo).toBeCloseTo(2 * LABORATORIO.pesquisaPorSegundo, 10);
    expect(a.demandaKw).toBeCloseTo(2 * LABORATORIO.consumoKw, 10);
    // sem subestação: o laboratório não pede nem rende
    const casas = casasDe(s, "laboratorio");
    const construcoes = { ...s.mundo.construcoes };
    for (const i of casasDe(s, "subestacao")) delete construcoes[i];
    const sozinho = { ...s, mundo: { ...s.mundo, construcoes } };
    expect(casas.length).toBe(2);
    expect(analisar(sozinho).pesquisaPorSegundo).toBe(0);
    expect(analisar(sozinho).demandaKw).toBe(0);
  });

  it("o tick soma a ciência da cidade ao saldo de 🔬", () => {
    const s = plantar(estadoLimpo(0), "laboratorio", 1);
    const depois = avancarTicks(s, 100); // 10 s de jogo
    expect(depois.pesquisa).toBeCloseTo(10 * LABORATORIO.pesquisaPorSegundo, 6);
  });

  it("a universidade rende pela raiz da população e é limitada a 1 por 2 000 habitantes", () => {
    expect(limiteUniversidades(0)).toBe(0);
    expect(limiteUniversidades(999)).toBe(0);
    expect(limiteUniversidades(1_000)).toBe(1);
    expect(limiteUniversidades(4_000)).toBe(2);
    expect(pesquisaUniversidade(1_000)).toBeCloseTo(UNIVERSIDADE.pesquisaBase, 10);
    expect(pesquisaUniversidade(4_000)).toBeCloseTo(UNIVERSIDADE.pesquisaBase * 2, 10);
    // ajuste 3 da Sessão 7: a raiz é por **alunos**, população ÷ universidades ativas
    expect(pesquisaUniversidade(4_000, 4)).toBeCloseTo(UNIVERSIDADE.pesquisaBase, 10);
    expect(4 * pesquisaUniversidade(16_400, 4)).toBeCloseTo(4 * UNIVERSIDADE.pesquisaBase * Math.sqrt(4.1), 10);

    // 1 metrópole = 6 400 habitantes → 3 universidades permitidas
    const base = plantar(plantar(estadoLimpo(0), "bairro", 1), "universidade", 3);
    const casa = casasDe(base, "bairro")[0];
    const metropole = comDensidade(base, casa, 4);
    const a = analisar(metropole);
    expect(a.limiteUniversidades).toBe(3);
    expect(a.universidadesAtivas).toBe(3);
    // três universidades dividem os 6 400 habitantes: cada uma rende pela raiz de 2 133 alunos
    expect(a.pesquisaPorSegundo).toBeCloseTo(3 * pesquisaUniversidade(6_400, 3), 10);
    expect(a.pesquisaPorSegundo).toBeLessThan(3 * pesquisaUniversidade(6_400, 1));
    expect(a.demandaKw).toBeCloseTo(DENSIDADES[3].demandaKw + 3 * UNIVERSIDADE.consumoKw, 10);

    // com uma vila (400 habitantes) nenhuma das três tem alunos: não rendem nem consomem
    const vila = analisar(comDensidade(base, casa, 2));
    expect(vila.limiteUniversidades).toBe(0);
    expect(vila.universidadesAtivas).toBe(0);
    expect(vila.pesquisaPorSegundo).toBe(0);
    expect(vila.demandaKw).toBe(DENSIDADES[1].demandaKw);
  });

  it("universidade sem população nenhuma não funciona", () => {
    const s = plantar(estadoLimpo(0), "universidade", 1);
    const a = analisar(s);
    expect(a.limiteUniversidades).toBe(0);
    expect(a.universidadesAtivas).toBe(0);
    expect(a.pesquisaPorSegundo).toBe(0);
  });

  it("laboratório sobre cristal rende +50 % (GDD §8.6, §9)", () => {
    const s = plantar(estadoLimpo(0), "laboratorio", 1);
    const casa = casasDe(s, "laboratorio")[0];
    const comCristal = { ...s, mundo: { ...s.mundo, cristais: [casa] } };
    expect(analisar(comCristal).pesquisaPorSegundo).toBeCloseTo(LABORATORIO.pesquisaPorSegundo * (1 + CRISTAL.bonusCiencia), 10);
  });
});
