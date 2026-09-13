import { describe, expect, it } from "vitest";
import { quantidadeDe } from "../producao";
import { plantar } from "./ajuda";
import { carregar, CHAVE_SAVE, desserializar, ErroSave, exportarJson, importarJson, limpar, salvar, type Armazenamento } from "../save";
import { estadoInicial, gradeVazia, nucleoInicial, VERSAO_SAVE } from "../state";
import { avancarTicks } from "../tick";

function memoria(): Armazenamento & { dados: Map<string, string> } {
  const dados = new Map<string, string>();
  return {
    dados,
    getItem: (k) => dados.get(k) ?? null,
    setItem: (k, v) => void dados.set(k, v),
    removeItem: (k) => void dados.delete(k),
  };
}

describe("save", () => {
  it("salva e carrega o mesmo estado", () => {
    const storage = memoria();
    let s = plantar(estadoInicial(), "cataVento", 1);
    s = avancarTicks(s, 37);
    expect(salvar(s, storage, 5000)).toBe(true);
    expect(storage.dados.has(CHAVE_SAVE)).toBe(true);
    // Carrega no mesmo instante do save: nada de offline, só o carimbo.
    expect(carregar(storage, 5000)?.state).toEqual({ ...s, salvoEmMs: 5000 });
    expect(carregar(storage, 5000)?.relatorio.duracaoMs).toBe(0);
  });

  it("sem save devolve null; limpar remove", () => {
    const storage = memoria();
    expect(carregar(storage)).toBeNull();
    salvar(estadoInicial(), storage);
    limpar(storage);
    expect(carregar(storage)).toBeNull();
  });

  it("save corrompido é ignorado ao carregar", () => {
    const storage = memoria();
    storage.setItem(CHAVE_SAVE, "{isso não é json");
    expect(carregar(storage)).toBeNull();
  });

  it("exportar/importar JSON faz a viagem de ida e volta", () => {
    let s = plantar(estadoInicial(), "cataVento", 1);
    s = avancarTicks(s, 10);
    expect(importarJson(exportarJson(s, 777), 777)).toEqual({ ...s, salvoEmMs: 777 });
  });

  it("importar rejeita JSON inválido e versão futura", () => {
    expect(() => importarJson("nada")).toThrow(ErroSave);
    expect(() => importarJson("[1,2]")).toThrow(ErroSave);
    expect(() => importarJson(JSON.stringify({ versao: VERSAO_SAVE + 1 }))).toThrow(ErroSave);
    expect(() => importarJson("{}")).toThrow(ErroSave);
  });

  it("preenche campos ausentes e sanitiza números", () => {
    const s = desserializar(
      JSON.stringify({ versao: 1, creditos: -5, rede: { vilas: 2.7, bateria: { unidades: 1, kwh: 999 } } }),
    );
    expect(s.creditos).toBeGreaterThanOrEqual(0);
    // v1 → v6: as contagens viram construções no mundo (GDD §2.1, v0.6).
    expect(quantidadeDe(s, "bairro")).toBe(3); // 2 do save + a aldeia de nascença
    expect(quantidadeDe(s, "bateria")).toBe(1);
    expect(s.rede.bateria.kwh).toBe(999);
    expect(s.rede.usinas.cataVento).toEqual({ nivel: 0 });
    expect(s.era).toBe(1);
    expect(s.nucleo).toBeNull();
    expect(s.pesquisados).toEqual(["laboratorio"]);
  });
});

describe("migração de save", () => {
  it("v1 → v2 preserva créditos, usinas e vilas e entra com o Núcleo bloqueado", () => {
    const v1 = {
      versao: 1,
      tempoMs: 5000,
      creditos: 321.5,
      pesquisa: 0,
      era: 1,
      rede: {
        usinas: { cataVento: { quantidade: 7, nivel: 1 }, painelSolar: { quantidade: 2, nivel: 0 }, turbinaEolica: { quantidade: 0, nivel: 0 } },
        vilas: 3,
        demandaBaseKw: 5,
        bateria: { kwh: 4, capacidadeKwh: 20, unidades: 1 },
      },
      nucleo: null,
    };
    const s = desserializar(JSON.stringify(v1));
    expect(s.versao).toBe(VERSAO_SAVE);
    expect(s.creditos).toBe(321.5);
    expect(s.rede.usinas.cataVento).toEqual({ nivel: 1 });
    expect(quantidadeDe(s, "cataVento")).toBe(7);
    expect(quantidadeDe(s, "painelSolar")).toBe(2);
    expect(quantidadeDe(s, "bairro")).toBe(4); // 3 do save + a aldeia de nascença
    expect(s.rede.bateria.kwh).toBe(4);
    expect(s.nucleo).toBeNull();
  });

  it("v2 com Núcleo faz a viagem de ida e volta e descarta casas inválidas", () => {
    const s0 = estadoInicial();
    s0.nucleo = {
      ...nucleoInicial(),
      calorU: 83.3,
      estabilidade: 42,
      modoSeguro: true,
      grade: gradeVazia(),
    };
    s0.nucleo.grade[6] = { tipo: "peca", id: "turbina" };
    s0.nucleo.grade[0] = { tipo: "entulho", id: "heliostato", desdeMs: 10 };
    expect(importarJson(exportarJson(s0, 99), 99)).toEqual({ ...s0, salvoEmMs: 99 });

    const bruto = JSON.parse(exportarJson(s0));
    bruto.nucleo.grade[1] = { tipo: "peca", id: "turbina" }; // turbina no anel 2: inválida
    bruto.nucleo.grade[12] = null; // Receptor removido: volta
    const s = desserializar(JSON.stringify(bruto));
    expect(s.nucleo!.grade[1]).toBeNull();
    expect(s.nucleo!.grade[12]).toEqual({ tipo: "receptor" });
    expect(s.nucleo!.grade[6]).toEqual({ tipo: "peca", id: "turbina" });
  });
});

describe("migração v2 → v3", () => {
  it("preserva Rede, Núcleo e créditos; árvore só com o nó inicial; salvoEmMs = agora (sem ganho offline)", () => {
    const s0 = estadoInicial();
    s0.creditos = 4321;
    s0.nucleo = { ...nucleoInicial(), calorU: 42, estabilidade: 33 };
    // Um save v2 tem a Rede em contagens (era assim antes da v0.6).
    const v2: Record<string, unknown> = {
      versao: 2,
      tempoMs: s0.tempoMs,
      creditos: 4321,
      pesquisa: 0,
      era: 1,
      rede: {
        usinas: { cataVento: { quantidade: 9, nivel: 2 }, painelSolar: { quantidade: 0, nivel: 0 }, turbinaEolica: { quantidade: 0, nivel: 0 } },
        vilas: 2,
        demandaBaseKw: 5,
        bateria: { kwh: 0, capacidadeKwh: 0, unidades: 0 },
      },
      nucleo: s0.nucleo,
    };
    const s = desserializar(JSON.stringify(v2), 123_456);
    expect(s.versao).toBe(VERSAO_SAVE);
    expect(s.creditos).toBe(4321);
    expect(s.rede.usinas.cataVento).toEqual({ nivel: 2 });
    expect(quantidadeDe(s, "cataVento")).toBe(9);
    expect(quantidadeDe(s, "bairro")).toBe(3); // 2 colocadas + a aldeia de nascença
    expect(s.nucleo?.calorU).toBe(42);
    expect(s.nucleo?.estabilidade).toBe(33);
    expect(s.pesquisados).toEqual(["laboratorio"]);
    expect(s.salvoEmMs).toBe(123_456);
  });

  it("carregar aplica o offline a partir de salvoEmMs", () => {
    const storage = memoria();
    // A aldeia de nascença pede 8 kW; 8 cata-ventos fecham a zona de ouro (₵ 10/s).
    const s = plantar(estadoInicial(), "cataVento", 8);
    salvar(s, storage, 1_000_000);
    const c = carregar(storage, 1_000_000 + 600_000)!;
    expect(c.relatorio.duracaoMs).toBe(600_000);
    expect(c.relatorio.creditos).toBeCloseTo(10 * 0.5 * 600, 6);
    expect(c.state.creditos).toBeCloseTo(50 + 3000, 6);
  });
});
