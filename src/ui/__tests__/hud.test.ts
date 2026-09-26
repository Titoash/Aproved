/**
 * Os números do HUD (GDD §10.1, parte E da Sessão 9) batem com o que o tick faz: a 🔬/s mostrada é a
 * variação de um tick (na Era 2 ela já saiu ×10) e o ₵/s é o líquido, com o combustível das térmicas.
 */
import { describe, expect, it } from "vitest";
import { REATOR } from "../../content/era2-nucleo";
import { equilibrioMotor, motorDoNucleo } from "../../sim/motor";
import { efeitosDe } from "../../sim/efeitos";
import { varetaNova } from "../../sim/reator";
import { gradeVazia, nucleoInicial, type GameState } from "../../sim/state";
import { tick } from "../../sim/tick";
import { comBairros, estadoLimpo, plantar } from "../../sim/__tests__/ajuda";
import { configuracao } from "../../sim/__tests__/nucleo.test";
import { numerosDoHud } from "../hud";

/** O Núcleo parado no equilíbrio: a T não muda no tick, e a 🔬/s do HUD tem de ser a do tick. */
function noEquilibrio(s: GameState): GameState {
  const m = motorDoNucleo(s.nucleo!, efeitosDe(s), s.tempoMs);
  return { ...s, nucleo: { ...s.nucleo!, calorU: equilibrioMotor(m) } };
}

describe("números do HUD", () => {
  it("Era 1: a 🔬/s é a variação de um tick (Núcleo + laboratórios)", () => {
    const base = plantar(comBairros(estadoLimpo(1e6), 2), "laboratorio", 2);
    const s = noEquilibrio({ ...base, nucleo: { ...nucleoInicial(), grade: configuracao(5) } });
    const hud = numerosDoHud(s);
    const depois = tick(s);
    expect(hud.taxaPesquisa).toBeGreaterThan(0);
    expect(hud.taxaPesquisa).toBeCloseTo((depois.pesquisa - s.pesquisa) * 10, 6);
    expect(hud.t).toBeCloseTo(0.8333, 3);
    expect(hud.faixaCalor?.id).toBe("ouro");
    expect(hud.estabilidade).toBe(s.nucleo!.estabilidade);
  });

  it("Era 2: a 🔬/s do reator é a do tick, não ×10", () => {
    const grade = gradeVazia(REATOR.ladoInicial);
    for (const i of [6, 7, 8, 16, 0, 4]) grade[i] = { tipo: "peca", id: "vareta", vareta: varetaNova() };
    grade[11] = { tipo: "peca", id: "turbinaAlta" };
    grade[13] = { tipo: "peca", id: "turbinaAlta" };
    const base = comBairros(estadoLimpo(1e6), 3);
    const s = noEquilibrio({ ...base, era: 2, nucleo: { ...nucleoInicial(), era: 2, lado: REATOR.ladoInicial, grade } });
    const hud = numerosDoHud(s);
    const depois = tick(s);
    expect(hud.taxaPesquisa).toBeGreaterThan(0);
    expect(hud.taxaPesquisa).toBeCloseTo((depois.pesquisa - s.pesquisa) * 10, 6);
  });

  it("sem Núcleo: 🔥 e 🛡 vazios; sem demanda, r é nulo", () => {
    const hud = numerosDoHud({ ...estadoLimpo(), mundo: { ...estadoLimpo().mundo, construcoes: {} } });
    expect(hud.t).toBeNull();
    expect(hud.estabilidade).toBeNull();
    expect(hud.r).toBeNull();
  });

  it("o ₵/s é o líquido: a receita do tick", () => {
    const s = plantar(comBairros(estadoLimpo(0), 2), "cataVento", 6);
    const hud = numerosDoHud(s);
    const depois = tick(s);
    expect(hud.taxaCreditos).toBeGreaterThan(0);
    expect(hud.taxaCreditos).toBeCloseTo((depois.creditos - s.creditos) * 10, 6);
  });
});
