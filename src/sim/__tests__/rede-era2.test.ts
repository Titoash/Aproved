import { describe, expect, it } from "vitest";
import { BANCO_DE_BATERIAS, CIDADE, ECONOMIA_ERA2, USINAS_ERA2 } from "../../content/era2";
import { usinasAte, USINAS_TODAS } from "../../content/eras";
import {
  comprarBanco,
  comprarCidade,
  comprarUsina,
  custoProximaCidade,
  custoProximoBanco,
  desbloqueado,
  podeComprarBanco,
  podeComprarCidade,
  podeComprarUsina,
} from "../acoes";
import { formatarPotencia } from "../formatar";
import { balancoRede, capacidadeBateriaKwh, demandaKw, potenciaBateriaKw } from "../rede";
import { estadoInicial, type GameState } from "../state";

function naEra2(extra: Partial<GameState> = {}): GameState {
  return { ...estadoInicial(), era: 2, creditos: 1_000_000, pesquisa: 10_000, ...extra };
}

describe("Rede da Era 2 (GDD §8.5.2)", () => {
  it("as usinas da Era 2 só aparecem na Era 2; as da Era 1 continuam na lista", () => {
    expect(usinasAte(1)).toEqual(["cataVento", "painelSolar", "turbinaEolica"]);
    expect(usinasAte(2)).toEqual(["cataVento", "painelSolar", "turbinaEolica", "hidreletrica", "termeletricaGas", "usinaNuclear"]);

    const era1 = { ...estadoInicial(), creditos: 1_000_000, pesquisa: 10_000 };
    expect(desbloqueado(era1, USINAS_ERA2.hidreletrica.desbloqueio)).toBe(false);
    expect(podeComprarUsina(era1, "hidreletrica")).toBe(false);
    expect(podeComprarUsina(naEra2(), "hidreletrica")).toBe(true);
  });

  it("a usina nuclear ainda exige 🔬 6 000, mesmo na Era 2", () => {
    expect(podeComprarUsina(naEra2({ pesquisa: 5999 }), "usinaNuclear")).toBe(false);
    expect(podeComprarUsina(naEra2({ pesquisa: 6000 }), "usinaNuclear")).toBe(true);
  });

  it("a hidrelétrica entrega 100 kW e entra na oferta", () => {
    expect(USINAS_TODAS.hidreletrica.potenciaKw).toBe(100);
    const s = comprarUsina(naEra2(), "hidreletrica")!;
    expect(balancoRede(s.rede, { era: 2 }).ofertaUsinasKw).toBe(100);
  });

  it("a cidade soma 800 kW de demanda e a vila continua somando 8", () => {
    const s = comprarCidade(naEra2())!;
    expect(custoProximaCidade(naEra2())).toBe(CIDADE.custoBase);
    expect(s.rede.cidades).toBe(1);
    expect(demandaKw(s.rede)).toBe(s.rede.demandaBaseKw + 800);
    const comVila = { ...s, rede: { ...s.rede, vilas: 2 } };
    expect(demandaKw(comVila.rede)).toBe(s.rede.demandaBaseKw + 800 + 16);
  });

  it("a cidade não é comprável na Era 1", () => {
    expect(podeComprarCidade({ ...estadoInicial(), creditos: 1_000_000 })).toBe(false);
    expect(comprarCidade({ ...estadoInicial(), creditos: 1_000_000 })).toBeNull();
  });

  it("o banco de baterias soma 2 000 kWh e ±1 000 kW, junto com as baterias da Era 1", () => {
    expect(custoProximoBanco(naEra2())).toBe(BANCO_DE_BATERIAS.custoBase);
    const s = comprarBanco(naEra2())!;
    expect(s.rede.bateria.bancos).toBe(1);
    expect(s.rede.bateria.capacidadeKwh).toBe(2000);
    expect(potenciaBateriaKw(s.rede.bateria)).toBe(1000);

    const misto = { ...s.rede.bateria, unidades: 3 };
    expect(capacidadeBateriaKwh(3, 1)).toBe(3 * 20 + 2000);
    expect(potenciaBateriaKw(misto)).toBe(3 * 10 + 1000);
  });

  it("o banco não é comprável na Era 1", () => {
    expect(podeComprarBanco({ ...estadoInicial(), creditos: 1_000_000 })).toBe(false);
  });
});

describe("preço e escala da Era 2 (GDD §7, §8.5.2)", () => {
  it("o preço base da Era 2 é um décimo do da Era 1", () => {
    expect(ECONOMIA_ERA2.precoBase).toBe(0.1);
  });

  it("a mesma venda rende dez vezes menos ₵ na Era 2", () => {
    const s = comprarUsina(naEra2(), "hidreletrica")!;
    const rede = { ...s.rede, demandaBaseKw: 100, cidades: 0 };
    const era1 = balancoRede(rede, { era: 1 });
    const era2 = balancoRede(rede, { era: 2 });
    expect(era2.vendaDiretaKw).toBe(era1.vendaDiretaKw);
    expect(era2.receitaPorSegundo).toBeCloseTo(era1.receitaPorSegundo * 0.1, 10);
  });

  it("a potência do exemplo de equilíbrio aparece em MW com vírgula", () => {
    // O formatador já solta zeros à direita: é o comportamento da Era 1.
    expect(formatarPotencia(1440)).toBe("1,44 MW");
    expect(formatarPotencia(16)).toBe("16 kW");
    expect(formatarPotencia(1_599)).toBe("1,6 MW");
    expect(formatarPotencia(2_500_000)).toBe("2,5 GW");
  });
});
