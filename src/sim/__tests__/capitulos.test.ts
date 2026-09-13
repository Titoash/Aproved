import { describe, expect, it } from "vitest";
import { CAPITULOS } from "../../content/capitulos";
import { capituloAtivo, medir, passoCapitulos, progressoDoAtivo } from "../capitulos";
import { desserializar, serializar } from "../save";
import { avancarTicks, tick } from "../tick";
import { estadoDoZero, plantar } from "./ajuda";

describe("capítulos da Era 1 (GDD §12)", () => {
  it("os ids são únicos e todo capítulo tem objetivo e recompensa", () => {
    const ids = CAPITULOS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CAPITULOS) {
      expect(c.objetivo.length, c.id).toBeGreaterThan(8);
      const r = (c.recompensa.creditos ?? 0) + (c.recompensa.pesquisa ?? 0);
      expect(r, c.id).toBeGreaterThan(0);
    }
  });

  it("o ativo é o primeiro por fazer, e um por vez", () => {
    const s = estadoDoZero();
    expect(capituloAtivo(s)!.id).toBe(CAPITULOS[0].id);
    const depois = { ...s, capitulos: [CAPITULOS[0].id] };
    expect(capituloAtivo(depois)!.id).toBe(CAPITULOS[1].id);
    const tudo = { ...s, capitulos: CAPITULOS.map((c) => c.id) };
    expect(capituloAtivo(tudo)).toBeNull();
    expect(progressoDoAtivo(tudo)).toBeNull();
  });

  it("o progresso conta o que falta", () => {
    const s = plantar(estadoDoZero(), "cataVento", 3);
    const p = progressoDoAtivo(s)!;
    expect(p.capitulo.id).toBe("primeirosVentos");
    expect(p).toMatchObject({ atual: 3, alvo: 5, concluido: false });
  });

  it("fechar a condição conclui e paga a recompensa, sem botão", () => {
    const s = plantar({ ...estadoDoZero(), creditos: 0 }, "cataVento", 5);
    expect(progressoDoAtivo(s)!.concluido).toBe(true);
    const depois = passoCapitulos(s);
    expect(depois.capitulos).toEqual(["primeirosVentos"]);
    expect(depois.creditos).toBe(CAPITULOS[0].recompensa.creditos);
    expect(depois.eventos.at(-1)).toEqual({ tipo: "capituloConcluido", id: "primeirosVentos" });
    // não paga duas vezes
    expect(passoCapitulos(depois).capitulos).toEqual(["primeirosVentos"]);
  });

  it("o tick conclui sozinho, um capítulo por tick", () => {
    const s = plantar({ ...estadoDoZero(), creditos: 0 }, "cataVento", 5);
    const t1 = tick(s);
    expect(t1.capitulos).toEqual(["primeirosVentos"]);
    expect(t1.creditos).toBeGreaterThanOrEqual(CAPITULOS[0].recompensa.creditos!);
    const t2 = avancarTicks(t1, 5);
    expect(t2.capitulos.length).toBeGreaterThanOrEqual(1);
  });

  it("mede terreno, densidade, população, nós, cabo e desmatamento", () => {
    const s = estadoDoZero();
    expect(medir(s, { tipo: "construcoes", construcao: "cataVento", n: 5, terreno: "colina" })).toEqual({ atual: 0, alvo: 5 });
    expect(medir(s, { tipo: "densidade", minima: 2 })).toEqual({ atual: 0, alvo: 2 });
    expect(medir(s, { tipo: "populacao", n: 2000 })).toEqual({ atual: 0, alvo: 2000 });
    expect(medir(s, { tipo: "pesquisados", n: 1 })).toEqual({ atual: 0, alvo: 1 }); // o nó inicial não conta
    expect(medir(s, { tipo: "nucleo" })).toEqual({ atual: 0, alvo: 1 });
    expect(medir(s, { tipo: "cabo", ilha: "ventania" })).toEqual({ atual: 0, alvo: 1 });
    expect(medir(s, { tipo: "desmatados", n: 8 })).toEqual({ atual: 0, alvo: 8 });
    const comBairro = plantar(s, "bairro", 1);
    expect(medir(comBairro, { tipo: "populacao", n: 2000 }).atual).toBe(100);
  });

  it("os capítulos concluídos sobrevivem ao save", () => {
    const s = { ...estadoDoZero(), capitulos: ["primeirosVentos", "colina"] };
    const lido = desserializar(serializar(s, 1000), 1000);
    expect(lido.capitulos).toEqual(["primeirosVentos", "colina"]);
    const sujo = desserializar(JSON.stringify({ ...JSON.parse(serializar(s, 1000)), capitulos: ["colina", "inventado", "colina"] }), 1000);
    expect(sujo.capitulos).toEqual(["colina"]);
  });
});
