/**
 * Métrica da análise do Reactor (`docs/analises/reactor-e-volume1.md`): o tick precisa ficar abaixo de
 * 16 ms com as 2048 casas ocupadas. Mede também a análise do mundo sem o cache.
 */
import { describe, expect, it } from "vitest";
import { ILHAS } from "../../content/era1-arquipelago";
import { naPlataforma } from "../arquipelago";
import { arquipelagoDaEra1 } from "../gerarArquipelago";
import { analisarMundo } from "../producao";
import { estadoInicial, type Construcao, type GameState, type TipoConstrucao } from "../state";
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
    const tipo: TipoConstrucao = ciclo === 0 ? "subestacao" : ciclo === 1 ? "vila" : ciclo === 2 ? "painelSolar" : ciclo === 3 ? "bateria" : ciclo === 4 ? "turbinaEolica" : "cataVento";
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
      ilhasAbertas: ILHAS.map((i) => i.id),
      cabos: ILHAS.slice(1).map((i) => i.id),
    },
  };
}

describe("desempenho do tick", () => {
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
    for (let i = 0; i < N; i++) analisarMundo(cheio.mundo, cheio.rede, cheio.melhorias);
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
