/**
 * Persistência: único arquivo que toca `localStorage`.
 * Salva a cada `INTERVALO_SAVE_MS`, carrega no início, exporta/importa JSON,
 * migra saves de versões anteriores.
 */
import { MELHORIAS } from "../content/era1";
import { ILHAS, ORDEM_OBSTACULOS, type IlhaId, type TipoObstaculo } from "../content/era1-arquipelago";
import { NUCLEO, PECAS } from "../content/era1-nucleo";
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
  type MelhoriaId,
  type Melhorias,
  type MundoState,
  type NucleoState,
  type PecaId,
  type RedeState,
  type RemocaoEmCurso,
  type TipoConstrucao,
  type UsinaId,
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

const IDS_USINA: readonly UsinaId[] = ["cataVento", "painelSolar", "turbinaEolica"];

function ehPecaId(valor: unknown): valor is PecaId {
  return typeof valor === "string" && valor in PECAS;
}

function normalizarCasa(bruto: unknown, indice: number, lado: number): Casa {
  if (indice === indiceReceptor(lado)) return { tipo: "receptor" };
  const c = objeto(bruto);
  if (!ehPecaId(c.id)) return null;
  const a = anel(indice, lado);
  if (a === 0 || !PECAS[c.id].aneis.includes(a)) return null;
  if (c.tipo === "peca") return { tipo: "peca", id: c.id };
  if (c.tipo === "entulho") return { tipo: "entulho", id: c.id, desdeMs: numero(c.desdeMs, 0) };
  return null;
}

function normalizarNucleo(bruto: unknown): NucleoState | null {
  if (bruto === null || bruto === undefined || typeof bruto !== "object") return null;
  const n = objeto(bruto);
  const base = nucleoInicial();
  const lado = n.lado === 7 ? 7 : NUCLEO.ladoInicial;
  const gradeBruta = Array.isArray(n.grade) ? n.grade : [];
  const grade = gradeVazia(lado).map((_, i) => normalizarCasa(gradeBruta[i], i, lado));
  const scramRestanteMs = numero(n.scramRestanteMs, base.scramRestanteMs);
  const ultimaCascataMs = typeof n.ultimaCascataMs === "number" && Number.isFinite(n.ultimaCascataMs) ? n.ultimaCascataMs : null;
  const uc = objeto(n.ultimaCascata);
  const ultimaCascata =
    n.ultimaCascata && typeof uc.tempoMs === "number"
      ? { tempoMs: numero(uc.tempoMs, 0), entradaUs: numero(uc.entradaUs, 0), saidaUs: numero(uc.saidaUs, 0) }
      : null;
  return {
    lado,
    grade,
    calorU: numero(n.calorU, base.calorU),
    tempoAcimaDoLimiteMs: numero(n.tempoAcimaDoLimiteMs, base.tempoAcimaDoLimiteMs),
    scramRestanteMs,
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

const TIPOS_CONSTRUCAO: readonly TipoConstrucao[] = ["cataVento", "painelSolar", "turbinaEolica", "vila", "bateria", "subestacao"];

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
    if (!Number.isInteger(i) || i < 0 || i >= arq.n * arq.n || arq.terra[i] !== 1) continue;
    const c = objeto(valor);
    if (!ehTipoConstrucao(c.tipo)) continue;
    construcoes[i] = { tipo: c.tipo, nivel: inteiro(c.nivel, 0), colocadoEmMs: numero(c.colocadoEmMs, 0) };
  }

  const removidos = Array.isArray(m.removidos)
    ? Array.from(new Set(m.removidos.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < arq.n * arq.n && arq.obstaculos[i] !== 255)))
    : [];

  const remocoes: RemocaoEmCurso[] = Array.isArray(m.remocoes)
    ? m.remocoes
        .map((bruta) => {
          const r = objeto(bruta);
          const indice = inteiro(r.indice, -1);
          const tipoBruto = r.tipo;
          const valido =
            indice >= 0 &&
            indice < arq.n * arq.n &&
            arq.obstaculos[indice] !== 255 &&
            typeof tipoBruto === "string" &&
            (ORDEM_OBSTACULOS as readonly string[]).includes(tipoBruto);
          if (!valido) return null;
          return { indice, tipo: tipoBruto as TipoObstaculo, inicioMs: numero(r.inicioMs, 0), fimMs: numero(r.fimMs, 0) };
        })
        .filter((r): r is RemocaoEmCurso => r !== null)
    : [];

  const abertas = Array.isArray(m.ilhasAbertas) ? m.ilhasAbertas.filter(ehIlhaId) : [];
  const ilhasAbertas: IlhaId[] = [];
  for (const id of [...base.ilhasAbertas, ...abertas]) if (!ilhasAbertas.includes(id)) ilhasAbertas.push(id);
  // Cabos: ilha → nível. A migração v6 → v7 já converte a lista antiga; aqui só se sanitiza.
  const cabos: Partial<Record<IlhaId, number>> = {};
  for (const [chave, valor] of Object.entries(objeto(m.cabos))) {
    if (!ehIlhaId(chave) || chave === "principal") continue;
    cabos[chave] = inteiro(valor, 0);
  }

  return { construcoes, removidos, remocoes, ilhasAbertas, cabos };
}

function normalizarMelhorias(bruto: unknown): Melhorias {
  const base = melhoriasIniciais();
  const m = objeto(bruto);
  for (const id of Object.keys(MELHORIAS) as MelhoriaId[]) base[id] = booleano(m[id], false);
  return base;
}

/** Preenche campos ausentes com o estado inicial e sanitiza números. `agoraMs` vira o carimbo de saves sem `salvoEmMs`. */
function normalizar(bruto: Record<string, unknown>, agoraMs: number): GameState {
  const base = estadoInicial();
  const redeBruta = objeto(bruto.rede);
  const usinasBrutas = objeto(redeBruta.usinas);
  const bateriaBruta = objeto(redeBruta.bateria);

  const usinas = { ...base.rede.usinas };
  for (const id of IDS_USINA) {
    const u = objeto(usinasBrutas[id]);
    usinas[id] = { nivel: inteiro(u.nivel, base.rede.usinas[id].nivel) };
  }

  // As contagens são derivadas do mundo (GDD §2.1, v0.6): aqui só o nível e a carga.
  const rede: RedeState = { usinas, bateria: { kwh: numero(bateriaBruta.kwh, 0) } };

  return {
    versao: VERSAO_SAVE,
    tempoMs: numero(bruto.tempoMs, base.tempoMs),
    creditos: numero(bruto.creditos, base.creditos),
    pesquisa: numero(bruto.pesquisa, base.pesquisa),
    era: 1,
    rede,
    nucleo: normalizarNucleo(bruto.nucleo),
    melhorias: normalizarMelhorias(bruto.melhorias),
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
 * v6 → v7: o cabo submarino ganha nível (lista de ilhas → ilha: nível).
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
      vila: inteiro(redeBruta.vilas, 0),
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
    atual = { ...atual, mundo: { ...mundoBruto, cabos }, versao: 7 };
    v = 7;
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
