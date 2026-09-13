import { describe, expect, it } from "vitest";
import { ESCALA_KARDASHEV, MARCOS_KARDASHEV } from "../content/kardashev";
import { formatarWatts, posicaoNaBarra, proximoMarco } from "./kardashev";

describe("Kardashev I–V (GDD §6, v0.5)", () => {
  it("a régua vai até 10⁵⁰ W e os tipos IV e V são especulativos", () => {
    expect(ESCALA_KARDASHEV.maxW).toBe(1e50);
    expect(posicaoNaBarra(1e50)).toBe(1);
    expect(posicaoNaBarra(1e27)).toBeLessThan(1);
    const ids = MARCOS_KARDASHEV.map((m) => m.id);
    expect(ids).toEqual(["megawatt", "humanidade", "tipoI", "tipoII", "sol", "tipoIII", "tipoIV", "tipoV"]);
    expect(MARCOS_KARDASHEV.filter((m) => m.especulativo).map((m) => m.id)).toEqual(["tipoIV", "tipoV"]);
  });

  it("o próximo marco depois do Sol é o Tipo III", () => {
    expect(proximoMarco(4e26)?.id).toBe("tipoIII");
    expect(proximoMarco(1e49)?.id).toBe("tipoV");
    expect(proximoMarco(1e50)).toBeNull();
  });

  it("prefixos SI até o yotta; acima só notação científica", () => {
    expect(formatarWatts(2e15)).toBe("2×10¹⁵ W (2 PW)");
    expect(formatarWatts(3e23)).toBe("3×10²³ W (300 ZW)");
    expect(formatarWatts(1e30)).toBe("1×10³⁰ W");
  });
});
