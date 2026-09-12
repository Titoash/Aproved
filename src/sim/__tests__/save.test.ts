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
    let s = estadoInicial();
    s = comprarUsina(s, "cataVento")!;
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
    expect(s.creditos).toBe(0);
    expect(s.rede.vilas).toBe(2);
    expect(s.rede.bateria.unidades).toBe(1);
    expect(s.rede.bateria.kwh).toBe(s.rede.bateria.capacidadeKwh);
    expect(s.rede.usinas.cataVento).toEqual({ quantidade: 0, nivel: 0 });
    expect(s.era).toBe(1);
    expect(s.nucleo).toBeNull();
    expect(s.melhorias).toEqual({ laminasDeFibra: false, rastreamentoSolar: false, grade7x7: false });
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
  it("preserva Rede, Núcleo e créditos; melhorias vazias; salvoEmMs = agora (sem ganho offline)", () => {
    const s0 = estadoInicial();
    s0.creditos = 4321;
    s0.rede.usinas.cataVento = { quantidade: 9, nivel: 2 };
    s0.rede.vilas = 2;
    s0.nucleo = { ...nucleoInicial(), calorU: 42, estabilidade: 33 };
    const v2 = JSON.parse(JSON.stringify(s0));
    delete v2.melhorias;
    delete v2.salvoEmMs;
    v2.versao = 2;
    const s = desserializar(JSON.stringify(v2), 123_456);
    expect(s.versao).toBe(VERSAO_SAVE);
    expect(s.creditos).toBe(4321);
    expect(s.rede.usinas.cataVento).toEqual({ quantidade: 9, nivel: 2 });
    expect(s.rede.vilas).toBe(2);
    expect(s.nucleo?.calorU).toBe(42);
    expect(s.nucleo?.estabilidade).toBe(33);
    expect(s.melhorias).toEqual({ laminasDeFibra: false, rastreamentoSolar: false, grade7x7: false });
    expect(s.salvoEmMs).toBe(123_456);
  });

  it("carregar aplica o offline a partir de salvoEmMs", () => {
    const storage = memoria();
    const s = estadoInicial();
    s.rede.usinas.cataVento = { quantidade: 5, nivel: 0 };
    salvar(s, storage, 1_000_000);
    const c = carregar(storage, 1_000_000 + 600_000)!;
    expect(c.relatorio.duracaoMs).toBe(600_000);
    expect(c.relatorio.creditos).toBeCloseTo(6.25 * 0.5 * 600, 6);
    expect(c.state.creditos).toBeCloseTo(50 + 1875, 6);
  });
});

describe("migração v4 → v5 (multi-era)", () => {
  it("um save v4 entra na Era 1 com o Núcleo marcado como Torre Solar", () => {
    const s0 = estadoInicial();
    s0.creditos = 9876;
    s0.pesquisa = 543;
    s0.rede.usinas.turbinaEolica = { quantidade: 4, nivel: 2 };
    s0.melhorias.grade7x7 = true;
    s0.cardsVistos = ["abertura", "tanque"];
    s0.nucleo = { ...nucleoInicial(), calorU: 61, estabilidade: 88, cascatas: 3 };
    s0.nucleo.grade[6] = { tipo: "peca", id: "turbina" };

    const v4: Record<string, unknown> = JSON.parse(JSON.stringify(s0));
    delete v4.era;
    delete (v4.nucleo as Record<string, unknown>).tipo;
    v4.versao = 4;

    const s = desserializar(JSON.stringify(v4), 7);
    expect(s.versao).toBe(VERSAO_SAVE);
    expect(VERSAO_SAVE).toBe(5);
    expect(s.era).toBe(1);
    expect(s.nucleo!.tipo).toBe("torreSolar");
    // nada mais se mexe
    expect(s.creditos).toBe(9876);
    expect(s.pesquisa).toBe(543);
    expect(s.rede.usinas.turbinaEolica).toEqual({ quantidade: 4, nivel: 2 });
    expect(s.melhorias.grade7x7).toBe(true);
    expect(s.cardsVistos).toEqual(["abertura", "tanque"]);
    expect(s.nucleo!.calorU).toBe(61);
    expect(s.nucleo!.estabilidade).toBe(88);
    expect(s.nucleo!.cascatas).toBe(3);
    expect(s.nucleo!.grade[6]).toEqual({ tipo: "peca", id: "turbina" });
  });

  it("save v4 sem Núcleo migra sem inventar um", () => {
    const v4 = { ...JSON.parse(exportarJson(estadoInicial())), versao: 4, nucleo: null };
    delete v4.era;
    const s = desserializar(JSON.stringify(v4), 7);
    expect(s.era).toBe(1);
    expect(s.nucleo).toBeNull();
  });

  it("um save v3 sobe a cadeia inteira até v5", () => {
    const s0 = estadoInicial();
    s0.creditos = 1000;
    s0.nucleo = { ...nucleoInicial(), calorU: 12 };
    const v3: Record<string, unknown> = JSON.parse(JSON.stringify(s0));
    delete v3.era;
    delete v3.cardsVistos;
    const nucleo = v3.nucleo as Record<string, unknown>;
    delete nucleo.tipo;
    delete nucleo.lado;
    delete nucleo.ultimaCascata;
    v3.versao = 3;

    const s = desserializar(JSON.stringify(v3), 11);
    expect(s.versao).toBe(5);
    expect(s.era).toBe(1);
    expect(s.nucleo!.tipo).toBe("torreSolar");
    expect(s.nucleo!.lado).toBe(5);
    expect(s.nucleo!.ultimaCascata).toBeNull();
    expect(s.cardsVistos).toEqual([]);
    expect(s.creditos).toBe(1000);
    expect(s.nucleo!.calorU).toBe(12);
  });

  it("um save v5 na Era 2 faz a viagem de ida e volta", () => {
    const s0 = estadoInicial();
    s0.era = 2;
    s0.nucleo = { ...nucleoInicial(), tipo: "reatorPwr", lado: 7 };
    const s = importarJson(exportarJson(s0, 42), 42);
    expect(s.era).toBe(2);
    expect(s.nucleo!.tipo).toBe("reatorPwr");
    expect(s.nucleo!.lado).toBe(7);
  });

  it("era desconhecida cai para 1 e tipo de Núcleo desconhecido cai para Torre Solar", () => {
    const bruto = JSON.parse(exportarJson({ ...estadoInicial(), nucleo: nucleoInicial() }));
    bruto.era = 99;
    bruto.nucleo.tipo = "reatorDeAntimateria";
    const s = desserializar(JSON.stringify(bruto), 1);
    expect(s.era).toBe(1);
    expect(s.nucleo!.tipo).toBe("torreSolar");
  });

  it("peça da Era 1 não ganha campo de combustível; um combustível inválido é descartado", () => {
    const s0 = { ...estadoInicial(), nucleo: nucleoInicial() };
    s0.nucleo.grade[6] = { tipo: "peca", id: "turbina" };
    const bruto = JSON.parse(exportarJson(s0));
    expect(bruto.nucleo.grade[6]).toEqual({ tipo: "peca", id: "turbina" });

    bruto.nucleo.grade[7] = { tipo: "peca", id: "radiador", combustivel: "meio tanque" };
    const s = desserializar(JSON.stringify(bruto), 1);
    expect(s.nucleo!.grade[7]).toEqual({ tipo: "peca", id: "radiador" });
  });

  it("combustível válido sobrevive ao save, com restante limitado a 1 e parada saneada", () => {
    const s0 = { ...estadoInicial(), nucleo: nucleoInicial() };
    s0.nucleo.grade[6] = { tipo: "peca", id: "turbina", combustivel: { restante: 0.4, paradaEmMs: 1234 } };
    s0.nucleo.grade[7] = { tipo: "peca", id: "radiador", combustivel: { restante: 5, paradaEmMs: null } };
    const s = importarJson(exportarJson(s0, 3), 3);
    expect(s.nucleo!.grade[6]).toEqual({ tipo: "peca", id: "turbina", combustivel: { restante: 0.4, paradaEmMs: 1234 } });
    expect(s.nucleo!.grade[7]).toEqual({ tipo: "peca", id: "radiador", combustivel: { restante: 1, paradaEmMs: null } });
  });

  it("save da versão 6 é recusado", () => {
    expect(() => desserializar(JSON.stringify({ ...JSON.parse(exportarJson(estadoInicial())), versao: 6 }))).toThrow(ErroSave);
  });
});
