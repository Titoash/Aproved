/**
 * Simulação de 60 minutos de jogo ativo (GDD §7, parte F da Sessão 7).
 *
 * Um bot simples joga a Era 1 seguindo os capítulos, com o **tick do sim** (100 ms de timestep fixo):
 * nada aqui reimplementa regra de jogo — todas as decisões passam pelas mesmas funções puras que a
 * interface usa (`colocar`, `pesquisar`, `evoluirBairro`, `comprarIlha`, `ligarCabo`, `tick`).
 *
 *   npm run simular            60 minutos, relatório a cada 5 min e os 10 primeiros em detalhe
 *   npm run simular -- 90      90 minutos
 *
 * O objetivo é medir ritmo, não vencer: se o bot fecha a Era 1 em 50–70 minutos, os números de §8.5 e
 * §8.6 estão no lugar.
 */
import { NOS, NO_POR_ID } from "../src/content/arvore";
import { CAPITULOS } from "../src/content/capitulos";
import { LABORATORIO, UNIVERSIDADE } from "../src/content/cidade-era1";
import { DENSIDADES } from "../src/content/cidade";
import { ILHAS, OBSTACULOS } from "../src/content/era1-arquipelago";
import { NUCLEO, PECAS } from "../src/content/era1-nucleo";
import { PECA_POR_ID } from "../src/content/pecas";
import { USINAS } from "../src/content/usinas";
import { pesquisar, podePesquisar, proximoNo } from "../src/sim/arvore";
import { desbloquearNucleo, colocarPeca, podeDesbloquearNucleo } from "../src/sim/acoesNucleo";
import { indiceCasa, naPlataforma } from "../src/sim/arquipelago";
import { capituloAtivo } from "../src/sim/capitulos";
import { evoluirBairro, podeEvoluirBairro } from "../src/sim/cidade";
import { efeitosDe } from "../src/sim/efeitos";
import { arquipelagoDaEra1 } from "../src/sim/gerarArquipelago";
import {
  avaliarCasa,
  avaliarRemocaoObstaculo,
  colocar,
  comprarIlha,
  custoCabo,
  custoColocar,
  custoExpedicao,
  ligarCabo,
  melhorarCabo,
  custoNivelDe,
  melhorarSubestacao,
  obstaculoEm,
  podeComprarIlha,
  podeLigarCabo,
  podeMelhorarCabo,
  podeMelhorarSubestacao,
  removerObstaculo,
  tetoCabo,
} from "../src/sim/mundo";
import { anel, contar, espelhosEfetivos } from "../src/sim/nucleo";
import { equilibrioMotor, motorDoNucleo } from "../src/sim/motor";
import { construirReator, podeConstruirReator } from "../src/sim/era";
import { contarReator, varetaNova } from "../src/sim/reator";
import { REATOR, VARETA } from "../src/content/era2-nucleo";
import { limparEntulho, podeTrocarVareta, removerPeca, trocarVareta } from "../src/sim/acoesNucleo";
import { analisar, ehMarRaso, terrenoDeJogo } from "../src/sim/producao";
import { estadoInicial, indiceReceptor, type GameState, type PecaId, type TipoConstrucao } from "../src/sim/state";
import { balancoDoEstado, tick, TICK_MS } from "../src/sim/tick";

const arq = arquipelagoDaEra1();
const n = arq.n;

/* ------------------------------------------------------------------ */
/* Escolha de casa                                                     */
/* ------------------------------------------------------------------ */

/** Casas de uma ilha aberta, em ordem de distância à plataforma (o bot cresce a partir do centro). */
const casasPorIlha = new Map<number, number[]>();
function casasDe(q: number): number[] {
  let lista = casasPorIlha.get(q);
  if (!lista) {
    const meio = arq.plataforma.meio;
    lista = arq.ilhas[q].casas
      .filter((i) => !naPlataforma(arq.plataforma, i % n, Math.floor(i / n)) && arq.caminho[i] === 0)
      .sort((a, b) => Math.hypot((a % n) - meio, Math.floor(a / n) - meio) - Math.hypot((b % n) - meio, Math.floor(b / n) - meio) || a - b);
    casasPorIlha.set(q, lista);
  }
  return lista;
}

const cheb = (a: number, b: number) => Math.max(Math.abs((a % n) - (b % n)), Math.abs(Math.floor(a / n) - Math.floor(b / n)));

/** Subestação com folga no teto ao alcance da casa. */
function temEscoamento(state: GameState, casa: number): boolean {
  const analise = analisar(state);
  const alcance = efeitosDe(state).alcanceSubestacao;
  return analise.subestacoes.some((s) => arq.ilha[s.indice] === arq.ilha[casa] && cheb(s.indice, casa) <= alcance && s.usadoKw < s.tetoKw - 0.01);
}

/** Quanto uma usina renderia nesta casa, contando terreno e vizinhos (sem colocar de fato). */
function rendimento(state: GameState, casa: number, tipo: TipoConstrucao): number {
  const terreno = terrenoDeJogo(state.mundo, casa) ?? "planicie";
  const vento = tipo === "cataVento" || tipo === "turbinaEolica";
  const efeitos = efeitosDe(state);
  let fator = vento ? (terreno === "colina" ? 1.25 : terreno === "litoral" ? 1.5 : 1) : terreno === "planicie" ? 1.15 : 1;
  let vizinhosEolicos = 0;
  let altos = 0;
  let picos = 0;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const x = (casa % n) + dx;
    const y = Math.floor(casa / n) + dy;
    if (x < 0 || y < 0 || x >= n || y >= n) continue;
    const j = indiceCasa(n, x, y);
    const c = state.mundo.construcoes[j];
    if (c && (c.tipo === "cataVento" || c.tipo === "turbinaEolica")) vizinhosEolicos++;
    if (c?.tipo === "turbinaEolica") altos++;
    const o = obstaculoEm(state.mundo, j, arq);
    if (o) {
      if (OBSTACULOS[o].alto) altos++;
      if (o === "pico") picos++;
    }
  }
  if (vento) fator *= Math.max(0.4, 1 - efeitos.esteiraPorVizinho * vizinhosEolicos) * (1 + 0.3 * picos);
  else fator *= Math.max(0.4, 1 - 0.3 * altos);
  return USINAS[tipo as "cataVento"]?.potenciaKw * fator * (efeitos.potencia[tipo as "cataVento"] ?? 1);
}

/** Melhor casa livre para o tipo, entre as ilhas abertas; `null` se não houver nenhuma aceitável. */
function melhorCasa(state: GameState, tipo: TipoConstrucao, exigirEscoamento = true): number | null {
  let melhor: number | null = null;
  let melhorNota = -Infinity;
  const ehUsina = tipo === "cataVento" || tipo === "painelSolar" || tipo === "turbinaEolica";
  for (const id of state.mundo.ilhasAbertas) {
    const q = ILHAS.findIndex((i) => i.id === id);
    for (const casa of casasDe(q)) {
      if (!avaliarCasa(state, casa, tipo, arq).ok) continue;
      if (exigirEscoamento && tipo !== "subestacao" && tipo !== "bateria" && !temEscoamento(state, casa)) continue;
      const nota = ehUsina ? rendimento(state, casa, tipo) : -cheb(casa, arq.plataforma.meio * (n + 1)) / 1000;
      if (nota > melhorNota) {
        melhorNota = nota;
        melhor = casa;
      }
      if (!ehUsina && melhor !== null) break; // para os prédios sem terreno, a primeira casa serve
    }
  }
  return melhor;
}

/** Casa para uma subestação nova: a que cobre mais casas livres perto do centro da ilha principal. */
function casaParaSubestacao(state: GameState): number | null {
  return melhorCasa(state, "subestacao", false);
}

/* ------------------------------------------------------------------ */
/* Núcleo                                                              */
/* ------------------------------------------------------------------ */

/** Mira o equilíbrio na zona de ouro: 2 turbinas e espelhos até T* ficar entre 70 % e 90 %. */
function ajustarNucleo(state: GameState): GameState {
  const nucleo = state.nucleo;
  if (!nucleo || state.creditos < PECAS.heliostato.custo) return state;
  const c = contar(nucleo.grade);
  const efeitos = efeitosDe(state);
  const motor = motorDoNucleo(nucleo, efeitos, state.tempoMs);
  const tEq = equilibrioMotor(motor) / motor.capacidadeU;

  const vazias: number[] = [];
  nucleo.grade.forEach((casa, i) => {
    if (!casa && i !== indiceReceptor(nucleo.lado)) vazias.push(i);
  });
  const primeira = (p: PecaId) => vazias.find((i) => PECA_POR_ID[p].aneis.includes(Math.max(1, anel(i, nucleo.lado)) as 1 | 2 | 3));

  let alvo: PecaId | null = null;
  if (c.turbinas < 2) alvo = "turbina";
  else if (tEq < 0.75) alvo = "heliostato";
  else if (tEq > 0.95 && state.creditos > PECAS.tanque.custo * 4) alvo = "tanque";
  if (!alvo) return state;
  const casa = primeira(alvo);
  if (casa === undefined || state.creditos < PECA_POR_ID[alvo].custo) return state;
  return colocarPeca(state, casa, alvo) ?? state;
}

/* ------------------------------------------------------------------ */
/* Decisões do bot                                                     */
/* ------------------------------------------------------------------ */

export interface Compra {
  o: string;
  quantos: number;
}

/** Uma rodada de decisões. Devolve o estado novo e o que comprou. */
function decidir(state: GameState, compras: Map<string, number>): GameState {
  const registrar = (o: string) => compras.set(o, (compras.get(o) ?? 0) + 1);
  const aplicar = (proximo: GameState | null, o: string): GameState | null => {
    if (!proximo) return null;
    registrar(o);
    return proximo;
  };
  let s = state;
  const analise = analisar(s);
  const b = balancoDoEstado(s);
  const capitulo = capituloAtivo(s);

  // 0. Com a Estabilidade em 100 % e a Fissão básica na mão, o jogador para de gastar e **junta** os
  //    ₵ 200 000 do Vaso: é o sumidouro que a Era 1 não tinha (ajuste 8 da Sessão 7).
  if (s.nucleo && s.era === 1 && s.nucleo.estabilidade >= 100 && s.pesquisados.includes("fissaoBasica")) {
    return s;
  }

  // 1. Núcleo: a fonte de 🔬 e de Estabilidade. Prioridade máxima assim que cabe no bolso.
  if (!s.nucleo && podeDesbloquearNucleo(s) && s.creditos >= NUCLEO.custoDesbloqueio + 60) {
    s = aplicar(desbloquearNucleo(s), "Núcleo") ?? s;
  }
  if (s.nucleo) {
    const antes = s.nucleo.grade.filter(Boolean).length;
    s = ajustarNucleo(s);
    if (s.nucleo!.grade.filter(Boolean).length > antes) registrar("peça do Núcleo");
  }

  // 2. Escoamento: energia sem subestação é desperdício puro (GDD §7).
  if (analise.semEscoamentoKw > 1 || analise.bairrosSemEscoamento > 0) {
    const cheia = analise.subestacoes.find((x) => x.usadoKw >= x.tetoKw - 0.01);
    const custoNova = custoColocar(s, "subestacao");
    if (cheia && podeMelhorarSubestacao(s, cheia.indice) && s.creditos > custoNova * 2) {
      s = aplicar(melhorarSubestacao(s, cheia.indice), "nível de subestação") ?? s;
    } else {
      const casa = casaParaSubestacao(s);
      if (casa !== null && s.creditos >= custoNova) s = aplicar(colocar(s, casa, "subestacao"), "subestação") ?? s;
    }
  }

  // 3. Balança: abaixo da zona de ouro, mais usina; acima, mais cidade (demanda que paga).
  const r = b.demandaKw > 0 ? b.ofertaKw / b.demandaKw : Infinity;
  // Com caixa sobrando o bot cresce a cidade; mas oferta primeiro: crescer a demanda num apagão é
  // o erro que a primeira rodada da simulação cometeu (r caiu para 0,33 e ficou lá).
  const caixaSobrando = s.creditos > 20 * custoColocar(s, "bairro");
  if (r < 1.0) {
    const tipo: TipoConstrucao = analise.contagem.turbinaEolica > 0 || s.pesquisados.includes("turbinaEolica") ? "turbinaEolica" : "cataVento";
    const escolhido = s.creditos >= custoColocar(s, tipo) ? tipo : "cataVento";
    const casa = melhorCasa(s, escolhido);
    if (casa !== null && s.creditos >= custoColocar(s, escolhido)) s = aplicar(colocar(s, casa, escolhido), USINAS[escolhido as "cataVento"].nome) ?? s;
  } else if (r > 1.05 || caixaSobrando) {
    // primeiro evoluir (mais tarifa por kW), depois bairro novo
    const bairros = Object.keys(s.mundo.construcoes)
      .map(Number)
      .filter((i) => s.mundo.construcoes[i].tipo === "bairro")
      .sort((a, c) => s.mundo.construcoes[c].nivel - s.mundo.construcoes[a].nivel);
    const evoluivel = bairros.find((i) => podeEvoluirBairro(s, i));
    if (evoluivel !== undefined) {
      s = aplicar(evoluirBairro(s, evoluivel), `bairro → ${DENSIDADES[Math.min(3, s.mundo.construcoes[evoluivel].nivel + 1)].nome}`) ?? s;
    } else if (s.creditos >= custoColocar(s, "bairro") * 2) {
      const casa = melhorCasa(s, "bairro");
      if (casa !== null) s = aplicar(colocar(s, casa, "bairro"), "bairro") ?? s;
    }
  }

  // 4. Ciência da cidade: laboratórios cedo, universidades quando a população sustenta.
  const labs = analise.contagem.laboratorio;
  if (labs < 4 && s.creditos >= custoColocar(s, "laboratorio") * 3 && (s.nucleo || labs < 2)) {
    const casa = melhorCasa(s, "laboratorio");
    if (casa !== null) s = aplicar(colocar(s, casa, "laboratorio"), LABORATORIO.nome) ?? s;
  }
  if (
    s.pesquisados.includes("universidade") &&
    analise.universidadesAtivas < analise.limiteUniversidades &&
    s.creditos >= custoColocar(s, "universidade") * 2
  ) {
    const casa = melhorCasa(s, "universidade");
    if (casa !== null) s = aplicar(colocar(s, casa, "universidade"), UNIVERSIDADE.nome) ?? s;
  }

  // 5. Árvore: o nó mais barato disponível, com prioridade para os que destravam prédios.
  const prioritarios = ["bateria", "turbinaEolica", "universidade", "laminasDeFibra", "subestacaoAltaTensao"];
  // "Fissão básica" é a **porta da era**, não um nó qualquer: o bot compra o resto da árvore da Era 1
  // primeiro e só então a porta — mas nunca fica parado por causa dela (foi o que travou a 1ª rodada).
  const disponiveisAgora = NOS.filter((no) => no.era === 1 && podePesquisar(s, no.id));
  const outros = disponiveisAgora.filter((no) => no.id !== "fissaoBasica").sort((a, c) => a.pesquisa - c.pesquisa);
  const escolha = prioritarios.find((id) => podePesquisar(s, id)) ?? outros[0]?.id ?? proximoNo(s)?.id;
  if (escolha && podePesquisar(s, escolha)) {
    // guarda 🔬 para a próxima evolução de bairro se ela estiver perto
    const guardar = capitulo?.condicao.tipo === "densidade" ? DENSIDADES[0].evolucao!.pesquisa : 0;
    if (s.pesquisa - NO_POR_ID[escolha].pesquisa >= guardar || NO_POR_ID[escolha].pesquisa <= 40) {
      s = aplicar(pesquisar(s, escolha), `nó ${NO_POR_ID[escolha].nome}`) ?? s;
    }
  }

  // 6. Bateria: uma só, para a balança tolerar oscilação.
  if (s.pesquisados.includes("bateria") && analise.contagem.bateria < 2 && s.creditos >= custoColocar(s, "bateria") * 3) {
    const casa = melhorCasa(s, "bateria", false);
    if (casa !== null) s = aplicar(colocar(s, casa, "bateria"), "bateria") ?? s;
  }

  // 7. Espaço: desmatar quando não há casa boa para a próxima usina.
  if (melhorCasa(s, "cataVento") === null && s.mundo.remocoes.length < 3) {
    for (const id of s.mundo.ilhasAbertas) {
      const q = ILHAS.findIndex((i) => i.id === id);
      const alvo = casasDe(q).find((casa) => obstaculoEm(s.mundo, casa, arq) && avaliarRemocaoObstaculo(s, casa, arq).ok && temEscoamento(s, casa));
      if (alvo !== undefined) {
        s = aplicar(removerObstaculo(s, alvo, arq), "desmatar") ?? s;
        break;
      }
    }
  }

  // 8. Expedição e cabo: só com folga de caixa (a expedição não pode travar a Rede).
  for (const def of ILHAS) {
    if (def.expedicao === null) continue;
    if (!s.mundo.ilhasAbertas.includes(def.id)) {
      if (podeComprarIlha(s, def.id) && s.creditos >= (custoExpedicao(def.id) ?? 0) * 2.5) {
        s = aplicar(comprarIlha(s, def.id), `expedição ${def.nome}`) ?? s;
      }
      break; // uma ilha de cada vez, na ordem de preço
    }
    if (podeLigarCabo(s, def.id) && s.creditos >= custoCabo(def.id) * 2) {
      s = aplicar(ligarCabo(s, def.id), `cabo ${def.nome}`) ?? s;
    }
  }
  // cabo no teto: subir o nível em vez de deixar energia parada
  for (const cabo of analisar(s).cabos) {
    if (cabo.usadoKw < cabo.tetoKw - 0.01) continue;
    if (podeMelhorarCabo(s, cabo.ilha) && s.creditos > tetoCabo(cabo.nivel) * 40) {
      s = aplicar(melhorarCabo(s, cabo.ilha), `nível de cabo ${cabo.ilha}`) ?? s;
    }
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* Era 2: o reator e a Rede em MW                                      */
/* ------------------------------------------------------------------ */

/** Casas vazias da grade do Núcleo, do anel 1 para fora. */
function vaziasDoNucleo(state: GameState): number[] {
  const nucleo = state.nucleo!;
  const casas: number[] = [];
  nucleo.grade.forEach((casa, i) => {
    if (!casa && i !== indiceReceptor(nucleo.lado)) casas.push(i);
  });
  return casas.sort((a, b) => anel(a, nucleo.lado) - anel(b, nucleo.lado) || a - b);
}

/**
 * `T*` **nominal** da grade: o equilíbrio com todas as varetas cheias, e não com as gastas decaindo.
 *
 * É o número que importa para dimensionar o reator. A primeira rodada da simulação dimensionou pelo
 * calor do instante: com metade das varetas gastas o `T*` parecia baixo, o bot enfiava mais varetas —
 * e a troca escalonada devolvia todas ao nominal de uma vez, direto na Cascata. Foram 28 cascatas.
 */
function tEquilibrioNominal(state: GameState): number {
  const nucleo = state.nucleo!;
  const grade = nucleo.grade.map((casa) =>
    casa && casa.tipo === "peca" && casa.id === "vareta" ? { ...casa, vareta: varetaNova() } : casa,
  );
  const motor = motorDoNucleo({ ...nucleo, grade, scramRestanteMs: 0 }, efeitosDe(state), state.tempoMs);
  return motor.capacidadeU > 0 ? equilibrioMotor(motor) / motor.capacidadeU : Infinity;
}

/**
 * Opera o reator (GDD Parte 2 §5): limpa o que a Cascata derrubou, garante duas turbinas e uma torre,
 * põe varetas só enquanto o `T*` **nominal** continuar na zona de ouro, e faz a troca escalonada das
 * gastas. A regra que evita a Cascata é a mesma que o jogador usa: dimensionar pelo reator cheio.
 */
function operarReator(state: GameState, registrar: (o: string) => void): GameState {
  let s = state;
  const nucleo = s.nucleo!;
  const efeitos = efeitosDe(s);
  const cr = contarReator(nucleo.grade);
  const tEq = tEquilibrioNominal(s);
  const vazias = vaziasDoNucleo(s);
  const anel1 = vazias.filter((i) => anel(i, nucleo.lado) === 1);

  // 0. entulho da Cascata: limpar assim que sai de graça (é o que devolve o anel 1)
  for (let i = 0; i < nucleo.grade.length; i++) {
    const casa = nucleo.grade[i];
    if (casa?.tipo !== "entulho") continue;
    const limpo = limparEntulho(s, i);
    if (limpo) {
      registrar("limpar entulho");
      return limpo;
    }
  }

  // 0b. reator superdimensionado (a Cascata derrubou uma turbina, por exemplo): tira uma vareta
  if (tEq > 0.95 && cr.varetasAtivas > 1) {
    for (let i = nucleo.grade.length - 1; i >= 0; i--) {
      const casa = nucleo.grade[i];
      if (casa?.tipo !== "peca" || casa.id !== "vareta") continue;
      const proximo = removerPeca(s, i);
      if (proximo) {
        registrar("tirar vareta");
        return proximo;
      }
    }
  }

  // 1. troca escalonada: vareta gasta que já pode sair volta a render
  for (let i = 0; i < nucleo.grade.length; i++) {
    if (podeTrocarVareta(s, i) && s.creditos > VARETA.custoTroca * 4) {
      s = trocarVareta(s, i) ?? s;
      registrar("troca de vareta");
      return s;
    }
  }

  const por = (peca: PecaId, casas: number[]): GameState | null => {
    const casa = casas[0];
    if (casa === undefined || s.creditos < PECA_POR_ID[peca].custo * 1.5) return null;
    return colocarPeca(s, casa, peca);
  };

  // 2. estrutura: duas turbinas (sem elas o calor só sobe), uma torre, piscina e barra
  if (cr.turbinas < 2) {
    const proximo = por("turbinaAlta", anel1);
    if (proximo) {
      registrar("turbina de alta pressão");
      return proximo;
    }
    return s;
  }
  if (cr.torres < 1 && cr.varetasAtivas >= 3) {
    const proximo = por("torreResfriamento", anel1);
    if (proximo) {
      registrar("torre de resfriamento");
      return proximo;
    }
  }
  if (cr.piscinas < 1 && efeitos.pecasLiberadas.includes("piscina")) {
    const proximo = por("piscina", anel1);
    if (proximo) {
      registrar("piscina");
      return proximo;
    }
  }
  // barra de controle: escalona a vida das varetas de graça (GDD Parte 2 §5.3)
  if (cr.barras < 1 && efeitos.pecasLiberadas.includes("barraControle") && cr.varetasAtivas >= 4) {
    const casa = vazias.find((i) => anel(i, nucleo.lado) >= 2);
    if (casa !== undefined && s.creditos > PECA_POR_ID.barraControle.custo * 2) {
      const proximo = colocarPeca(s, casa, "barraControle");
      if (proximo) {
        registrar("barra de controle");
        return proximo;
      }
    }
  }

  // 3. varetas, uma de cada vez, e só enquanto o equilíbrio previsto ficar na faixa
  if (tEq < 0.8) {
    for (const casa of vazias) {
      const tentativa = colocarPeca(s, casa, "vareta");
      if (!tentativa) continue;
      const previsto = tEquilibrioNominal(tentativa);
      if (previsto > 0.88) continue; // essa casa esquentaria demais: tenta a próxima (anel de fora)
      registrar("vareta");
      return tentativa;
    }
  }
  return s;
}

/** Melhor casa de mar raso da ilha: as offshore ficam perto da subestação offshore. */
function melhorCasaDeAgua(state: GameState, tipo: TipoConstrucao): number | null {
  const n2 = arq.n;
  for (let i = 0; i < n2 * n2; i++) {
    if (!ehMarRaso(i, arq)) continue;
    if (!avaliarCasa(state, i, tipo, arq).ok) continue;
    if (tipo === "eolicaOffshore" && !temEscoamento(state, i)) continue;
    return i;
  }
  return null;
}

/** Uma rodada de decisões da Era 2. */
function decidirEra2(state: GameState, compras: Map<string, number>): GameState {
  const registrar = (o: string) => compras.set(o, (compras.get(o) ?? 0) + 1);
  const aplicar = (proximo: GameState | null, o: string): GameState | null => {
    if (!proximo) return null;
    registrar(o);
    return proximo;
  };
  let s = state;
  const analise = analisar(s);
  const b = balancoDoEstado(s);
  /**
   * Reta final: com a Estabilidade cheia a era está ganha, e o jogador para de gastar 🔬 em evolução
   * de bairro para juntar o que a saída pede (Reator 7×7 + Fusão básica). Sem isto o bot dissolvia
   * 🔬 144 mil em megacidades e nunca chegava à porta.
   */
  const retaFinal = (s.nucleo?.estabilidade ?? 0) >= 100;

  // 1. o reator: é a fonte de 🔬 e de Estabilidade
  s = operarReator(s, registrar);

  // 2. escoamento em MW: sem 138 kV nada de offshore nem de térmica
  if (analise.semEscoamentoKw > 10 || analise.bairrosSemEscoamento > 0 || analise.distritosSemEscoamento > 0) {
    const cheia = analise.subestacoes.find((x) => x.usadoKw >= x.tetoKw - 0.01);
    if (cheia && podeMelhorarSubestacao(s, cheia.indice) && s.creditos > custoNivelDe(cheia.tipo, cheia.nivel) * 2) {
      s = aplicar(melhorarSubestacao(s, cheia.indice), "nível de subestação") ?? s;
    } else if (s.pesquisados.includes("subestacaoDe138kV")) {
      const casa = melhorCasa(s, "subestacao138", false);
      if (casa !== null && s.creditos >= custoColocar(s, "subestacao138") * 1.5) {
        s = aplicar(colocar(s, casa, "subestacao138"), "subestação de 138 kV") ?? s;
      }
    } else {
      const casa = casaParaSubestacao(s);
      if (casa !== null && s.creditos >= custoColocar(s, "subestacao") * 2) s = aplicar(colocar(s, casa, "subestacao"), "subestação") ?? s;
    }
  }

  // 3. balança: abaixo da zona de ouro, mais MW; acima, mais cidade
  const r = b.demandaKw > 0 ? b.ofertaKw / b.demandaKw : Infinity;
  if (r < 1.0) {
    // offshore primeiro (kW por casa e sem esteira), depois fazenda solar, e a térmica como last resort
    if (s.pesquisados.includes("subestacaoOffshore")) {
      const temSubOffshore = analise.contagem.subestacaoOffshore > 0;
      if (!temSubOffshore && s.creditos >= custoColocar(s, "subestacaoOffshore") * 1.5) {
        const casa = melhorCasaDeAgua(s, "subestacaoOffshore");
        if (casa !== null) s = aplicar(colocar(s, casa, "subestacaoOffshore"), "subestação offshore") ?? s;
      } else {
        const casa = melhorCasaDeAgua(s, "eolicaOffshore");
        if (casa !== null && s.creditos >= custoColocar(s, "eolicaOffshore") * 1.5) {
          s = aplicar(colocar(s, casa, "eolicaOffshore"), "eólica offshore") ?? s;
        }
      }
    }
    const aindaFalta = balancoDoEstado(s);
    if (aindaFalta.ofertaKw < aindaFalta.demandaKw) {
      const casaSolar = melhorCasa(s, "fazendaSolar");
      if (casaSolar !== null && s.creditos >= custoColocar(s, "fazendaSolar") * 1.5) {
        s = aplicar(colocar(s, casaSolar, "fazendaSolar"), "fazenda solar") ?? s;
      } else {
        const casaTermica = melhorCasa(s, "termicaGas");
        // a térmica só compensa se a receita cobrir o combustível com folga
        if (casaTermica !== null && s.creditos >= custoColocar(s, "termicaGas") * 2) {
          s = aplicar(colocar(s, casaTermica, "termicaGas"), "térmica a gás") ?? s;
        }
      }
    }
  } else {
    const bairros = Object.keys(s.mundo.construcoes)
      .map(Number)
      .filter((i) => s.mundo.construcoes[i].tipo === "bairro")
      .sort((a, c) => s.mundo.construcoes[c].nivel - s.mundo.construcoes[a].nivel);
    const evoluivel = retaFinal ? undefined : bairros.find((i) => podeEvoluirBairro(s, i));
    if (evoluivel !== undefined) {
      s = aplicar(evoluirBairro(s, evoluivel), `bairro → densidade ${s.mundo.construcoes[evoluivel].nivel + 2}`) ?? s;
    } else if (s.pesquisados.includes("industriaPesada") && s.creditos > custoColocar(s, "distritoIndustrial") * 2) {
      const casa = melhorCasa(s, "distritoIndustrial");
      if (casa !== null) s = aplicar(colocar(s, casa, "distritoIndustrial"), "distrito industrial") ?? s;
    } else if (s.creditos >= custoColocar(s, "bairro") * 4) {
      const casa = melhorCasa(s, "bairro");
      if (casa !== null) s = aplicar(colocar(s, casa, "bairro"), "bairro") ?? s;
    }
  }

  // 4. ciência: instituto quando a árvore libera, e universidades enquanto houver alunos
  if (s.pesquisados.includes("institutoDePesquisa") && analise.contagem.institutoPesquisa < 4 && s.creditos > custoColocar(s, "institutoPesquisa") * 3) {
    const casa = melhorCasa(s, "institutoPesquisa");
    if (casa !== null) s = aplicar(colocar(s, casa, "institutoPesquisa"), "instituto") ?? s;
  }
  if (analise.universidadesAtivas < analise.limiteUniversidades && s.creditos >= custoColocar(s, "universidade") * 2) {
    const casa = melhorCasa(s, "universidade");
    if (casa !== null) s = aplicar(colocar(s, casa, "universidade"), UNIVERSIDADE.nome) ?? s;
  }

  // 5. árvore da Era 2: os nós que destravam prédios primeiro
  const prioritarios = [
    "subestacaoDe138kV",
    "barraDeControle",
    "subestacaoOffshore",
    "piscinaDeResfriamento",
    "megacidade",
    "enriquecimento",
    "caboHvdc",
    "industriaPesada",
    "institutoDePesquisa",
    // o caminho da saída: o 7×7 é a última peça que a Fusão básica exige
    "combustivelMox",
    "reator7x7",
  ];
  // Na reta final só se compra o caminho da saída; fora dela, os nós que destravam prédios primeiro.
  const caminhoDaSaida = ["enriquecimento", "combustivelMox", "reator7x7", "fusaoBasica"];
  const escolha = retaFinal
    ? caminhoDaSaida.find((id) => podePesquisar(s, id))
    : (prioritarios.find((id) => podePesquisar(s, id)) ?? NOS.filter((no) => no.id !== "fusaoBasica" && podePesquisar(s, no.id)).sort((a, c) => a.pesquisa - c.pesquisa)[0]?.id);
  if (escolha && podePesquisar(s, escolha)) {
    s = aplicar(pesquisar(s, escolha), `nó ${NO_POR_ID[escolha].nome}`) ?? s;
  }

  // 6. bateria de rede: amortece a balança na escala da era
  if (s.pesquisados.includes("bateriaDeRede") && analise.contagem.bateriaRede < 2 && s.creditos > custoColocar(s, "bateriaRede") * 3) {
    const casa = melhorCasa(s, "bateriaRede", false);
    if (casa !== null) s = aplicar(colocar(s, casa, "bateriaRede"), "bateria de rede") ?? s;
  }

  // 7. espaço e ilhas, como na Era 1
  if (melhorCasa(s, "fazendaSolar") === null && s.mundo.remocoes.length < 3) {
    for (const id of s.mundo.ilhasAbertas) {
      const q = ILHAS.findIndex((i) => i.id === id);
      const alvo = casasDe(q).find((casa) => obstaculoEm(s.mundo, casa, arq) && avaliarRemocaoObstaculo(s, casa, arq).ok);
      if (alvo !== undefined) {
        s = aplicar(removerObstaculo(s, alvo, arq), "desmatar") ?? s;
        break;
      }
    }
  }
  for (const def of ILHAS) {
    if (def.expedicao === null) continue;
    if (!s.mundo.ilhasAbertas.includes(def.id)) {
      if (podeComprarIlha(s, def.id) && s.creditos >= (custoExpedicao(def.id) ?? 0) * 2) s = aplicar(comprarIlha(s, def.id), `expedição ${def.nome}`) ?? s;
      break;
    }
    if (podeLigarCabo(s, def.id) && s.creditos >= custoCabo(def.id) * 2) s = aplicar(ligarCabo(s, def.id), `cabo ${def.nome}`) ?? s;
  }
  for (const cabo of analisar(s).cabos) {
    if (cabo.usadoKw < cabo.tetoKw - 0.01) continue;
    if (podeMelhorarCabo(s, cabo.ilha) && s.creditos > tetoCabo(cabo.nivel, efeitosDe(s)) * 30) {
      s = aplicar(melhorarCabo(s, cabo.ilha), `nível de cabo ${cabo.ilha}`) ?? s;
    }
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* Relatório                                                           */
/* ------------------------------------------------------------------ */

const num = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const kw = (v: number) => `${num(v, 1)} kW`;

function linha(state: GameState, minuto: number, compras: Map<string, number>): string {
  const a = analisar(state);
  const b = balancoDoEstado(state);
  const lista = [...compras.entries()].map(([o, q]) => (q > 1 ? `${o} ×${q}` : o)).join(", ");
  return [
    `${String(minuto).padStart(3)} min`,
    `₵ ${num(state.creditos).padStart(9)}`,
    `🔬 ${num(state.pesquisa, 0).padStart(6)}`,
    `👥 ${num(a.populacao).padStart(6)}`,
    `🛡 ${num(state.nucleo?.estabilidade ?? 0, 0).padStart(3)} %`,
    `${kw(a.brutoKw).padStart(11)}`,
    `r ${b.demandaKw > 0 ? num(b.ofertaKw / b.demandaKw, 2) : "—"} ${b.faixa.nome.toLowerCase().padEnd(12)}`,
    lista ? `· ${lista}` : "",
  ].join("  ");
}

export interface Marcos {
  [nome: string]: number | null;
}

/** Uma linha do relatório da Era 2: o que importa numa era em que produzir custa. */
function linhaEra2(state: GameState, minuto: number, compras: Map<string, number>): string {
  const a = analisar(state);
  const b = balancoDoEstado(state);
  const lista = [...compras.entries()].map(([o, q]) => (q > 1 ? `${o} ×${q}` : o)).join(", ");
  return [
    `${String(minuto).padStart(3)} min`,
    `₵ ${num(state.creditos).padStart(11)}`,
    `líq ${num(b.receitaLiquidaPorSegundo, 0).padStart(6)}/s`,
    `🔬 ${num(state.pesquisa, 0).padStart(7)}`,
    `👥 ${num(a.populacao).padStart(7)}`,
    `🛡 ${num(state.nucleo?.estabilidade ?? 0, 0).padStart(3)} %`,
    `${kw(a.brutoKw).padStart(13)} inst`,
    `${kw(a.ofertaKw).padStart(13)} esc`,
    lista ? `· ${lista}` : "",
  ].join("  ");
}

export async function main(args: string[] = []): Promise<void> {
  const minutos = Number(args[0]) || 60;
  // 75 min de Era 2: a era fecha dentro da janela de 50–70 min, e o resto é folga para a medição
  // enxergar o fechamento (a saída custa 🔬 40 000 e chega pouco depois da Estabilidade cheia).
  const minutosEra2 = Number(args[1]) || 75;
  const ticksPorMinuto = (60 * 1000) / TICK_MS;
  let s = estadoInicial();
  const marcos: Marcos = {
    "primeira zona de ouro": null,
    "Núcleo comprável (₵ 100)": null,
    "Núcleo desbloqueado": null,
    "5 cata-ventos": null,
    "primeiro 🔬 gasto": null,
    "primeira evolução de bairro": null,
    "expedição de Ventania comprável": null,
    "Ventania aberta": null,
    "🔬 3 000 acumulados (saída da Era 1)": null,
    "₵ 50 000 (saída da Era 1)": null,
    "Estabilidade 100 % (saída da Era 1)": null,
    "nó Fissão básica comprado (saída da Era 1)": null,
  };
  let pesquisaGanha = 0;
  let pesquisaAnterior = s.pesquisa;
  let minutoDaTransicao = minutos;

  console.log(`\nKARDASHEV — simulação de ${minutos} min de Era 1 + ${minutosEra2} min de Era 2 (tick de ${TICK_MS} ms)\n`);
  console.log("ERA 1 — os dez primeiros minutos, minuto a minuto:\n");

  const compras = new Map<string, number>();
  for (let minuto = 1; minuto <= minutos; minuto++) {
    for (let t = 0; t < ticksPorMinuto; t++) {
      s = tick(s);
      // o bot decide a cada 2 s de jogo: é o ritmo de um jogador ativo, não de um script
      if (t % 20 === 0) s = decidir(s, compras);

      const ganho = s.pesquisa - pesquisaAnterior;
      if (ganho > 0) pesquisaGanha += ganho;
      pesquisaAnterior = s.pesquisa;

      const a = analisar(s);
      const b = balancoDoEstado(s);
      const marcar = (nome: string, cond: boolean) => {
        if (cond && marcos[nome] === null) marcos[nome] = minuto - 1 + t / ticksPorMinuto;
      };
      marcar("primeira zona de ouro", b.faixa.id === "zonaDeOuro");
      marcar("Núcleo comprável (₵ 100)", s.creditos >= NUCLEO.custoDesbloqueio);
      marcar("Núcleo desbloqueado", s.nucleo !== null);
      marcar("5 cata-ventos", a.contagem.cataVento >= 5);
      marcar("primeiro 🔬 gasto", s.pesquisados.length > 1);
      marcar("primeira evolução de bairro", Object.values(s.mundo.construcoes).some((c) => c.tipo === "bairro" && c.nivel > 0));
      marcar("expedição de Ventania comprável", s.creditos >= (custoExpedicao("ventania") ?? 0));
      marcar("Ventania aberta", s.mundo.ilhasAbertas.includes("ventania"));
      marcar("🔬 3 000 acumulados (saída da Era 1)", pesquisaGanha >= 3000);
      marcar("₵ 50 000 (saída da Era 1)", s.creditos >= 50000);
      marcar("Estabilidade 100 % (saída da Era 1)", (s.nucleo?.estabilidade ?? 0) >= 100);
      marcar("nó Fissão básica comprado (saída da Era 1)", s.pesquisados.includes("fissaoBasica"));
    }
    if (minuto <= 10 || minuto % 5 === 0 || podeConstruirReator(s)) {
      console.log(linha(s, minuto, compras));
      compras.clear();
    }
    if (minuto === 10) console.log("\nDe cinco em cinco minutos:\n");
    // A Era 1 acaba quando dá para construir o Reator: o resto do tempo é da Era 2.
    if (podeConstruirReator(s)) {
      minutoDaTransicao = minuto;
      break;
    }
  }

  console.log("\nMarcos da Era 1:");
  for (const [nome, valor] of Object.entries(marcos)) {
    console.log(`  ${nome.padEnd(42)} ${valor === null ? "não aconteceu" : `${num(valor, 1)} min`}`);
  }
  const fim = ["nó Fissão básica comprado (saída da Era 1)", "Estabilidade 100 % (saída da Era 1)"].map((k) => marcos[k]);
  const fechou = fim.every((v) => v !== null) ? Math.max(...(fim as number[])) : null;
  console.log(`\nEra 1 fecharia em: ${fechou === null ? "não fechou dentro da simulação" : `${num(fechou, 1)} min`} (alvo: 50–70 min)`);
  imprimirEstado(s, pesquisaGanha, "Estado no fim da Era 1");

  /* ---------------------------------------------------------------- Era 2 */
  if (!podeConstruirReator(s)) {
    console.log("\nO bot não chegou à Era 2: faltou Estabilidade 100 %, o nó Fissão básica ou os ₵ 200 000 do Vaso.\n");
    return;
  }
  const creditosAntes = s.creditos;
  s = construirReator(s)!;
  console.log("\n" + "=".repeat(120));
  console.log(
    `ERA 2 — o Reator construído aos ${num(minutoDaTransicao, 0)} min por ₵ ${num(REATOR.custoVaso)} ` +
      `(sobraram ₵ ${num(s.creditos)} dos ₵ ${num(creditosAntes)}). Os dez primeiros minutos, minuto a minuto:\n`,
  );

  const marcos2: Marcos = {
    "primeira vareta": null,
    "reator em 800 kW": null,
    "primeira troca de vareta": null,
    "subestação de 138 kV": null,
    "primeira eólica offshore": null,
    "primeira térmica a gás": null,
    "10 MW instalados": null,
    "megacidade": null,
    "distrito industrial": null,
    "nó Reator 7×7 comprado": null,
    "Estabilidade 100 % (saída da Era 2)": null,
    "nó Fusão básica comprado (saída da Era 2)": null,
  };
  let minutosNegativos = 0;
  let sequenciaNegativa = 0;
  let piorSequencia = 0;
  compras.clear();
  for (let minuto = 1; minuto <= minutosEra2; minuto++) {
    let negativoNoMinuto = 0;
    for (let t = 0; t < ticksPorMinuto; t++) {
      s = tick(s);
      if (t % 20 === 0) s = decidirEra2(s, compras);
      const ganho = s.pesquisa - pesquisaAnterior;
      if (ganho > 0) pesquisaGanha += ganho;
      pesquisaAnterior = s.pesquisa;

      const a = analisar(s);
      const b = balancoDoEstado(s);
      if (b.receitaLiquidaPorSegundo < 0) negativoNoMinuto++;
      const marcar = (nome: string, cond: boolean) => {
        if (cond && marcos2[nome] === null) marcos2[nome] = minuto - 1 + t / ticksPorMinuto;
      };
      const cr = s.nucleo ? contarReator(s.nucleo.grade) : null;
      marcar("primeira vareta", (cr?.varetasAtivas ?? 0) + (cr?.varetasGastas ?? 0) > 0);
      marcar("reator em 800 kW", potenciaNucleoEfetiva(s) >= 800);
      marcar("primeira troca de vareta", (s.nucleo?.trocasEmFaixa ?? 0) > 0 || (compras.get("troca de vareta") ?? 0) > 0);
      marcar("subestação de 138 kV", a.contagem.subestacao138 > 0);
      marcar("primeira eólica offshore", a.contagem.eolicaOffshore > 0);
      marcar("primeira térmica a gás", a.contagem.termicaGas > 0);
      marcar("10 MW instalados", a.brutoKw >= 10_000);
      marcar("megacidade", Object.values(s.mundo.construcoes).some((c) => c.tipo === "bairro" && c.nivel >= 4));
      marcar("distrito industrial", a.contagem.distritoIndustrial > 0);
      marcar("nó Reator 7×7 comprado", s.pesquisados.includes("reator7x7"));
      marcar("Estabilidade 100 % (saída da Era 2)", (s.nucleo?.estabilidade ?? 0) >= 100);
      marcar("nó Fusão básica comprado (saída da Era 2)", s.pesquisados.includes("fusaoBasica"));
    }
    // "receita líquida negativa por mais de 1 minuto" = minutos inteiros seguidos no vermelho
    if (negativoNoMinuto > ticksPorMinuto * 0.9) {
      minutosNegativos++;
      sequenciaNegativa++;
      piorSequencia = Math.max(piorSequencia, sequenciaNegativa);
    } else sequenciaNegativa = 0;

    if (minuto <= 10 || minuto % 5 === 0) {
      console.log(linhaEra2(s, minuto, compras));
      compras.clear();
    }
    if (minuto === 10) console.log("\nDe cinco em cinco minutos:\n");
  }

  console.log("\nMarcos da Era 2:");
  for (const [nome, valor] of Object.entries(marcos2)) {
    console.log(`  ${nome.padEnd(42)} ${valor === null ? "não aconteceu" : `${num(valor, 1)} min`}`);
  }
  const fim2 = ["nó Fusão básica comprado (saída da Era 2)", "Estabilidade 100 % (saída da Era 2)"].map((k) => marcos2[k]);
  const fechou2 = fim2.every((v) => v !== null) ? Math.max(...(fim2 as number[])) : null;
  console.log(`\nEra 2 fecharia em: ${fechou2 === null ? "não fechou dentro da simulação" : `${num(fechou2, 1)} min`} (alvo: 50–70 min)`);
  console.log(`Receita líquida negativa: ${minutosNegativos} minuto(s), pior sequência ${piorSequencia} (alvo: nunca mais de 1)`);
  imprimirEstado(s, pesquisaGanha, "Estado no fim da Era 2");
}

/** Potência efetiva do Núcleo no estado (o decaimento da Era 2 depende do relógio). */
function potenciaNucleoEfetiva(state: GameState): number {
  if (!state.nucleo) return 0;
  const motor = motorDoNucleo(state.nucleo, efeitosDe(state), state.tempoMs);
  return state.nucleo.scramRestanteMs > 0 ? 0 : Math.max(0, motor.fatorTurbina * state.nucleo.calorU * motor.kwPorU);
}

function imprimirEstado(s: GameState, pesquisaGanha: number, titulo: string): void {
  const a = analisar(s);
  const b = balancoDoEstado(s);
  console.log(`\n${titulo}:`);
  console.log(`  ₵ ${num(s.creditos)} · 🔬 saldo ${num(s.pesquisa)} · 🔬 ganhos ${num(pesquisaGanha)} · 👥 ${num(a.populacao)}`);
  console.log(`  ${kw(a.brutoKw)} instalados · ${kw(a.ofertaKw)} escoados · ${kw(a.semEscoamentoKw)} sem escoamento · demanda ${kw(a.demandaKw)}`);
  console.log(`  receita ${num(b.receitaPorSegundo, 1)}/s · combustível ${num(b.custoPorSegundo, 1)}/s · líquida ${num(b.receitaLiquidaPorSegundo, 1)}/s`);
  console.log(`  tarifa ×${num(a.tarifa, 2)} · Estabilidade ${num(s.nucleo?.estabilidade ?? 0, 0)} %`);
  const porTipo = Object.entries(a.contagem)
    .filter(([, q]) => q > 0)
    .map(([t, q]) => `${t} ${q}`)
    .join(" · ");
  console.log(`  construções: ${porTipo}`);
  console.log(`  nós pesquisados (${s.pesquisados.length}/${NOS.length}): ${s.pesquisados.join(", ")}`);
  console.log(`  capítulos concluídos: ${s.capitulos.length}/${CAPITULOS.length}`);
  if (s.nucleo) {
    const efeitos = efeitosDe(s);
    const c = contar(s.nucleo.grade);
    const motor = motorDoNucleo(s.nucleo, efeitos, s.tempoMs);
    const cr = contarReator(s.nucleo.grade);
    const descricao =
      s.nucleo.era === 2
        ? `varetas ${cr.varetasAtivas} ativas / ${cr.varetasGastas} gastas · turbinas ${cr.turbinas} · torres ${cr.torres} · piscinas ${cr.piscinas} · barras ${cr.barras}`
        : `h = ${num(espelhosEfetivos(s.nucleo.grade), 2)} · t = ${c.turbinas} · rad = ${c.radiadoresAdjacentes}`;
    console.log(`  Núcleo (Era ${s.nucleo.era}): ${descricao} · T* = ${num((equilibrioMotor(motor) / motor.capacidadeU) * 100, 0)} % · cascatas ${s.nucleo.cascatas}`);
  }
  const capitulo = capituloAtivo(s);
  console.log(`  capítulo ativo: ${capitulo ? capitulo.titulo : "todos concluídos"}`);
  console.log(`  subestações: ${a.subestacoes.length} · alcance ${efeitosDe(s).alcanceSubestacao} · cabos ${a.cabos.map((c) => `${c.ilha} n${c.nivel}`).join(", ") || "—"}`);
  console.log(`  ilhas abertas: ${s.mundo.ilhasAbertas.join(", ")}\n`);
}
