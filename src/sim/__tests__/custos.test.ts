import { describe, expect, it } from "vitest";
import { MELHORIA, USINAS, VILA } from "../../content/era1";
import { custoMelhoria, custoUnidade, fatorMelhoria } from "../custos";

describe("custoUnidade", () => {
  it("a 1ª unidade custa o custo base", () => {
    expect(custoUnidade(USINAS.cataVento, 0)).toBe(USINAS.cataVento.custoBase);
  });

  it("a n-ésima unidade custa custoBase × crescimento^(n−1)", () => {
    const { custoBase, crescimento } = USINAS.cataVento;
    expect(custoUnidade(USINAS.cataVento, 1)).toBeCloseTo(custoBase * crescimento, 10);
    expect(custoUnidade(USINAS.cataVento, 2)).toBeCloseTo(custoBase * crescimento ** 2, 10);
    expect(custoUnidade(USINAS.cataVento, 10)).toBeCloseTo(custoBase * crescimento ** 10, 10);
  });

  it("vilas crescem ×1,25 (GDD §7)", () => {
    expect(VILA.crescimento).toBe(1.25);
    expect(custoUnidade(VILA, 0)).toBe(40);
    expect(custoUnidade(VILA, 1)).toBe(50);
    expect(custoUnidade(VILA, 3)).toBeCloseTo(VILA.custoBase * 1.25 ** 3, 10);
    expect(custoUnidade({ custoBase: 100, crescimento: 2 }, 3)).toBe(800);
  });
});

describe("custoMelhoria", () => {
  it("custa custoBase × 3^nível para o nível comprado (GDD §7)", () => {
    expect(MELHORIA.crescimento).toBe(3);
    expect(custoMelhoria(USINAS.cataVento, 0)).toBe(15 * 3); // nível 1
    expect(custoMelhoria(USINAS.cataVento, 1)).toBe(15 * 9); // nível 2
    expect(custoMelhoria(USINAS.painelSolar, 2)).toBe(60 * 27); // nível 3
  });

  it("o fator de melhoria cresce com o nível", () => {
    expect(fatorMelhoria(0)).toBe(1);
    expect(fatorMelhoria(1)).toBe(1 + MELHORIA.bonusPorNivel);
    expect(fatorMelhoria(2)).toBe(1 + 2 * MELHORIA.bonusPorNivel);
  });
});
