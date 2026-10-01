/**
 * Simulação de 60 minutos de jogo ativo (GDD §7, parte F da Sessão 7).
 *
 * Um bot simples joga a Era 1 seguindo os capítulos, com o **tick do sim** (100 ms de timestep fixo):
 * nada aqui reimplementa regra de jogo — todas as decisões passam pelas mesmas funções puras que a
 * interface usa (`colocar`, `pesquisar`, `evoluirCidade`, `melhorar`, `comprarIlha`, `ligarCabo`, `tick`).
 *
 *   npm run simular                            Era 1 (até 60 min) e Era 2 (75 min) nas duas rotas
 *   npm run simular -- 90                      90 minutos de Era 1
 *   npm run simular -- 60 75 cidade            só a rota "cidade" ("corrida", "cidade", "operador" ou "todas")
 *   npm run simular -- --sem-nivel-ciencia     o mesmo bot sem comprar nível de ciência (para medir o efeito)
 *
 * Rotas (ajuste 3 da Sessão 8; parte G da Sessão 9): **corrida** é o jogador que vai direto à saída;
 * **cidade** evolui a cidade até a arcologia, compra distrito industrial, instituto e a escolha exclusiva do
 * reator, e só depois corre para a saída. Cada rota joga as **duas eras** (na Era 1 a cidade evolui mais cedo
 * e guarda 🔬 para a evolução), e a Era 2 parte do fim da Era 1 da mesma rota.
 *
 * Desde a Sessão 9 o bot compra níveis por tipo (turbina, ciência, usinas, Equipe) sem tocar na reserva da
 * saída, e o relatório mede as **janelas paradas** minuto a minuto (potência e população paradas, ₵ subindo),
 * com o que trava cada uma.
 *
 * Desde a Sessão 10 há uma terceira rota, **operador** (parte F): joga a economia da "corrida", aceita toda
 * Ocorrência (Parte 1 §4.4), acompanha o perfil a cada tick — põe o controle no valor que a fórmula de `Q*` pede
 * para a perturbação daquele instante (`controleQueCompensa`), não no valor do platô desde o aceite — e escolhe
 * 🛡 quando a barra é o que mais demora e 🔬 quando é a 🔬 dos nós da saída. "corrida" e "cidade" recusam toda
 * oferta. Um minuto com Ocorrência em curso não conta como parado: o jogador estava operando.
 *
 * O objetivo é medir ritmo, não vencer: metas de era de Parte 1 §7 — 50–70 min recusando as Ocorrências,
 * 40–50 min operando, sem janela parada de mais de 5 min na rota operador.
 */
import { NOS, NO_POR_ID } from "../src/content/arvore";
import { CAPITULOS } from "../src/content/capitulos";
import { LABORATORIO, UNIVERSIDADE } from "../src/content/cidade-era1";
import { ILHAS, OBSTACULOS } from "../src/content/era1-arquipelago";
import { NUCLEO, PECAS } from "../src/content/era1-nucleo";
import { PECA_POR_ID } from "../src/content/pecas";
import { USINAS } from "../src/content/usinas";
import { disponivel, pesquisado, pesquisar, podePesquisar, proximoNo } from "../src/sim/arvore";
import { desbloquearNucleo, colocarPeca, podeDesbloquearNucleo } from "../src/sim/acoesNucleo";
import { indiceCasa, naPlataforma } from "../src/sim/arquipelago";
import { capituloAtivo } from "../src/sim/capitulos";
import { custoEvolucaoCidade, defDaDensidade, evoluirCidade, podeEvoluirCidade } from "../src/sim/cidade";
import { efeitosDe } from "../src/sim/efeitos";
import { arquipelagoDaEra1 } from "../src/sim/gerarArquipelago";
import {
  avaliarCasa,
  avaliarRemocaoObstaculo,
  bipesDe,
  colocar,
  comprarIlha,
  custoCabo,
  custoColocar,
  custoExpedicao,
  ligarCabo,
  obstaculoEm,
  podeComprarIlha,
  podeLigarCabo,
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
import { custoProximoNivel, melhorar, podeMelhorar } from "../src/sim/melhorias";
import { fatorUsina } from "../src/sim/niveis";
import { NIVEL_USINA, TIPOS_CIENCIA, USINAS_COM_NIVEL } from "../src/content/melhorias";
import { estadoInicial, indiceReceptor, type AlvoMelhoria, type GameState, type PecaId, type TipoConstrucao } from "../src/sim/state";
import { balancoDoEstado, tick, TICK_MS } from "../src/sim/tick";
import { FAIXAS_CALOR } from "../src/content/era1-nucleo";
import { aceitarOcorrencia, ajustarControle, controleQueCompensa, escolherRecompensa, recusarOcorrencia, type TipoRecompensa } from "../src/sim/ocorrencias";
import { numerosDoHud } from "../src/ui/hud";

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

/**
 * Consumidor (bairro, ciência, distrito) precisa de subestação **no alcance**, não de folga de escoamento:
 * a Sessão 8 exigia folga até para bairro, e com as subestações cheias a cidade parava de crescer.
 */
const CONSUMIDORES: readonly TipoConstrucao[] = ["bairro", "laboratorio", "universidade", "institutoPesquisa", "distritoIndustrial"];
function temAtendimento(state: GameState, casa: number, tipo: TipoConstrucao): boolean {
  const exigida = tipo === "distritoIndustrial" ? "subestacao138" : undefined;
  return analisar(state).subestacoes.some(
    (s) => (exigida === undefined || s.tipo === exigida) && arq.ilha[s.indice] === arq.ilha[casa] && cheb(s.indice, casa) <= s.alcance,
  );
}

/** Melhor casa livre para o tipo, entre as ilhas abertas; `null` se não houver nenhuma aceitável. */
function melhorCasa(state: GameState, tipo: TipoConstrucao, exigirEscoamento = true): number | null {
  let melhor: number | null = null;
  let melhorNota = -Infinity;
  const ehUsina = tipo === "cataVento" || tipo === "painelSolar" || tipo === "turbinaEolica";
  const consumidor = CONSUMIDORES.includes(tipo);
  for (const id of state.mundo.ilhasAbertas) {
    const q = ILHAS.findIndex((i) => i.id === id);
    for (const casa of casasDe(q)) {
      if (!avaliarCasa(state, casa, tipo, arq).ok) continue;
      if (exigirEscoamento && consumidor && !temAtendimento(state, casa, tipo)) continue;
      if (exigirEscoamento && !consumidor && tipo !== "subestacao" && tipo !== "bateria" && !temEscoamento(state, casa)) continue;
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

/**
 * Evoluir a cidade sobe a demanda de **todos** os bairros de uma vez (v0.8): ×2,5 da aldeia para a vila.
 * O bot só evolui quando a oferta que já tem cobre a demanda nova com `r ≥ 0,9` — é o que um jogador
 * faz depois do primeiro apagão. A demanda dos bairros é a parte que muda; o resto fica.
 */
function evolucaoCabeNaOferta(s: GameState, limiar = 0.9): boolean {
  if (!podeEvoluirCidade(s)) return false;
  const b = balancoDoEstado(s);
  const a = analisar(s);
  const atual = defDaDensidade(s.cidade.densidade);
  const proxima = defDaDensidade(s.cidade.densidade + 1);
  const bairrosAtendidos = a.contagem.bairro - a.bairrosSemEscoamento;
  const demandaNova = b.demandaKw + bairrosAtendidos * (proxima.demandaKw - atual.demandaKw) * efeitosDe(s).demandaBairroFator;
  return demandaNova > 0 && b.ofertaKw / demandaNova >= limiar;
}

/** A próxima densidade da cidade já está liberada (as 5 e 6 pedem nó da Era 2)? Sem isso não há o que guardar. */
function evolucaoLiberada(s: GameState): boolean {
  if (!custoEvolucaoCidade(s)) return false;
  const proxima = defDaDensidade(s.cidade.densidade + 1);
  return !proxima.no || s.pesquisados.includes(proxima.no);
}

export interface Compra {
  o: string;
  quantos: number;
}

/** Opções vindas de `--x` nos argumentos (os posicionais continuam como antes). */
const OPCOES = { semNivelCiencia: false };

/**
 * Níveis por tipo (v0.8/v0.9, parte G da Sessão 9): o destino do ₵ que sobra. Nunca mexe na `reserva` (o que a
 * saída da era pede) e nunca gasta mais que uma fração do que sobra, em ordem fixa (determinismo):
 * 1. turbina do Núcleo: +10 % de kW e de 🔬 sem mexer no `T*`;
 * 2. ciência: +25 % de 🔬, que é o que trava (desligável com `--sem-nivel-ciencia`, para medir o efeito);
 * 3. usina, só faltando energia e só se o nível der mais kW por ₵ que uma unidade nova;
 * 4. Equipe de manutenção, com todos os Bipes ocupados.
 */
function comprarNiveis(state: GameState, aplicar: (p: GameState | null, o: string) => GameState | null, reserva: number): GameState {
  let s = state;
  const tentar = (alvo: AlvoMelhoria, fracao: number, nome: string): boolean => {
    if (!podeMelhorar(s, alvo)) return false;
    if (custoProximoNivel(s, alvo) > (s.creditos - reserva) * fracao) return false;
    const proximo = aplicar(melhorar(s, alvo), nome);
    if (!proximo) return false;
    s = proximo;
    return true;
  };
  if (s.nucleo) tentar({ tipo: "peca", id: s.era === 2 ? "turbinaAlta" : "turbina" }, 0.25, "nível da turbina");
  if (!OPCOES.semNivelCiencia) {
    for (const id of TIPOS_CIENCIA) tentar({ tipo: "ciencia", id }, 0.3, `nível de ${id === "institutoPesquisa" ? "instituto" : id}`);
  }
  const b = balancoDoEstado(s);
  if (b.demandaKw > 0 && b.ofertaKw < b.demandaKw) {
    const a = analisar(s);
    const efeitos = efeitosDe(s);
    for (const id of USINAS_COM_NIVEL) {
      const alvo = { tipo: "usina", id } as const;
      if (!podeMelhorar(s, alvo)) continue;
      const nivel = s.melhorias.usinas[id];
      const escoado = a.usinas.filter((u) => u.tipo === id).reduce((soma, u) => soma + u.escoadoKw, 0);
      const ganhoPorCredito = (escoado * NIVEL_USINA.bonusPorNivel) / fatorUsina(nivel) / custoProximoNivel(s, alvo);
      const unidadePorCredito = (USINAS[id].potenciaKw * fatorUsina(nivel) * efeitos.potencia[id]) / custoColocar(s, id);
      if (ganhoPorCredito > unidadePorCredito) tentar(alvo, 0.5, `nível de ${USINAS[id].nome}`);
    }
  }
  // todos os Bipes ocupados: mais um encurta a fila (o bot enfileira até N + 1)
  if (s.mundo.remocoes.length >= bipesDe(s)) tentar({ tipo: "equipe" }, 0.1, "Equipe de manutenção");
  return s;
}

/* ------------------------------------------------------------------ */
/* Janelas paradas (v0.9: "potência e população paradas, o ₵ só acumula") */
/* ------------------------------------------------------------------ */

interface RegistroMinuto {
  minuto: number;
  creditos: number;
  kw: number;
  populacao: number;
  trava: string;
  /** Houve Ocorrência em curso neste minuto (rota operador): o jogador estava operando, não esperando. */
  ocorrencia?: boolean;
}

/** O que trava o jogador neste instante: 🛡 (a barra), 🔬 (o próximo nó ou evolução), ₵ (o Vaso ou a Fusão). */
function travaDe(s: GameState): string {
  const saidas = s.era === 1 ? ["fissaoBasica"] : ["reator7x7", "fusaoBasica"];
  const faltaNo = saidas.find((id) => !s.pesquisados.includes(id));
  const estab = s.nucleo?.estabilidade ?? 0;
  if (!faltaNo && estab < 100) return "🛡";
  if (!faltaNo && s.era === 1) return "₵ (Vaso)";
  const cidade = evolucaoLiberada(s) ? custoEvolucaoCidade(s) : null;
  const nos = NOS.filter((no) => no.era === s.era && !s.pesquisados.includes(no.id) && disponivel(s, no.id));
  const maisBarato = nos.reduce((m, no) => Math.min(m, no.pesquisa), Infinity);
  if (maisBarato > s.pesquisa || (cidade && cidade.pesquisa > s.pesquisa && s.creditos >= cidade.creditos)) return "🔬";
  return "₵";
}

/**
 * Minutos "parados": potência que não cresce (≤ 0,5 %), população igual e ₵ subindo. Janelas de 2 min ou
 * mais, com a trava que mais apareceu nelas.
 */
function janelasParadas(registros: readonly RegistroMinuto[]): { de: number; ate: number; creditos: [number, number]; trava: string }[] {
  const janelas: { de: number; ate: number; creditos: [number, number]; trava: string }[] = [];
  let inicio = -1;
  const fechar = (fim: number) => {
    if (inicio < 0) return;
    if (fim - inicio + 1 >= 2) {
      const trecho = registros.slice(inicio, fim + 1);
      const conta = new Map<string, number>();
      for (const r of trecho) conta.set(r.trava, (conta.get(r.trava) ?? 0) + 1);
      const trava = [...conta.entries()].sort((a, b) => b[1] - a[1])[0][0];
      janelas.push({ de: registros[inicio].minuto - 1, ate: registros[fim].minuto, creditos: [registros[inicio - 1]?.creditos ?? registros[inicio].creditos, registros[fim].creditos], trava });
    }
    inicio = -1;
  };
  for (let i = 1; i < registros.length; i++) {
    const a = registros[i - 1];
    const r = registros[i];
    const parado = r.kw <= a.kw * 1.005 + 1e-9 && r.populacao === a.populacao && r.creditos > a.creditos && !r.ocorrencia;
    if (parado) {
      if (inicio < 0) inicio = i;
    } else fechar(i - 1);
  }
  fechar(registros.length - 1);
  return janelas;
}

function imprimirJanelas(titulo: string, registros: readonly RegistroMinuto[]): { total: number; maior: number } {
  const janelas = janelasParadas(registros);
  const total = janelas.reduce((soma, j) => soma + (j.ate - j.de), 0);
  const maior = janelas.reduce((m, j) => Math.max(m, j.ate - j.de), 0);
  console.log(`
${titulo}: ${total} de ${registros.length} min parados (maior janela: ${maior} min)`);
  for (const j of janelas) {
    console.log(`  min ${String(j.de).padStart(2)}–${String(j.ate).padEnd(3)} ₵ ${num(j.creditos[0])} → ${num(j.creditos[1])}  · trava ${j.trava}`);
  }
  return { total, maior };
}

/* ------------------------------------------------------------------ */
/* Ocorrências (Sessão 10, parte F)                                    */
/* ------------------------------------------------------------------ */

interface ContaOcorrencias {
  oferecidas: number;
  aceitas: number;
  superadas: number;
  falhas: number;
  escudo: number;
  ciencia: number;
  cienciaTotal: number;
  /** Por Ocorrência: [oferecidas, superadas]. */
  porId: Record<string, [number, number]>;
}

const novaConta = (): ContaOcorrencias => ({ oferecidas: 0, aceitas: 0, superadas: 0, falhas: 0, escudo: 0, ciencia: 0, cienciaTotal: 0, porId: {} });

/**
 * O que mais demora para a saída da era: a barra de 🛡 (na taxa do ouro) ou a 🔬 que falta para os nós da saída
 * e os pré-requisitos deles (na 🔬/s de agora). O operador escolhe a recompensa pelo que trava.
 */
function travaDaSaida(s: GameState): TipoRecompensa {
  const ouro = FAIXAS_CALOR.find((f) => f.id === "ouro")!.estabilidadePorMinuto;
  const minEstab = (100 - (s.nucleo?.estabilidade ?? 0)) / ouro;
  const faltam = new Set<string>();
  const visitar = (id: string) => {
    if (s.pesquisados.includes(id) || faltam.has(id)) return;
    faltam.add(id);
    for (const p of NO_POR_ID[id]?.pre ?? []) visitar(p);
  };
  for (const id of s.era === 1 ? ["fissaoBasica"] : ["reator7x7", "fusaoBasica"]) visitar(id);
  const pesquisa = [...faltam].reduce((soma, id) => soma + NO_POR_ID[id].pesquisa, 0) - s.pesquisa;
  const porS = numerosDoHud(s).taxaPesquisa;
  const minPesq = pesquisa <= 0 ? 0 : porS > 0 ? pesquisa / porS / 60 : Infinity;
  return minEstab >= minPesq ? "estabilidade" : "pesquisa";
}

/** Antes de cada tick: o operador escolhe a recompensa, aceita a oferta e acompanha o perfil; as outras rotas recusam. */
function antesDoTick(state: GameState, rota: Rota, conta: ContaOcorrencias): GameState {
  let s = state;
  const o = s.ocorrencia;
  if (rota !== "operador") return o.atual?.fase === "oferta" ? (recusarOcorrencia(s) ?? s) : s;
  if (o.recompensa) {
    const tipo = travaDaSaida(s);
    const valor = o.recompensa.pesquisa;
    const proximo = escolherRecompensa(s, tipo);
    if (proximo) {
      s = proximo;
      if (tipo === "estabilidade") conta.escudo++;
      else {
        conta.ciencia++;
        conta.cienciaTotal += valor;
      }
    }
  }
  if (s.ocorrencia.atual?.fase === "oferta") {
    const aceito = aceitarOcorrencia(s);
    if (aceito) {
      s = aceito;
      conta.aceitas++;
    }
  }
  if (s.ocorrencia.atual?.fase === "ativa") s = ajustarControle(s, controleQueCompensa(s, s.tempoMs + TICK_MS)) ?? s;
  return s;
}

/** Depois de cada tick: conta ofertas e resultados. */
function depoisDoTick(s: GameState, conta: ContaOcorrencias): void {
  for (const e of s.eventos) {
    if (e.tipo === "ocorrenciaOferecida") {
      conta.oferecidas++;
      (conta.porId[e.id] ??= [0, 0])[0]++;
    } else if (e.tipo === "ocorrenciaTerminou") {
      if (e.superada) {
        conta.superadas++;
        (conta.porId[e.id] ??= [0, 0])[1]++;
      } else conta.falhas++;
    }
  }
}

function textoOcorrencias(c: ContaOcorrencias): string {
  const por = Object.entries(c.porId)
    .map(([id, [o, sup]]) => `${id} ${sup}/${o}`)
    .join(", ");
  return `${c.oferecidas} oferecidas, ${c.aceitas} aceitas, ${c.superadas} superadas, ${c.falhas} falharam · 🛡 ${c.escudo}× · 🔬 ${c.ciencia}× (${num(c.cienciaTotal)})${por ? ` · ${por}` : ""}`;
}

/**
 * Uma rodada de decisões da Era 1. Devolve o estado novo e o que comprou. Na rota "cidade" (parte G da
 * Sessão 9) o jogador evolui a cidade mais cedo — aceita a demanda nova com a oferta cobrindo 75 % — e
 * guarda 🔬 para a próxima evolução em vez de gastá-la no nó mais barato.
 */
function decidir(state: GameState, compras: Map<string, number>, rota: Rota = "corrida"): GameState {
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
  //    Com a barra a 85 % e a Fissão comprada, o jogador que planeja já começa a juntar (parte G da Sessão 9:
  //    sem isso o bot ficava 6–7 min parado depois da barra cheia, esperando o Vaso).
  if (s.nucleo && s.era === 1 && s.nucleo.estabilidade >= 85 && s.pesquisados.includes("fissaoBasica") && s.creditos < 200_000 + 20_000) {
    return s;
  }
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
    const alvoSub = cheia ? ({ tipo: "subestacao", id: cheia.tipo } as const) : null;
    if (alvoSub && podeMelhorar(s, alvoSub) && s.creditos > custoNova * 2) {
      s = aplicar(melhorar(s, alvoSub), "nível de subestação") ?? s;
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
  // Dá para evoluir, mas a oferta não aguenta a demanda nova: primeiro usina (v0.8).
  const limiarEvolucao = rota === "cidade" ? 0.75 : 0.9;
  const prepararEvolucao = podeEvoluirCidade(s) && !evolucaoCabeNaOferta(s, limiarEvolucao);
  if (r < 1.0 || prepararEvolucao) {
    const tipo: TipoConstrucao = analise.contagem.turbinaEolica > 0 || s.pesquisados.includes("turbinaEolica") ? "turbinaEolica" : "cataVento";
    const escolhido = s.creditos >= custoColocar(s, tipo) ? tipo : "cataVento";
    const casa = melhorCasa(s, escolhido);
    if (casa !== null && s.creditos >= custoColocar(s, escolhido)) s = aplicar(colocar(s, casa, escolhido), USINAS[escolhido as "cataVento"].nome) ?? s;
  } else if (r > 1.05 || caixaSobrando) {
    // primeiro evoluir a cidade inteira (mais tarifa por kW), depois bairro novo (v0.8)
    if (evolucaoCabeNaOferta(s, limiarEvolucao)) {
      s = aplicar(evoluirCidade(s), `cidade → ${defDaDensidade(s.cidade.densidade + 1).nome}`) ?? s;
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

  // 4b. Níveis por tipo, sem tocar no que a saída da era pede (₵ 200 000 do Vaso + ₵ 50 000 da Fissão).
  const reserva = (s.nucleo?.estabilidade ?? 0) >= 60 ? 200_000 + (s.pesquisados.includes("fissaoBasica") ? 0 : 50_000) : 0;
  s = comprarNiveis(s, aplicar, reserva);

  // 5. Árvore: o nó mais barato disponível, com prioridade para os que destravam prédios.
  const prioritarios = ["bateria", "turbinaEolica", "universidade", "laminasDeFibra", "subestacaoAltaTensao"];
  // "Fissão básica" é a **porta da era**, não um nó qualquer: o bot compra o resto da árvore da Era 1
  // primeiro e só então a porta — mas nunca fica parado por causa dela (foi o que travou a 1ª rodada).
  const disponiveisAgora = NOS.filter((no) => no.era === 1 && podePesquisar(s, no.id));
  const outros = disponiveisAgora.filter((no) => no.id !== "fissaoBasica").sort((a, c) => a.pesquisa - c.pesquisa);
  const escolha = prioritarios.find((id) => podePesquisar(s, id)) ?? outros[0]?.id ?? proximoNo(s)?.id;
  if (escolha && podePesquisar(s, escolha)) {
    // guarda 🔬 para a próxima evolução de bairro se ela estiver perto
    const guardar = (capitulo?.condicao.tipo === "densidade" || rota === "cidade") && evolucaoLiberada(s) ? (custoEvolucaoCidade(s)?.pesquisa ?? 0) : 0;
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
  // Enfileira até N + 1 por decisão (N Bipes em paralelo, parte D da Sessão 9), não um só.
  if (melhorCasa(s, "cataVento") === null) {
    for (const id of s.mundo.ilhasAbertas) {
      if (s.mundo.remocoes.length >= bipesDe(s) + 1) break;
      const q = ILHAS.findIndex((i) => i.id === id);
      for (const casa of casasDe(q)) {
        if (s.mundo.remocoes.length >= bipesDe(s) + 1) break;
        if (!obstaculoEm(s.mundo, casa, arq) || !avaliarRemocaoObstaculo(s, casa, arq).ok || !temEscoamento(s, casa)) continue;
        s = aplicar(removerObstaculo(s, casa, arq), "desmatar") ?? s;
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
  // cabo no teto: subir o nível de todos os cabos (v0.8) em vez de deixar energia parada
  if (analisar(s).cabos.some((cabo) => cabo.usadoKw >= cabo.tetoKw - 0.01)) {
    if (podeMelhorar(s, { tipo: "cabos" }) && s.creditos > tetoCabo(s.melhorias.cabos) * 40) {
      s = aplicar(melhorar(s, { tipo: "cabos" }), "nível dos cabos") ?? s;
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

export type Rota = "corrida" | "cidade" | "operador";

/** Distritos e institutos que a rota "cidade" quer ver de pé antes de correr para a saída. */
const META_CIDADE = { distritos: 2, institutos: 2 } as const;
/** Densidade da arcologia (1 = aldeia … 6 = arcologia). */
const DENSIDADE_ARCOLOGIA = 6;

/**
 * A rota "cidade" cumpriu o que queria antes da saída: todos os bairros na arcologia, os distritos e os
 * institutos de pé, e a escolha exclusiva do reator feita. Na rota "corrida" não há meta.
 */
function metaDaCidade(s: GameState, rota: Rota): boolean {
  if (rota !== "cidade") return true;
  const a = analisar(s);
  const todosNaArcologia = s.cidade.densidade >= DENSIDADE_ARCOLOGIA;
  const exclusiva = s.pesquisados.includes("aguaPesada") || s.pesquisados.includes("altaTemperatura");
  return todosNaArcologia && a.contagem.distritoIndustrial >= META_CIDADE.distritos && a.contagem.institutoPesquisa >= META_CIDADE.institutos && exclusiva;
}

/** Uma rodada de decisões da Era 2. */
function decidirEra2(state: GameState, compras: Map<string, number>, rota: Rota = "corrida"): GameState {
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
  // Na rota "cidade" a reta final só começa depois da meta da cidade (ajuste 3 da Sessão 8).
  const retaFinal = (s.nucleo?.estabilidade ?? 0) >= 100 && metaDaCidade(s, rota);

  // 1. o reator: é a fonte de 🔬 e de Estabilidade
  s = operarReator(s, registrar);

  // 2. escoamento em MW: sem 138 kV nada de offshore nem de térmica
  if (analise.semEscoamentoKw > 10 || analise.bairrosSemEscoamento > 0 || analise.distritosSemEscoamento > 0) {
    const cheia = analise.subestacoes.find((x) => x.usadoKw >= x.tetoKw - 0.01);
    const alvoSub = cheia ? ({ tipo: "subestacao", id: cheia.tipo } as const) : null;
    if (alvoSub && podeMelhorar(s, alvoSub) && s.creditos > custoProximoNivel(s, alvoSub) * 2) {
      s = aplicar(melhorar(s, alvoSub), "nível de subestação") ?? s;
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

  // 3. balança: abaixo da zona de ouro, mais MW; acima, mais cidade — e mais MW antes de uma evolução
  //    que a oferta não aguentaria (v0.8: a cidade inteira sobe de uma vez)
  const r = b.demandaKw > 0 ? b.ofertaKw / b.demandaKw : Infinity;
  const querEvoluir = !retaFinal && podeEvoluirCidade(s);
  const limiarEvolucao = rota === "cidade" ? 0.75 : 0.9;
  if (r < 1.0 || (querEvoluir && !evolucaoCabeNaOferta(s, limiarEvolucao))) {
    // offshore primeiro (kW por casa e sem esteira), depois fazenda solar, e a térmica como last resort.
    // Com todas as subestações offshore cheias, o nível delas ou uma nova (parte G: o bot da Sessão 8 punha
    // uma só e a rota cidade parava em 22 MW).
    if (s.pesquisados.includes("subestacaoOffshore")) {
      const offshore = analise.subestacoes.filter((x) => x.tipo === "subestacaoOffshore");
      const cheias = offshore.every((x) => x.usadoKw >= x.tetoKw - 0.01);
      const alvoOffshore = { tipo: "subestacao", id: "subestacaoOffshore" } as const;
      if (offshore.length > 0 && cheias && podeMelhorar(s, alvoOffshore) && s.creditos > custoProximoNivel(s, alvoOffshore) * 2) {
        s = aplicar(melhorar(s, alvoOffshore), "nível da subestação offshore") ?? s;
      } else if (cheias && s.creditos >= custoColocar(s, "subestacaoOffshore") * 1.5) {
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
    if (querEvoluir && evolucaoCabeNaOferta(s, limiarEvolucao)) {
      s = aplicar(evoluirCidade(s), `cidade → densidade ${s.cidade.densidade + 1}`) ?? s;
    } else if (
      s.pesquisados.includes("industriaPesada") &&
      s.creditos > custoColocar(s, "distritoIndustrial") * 2 &&
      (rota !== "cidade" || analise.contagem.distritoIndustrial < META_CIDADE.distritos * 2)
    ) {
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

  // 4b. níveis por tipo, guardando o ₵ da saída (Reator 7×7 e Fusão básica) quando ela está perto
  const falta7x7 = s.pesquisados.includes("reator7x7") ? 0 : NO_POR_ID.reator7x7.creditos ?? 0;
  const faltaFusao = s.pesquisados.includes("fusaoBasica") ? 0 : NO_POR_ID.fusaoBasica.creditos ?? 0;
  const reserva = (s.nucleo?.estabilidade ?? 0) >= 70 ? falta7x7 + faltaFusao : 0;
  s = comprarNiveis(s, aplicar, reserva);

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
  // A rota "cidade" põe a cidade e a escolha exclusiva do reator antes do resto (ajuste 3 da Sessão 8).
  const prioritariosDaCidade = ["subestacaoDe138kV", "barraDeControle", "subestacaoOffshore", "piscinaDeResfriamento", "megacidade", "industriaPesada", "institutoDePesquisa", "arcologia", "enriquecimento", "caboHvdc", "combustivelMox", "reator7x7", "aguaPesada"];
  const focoNaCidade = rota === "cidade" && !metaDaCidade(s, rota);
  const lista = focoNaCidade ? prioritariosDaCidade : prioritarios;
  // Quem mira a cidade guarda 🔬 para o próximo nó da meta em vez de gastar no nó mais barato do resto.
  const proximoDaMeta = focoNaCidade ? prioritariosDaCidade.find((id) => !pesquisado(s, id) && disponivel(s, id)) : undefined;
  const guardando = proximoDaMeta !== undefined && !podePesquisar(s, proximoDaMeta);
  // Na reta final só se compra o caminho da saída; fora dela, os nós que destravam prédios primeiro.
  const caminhoDaSaida = ["enriquecimento", "combustivelMox", "reator7x7", "fusaoBasica"];
  const escolha = retaFinal
    ? caminhoDaSaida.find((id) => podePesquisar(s, id))
    : guardando
      ? undefined
      : (lista.find((id) => podePesquisar(s, id)) ?? NOS.filter((no) => no.id !== "fusaoBasica" && podePesquisar(s, no.id)).sort((a, c) => a.pesquisa - c.pesquisa)[0]?.id);
  if (escolha && podePesquisar(s, escolha)) {
    s = aplicar(pesquisar(s, escolha), `nó ${NO_POR_ID[escolha].nome}`) ?? s;
  }

  // 6. bateria de rede: amortece a balança na escala da era
  if (s.pesquisados.includes("bateriaDeRede") && analise.contagem.bateriaRede < 2 && s.creditos > custoColocar(s, "bateriaRede") * 3) {
    const casa = melhorCasa(s, "bateriaRede", false);
    if (casa !== null) s = aplicar(colocar(s, casa, "bateriaRede"), "bateria de rede") ?? s;
  }

  // 7. espaço e ilhas, como na Era 1
  if (melhorCasa(s, "fazendaSolar") === null) {
    for (const id of s.mundo.ilhasAbertas) {
      if (s.mundo.remocoes.length >= bipesDe(s) + 1) break;
      const q = ILHAS.findIndex((i) => i.id === id);
      for (const casa of casasDe(q)) {
        if (s.mundo.remocoes.length >= bipesDe(s) + 1) break;
        if (!obstaculoEm(s.mundo, casa, arq) || !avaliarRemocaoObstaculo(s, casa, arq).ok) continue;
        s = aplicar(removerObstaculo(s, casa, arq), "desmatar") ?? s;
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
  if (analisar(s).cabos.some((cabo) => cabo.usadoKw >= cabo.tetoKw - 0.01)) {
    if (podeMelhorar(s, { tipo: "cabos" }) && s.creditos > tetoCabo(s.melhorias.cabos, efeitosDe(s)) * 30) {
      s = aplicar(melhorar(s, { tipo: "cabos" }), "nível dos cabos") ?? s;
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
  const posicionais = args.filter((a) => !a.startsWith("--"));
  OPCOES.semNivelCiencia = args.includes("--sem-nivel-ciencia");
  const minutos = Number(posicionais[0]) || 60;
  // 75 min de Era 2: a era fecha dentro da janela de 50–70 min, e o resto é folga para a medição
  // enxergar o fechamento (a saída custa 🔬 40 000 e chega pouco depois da Estabilidade cheia).
  const minutosEra2 = Number(posicionais[1]) || 75;
  const rotas: Rota[] = ["corrida", "cidade", "operador"].includes(posicionais[2]) ? [posicionais[2] as Rota] : ["corrida", "cidade", "operador"];

  console.log(`\nKARDASHEV — simulação de ${minutos} min de Era 1 + ${minutosEra2} min de Era 2 (tick de ${TICK_MS} ms)`);
  if (OPCOES.semNivelCiencia) console.log("(sem comprar nível de ciência: --sem-nivel-ciencia)");

  // Cada rota joga as duas eras (parte G da Sessão 9): a Era 2 parte do fim da Era 1 da mesma rota.
  const resumos: ResumoEra2[] = [];
  for (const rota of rotas) {
    const era1 = simularEra1(rota, minutos);
    if (!podeConstruirReator(era1.estado)) {
      console.log(`\nRota "${rota}": o bot não chegou à Era 2 (faltou Estabilidade 100 %, o nó Fissão básica ou os ₵ 200 000 do Vaso).\n`);
      continue;
    }
    resumos.push(simularEra2(era1.estado, rota, minutosEra2, era1.minutoDaTransicao, era1.pesquisaGanha, era1.pesquisaAnterior, era1));
  }
  if (resumos.length > 1) {
    console.log("=".repeat(120));
    console.log("AS ROTAS NAS DUAS ERAS (ajuste 3 da Sessão 8; parte G da Sessão 9; rota operador da Sessão 10)\n");
    const min = (v: number | null) => (v === null ? "não fechou" : `${num(v, 1)} min`);
    const linhas: [string, (r: ResumoEra2) => string][] = [
      ["Era 1 fecha em", (r) => min(r.era1.fechou)],
      ["Era 1 parada", (r) => `${r.era1.parados} de ${r.era1.minutos} min (maior ${r.era1.maiorParada})`],
      ["Era 1: Ocorrências", (r) => `${r.era1.ocorrencias.superadas}/${r.era1.ocorrencias.oferecidas} · 🛡 ${r.era1.ocorrencias.escudo}× 🔬 ${r.era1.ocorrencias.ciencia}×`],
      ["Era 1: cidade no fim", (r) => r.era1.cidade],
      ["Era 2 fecha em", (r) => min(r.fechou)],
      ["Era 2 parada", (r) => `${r.parados} de ${r.minutos} min (maior ${r.maiorParada})`],
      ["Era 2: Ocorrências", (r) => `${r.ocorrencias.superadas}/${r.ocorrencias.oferecidas} · 🛡 ${r.ocorrencias.escudo}× 🔬 ${r.ocorrencias.ciencia}×`],
      ["Estabilidade 100 %", (r) => (r.estabilidade100 === null ? "—" : `${num(r.estabilidade100, 1)} min`)],
      ["potência instalada", (r) => kw(r.potenciaKw)],
      ["população", (r) => num(r.populacao)],
      ["megacidade / arcologia", (r) => `${r.megacidade === null ? "—" : `${num(r.megacidade, 1)} min`} / ${r.arcologia === null ? "—" : `${num(r.arcologia, 1)} min`}`],
      ["distritos / institutos", (r) => `${r.distritos} / ${r.institutos}`],
      ["escolha exclusiva", (r) => r.exclusiva ?? "nenhuma"],
      ["receita líquida negativa", (r) => `${r.minutosNegativos} min (pior sequência ${r.piorSequencia})`],
      ["₵ e 🔬 no fim", (r) => `₵ ${num(r.creditos)} · 🔬 ${num(r.pesquisa)}`],
      ["₵ em níveis (duas eras)", (r) => `₵ ${num(r.creditosEmNiveis)}`],
    ];
    console.log(`  ${"".padEnd(26)}${resumos.map((r) => r.rota.padEnd(34)).join("")}`);
    for (const [nome, f] of linhas) console.log(`  ${nome.padEnd(26)}${resumos.map((r) => f(r).padEnd(34)).join("")}`);
    console.log("");
  }
}

interface ResumoEra1 {
  estado: GameState;
  fechou: number | null;
  minutoDaTransicao: number;
  pesquisaGanha: number;
  pesquisaAnterior: number;
  parados: number;
  maiorParada: number;
  ocorrencias: ContaOcorrencias;
  minutos: number;
  cidade: string;
  creditosEmNiveis: number;
}

/** ₵ gastos em níveis, somados pelos eventos `melhoria` do tick (não pelo relatório impresso). */
function somarNiveis(antes: GameState, depois: GameState): number {
  return depois.eventos.some((e) => e.tipo === "melhoria") ? Math.max(0, antes.creditos - depois.creditos) : 0;
}

/** Joga a Era 1 inteira numa rota, do estado inicial até dar para construir o Reator. */
function simularEra1(rota: Rota, minutos: number): ResumoEra1 {
  const ticksPorMinuto = (60 * 1000) / TICK_MS;
  let s = estadoInicial();
  const marcos: Marcos = {
    "primeira zona de ouro": null,
    "Núcleo comprável (₵ 100)": null,
    "Núcleo desbloqueado": null,
    "5 cata-ventos": null,
    "primeiro 🔬 gasto": null,
    "primeira evolução da cidade": null,
    "cidade na metrópole": null,
    "primeiro nível de ciência": null,
    "primeiro nível de usina": null,
    "Equipe de manutenção Nv 1": null,
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
  let creditosEmNiveis = 0;
  const registros: RegistroMinuto[] = [{ minuto: 0, creditos: s.creditos, kw: 0, populacao: analisar(s).populacao, trava: "₵" }];

  console.log("\n" + "=".repeat(120));
  console.log(`ERA 1, rota "${rota}" — os dez primeiros minutos, minuto a minuto:\n`);

  const compras = new Map<string, number>();
  const conta = novaConta();
  for (let minuto = 1; minuto <= minutos; minuto++) {
    let operando = false;
    for (let t = 0; t < ticksPorMinuto; t++) {
      s = antesDoTick(s, rota, conta);
      s = tick(s);
      depoisDoTick(s, conta);
      if (s.ocorrencia.atual?.fase === "ativa") operando = true;
      // o bot decide a cada 2 s de jogo: é o ritmo de um jogador ativo, não de um script
      if (t % 20 === 0) {
        const antes = s;
        s = decidir(s, compras, rota);
        creditosEmNiveis += somarNiveis(antes, s);
      }

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
      marcar("primeira evolução da cidade", s.cidade.densidade > 1);
      marcar("cidade na metrópole", s.cidade.densidade >= 4);
      marcar("primeiro nível de ciência", TIPOS_CIENCIA.some((id) => s.melhorias.ciencia[id] > 0));
      marcar("primeiro nível de usina", USINAS_COM_NIVEL.some((id) => s.melhorias.usinas[id] > 0));
      marcar("Equipe de manutenção Nv 1", s.melhorias.equipe > 0);
      marcar("expedição de Ventania comprável", s.creditos >= (custoExpedicao("ventania") ?? 0));
      marcar("Ventania aberta", s.mundo.ilhasAbertas.includes("ventania"));
      marcar("🔬 3 000 acumulados (saída da Era 1)", pesquisaGanha >= 3000);
      marcar("₵ 50 000 (saída da Era 1)", s.creditos >= 50000);
      marcar("Estabilidade 100 % (saída da Era 1)", (s.nucleo?.estabilidade ?? 0) >= 100);
      marcar("nó Fissão básica comprado (saída da Era 1)", s.pesquisados.includes("fissaoBasica"));
    }
    const a = analisar(s);
    registros.push({ minuto, creditos: s.creditos, kw: a.brutoKw, populacao: a.populacao, trava: travaDe(s), ocorrencia: operando });
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

  console.log(`\nMarcos da Era 1 (rota "${rota}"):`);
  for (const [nome, valor] of Object.entries(marcos)) {
    console.log(`  ${nome.padEnd(42)} ${valor === null ? "não aconteceu" : `${num(valor, 1)} min`}`);
  }
  const fim = ["nó Fissão básica comprado (saída da Era 1)", "Estabilidade 100 % (saída da Era 1)"].map((k) => marcos[k]);
  const fechou = fim.every((v) => v !== null) ? Math.max(...(fim as number[])) : null;
  console.log(`\nEra 1 fecharia em: ${fechou === null ? "não fechou dentro da simulação" : `${num(fechou, 1)} min`} (alvo: 50–70 min)`);
  const { total: parados, maior: maiorParada } = imprimirJanelas(`Janelas paradas da Era 1 (rota "${rota}")`, registros);
  console.log(`\nOcorrências da Era 1 (rota "${rota}"): ${textoOcorrencias(conta)}`);
  imprimirEstado(s, pesquisaGanha, `Estado no fim da Era 1 (rota "${rota}")`);
  return {
    estado: s,
    fechou,
    minutoDaTransicao,
    pesquisaGanha,
    pesquisaAnterior,
    parados,
    maiorParada,
    ocorrencias: conta,
    minutos: registros.length - 1,
    cidade: `${defDaDensidade(s.cidade.densidade).nome}, ${analisar(s).contagem.bairro} bairros`,
    creditosEmNiveis,
  };
}

interface ResumoEra2 {
  rota: Rota;
  era1: ResumoEra1;
  parados: number;
  maiorParada: number;
  ocorrencias: ContaOcorrencias;
  minutos: number;
  megacidade: number | null;
  creditosEmNiveis: number;
  fechou: number | null;
  estabilidade100: number | null;
  potenciaKw: number;
  populacao: number;
  arcologia: number | null;
  distritos: number;
  institutos: number;
  exclusiva: string | null;
  minutosNegativos: number;
  piorSequencia: number;
  creditos: number;
  pesquisa: number;
}

/** Joga a Era 2 inteira numa rota, a partir do estado em que a Era 1 terminou. */
function simularEra2(
  estadoFinalEra1: GameState,
  rota: Rota,
  minutosEra2: number,
  minutoDaTransicao: number,
  pesquisaGanhaEra1: number,
  pesquisaAnteriorEra1: number,
  era1: ResumoEra1,
): ResumoEra2 {
  const ticksPorMinuto = (60 * 1000) / TICK_MS;
  let pesquisaGanha = pesquisaGanhaEra1;
  let pesquisaAnterior = pesquisaAnteriorEra1;
  const creditosAntes = estadoFinalEra1.creditos;
  let s = construirReator(estadoFinalEra1)!;
  console.log("\n" + "=".repeat(120));
  console.log(
    `ERA 2, rota "${rota}" — o Reator construído aos ${num(minutoDaTransicao, 0)} min por ₵ ${num(REATOR.custoVaso)} ` +
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
    "arcologia": null,
    "distrito industrial": null,
    "instituto de pesquisa": null,
    "escolha exclusiva do reator": null,
    "nó Reator 7×7 comprado": null,
    "Estabilidade 100 % (saída da Era 2)": null,
    "nó Fusão básica comprado (saída da Era 2)": null,
  };
  let minutosNegativos = 0;
  let sequenciaNegativa = 0;
  let piorSequencia = 0;
  let creditosEmNiveis = era1.creditosEmNiveis;
  const registros: RegistroMinuto[] = [{ minuto: 0, creditos: s.creditos, kw: analisar(s).brutoKw, populacao: analisar(s).populacao, trava: travaDe(s) }];
  const compras = new Map<string, number>();
  const conta = novaConta();
  for (let minuto = 1; minuto <= minutosEra2; minuto++) {
    let negativoNoMinuto = 0;
    let operando = false;
    for (let t = 0; t < ticksPorMinuto; t++) {
      s = antesDoTick(s, rota, conta);
      s = tick(s);
      depoisDoTick(s, conta);
      if (s.ocorrencia.atual?.fase === "ativa") operando = true;
      if (t % 20 === 0) {
        const antes = s;
        s = decidirEra2(s, compras, rota);
        creditosEmNiveis += somarNiveis(antes, s);
      }
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
      marcar("megacidade", s.cidade.densidade >= 5);
      marcar("arcologia", s.cidade.densidade >= DENSIDADE_ARCOLOGIA);
      marcar("distrito industrial", a.contagem.distritoIndustrial > 0);
      marcar("instituto de pesquisa", a.contagem.institutoPesquisa > 0);
      marcar("escolha exclusiva do reator", s.pesquisados.includes("aguaPesada") || s.pesquisados.includes("altaTemperatura"));
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

    {
      const a = analisar(s);
      registros.push({ minuto, creditos: s.creditos, kw: a.brutoKw, populacao: a.populacao, trava: travaDe(s), ocorrencia: operando });
    }
    if (minuto <= 10 || minuto % 5 === 0) {
      console.log(linhaEra2(s, minuto, compras));
      compras.clear();
    }
    if (minuto === 10) console.log("\nDe cinco em cinco minutos:\n");
  }

  console.log(`\nMarcos da Era 2 (rota "${rota}"):`);
  for (const [nome, valor] of Object.entries(marcos2)) {
    console.log(`  ${nome.padEnd(42)} ${valor === null ? "não aconteceu" : `${num(valor, 1)} min`}`);
  }
  const fim2 = ["nó Fusão básica comprado (saída da Era 2)", "Estabilidade 100 % (saída da Era 2)"].map((k) => marcos2[k]);
  const fechou2 = fim2.every((v) => v !== null) ? Math.max(...(fim2 as number[])) : null;
  console.log(`\nEra 2 fecharia em: ${fechou2 === null ? "não fechou dentro da simulação" : `${num(fechou2, 1)} min`} (alvo: 50–70 min)`);
  console.log(`Receita líquida negativa: ${minutosNegativos} minuto(s), pior sequência ${piorSequencia} (alvo: nunca mais de 1)`);
  // até o fechamento: depois dele o resto da simulação é folga, não espera
  const ate = fechou2 === null ? registros.length : Math.ceil(fechou2) + 1;
  const { total: parados, maior: maiorParada } = imprimirJanelas(`Janelas paradas da Era 2 (rota "${rota}", até o fechamento)`, registros.slice(0, ate));
  console.log(`\nOcorrências da Era 2 (rota "${rota}"): ${textoOcorrencias(conta)}`);
  imprimirEstado(s, pesquisaGanha, `Estado no fim da Era 2 (rota "${rota}")`);
  const a = analisar(s);
  return {
    rota,
    era1,
    parados,
    maiorParada,
    ocorrencias: conta,
    minutos: Math.min(registros.length, ate) - 1,
    megacidade: marcos2["megacidade"],
    creditosEmNiveis,
    fechou: fechou2,
    estabilidade100: marcos2["Estabilidade 100 % (saída da Era 2)"],
    potenciaKw: a.brutoKw,
    populacao: a.populacao,
    arcologia: marcos2["arcologia"],
    distritos: a.contagem.distritoIndustrial,
    institutos: a.contagem.institutoPesquisa,
    exclusiva: s.pesquisados.includes("aguaPesada") ? "Água pesada" : s.pesquisados.includes("altaTemperatura") ? "Alta temperatura" : null,
    minutosNegativos,
    piorSequencia,
    creditos: s.creditos,
    pesquisa: s.pesquisa,
  };
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
  const m = s.melhorias;
  console.log(
    `  subestações: ${a.subestacoes.length} · alcance ${efeitosDe(s).alcanceSubestacao} · níveis ${m.subestacoes.subestacao}/${m.subestacoes.subestacao138}/${m.subestacoes.subestacaoOffshore} · cabos ${a.cabos.map((c) => c.ilha).join(", ") || "—"} no nível ${m.cabos}`,
  );
  console.log(`  ilhas abertas: ${s.mundo.ilhasAbertas.join(", ")}\n`);
}
