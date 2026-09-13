import { describe, expect, it } from "vitest";
import { BATERIA } from "../../content/era1";
import { absorvivelKw, atualizarBateria, balancoRede, cobrivelKw, passoRede } from "../rede";
import { type BateriaEstado } from "../state";
import { redeDeTeste } from "./ajuda";

/** Rede derivada com `cataVentos` cata-ventos, `bairros` bairros e a bateria pedida. */
function rede(cataVentos: number, bairros: number, bateria: Partial<BateriaEstado> & { unidades: number }) {
  const r = redeDeTeste({ cataVento: cataVentos, bairros, bateria: bateria.unidades, kwh: bateria.kwh ?? 0 });
  if (bateria.capacidadeKwh !== undefined) r.bateria.capacidadeKwh = bateria.capacidadeKwh;
  return r;
}

describe("bateria como amortecedor (GDD §4.1 v0.4)", () => {
  it("cada unidade tem ±10 kW e +20 kWh", () => {
    expect(BATERIA.potenciaKw).toBe(10);
    expect(BATERIA.capacidadeKwh).toBe(20);
  });

  it("r bruto 0,7 com a bateria cobrindo tudo → neutro baixo, ×1", () => {
    // 2 bairros = 16 kW; 11 cata-ventos = 11 kW → r ≈ 0,69 e déficit de 5 kW.
    const b = balancoRede(rede(11, 2, { unidades: 1, kwh: 20 }));
    expect(b.rBruto).toBeCloseTo(11 / 16, 6);
    expect(b.faixaBruta.id).toBe("apagao");
    expect(b.cobertoKw).toBeCloseTo(5, 6);
    expect(b.faixa.id).toBe("neutroBaixo");
    expect(b.multiplicador).toBe(1);
    expect(b.motivoBateria).toBe("cobrindo");
    expect(b.fluxoBateriaKw).toBeCloseTo(-5, 6);
    expect(b.receitaPorSegundo).toBeCloseTo(16, 6); // 11 diretos + 5 da bateria, a ×1
  });

  it("r bruto 0,7 com a bateria vazia → apagão", () => {
    const b = balancoRede(rede(11, 2, { unidades: 1, kwh: 0 }));
    expect(b.cobertoKw).toBe(0);
    expect(b.faixa.id).toBe("apagao");
    expect(b.multiplicador).toBe(0.5);
    expect(b.motivoBateria).toBeNull();
  });

  it("r bruto 1,5 com a bateria absorvendo tudo → neutro alto, ×1", () => {
    // 2 bairros = 16 kW; 24 cata-ventos = 24 kW → excedente de 8 kW, que 1 unidade absorve.
    const b = balancoRede(rede(24, 2, { unidades: 1, kwh: 0 }));
    expect(b.rBruto).toBeCloseTo(1.5, 6);
    expect(b.faixaBruta.id).toBe("saturacao");
    expect(b.absorvidoKw).toBeCloseTo(8, 6);
    expect(b.faixa.id).toBe("neutroAlto");
    expect(b.multiplicador).toBe(1);
    expect(b.motivoBateria).toBe("absorvendo");
    expect(b.fluxoBateriaKw).toBeCloseTo(8, 6);
  });

  it("r bruto 1,5 com a bateria cheia → saturação", () => {
    const b = balancoRede(rede(24, 2, { unidades: 1, kwh: 20 }));
    expect(b.absorvidoKw).toBe(0);
    expect(b.faixa.id).toBe("saturacao");
    expect(b.multiplicador).toBe(0.75);
  });

  it("r bruto 1,0 com a bateria carregando continua ouro (a bateria nunca vira ouro, mas não tira o ouro)", () => {
    const b = balancoRede(rede(8, 1, { unidades: 1, kwh: 0 }));
    expect(b.faixaBruta.id).toBe("zonaDeOuro");
    expect(b.faixa.id).toBe("zonaDeOuro");
    expect(b.absorvidoKw).toBe(0); // sem excedente com r = 1
  });

  it("déficit maior que unidades × 10 kW não é coberto por inteiro → apagão", () => {
    // 3 bairros = 24 kW; 5 kW ofertados → déficit 19 kW > 10 kW de uma unidade.
    const b = balancoRede(rede(5, 3, { unidades: 1, kwh: 20 }));
    expect(b.deficitKw).toBeCloseTo(19, 6);
    expect(b.cobertoKw).toBeCloseTo(10, 6);
    expect(b.faixa.id).toBe("apagao");
    // Com duas unidades (20 kW) cobre tudo.
    const b2 = balancoRede(rede(5, 3, { unidades: 2, kwh: 40 }));
    expect(b2.cobertoKw).toBeCloseTo(19, 6);
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
    const r = rede(11, 2, { unidades: 1, kwh: 20 });
    const passo = passoRede(r, 100);
    // 11 kW diretos + 5 kW da bateria por 0,1 s a ×1 = ₵ 1,6.
    expect(passo.receita).toBeCloseTo(1.6, 6);
    expect(passo.rede.bateria.kwh).toBeCloseTo(20 - 0.5, 6);
  });

  it("offline (semBateria) ignora a bateria e usa a faixa bruta", () => {
    const b = balancoRede(rede(11, 2, { unidades: 1, kwh: 20 }), { semBateria: true });
    expect(b.cobertoKw).toBe(0);
    expect(b.faixa.id).toBe("apagao");
    expect(b.receitaPorSegundo).toBeCloseTo(11 * 0.5, 6);
  });
});
