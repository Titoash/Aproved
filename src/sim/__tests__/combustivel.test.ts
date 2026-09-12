import { describe, expect, it } from "vitest";
import { COMBUSTIVEL, PECAS_ERA2 } from "../../content/era2-nucleo";
import { podeRecarregar, recarregarPeca } from "../acoesNucleo";
import { custoRecarga, estaGasta, queimarGrade, recarregar, taxaDeQueima } from "../combustivel";
import { contar } from "../nucleo";
import { avancarTicks, TICK_MS } from "../tick";
import { ANEL1, ANEL2, comReator, DEF, montar } from "./era2";

/** Queima uma grade por `segundos` em passos do tick. */
function queimarPor(grade: readonly import("../state").Casa[], segundos: number) {
  let g = grade;
  const passos = Math.round((segundos * 1000) / TICK_MS);
  for (let i = 0; i < passos; i++) g = queimarGrade(g, TICK_MS / 1000, (i + 1) * TICK_MS, DEF);
  return g;
}

describe("combustível (GDD §8.5.4)", () => {
  it("uma vareta nova nasce cheia e fissionando", () => {
    const grade = montar(["vareta"]);
    expect(grade[ANEL1[0]]).toEqual({ tipo: "peca", id: "vareta", combustivel: { restante: 1, paradaEmMs: null } });
    expect(contar(grade, DEF).aquecedoresPorAnel).toEqual([1, 0, 0]);
    expect(contar(grade, DEF).gastosPorAnel).toEqual([0, 0, 0]);
  });

  it("a taxa segue o peso do anel: cheia no anel 1, metade no anel 2", () => {
    expect(taxaDeQueima(1, DEF)).toBeCloseTo(COMBUSTIVEL.taxaPorSegundo, 10);
    expect(taxaDeQueima(2, DEF)).toBeCloseTo(COMBUSTIVEL.taxaPorSegundo * 0.5, 10);
    // O anel 3 não recebe peça na Era 2 e não injeta nada, então também não queima.
    expect(taxaDeQueima(3, DEF)).toBe(0);
  });

  it("a vareta do anel 1 dura 400 s e a do anel 2 dura 800 s", () => {
    const grade = montar(["vareta"], ["vareta"]);
    const aos399 = queimarPor(grade, 399);
    expect(estaGasta(aos399[ANEL1[0]])).toBe(false);

    const aos400 = queimarPor(grade, 400);
    expect(estaGasta(aos400[ANEL1[0]])).toBe(true);
    expect(estaGasta(aos400[ANEL2[0]])).toBe(false);

    const aos799 = queimarPor(grade, 799);
    expect(estaGasta(aos799[ANEL2[0]])).toBe(false);
    const aos800 = queimarPor(grade, 800);
    expect(estaGasta(aos800[ANEL2[0]])).toBe(true);
  });

  it("ao esgotar, a vareta sai da conta de quem fissiona e carimba a parada", () => {
    const gasta = queimarPor(montar(["vareta"]), 400);
    const casa = gasta[ANEL1[0]];
    expect(contar(gasta, DEF).aquecedoresPorAnel).toEqual([0, 0, 0]);
    expect(contar(gasta, DEF).gastosPorAnel).toEqual([1, 0, 0]);
    if (casa?.tipo !== "peca") throw new Error("casa deveria ser peça");
    expect(casa.combustivel?.paradaEmMs).toBe(400_000);
  });

  it("em SCRAM o combustível não queima: a fissão parou", () => {
    const grade = montar(["vareta"]);
    const depois = queimarGrade(grade, 10, 10_000, DEF, true);
    expect(depois).toBe(grade);
  });

  it("peça da Era 1 não queima: a grade volta idêntica", () => {
    const grade = montar(["bomba", "geradorDeVapor"]);
    expect(queimarGrade(grade, 60, 60_000, DEF)).toBe(grade);
  });

  it("recarregar cobra 60 % do preço e devolve a vareta cheia", () => {
    expect(custoRecarga(montar(["vareta"])[ANEL1[0]], DEF)).toBeCloseTo(PECAS_ERA2.vareta.custo * 0.6, 10);
    expect(custoRecarga(montar(["vareta"])[ANEL1[0]], DEF)).toBe(240);

    const gasta = queimarPor(montar(["vareta"]), 400);
    const s = comReator([...gasta], 0, 1000);
    expect(podeRecarregar(s, ANEL1[0])).toBe(true);
    const depois = recarregarPeca(s, ANEL1[0])!;
    expect(depois.creditos).toBe(760);
    expect(depois.nucleo!.grade[ANEL1[0]]).toEqual({ tipo: "peca", id: "vareta", combustivel: { restante: 1, paradaEmMs: null } });
  });

  it("sem créditos a recarga não acontece", () => {
    const gasta = queimarPor(montar(["vareta"]), 400);
    const s = comReator([...gasta], 0, 239);
    expect(podeRecarregar(s, ANEL1[0])).toBe(false);
    expect(recarregarPeca(s, ANEL1[0])).toBeNull();
  });

  it("recarregar uma vareta cheia não faz nada", () => {
    const grade = montar(["vareta"]);
    expect(recarregar(grade, ANEL1[0], DEF)).toBeNull();
    expect(podeRecarregar(comReator([...grade]), ANEL1[0])).toBe(false);
  });

  it("recarregar uma casa vazia ou uma peça que não queima devolve null", () => {
    const grade = montar(["bomba"]);
    expect(recarregar(grade, ANEL1[0], DEF)).toBeNull();
    expect(recarregar(grade, ANEL1[3], DEF)).toBeNull();
  });

  it("no tick a vareta queima e para de injetar calor no mesmo tick em que esgota", () => {
    // Uma vareta e uma bomba: enquanto fissiona, entram 40 e saem 60.
    const s0 = comReator(montar(["vareta", "bomba"]), 0);
    const s = avancarTicks(s0, 4000); // 400 s
    const casa = s.nucleo!.grade[ANEL1[0]];
    if (casa?.tipo !== "peca") throw new Error("casa deveria ser peça");
    expect(casa.combustivel!.restante).toBe(0);
    expect(contar(s.nucleo!.grade, DEF).aquecedoresPorAnel).toEqual([0, 0, 0]);
  });
});
