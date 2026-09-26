/**
 * Persistência: único arquivo que toca `localStorage`.
 * Salva a cada `INTERVALO_SAVE_MS`, carrega no início, exporta/importa JSON,
 * migra saves de versões anteriores.
 */
import { NOS_INICIAIS, NO_POR_ID } from "../content/arvore";
import { CAPITULO_POR_ID } from "../content/capitulos";
import { ILHAS, ORDEM_OBSTACULOS, type IlhaId } from "../content/era1-arquipelago";
import { NUCLEO } from "../content/era1-nucleo";
import { VARETA } from "../content/era2-nucleo";
import { PECA_POR_ID, ordemDasPecas } from "../content/pecas";
import { NIVEL_CIENCIA, NIVEL_EQUIPE, NIVEL_PECA, PECAS_SEM_NIVEL, TIPOS_CIENCIA } from "../content/melhorias";
import { bipesNoNivel } from "./niveis";
import type { Arquipelago } from "./arquipelago";
import { DENSIDADES, type Densidade } from "../content/cidade";
import { ESCOAMENTO, ehDeAgua } from "./producao";
import { arquipelagoDaEra1 } from "./gerarArquipelago";
import { migrarParaMundo } from "./migracao-v6";
import { anel } from "./nucleo";
import { calcularOffline, type RelatorioOffline } from "./offline";
import {
  estadoInicial,
  gradeVazia,
  indiceReceptor,
  melhoriasIniciais,
  mundoInicial,
  nucleoInicial,
  VERSAO_SAVE,
  type Casa,
  type Construcao,
  type GameState,
  type MelhoriasState,
  type MundoState,
  type NucleoState,
  type PecaId,
  type RedeState,
  type RemocaoEmCurso,
  type TipoConstrucao,
  type UsinaId,
  type VaretaEstado,
} from "./state";

export const CHAVE_SAVE = "aproved.save";
export const INTERVALO_SAVE_MS = 10_000;

/** Subconjunto de `Storage` usado aqui; permite injetar um armazenamento em testes. */
export interface Armazenamento {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

function armazenamentoPadrao(): Armazenamento | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export class ErroSave extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroSave";
  }
}

/* ------------------------------------------------------------------ */
/* Serialização                                                       */
/* ------------------------------------------------------------------ */

/** Serializa carimbando `salvoEmMs` com o relógio real (base do cálculo offline). Eventos não persistem. */
export function serializar(state: GameState, agoraMs: number = Date.now()): string {
  return JSON.stringify({ ...state, salvoEmMs: agoraMs, eventos: [] });
}

function numero(valor: unknown, padrao: number, minimo = 0): number {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return padrao;
  return Math.max(minimo, valor);
}

function inteiro(valor: unknown, padrao: number): number {
  return Math.floor(numero(valor, padrao));
}

function booleano(valor: unknown, padrao: boolean): boolean {
  return typeof valor === "boolean" ? valor : padrao;
}

function objeto(valor: unknown): Record<string, unknown> {
  return valor !== null && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
}

const IDS_USINA: readonly UsinaId[] = ["cataVento", "painelSolar", "turbinaEolica", "eolicaOffshore", "fazendaSolar", "termicaGas"];

function ehPecaId(valor: unknown): valor is PecaId {
  return typeof valor === "string" && valor in PECA_POR_ID;
}

/** Combustível de uma vareta salva; `undefined` para as peças que não são vareta. */
function normalizarVareta(id: PecaId, bruto: unknown): VaretaEstado | undefined {
  if (id !== "vareta") return undefined;
  const v = objeto(bruto);
  const restanteS = numero(v.restanteS, VARETA.combustivelS);
  const gasta = typeof v.gastaDesdeMs === "number" && Number.isFinite(v.gastaDesdeMs) ? v.gastaDesdeMs : null;
  // Ou tem combustível, ou está gasta: o save não pode chegar nas duas situações ao mesmo tempo.
  if (gasta !== null) return { restanteS: 0, gastaDesdeMs: gasta };
  return { restanteS: Math.min(VARETA.combustivelS, Math.max(0, restanteS)), gastaDesdeMs: null };
}

function normalizarCasa(bruto: unknown, indice: number, lado: number, era: 1 | 2): Casa {
  if (indice === indiceReceptor(lado)) return { tipo: "receptor" };
  const c = objeto(bruto);
  if (!ehPecaId(c.id)) return null;
  // Peça de outra era não entra na grade: a Torre não tem vareta e o reator não tem heliostato.
  if (!ordemDasPecas(era).includes(c.id)) return null;
  const a = anel(indice, lado);
  if (a === 0 || !PECA_POR_ID[c.id].aneis.includes(a)) return null;
  const vareta = normalizarVareta(c.id, c.vareta);
  if (c.tipo === "peca") return vareta ? { tipo: "peca", id: c.id, vareta } : { tipo: "peca", id: c.id };
  if (c.tipo === "entulho") {
    const base = { tipo: "entulho" as const, id: c.id, desdeMs: numero(c.desdeMs, 0) };
    // Entulho de vareta continua quente: se o save não trouxe a marca, ele já está decaindo.
    return vareta ? { ...base, vareta: { restanteS: 0, gastaDesdeMs: vareta.gastaDesdeMs ?? base.desdeMs } } : base;
  }
  return null;
}

function normalizarNucleo(bruto: unknown, era: 1 | 2): NucleoState | null {
  if (bruto === null || bruto === undefined || typeof bruto !== "object") return null;
  const n = objeto(bruto);
  const base = nucleoInicial();
  const lado = n.lado === 7 ? 7 : NUCLEO.ladoInicial;
  const gradeBruta = Array.isArray(n.grade) ? n.grade : [];
  const grade = gradeVazia(lado).map((_, i) => normalizarCasa(gradeBruta[i], i, lado, era));
  const scramRestanteMs = numero(n.scramRestanteMs, base.scramRestanteMs);
  const ultimaCascataMs = typeof n.ultimaCascataMs === "number" && Number.isFinite(n.ultimaCascataMs) ? n.ultimaCascataMs : null;
  const uc = objeto(n.ultimaCascata);
  const ultimaCascata =
    n.ultimaCascata && typeof uc.tempoMs === "number"
      ? { tempoMs: numero(uc.tempoMs, 0), entradaUs: numero(uc.entradaUs, 0), saidaUs: numero(uc.saidaUs, 0) }
      : null;
  return {
    era,
    lado,
    grade,
    calorU: numero(n.calorU, base.calorU),
    tempoAcimaDoLimiteMs: numero(n.tempoAcimaDoLimiteMs, base.tempoAcimaDoLimiteMs),
    scramRestanteMs,
    scramInicioMs: scramRestanteMs > 0 && typeof n.scramInicioMs === "number" && Number.isFinite(n.scramInicioMs) ? n.scramInicioMs : null,
    trocasEmFaixa: inteiro(n.trocasEmFaixa, 0),
    estabilidade: Math.min(100, numero(n.estabilidade, base.estabilidade)),
    modoSeguro: booleano(n.modoSeguro, base.modoSeguro),
    receptorCeramico: booleano(n.receptorCeramico, base.receptorCeramico),
    cascatas: inteiro(n.cascatas, base.cascatas),
    ultimaCascataMs,
    ultimaCascata,
  };
}

function normalizarCardsVistos(bruto: unknown): string[] {
  if (!Array.isArray(bruto)) return [];
  return Array.from(new Set(bruto.filter((x): x is string => typeof x === "string")));
}

const TIPOS_CONSTRUCAO: readonly TipoConstrucao[] = [
  "cataVento",
  "painelSolar",
  "turbinaEolica",
  "eolicaOffshore",
  "fazendaSolar",
  "termicaGas",
  "bairro",
  "bateria",
  "subestacao",
  "laboratorio",
  "universidade",
  "subestacao138",
  "subestacaoOffshore",
  "bateriaRede",
  "distritoIndustrial",
  "institutoPesquisa",
];

function ehTipoConstrucao(valor: unknown): valor is TipoConstrucao {
  return typeof valor === "string" && TIPOS_CONSTRUCAO.includes(valor as TipoConstrucao);
}

function ehIlhaId(valor: unknown): valor is IlhaId {
  return typeof valor === "string" && ILHAS.some((i) => i.id === valor);
}

/** Mundo salvo: construções em casas válidas, obstáculos removidos que existiam, ilhas e cabos conhecidos. */
function normalizarMundo(bruto: unknown): MundoState {
  const arq = arquipelagoDaEra1();
  const base = mundoInicial();
  const m = objeto(bruto);
  if (bruto === undefined || bruto === null) return base;

  const construcoes: Record<number, Construcao> = {};
  for (const [chave, valor] of Object.entries(objeto(m.construcoes))) {
    const i = Number(chave);
    if (!Number.isInteger(i) || i < 0 || i >= arq.n * arq.n) continue;
    const c = objeto(valor);
    if (!ehTipoConstrucao(c.tipo)) continue;
    // Offshore mora no mar; o resto, em terra (GDD Parte 2 §3.1).
    if (ehDeAgua(c.tipo) ? arq.terra[i] === 1 : arq.terra[i] !== 1) continue;
    // Nenhuma construção guarda nível desde a v9: os níveis são por tipo e a densidade é da cidade (v0.8).
    construcoes[i] = { tipo: c.tipo, nivel: 0, colocadoEmMs: numero(c.colocadoEmMs, 0) };
  }

  const removidos = Array.isArray(m.removidos)
    ? Array.from(new Set(m.removidos.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < arq.n * arq.n && arq.obstaculos[i] !== 255)))
    : [];

  const cristais = Array.isArray(m.cristais)
    ? Array.from(new Set(m.cristais.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < arq.n * arq.n && arq.terra[i] === 1)))
    : [];

  const remocoes = normalizarRemocoes(m.remocoes, new Set(removidos), arq);

  const abertas = Array.isArray(m.ilhasAbertas) ? m.ilhasAbertas.filter(ehIlhaId) : [];
  const ilhasAbertas: IlhaId[] = [];
  for (const id of [...base.ilhasAbertas, ...abertas]) if (!ilhasAbertas.includes(id)) ilhasAbertas.push(id);
  // Cabos: só a presença vale — o nível é global, em `melhorias.cabos` (v0.8).
  const cabos: Partial<Record<IlhaId, number>> = {};
  for (const chave of Object.keys(objeto(m.cabos))) {
    if (!ehIlhaId(chave) || chave === "principal") continue;
    cabos[chave] = 0;
  }

  return { construcoes, removidos, remocoes, cristais, ilhasAbertas, cabos };
}

/** Mais Bipes do que a Equipe no máximo dá é índice inválido. */
const BIPES_MAX = bipesNoNivel(NIVEL_EQUIPE.maximo);

/**
 * Fila de remoção (§8.5, v0.8): descarta casa inválida, repetida, já removida ou com tipo diferente do
 * mapa. Cada remoção em curso fica com um Bipe próprio; um save v8 (um Bipe só, sem o campo) recebe o 0,
 * e o primeiro tick põe o segundo Bipe na próxima da fila. O `fimMs` antigo é mantido.
 */
function normalizarRemocoes(bruto: unknown, removidos: ReadonlySet<number>, arq: Arquipelago): RemocaoEmCurso[] {
  if (!Array.isArray(bruto)) return [];
  const vistas = new Set<number>();
  const usados = new Set<number>();
  const fila: RemocaoEmCurso[] = [];
  for (const item of bruto) {
    const r = objeto(item);
    const indice = inteiro(r.indice, -1);
    if (indice < 0 || indice >= arq.n * arq.n || vistas.has(indice) || removidos.has(indice)) continue;
    const o = arq.obstaculos[indice];
    if (o === 255 || r.tipo !== ORDEM_OBSTACULOS[o]) continue;
    vistas.add(indice);
    const fimMs = numero(r.fimMs, 0);
    const remocao: RemocaoEmCurso = { indice, tipo: ORDEM_OBSTACULOS[o], inicioMs: fimMs > 0 ? numero(r.inicioMs, 0) : 0, fimMs };
    if (fimMs > 0) {
      const pedido = inteiro(r.bipe, -1);
      remocao.bipe = pedido >= 0 && pedido < BIPES_MAX && !usados.has(pedido) ? pedido : -1;
      if (remocao.bipe >= 0) usados.add(remocao.bipe);
    }
    fila.push(remocao);
  }
  // Em curso sem Bipe válido: o menor livre.
  for (const r of fila) {
    if (r.bipe !== -1) continue;
    let b = 0;
    while (usados.has(b)) b++;
    r.bipe = b;
    usados.add(b);
  }
  return fila;
}

/** Capítulos concluídos: só ids conhecidos, sem repetição. */
function normalizarCapitulos(bruto: unknown): string[] {
  const lista = Array.isArray(bruto) ? bruto.filter((x): x is string => typeof x === "string" && x in CAPITULO_POR_ID) : [];
  return Array.from(new Set(lista));
}

/** Nós pesquisados: só ids conhecidos, sem repetição, e os que nascem prontos sempre presentes. */
function normalizarPesquisados(bruto: unknown): string[] {
  const lista = Array.isArray(bruto) ? bruto.filter((x): x is string => typeof x === "string" && x in NO_POR_ID) : [];
  return Array.from(new Set([...NOS_INICIAIS, ...lista]));
}

/**
 * Níveis por tipo (v0.8): inteiros ≥ 0; peças, ciência e subestações até o máximo do tipo. A usina fica
 * como veio: saves anteriores à v0.8 não tinham máximo, e quem passou de 5 guarda o nível (só não compra mais).
 */
function normalizarMelhorias(bruto: unknown): MelhoriasState {
  const base = melhoriasIniciais();
  const m = objeto(bruto);
  const usinasBrutas = objeto(m.usinas);
  const pecasBrutas = objeto(m.pecas);
  const subestacoesBrutas = objeto(m.subestacoes);
  const cienciaBruta = objeto(m.ciencia);
  const usinas = { ...base.usinas };
  for (const id of IDS_USINA) usinas[id] = inteiro(usinasBrutas[id], 0);
  const pecas = { ...base.pecas };
  for (const id of Object.keys(pecas) as PecaId[]) pecas[id] = PECAS_SEM_NIVEL.includes(id) ? 0 : Math.min(NIVEL_PECA.maximo, inteiro(pecasBrutas[id], 0));
  const subestacoes = { ...base.subestacoes };
  for (const t of Object.keys(subestacoes) as (keyof typeof subestacoes)[]) subestacoes[t] = Math.min(ESCOAMENTO[t].nivelMax, inteiro(subestacoesBrutas[t], 0));
  const ciencia = { ...base.ciencia };
  for (const t of TIPOS_CIENCIA) ciencia[t] = Math.min(NIVEL_CIENCIA.maximo, inteiro(cienciaBruta[t], 0));
  const equipe = Math.min(NIVEL_EQUIPE.maximo, inteiro(m.equipe, 0));
  return { usinas, pecas, subestacoes, cabos: inteiro(m.cabos, 0), ciencia, equipe };
}

/** Preenche campos ausentes com o estado inicial e sanitiza números. `agoraMs` vira o carimbo de saves sem `salvoEmMs`. */
function normalizar(bruto: Record<string, unknown>, agoraMs: number): GameState {
  const base = estadoInicial();
  const redeBruta = objeto(bruto.rede);
  const bateriaBruta = objeto(redeBruta.bateria);

  // As contagens são derivadas do mundo (GDD §2.1, v0.6) e os níveis moram em `melhorias` (v0.8): aqui só a carga.
  const rede: RedeState = { bateria: { kwh: numero(bateriaBruta.kwh, 0) } };

  const era: 1 | 2 = bruto.era === 2 ? 2 : 1;
  return {
    versao: VERSAO_SAVE,
    tempoMs: numero(bruto.tempoMs, base.tempoMs),
    creditos: numero(bruto.creditos, base.creditos),
    pesquisa: numero(bruto.pesquisa, base.pesquisa),
    era,
    rede,
    melhorias: normalizarMelhorias(bruto.melhorias),
    cidade: { densidade: Math.min(DENSIDADES.length, Math.max(1, inteiro(objeto(bruto.cidade).densidade, 1))) as Densidade },
    nucleo: normalizarNucleo(bruto.nucleo, era),
    pesquisados: normalizarPesquisados(bruto.pesquisados),
    capitulos: normalizarCapitulos(bruto.capitulos),
    salvoEmMs: typeof bruto.salvoEmMs === "number" && bruto.salvoEmMs > 0 ? bruto.salvoEmMs : agoraMs,
    cardsVistos: normalizarCardsVistos(bruto.cardsVistos),
    mundo: normalizarMundo(bruto.mundo),
    eventos: [],
  };
}

/**
 * Migra saves de versões anteriores, uma versão por vez.
 * v1 → v2: entra o Núcleo (`nucleo: null` até ser desbloqueado). Rede e créditos ficam como estão.
 * v2 → v3: entram `melhorias` (vazias) e `salvoEmMs` (= agora, sem ganho offline na primeira carga).
 * v3 → v4: entram `nucleo.lado` (5), `nucleo.ultimaCascata` (null) e `cardsVistos` ([]).
 * v4 → v5: entra `tabuleiro` com as regiões iniciais da ilha (GDD §2.4).
 * v5 → v6: a Rede vira colocação (GDD §2.1, v0.6): as contagens viram construções na ilha principal,
 *          o excedente vira ₵, e `tabuleiro` (regiões/vagas) some — quem manda agora é `mundo`.
 * v6 → v7: o cabo submarino ganha nível (lista de ilhas → ilha: nível), entram as casas de cristal,
 *          "vila" vira "bairro" com densidade, e as melhorias nomeadas viram nós da árvore — 🔬
 *          acumulado vira saldo e o que já estava desbloqueado fica desbloqueado sem cobrar.
 * v7 → v8: entra a **era** (GDD Parte 2 §2). Saves antigos são todos da Era 1 e continuam jogáveis;
 *          o Núcleo ganha `era`, `scramInicioMs` e `trocasEmFaixa`.
 * v8 → v9: níveis **por tipo** e cidade inteira (GDD §7.1, §8.6, v0.8). O nível das usinas sai de
 *          `rede.usinas` para `melhorias`; subestações e cabos, que subiam por unidade, passam a subir por
 *          tipo — cada tipo nasce no **maior** nível que já tinha. A densidade sai dos bairros e vai para
 *          `cidade`, na **maior** entre eles (os mais baixos sobem de graça, uma vez). Os níveis por
 *          unidade zeram. Peças e ciência começam em 0.
 */
function migrar(bruto: Record<string, unknown>, agoraMs: number): Record<string, unknown> {
  const versao = bruto.versao;
  if (typeof versao !== "number") throw new ErroSave("Save sem campo `versao`.");
  if (versao > VERSAO_SAVE) {
    throw new ErroSave(`Save da versão ${versao} é mais novo que o jogo (versão ${VERSAO_SAVE}).`);
  }
  let atual = bruto;
  let v = versao;
  if (v === 1) {
    atual = { ...atual, nucleo: null, versao: 2 };
    v = 2;
  }
  if (v === 2) {
    atual = { ...atual, melhorias: {}, salvoEmMs: agoraMs, versao: 3 };
    v = 3;
  }
  if (v === 3) {
    const nucleo = atual.nucleo && typeof atual.nucleo === "object" ? { ...(atual.nucleo as Record<string, unknown>), lado: 5, ultimaCascata: null } : atual.nucleo;
    atual = { ...atual, nucleo, cardsVistos: [], versao: 4 };
    v = 4;
  }
  if (v === 4) {
    atual = { ...atual, tabuleiro: { regioesDesbloqueadas: [] }, versao: 5 };
    v = 5;
  }
  if (v === 5) {
    const redeBruta = objeto(atual.rede);
    const usinasBrutas = objeto(redeBruta.usinas);
    const conta = (id: string) => inteiro(objeto(usinasBrutas[id]).quantidade, 0);
    const { mundo, reembolso } = migrarParaMundo({
      cataVento: conta("cataVento"),
      turbinaEolica: conta("turbinaEolica"),
      painelSolar: conta("painelSolar"),
      bairro: inteiro(redeBruta.vilas, 0),
      bateria: inteiro(objeto(redeBruta.bateria).unidades, 0),
    });
    const rede = {
      usinas: Object.fromEntries(IDS_USINA.map((id) => [id, { nivel: inteiro(objeto(usinasBrutas[id]).nivel, 0) }])),
      bateria: { kwh: numero(objeto(redeBruta.bateria).kwh, 0) },
    };
    const { tabuleiro: _tabuleiro, ...resto } = atual;
    atual = { ...resto, rede, mundo, creditos: numero(atual.creditos, 0) + reembolso, versao: 6 };
    v = 6;
  }
  if (v === 6) {
    const mundoBruto = objeto(atual.mundo);
    const cabos: Record<string, number> = {};
    if (Array.isArray(mundoBruto.cabos)) for (const id of mundoBruto.cabos) if (typeof id === "string" && id !== "principal") cabos[id] = 0;
    // "vila" virou "bairro" com densidade no `nivel` (GDD §2.5, §8.6): o tipo antigo é a densidade 1.
    const construcoes: Record<string, unknown> = {};
    for (const [chave, valor] of Object.entries(objeto(mundoBruto.construcoes))) {
      const c = objeto(valor);
      construcoes[chave] = c.tipo === "vila" ? { ...c, tipo: "bairro" } : c;
    }
    // 🔬 acumulado vira saldo; o que já estava desbloqueado continua desbloqueado **sem cobrar**.
    const melhorias = objeto(atual.melhorias);
    const acumulado = numero(atual.pesquisa, 0);
    const nucleoBruto = objeto(atual.nucleo);
    const pesquisados = [...NOS_INICIAIS];
    const marcar = (id: string) => {
      if (!pesquisados.includes(id)) pesquisados.push(id);
    };
    if (melhorias.laminasDeFibra === true) marcar("laminasDeFibra");
    if (melhorias.rastreamentoSolar === true) marcar("rastreamentoSolar");
    if (melhorias.grade7x7 === true) marcar("grade7x7");
    if (atual.nucleo && nucleoBruto.receptorCeramico === true) marcar("receptorCeramico");
    // Limiares antigos (🔬 40 turbina eólica, 🔬 20 bateria) que já tinham sido alcançados.
    if (acumulado >= 40) marcar("turbinaEolica");
    if (acumulado >= 20) marcar("bateria");
    const { melhorias: _melhorias, ...resto } = atual;
    atual = { ...resto, mundo: { ...mundoBruto, construcoes, cabos, cristais: [] }, pesquisados, capitulos: [], versao: 7 };
    v = 7;
  }
  if (v === 7) {
    // v7 → v8: entra a era. Todo save antigo é da Era 1 e continua jogável exatamente como estava; o
    // Núcleo ganha a marca da era, o relógio do SCRAM e o contador de trocas de vareta.
    const nucleoBruto = atual.nucleo && typeof atual.nucleo === "object" ? { ...(atual.nucleo as Record<string, unknown>), era: 1, scramInicioMs: null, trocasEmFaixa: 0 } : atual.nucleo;
    atual = { ...atual, era: 1, nucleo: nucleoBruto, versao: 8 };
    v = 8;
  }
  if (v === 8) {
    const redeBruta = objeto(atual.rede);
    const usinasBrutas = objeto(redeBruta.usinas);
    const usinas = Object.fromEntries(IDS_USINA.map((id) => [id, inteiro(objeto(usinasBrutas[id]).nivel, 0)]));
    const mundoBruto = objeto(atual.mundo);
    const subestacoes: Record<string, number> = { subestacao: 0, subestacao138: 0, subestacaoOffshore: 0 };
    const construcoes: Record<string, unknown> = {};
    let densidade = 1;
    for (const [chave, valor] of Object.entries(objeto(mundoBruto.construcoes))) {
      const c = objeto(valor);
      if (typeof c.tipo === "string" && c.tipo in subestacoes) subestacoes[c.tipo] = Math.max(subestacoes[c.tipo], inteiro(c.nivel, 0));
      // no v8 o bairro guardava a densidade − 1 no próprio nível
      if (c.tipo === "bairro") densidade = Math.max(densidade, inteiro(c.nivel, 0) + 1);
      construcoes[chave] = { ...c, nivel: 0 };
    }
    let cabos = 0;
    const ligados: Record<string, number> = {};
    for (const [id, nivel] of Object.entries(objeto(mundoBruto.cabos))) {
      cabos = Math.max(cabos, inteiro(nivel, 0));
      ligados[id] = 0;
    }
    const melhorias = { usinas, pecas: {}, subestacoes, cabos, ciencia: {} };
    atual = {
      ...atual,
      rede: { bateria: objeto(redeBruta.bateria) },
      melhorias,
      cidade: { densidade },
      mundo: { ...mundoBruto, construcoes, cabos: ligados },
      versao: 9,
    };
    v = 9;
  }
  return { ...atual, versao: v };
}

export function desserializar(json: string, agoraMs: number = Date.now()): GameState {
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    throw new ErroSave("JSON inválido.");
  }
  if (bruto === null || typeof bruto !== "object" || Array.isArray(bruto)) {
    throw new ErroSave("O save precisa ser um objeto JSON.");
  }
  return normalizar(migrar(bruto as Record<string, unknown>, agoraMs), agoraMs);
}

/* ------------------------------------------------------------------ */
/* localStorage                                                       */
/* ------------------------------------------------------------------ */

export function salvar(
  state: GameState,
  storage: Armazenamento | null = armazenamentoPadrao(),
  agoraMs: number = Date.now(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(CHAVE_SAVE, serializar(state, agoraMs));
    return true;
  } catch {
    return false;
  }
}

export interface Carregado {
  state: GameState;
  relatorio: RelatorioOffline;
}

/** Devolve o estado salvo já com o cálculo offline aplicado, ou `null` se não houver save válido. */
export function carregar(
  storage: Armazenamento | null = armazenamentoPadrao(),
  agoraMs: number = Date.now(),
): Carregado | null {
  if (!storage) return null;
  try {
    const json = storage.getItem(CHAVE_SAVE);
    if (!json) return null;
    return calcularOffline(desserializar(json, agoraMs), agoraMs);
  } catch {
    return null;
  }
}

export function limpar(storage: Armazenamento | null = armazenamentoPadrao()): void {
  try {
    storage?.removeItem(CHAVE_SAVE);
  } catch {
    /* sem armazenamento disponível */
  }
}

/* ------------------------------------------------------------------ */
/* Exportar / importar                                                */
/* ------------------------------------------------------------------ */

export function exportarJson(state: GameState, agoraMs: number = Date.now()): string {
  return JSON.stringify({ ...state, salvoEmMs: agoraMs, eventos: [] }, null, 2);
}

/** Lança `ErroSave` se o JSON for inválido. Não aplica o offline: quem importa decide. */
export function importarJson(json: string, agoraMs: number = Date.now()): GameState {
  return desserializar(json, agoraMs);
}
