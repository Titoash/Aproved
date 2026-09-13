import { describe, expect, it } from "vitest";
import { ECONOMIA } from "../../content/era1";
import { DENSIDADES } from "../../content/cidade-era1";
import { balancoDoEstado, avancarTicks, tick, TICK_MS } from "../tick";
import { estadoInicial } from "../state";
import { estadoLimpo, plantar } from "./ajuda";

/** Um bairro (8 kW de demanda) e `n` cata-ventos em terreno neutro (1 kW cada), todos com escoamento. */
function comRede(cataVentos: number, creditos = 0) {
  return plantar(plantar({ ...estadoLimpo(creditos) }, "bairro", 1), "cataVento", cataVentos);
}

describe("tick", () => {
  it("100 ticks (10 s) vendendo 8 kW a preço 1,0 com r neutro rendem ₵ 80", () => {
    expect(ECONOMIA.precoBase).toBe(1);
    // 10 kW ofertados contra 8 kW de demanda: r = 1,25 (faixa neutra, ×1), vende 8 kW.
    const s0 = comRede(10);
    expect(balancoDoEstado(s0).multiplicador).toBe(1);
    expect(balancoDoEstado(s0).vendaDiretaKw).toBe(DENSIDADES[0].demandaKw);

    const s = avancarTicks(s0, 100);
    expect(s.tempoMs).toBe(100 * TICK_MS);
    expect(s.creditos).toBeCloseTo(80, 6);
  });

  it("tick é puro: não altera o estado de entrada", () => {
    const s0 = comRede(5);
    const copia = JSON.parse(JSON.stringify(s0));
    tick(s0, TICK_MS);
    expect(JSON.parse(JSON.stringify(s0))).toEqual(copia);
  });

  it("sem usinas não rende nada", () => {
    const s = avancarTicks(estadoInicial(), 10);
    expect(s.creditos).toBe(ECONOMIA.creditosIniciais);
  });

  it("aplica o multiplicador da faixa (zona de ouro ×1,25)", () => {
    const s0 = comRede(8); // r = 1
    const s = avancarTicks(s0, 10); // 1 s
    expect(s.creditos).toBeCloseTo(8 * 1.25, 6);
  });

  it("ordem: excedente carrega a bateria e déficit descarrega vendendo a energia", () => {
    const s0 = plantar(comRede(10), "bateria", 1); // 2 kW de excedente
    const s1 = avancarTicks(s0, 10); // 1 s → 2 kWh carregados
    expect(s1.rede.bateria.kwh).toBeCloseTo(2, 6);
    expect(s1.creditos).toBeCloseTo(8, 6);

    // Agora 5 kW ofertados contra 8 kW: déficit de 3 kW coberto pela bateria.
    const construcoes = { ...s1.mundo.construcoes };
    let tirados = 0;
    for (const chave of Object.keys(construcoes)) {
      if (tirados >= 5) break;
      if (construcoes[Number(chave)].tipo !== "cataVento") continue;
      delete construcoes[Number(chave)];
      tirados++;
    }
    const s2 = { ...s1, creditos: 0, mundo: { ...s1.mundo, construcoes } };
    const s3 = avancarTicks(s2, 5); // 0,5 s → descarrega 1,5 kWh, vende 5 + 3 = 8 kW
    expect(s3.rede.bateria.kwh).toBeCloseTo(0.5, 6);
    // r bruto = 0,625 (apagão), mas a bateria cobre todo o déficit: faixa neutra ×1 (GDD §4.1 v0.4).
    expect(s3.creditos).toBeCloseTo(4, 6);
    // Bateria esgotada: volta a ser apagão de verdade, ×0,5 sobre os 5 kW diretos.
    const s4 = avancarTicks({ ...s3, creditos: 0, rede: { ...s3.rede, bateria: { kwh: 0 } } }, 10);
    expect(s4.creditos).toBeCloseTo(5 * 0.5, 6);
  });
});
