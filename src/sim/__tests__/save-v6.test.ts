import { describe, expect, it } from "vitest";
import { USINAS, VILA } from "../../content/era1";
import { arquipelagoDaEra1 } from "../gerarArquipelago";
import { comprarIlha, ligarCabo, removerObstaculo } from "../mundo";
import { analisar, obstaculoEm, quantidadeDe } from "../producao";
import { desserializar, serializar } from "../save";
import { estadoInicial, VERSAO_SAVE } from "../state";
import { avancarTicks } from "../tick";
import { estadoLimpo, plantar } from "./ajuda";

const arq = arquipelagoDaEra1();

describe("save v6 (mundo)", () => {
  it("a versão é 6", () => {
    expect(VERSAO_SAVE).toBe(6);
  });

  it("ida e volta: construções, obstáculos removidos, fila, ilhas e cabos", () => {
    let s = plantar(estadoLimpo(1e6), "cataVento", 3);
    s = comprarIlha(s, "ventania")!;
    s = ligarCabo(s, "ventania")!;
    const arvore = arq.ilhas[0].casas.find((i) => obstaculoEm(s.mundo, i) === "arvore")!;
    s = removerObstaculo(s, arvore)!;
    const meio = avancarTicks(s, 5); // fila ainda em curso
    const lido = desserializar(serializar(meio, 1000), 1000);
    expect(lido.versao).toBe(6);
    expect(lido.mundo.construcoes).toEqual(meio.mundo.construcoes);
    expect(lido.mundo.ilhasAbertas).toEqual(["principal", "ventania"]);
    expect(lido.mundo.cabos).toEqual(["ventania"]);
    expect(lido.mundo.remocoes).toEqual(meio.mundo.remocoes);
    const fim = avancarTicks(s, 40);
    const lidoFim = desserializar(serializar(fim, 1000), 1000);
    expect(lidoFim.mundo.removidos).toEqual([arvore]);
    expect(obstaculoEm(lidoFim.mundo, arvore)).toBeNull();
  });

  it("descarta casas, tipos, ilhas e obstáculos que não existem", () => {
    const bruto = {
      ...JSON.parse(serializar(estadoLimpo(), 1000)),
      mundo: {
        construcoes: {
          "-5": { tipo: "cataVento", nivel: 0, colocadoEmMs: 0 },
          "999999": { tipo: "cataVento", nivel: 0, colocadoEmMs: 0 },
          [String(arq.terra.indexOf(0))]: { tipo: "cataVento", nivel: 0, colocadoEmMs: 0 },
          [String(arq.ilhas[0].casas[0])]: { tipo: "usinaDeFusao", nivel: 0, colocadoEmMs: 0 },
        },
        removidos: [arq.terra.indexOf(0), 12345678],
        remocoes: [{ indice: -1, tipo: "arvore" }],
        ilhasAbertas: ["ventania", "atlantida"],
        cabos: ["principal", "solar", "nada"],
      },
    };
    const s = desserializar(JSON.stringify(bruto), 1000);
    expect(Object.keys(s.mundo.construcoes)).toEqual([]);
    expect(s.mundo.removidos).toEqual([]);
    expect(s.mundo.remocoes).toEqual([]);
    expect(s.mundo.ilhasAbertas).toEqual(["principal", "ventania"]);
    expect(s.mundo.cabos).toEqual(["solar"]);
  });

  it("migra v5 colocando as unidades na principal e reembolsando o que não coube", () => {
    const v5 = {
      versao: 5,
      tempoMs: 1000,
      creditos: 100,
      pesquisa: 50,
      era: 1,
      rede: {
        usinas: {
          cataVento: { quantidade: 12, nivel: 1 },
          painelSolar: { quantidade: 4, nivel: 0 },
          turbinaEolica: { quantidade: 2, nivel: 0 },
        },
        vilas: 3,
        demandaBaseKw: 5,
        bateria: { unidades: 2, capacidadeKwh: 40, kwh: 10 },
      },
      nucleo: null,
      melhorias: {},
      cardsVistos: [],
      tabuleiro: { regioesDesbloqueadas: ["nucleo", "vento"] },
      salvoEmMs: 1000,
    };
    const s = desserializar(JSON.stringify(v5), 1000);
    expect(s.versao).toBe(6);
    expect(s.rede.usinas.cataVento.nivel).toBe(1);
    expect(quantidadeDe(s, "cataVento")).toBe(12);
    expect(quantidadeDe(s, "painelSolar")).toBe(4);
    expect(quantidadeDe(s, "turbinaEolica")).toBe(2);
    expect(quantidadeDe(s, "vila")).toBe(3 + 1); // as do save + a aldeia de nascença
    expect(quantidadeDe(s, "bateria")).toBe(2);
    expect(s.rede.bateria.kwh).toBe(10);
    expect(s.creditos).toBe(100); // coube tudo: sem reembolso
    // tudo o que foi colocado tem escoamento (a migração completa as subestações)
    const a = analisar(s);
    expect(a.semEscoamentoKw).toBeLessThanOrEqual(a.brutoKw * 0.5);
    expect(a.demandaKw).toBe(4 * VILA.demandaKw);
    // as casas são de terra da ilha principal
    for (const chave of Object.keys(s.mundo.construcoes)) {
      expect(arq.ilha[Number(chave)]).toBe(0);
      expect(arq.obstaculos[Number(chave)]).toBe(255);
    }
  });

  it("unidades que não cabem viram ₵ de volta", () => {
    const livres = arq.ilhas[0].casas.filter((i) => arq.obstaculos[i] === 255 && arq.caminho[i] === 0).length;
    const v5 = {
      versao: 5,
      creditos: 0,
      era: 1,
      rede: {
        usinas: { cataVento: { quantidade: livres + 10, nivel: 0 }, painelSolar: { quantidade: 0, nivel: 0 }, turbinaEolica: { quantidade: 0, nivel: 0 } },
        vilas: 0,
        bateria: { unidades: 0, kwh: 0 },
      },
      nucleo: null,
      salvoEmMs: 1000,
    };
    const s = desserializar(JSON.stringify(v5), 1000);
    expect(quantidadeDe(s, "cataVento")).toBeLessThan(livres + 10);
    expect(s.creditos).toBeGreaterThan(USINAS.cataVento.custoBase);
  });

  it("um save v6 não passa pela migração de novo", () => {
    const s = plantar(estadoInicial(), "cataVento", 2);
    const json = serializar(s, 1000);
    const a = desserializar(json, 1000);
    const b = desserializar(serializar(a, 1000), 1000);
    expect(b.mundo.construcoes).toEqual(a.mundo.construcoes);
    expect(quantidadeDe(b, "cataVento")).toBe(2);
  });
});
