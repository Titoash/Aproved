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

  it("vale para qualquer definição com custoBase e crescimento", () => {
    expect(custoUnidade(VILA, 3)).toBeCloseTo(VILA.custoBase * VILA.crescimento ** 3, 10);
    expect(custoUnidade({ custoBase: 100, crescimento: 2 }, 3)).toBe(800);
  });
});

describe("custoMelhoria", () => {
  it("o nível 1 custa custoBase × custoMult", () => {
    expect(custoMelhoria(USINAS.cataVento, 0)).toBe(USINAS.cataVento.custoBase * MELHORIA.custoMult);
  });

  it("cada nível seguinte multiplica pelo crescimento da melhoria", () => {
    const base = USINAS.painelSolar.custoBase * MELHORIA.custoMult;
    expect(custoMelhoria(USINAS.painelSolar, 1)).toBeCloseTo(base * MELHORIA.crescimento, 10);
    expect(custoMelhoria(USINAS.painelSolar, 2)).toBeCloseTo(base * MELHORIA.crescimento ** 2, 10);
  });

  it("o fator de melhoria cresce com o nível", () => {
    expect(fatorMelhoria(0)).toBe(1);
    expect(fatorMelhoria(1)).toBe(1 + MELHORIA.bonusPorNivel);
    expect(fatorMelhoria(2)).toBe(1 + 2 * MELHORIA.bonusPorNivel);
  });
});
