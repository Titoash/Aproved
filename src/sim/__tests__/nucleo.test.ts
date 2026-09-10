import { describe, expect, it } from "vitest";
import { NUCLEO, PECAS, RECEPTOR_CERAMICO } from "../../content/era1-nucleo";
import { dicaDeEquilibrio, faixaDeCalor, multiplicadorPesquisa, pesquisaPorSegundo, temperatura } from "../calor";
import {
  anel,
  balancoDeCalor,
  capacidadeU,
  colocar,
  contar,
  entulharAnel1,
  equilibrioU,
  espelhosEfetivos,
  passoCalor,
  podeColocar,
  potenciaNucleoKw,
} from "../nucleo";
import { gradeVazia, indiceReceptor, type Casa, type PecaId } from "../state";
import { TICK_MS } from "../tick";

/** Índices do 5×5: anel 1 = vizinhas do 12; anel 2 = borda. */
export const ANEL1 = [6, 7, 8, 11, 13, 16, 17, 18];
export const ANEL2 = [0, 1, 2, 3, 4, 5, 9, 10, 14, 15, 19, 20, 21, 22, 23, 24];

/** Monta uma grade com listas de peças por anel, na ordem dos índices. */
export function montar(anel1: PecaId[], anel2: PecaId[] = []): Casa[] {
  let grade = gradeVazia();
  anel1.forEach((id, k) => (grade = colocar(grade, ANEL1[k], id)));
  anel2.forEach((id, k) => (grade = colocar(grade, ANEL2[k], id)));
  return grade;
}

/** Configuração de referência do GDD §8.3: h espelhos efetivos com t = 2 turbinas (4 espelhos no anel 1, o resto no anel 2). */
export function configuracao(h: number, extras: { radiadores?: number; tanques?: number } = {}): Casa[] {
  const anel1: PecaId[] = ["turbina", "turbina"];
  const anel2: PecaId[] = [];
  for (let i = 0; i < (extras.radiadores ?? 0); i++) anel1.push("radiador");
  for (let i = 0; i < (extras.tanques ?? 0); i++) anel1.push("tanque");
  let restante = h;
  let noAnel1 = 0;
  while (restante >= 1 && noAnel1 < 4 && anel1.length < ANEL1.length) {
    anel1.push("heliostato");
    restante -= 1;
    noAnel1++;
  }
  while (restante > 0) {
    anel2.push("heliostato");
    restante -= NUCLEO.pesoEspelhoAnel2;
  }
  return montar(anel1, anel2);
}

/** Roda o calor por `segundos` com o dt fixo do tick, sem SCRAM. */
export function simularCalor(grade: Casa[], calorU: number, segundos: number): number {
  const ticks = Math.round((segundos * 1000) / TICK_MS);
  let q = calorU;
  for (let i = 0; i < ticks; i++) q = passoCalor(grade, q, TICK_MS / 1000);
  return q;
}

describe("geometria", () => {
  it("anel 1 são as 8 vizinhas do centro, diagonais incluídas; anel 2 as 16 restantes", () => {
    expect(anel(indiceReceptor(5))).toBe(0);
    for (const i of ANEL1) expect(anel(i)).toBe(1);
    for (const i of ANEL2) expect(anel(i)).toBe(2);
    expect(ANEL1.length + ANEL2.length + 1).toBe(25);
  });

  it("espelhos efetivos: anel 1 conta 1, anel 2 conta 0,5", () => {
    expect(espelhosEfetivos(configuracao(5))).toBe(5);
    expect(espelhosEfetivos(configuracao(5.5))).toBe(5.5);
    expect(contar(configuracao(5))).toMatchObject({ espelhosAnel1: 4, espelhosAnel2: 2, turbinas: 2 });
  });
});

describe("equilíbrio do calor (GDD §8.3 corrigido, t = 2, capacidade 100)", () => {
  it.each([
    [5, 83.3, "ouro"],
    [5.5, 91.7, "alerta"],
    [6, 100.0, "alerta"],
    [6.5, 108.3, "critico"],
  ])("h = %s → Q* = %s (%s)", (h, esperado, faixa) => {
    const grade = configuracao(h);
    const q = equilibrioU(grade);
    expect(q).toBeCloseTo(esperado, 1);
    expect(faixaDeCalor(temperatura(q, capacidadeU(grade))).id).toBe(faixa);
  });

  it("a constante vem das peças: Q* = 4h ÷ (0,12 t)", () => {
    expect(equilibrioU(configuracao(6))).toBe((NUCLEO.calorEspelhoAnel1 * 6) / (NUCLEO.consumoTurbina * 2));
  });

  it("h = 5 converge para 83,3 ± 0,5 em 60 s", () => {
    expect(simularCalor(configuracao(5), 0, 60)).toBeCloseTo(83.3, 0.5);
    expect(Math.abs(simularCalor(configuracao(5), 0, 60) - 83.33)).toBeLessThan(0.5);
  });

  it("h = 6 estabiliza em 100 % e nunca passa da capacidade", () => {
    const grade = configuracao(6);
    let q = 0;
    let maximo = 0;
    for (let i = 0; i < 1200; i++) {
      q = passoCalor(grade, q, TICK_MS / 1000);
      maximo = Math.max(maximo, q);
    }
    expect(q).toBeCloseTo(100, 3);
    expect(maximo).toBeLessThanOrEqual(100);
  });

  it("h = 6,5 + 1 radiador devolve a zona de ouro (Q* = 83,3)", () => {
    const grade = configuracao(6.5, { radiadores: 1 });
    expect(contar(grade).radiadoresAdjacentes).toBe(1);
    expect(equilibrioU(grade)).toBeCloseTo(83.3, 1);
    expect(faixaDeCalor(temperatura(equilibrioU(grade), capacidadeU(grade))).id).toBe("ouro");
  });

  it("1 tanque de sal com h = 6, t = 2 → capacidade 250, T → 40 % e pesquisa ×0,5", () => {
    const grade = configuracao(6, { tanques: 1 });
    expect(contar(grade).tanquesAdjacentes).toBe(1);
    expect(capacidadeU(grade)).toBe(250);
    expect(temperatura(equilibrioU(grade), capacidadeU(grade))).toBeCloseTo(0.4, 10);
    // Chegando por baixo, T fica logo abaixo de 40 %: faixa fria.
    const q = simularCalor(grade, 0, 120);
    const t = temperatura(q, capacidadeU(grade));
    expect(t).toBeLessThan(0.4);
    expect(t).toBeGreaterThan(0.399);
    expect(multiplicadorPesquisa(t)).toBe(0.5);
  });

  it("Receptor cerâmico soma 50 u de capacidade", () => {
    expect(capacidadeU(gradeVazia(), true)).toBe(NUCLEO.capacidadeReceptorU + RECEPTOR_CERAMICO.capacidadeExtraU);
  });

  it("radiador e tanque no anel 2 não têm efeito", () => {
    const grade = montar(["turbina", "heliostato"], ["radiador", "tanque"]);
    expect(contar(grade).radiadoresAdjacentes).toBe(0);
    expect(contar(grade).tanquesAdjacentes).toBe(0);
    expect(capacidadeU(grade)).toBe(100);
  });
});

describe("potência e pesquisa", () => {
  it("h = 5, t = 2 em equilíbrio rende 16 kW (8 kW por turbina)", () => {
    const grade = configuracao(5);
    expect(potenciaNucleoKw(grade, equilibrioU(grade))).toBeCloseTo(16, 6);
  });

  it("pesquisa/s = potência ÷ 10 × multiplicador nas quatro faixas", () => {
    expect(pesquisaPorSegundo(16, 0.2)).toBeCloseTo(0.8, 10); // frio ×0,5
    expect(pesquisaPorSegundo(16, 0.5)).toBeCloseTo(1.6, 10); // normal ×1
    expect(pesquisaPorSegundo(16, 0.8)).toBeCloseTo(2.08, 10); // ouro ×1,3
    expect(pesquisaPorSegundo(16, 0.95)).toBeCloseTo(1.6, 10); // alerta ×1
  });

  it("limites das faixas de T", () => {
    expect(faixaDeCalor(0.399).id).toBe("frio");
    expect(faixaDeCalor(0.4).id).toBe("normal");
    expect(faixaDeCalor(0.7).id).toBe("ouro");
    expect(faixaDeCalor(0.9).id).toBe("ouro");
    expect(faixaDeCalor(0.9001).id).toBe("alerta");
    expect(faixaDeCalor(1).id).toBe("alerta");
    expect(faixaDeCalor(1.0001).id).toBe("critico");
  });

  it("em SCRAM os espelhos não injetam e as turbinas não consomem; radiadores continuam", () => {
    const grade = configuracao(6, { radiadores: 1 });
    expect(balancoDeCalor(grade, 80, true)).toBe(-NUCLEO.dissipacaoRadiador);
    expect(balancoDeCalor(configuracao(6), 80, true)).toBe(0);
  });
});

describe("posicionamento como dado", () => {
  it("turbina em casa de anel 2 é recusada", () => {
    const grade = gradeVazia();
    expect(podeColocar(grade, ANEL2[0], "turbina").ok).toBe(false);
    expect(podeColocar(grade, ANEL1[0], "turbina").ok).toBe(true);
    expect(PECAS.turbina.aneis).toEqual([1]);
  });

  it("recusa o Receptor, casas ocupadas, entulho e fora da grade", () => {
    let grade = colocar(gradeVazia(), ANEL1[0], "heliostato");
    expect(podeColocar(grade, indiceReceptor(5), "heliostato").ok).toBe(false);
    expect(podeColocar(grade, ANEL1[0], "heliostato").ok).toBe(false);
    expect(podeColocar(grade, 25, "heliostato").ok).toBe(false);
    grade = entulharAnel1(grade, 1000);
    expect(grade[ANEL1[0]]).toEqual({ tipo: "entulho", id: "heliostato", desdeMs: 1000 });
    expect(podeColocar(grade, ANEL1[0], "heliostato").ok).toBe(false);
  });

  it("entulhar o anel 1 preserva o anel 2 e o Receptor", () => {
    const antes = configuracao(5);
    const grade = entulharAnel1(antes, 0);
    for (const i of ANEL1) if (antes[i]) expect(grade[i]?.tipo).toBe("entulho");
    expect(contar(grade).entulhos).toBe(6);
    expect(grade[ANEL2[0]]).toEqual({ tipo: "peca", id: "heliostato" });
    expect(grade[indiceReceptor(5)]).toEqual({ tipo: "receptor" });
    expect(contar(grade).pecas).toBe(2);
  });
});

describe("dica da barra (derivada de Q*)", () => {
  it("Q* = 55 % → adicionar espelhos; 108 % → tirar espelho; 83 % → sem dica", () => {
    expect(dicaDeEquilibrio(0.55)).toBe("adicionarEspelhos");
    expect(dicaDeEquilibrio(1.08)).toBe("tirarEspelho");
    expect(dicaDeEquilibrio(0.83)).toBeNull();
    expect(dicaDeEquilibrio(0.7)).toBeNull();
    expect(dicaDeEquilibrio(1)).toBeNull();
    expect(dicaDeEquilibrio(Infinity)).toBe("tirarEspelho");
    expect(dicaDeEquilibrio(0)).toBe("adicionarEspelhos");
  });
});
