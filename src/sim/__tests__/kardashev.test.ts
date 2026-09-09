import { describe, expect, it } from "vitest";
import { MARCOS_KARDASHEV } from "../../content/kardashev";
import { formatarWatts, indiceK, kVisivel, posicaoNaBarra, potenciaInstaladaW, proximoMarco } from "../kardashev";
import { equilibrioU } from "../nucleo";
import { estadoInicial, nucleoInicial } from "../state";
import { configuracao } from "./nucleo.test";

describe("medidor Kardashev (GDD §6)", () => {
  it("16 kW → K negativo → abaixo da escala", () => {
    const w = 16_000;
    expect(indiceK(w)).toBeLessThan(0);
    expect(kVisivel(w)).toBe(false);
    expect(proximoMarco(w)?.id).toBe("megawatt");
  });

  it("1 MW → K = 0,00", () => {
    expect(indiceK(1e6)).toBeCloseTo(0, 10);
    expect(kVisivel(1e6)).toBe(true);
    expect(indiceK(1e16)).toBeCloseTo(1, 10);
    expect(indiceK(1e26)).toBeCloseTo(2, 10);
    expect(indiceK(0)).toBeNull();
  });

  it("2×10¹³ W cai sobre o marco da humanidade", () => {
    const humanidade = MARCOS_KARDASHEV.find((m) => m.id === "humanidade")!;
    expect(posicaoNaBarra(2e13)).toBeCloseTo(posicaoNaBarra(humanidade.watts), 12);
    expect(posicaoNaBarra(1e3)).toBe(0);
    expect(posicaoNaBarra(1e27)).toBe(1);
    expect(posicaoNaBarra(1e15)).toBeCloseTo(0.5, 10);
    expect(proximoMarco(2e13)?.id).toBe("tipoI");
    expect(proximoMarco(1e30)).toBeNull();
  });

  it("potência instalada soma usinas e Núcleo, em W, vendida ou não", () => {
    const s = estadoInicial();
    s.rede.usinas.cataVento = { quantidade: 5, nivel: 0 };
    const grade = configuracao(5);
    s.nucleo = { ...nucleoInicial(), grade, calorU: equilibrioU(grade) };
    expect(potenciaInstaladaW(s)).toBeCloseTo(21_000, 3); // 5 kW + 16 kW, demanda é só 5 kW
  });

  it("formatação", () => {
    expect(formatarWatts(16_000)).toBe("1,6×10⁴ W");
    expect(formatarWatts(1e6)).toBe("1×10⁶ W (1 MW)");
    expect(formatarWatts(1.6e7)).toBe("1,6×10⁷ W (16 MW)");
    expect(formatarWatts(2e13)).toBe("2×10¹³ W (20 TW)");
    expect(formatarWatts(9.97e5)).toBe("1×10⁶ W (1 MW)");
    expect(formatarWatts(0)).toBe("0 W");
  });
});
