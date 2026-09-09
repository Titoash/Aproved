import { describe, expect, it } from "vitest";
import { BATERIA } from "../../content/era1";
import { absorvivelKw, atualizarBateria, balancoRede, cobrivelKw, passoRede } from "../rede";
import { estadoInicial, type BateriaEstado } from "../state";

function rede(cataVentos: number, vilas: number, bateria: Partial<BateriaEstado> & { unidades: number }) {
  const s = estadoInicial();
  s.rede.usinas.cataVento = { quantidade: cataVentos, nivel: 0 };
  s.rede.vilas = vilas;
  const capacidadeKwh = bateria.capacidadeKwh ?? bateria.unidades * BATERIA.capacidadeKwh;
  s.rede.bateria = { unidades: bateria.unidades, capacidadeKwh, kwh: bateria.kwh ?? 0 };
  return s.rede;
}

describe("bateria como amortecedor (GDD §4.1 v0.4)", () => {
  it("cada unidade tem ±10 kW e +20 kWh", () => {
    expect(BATERIA.potenciaKw).toBe(10);
    expect(BATERIA.capacidadeKwh).toBe(20);
  });

  it("r bruto 0,7 com a bateria cobrindo tudo → neutro baixo, ×1", () => {
    // 7 kW contra 10 kW? Demanda 5 + vila 8 = 13 kW; 9 cata-ventos = 9 kW → r ≈ 0,69.
    const b = balancoRede(rede(9, 1, { unidades: 1, kwh: 20 }));
    expect(b.rBruto).toBeCloseTo(9 / 13, 6);
    expect(b.faixaBruta.id).toBe("apagao");
    expect(b.cobertoKw).toBeCloseTo(4, 6);
    expect(b.faixa.id).toBe("neutroBaixo");
    expect(b.multiplicador).toBe(1);
    expect(b.motivoBateria).toBe("cobrindo");
    expect(b.fluxoBateriaKw).toBeCloseTo(-4, 6);
    expect(b.receitaPorSegundo).toBeCloseTo(13, 6); // 9 diretos + 4 da bateria, a ×1
  });

  it("r bruto 0,7 com a bateria vazia → apagão", () => {
    const b = balancoRede(rede(9, 1, { unidades: 1, kwh: 0 }));
    expect(b.cobertoKw).toBe(0);
    expect(b.faixa.id).toBe("apagao");
    expect(b.multiplicador).toBe(0.5);
    expect(b.motivoBateria).toBeNull();
  });

  it("r bruto 1,4 com a bateria absorvendo tudo → neutro alto, ×1", () => {
    const b = balancoRede(rede(7, 0, { unidades: 1, kwh: 0 }));
    expect(b.rBruto).toBeCloseTo(1.4, 6);
    expect(b.faixaBruta.id).toBe("saturacao");
    expect(b.absorvidoKw).toBeCloseTo(2, 6);
    expect(b.faixa.id).toBe("neutroAlto");
    expect(b.multiplicador).toBe(1);
    expect(b.motivoBateria).toBe("absorvendo");
    expect(b.fluxoBateriaKw).toBeCloseTo(2, 6);
  });

  it("r bruto 1,4 com a bateria cheia → saturação", () => {
    const b = balancoRede(rede(7, 0, { unidades: 1, kwh: 20 }));
    expect(b.absorvidoKw).toBe(0);
    expect(b.faixa.id).toBe("saturacao");
    expect(b.multiplicador).toBe(0.75);
  });

  it("r bruto 1,0 com a bateria carregando continua ouro (a bateria nunca vira ouro, mas não tira o ouro)", () => {
    const b = balancoRede(rede(5, 0, { unidades: 1, kwh: 0 }));
    expect(b.faixaBruta.id).toBe("zonaDeOuro");
    expect(b.faixa.id).toBe("zonaDeOuro");
    expect(b.absorvidoKw).toBe(0); // sem excedente com r = 1
  });

  it("déficit maior que unidades × 10 kW não é coberto por inteiro → apagão", () => {
    // Demanda 5 + 2 vilas = 21 kW; 5 kW ofertados → déficit 16 kW > 10 kW de uma unidade.
    const b = balancoRede(rede(5, 2, { unidades: 1, kwh: 20 }));
    expect(b.deficitKw).toBeCloseTo(16, 6);
    expect(b.cobertoKw).toBeCloseTo(10, 6);
    expect(b.faixa.id).toBe("apagao");
    // Com duas unidades (20 kW) cobre tudo.
    const b2 = balancoRede(rede(5, 2, { unidades: 2, kwh: 40 }));
    expect(b2.cobertoKw).toBeCloseTo(16, 6);
    expect(b2.faixa.id).toBe("neutroBaixo");
  });

  it("a energia guardada também limita o que cobre num tick", () => {
    const bateria: BateriaEstado = { unidades: 1, capacidadeKwh: 20, kwh: 0.5 };
    // 0,5 kWh em 0,1 s sustentam 5 kW.
    expect(cobrivelKw(bateria, 8, 0.1)).toBeCloseTo(5, 6);
    expect(absorvivelKw({ ...bateria, kwh: 19.5 }, 8, 0.1)).toBeCloseTo(5, 6);
    expect(cobrivelKw(bateria, 8, 1)).toBeCloseTo(0.5, 6);
  });

  it("carga e descarga respeitam a potência da unidade", () => {
    const bateria: BateriaEstado = { unidades: 1, capacidadeKwh: 20, kwh: 10 };
    const carga = atualizarBateria(bateria, 25, 0, 1);
    expect(carga.carregadoKwh).toBeCloseTo(10, 6); // 10 kW × 1 s, não 25
    const descarga = atualizarBateria(bateria, 0, 25, 1);
    expect(descarga.descarregadoKwh).toBeCloseTo(10, 6);
    expect(descarga.bateria.kwh).toBeCloseTo(0, 6);
  });

  it("no passo da rede o multiplicador efetivo vale para toda a energia vendida", () => {
    const r = rede(9, 1, { unidades: 1, kwh: 20 });
    const passo = passoRede(r, 100);
    // 9 kW diretos + 4 kW da bateria por 0,1 s a ×1 = ₵ 1,3.
    expect(passo.receita).toBeCloseTo(1.3, 6);
    expect(passo.rede.bateria.kwh).toBeCloseTo(20 - 0.4, 6);
  });

  it("offline (semBateria) ignora a bateria e usa a faixa bruta", () => {
    const b = balancoRede(rede(9, 1, { unidades: 1, kwh: 20 }), { semBateria: true });
    expect(b.cobertoKw).toBe(0);
    expect(b.faixa.id).toBe("apagao");
    expect(b.receitaPorSegundo).toBeCloseTo(9 * 0.5, 6);
  });
});
