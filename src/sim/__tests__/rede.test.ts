import { describe, expect, it } from "vitest";
import { ECONOMIA, USINAS, VILA } from "../../content/era1";
import {
  atualizarBateria,
  balancoRede,
  demandaKw,
  faixaDeR,
  multiplicadorPreco,
  potenciaOfertadaKw,
} from "../rede";
import { estadoInicial } from "../state";

describe("multiplicador de preço por faixa de r", () => {
  it("0,7 → apagão ×0,5", () => {
    expect(multiplicadorPreco(0.7)).toBe(0.5);
    expect(faixaDeR(0.7).id).toBe("apagao");
  });

  it("1,0 → zona de ouro ×1,25", () => {
    expect(multiplicadorPreco(1.0)).toBe(1.25);
    expect(faixaDeR(1.0).id).toBe("zonaDeOuro");
  });

  it("1,3 → saturação ×0,75", () => {
    expect(multiplicadorPreco(1.3)).toBe(0.75);
    expect(faixaDeR(1.3).id).toBe("saturacao");
  });

  it("1,15 → neutro ×1", () => {
    expect(multiplicadorPreco(1.15)).toBe(1);
    expect(faixaDeR(1.15).id).toBe("neutroAlto");
    expect(faixaDeR(1.15).nome).toBe("Neutro");
  });

  it("0,85 → neutro ×1", () => {
    expect(multiplicadorPreco(0.85)).toBe(1);
    expect(faixaDeR(0.85).id).toBe("neutroBaixo");
  });

  it("limites do GDD §4.1: 0,8 · 0,9 · 1,1 · 1,25", () => {
    expect(faixaDeR(0.79).id).toBe("apagao");
    expect(faixaDeR(0.8).id).toBe("neutroBaixo");
    expect(faixaDeR(0.9).id).toBe("zonaDeOuro");
    expect(faixaDeR(1.1).id).toBe("zonaDeOuro");
    expect(faixaDeR(1.1000001).id).toBe("neutroAlto");
    expect(faixaDeR(1.25).id).toBe("neutroAlto");
    expect(faixaDeR(1.2500001).id).toBe("saturacao");
    expect(faixaDeR(0).id).toBe("apagao");
    expect(faixaDeR(Infinity).id).toBe("saturacao");
  });
});

describe("oferta e demanda", () => {
  it("estado inicial: 0 kW ofertados e demanda de 5 kW", () => {
    const { rede } = estadoInicial();
    expect(potenciaOfertadaKw(rede)).toBe(0);
    expect(demandaKw(rede)).toBe(ECONOMIA.demandaInicialKw);
    expect(balancoRede(rede).faixa.id).toBe("apagao");
  });

  it("cada vila soma sua demanda e cada usina soma sua potência", () => {
    const s = estadoInicial();
    s.rede.vilas = 2;
    s.rede.usinas.cataVento = { quantidade: 4, nivel: 0 };
    s.rede.usinas.painelSolar = { quantidade: 1, nivel: 1 };
    expect(demandaKw(s.rede)).toBe(ECONOMIA.demandaInicialKw + 2 * VILA.demandaKw);
    expect(potenciaOfertadaKw(s.rede)).toBeCloseTo(
      4 * USINAS.cataVento.potenciaKw + 1 * USINAS.painelSolar.potenciaKw * 1.5,
      10,
    );
  });

  it("acima de 1,25 × demanda entra em saturação e o preço cai", () => {
    const s = estadoInicial();
    s.rede.usinas.cataVento = { quantidade: 7, nivel: 0 }; // 7 kW contra 5 kW
    const b = balancoRede(s.rede);
    expect(b.r).toBeCloseTo(1.4, 10);
    expect(b.faixa.id).toBe("saturacao");
    expect(b.multiplicador).toBe(0.75);
    expect(b.vendaDiretaKw).toBe(5);
    expect(b.excedenteKw).toBe(2);
  });
});

describe("bateria", () => {
  const bateria = { kwh: 0, capacidadeKwh: 10, unidades: 1, bancos: 0 };

  it("a escala da bateria é 1 kWh por kW·s (ver ESTADO.md)", () => {
    expect(ECONOMIA.kwhPorKwSegundo).toBe(1);
  });

  it("carrega com o excedente", () => {
    const r = atualizarBateria(bateria, 2, 0, 0.5); // 2 kW × 0,5 s = 1 kWh
    expect(r.carregadoKwh).toBe(1);
    expect(r.descarregadoKwh).toBe(0);
    expect(r.bateria.kwh).toBe(1);
  });

  it("não passa da capacidade", () => {
    const r = atualizarBateria({ ...bateria, kwh: 9.5 }, 2, 0, 0.5);
    expect(r.carregadoKwh).toBe(0.5);
    expect(r.bateria.kwh).toBe(10);
  });

  it("descarrega em déficit", () => {
    const r = atualizarBateria({ ...bateria, kwh: 4 }, 0, 3, 0.5); // 3 kW × 0,5 s = 1,5 kWh
    expect(r.descarregadoKwh).toBe(1.5);
    expect(r.carregadoKwh).toBe(0);
    expect(r.bateria.kwh).toBe(2.5);
  });

  it("não descarrega abaixo de zero", () => {
    const r = atualizarBateria({ ...bateria, kwh: 1 }, 0, 3, 0.5);
    expect(r.descarregadoKwh).toBe(1);
    expect(r.bateria.kwh).toBe(0);
  });

  it("sem capacidade não faz nada", () => {
    const r = atualizarBateria({ kwh: 0, capacidadeKwh: 0, unidades: 0, bancos: 0 }, 5, 0, 1);
    expect(r.carregadoKwh).toBe(0);
    expect(r.bateria.kwh).toBe(0);
  });
});
