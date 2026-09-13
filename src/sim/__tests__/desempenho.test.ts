/**
 * Métrica da análise do Reactor (`docs/analises/reactor-e-volume1.md`): o tick precisa ficar abaixo de
 * 16 ms com as 2048 casas ocupadas. Mede também a análise do mundo sem o cache.
 */
import { describe, expect, it } from "vitest";
import { ILHAS } from "../../content/era1-arquipelago";
import { naPlataforma } from "../arquipelago";
import { arquipelagoDaEra1 } from "../gerarArquipelago";
import { analisarMundo } from "../producao";
import { efeitosDe } from "../efeitos";
import { anel } from "../nucleo";
import { varetaNova } from "../reator";
import { estadoInicial, indiceReceptor, nucleoInicial, type Casa, type Construcao, type GameState, type TipoConstrucao } from "../state";
import { avancarTicks, tick } from "../tick";

const arq = arquipelagoDaEra1();
const n = arq.n;

/** Todas as casas de terra ocupadas: usinas, bairros e uma subestação a cada 7 casas. */
function mundoCheio(): GameState {
  const base = estadoInicial();
  const construcoes: Record<number, Construcao> = {};
  let k = 0;
  for (let i = 0; i < n * n; i++) {
    if (arq.terra[i] !== 1) continue;
    if (naPlataforma(arq.plataforma, i % n, Math.floor(i / n))) continue;
    const ciclo = k++ % 7;
    const tipo: TipoConstrucao = ciclo === 0 ? "subestacao" : ciclo === 1 ? "bairro" : ciclo === 2 ? "painelSolar" : ciclo === 3 ? "bateria" : ciclo === 4 ? "turbinaEolica" : "cataVento";
    construcoes[i] = { tipo, nivel: 0, colocadoEmMs: 0 };
  }
  return {
    ...base,
    creditos: 1e9,
    mundo: {
      construcoes,
      // nada de obstáculo de pé: todas as casas construíveis
      removidos: Array.from({ length: n * n }, (_, i) => i).filter((i) => arq.obstaculos[i] !== 255),
      remocoes: [],
      cristais: [],
      ilhasAbertas: ILHAS.map((i) => i.id),
      cabos: Object.fromEntries(ILHAS.slice(1).map((i) => [i.id, 0])),
    },
  };
}

/** O mesmo mundo cheio, mas na Era 2 e com o reator 7×7 lotado de varetas (o caso mais pesado). */
function mundoCheioEra2(): GameState {
  const base = mundoCheio();
  const lado = 7;
  const grade: Casa[] = new Array(lado * lado).fill(null);
  const centro = indiceReceptor(lado);
  grade[centro] = { tipo: "receptor" };
  for (let i = 0; i < lado * lado; i++) {
    if (i === centro) continue;
    const a = anel(i, lado);
    if (a === 1 && i === centro - lado) grade[i] = { tipo: "peca", id: "turbinaAlta" };
    else if (a === 1 && i === centro + lado) grade[i] = { tipo: "peca", id: "turbinaAlta" };
    else if (a === 1 && i === centro - 1) grade[i] = { tipo: "peca", id: "torreResfriamento" };
    else if (a === 1 && i === centro + 1) grade[i] = { tipo: "peca", id: "piscina" };
    else if (a === 2 && i % 5 === 0) grade[i] = { tipo: "peca", id: "barraControle" };
    else grade[i] = { tipo: "peca", id: "vareta", vareta: varetaNova() };
  }
  return {
    ...base,
    era: 2,
    nucleo: { ...nucleoInicial(), era: 2, lado, grade, calorU: 400, estabilidade: 50 },
  };
}

describe("desempenho do tick", () => {
  it("a Era 2 com o reator 7×7 cheio de varetas também fica abaixo de 16 ms por tick", () => {
    const cheio = mundoCheioEra2();
    let s = avancarTicks(cheio, 5);
    const t0 = performance.now();
    const N = 100;
    s = avancarTicks(s, N);
    const msPorTick = (performance.now() - t0) / N;
    const varetas = s.nucleo!.grade.filter((c) => c?.tipo === "peca" && c.id === "vareta").length;
    console.log(`tick da Era 2 com ${Object.keys(cheio.mundo.construcoes).length} construções e ${varetas} varetas: ${msPorTick.toFixed(3)} ms`);
    expect(msPorTick).toBeLessThan(16);
    expect(s.nucleo!.era).toBe(2);
  });

  it("fica abaixo de 16 ms por tick com as 2048 casas ocupadas", () => {
    const cheio = mundoCheio();
    expect(Object.keys(cheio.mundo.construcoes).length).toBe(arq.total - arq.plataforma.lado ** 2);
    // aquece (a primeira análise monta o cache)
    let s = avancarTicks(cheio, 5);
    const t0 = performance.now();
    const N = 100;
    s = avancarTicks(s, N);
    const msPorTick = (performance.now() - t0) / N;
    console.log(`tick com ${Object.keys(cheio.mundo.construcoes).length} construções: ${msPorTick.toFixed(3)} ms`);
    expect(msPorTick).toBeLessThan(16);
    expect(s.creditos).toBeGreaterThan(cheio.creditos);
  });

  it("a análise completa do mundo cheio, sem cache, também cabe num tick", () => {
    const cheio = mundoCheio();
    const t0 = performance.now();
    const N = 20;
    for (let i = 0; i < N; i++) analisarMundo(cheio.mundo, cheio.rede, efeitosDe(cheio));
    const ms = (performance.now() - t0) / N;
    console.log(`análise completa do mundo: ${ms.toFixed(3)} ms`);
    expect(ms).toBeLessThan(16);
  });

  it("um tick sem mudança de estrutura não recalcula a análise", () => {
    const cheio = mundoCheio();
    const depois = tick(cheio);
    // o mundo é o mesmo objeto: o cache por identidade vale para o próximo tick
    expect(depois.mundo).toBe(cheio.mundo);
  });
});
