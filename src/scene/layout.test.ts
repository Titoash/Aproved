import { describe, expect, it } from "vitest";
import { indiceDaCasa } from "./layout";

describe("indiceDaCasa", () => {
  const rect = { left: 100, top: 50, width: 200, height: 200 };

  it("cobre os cantos", () => {
    expect(indiceDaCasa(100, 50, rect, 5)).toBe(0);
    expect(indiceDaCasa(299.9, 50, rect, 5)).toBe(4);
    expect(indiceDaCasa(100, 249.9, rect, 5)).toBe(20);
    expect(indiceDaCasa(299.9, 249.9, rect, 5)).toBe(24);
    expect(indiceDaCasa(200, 150, rect, 5)).toBe(12);
  });

  it("devolve null fora da grade", () => {
    expect(indiceDaCasa(99.9, 60, rect, 5)).toBeNull();
    expect(indiceDaCasa(300, 60, rect, 5)).toBeNull();
    expect(indiceDaCasa(150, 49.9, rect, 5)).toBeNull();
    expect(indiceDaCasa(150, 250, rect, 5)).toBeNull();
  });

  it("centraliza o quadrado num retângulo largo", () => {
    const largo = { left: 0, top: 0, width: 400, height: 200 };
    expect(indiceDaCasa(50, 100, largo, 5)).toBeNull(); // faixa vazia à esquerda
    expect(indiceDaCasa(100, 0, largo, 5)).toBe(0);
    expect(indiceDaCasa(299.9, 199.9, largo, 5)).toBe(24);
    expect(indiceDaCasa(0, 0, { left: 0, top: 0, width: 0, height: 0 }, 5)).toBeNull();
  });
});
