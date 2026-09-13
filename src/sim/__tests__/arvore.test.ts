import { describe, expect, it } from "vitest";
import { NOS, NOS_INICIAIS, NO_POR_ID } from "../../content/arvore-era1";
import { SUBESTACAO, VIZINHANCA } from "../../content/era1-arquipelago";
import { NUCLEO } from "../../content/era1-nucleo";
import { USINAS } from "../../content/era1";
import { avaliarNo, disponivel, efeitosDos, excluido, pesquisar, podePesquisar, proximoNo } from "../arvore";
import { capacidadeU, colocar, equilibrioU, potenciaNucleoKw } from "../nucleo";
import { analisar } from "../producao";
import { gradeVazia, nucleoInicial, type GameState } from "../state";
import { balancoDoEstado } from "../tick";
import { estadoLimpo, plantar } from "./ajuda";

const comCiencia = (pesquisa: number, creditos = 1e6): GameState => ({ ...estadoLimpo(creditos), pesquisa });

describe("árvore de pesquisa: conteúdo (GDD §8.6)", () => {
  it("todo nó tem uma frase de física e um efeito", () => {
    for (const no of NOS) {
      expect(no.fisica.length, no.id).toBeGreaterThan(30);
      expect(no.nome.length, no.id).toBeGreaterThan(2);
      expect(no.efeitoTexto.length, no.id).toBeGreaterThan(5);
      // "Fissão básica" é a porta da Era 2: cobra 🔬 e ₵ e não muda nada por si (GDD §8.4)
      if (no.id !== "fissaoBasica") expect(no.efeitos.length, no.id).toBeGreaterThan(0);
      expect(no.pesquisa, no.id).toBeGreaterThanOrEqual(0);
    }
  });

  it("os ids são únicos e os pré-requisitos e exclusões existem", () => {
    const ids = NOS.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const no of NOS) {
      for (const p of no.pre ?? []) expect(NO_POR_ID[p], `${no.id} → ${p}`).toBeDefined();
      for (const e of no.exclui ?? []) expect(NO_POR_ID[e], `${no.id} ⊗ ${e}`).toBeDefined();
    }
  });

  it("os custos são os de §8.6 recalibrados pela simulação de 60 min (parte F)", () => {
    expect(NO_POR_ID.laminasDeFibra.pesquisa).toBe(25);
    expect(NO_POR_ID.torreMaisAlta.pesquisa).toBe(150);
    expect(NO_POR_ID.controleDePasso.pesquisa).toBe(1_000);
    expect(NO_POR_ID.rotorTresPas.pesquisa).toBe(2_000);
    expect(NO_POR_ID.painelBifacial.pesquisa).toBe(60);
    expect(NO_POR_ID.subestacaoAltaTensao.pesquisa).toBe(800);
    expect(NO_POR_ID.bateriaDeFluxo.pesquisa).toBe(1_600);
    expect(NO_POR_ID.heliostatoDoisEixos.pesquisa).toBe(700);
    expect(NO_POR_ID.turbinaAltaPressao.pesquisa).toBe(1_200);
    expect(NO_POR_ID.radiadorAtivo.pesquisa).toBe(900);
    expect(NO_POR_ID.tanqueDoisSais.pesquisa).toBe(1_100);
    expect(NO_POR_ID.iluminacaoEficiente.pesquisa).toBe(250);
    expect(NO_POR_ID.bombasDeCalor.pesquisa).toBe(1_800);
    expect(NO_POR_ID.turbinaEolica.pesquisa).toBe(40);
    expect(NO_POR_ID.bateria.pesquisa).toBe(20);
  });
});

describe("árvore de pesquisa: compra", () => {
  it("🔬 é gasto, não limiar", () => {
    const s = comCiencia(100);
    const depois = pesquisar(s, "laminasDeFibra")!;
    expect(depois.pesquisa).toBe(100 - 25);
    expect(depois.pesquisados).toContain("laminasDeFibra");
    expect(pesquisar(depois, "laminasDeFibra")).toBeNull(); // não se compra duas vezes
  });

  it("nó com ₵ cobra os dois", () => {
    const s = { ...comCiencia(100, 500), nucleo: nucleoInicial() };
    const depois = pesquisar(s, "receptorCeramico")!;
    expect(depois.creditos).toBe(500 - 300);
    expect(depois.pesquisa).toBe(100 - 80);
    expect(depois.nucleo!.receptorCeramico).toBe(true);
  });

  it("pré-requisito trava até o nó anterior existir", () => {
    const s = comCiencia(1000);
    expect(podePesquisar(s, "torreMaisAlta")).toBe(false);
    expect(avaliarNo(s, "torreMaisAlta").motivo).toBe("Exige Lâminas de fibra");
    expect(disponivel(s, "torreMaisAlta")).toBe(false);
    const com = pesquisar(s, "laminasDeFibra")!;
    expect(podePesquisar(com, "torreMaisAlta")).toBe(true);
  });

  it("a escolha exclusiva é definitiva", () => {
    let s = comCiencia(20_000);
    for (const id of ["laminasDeFibra", "torreMaisAlta", "controleDePasso", "rotorTresPas"]) s = pesquisar(s, id)!;
    expect(podePesquisar(s, "eixoVertical")).toBe(true);
    expect(podePesquisar(s, "eixoHorizontal")).toBe(true);
    const vertical = pesquisar(s, "eixoVertical")!;
    expect(excluido(vertical, NO_POR_ID.eixoHorizontal)).toBe(true);
    expect(podePesquisar(vertical, "eixoHorizontal")).toBe(false);
    expect(avaliarNo(vertical, "eixoHorizontal").motivo).toBe("Excluído pela escolha que você fez");
    expect(disponivel(vertical, "eixoHorizontal")).toBe(false);
  });

  it("sempre há um nó comprável à vista: 🔬 nunca acumula sem sumidouro (GDD §7)", () => {
    let s = comCiencia(0);
    expect(proximoNo(s)).not.toBeNull();
    // compra tudo o que der, com 🔬 e ₵ de sobra, até a árvore acabar
    s = { ...s, pesquisa: 1e6, creditos: 1e6, nucleo: nucleoInicial() };
    const comprados: string[] = [];
    for (let i = 0; i < NOS.length + 5; i++) {
      const proximo = proximoNo(s);
      if (!proximo) break;
      comprados.push(proximo.id);
      s = pesquisar(s, proximo.id)!;
    }
    // só as escolhas exclusivas ficam de fora (uma das duas)
    expect(comprados.length).toBe(NOS.length - NOS_INICIAIS.length - 1);
    expect(proximoNo(s)).toBeNull();
  });

  it("o nó do laboratório nasce comprado: a primeira ciência não pode custar 🔬", () => {
    expect(NOS_INICIAIS).toContain("laboratorio");
    expect(estadoLimpo().pesquisados).toContain("laboratorio");
  });
});

describe("efeitos da árvore nas fórmulas", () => {
  it("potência das usinas: os fatores se multiplicam", () => {
    const e = efeitosDos(["laminasDeFibra", "torreMaisAlta"]);
    expect(e.potencia.cataVento).toBeCloseTo(1.25 * 1.4, 10);
    expect(e.potencia.turbinaEolica).toBeCloseTo(1.25 * 1.4, 10);
    expect(e.potencia.painelSolar).toBe(1);
    const sol = efeitosDos(["painelBifacial", "antirreflexo", "limpezaAutomatica"]);
    expect(sol.potencia.painelSolar).toBeCloseTo(1.15 * 1.08 * 1.1, 10);
  });

  it("controle de passo corta a esteira pela metade; eixo vertical acaba com ela", () => {
    expect(efeitosDos(["controleDePasso"]).esteiraPorVizinho).toBeCloseTo(VIZINHANCA.esteiraPorVizinho / 2, 10);
    const vertical = efeitosDos(["eixoVertical"]);
    expect(vertical.esteiraPorVizinho).toBe(0);
    expect(vertical.potencia.cataVento).toBeCloseTo(0.8, 10);
  });

  it("a esteira menor aparece na produção de duas usinas coladas", () => {
    const base = plantar(estadoLimpo(0), "cataVento", 1);
    const casa = Object.keys(base.mundo.construcoes).map(Number).find((i) => base.mundo.construcoes[i].tipo === "cataVento")!;
    const vizinha = casa + 1;
    const colada: GameState = {
      ...base,
      mundo: { ...base.mundo, construcoes: { ...base.mundo.construcoes, [vizinha]: { tipo: "cataVento", nivel: 0, colocadoEmMs: 0 } } },
    };
    const semNo = analisar(colada).porCasa.get(casa)!.fatorEsteira;
    const comNo = analisar({ ...colada, pesquisados: ["controleDePasso"] }).porCasa.get(casa)!.fatorEsteira;
    expect(semNo).toBeCloseTo(0.8, 10);
    expect(comNo).toBeCloseTo(0.9, 10);
  });

  it("subestação de alta tensão leva o alcance de 3 para 5", () => {
    expect(efeitosDos([]).alcanceSubestacao).toBe(SUBESTACAO.alcance);
    expect(efeitosDos(["subestacaoAltaTensao"]).alcanceSubestacao).toBe(5);
  });

  it("bateria de fluxo dá +50 % de kWh por unidade", () => {
    const s = plantar(estadoLimpo(0), "bateria", 1);
    const antes = balancoDoEstado(s);
    const depois = balancoDoEstado({ ...s, pesquisados: ["bateriaDeFluxo"] });
    expect(antes.ofertaKw).toBe(depois.ofertaKw);
    expect(efeitosDos(["bateriaDeFluxo"]).capacidadeBateriaFator).toBe(1.5);
  });

  it("iluminação eficiente tira 10 % da demanda sem mexer na tarifa; bombas de calor põem 10 % na tarifa", () => {
    const s = plantar(estadoLimpo(0), "bairro", 1);
    const base = analisar(s);
    const eficiente = analisar({ ...s, pesquisados: ["iluminacaoEficiente"] });
    expect(eficiente.demandaKw).toBeCloseTo(base.demandaKw * 0.9, 10);
    expect(eficiente.tarifa).toBe(base.tarifa);
    const bombas = analisar({ ...s, pesquisados: ["bombasDeCalor"] });
    expect(bombas.tarifa).toBeCloseTo(base.tarifa * 1.1, 10);
  });

  it("níveis das peças do Núcleo: calor, kW por u, dissipação e capacidade", () => {
    const e = efeitosDos(["rastreamentoSolar", "heliostatoDoisEixos", "turbinaAltaPressao", "radiadorAtivo", "tanqueDoisSais"]);
    expect(e.calorPorEspelho).toBeCloseTo(5 * 1.25, 10);
    expect(e.turbinaKwPorUnidade).toBeCloseTo(NUCLEO.kwPorUnidade * 1.3, 10);
    expect(e.dissipacaoRadiador).toBe(9);
    expect(e.consumoRadiadorKw).toBe(1);
    expect(e.capacidadeTanqueU).toBeCloseTo(NUCLEO.capacidadeTanqueU * 1.5, 10);

    // grade com 1 tanque e 1 turbina adjacentes ao Receptor
    let grade = gradeVazia(5);
    grade = colocar(grade, 7, "tanque");
    grade = colocar(grade, 11, "turbina");
    expect(capacidadeU(grade, false)).toBe(NUCLEO.capacidadeReceptorU + NUCLEO.capacidadeTanqueU);
    expect(capacidadeU(grade, false, e)).toBeCloseTo(NUCLEO.capacidadeReceptorU + NUCLEO.capacidadeTanqueU * 1.5, 10);
    expect(potenciaNucleoKw(grade, 100, e)).toBeCloseTo(1 * NUCLEO.consumoTurbina * 100 * NUCLEO.kwPorUnidade * 1.3, 10);
  });

  it("o radiador ativo dissipa mais e cobra 1 kW do Núcleo", () => {
    let grade = gradeVazia(5);
    grade = colocar(grade, 7, "radiador");
    grade = colocar(grade, 11, "turbina");
    grade = colocar(grade, 13, "heliostato");
    const e = efeitosDos(["radiadorAtivo"]);
    // Q* = (4h − dissipação) ÷ (0,12 t): 4 u/s de entrada contra 6 de dissipação já zera
    expect(equilibrioU(grade)).toBe(0);
    expect(equilibrioU(grade, e)).toBe(0); // 9 u/s de dissipação contra 4 u/s de entrada
    expect(potenciaNucleoKw(grade, 100, e)).toBeCloseTo(1 * NUCLEO.consumoTurbina * 100 * NUCLEO.kwPorUnidade - 1, 10);
  });

  it("desbloqueios: o nó libera o prédio na paleta", () => {
    expect(USINAS.turbinaEolica.desbloqueio?.no).toBe("turbinaEolica");
    expect(efeitosDos(["turbinaEolica", "bateria", "universidade"]).desbloqueados).toEqual(["turbinaEolica", "bateria", "universidade"]);
  });
});
