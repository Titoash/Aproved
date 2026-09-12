import { describe, expect, it } from "vitest";
import { ECONOMIA } from "../../content/era1";
import { balancoRede } from "../rede";
import { estadoInicial } from "../state";
import { avancarTicks, tick, TICK_MS } from "../tick";

describe("tick", () => {
  it("100 ticks (10 s) com 5 kW vendidos a preço 1,0 e r neutro rendem ₵ 50", () => {
    expect(ECONOMIA.precoBase).toBe(1);
    const s0 = estadoInicial();
    s0.creditos = 0;
    // 6 kW ofertados contra 5 kW de demanda: r = 1,2 (faixa neutra, ×1), vende 5 kW.
    s0.rede.usinas.cataVento = { quantidade: 6, nivel: 0 };
    expect(balancoRede(s0.rede).multiplicador).toBe(1);
    expect(balancoRede(s0.rede).vendaDiretaKw).toBe(5);

    const s = avancarTicks(s0, 100);
    expect(s.tempoMs).toBe(100 * TICK_MS);
    expect(s.creditos).toBeCloseTo(50, 6);
  });

  it("tick é puro: não altera o estado de entrada", () => {
    const s0 = estadoInicial();
    s0.rede.usinas.cataVento = { quantidade: 5, nivel: 0 };
    const copia = JSON.parse(JSON.stringify(s0));
    tick(s0, TICK_MS);
    expect(s0).toEqual(copia);
  });

  it("sem usinas não rende nada", () => {
    const s = avancarTicks(estadoInicial(), 10);
    expect(s.creditos).toBe(ECONOMIA.creditosIniciais);
  });

  it("aplica o multiplicador da faixa (zona de ouro ×1,25)", () => {
    const s0 = estadoInicial();
    s0.creditos = 0;
    s0.rede.usinas.cataVento = { quantidade: 5, nivel: 0 }; // r = 1
    const s = avancarTicks(s0, 10); // 1 s
    expect(s.creditos).toBeCloseTo(5 * 1.25, 6);
  });

  it("ordem: excedente carrega a bateria e déficit descarrega vendendo a energia", () => {
    const s0 = estadoInicial();
    s0.creditos = 0;
    s0.rede.usinas.cataVento = { quantidade: 6, nivel: 0 }; // 1 kW de excedente
    s0.rede.bateria = { kwh: 0, capacidadeKwh: 10, unidades: 1, bancos: 0 };
    const s1 = avancarTicks(s0, 10); // 1 s → 1 kWh carregado
    expect(s1.rede.bateria.kwh).toBeCloseTo(1, 6);
    expect(s1.creditos).toBeCloseTo(5, 6);

    // Agora 3 kW ofertados contra 5 kW: déficit de 2 kW coberto pela bateria.
    const s2 = { ...s1, creditos: 0, rede: { ...s1.rede, usinas: { ...s1.rede.usinas, cataVento: { quantidade: 3, nivel: 0 } } } };
    const s3 = avancarTicks(s2, 5); // 0,5 s → descarrega 1 kWh, vende 3 + 2 = 5 kW
    expect(s3.rede.bateria.kwh).toBeCloseTo(0, 6);
    // r bruto = 0,6 (apagão), mas a bateria cobre todo o déficit: faixa neutra ×1 (GDD §4.1 v0.4).
    // 5 kW × 0,5 s × 1 = ₵ 2,5
    expect(s3.creditos).toBeCloseTo(2.5, 6);
    // Bateria vazia: agora é apagão de verdade, ×0,5 sobre os 3 kW diretos.
    const s4 = avancarTicks({ ...s3, creditos: 0 }, 10);
    expect(s4.creditos).toBeCloseTo(3 * 0.5, 6);
  });
});
