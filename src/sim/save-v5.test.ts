import { describe, expect, it } from "vitest";
import { REGIOES_INICIAIS } from "../content/era1-tabuleiro";
import { desserializar, serializar } from "./save";
import { estadoInicial, VERSAO_SAVE } from "./state";

describe("save v5 (tabuleiro)", () => {
  it("serializa e lê de volta as regiões desbloqueadas na ordem", () => {
    const s = { ...estadoInicial(), tabuleiro: { regioesDesbloqueadas: [...REGIOES_INICIAIS, "colinas" as const] } };
    const lido = desserializar(serializar(s, 1000), 1000);
    expect(lido.versao).toBe(VERSAO_SAVE);
    expect(lido.tabuleiro.regioesDesbloqueadas).toEqual([...REGIOES_INICIAIS, "colinas"]);
  });

  it("migra um save v4 acrescentando o tabuleiro com as regiões iniciais", () => {
    const v4 = { ...estadoInicial(), versao: 4 } as Record<string, unknown>;
    delete v4.tabuleiro;
    const lido = desserializar(JSON.stringify(v4), 1000);
    expect(lido.versao).toBe(5);
    expect(lido.tabuleiro.regioesDesbloqueadas).toEqual([...REGIOES_INICIAIS]);
  });

  it("ignora ids desconhecidos e nunca perde as regiões iniciais", () => {
    const s = { ...estadoInicial(), tabuleiro: { regioesDesbloqueadas: ["planicie", "lua"] as never } };
    const lido = desserializar(serializar(s, 1000), 1000);
    expect(lido.tabuleiro.regioesDesbloqueadas).toEqual([...REGIOES_INICIAIS, "planicie"]);
  });
});
