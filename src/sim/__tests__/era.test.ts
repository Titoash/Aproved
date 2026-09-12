import { describe, expect, it } from "vitest";
import { TRANSICAO_ERA2 } from "../../content/era2";
import { REATOR } from "../../content/era2-nucleo";
import { avancarEra, faltaParaAvancar, podeAvancarEra, requisitosParaAvancar } from "../era";
import { exportarJson, importarJson } from "../save";
import { estadoInicial, indiceReceptor, nucleoInicial, type GameState } from "../state";

/** Estado da Era 1 com o portão inteiro satisfeito. */
function pronto(): GameState {
  const s = estadoInicial();
  return {
    ...s,
    creditos: TRANSICAO_ERA2.creditos,
    pesquisa: TRANSICAO_ERA2.pesquisa,
    nucleo: { ...nucleoInicial(), estabilidade: 100 },
  };
}

describe("portão da era (GDD §8.4)", () => {
  it("exige Estabilidade 100, 🔬 3 000 e ₵ 50 000", () => {
    expect(requisitosParaAvancar(1)).toEqual({ estabilidade: 100, pesquisa: 3000, creditos: 50_000 });
    expect(podeAvancarEra(pronto())).toBe(true);
  });

  it("recusa com qualquer um dos três faltando", () => {
    const s = pronto();
    expect(podeAvancarEra({ ...s, nucleo: { ...s.nucleo!, estabilidade: 99.9 } })).toBe(false);
    expect(podeAvancarEra({ ...s, pesquisa: 2999 })).toBe(false);
    expect(podeAvancarEra({ ...s, creditos: 49_999 })).toBe(false);
    expect(avancarEra({ ...s, creditos: 49_999 })).toBeNull();
  });

  it("sem Núcleo não avança", () => {
    expect(podeAvancarEra({ ...pronto(), nucleo: null })).toBe(false);
  });

  it("`faltaParaAvancar` diz quanto falta de cada coisa", () => {
    const s = estadoInicial();
    expect(faltaParaAvancar({ ...s, nucleo: { ...nucleoInicial(), estabilidade: 40 } })).toEqual({
      estabilidade: 60,
      pesquisa: 3000,
      creditos: 50_000 - s.creditos,
    });
    expect(faltaParaAvancar(pronto())).toEqual({ estabilidade: 0, pesquisa: 0, creditos: 0 });
  });

  it("a Era 2 é a última implementada: não há portão de saída dela ainda", () => {
    expect(requisitosParaAvancar(2)).toBeNull();
    expect(faltaParaAvancar({ ...pronto(), era: 2 })).toBeNull();
    expect(podeAvancarEra({ ...pronto(), era: 2 })).toBe(false);
    expect(avancarEra({ ...pronto(), era: 2 })).toBeNull();
  });
});

describe("o que atravessa e o que zera (GDD §8.5.1)", () => {
  function avancado() {
    const s = pronto();
    const antes: GameState = {
      ...s,
      creditos: 60_000,
      pesquisa: 4000,
      rede: {
        ...s.rede,
        usinas: { ...s.rede.usinas, cataVento: { quantidade: 12, nivel: 3 } },
        vilas: 4,
        bateria: { unidades: 2, capacidadeKwh: 40, kwh: 15, bancos: 0 },
      },
      melhorias: { laminasDeFibra: true, rastreamentoSolar: true, grade7x7: true },
      cardsVistos: ["abertura", "tanque"],
      nucleo: { ...s.nucleo!, lado: 7, calorU: 260, cascatas: 2, receptorCeramico: true, scramRestanteMs: 5000, modoSeguro: true },
    };
    return { antes, depois: avancarEra(antes)! };
  }

  it("₵ paga o custo, 🔬 não é gasto, e Rede e melhorias atravessam", () => {
    const { antes, depois } = avancado();
    expect(depois.era).toBe(2);
    expect(depois.creditos).toBe(60_000 - TRANSICAO_ERA2.creditos);
    expect(depois.pesquisa).toBe(4000);
    expect(depois.rede.usinas.cataVento).toEqual({ quantidade: 12, nivel: 3 });
    expect(depois.rede.vilas).toBe(4);
    expect(depois.rede.bateria).toEqual(antes.rede.bateria);
    expect(depois.melhorias).toEqual(antes.melhorias);
    expect(depois.cardsVistos).toEqual(["abertura", "tanque"]);
  });

  it("o Núcleo é substituído: Reator PWR, grade 7×7 vazia, Estabilidade e calor zerados", () => {
    const { depois } = avancado();
    const n = depois.nucleo!;
    expect(n.tipo).toBe("reatorPwr");
    expect(n.lado).toBe(REATOR.ladoInicial);
    expect(n.grade).toHaveLength(49);
    expect(n.grade[indiceReceptor(7)]).toEqual({ tipo: "receptor" });
    expect(n.grade.filter((c) => c && c.tipo !== "receptor")).toEqual([]);
    expect(n.estabilidade).toBe(0);
    expect(n.calorU).toBe(0);
    expect(n.scramRestanteMs).toBe(0);
    expect(n.tempoAcimaDoLimiteMs).toBe(0);
    // O Receptor cerâmico era peça da Torre Solar; o histórico de Cascatas e a
    // preferência de modo seguro são do jogador e ficam.
    expect(n.receptorCeramico).toBe(false);
    expect(n.cascatas).toBe(2);
    expect(n.modoSeguro).toBe(true);
  });

  it("a demanda base soma os 800 kW da cidade inicial, preservando a das vilas", () => {
    const { antes, depois } = avancado();
    expect(depois.rede.demandaBaseKw).toBe(antes.rede.demandaBaseKw + 800);
    expect(depois.rede.vilas).toBe(4);
  });

  it("dispara o evento da era nova", () => {
    const { depois } = avancado();
    expect(depois.eventos).toContainEqual({ tipo: "eraAvancada", era: 2 });
  });

  it("a Era 2 sobrevive ao save com a grade do Reator", () => {
    const { depois } = avancado();
    const comPecas = {
      ...depois,
      nucleo: { ...depois.nucleo!, grade: depois.nucleo!.grade.slice() },
    };
    comPecas.nucleo.grade[16] = { tipo: "peca", id: "vareta", combustivel: { restante: 0.7, paradaEmMs: null } };
    comPecas.nucleo.grade[17] = { tipo: "peca", id: "geradorDeVapor" };
    const s = importarJson(exportarJson(comPecas, 10), 10);
    expect(s.era).toBe(2);
    expect(s.nucleo!.tipo).toBe("reatorPwr");
    expect(s.nucleo!.lado).toBe(7);
    expect(s.nucleo!.grade[16]).toEqual({ tipo: "peca", id: "vareta", combustivel: { restante: 0.7, paradaEmMs: null } });
    expect(s.nucleo!.grade[17]).toEqual({ tipo: "peca", id: "geradorDeVapor" });
  });
});
