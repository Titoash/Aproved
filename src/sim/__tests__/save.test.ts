import { describe, expect, it } from "vitest";
import { comprarUsina } from "../acoes";
import { carregar, CHAVE_SAVE, desserializar, ErroSave, exportarJson, importarJson, limpar, salvar, type Armazenamento } from "../save";
import { estadoInicial, VERSAO_SAVE } from "../state";
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
