import { describe, expect, it } from "vitest";
import { BATERIA } from "../../content/era1";
import { USINAS } from "../../content/usinas";
import { desbloqueado, tipoDisponivel } from "../acoes";
import { pesquisar } from "../arvore";
import { NO_POR_ID } from "../../content/arvore";
import { estadoLimpo, plantar } from "./ajuda";

describe("ações da Rede (desbloqueios; os níveis estão em melhorias.test.ts)", () => {
  it("respeita o desbloqueio por quantidade colocada", () => {
    const s = estadoLimpo();
    expect(desbloqueado(s, USINAS.painelSolar.desbloqueio)).toBe(false);
    expect(tipoDisponivel(s, "painelSolar")).toBe(false);
    const [, n] = USINAS.painelSolar.desbloqueio!.usina!;
    const s1 = plantar(s, "cataVento", n);
    expect(desbloqueado(s1, USINAS.painelSolar.desbloqueio)).toBe(true);
    expect(tipoDisponivel(s1, "painelSolar")).toBe(true);
  });

  it("desbloqueio por nó da árvore: só libera com o nó comprado, e o nó gasta 🔬 (v0.6)", () => {
    const s = estadoLimpo();
    expect(USINAS.turbinaEolica.desbloqueio?.no).toBe("turbinaEolica");
    expect(BATERIA.desbloqueio?.no).toBe("bateria");
    expect(tipoDisponivel(s, "turbinaEolica")).toBe(false);
    expect(tipoDisponivel(s, "bateria")).toBe(false);

    const comCiencia = { ...s, pesquisa: 100 };
    const comBateria = pesquisar(comCiencia, "bateria")!;
    expect(tipoDisponivel(comBateria, "bateria")).toBe(true);
    expect(tipoDisponivel(comBateria, "turbinaEolica")).toBe(false);
    expect(comBateria.pesquisa).toBe(100 - NO_POR_ID.bateria.pesquisa); // 🔬 é gasto, não limiar

    const comTurbina = pesquisar(comBateria, "turbinaEolica")!;
    expect(tipoDisponivel(comTurbina, "turbinaEolica")).toBe(true);
  });
});
