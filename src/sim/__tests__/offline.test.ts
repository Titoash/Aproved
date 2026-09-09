import { describe, expect, it } from "vitest";
import { OFFLINE } from "../../content/era1";
import { temperaturaNucleo } from "../calor";
import { equilibrioU } from "../nucleo";
import { calcularOffline, janelaOfflineMs } from "../offline";
import { balancoRede } from "../rede";
import { estadoInicial, nucleoInicial } from "../state";
import { configuracao } from "./nucleo.test";

const H = 60 * 60 * 1000;

function estadoRede() {
  const s = estadoInicial();
  s.rede.usinas.cataVento = { quantidade: 5, nivel: 0 }; // 5 kW contra 5 kW → ouro ×1,25 → ₵ 6,25/s
  s.creditos = 100;
  s.salvoEmMs = 1_000_000;
  return s;
}

describe("offline (GDD §7 v0.4)", () => {
  it("10 min rendem receita/s × 0,5 × 600 na Rede, sem bateria", () => {
    const s = estadoRede();
    s.rede.bateria = { unidades: 1, capacidadeKwh: 20, kwh: 5 };
    const { state, relatorio } = calcularOffline(s, s.salvoEmMs + 10 * 60 * 1000);
    const receitaS = balancoRede(s.rede, { semBateria: true }).receitaPorSegundo;
    expect(receitaS).toBeCloseTo(6.25, 6);
    expect(relatorio.creditos).toBeCloseTo(6.25 * OFFLINE.fatorRede * 600, 6);
    expect(state.creditos).toBeCloseTo(100 + 1875, 6);
    expect(state.rede.bateria.kwh).toBe(5);
    expect(relatorio.duracaoMs).toBe(600_000);
    expect(state.tempoMs).toBe(600_000);
  });

  it("9 h contam como 8 h", () => {
    const s = estadoRede();
    expect(janelaOfflineMs(s.salvoEmMs, s.salvoEmMs + 9 * H)).toBe(8 * H);
    const { relatorio } = calcularOffline(s, s.salvoEmMs + 9 * H);
    expect(relatorio.duracaoMs).toBe(OFFLINE.janelaMaxMs);
    expect(relatorio.creditos).toBeCloseTo(6.25 * 0.5 * 8 * 3600, 3);
  });

  it("relógio para trás e save sem carimbo rendem 0", () => {
    const s = estadoRede();
    expect(calcularOffline(s, s.salvoEmMs - 5000).relatorio.creditos).toBe(0);
    expect(janelaOfflineMs(0, 123456)).toBe(0);
    const semCarimbo = { ...s, salvoEmMs: 0 };
    expect(calcularOffline(semCarimbo, 10 * H).relatorio.duracaoMs).toBe(0);
  });

  it("T* = 83 % → potência e pesquisa ×0,7, Estabilidade ×0,7, Q volta em Q*", () => {
    const s = estadoRede();
    const grade = configuracao(5);
    s.nucleo = { ...nucleoInicial(), grade, calorU: 10, estabilidade: 40, scramRestanteMs: 5000, tempoAcimaDoLimiteMs: 1000 };
    const { state, relatorio } = calcularOffline(s, s.salvoEmMs + 10 * 60 * 1000);
    const qEq = equilibrioU(grade);
    expect(relatorio.tEquilibrio).toBeCloseTo(0.833, 3);
    expect(relatorio.nucleoDesligado).toBe(false);
    // 16 kW × 0,7 = 11,2 kW → pesquisa/s = 1,12 × 1,3 = 1,456
    expect(relatorio.pesquisa).toBeCloseTo(1.12 * 1.3 * 600, 3);
    // zona de ouro: 2,5/min × 0,7 × 10 min = 17,5
    expect(relatorio.estabilidade).toBeCloseTo(17.5, 6);
    expect(state.nucleo!.estabilidade).toBeCloseTo(57.5, 6);
    expect(state.nucleo!.calorU).toBeCloseTo(qEq, 6);
    expect(state.nucleo!.scramRestanteMs).toBe(0);
    expect(state.nucleo!.tempoAcimaDoLimiteMs).toBe(0);
    expect(state.nucleo!.cascatas).toBe(0);
    // A Rede vende 5 kW das usinas + 11,2 kW do Núcleo = 16,2 kW contra 5 kW: saturação ×0,75, só 5 kW vendidos.
    expect(relatorio.creditos).toBeCloseTo(5 * 0.75 * 0.5 * 600, 6);
  });

  it("T* ≥ 95 % → Núcleo desligado, relatório com o motivo, Q em 95 % da capacidade, nunca cascateia", () => {
    const s = estadoRede();
    s.nucleo = { ...nucleoInicial(), grade: configuracao(6.5), calorU: 100, estabilidade: 40 };
    const { state, relatorio } = calcularOffline(s, s.salvoEmMs + 8 * H);
    expect(relatorio.nucleoDesligado).toBe(true);
    expect(relatorio.tEquilibrio).toBeCloseTo(1.083, 3);
    expect(relatorio.pesquisa).toBe(0);
    expect(relatorio.estabilidade).toBe(0);
    expect(state.nucleo!.cascatas).toBe(0);
    expect(temperaturaNucleo(state.nucleo!)).toBeCloseTo(0.95, 6);
    // Só a Rede rendeu, e sem o Núcleo na oferta.
    expect(relatorio.creditos).toBeCloseTo(6.25 * 0.5 * 8 * 3600, 3);
  });

  it("h = 6 (T* = 100 %) também fica desligado; sem turbinas (Q* infinito) idem", () => {
    const s = estadoRede();
    s.nucleo = { ...nucleoInicial(), grade: configuracao(6), calorU: 50 };
    expect(calcularOffline(s, s.salvoEmMs + H).relatorio.nucleoDesligado).toBe(true);
    const soEspelhos = { ...nucleoInicial(), grade: configuracao(2).map((c) => (c?.tipo === "peca" && c.id === "turbina" ? null : c)) };
    const r = calcularOffline({ ...s, nucleo: soEspelhos }, s.salvoEmMs + H);
    expect(r.relatorio.nucleoDesligado).toBe(true);
    expect(temperaturaNucleo(r.state.nucleo!)).toBeCloseTo(0.95, 6);
  });
});
