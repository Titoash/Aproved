import { describe, expect, it } from "vitest";
import { USINAS } from "../../content/era1";
import { BAIRRO } from "../../content/cidade-era1";
import { CABO, OBSTACULOS, SUBESTACAO, ilhaDef } from "../../content/era1-arquipelago";
import { indiceCasa, naPlataforma } from "../arquipelago";
import { arquipelagoDaEra1 } from "../gerarArquipelago";
import {
  avaliarCasa,
  colocar,
  comprarIlha,
  custoCabo,
  custoColocar,
  custoNivelCabo,
  custoNivelSubestacao,
  ligarCabo,
  melhorarCabo,
  avaliarMelhoriaSubestacao,
  melhorarSubestacao,
  nivelCabo,
  tetoCabo,
  obstaculoEm,
  passoRemocoes,
  podeColocar,
  remover,
  removerObstaculo,
  valorRemocao,
} from "../mundo";
import { quantidadeDe, temCristal, terrenoDeJogo, tetoSubestacao } from "../producao";
import { avancarTicks } from "../tick";
import { estadoLimpo } from "./ajuda";

const arq = arquipelagoDaEra1();
const n = arq.n;

/** Primeira casa livre (sem obstáculo, sem caminho, fora da plataforma) da ilha `q`. */
function casaLivre(q: number, pular = 0): number {
  let vistas = 0;
  for (const i of arq.ilhas[q].casas) {
    if (arq.obstaculos[i] !== 255 || arq.caminho[i] === 1) continue;
    if (naPlataforma(arq.plataforma, i % n, Math.floor(i / n))) continue;
    if (vistas++ < pular) continue;
    return i;
  }
  throw new Error(`sem casa livre na ilha ${q}`);
}

function casaComObstaculo(tipo: string, q = 0): number {
  const s = estadoLimpo();
  for (const i of arq.ilhas[q].casas) {
    if (obstaculoEm(s.mundo, i) === tipo) return i;
  }
  throw new Error(`sem obstáculo ${tipo} na ilha ${q}`);
}

describe("colocar e remover (GDD §2.1, §7, v0.6)", () => {
  it("colocar desconta o custo, ocupa a casa e conta na Rede", () => {
    const s0 = estadoLimpo(1000);
    const casa = casaLivre(0);
    const custo = custoColocar(s0, "cataVento");
    expect(custo).toBe(USINAS.cataVento.custoBase);
    const s1 = colocar(s0, casa, "cataVento")!;
    expect(s1.creditos).toBeCloseTo(1000 - custo, 10);
    expect(s1.mundo.construcoes[casa].tipo).toBe("cataVento");
    expect(quantidadeDe(s1, "cataVento")).toBe(1);
    // a segunda custa ×1,15
    expect(custoColocar(s1, "cataVento")).toBeCloseTo(USINAS.cataVento.custoBase * 1.15, 10);
  });

  it("o custo de prédios que não são usina cresce ×1,25 (GDD §7, v0.6)", () => {
    const s0 = estadoLimpo(100_000);
    const s1 = colocar(s0, casaLivre(0), "subestacao")!;
    expect(custoColocar(s0, "subestacao")).toBe(SUBESTACAO.custoBase);
    expect(custoColocar(s1, "subestacao")).toBeCloseTo(SUBESTACAO.custoBase * SUBESTACAO.crescimento, 10);
    const s2 = colocar(s0, casaLivre(0), "bairro")!;
    expect(custoColocar(s2, "bairro")).toBeCloseTo(BAIRRO.custoBase * BAIRRO.crescimento, 10);
  });

  it("remover devolve metade do que a última unidade custou", () => {
    const s0 = estadoLimpo(1000);
    const casa = casaLivre(0);
    const s1 = colocar(s0, casa, "cataVento")!;
    expect(valorRemocao(s1, "cataVento")).toBeCloseTo(USINAS.cataVento.custoBase / 2, 10);
    const s2 = remover(s1, casa)!;
    expect(s2.mundo.construcoes[casa]).toBeUndefined();
    expect(s2.creditos).toBeCloseTo(1000 - USINAS.cataVento.custoBase / 2, 10);
    expect(quantidadeDe(s2, "cataVento")).toBe(0);
    expect(remover(s2, casa)).toBeNull();
  });

  it("recusa mar, plataforma, caminho, casa ocupada, obstáculo, ilha fechada e ₵ insuficientes", () => {
    const s = estadoLimpo(1000);
    const mar = arq.terra.indexOf(0);
    expect(avaliarCasa(s, mar, "cataVento").motivo).toBe("Só se constrói em terra");
    const plat = indiceCasa(n, arq.plataforma.meio, arq.plataforma.meio);
    expect(avaliarCasa(s, plat, "cataVento").motivo).toBe("A plataforma é do Núcleo");
    const caminho = arq.caminho.indexOf(1);
    expect(avaliarCasa(s, caminho, "cataVento").motivo).toBe("Caminho da aldeia");
    const casa = casaLivre(0);
    const s1 = colocar(s, casa, "cataVento")!;
    expect(avaliarCasa(s1, casa, "cataVento").motivo).toBe("Casa ocupada");
    const arvore = casaComObstaculo("arvore");
    expect(avaliarCasa(s, arvore, "cataVento").motivo).toContain("remova primeiro");
    const fechada = arq.ilhas[1].casas.find((i) => arq.obstaculos[i] === 255)!;
    expect(avaliarCasa(s, fechada, "cataVento").motivo).toBe("Ilha fechada: faça a expedição");
    expect(avaliarCasa({ ...s, creditos: 0 }, casaLivre(0, 3), "cataVento").motivo).toBe("₵ insuficientes");
    expect(podeColocar(s, mar, "cataVento")).toBe(false);
  });

  it("a subestação sobe de nível por ₵ × 3ⁿ e dobra o teto", () => {
    const s0 = estadoLimpo(100_000);
    const casa = casaLivre(0);
    const s1 = colocar(s0, casa, "subestacao")!;
    expect(custoNivelSubestacao(0)).toBe(SUBESTACAO.custoBase * 3);
    const s2 = melhorarSubestacao(s1, casa)!;
    expect(s2.mundo.construcoes[casa].nivel).toBe(1);
    expect(s1.creditos - s2.creditos).toBeCloseTo(SUBESTACAO.custoBase * 3, 10);
    expect(custoNivelSubestacao(1)).toBe(SUBESTACAO.custoBase * 9);
  });

  it("a subestação para no nível máximo 3 (teto 320 kW), e a segunda volta a ser decisão", () => {
    // Ajuste 2 da Sessão 7: sem teto de nível, uma subestação melhorada cobria a ilha inteira.
    expect(SUBESTACAO.nivelMax).toBe(3);
    let s = estadoLimpo(10_000_000);
    const casa = casaLivre(0);
    s = colocar(s, casa, "subestacao")!;
    for (let nivel = 0; nivel < SUBESTACAO.nivelMax; nivel++) {
      expect(avaliarMelhoriaSubestacao(s, casa).ok).toBe(true);
      s = melhorarSubestacao(s, casa)!;
    }
    expect(s.mundo.construcoes[casa].nivel).toBe(SUBESTACAO.nivelMax);
    expect(tetoSubestacao(SUBESTACAO.nivelMax)).toBe(320);
    const v = avaliarMelhoriaSubestacao(s, casa);
    expect(v.ok).toBe(false);
    expect(v.motivo).toContain("Nível máximo");
    expect(melhorarSubestacao(s, casa)).toBeNull();
  });
});

describe("obstáculos (GDD §8.5)", () => {
  it("desmatar cobra na hora, leva o tempo do tipo e devolve a casa", () => {
    const arvore = casaComObstaculo("arvore");
    const s0 = estadoLimpo(1000);
    expect(obstaculoEm(s0.mundo, arvore)).toBe("arvore");
    const s1 = removerObstaculo(s0, arvore)!;
    expect(s1.creditos).toBe(1000 - OBSTACULOS.arvore.custo);
    expect(s1.mundo.remocoes.length).toBe(1);
    expect(s1.mundo.remocoes[0].fimMs).toBe(OBSTACULOS.arvore.tempoMs);
    // antes do tempo, ainda de pé
    const meio = avancarTicks(s1, 10);
    expect(obstaculoEm(meio.mundo, arvore)).toBe("arvore");
    expect(podeColocar(meio, arvore, "cataVento")).toBe(false);
    const fim = avancarTicks(s1, OBSTACULOS.arvore.tempoMs / 100);
    expect(obstaculoEm(fim.mundo, arvore)).toBeNull();
    expect(fim.mundo.remocoes.length).toBe(0);
    expect(podeColocar(fim, arvore, "cataVento")).toBe(true);
  });

  it("a fila roda uma remoção de cada vez", () => {
    const s0 = estadoLimpo(1000);
    const a = casaComObstaculo("arbusto");
    const b = arq.ilhas[0].casas.find((i) => i !== a && obstaculoEm(s0.mundo, i) === "arbusto")!;
    const s1 = removerObstaculo(removerObstaculo(s0, a)!, b)!;
    expect(s1.mundo.remocoes.map((r) => r.indice)).toEqual([a, b]);
    expect(s1.mundo.remocoes[1].fimMs).toBe(0);
    const depois = avancarTicks(s1, OBSTACULOS.arbusto.tempoMs / 100);
    expect(obstaculoEm(depois.mundo, a)).toBeNull();
    expect(obstaculoEm(depois.mundo, b)).toBe("arbusto");
    expect(depois.mundo.remocoes[0].fimMs).toBeGreaterThan(depois.tempoMs);
    const fim = avancarTicks(depois, OBSTACULOS.arbusto.tempoMs / 100);
    expect(obstaculoEm(fim.mundo, b)).toBeNull();
  });

  it("a montanha 2×2 sai inteira, exige 🔬 20, devolve 🔬 40 e deixa cristal", () => {
    const ancora = arq.montanhas[0];
    const s0 = estadoLimpo(1000);
    expect(removerObstaculo(s0, ancora)).toBeNull(); // ilha fechada
    const aberta = comprarIlha({ ...estadoLimpo(1e6), pesquisa: 0 }, "pedreira")!;
    expect(removerObstaculo(aberta, ancora)).toBeNull(); // falta 🔬
    const comCiencia = { ...aberta, pesquisa: OBSTACULOS.montanha.pesquisa! };
    const s1 = removerObstaculo(comCiencia, ancora + n + 1)!; // toca no canto sudeste
    expect(s1.mundo.remocoes[0].indice).toBe(ancora);
    expect(comCiencia.creditos - s1.creditos).toBe(OBSTACULOS.montanha.custo);
    const fim = avancarTicks(s1, OBSTACULOS.montanha.tempoMs / 100);
    for (const casa of [ancora, ancora + 1, ancora + n, ancora + n + 1]) {
      expect(obstaculoEm(fim.mundo, casa)).toBeNull();
      // as quatro casas viram rocha com cristal (GDD §8.6, §9)
      expect(temCristal(fim.mundo, casa)).toBe(true);
      expect(terrenoDeJogo(fim.mundo, casa)).toBe("rocha");
    }
    expect(fim.pesquisa).toBe(comCiencia.pesquisa + OBSTACULOS.montanha.devolvePesquisa!);
  });

  it("pico é permanente", () => {
    const aberta = comprarIlha(estadoLimpo(1e6), "ventania")!;
    const pico = arq.ilhas[1].casas.find((i) => obstaculoEm(aberta.mundo, i) === "pico")!;
    expect(removerObstaculo(aberta, pico)).toBeNull();
  });
});

describe("expedição e cabo (GDD §8.5)", () => {
  it("a expedição abre a ilha e cobra o preço de §8.5", () => {
    const s0 = estadoLimpo(2_200);
    expect(ilhaDef("ventania").expedicao).toBe(1_800);
    const s1 = comprarIlha(s0, "ventania")!;
    expect(s1.creditos).toBe(400);
    expect(s1.mundo.ilhasAbertas).toContain("ventania");
    expect(s1.eventos.at(-1)).toEqual({ tipo: "ilhaAberta", id: "ventania" });
    expect(comprarIlha(s1, "ventania")).toBeNull();
    expect(comprarIlha(s1, "farol")).toBeNull(); // ₵ insuficientes
  });

  it("o cabo custa ₵ 150 + ₵ 120 por casa de mar e só depois da expedição", () => {
    const s0 = estadoLimpo(1e6);
    expect(ligarCabo(s0, "ventania")).toBeNull();
    const aberta = comprarIlha(s0, "ventania")!;
    const custo = custoCabo("ventania");
    expect(custo).toBeGreaterThanOrEqual(CABO.custoFixo + CABO.custoPorCasa);
    const ligada = ligarCabo(aberta, "ventania")!;
    expect(aberta.creditos - ligada.creditos).toBe(custo);
    expect(ligada.mundo.cabos).toEqual({ ventania: 0 });
    expect(ligarCabo(ligada, "ventania")).toBeNull();
  });

  it("o cabo tem nível: custo da rota × 3ⁿ e teto × 2ⁿ (GDD §8.5)", () => {
    const aberta = comprarIlha(estadoLimpo(1e9), "ventania")!;
    const ligada = ligarCabo(aberta, "ventania")!;
    expect(nivelCabo(ligada.mundo, "ventania")).toBe(0);
    expect(tetoCabo(0)).toBe(CABO.tetoKw);
    expect(tetoCabo(2)).toBe(CABO.tetoKw * 4);
    const custo = custoNivelCabo("ventania", 0);
    expect(custo).toBe(custoCabo("ventania") * CABO.custoNivel);
    const nivel1 = melhorarCabo(ligada, "ventania")!;
    expect(ligada.creditos - nivel1.creditos).toBe(custo);
    expect(nivelCabo(nivel1.mundo, "ventania")).toBe(1);
    expect(melhorarCabo(estadoLimpo(10), "ventania")).toBeNull(); // sem cabo, sem nível
  });

  it("passoRemocoes não muda nada com a fila vazia", () => {
    const s = estadoLimpo();
    expect(passoRemocoes(s)).toBe(s);
  });
});
