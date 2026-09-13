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
import { NOS, NO_POR_ID } from "../src/content/arvore-era1";
import { CAPITULOS } from "../src/content/capitulos-era1";
import { DENSIDADES, LABORATORIO, UNIVERSIDADE } from "../src/content/cidade-era1";
import { ILHAS, OBSTACULOS } from "../src/content/era1-arquipelago";
import { NUCLEO, PECAS } from "../src/content/era1-nucleo";
import { USINAS } from "../src/content/era1";
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
  melhorarSubestacao,
  obstaculoEm,
  podeComprarIlha,
  podeLigarCabo,
  podeMelhorarCabo,
  podeMelhorarSubestacao,
  removerObstaculo,
  tetoCabo,
} from "../src/sim/mundo";
import { anel, capacidadeU, contar, equilibrioU, espelhosEfetivos } from "../src/sim/nucleo";
import { analisar, terrenoDeJogo } from "../src/sim/producao";
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
  const capacidade = capacidadeU(nucleo.grade, nucleo.receptorCeramico, efeitos);
  const tEq = equilibrioU(nucleo.grade, efeitos) / capacidade;

  const vazias: number[] = [];
  nucleo.grade.forEach((casa, i) => {
    if (!casa && i !== indiceReceptor(nucleo.lado)) vazias.push(i);
  });
  const primeira = (p: PecaId) => vazias.find((i) => PECAS[p].aneis.includes(Math.max(1, anel(i, nucleo.lado)) as 1 | 2 | 3));

  let alvo: PecaId | null = null;
  if (c.turbinas < 2) alvo = "turbina";
  else if (tEq < 0.75) alvo = "heliostato";
  else if (tEq > 0.95 && state.creditos > PECAS.tanque.custo * 4) alvo = "tanque";
  if (!alvo) return state;
  const casa = primeira(alvo);
  if (casa === undefined || state.creditos < PECAS[alvo].custo) return state;
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
  const escolha = prioritarios.find((id) => podePesquisar(s, id)) ?? proximoNo(s)?.id;
  // "Fissão básica" é a saída da era, não um nó qualquer: só depois do resto da árvore
  if (escolha === "fissaoBasica" && NOS.some((no) => no.id !== "fissaoBasica" && podePesquisar(s, no.id))) {
    // deixa para o próximo passo: há nó mais útil disponível
  } else
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

export async function main(args: string[] = []): Promise<void> {
  const minutos = Number(args[0]) || 60;
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

  console.log(`\nKARDASHEV — simulação de ${minutos} min de jogo ativo (tick de ${TICK_MS} ms)\n`);
  console.log("Os dez primeiros minutos, minuto a minuto:\n");

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
    if (minuto <= 10 || minuto % 5 === 0) {
      console.log(linha(s, minuto, compras));
      compras.clear();
    }
    if (minuto === 10) console.log("\nDe cinco em cinco minutos:\n");
  }

  const a = analisar(s);
  console.log("\nMarcos:");
  for (const [nome, valor] of Object.entries(marcos)) {
    console.log(`  ${nome.padEnd(42)} ${valor === null ? "não aconteceu" : `${num(valor, 1)} min`}`);
  }
  const fim = ["nó Fissão básica comprado (saída da Era 1)", "Estabilidade 100 % (saída da Era 1)"].map((k) => marcos[k]);
  const fechou = fim.every((v) => v !== null) ? Math.max(...(fim as number[])) : null;
  console.log(`\nEra 1 fecharia em: ${fechou === null ? "não fechou dentro da simulação" : `${num(fechou, 1)} min`} (alvo: 50–70 min)`);

  console.log("\nEstado final:");
  console.log(`  ₵ ${num(s.creditos)} · 🔬 saldo ${num(s.pesquisa)} · 🔬 ganhos ${num(pesquisaGanha)} · 👥 ${num(a.populacao)}`);
  console.log(`  ${kw(a.brutoKw)} instalados · ${kw(a.ofertaKw)} escoados · ${kw(a.semEscoamentoKw)} sem escoamento · demanda ${kw(a.demandaKw)}`);
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
    const cap = capacidadeU(s.nucleo.grade, s.nucleo.receptorCeramico, efeitos);
    console.log(`  Núcleo: h = ${num(espelhosEfetivos(s.nucleo.grade), 2)} · t = ${c.turbinas} · rad = ${c.radiadoresAdjacentes} · T* = ${num((equilibrioU(s.nucleo.grade, efeitos) / cap) * 100, 0)} % · cascatas ${s.nucleo.cascatas}`);
  }
  const capitulo = capituloAtivo(s);
  console.log(`  capítulo ativo no fim: ${capitulo ? capitulo.titulo : "todos concluídos"}`);
  console.log(`  subestações: ${a.subestacoes.length} · alcance ${efeitosDe(s).alcanceSubestacao} · cabos ${a.cabos.map((c) => `${c.ilha} n${c.nivel}`).join(", ") || "—"}`);
  console.log(`  ilhas abertas: ${s.mundo.ilhasAbertas.join(", ")}\n`);
}
