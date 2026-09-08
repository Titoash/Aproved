import { describe, expect, it } from "vitest";
import { BATERIA, USINAS, VILA } from "../../content/era1";
import { comprarBateria, comprarUsina, comprarVila, desbloqueado, melhorarUsina } from "../acoes";
import { custoMelhoria, custoUnidade } from "../custos";
import { potenciaOfertadaKw } from "../rede";
import { estadoInicial } from "../state";

describe("ações", () => {
  it("comprar usina desconta o custo e aumenta a potência", () => {
    const s0 = estadoInicial();
    const s1 = comprarUsina(s0, "cataVento")!;
    expect(s1.creditos).toBeCloseTo(s0.creditos - USINAS.cataVento.custoBase, 10);
    expect(s1.rede.usinas.cataVento.quantidade).toBe(1);
    expect(potenciaOfertadaKw(s1.rede)).toBe(USINAS.cataVento.potenciaKw);
    expect(s0.rede.usinas.cataVento.quantidade).toBe(0);
  });

  it("não compra sem créditos", () => {
    const s = { ...estadoInicial(), creditos: 1 };
    expect(comprarUsina(s, "cataVento")).toBeNull();
    expect(comprarVila(s)).toBeNull();
  });

  it("respeita o desbloqueio por quantidade", () => {
    const s = { ...estadoInicial(), creditos: 1e9 };
    expect(desbloqueado(s.rede, USINAS.painelSolar.desbloqueio)).toBe(false);
    expect(comprarUsina(s, "painelSolar")).toBeNull();
    const [id, n] = USINAS.painelSolar.desbloqueio!.usina!;
    s.rede.usinas[id] = { quantidade: n, nivel: 0 };
    expect(desbloqueado(s.rede, USINAS.painelSolar.desbloqueio)).toBe(true);
    expect(comprarUsina(s, "painelSolar")).not.toBeNull();
  });

  it("melhorar exige ao menos uma unidade e sobe o nível", () => {
    const s = { ...estadoInicial(), creditos: 1e9 };
    expect(melhorarUsina(s, "cataVento")).toBeNull();
    const s1 = comprarUsina(s, "cataVento")!;
    const s2 = melhorarUsina(s1, "cataVento")!;
    expect(s2.rede.usinas.cataVento.nivel).toBe(1);
    expect(s1.creditos - s2.creditos).toBeCloseTo(custoMelhoria(USINAS.cataVento, 0), 10);
    expect(potenciaOfertadaKw(s2.rede)).toBeGreaterThan(potenciaOfertadaKw(s1.rede));
  });

  it("desbloqueio por pesquisa não tem efeito ainda", () => {
    const s = { ...estadoInicial(), creditos: 1e9 };
    expect(USINAS.turbinaEolica.desbloqueio?.pesquisa).toBe(40);
    expect(desbloqueado(s.rede, USINAS.turbinaEolica.desbloqueio)).toBe(true);
    expect(comprarUsina(s, "turbinaEolica")).not.toBeNull();
  });

  it("vila aumenta a demanda e bateria aumenta a capacidade", () => {
    const s = { ...estadoInicial(), creditos: 1e9 };
    const s1 = comprarVila(s)!;
    expect(s1.rede.vilas).toBe(1);
    expect(s.creditos - s1.creditos).toBeCloseTo(custoUnidade(VILA, 0), 10);
    const s2 = comprarBateria(s1)!;
    expect(s2.rede.bateria.unidades).toBe(1);
    expect(s2.rede.bateria.capacidadeKwh).toBe(BATERIA.capacidadeKwh);
    const s3 = comprarBateria(s2)!;
    expect(s3.rede.bateria.capacidadeKwh).toBe(2 * BATERIA.capacidadeKwh);
  });
});
