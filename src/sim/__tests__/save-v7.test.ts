import { describe, expect, it } from "vitest";
import { CABO, type IlhaId } from "../../content/era1-arquipelago";
import { arquipelagoDaEra1 } from "../gerarArquipelago";
import { desserializar, serializar } from "../save";
import { densidadeDoNivel } from "../cidade";
import { analisar } from "../producao";
import { VERSAO_SAVE } from "../state";
import { estadoLimpo, plantar } from "./ajuda";

/** Um save v6 plausível: cabos em lista, bairros como "vila", melhorias booleanas e 🔬 acumulado. */
function saveV6(extra: Record<string, unknown> = {}) {
  const base = JSON.parse(serializar(estadoLimpo(500), 1000));
  const casa = arquipelagoDaEra1().ilhas[0].casas[0];
  return {
    ...base,
    versao: 6,
    pesquisa: 77,
    melhorias: { laminasDeFibra: true, rastreamentoSolar: false, grade7x7: false },
    mundo: {
      construcoes: { [String(casa)]: { tipo: "vila", nivel: 0, colocadoEmMs: 0 } },
      removidos: [],
      remocoes: [],
      ilhasAbertas: ["principal", "ventania"],
      cabos: ["ventania"],
    },
    pesquisados: undefined,
    ...extra,
  };
}

describe("migração v6 → v7 (GDD §8.5, §8.6, v0.6)", () => {
  it("a versão é 7", () => {
    expect(VERSAO_SAVE).toBe(7);
  });

  it("os cabos viram ilha → nível, começando no nível 0", () => {
    const s = desserializar(JSON.stringify(saveV6()), 2000);
    expect(s.versao).toBe(7);
    expect(s.mundo.cabos).toEqual({ ventania: 0 });
    expect(CABO.tetoKw).toBe(30);
  });

  it('"vila" vira "bairro" na densidade 1, sem perder a casa', () => {
    const s = desserializar(JSON.stringify(saveV6()), 2000);
    const casas = Object.keys(s.mundo.construcoes).map(Number);
    expect(casas.length).toBeGreaterThan(0);
    for (const i of casas) {
      if (s.mundo.construcoes[i].tipo !== "bairro") continue;
      expect(densidadeDoNivel(s.mundo.construcoes[i].nivel).densidade).toBe(1);
    }
  });

  it("🔬 acumulado vira saldo e o que já estava desbloqueado continua desbloqueado sem cobrar", () => {
    const s = desserializar(JSON.stringify(saveV6()), 2000);
    // o saldo não é cobrado pela migração
    expect(s.pesquisa).toBe(77);
    // 77 passava dos limiares antigos (🔬 40 turbina eólica, 🔬 20 bateria) e a melhoria estava comprada
    expect(s.pesquisados).toContain("laminasDeFibra");
    expect(s.pesquisados).toContain("turbinaEolica");
    expect(s.pesquisados).toContain("bateria");
    expect(s.pesquisados).toContain("laboratorio"); // nó inicial
    expect(s.pesquisados).not.toContain("grade7x7");
  });

  it("quem não tinha 🔬 para o limiar não ganha o nó de graça", () => {
    const s = desserializar(JSON.stringify(saveV6({ pesquisa: 5, melhorias: {} })), 2000);
    expect(s.pesquisa).toBe(5);
    expect(s.pesquisados).toEqual(["laboratorio"]);
  });

  it("o Receptor cerâmico do save antigo vira o nó correspondente", () => {
    const comNucleo = saveV6({
      nucleo: { lado: 5, grade: [], calorU: 0, tempoAcimaDoLimiteMs: 0, scramRestanteMs: 0, estabilidade: 10, modoSeguro: false, receptorCeramico: true, cascatas: 0, ultimaCascataMs: null, ultimaCascata: null },
    });
    const s = desserializar(JSON.stringify(comNucleo), 2000);
    expect(s.pesquisados).toContain("receptorCeramico");
    expect(s.nucleo!.receptorCeramico).toBe(true);
  });

  it("um save v7 faz a viagem de ida e volta com cristais, densidade e nós", () => {
    const s0 = plantar(estadoLimpo(1000), "bairro", 1);
    const casa = Object.keys(s0.mundo.construcoes).map(Number).find((i) => s0.mundo.construcoes[i].tipo === "bairro")!;
    const cheio = {
      ...s0,
      pesquisa: 42,
      pesquisados: ["laboratorio", "laminasDeFibra", "subestacaoAltaTensao"],
      mundo: {
        ...s0.mundo,
        cristais: [casa + 1],
        cabos: { ventania: 2 },
        ilhasAbertas: ["principal", "ventania"] as IlhaId[],
        construcoes: { ...s0.mundo.construcoes, [casa]: { ...s0.mundo.construcoes[casa], nivel: 2 } },
      },
    };
    const lido = desserializar(serializar(cheio, 3000), 3000);
    expect(lido.pesquisa).toBe(42);
    expect(lido.pesquisados).toEqual(["laboratorio", "laminasDeFibra", "subestacaoAltaTensao"]);
    expect(lido.mundo.cristais).toEqual([casa + 1]);
    expect(lido.mundo.cabos).toEqual({ ventania: 2 });
    expect(lido.mundo.construcoes[casa].nivel).toBe(2);
    expect(analisar(lido).populacao).toBe(1600);
    // o alcance do nó comprado sobrevive à ida e volta
    expect(analisar(lido).subestacoes.length).toBeGreaterThan(0);
  });

  it("nó desconhecido no save é descartado", () => {
    const s = desserializar(JSON.stringify({ ...saveV6(), versao: 7, pesquisados: ["laminasDeFibra", "fusaoFria"] }), 2000);
    expect(s.pesquisados).toEqual(["laboratorio", "laminasDeFibra"]);
  });
});
