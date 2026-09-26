import { describe, expect, it } from "vitest";
import { LABORATORIO, UNIVERSIDADE } from "../../content/cidade-era1";
import { DENSIDADES } from "../../content/cidade";
import { CRISTAL } from "../../content/era1-arquipelago";
import {
  avaliarEvolucaoCidade,
  contarBairros,
  custoAcumuladoPorBairro,
  custoEvolucaoCidade,
  defDaDensidade,
  evoluirCidade,
  limiteUniversidades,
  pesquisaUniversidade,
  populacaoDaCidade,
} from "../cidade";
import { colocar, custoColocar, pesquisaColocar, valorRemocao } from "../mundo";
import { analisar } from "../producao";
import { balancoDoEstado, avancarTicks } from "../tick";
import type { GameState } from "../state";
import type { Densidade } from "../../content/cidade";
import { estadoLimpo, plantar } from "./ajuda";

/** Põe a cidade na densidade pedida, de graça. */
function comDensidade(state: GameState, densidade: number): GameState {
  return { ...state, cidade: { densidade: densidade as Densidade } };
}

const casasDe = (s: GameState, tipo: string) =>
  Object.keys(s.mundo.construcoes)
    .map(Number)
    .filter((i) => s.mundo.construcoes[i].tipo === tipo);

describe("densidade da cidade (GDD §8.6, v0.8)", () => {
  it("a tabela é a de §8.6 e de Parte 2 §4.1: demanda, população e tarifa por densidade", () => {
    expect(DENSIDADES.map((d) => d.demandaKw)).toEqual([8, 20, 48, 110, 400, 1500]);
    expect(DENSIDADES.map((d) => d.populacao)).toEqual([100, 400, 1600, 6400, 25_000, 100_000]);
    expect(DENSIDADES.map((d) => d.tarifa)).toEqual([1, 1.15, 1.3, 1.5, 1.7, 2]);
    expect(DENSIDADES.map((d) => d.evolucao?.creditos ?? null)).toEqual([250, 625, 1562, 97_650, 244_000, null]);
    expect(DENSIDADES.map((d) => d.evolucao?.pesquisa ?? null)).toEqual([30, 150, 600, 3_000, 15_000, null]);
    // as duas últimas só com o nó da Era 2 (GDD Parte 2 §4.1)
    expect(DENSIDADES.map((d) => d.no ?? null)).toEqual([null, null, null, null, "megacidade", "arcologia"]);
  });

  it("a curva de evolução por bairro é quase exponencial: ₵ ×2,5 e 🔬 ×5 por degrau", () => {
    const ev = (d: number) => defDaDensidade(d).evolucao!;
    for (let d = 1; d < 3; d++) {
      expect(ev(d + 1).creditos / ev(d).creditos).toBeCloseTo(2.5, 1);
      expect(ev(d + 1).pesquisa / ev(d).pesquisa).toBeCloseTo(d === 1 ? 5 : 4, 1);
    }
    // a Era 2 dá um salto de escala em ₵ na entrada da megacidade e volta ao ×2,5 (GDD Parte 2 §4.1)
    expect(ev(4).creditos / ev(3).creditos).toBeCloseTo(62.5, 1);
    expect(ev(5).creditos / ev(4).creditos).toBeCloseTo(2.5, 1);
    expect(ev(5).pesquisa / ev(4).pesquisa).toBeCloseTo(5, 1);
    expect(defDaDensidade(6).evolucao).toBeNull(); // arcologia não evolui
  });

  it("evoluir a cidade cobra a evolução × N bairros, em ₵ e 🔬, e sobe todos de uma vez", () => {
    const s0 = plantar(estadoLimpo(0), "bairro", 3);
    expect(analisar(s0).demandaKw).toBe(3 * DENSIDADES[0].demandaKw);
    expect(custoEvolucaoCidade(s0)).toEqual({ creditos: 750, pesquisa: 90, bairros: 3 });

    expect(evoluirCidade(s0)).toBeNull(); // sem ₵ nem 🔬
    expect(avaliarEvolucaoCidade(s0).motivo).toBe("₵ insuficientes");
    expect(avaliarEvolucaoCidade({ ...s0, creditos: 1000 }).motivo).toBe("Precisa de 🔬 90");

    const s1 = evoluirCidade({ ...s0, creditos: 1000, pesquisa: 100 })!;
    expect(s1.creditos).toBe(250);
    expect(s1.pesquisa).toBe(10);
    expect(s1.cidade.densidade).toBe(2);
    // o mundo não muda — e mesmo assim a análise acompanha (a cidade entra na chave do cache)
    expect(s1.mundo).toBe(s0.mundo);
    const a = analisar(s1);
    expect(a.demandaKw).toBe(3 * DENSIDADES[1].demandaKw);
    expect(a.populacao).toBe(3 * DENSIDADES[1].populacao);
    expect(a.tarifa).toBe(DENSIDADES[1].tarifa);
    expect(s1.eventos.at(-1)).toEqual({ tipo: "cidadeEvoluida", densidade: 2, bairros: 3 });
  });

  it("sem bairro não há evolução de graça; a 5 e a 6 pedem o nó; a 6 é a última", () => {
    const vazia = { ...estadoLimpo(1e9), pesquisa: 1e9 };
    expect(contarBairros(vazia.mundo)).toBe(0);
    expect(avaliarEvolucaoCidade(vazia).motivo).toBe("Coloque um bairro primeiro");
    const metropole = comDensidade({ ...plantar(estadoLimpo(1e12), "bairro", 1), pesquisa: 1e9 }, 4);
    expect(avaliarEvolucaoCidade(metropole).motivo).toContain("Megacidade");
    const mega = evoluirCidade({ ...metropole, pesquisados: [...metropole.pesquisados, "megacidade"] })!;
    expect(mega.cidade.densidade).toBe(5);
    expect(avaliarEvolucaoCidade(mega).motivo).toContain("Arcologia");
    const arco = comDensidade(mega, 6);
    expect(custoEvolucaoCidade(arco)).toBeNull();
    expect(avaliarEvolucaoCidade(arco).motivo).toContain("não há densidade acima");
  });

  it("bairro novo nasce na densidade da cidade e paga a aldeia mais o acumulado das evoluções, em ₵ e 🔬", () => {
    const s = comDensidade(plantar(estadoLimpo(1e6), "bairro", 2), 3);
    expect(custoAcumuladoPorBairro(3)).toEqual({ creditos: 250 + 625, pesquisa: 30 + 150 });
    expect(custoColocar(s, "bairro")).toBeCloseTo(40 * 1.25 ** 2 + 875, 10);
    expect(pesquisaColocar(s, "bairro")).toBe(180);
    expect(valorRemocao(s, "bairro")).toBeCloseTo((40 * 1.25 + 875) / 2, 10);
    // sem a 🔬, não coloca
    const livre = casasDe(plantar(s, "bairro", 1), "bairro").find((i) => !s.mundo.construcoes[i])!;
    expect(colocar({ ...s, pesquisa: 179 }, livre, "bairro")).toBeNull();
    const posto = colocar({ ...s, pesquisa: 500 }, livre, "bairro")!;
    expect(posto.pesquisa).toBe(320);
    expect(analisar(posto).populacao).toBe(3 * DENSIDADES[2].populacao);
  });

  it("é indiferente evoluir antes ou depois de construir: o mesmo ₵ e a mesma 🔬 (Sessão 9)", () => {
    const um = plantar({ ...estadoLimpo(10_000), pesquisa: 1_000 }, "bairro", 1);
    const livre = casasDe(plantar(um, "bairro", 1), "bairro").find((i) => !um.mundo.construcoes[i])!;
    // A: evolui com um bairro e constrói o segundo depois
    const a = colocar(evoluirCidade(um)!, livre, "bairro")!;
    // B: constrói o segundo e evolui os dois
    const b = evoluirCidade(colocar(um, livre, "bairro")!)!;
    expect(a.cidade.densidade).toBe(2);
    expect(b.cidade.densidade).toBe(2);
    expect(a.creditos).toBeCloseTo(b.creditos, 10);
    expect(a.pesquisa).toBeCloseTo(b.pesquisa, 10);
  });

  it("a tarifa entra na receita sem mexer na razão r (GDD §4.1)", () => {
    const base = plantar(plantar(estadoLimpo(0), "bairro", 1), "cataVento", 8);
    const denso = comDensidade(base, 2);
    const b0 = balancoDoEstado(base);
    const b1 = balancoDoEstado(denso);
    // a demanda mudou, então r muda; o que se testa é que a receita traz a tarifa como fator
    expect(b0.tarifa).toBe(1);
    expect(b1.tarifa).toBe(DENSIDADES[1].tarifa);
    expect(b1.receitaPorSegundo).toBeCloseTo((b1.vendaDiretaKw + b1.cobertoKw) * b1.tarifa * b1.multiplicador, 10);
  });

  it("população só cresce com a cidade evoluída (GDD §7)", () => {
    const s = plantar(estadoLimpo(0), "bairro", 1);
    const depois = avancarTicks(s, 600); // um minuto de jogo
    expect(analisar(depois).populacao).toBe(DENSIDADES[0].populacao);
    expect(analisar(comDensidade(s, 3)).populacao).toBe(DENSIDADES[2].populacao);
    expect(populacaoDaCidade(4, 3)).toBe(4 * DENSIDADES[2].populacao);
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
    const metropole = comDensidade(base, 4);
    const a = analisar(metropole);
    expect(a.limiteUniversidades).toBe(3);
    expect(a.universidadesAtivas).toBe(3);
    // três universidades dividem os 6 400 habitantes: cada uma rende pela raiz de 2 133 alunos
    expect(a.pesquisaPorSegundo).toBeCloseTo(3 * pesquisaUniversidade(6_400, 3), 10);
    expect(a.pesquisaPorSegundo).toBeLessThan(3 * pesquisaUniversidade(6_400, 1));
    expect(a.demandaKw).toBeCloseTo(DENSIDADES[3].demandaKw + 3 * UNIVERSIDADE.consumoKw, 10);

    // com uma vila (400 habitantes) nenhuma das três tem alunos: não rendem nem consomem
    const vila = analisar(comDensidade(base, 2));
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
