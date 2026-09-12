import { describe, expect, it } from "vitest";
import { CARDS, cardParaEvento } from "../../content/cards";
import { COMBUSTIVEL } from "../../content/era2-nucleo";
import { eventosDaQueima, queimarGrade } from "../combustivel";
import { cardVisto, marcarCardVisto } from "../cards";
import { avancarEra } from "../era";
import { avancarTicks, TICK_MS } from "../tick";
import { estadoInicial, nucleoInicial, type Casa, type GameState } from "../state";
import { TRANSICAO_ERA2 } from "../../content/era2";
import { ANEL1, comReator, DEF, montar } from "./era2";

function prontoParaEra2(): GameState {
  return {
    ...estadoInicial(),
    creditos: TRANSICAO_ERA2.creditos,
    pesquisa: TRANSICAO_ERA2.pesquisa,
    nucleo: { ...nucleoInicial(), estabilidade: 100 },
  };
}

describe("cards da Era 2 (GDD §9)", () => {
  it("os três cards existem e a transição pausa o jogo", () => {
    expect(CARDS.transicaoEra2).toBeDefined();
    expect(CARDS.combustivelBaixo).toBeDefined();
    expect(CARDS.calorDeDecaimento).toBeDefined();
    expect(CARDS.transicaoEra2.pausa).toBe(true);
    expect(CARDS.transicaoEra2.telas).toHaveLength(3);
    // Os cards da Era 1 continuam no registro.
    expect(CARDS.abertura).toBeDefined();
    expect(CARDS.cascata).toBeDefined();
  });

  it("o card do decaimento chega alarmado, pela manutenção", () => {
    expect(CARDS.calorDeDecaimento.bipe).toEqual({ papel: "manutencao", expressao: "alarmado" });
  });

  it("cada evento da Era 2 aponta para o seu card", () => {
    expect(cardParaEvento({ tipo: "eraAvancada", era: 2 })).toBe("transicaoEra2");
    expect(cardParaEvento({ tipo: "combustivelBaixo", indice: 0 })).toBe("combustivelBaixo");
    expect(cardParaEvento({ tipo: "varetaGasta", indice: 0 })).toBe("calorDeDecaimento");
  });

  it("avançar de era dispara o card da transição", () => {
    const s = avancarEra(prontoParaEra2())!;
    const ids = s.eventos.map(cardParaEvento);
    expect(ids).toContain("transicaoEra2");
  });
});

describe("eventos do combustível", () => {
  function queimarPor(grade: readonly Casa[], segundos: number): readonly Casa[] {
    let g = grade;
    const passos = Math.round((segundos * 1000) / TICK_MS);
    for (let i = 0; i < passos; i++) g = queimarGrade(g, TICK_MS / 1000, (i + 1) * TICK_MS, DEF);
    return g;
  }

  it("avisa uma vez só ao cruzar os 20 %", () => {
    expect(COMBUSTIVEL.limiarAviso).toBe(0.2);
    // 0,25 %/s: os 20 % restantes começam aos 320 s. Varre 300–340 s e conta.
    let g = queimarPor(montar(["vareta"]), 300);
    const avisos: number[] = [];
    for (let i = 0; i < 400; i++) {
      const proximo = queimarGrade(g, TICK_MS / 1000, (3000 + i + 1) * TICK_MS, DEF);
      for (const e of eventosDaQueima(g, proximo, DEF)) {
        if (e.tipo === "combustivelBaixo") avisos.push(3000 + i + 1);
      }
      g = proximo;
    }
    expect(avisos).toHaveLength(1);
    // O aviso cai no tick dos 320 s, com uma casa de tolerância do tick.
    expect(avisos[0] * TICK_MS).toBeGreaterThanOrEqual(319_900);
    expect(avisos[0] * TICK_MS).toBeLessThanOrEqual(320_100);
  });

  it("avisa ao esgotar, com o índice da casa", () => {
    const grade = montar(["vareta"]);
    const antes = queimarPor(grade, 399.9);
    const depois = queimarGrade(antes, TICK_MS / 1000, 400_000, DEF);
    expect(eventosDaQueima(antes, depois, DEF)).toEqual([{ tipo: "varetaGasta", indice: ANEL1[0] }]);
  });

  it("o tick publica os eventos da queima", () => {
    const s = avancarTicks(comReator(montar(["vareta", "bomba"]), 0), 4000);
    expect(s.eventos.some((e) => e.tipo === "varetaGasta")).toBe(true);
  });

  it("cada card só aparece uma vez, pelo `cardsVistos`", () => {
    const s = marcarCardVisto(comReator(montar(["vareta"])), "calorDeDecaimento");
    expect(cardVisto(s, "calorDeDecaimento")).toBe(true);
    expect(cardVisto(s, "combustivelBaixo")).toBe(false);
  });

  it("uma era sem combustível não produz evento nenhum", () => {
    const grade = montar(["bomba"]);
    expect(eventosDaQueima(grade, grade, DEF)).toEqual([]);
  });
});
