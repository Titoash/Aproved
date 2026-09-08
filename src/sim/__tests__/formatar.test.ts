import { describe, expect, it } from "vitest";
import {
  formatarCreditos,
  formatarEnergia,
  formatarMultiplicador,
  formatarPotencia,
  formatarRazao,
  formatarTaxa,
} from "../formatar";

describe("formatarPotencia", () => {
  it("usa prefixos SI e vírgula decimal", () => {
    expect(formatarPotencia(1200)).toBe("1,2 MW");
    expect(formatarPotencia(5)).toBe("5 kW");
    expect(formatarPotencia(5.75)).toBe("5,75 kW");
    expect(formatarPotencia(12.5)).toBe("12,5 kW");
    expect(formatarPotencia(850)).toBe("850 kW");
    expect(formatarPotencia(2_500_000)).toBe("2,5 GW");
    expect(formatarPotencia(0)).toBe("0 kW");
  });
});

describe("formatarCreditos", () => {
  it("abaixo de mil mostra até uma casa", () => {
    expect(formatarCreditos(50)).toBe("₵ 50");
    expect(formatarCreditos(11.5)).toBe("₵ 11,5");
    expect(formatarCreditos(13.225)).toBe("₵ 13,2");
    expect(formatarCreditos(0)).toBe("₵ 0");
  });

  it("usa mil / mi / bi / tri", () => {
    expect(formatarCreditos(12_500)).toBe("₵ 12,5 mil");
    expect(formatarCreditos(1_250)).toBe("₵ 1,25 mil");
    expect(formatarCreditos(3_400_000)).toBe("₵ 3,4 mi");
    expect(formatarCreditos(7_000_000_000)).toBe("₵ 7 bi");
    expect(formatarCreditos(1.5e12)).toBe("₵ 1,5 tri");
  });
});

describe("outros formatos", () => {
  it("taxa, energia, razão e multiplicador", () => {
    expect(formatarTaxa(4)).toBe("₵ 4/s");
    expect(formatarEnergia(1500)).toBe("1,5 MWh");
    expect(formatarRazao(1.15)).toBe("1,15");
    expect(formatarRazao(Infinity)).toBe("∞");
    expect(formatarMultiplicador(1.25)).toBe("×1,25");
  });
});
