import { describe, expect, it } from "vitest";
import { MELHORIAS } from "../../content/era1";
import { calorPorEspelho, comprarMelhoria, fatorPotenciaUsina, podeComprarMelhoria } from "../melhorias";
import { balancoDeCalor, equilibrioU } from "../nucleo";
import { potenciaOfertadaKw, potenciaUsina } from "../rede";
import { estadoInicial, melhoriasIniciais, nucleoInicial } from "../state";
import { avancarTicks, balancoDoEstado } from "../tick";
import { configuracao } from "./nucleo.test";

describe("melhorias nomeadas", () => {
  it("Lâminas de fibra: +25 % só nas eólicas", () => {
    const m = { ...melhoriasIniciais(), laminasDeFibra: true };
    expect(fatorPotenciaUsina(m, "cataVento")).toBe(1.25);
    expect(fatorPotenciaUsina(m, "turbinaEolica")).toBe(1.25);
    expect(fatorPotenciaUsina(m, "painelSolar")).toBe(1);
    expect(fatorPotenciaUsina(undefined, "cataVento")).toBe(1);
    expect(potenciaUsina("cataVento", { quantidade: 4, nivel: 0 }, m)).toBeCloseTo(5, 10);
    expect(potenciaUsina("painelSolar", { quantidade: 1, nivel: 0 }, m)).toBe(3);
  });

  it("a oferta da Rede e o tick leem as Lâminas do estado", () => {
    const s = estadoInicial();
    s.rede.usinas.cataVento = { quantidade: 4, nivel: 0 };
    s.melhorias.laminasDeFibra = true;
    expect(potenciaOfertadaKw(s.rede, s.melhorias)).toBeCloseTo(5, 10);
    expect(balancoDoEstado(s).ofertaUsinasKw).toBeCloseTo(5, 10);
    s.creditos = 0;
    // 5 kW contra 5 kW → zona de ouro ×1,25 → ₵ 6,25/s
    expect(avancarTicks(s, 10).creditos).toBeCloseTo(6.25, 6);
  });

  it("Rastreamento solar: espelhos a 5 u/s; h = 5, t = 2 vai de Q* = 83,3 para 104,2", () => {
    const grade = configuracao(5);
    expect(calorPorEspelho(undefined)).toBe(4);
    expect(calorPorEspelho({ ...melhoriasIniciais(), rastreamentoSolar: true })).toBe(5);
    expect(equilibrioU(grade)).toBeCloseTo(83.3, 1);
    expect(equilibrioU(grade, 5)).toBeCloseTo(104.2, 1);
    expect(balancoDeCalor(grade, 0, false, 5)).toBe(25);
  });

  it("com o Rastreamento, h = 5 sem reajuste cascateia", () => {
    const s = estadoInicial();
    s.nucleo = { ...nucleoInicial(), grade: configuracao(5), calorU: 83.3, estabilidade: 50 };
    s.melhorias.rastreamentoSolar = true;
    const depois = avancarTicks(s, 1200);
    expect(depois.nucleo!.cascatas).toBeGreaterThanOrEqual(1);
    // Sem a melhoria a mesma configuração fica na zona de ouro.
    const semMelhoria = { ...s, melhorias: melhoriasIniciais() };
    expect(avancarTicks(semMelhoria, 1200).nucleo!.cascatas).toBe(0);
  });

  it("compra única, exige ₵ e 🔬 acumulado sem gastar 🔬", () => {
    const s = { ...estadoInicial(), creditos: 1000, pesquisa: 10 };
    expect(podeComprarMelhoria(s, "laminasDeFibra")).toBe(true);
    expect(podeComprarMelhoria(s, "rastreamentoSolar")).toBe(false); // 🔬 30
    const s1 = comprarMelhoria(s, "laminasDeFibra")!;
    expect(s1.creditos).toBe(1000 - MELHORIAS.laminasDeFibra.custo);
    expect(s1.melhorias.laminasDeFibra).toBe(true);
    expect(comprarMelhoria(s1, "laminasDeFibra")).toBeNull();
    const s2 = comprarMelhoria({ ...s1, pesquisa: 30 }, "rastreamentoSolar")!;
    expect(s2.pesquisa).toBe(30);
    expect(s2.melhorias.rastreamentoSolar).toBe(true);
  });
});
