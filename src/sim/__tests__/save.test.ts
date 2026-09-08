import { describe, expect, it } from "vitest";
import { comprarUsina } from "../acoes";
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
    let s = estadoInicial();
    s = comprarUsina(s, "cataVento")!;
    s = avancarTicks(s, 37);
    expect(salvar(s, storage)).toBe(true);
    expect(storage.dados.has(CHAVE_SAVE)).toBe(true);
    expect(carregar(storage)).toEqual(s);
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
    let s = estadoInicial();
    s = comprarUsina(s, "cataVento")!;
    s = avancarTicks(s, 10);
    expect(importarJson(exportarJson(s))).toEqual(s);
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
    expect(s.creditos).toBe(0);
    expect(s.rede.vilas).toBe(2);
    expect(s.rede.bateria.unidades).toBe(1);
    expect(s.rede.bateria.kwh).toBe(s.rede.bateria.capacidadeKwh);
    expect(s.rede.usinas.cataVento).toEqual({ quantidade: 0, nivel: 0 });
    expect(s.era).toBe(1);
    expect(s.nucleo).toBeNull();
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
    expect(s.rede.usinas.cataVento).toEqual({ quantidade: 7, nivel: 1 });
    expect(s.rede.vilas).toBe(3);
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
    expect(importarJson(exportarJson(s0))).toEqual(s0);

    const bruto = JSON.parse(exportarJson(s0));
    bruto.nucleo.grade[1] = { tipo: "peca", id: "turbina" }; // turbina no anel 2: inválida
    bruto.nucleo.grade[12] = null; // Receptor removido: volta
    const s = desserializar(JSON.stringify(bruto));
    expect(s.nucleo!.grade[1]).toBeNull();
    expect(s.nucleo!.grade[12]).toEqual({ tipo: "receptor" });
    expect(s.nucleo!.grade[6]).toEqual({ tipo: "peca", id: "turbina" });
  });
});
