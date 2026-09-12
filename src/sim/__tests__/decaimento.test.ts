import { describe, expect, it } from "vitest";
import { COMBUSTIVEL, REATOR } from "../../content/era2-nucleo";
import { podeRemoverPeca, scramManual, validarRemocaoDaPeca } from "../acoesNucleo";
import { queimarGrade } from "../combustivel";
import { decaimentoDaGrade, tempoAteEsfriarMs } from "../decaimento";
import { balancoDeCalor, contar } from "../nucleo";
import { temperaturaNucleo } from "../calor";
import { avancarTicks, TICK_MS } from "../tick";
import { colocar } from "../nucleo";
import { NUCLEO_PADRAO } from "../../content/eras";
import { gradeVazia, type Casa } from "../state";
import { ANEL1, comReator, DEF, montar } from "./era2";

function queimarPor(grade: readonly Casa[], segundos: number): readonly Casa[] {
  let g = grade;
  const passos = Math.round((segundos * 1000) / TICK_MS);
  for (let i = 0; i < passos; i++) g = queimarGrade(g, TICK_MS / 1000, (i + 1) * TICK_MS, DEF);
  return g;
}

/** Decaimento nominal de uma vareta do anel 1 no instante em que ela para: 7 % de 40 u/s. */
const PICO = COMBUSTIVEL.decaimento.fracao * REATOR.calorVaretaAnel1;

describe("calor de decaimento (GDD §8.5.5)", () => {
  it("uma vareta que ainda fissiona não decai", () => {
    expect(decaimentoDaGrade(montar(["vareta"]), 0, DEF)).toBe(0);
  });

  it("no instante da exaustão emite 7 % do nominal e cai à metade a cada 90 s", () => {
    const gasta = queimarPor(montar(["vareta"]), 400);
    expect(PICO).toBeCloseTo(2.8, 10);
    expect(decaimentoDaGrade(gasta, 400_000, DEF)).toBeCloseTo(PICO, 6);
    expect(decaimentoDaGrade(gasta, 400_000 + 90_000, DEF)).toBeCloseTo(PICO / 2, 6);
    expect(decaimentoDaGrade(gasta, 400_000 + 180_000, DEF)).toBeCloseTo(PICO / 4, 6);
  });

  it("abaixo do corte de 0,05 u/s o decaimento some", () => {
    const gasta = queimarPor(montar(["vareta"]), 400);
    // 2,8 → 0,05 leva log2(56) ≈ 5,8 meias-vidas ≈ 523 s.
    expect(decaimentoDaGrade(gasta, 400_000 + 520_000, DEF)).toBeGreaterThan(0);
    expect(decaimentoDaGrade(gasta, 400_000 + 530_000, DEF)).toBe(0);
    expect(tempoAteEsfriarMs(gasta[ANEL1[0]], ANEL1[0], DEF.ladoInicial, 400_000, DEF)).toBeCloseTo(
      Math.log2(PICO / COMBUSTIVEL.decaimento.corteUs) * COMBUSTIVEL.decaimento.meiaVidaMs,
      6,
    );
  });

  it("a vareta do anel 2 decai pela metade do nominal", () => {
    const gasta = queimarPor(montar([], ["vareta"]), 800);
    expect(decaimentoDaGrade(gasta, 800_000, DEF)).toBeCloseTo(PICO / 2, 6);
  });

  it("o SCRAM zera a fissão mas não zera a entrada", () => {
    const grade = montar(["vareta", "vareta", "vareta", "vareta", "vareta"]);
    const s = scramManual(comReator([...grade], 0))!;
    const emScram = s.nucleo!.grade;
    // As 5 varetas continuam com combustível, mas estão paradas: só decaimento.
    expect(contar(emScram, DEF).aquecedoresPorAnel).toEqual([5, 0, 0]);
    expect(decaimentoDaGrade(emScram, 0, DEF)).toBeCloseTo(5 * PICO, 6);
    expect(balancoDeCalor(emScram, 0, true, undefined, 0, DEF)).toBeCloseTo(5 * PICO, 6);
  });
});

describe("o SCRAM deixa de ser garantia (GDD §8.5.5)", () => {
  /** 5 varetas no anel 1, sem nada mais. SCRAM manual imediato. */
  function semBomba() {
    return scramManual(comReator(montar(["vareta", "vareta", "vareta", "vareta", "vareta"]), 0))!;
  }

  it("sem bomba, o calor SOBE durante o SCRAM", () => {
    const s0 = semBomba();
    const s = avancarTicks(s0, 100); // 10 s de SCRAM
    expect(s.nucleo!.calorU).toBeGreaterThan(s0.nucleo!.calorU);
  });

  it("sem bomba e com o Vaso já quente, a Cascata acontece durante o SCRAM", () => {
    // Vaso a 99 % da capacidade: só o decaimento basta para passar de 100 %.
    const s0 = scramManual(
      comReator(montar(["vareta", "vareta", "vareta", "vareta", "vareta"]), REATOR.capacidadeVasoU * 0.99),
    )!;
    expect(s0.nucleo!.cascatas).toBe(0);
    // 5 × 2,8 = 14 u/s sobre 10 u de folga: passa de 100 % em ~0,7 s, e a
    // Cascata dispara 5 s depois. 100 ticks = 10 s cobrem com folga.
    const s = avancarTicks(s0, 100);
    expect(temperaturaNucleo(s0.nucleo!)).toBeCloseTo(0.99, 6);
    expect(s.nucleo!.cascatas).toBe(1);
  });

  it("com uma bomba, as mesmas varetas não cascateiam: 60 u/s dão conta dos 14", () => {
    const s0 = scramManual(
      comReator(montar(["vareta", "vareta", "vareta", "vareta", "vareta", "bomba"]), REATOR.capacidadeVasoU * 0.99),
    )!;
    const s = avancarTicks(s0, 300); // 30 s: o SCRAM inteiro e mais um pouco
    expect(s.nucleo!.cascatas).toBe(0);
    expect(s.nucleo!.calorU).toBeLessThan(s0.nucleo!.calorU);
  });

  it("na Era 1 o SCRAM continua salvando sempre: sem decaimento, a entrada zera", () => {
    // Contraprova: a mesma situação numa Torre Solar. Seis heliostatos no anel 1
    // e nenhum radiador; em SCRAM o balanço é zero, não positivo.
    let torre = gradeVazia();
    [6, 7, 8, 11, 13, 16].forEach((i) => (torre = colocar(torre, i, "heliostato")));
    expect(balancoDeCalor(torre, 0, false)).toBeGreaterThan(0);
    expect(balancoDeCalor(torre, 0, true)).toBe(0);
    expect(decaimentoDaGrade(torre, 10_000_000, NUCLEO_PADRAO)).toBe(0);
  });
});

describe("peça gasta e quente não sai da grade (GDD §8.5.4)", () => {
  it("recusa a remoção com o motivo enquanto está quente, e aceita depois de esfriar", () => {
    const gasta = queimarPor(montar(["vareta"]), 400);
    const s = comReator([...gasta]);
    const quente = { ...s, tempoMs: 400_000 };
    expect(podeRemoverPeca(quente, ANEL1[0])).toBe(false);
    const r = validarRemocaoDaPeca(quente, ANEL1[0]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("Ainda quente. Recarregue ou espere esfriar.");

    const fria = { ...s, tempoMs: 400_000 + 530_000 };
    expect(podeRemoverPeca(fria, ANEL1[0])).toBe(true);
  });

  it("uma vareta cheia e fissionando sai normalmente", () => {
    const s = comReator(montar(["vareta"]));
    expect(podeRemoverPeca(s, ANEL1[0])).toBe(true);
  });

  it("peça da Era 1 nunca fica quente", () => {
    const s = comReator(montar(["bomba"]));
    expect(podeRemoverPeca(s, ANEL1[0])).toBe(true);
  });
});
