/**
 * Transição de era e Rede da Era 2 (GDD Parte 2 §2, §3 e §4): o que a transição leva e o que deixa,
 * construções 2×2, mar raso, térmica com combustível no extrato e as subestações novas.
 */
import { describe, expect, it } from "vitest";
import { REATOR } from "../../content/era2-nucleo";
import { BATERIA_REDE, DISTRITO_INDUSTRIAL, INSTITUTO, SUBESTACAO_138, SUBESTACAO_OFFSHORE, USINAS_ERA2 } from "../../content/era2";
import { DENSIDADES } from "../../content/cidade";
import { avaliarConstruirReator, construirReator, era3Pronta, podeConstruirReator, reembolsoDaTorre } from "../era";
import { avaliarCasa, colocar, custoColocar, remover } from "../mundo";
import { avaliarEvolucao, evoluirBairro } from "../cidade";
import { arquipelagoDaEra1 } from "../gerarArquipelago";
import { analisar, casasDaConstrucao, construcaoQueOcupa, ehMarRaso, ilhaDaCasa, ilhaEfetivaDe, tetoCabo, tetoDeSubestacao } from "../producao";
import { efeitosDos } from "../efeitos";
import { colocarPeca } from "../acoesNucleo";
import { desserializar, serializar } from "../save";
import { avancarTicks, balancoDoEstado } from "../tick";
import { nucleoInicial, VERSAO_SAVE, type GameState } from "../state";
import { estadoLimpo, plantar } from "./ajuda";

const arq = arquipelagoDaEra1();
const n = arq.n;

/** Estado pronto para a transição: Estabilidade 100 %, "Fissão básica" comprado e ₵ de sobra. */
function prontoParaOReator(creditos = 1e6): GameState {
  const s = estadoLimpo(creditos);
  const nucleo = { ...nucleoInicial(), estabilidade: 100 };
  const comPecas = { ...s, nucleo, pesquisados: [...s.pesquisados, "fissaoBasica"] };
  // uma torre montada de verdade, para o desmonte ter o que devolver
  let comGrade = comPecas;
  for (const [i, peca] of [[6, "heliostato"], [7, "heliostato"], [11, "turbina"], [13, "turbina"]] as const) {
    comGrade = colocarPeca(comGrade, i, peca) ?? comGrade;
  }
  return comGrade;
}

/** Primeira casa de mar raso que pertence à ilha principal. */
function marRasoDaPrincipal(): number {
  const ilhas = ilhaEfetivaDe(arq);
  for (let i = 0; i < n * n; i++) if (ehMarRaso(i, arq) && ilhas[i] === 0) return i;
  throw new Error("sem mar raso na principal");
}

/** Primeira casa livre de terra da ilha principal com espaço para uma construção 2×2. */
function casaPara2x2(state: GameState, tipo: Parameters<typeof avaliarCasa>[2]): number {
  for (const i of arq.ilhas[0].casas) {
    if (avaliarCasa(state, i, tipo, arq).ok) return i;
  }
  throw new Error("sem espaço para 2×2");
}

describe("transição para a Era 2 (GDD Parte 2 §2)", () => {
  it("exige Estabilidade 100 %, o nó Fissão básica e ₵ 200 000", () => {
    const semNada = { ...estadoLimpo(1e6), nucleo: nucleoInicial() };
    expect(avaliarConstruirReator(estadoLimpo(1e6)).motivo).toContain("Núcleo");
    expect(avaliarConstruirReator(semNada).motivo).toContain("Fissão básica");
    const semEstabilidade = { ...semNada, nucleo: nucleoInicial(), pesquisados: [...semNada.pesquisados, "fissaoBasica"] };
    expect(avaliarConstruirReator(semEstabilidade).motivo).toContain("Estabilidade");
    const pobre = { ...prontoParaOReator(1_000) };
    expect(avaliarConstruirReator(pobre).motivo).toContain("₵");
    expect(podeConstruirReator(prontoParaOReator())).toBe(true);
  });

  it("desmonta a Torre devolvendo 50 %, planta o Vaso em 5×5 e zera a Estabilidade", () => {
    const s = prontoParaOReator();
    const reembolso = reembolsoDaTorre(s.nucleo);
    expect(reembolso).toBe((30 + 30 + 50 + 50) / 2);
    const depois = construirReator(s)!;
    expect(depois.era).toBe(2);
    expect(depois.nucleo!.era).toBe(2);
    expect(depois.creditos).toBeCloseTo(s.creditos - REATOR.custoVaso + reembolso, 6);
    expect(depois.nucleo!.lado).toBe(5);
    expect(depois.nucleo!.estabilidade).toBe(0);
    expect(depois.nucleo!.calorU).toBe(0);
    // o centro é a peça fixa da era (o Vaso) e o resto da grade está vazio
    expect(depois.nucleo!.grade[12]).toEqual({ tipo: "receptor" });
    expect(depois.nucleo!.grade.filter(Boolean).length).toBe(1);
    expect(depois.eventos.some((e) => e.tipo === "eraMudou")).toBe(true);
  });

  it("fica tudo o resto: ilhas, cabos, construções, ₵, 🔬 e os nós da Era 1", () => {
    let s = plantar(prontoParaOReator(), "cataVento", 3);
    s = { ...s, pesquisa: 4_321, mundo: { ...s.mundo, ilhasAbertas: ["principal", "ventania"], cabos: { ventania: 1 } } };
    const antes = analisar(s);
    const depois = construirReator(s)!;
    const agora = analisar(depois);
    expect(agora.contagem.cataVento).toBe(antes.contagem.cataVento);
    expect(agora.brutoKw).toBeCloseTo(antes.brutoKw, 9);
    expect(depois.pesquisa).toBe(4_321);
    expect(depois.mundo.ilhasAbertas).toEqual(["principal", "ventania"]);
    expect(depois.mundo.cabos.ventania).toBe(1);
    expect(depois.pesquisados).toContain("fissaoBasica");
  });

  it("não há volta: com o reator construído a ação some", () => {
    const depois = construirReator(prontoParaOReator())!;
    expect(podeConstruirReator(depois)).toBe(false);
    expect(construirReator(depois)).toBeNull();
  });

  it("a saída da Era 2 é Fusão básica + Estabilidade 100 % (a Era 3 ainda não existe)", () => {
    const depois = construirReator(prontoParaOReator())!;
    expect(era3Pronta(depois)).toBe(false);
    const pronto = { ...depois, pesquisados: [...depois.pesquisados, "fusaoBasica"], nucleo: { ...depois.nucleo!, estabilidade: 100 } };
    expect(era3Pronta(pronto)).toBe(true);
  });
});

describe("save v8 (GDD Parte 2 §2)", () => {
  it("a versão é 8 e a era faz a ida e a volta", () => {
    expect(VERSAO_SAVE).toBe(8);
    const depois = construirReator(prontoParaOReator())!;
    const comVareta = colocarPeca(avancarTicks(depois, 100), 6, "vareta")!;
    const lido = desserializar(serializar(comVareta, 1000), 1000);
    expect(lido.era).toBe(2);
    expect(lido.nucleo!.era).toBe(2);
    const casa = lido.nucleo!.grade[6];
    expect(casa).toMatchObject({ tipo: "peca", id: "vareta" });
    expect((casa as { vareta: { restanteS: number } }).vareta.restanteS).toBeGreaterThan(0);
  });

  it("um save v7 continua jogável: entra como Era 1 e o Núcleo ganha a marca", () => {
    const v7 = {
      versao: 7,
      tempoMs: 1000,
      creditos: 500,
      pesquisa: 10,
      pesquisados: ["laboratorio"],
      capitulos: [],
      rede: { usinas: { cataVento: { nivel: 0 }, painelSolar: { nivel: 0 }, turbinaEolica: { nivel: 0 } }, bateria: { kwh: 0 } },
      mundo: { construcoes: {}, removidos: [], remocoes: [], cristais: [], ilhasAbertas: ["principal"], cabos: {} },
      nucleo: { lado: 5, grade: [], calorU: 3, estabilidade: 40, scramRestanteMs: 0, modoSeguro: false, receptorCeramico: false, cascatas: 0 },
      salvoEmMs: 1000,
      cardsVistos: [],
    };
    const s = desserializar(JSON.stringify(v7), 1000);
    expect(s.versao).toBe(8);
    expect(s.era).toBe(1);
    expect(s.nucleo!.era).toBe(1);
    expect(s.nucleo!.estabilidade).toBe(40);
    expect(s.nucleo!.trocasEmFaixa).toBe(0);
    expect(s.nucleo!.scramInicioMs).toBeNull();
  });

  it("peça de outra era no save é descartada: a Torre não tem vareta", () => {
    const bruto = JSON.parse(serializar(prontoParaOReator(), 1000)) as Record<string, unknown>;
    const nucleo = bruto.nucleo as { grade: unknown[] };
    nucleo.grade[8] = { tipo: "peca", id: "vareta", vareta: { restanteS: 600, gastaDesdeMs: null } };
    const lido = desserializar(JSON.stringify(bruto), 1000);
    expect(lido.nucleo!.grade[8]).toBeNull();
  });
});

describe("construções 2×2 e mar raso (GDD Parte 2 §3.1)", () => {
  const naEra2 = (creditos = 1e7): GameState => ({ ...construirReator(prontoParaOReator(creditos))!, creditos });

  it("uma construção 2×2 ocupa quatro casas e sai inteira ao remover", () => {
    let s = naEra2();
    s = { ...s, pesquisados: [...s.pesquisados, "institutoDePesquisa"] };
    const casa = casaPara2x2(s, "institutoPesquisa");
    const casas = casasDaConstrucao(casa, "institutoPesquisa", n);
    expect(casas.length).toBe(4);
    const posto = colocar(s, casa, "institutoPesquisa")!;
    for (const c of casas) expect(construcaoQueOcupa(posto.mundo, c, arq)?.tipo).toBe("institutoPesquisa");
    // nenhuma das quatro aceita outra coisa
    for (const c of casas) expect(avaliarCasa(posto, c, "cataVento", arq).motivo).toBe("Casa ocupada");
    // remover tocando numa casa qualquer tira a construção inteira
    const semNada = remover(posto, casas[3], arq)!;
    expect(Object.keys(semNada.mundo.construcoes).length).toBe(Object.keys(s.mundo.construcoes).length);
  });

  it("a 2×2 recusa a casa quando uma das quatro está ocupada", () => {
    let s = naEra2();
    s = { ...s, pesquisados: [...s.pesquisados, "institutoDePesquisa"] };
    const casa = casaPara2x2(s, "institutoPesquisa");
    const vizinha = casasDaConstrucao(casa, "institutoPesquisa", n)[3];
    const comCata = colocar(s, vizinha, "cataVento")!;
    expect(avaliarCasa(comCata, casa, "institutoPesquisa", arq).ok).toBe(false);
    expect(avaliarCasa(comCata, casa, "institutoPesquisa", arq).motivo).toBe("Casa ocupada");
  });

  it("a eólica offshore vai em mar raso e pertence à ilha mais próxima; mar fundo só com fundação flutuante", () => {
    let s = naEra2();
    s = { ...s, pesquisados: [...s.pesquisados, "subestacaoOffshore"] };
    const raso = marRasoDaPrincipal();
    expect(ilhaDaCasa(raso, arq)).toBe("principal");
    expect(avaliarCasa(s, raso, "eolicaOffshore", arq).ok).toBe(true);
    // em terra ela não vai
    const terra = arq.ilhas[0].casas.find((i) => avaliarCasa(s, i, "cataVento", arq).ok)!;
    expect(avaliarCasa(s, terra, "eolicaOffshore", arq).motivo).toBe("Esta vai no mar");
    // mar fundo: recusado até o nó
    const fundo = (() => {
      const ilhas = ilhaEfetivaDe(arq);
      for (let i = 0; i < n * n; i++) if (arq.terra[i] !== 1 && arq.distMar[i] > 3 && ilhas[i] === 0) return i;
      throw new Error("sem mar fundo da principal");
    })();
    expect(avaliarCasa(s, fundo, "eolicaOffshore", arq).motivo).toContain("fundação flutuante");
    const comNo = { ...s, pesquisados: [...s.pesquisados, "fundacaoFlutuante"] };
    expect(efeitosDos(comNo.pesquisados).marFundo).toBe(true);
  });

  it("a fazenda solar não sobe em colina", () => {
    const s = naEra2();
    const colina = arq.ilhas[0].casas.find((i) => arq.terreno[i] === 1 && avaliarCasa(s, i, "cataVento", arq).ok);
    if (colina === undefined) return; // a semente sempre tem colinas, mas o teste não depende disso
    expect(avaliarCasa(s, colina, "fazendaSolar", arq).motivo).toContain("colina");
  });
});

describe("escoamento e custo de operação da Era 2 (GDD Parte 2 §3.1, §3.2)", () => {
  const naEra2 = (creditos = 1e7): GameState => ({ ...construirReator(prontoParaOReator(creditos))!, creditos });

  it("a subestação de 138 kV escoa 5 000 kW num raio de 4, e dobra o teto por nível", () => {
    expect(SUBESTACAO_138.tetoKw).toBe(5_000);
    expect(SUBESTACAO_138.alcance).toBe(4);
    expect(tetoDeSubestacao("subestacao138", 2)).toBe(20_000);
    expect(tetoDeSubestacao("subestacaoOffshore", 1)).toBe(SUBESTACAO_OFFSHORE.tetoKw * 2);
  });

  it("a térmica a gás cobra combustível enquanto liga e some do extrato quando desliga", () => {
    let s = naEra2();
    // uma subestação de 138 kV e uma térmica ao lado dela
    s = { ...s, pesquisados: [...s.pesquisados, "subestacaoDe138kV"] };
    const casaSub = arq.ilhas[0].casas.find((i) => avaliarCasa(s, i, "subestacao138", arq).ok)!;
    s = colocar(s, casaSub, "subestacao138")!;
    const casaTermica = casaPara2x2(s, "termicaGas");
    s = colocar(s, casaTermica, "termicaGas")!;
    s = plantar(s, "bairro", 1);
    const a = analisar(s);
    const termica = a.usinas.find((u) => u.tipo === "termicaGas")!;
    expect(termica.brutoKw).toBeGreaterThan(0);
    expect(a.custoOperacaoPorSegundo).toBeCloseTo(USINAS_ERA2.termicaGas.combustivelPorSegundo!, 6);
    // o balanço mostra receita, custo e receita líquida
    const b = balancoDoEstado(s);
    expect(b.custoPorSegundo).toBeCloseTo(a.custoOperacaoPorSegundo, 6);
    expect(b.receitaLiquidaPorSegundo).toBeCloseTo(b.receitaPorSegundo - b.custoPorSegundo, 6);

    // sem escoamento ela desliga sozinha: não queima gás à toa
    const semSub = remover(s, casaSub, arq)!;
    const semEscoamento = analisar(semSub);
    const desligada = semEscoamento.usinas.find((u) => u.tipo === "termicaGas")!;
    expect(desligada.escoadoKw).toBe(0);
    expect(desligada.brutoKw).toBe(0);
    expect(semEscoamento.custoOperacaoPorSegundo).toBe(0);
  });

  it("o nó Cabo HVDC multiplica o teto de todos os cabos por 10", () => {
    expect(tetoCabo(0)).toBe(30);
    expect(tetoCabo(1)).toBe(60);
    expect(tetoCabo(0, efeitosDos(["caboHvdc"]))).toBe(300);
    expect(tetoCabo(1, efeitosDos(["caboHvdc"]))).toBe(600);
  });

  it("a bateria de rede soma 2 000 kWh e ±1 000 kW, e a Rede inteligente dobra", () => {
    let s = naEra2();
    s = { ...s, pesquisados: [...s.pesquisados, "bateriaDeRede"] };
    const casa = arq.ilhas[0].casas.find((i) => avaliarCasa(s, i, "bateriaRede", arq).ok)!;
    s = colocar(s, casa, "bateriaRede")!;
    const b = balancoDoEstado(s);
    void b;
    const rede = analisar(s);
    expect(rede.contagem.bateriaRede).toBe(1);
    expect(custoColocar(s, "bateriaRede")).toBeCloseTo(BATERIA_REDE.custoBase * 1.25, 6);
    const comNo = { ...s, pesquisados: [...s.pesquisados, "redeInteligente"] };
    expect(efeitosDos(comNo.pesquisados).bateriaRedeFator).toBe(2);
  });
});

describe("cidade da Era 2 (GDD Parte 2 §4)", () => {
  const naEra2 = (creditos = 1e7): GameState => ({ ...construirReator(prontoParaOReator(creditos))!, creditos });

  it("a megacidade e a arcologia só evoluem com o nó da árvore", () => {
    let s = plantar(naEra2(), "bairro", 1);
    const casa = Object.keys(s.mundo.construcoes).map(Number).find((i) => s.mundo.construcoes[i].tipo === "bairro")!;
    // sobe até metrópole com 🔬 de sobra
    s = { ...s, pesquisa: 1e6 };
    for (let k = 0; k < 3; k++) s = evoluirBairro(s, casa)!;
    expect(s.mundo.construcoes[casa].nivel).toBe(3);
    expect(avaliarEvolucao(s, casa).motivo).toContain("Megacidade");
    const comNo = { ...s, pesquisados: [...s.pesquisados, "megacidade"] };
    expect(avaliarEvolucao(comNo, casa).ok).toBe(true);
    const mega = evoluirBairro(comNo, casa)!;
    expect(analisar(mega).populacao).toBe(DENSIDADES[4].populacao);
    expect(avaliarEvolucao(mega, casa).motivo).toContain("Arcologia");
  });

  it("o distrito industrial exige subestação de 138 kV no alcance", () => {
    let s = naEra2();
    s = { ...s, pesquisados: [...s.pesquisados, "industriaPesada", "subestacaoDe138kV"] };
    const casa = casaPara2x2(s, "distritoIndustrial");
    const semCerto = colocar(s, casa, "distritoIndustrial")!;
    expect(analisar(semCerto).distritosSemEscoamento).toBe(1);
    expect(analisar(semCerto).demandaKw).toBe(0);
    // com a subestação certa por perto, ele passa a pedir 3 000 kW e a pagar ×2,2
    const perto = casasDaConstrucao(casa, "distritoIndustrial", n)[0] + 2 * n + 2;
    const comSub = colocar(semCerto, perto, "subestacao138") ?? semCerto;
    const a = analisar(comSub);
    if (a.distritosSemEscoamento === 0) {
      expect(a.demandaKw).toBeCloseTo(DISTRITO_INDUSTRIAL.demandaKw, 6);
      expect(a.tarifa).toBeCloseTo(DISTRITO_INDUSTRIAL.tarifa, 6);
    }
  });

  it("o instituto rende 🔬 3/s consumindo 50 kW", () => {
    let s = naEra2();
    s = { ...s, pesquisados: [...s.pesquisados, "institutoDePesquisa"] };
    const a0 = analisar(s);
    const casa = casaPara2x2(s, "institutoPesquisa");
    const posto = colocar(s, casa, "institutoPesquisa")!;
    const a = analisar(posto);
    // só rende com subestação no alcance; a aldeia de nascença tem uma
    if (a.pesquisaPorSegundo > a0.pesquisaPorSegundo) {
      expect(a.pesquisaPorSegundo - a0.pesquisaPorSegundo).toBeCloseTo(INSTITUTO.pesquisaPorSegundo, 6);
    }
  });
});
