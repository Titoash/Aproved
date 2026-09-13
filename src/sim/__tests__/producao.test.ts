import { describe, expect, it } from "vitest";
import { USINAS } from "../../content/era1";
import { DENSIDADES } from "../../content/cidade-era1";
import { CABO, SUBESTACAO, TERRENOS, VIZINHANCA } from "../../content/era1-arquipelago";
import { ORDEM_TERRENOS, indiceCasa, naPlataforma, type TipoTerreno } from "../arquipelago";
import { arquipelagoDaEra1 } from "../gerarArquipelago";
import { comprarIlha, ligarCabo, melhorarCabo, obstaculoEm } from "../mundo";
import { analisar, derivarRede } from "../producao";
import type { Construcao, GameState, TipoConstrucao } from "../state";
import { balancoDoEstado } from "../tick";
import { estadoLimpo } from "./ajuda";

const arq = arquipelagoDaEra1();
const n = arq.n;

/** Uma casa da ilha `q` com o terreno pedido, sem obstáculo, longe da plataforma e sem vizinho ocupado. */
function casaDe(terreno: TipoTerreno, q = 0, pular = 0): number {
  const alvo = ORDEM_TERRENOS.indexOf(terreno);
  let vistas = 0;
  const s = estadoLimpo();
  for (const i of arq.ilhas[q].casas) {
    if (arq.terreno[i] !== alvo || arq.obstaculos[i] !== 255 || arq.caminho[i] === 1) continue;
    if (naPlataforma(arq.plataforma, i % n, Math.floor(i / n))) continue;
    // só os vizinhos ortogonais alteram esteira, sombra e pico
    let limpo = true;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = (i % n) + dx;
      const y = Math.floor(i / n) + dy;
      if (x < 0 || y < 0 || x >= n || y >= n) continue;
      if (obstaculoEm(s.mundo, indiceCasa(n, x, y)) !== null) limpo = false;
    }
    if (!limpo) continue;
    if (vistas++ < pular) continue;
    return i;
  }
  throw new Error(`sem casa de ${terreno} na ilha ${q}`);
}

/** Põe construções direto no mundo, sem custo: o teste controla exatamente a vizinhança. */
function montar(pares: [number, TipoConstrucao, number?][], base: GameState = estadoLimpo()): GameState {
  const construcoes: Record<number, Construcao> = { ...base.mundo.construcoes };
  for (const [i, tipo, nivel] of pares) construcoes[i] = { tipo, nivel: nivel ?? 0, colocadoEmMs: 0 };
  return { ...base, mundo: { ...base.mundo, construcoes } };
}

/** Subestação de teto alto na própria casa vizinha, para o escoamento não limitar a medição. */
function comEscoamento(casa: number, pares: [number, TipoConstrucao, number?][]): GameState {
  return montar([...pares, [casa + 2 * n, "subestacao", 6]]);
}

const bruto = (s: GameState, casa: number) => analisar(s).porCasa.get(casa)?.brutoKw ?? 0;

describe("produção por terreno (GDD §2.4)", () => {
  it("colina dá +25 % ao vento, litoral +50 %, planície +15 % ao sol", () => {
    expect(TERRENOS.colina.vento).toBe(1.25);
    expect(TERRENOS.litoral.vento).toBe(1.5);
    expect(TERRENOS.planicie.sol).toBe(1.15);
    const base = USINAS.cataVento.potenciaKw;
    const planicie = casaDe("planicie");
    const colina = casaDe("colina");
    const litoral = casaDe("litoral");
    expect(bruto(comEscoamento(planicie, [[planicie, "cataVento"]]), planicie)).toBeCloseTo(base, 10);
    expect(bruto(comEscoamento(colina, [[colina, "cataVento"]]), colina)).toBeCloseTo(base * 1.25, 10);
    expect(bruto(comEscoamento(litoral, [[litoral, "cataVento"]]), litoral)).toBeCloseTo(base * 1.5, 10);
    const sol = USINAS.painelSolar.potenciaKw;
    expect(bruto(comEscoamento(planicie, [[planicie, "painelSolar"]]), planicie)).toBeCloseTo(sol * 1.15, 10);
    expect(bruto(comEscoamento(colina, [[colina, "painelSolar"]]), colina)).toBeCloseTo(sol, 10);
  });
});

describe("vizinhos (GDD §2.4)", () => {
  it("esteira: cada vizinho eólico ortogonal tira 20 %, com piso de 40 %", () => {
    const c = casaDe("planicie");
    const base = USINAS.cataVento.potenciaKw;
    const um = comEscoamento(c, [
      [c, "cataVento"],
      [c + 1, "cataVento"],
    ]);
    expect(bruto(um, c)).toBeCloseTo(base * 0.8, 10);
    expect(VIZINHANCA.esteiraPorVizinho).toBe(0.2);
    const quatro = comEscoamento(c, [
      [c, "cataVento"],
      [c + 1, "cataVento"],
      [c - 1, "cataVento"],
      [c + n, "cataVento"],
      [c - n, "cataVento"],
    ]);
    expect(bruto(quatro, c)).toBeCloseTo(base * VIZINHANCA.esteiraMinima, 10);
  });

  it("sombra: cada vizinho alto ortogonal tira 30 % de um painel, com piso de 40 %", () => {
    const c = casaDe("colina");
    const base = USINAS.painelSolar.potenciaKw;
    const um = comEscoamento(c, [
      [c, "painelSolar"],
      [c + 1, "turbinaEolica"],
    ]);
    expect(bruto(um, c)).toBeCloseTo(base * 0.7, 10);
    const tres = comEscoamento(c, [
      [c, "painelSolar"],
      [c + 1, "turbinaEolica"],
      [c - 1, "turbinaEolica"],
      [c + n, "turbinaEolica"],
    ]);
    expect(bruto(tres, c)).toBeCloseTo(base * VIZINHANCA.sombraMinima, 10);
    // painel não faz esteira nem sombra em outro painel
    const dois = comEscoamento(c, [
      [c, "painelSolar"],
      [c + 1, "painelSolar"],
    ]);
    expect(bruto(dois, c)).toBeCloseTo(base, 10);
  });

  it("pico permanente dá +30 % de vento a cada vizinho ortogonal", () => {
    const aberta = comprarIlha(estadoLimpo(1e6), "ventania")!;
    const pico = arq.ilhas[1].casas.find((i) => obstaculoEm(aberta.mundo, i) === "pico")!;
    const vizinha = [pico + 1, pico - 1, pico + n, pico - n].find(
      (i) => arq.ilha[i] === 1 && obstaculoEm(aberta.mundo, i) === null,
    );
    expect(vizinha).toBeDefined();
    if (vizinha === undefined) return;
    const terreno = ORDEM_TERRENOS[arq.terreno[vizinha]];
    const s = montar(
      [
        [vizinha, "cataVento"],
        [vizinha + 2 * n, "subestacao", 6],
      ],
      aberta,
    );
    const esperado = USINAS.cataVento.potenciaKw * TERRENOS[terreno].vento * (1 + VIZINHANCA.ventoPorPico);
    expect(bruto(s, vizinha)).toBeCloseTo(esperado, 10);
  });
});

describe("escoamento por subestação (GDD §2.4, §7)", () => {
  it("usina fora do alcance não vende e conta como sem escoamento", () => {
    const c = casaDe("planicie");
    const s = montar([[c, "cataVento"]]);
    const a = analisar(s);
    expect(a.porCasa.get(c)?.escoadoKw).toBe(0);
    expect(a.ofertaKw).toBe(0);
    expect(a.semEscoamentoKw).toBeCloseTo(USINAS.cataVento.potenciaKw, 10);
    expect(a.brutoKw).toBeCloseTo(USINAS.cataVento.potenciaKw, 10);
  });

  it("dentro do alcance 3 vende; a 4 casas, não", () => {
    const c = casaDe("planicie");
    expect(SUBESTACAO.alcance).toBe(3);
    const perto = montar([
      [c, "cataVento"],
      [c + 3, "subestacao"],
    ]);
    expect(analisar(perto).ofertaKw).toBeCloseTo(USINAS.cataVento.potenciaKw, 10);
    const longe = montar([
      [c, "cataVento"],
      [c + 4, "subestacao"],
    ]);
    expect(analisar(longe).ofertaKw).toBe(0);
  });

  it("o teto de 40 kW limita: o que passa dele é desperdiçado", () => {
    const c = casaDe("planicie");
    // 20 turbinas eólicas ao alcance da subestação: bem mais de 40 kW brutos, mesmo com esteira.
    const pares: [number, TipoConstrucao, number?][] = [[c, "subestacao"]];
    let postas = 0;
    for (let dy = -3; dy <= 3 && postas < 20; dy++) {
      for (let dx = -3; dx <= 3 && postas < 20; dx++) {
        const i = c + dy * n + dx;
        if (i === c || arq.ilha[i] !== 0) continue;
        pares.push([i, "turbinaEolica"]);
        postas++;
      }
    }
    const s = montar(pares);
    const a = analisar(s);
    expect(a.subestacoes[0].tetoKw).toBe(SUBESTACAO.tetoKw);
    expect(a.ofertaKw).toBeCloseTo(SUBESTACAO.tetoKw, 10);
    expect(a.semEscoamentoKw).toBeGreaterThan(0);
    expect(a.brutoKw).toBeGreaterThan(SUBESTACAO.tetoKw);
    // nível 1 dobra o teto e passa a caber tudo
    const melhor = montar([[c, "subestacao", 1]], s);
    expect(analisar(melhor).subestacoes[0].tetoKw).toBe(SUBESTACAO.tetoKw * 2);
    expect(analisar(melhor).ofertaKw).toBeCloseTo(a.brutoKw, 10);
    expect(analisar(melhor).semEscoamentoKw).toBeCloseTo(0, 10);
  });

  it("bairro sem subestação no alcance não pede energia", () => {
    const c = casaDe("planicie");
    const sozinho = montar([[c, "bairro"]]);
    expect(analisar(sozinho).demandaKw).toBe(0);
    expect(analisar(sozinho).bairrosSemEscoamento).toBe(1);
    const ligado = montar([
      [c, "bairro"],
      [c + 2, "subestacao"],
    ]);
    expect(analisar(ligado).demandaKw).toBe(DENSIDADES[0].demandaKw);
    expect(analisar(ligado).bairrosSemEscoamento).toBe(0);
  });

  it("ilha sem cabo só alimenta os próprios bairros; com cabo entra na rede principal", () => {
    const aberta = comprarIlha(estadoLimpo(1e6), "ventania")!;
    const c = casaDe("planicie", 1);
    const casas: [number, TipoConstrucao, number?][] = [[c, "subestacao", 6]];
    let postas = 0;
    for (let dy = -2; dy <= 2 && postas < 6; dy++) {
      for (let dx = -2; dx <= 2 && postas < 6; dx++) {
        const i = c + dy * n + dx;
        if (i === c || arq.ilha[i] !== 1 || obstaculoEm(aberta.mundo, i) !== null) continue;
        casas.push([i, "cataVento"]);
        postas++;
      }
    }
    const isolada = montar(casas, aberta);
    const a = analisar(isolada);
    expect(a.brutoKw).toBeGreaterThan(0);
    expect(a.ofertaKw).toBe(0); // nenhum bairro na ilha e sem cabo
    expect(a.ilhasIsoladas).toContain("ventania");
    expect(a.semEscoamentoKw).toBeCloseTo(a.brutoKw, 10);

    const comCabo = ligarCabo(isolada, "ventania")!;
    expect(analisar(comCabo).ofertaKw).toBeCloseTo(a.brutoKw, 10);
    expect(analisar(comCabo).semEscoamentoKw).toBeCloseTo(0, 10);
  });

  it("o cabo tem teto próprio: o que passa dele fica sem escoamento, e o nível dobra o teto", () => {
    // Ventania cheia de turbinas eólicas: muito acima dos 30 kW do cabo de nível 0.
    const aberta = comprarIlha(estadoLimpo(1e9), "ventania")!;
    const c = casaDe("planicie", 1);
    const casas: [number, TipoConstrucao, number?][] = [[c, "subestacao", 6]];
    let postas = 0;
    for (let dy = -3; dy <= 3 && postas < 12; dy++) {
      for (let dx = -3; dx <= 3 && postas < 12; dx++) {
        const i = c + dy * n + dx;
        if (i === c || arq.ilha[i] !== 1 || obstaculoEm(aberta.mundo, i) !== null) continue;
        casas.push([i, "turbinaEolica"]);
        postas++;
      }
    }
    const ligada = ligarCabo(montar(casas, aberta), "ventania")!;
    const a = analisar(ligada);
    expect(a.brutoKw).toBeGreaterThan(CABO.tetoKw);
    expect(a.ofertaKw).toBeCloseTo(CABO.tetoKw, 10);
    expect(a.semEscoamentoKw).toBeCloseTo(a.brutoKw - CABO.tetoKw, 10);
    expect(a.cabos).toEqual([{ ilha: "ventania", nivel: 0, tetoKw: CABO.tetoKw, usadoKw: CABO.tetoKw }]);

    const nivel1 = melhorarCabo(ligada, "ventania")!;
    expect(analisar(nivel1).ofertaKw).toBeCloseTo(Math.min(a.brutoKw, CABO.tetoKw * CABO.tetoNivel), 10);
  });
});

describe("contagens derivadas", () => {
  it("a Rede lê quantidade, vilas e bateria do mundo", () => {
    const c = casaDe("planicie");
    const s = montar([
      [c, "cataVento"],
      [c + 2, "cataVento"],
      [c + 4, "bairro"],
      [c + 6, "bateria"],
      [c + 3, "subestacao"],
    ]);
    const rede = derivarRede(s);
    expect(rede.usinas.cataVento.quantidade).toBe(2);
    expect(rede.bairros).toBe(1);
    expect(rede.bateria.unidades).toBe(1);
    expect(rede.bateria.capacidadeKwh).toBe(20);
    expect(balancoDoEstado(s).demandaKw).toBe(DENSIDADES[0].demandaKw);
  });

  it("a análise é memoizada enquanto o mundo não muda", () => {
    const s = estadoLimpo();
    expect(analisar(s)).toBe(analisar(s));
    const outro = montar([[casaDe("planicie"), "cataVento"]], s);
    expect(analisar(outro)).not.toBe(analisar(s));
  });
});
