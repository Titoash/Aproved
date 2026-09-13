import { describe, expect, it } from "vitest";
import { CATEGORIA_VAGA, REGIOES, REGIOES_INICIAIS, regiaoDef } from "../content/era1-tabuleiro";
import { comprarUsina, comprarVila, podeComprarUsina, semVaga } from "./acoes";
import { ilhaDaEra1 } from "./gerarIlha";
import { indiceCasa, naPlataforma } from "./ilha";
import { estadoInicial, type GameState } from "./state";
import {
  CATEGORIAS,
  alocacao,
  custoRegiao,
  desbloquearRegiao,
  excedentes,
  ocupadas,
  podeDesbloquearRegiao,
  proximaRegiaoComVaga,
  regioesBloqueadas,
  temVaga,
  vagasDaRegiao,
  vagasDesbloqueadas,
  vagasTotais,
} from "./tabuleiro";

const ilha = ilhaDaEra1();

function comUsinas(quantidades: Partial<Record<"cataVento" | "painelSolar" | "turbinaEolica", number>>, vilas = 0, baterias = 0, extras: Partial<GameState> = {}): GameState {
  const s = estadoInicial();
  const usinas = { ...s.rede.usinas };
  for (const [id, q] of Object.entries(quantidades)) usinas[id as keyof typeof usinas] = { ...usinas[id as keyof typeof usinas], quantidade: q };
  return { ...s, ...extras, rede: { ...s.rede, usinas, vilas, bateria: { ...s.rede.bateria, unidades: baterias } } };
}

describe("vagas por região (GDD §8.5)", () => {
  it("cada região oferece exatamente as vagas do conteúdo, em casas válidas e sem repetição", () => {
    const vistas = new Set<number>();
    for (const def of REGIOES) {
      const vagas = vagasDaRegiao(ilha, def.id);
      for (const categoria of CATEGORIAS) {
        expect(vagas[categoria].length, `${def.id}/${categoria}`).toBe(def.vagas[categoria] ?? 0);
        for (const v of vagas[categoria]) {
          const i = indiceCasa(ilha.n, v.x, v.y);
          expect(ilha.terra[i]).toBe(1);
          expect(ilha.agua[i]).toBe(0);
          expect(ilha.caminho[i]).toBe(0);
          expect(naPlataforma(ilha.plataforma, v.x, v.y)).toBe(false);
          expect(ilha.regiao[i]).toBe(def.id === "nucleo" ? 0 : REGIOES.findIndex((r) => r.id === def.id));
          expect(vistas.has(i), `casa ${v.x},${v.y} repetida`).toBe(false);
          vistas.add(i);
        }
      }
    }
  });

  it("vilas encostam nos caminhos", () => {
    const vagas = vagasDaRegiao(ilha, "vila");
    for (const v of vagas.vila) {
      const encosta = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => ilha.caminho[indiceCasa(ilha.n, v.x + dx, v.y + dy)] === 1);
      expect(encosta).toBe(true);
    }
  });

  it("as regiões iniciais somam 48 de vento, 36 de sol, 32 de vila e 8 de bateria", () => {
    expect(vagasTotais(ilha, REGIOES_INICIAIS, "vento")).toBe(48);
    expect(vagasTotais(ilha, REGIOES_INICIAIS, "sol")).toBe(36);
    expect(vagasTotais(ilha, REGIOES_INICIAIS, "vila")).toBe(32);
    expect(vagasTotais(ilha, REGIOES_INICIAIS, "bateria")).toBe(8);
  });

  it("desbloquear a Planície acrescenta as vagas no fim da lista, sem mexer nas anteriores", () => {
    const antes = vagasDesbloqueadas(ilha, REGIOES_INICIAIS, "sol");
    const depois = vagasDesbloqueadas(ilha, [...REGIOES_INICIAIS, "planicie"], "sol");
    expect(depois.length).toBe(antes.length + 9);
    expect(depois.slice(0, antes.length)).toEqual(antes);
  });
});

describe("alocação determinística (GDD §2.4)", () => {
  it("comprar uma unidade nunca move as anteriores", () => {
    const a = alocacao(ilha, REGIOES_INICIAIS, comUsinas({ cataVento: 10, turbinaEolica: 2, painelSolar: 4 }, 3, 1).rede);
    const b = alocacao(ilha, REGIOES_INICIAIS, comUsinas({ cataVento: 11, turbinaEolica: 3, painelSolar: 5 }, 4, 2).rede);
    for (const c of a) expect(b).toContainEqual(c);
    expect(b.length).toBe(a.length + 5);
  });

  it("cata-ventos ocupam as vagas do início e turbinas eólicas as do fim", () => {
    const vento = vagasDesbloqueadas(ilha, REGIOES_INICIAIS, "vento");
    const col = alocacao(ilha, REGIOES_INICIAIS, comUsinas({ cataVento: 3, turbinaEolica: 2 }).rede);
    const cata = col.filter((c) => c.item === "cataVento").map((c) => [c.x, c.y]);
    const turb = col.filter((c) => c.item === "turbinaEolica").map((c) => [c.x, c.y]);
    expect(cata).toEqual(vento.slice(0, 3).map((v) => [v.x, v.y]));
    expect(turb).toEqual([vento[vento.length - 1], vento[vento.length - 2]].map((v) => [v.x, v.y]));
  });

  it("desbloquear um local não move ninguém", () => {
    const rede = comUsinas({ cataVento: 20, turbinaEolica: 2, painelSolar: 6 }, 5, 2).rede;
    const a = alocacao(ilha, REGIOES_INICIAIS, rede);
    const b = alocacao(ilha, [...REGIOES_INICIAIS, "planicie"], rede);
    expect(b).toEqual(a);
  });

  it("saves antigos com mais unidades do que vagas continuam contando (excedentes) e não quebram", () => {
    const rede = comUsinas({ cataVento: 60 }).rede;
    const col = alocacao(ilha, REGIOES_INICIAIS, rede);
    expect(col.filter((c) => c.item === "cataVento").length).toBe(48);
    expect(excedentes(ilha, REGIOES_INICIAIS, rede).vento).toBe(12);
    expect(ocupadas(rede, "vento")).toBe(60);
  });
});

describe("compras respeitam vagas", () => {
  it("com o Campo dos Ventos cheio, cata-vento fica sem vaga e a compra é recusada", () => {
    const s = comUsinas({ cataVento: 46, turbinaEolica: 2 }, 0, 0, { creditos: 1e12 });
    expect(temVaga(s, "vento")).toBe(false);
    expect(semVaga(s, "cataVento")).toBe(true);
    expect(semVaga(s, "turbinaEolica")).toBe(true);
    expect(podeComprarUsina(s, "cataVento")).toBe(false);
    expect(comprarUsina(s, "cataVento")).toBeNull();
    expect(proximaRegiaoComVaga(s, "vento")).toBe("planicie");
  });

  it("desbloquear a Planície cobra ₵ 2,4 mil, emite o evento e libera a compra", () => {
    const s = comUsinas({ cataVento: 48 }, 32, 0, { creditos: 3000 });
    expect(custoRegiao("planicie")).toBe(2400);
    expect(podeDesbloquearRegiao(s, "planicie")).toBe(true);
    expect(podeDesbloquearRegiao(s, "colinas")).toBe(false);
    const d = desbloquearRegiao(s, "planicie");
    expect(d).not.toBeNull();
    expect(d!.creditos).toBe(600);
    expect(d!.tabuleiro.regioesDesbloqueadas.at(-1)).toBe("planicie");
    expect(d!.eventos).toContainEqual({ tipo: "regiaoDesbloqueada", id: "planicie" });
    expect(regioesBloqueadas(d!)).toEqual(["colinas"]);
    expect(desbloquearRegiao(d!, "planicie")).toBeNull();
    expect(semVaga(d!, "cataVento")).toBe(false);
    expect(comprarVila({ ...d!, creditos: 1e9 })).not.toBeNull();
  });

  it("regiões iniciais não se compram e o Núcleo não tem vagas", () => {
    expect(custoRegiao("vento")).toBeNull();
    expect(podeDesbloquearRegiao({ ...estadoInicial(), creditos: 1e9 }, "vento")).toBe(false);
    expect(regiaoDef("nucleo").vagas).toEqual({});
    expect(CATEGORIA_VAGA.turbinaEolica).toBe("vento");
  });
});
