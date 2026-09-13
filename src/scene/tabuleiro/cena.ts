/**
 * Cena do arquipélago (v0.6): povoa o mapa a partir do estado do jogo — construções colocadas, obstáculos de
 * pé, peças do Núcleo, ilhas fechadas — e desenha tudo em ordem do pintor, com culling pelo viewport, LOD por
 * zoom e modo mapa. Também cuida dos callouts e das placas em px de tela, do alcance das subestações, do Bipe
 * de manutenção em remoção e dos efeitos da Cascata (flash, brasas, tremor, onda de choque).
 *
 * Coordenadas de mundo em `desenharCena` (a câmera já está aplicada); `desenharCallouts` desenha em px de tela
 * (transformação base). Nada de `Math.random`/`Date.now`: povoamento por `rnd(semente)`, animação pelo `t` (s).
 * No caminho quente nada é alocado: os objetos são mutados no lugar.
 */
import type { IlhaId, TipoObstaculo } from "../../content/era1-arquipelago";
import { indiceCasa, naPlataforma, type Arquipelago, type IlhaGerada } from "../../sim/arquipelago";
import type { TipoConstrucao } from "../../sim/state";
import { PALETA, alfa, centro, clamp01, corRampa, frac, iso, lodDe, movimentoReduzido, retArred, rnd, type Camera } from "./base";
import { desenharAlcance, type CaboCena } from "./mar";
import type { Reserva } from "./escalas";
import { ALTURAS, barraProgresso, desenharFeixe, desenharSprite, type EstadoSprite, type Feixe, type NomeSprite, type PapelBipe, type Teto } from "./sprites";
import { ELEV_PLAT } from "./terreno";

// ---------------------------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------------------------

export type TipoPecaCena = "receptor" | "heliostato" | "turbina" | "radiador" | "tanque" | "entulho";

/** Peça do Núcleo já convertida para a casa da plataforma na grade da ilha. */
export interface PecaCena {
  x: number;
  y: number;
  tipo: TipoPecaCena;
  anel: 1 | 2 | 3;
  /** entulho: remoção grátis (contorno `leaf`). */
  gratis?: boolean;
  /** entulho: `tempoMs` do jogo em que nasceu (pop de 250 ms). */
  desdeMs?: number;
}

export interface NucleoCena {
  lado: number;
  pecas: readonly PecaCena[];
  /** Temperatura 0..1,2. */
  T: number;
  scram: boolean;
  /** 0..1, velocidade das turbinas. */
  consumo: number;
  /** Rastreamento solar: varredura dos espelhos. */
  rastreamento: boolean;
}

export type AncoraCallout = "torre" | "grade" | "vento" | "vila";

export interface CalloutCena {
  chave: string;
  texto: string;
  ancora: AncoraCallout;
}

/** Placa de expedição de uma ilha fechada. */
export interface PlacaCena {
  ilha: IlhaId;
  nome: string;
  preco: string;
}

export interface RealceCena {
  x: number;
  y: number;
  valido: boolean;
  /** Motivo da recusa ou ressalva ("sem escoamento", "esteira −40 %"). */
  texto: string | null;
}

/** Uma construção colocada, já na casa do arquipélago. */
export interface ConstrucaoCena {
  x: number;
  y: number;
  tipo: TipoConstrucao;
  nivel: number;
  /** Usina que produz sem ter para onde escoar (GDD §7). */
  semEscoamento: boolean;
}

/** Um obstáculo ainda de pé (a montanha 2×2 vem uma vez, na casa noroeste). */
export interface ObstaculoCena {
  x: number;
  y: number;
  tipo: TipoObstaculo;
  /** 0..1 enquanto o Bipe de manutenção derruba; ausente fora da fila. */
  progresso?: number;
}

/** Casa de rocha com cristal (GDD §8.6, §9). */
export interface CristalCena {
  x: number;
  y: number;
}

/** Alcance de subestação a desenhar (ao passar o ponteiro ou com a ferramenta de subestação). */
export interface AlcanceCena {
  x: number;
  y: number;
  alcance: number;
  /** Teto cheio: o anel fica coral. */
  cheio: boolean;
}

export interface EntradaCena {
  arq: Arquipelago;
  semente: number;
  abertas: readonly IlhaId[];
  construcoes: readonly ConstrucaoCena[];
  obstaculos: readonly ObstaculoCena[];
  /** Casas de rocha com cristal abertas por montanhas dinamitadas (GDD §8.6, §9). */
  cristais: readonly CristalCena[];
  cabos: readonly CaboCena[];
  alcances: readonly AlcanceCena[];
  /** null = Núcleo ainda bloqueado: plataforma vazia. */
  nucleo: NucleoCena | null;
  /** Ilhas fechadas. */
  placas: readonly PlacaCena[];
  callouts: readonly CalloutCena[];
  /** 0..1 */
  bateriaCarga: number;
  /** Casa sob o ponteiro. */
  realce: RealceCena | null;
  /** Casa do obstáculo em remoção (o Bipe de manutenção vai até lá). */
  remocao: { x: number; y: number } | null;
  /** Tempo do jogo (para o pop do entulho). */
  tempoMs: number;
}

// ---------------------------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------------------------

interface Objeto {
  nome: NomeSprite;
  x: number;
  y: number;
  /** Ponto do chão em px de mundo (plataforma já elevada). */
  cx: number;
  cy: number;
  estado: EstadoSprite;
  /** Altura aproximada (px de mundo) só para o culling vertical. */
  alto: number;
  /** Ordem do pintor: x + y (com o jitter). */
  prof: number;
  /** Floresta em `longe`: some como sprite e entra na massa de copas. */
  massa: boolean;
  /** Modo mapa: vira um disco por cor-chave e o sprite não é desenhado. */
  mapa: boolean;
  /** entulho: o `t0` do pop ainda vai ser resolvido no primeiro frame (a partir de `desdeMs`). */
  popPendente: boolean;
  desdeMs: number;
}

interface GrupoMapa {
  cor: string;
  pts: Float32Array;
}

interface Telhado {
  x: number;
  y: number;
  cor: string;
}

interface Ancora {
  wx: number;
  wy: number;
  lado: 1 | -1;
  torre: boolean;
  /** Variante para o celular (palco < 600 px). */
  wxM?: number;
  wyM?: number;
  ladoM?: 1 | -1;
}

interface Callout {
  chave: string;
  texto: string;
  ancora: Ancora;
}

interface Placa {
  ilha: IlhaId;
  nome: string;
  preco: string;
  /** "preço · nome", montado fora do frame. */
  rotulo: string;
  estado: EstadoSprite;
  cx: number;
  cy: number;
}

interface Brasa {
  vx: number;
  vy: number;
  vida: number;
  seed: number;
}

export interface CascataCena {
  t0: number;
  brasas: Brasa[];
}

export interface Cena {
  /** Ponto do chão do Receptor (mundo, já com a elevação). */
  torre: [number, number];
  /** Centro da esfera (mundo). */
  esfera: [number, number];
  realce: RealceCena | null;
  /** Efeitos da Cascata em curso; null fora dela. */
  cascata: CascataCena | null;
  /** `prefers-reduced-motion` lido na criação: sem tremor, onda curta. */
  reduzido: boolean;
  // — interno: mantido por criarCena/atualizarCena, não mexer de fora —
  arq: Arquipelago;
  semente: number;
  tempoMs: number;
  casaOperador: [number, number];
  obstaculos: Objeto[];
  obstaculosRef: readonly ObstaculoCena[] | null;
  cristais: Objeto[];
  cristaisRef: readonly CristalCena[] | null;
  bloqueio: Objeto[];
  rede: Objeto[];
  nucleo: Objeto[];
  /** Cabos e alcances do frame (desenhados antes dos objetos). */
  cabos: readonly CaboCena[];
  alcances: readonly AlcanceCena[];
  /** Bipe de manutenção: objeto único que anda até o obstáculo em remoção. */
  manutencao: Objeto | null;
  /** Todos os grupos em ordem do pintor. */
  objetos: Objeto[];
  pecasRef: readonly PecaCena[] | null;
  /** Paralelo a `pecasRef`. */
  pecaObjetos: Objeto[];
  construcoesRef: readonly ConstrucaoCena[] | null;
  /** Paralelo a `construcoesRef`. */
  redeObjetos: Objeto[];
  placasRef: readonly PlacaCena[] | null;
  placas: Placa[];
  receptor: EstadoSprite | null;
  operador: EstadoSprite | null;
  feixes: Feixe[];
  mapa: GrupoMapa[];
  mapaFantasma: GrupoMapa[];
  telhados: Telhado[];
  massaEsc: Path2D;
  massaClara: Path2D;
  ancoras: Record<AncoraCallout, Ancora>;
  callouts: Callout[];
}

// ---------------------------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------------------------

const TAU = Math.PI * 2;
const ELEV = ELEV_PLAT;
/** Modo mapa abaixo deste zoom (sub-regra interna de `longe`). */
const ZOOM_MAPA = 0.22;
/** Duração total dos efeitos da Cascata (a brasa mais longa vive 1,5 s). */
const DUR_CASCATA = 1.6;
/** Raio (mundo, eixo x; o y conta dobrado) do hit-test das placas. */
const RAIO_PLACA = 80;
const MAX_LARGURAS = 512;

/** Paleta local (direção §2): ajustes entram aqui, nunca em base.ts. */
const P = {
  ...PALETA,
  pa: "#f7f9ff",
  painel: "#2d4bd9",
  copa: "#3fb36a",
  copa2: "#2f9c60",
  radiadorAleta: "#aeb6e6",
  vilaParede2: "#cdbf9e",
} as const;

/** Altura aproximada (px de mundo acima do chão) por sprite: só para o culling vertical. */
const ALTO: Partial<Record<NomeSprite, number>> = {
  receptor: 170,
  turbinaEolica: 130,
  heliostato: 40,
  turbinaVapor: 72,
  tanque: 44,
  radiador: 36,
  cataVento: 54,
  painelSolar: 30,
  casaVila: 50,
  bateria: 36,
  laboratorio: 46,
  universidade: 58,
  arvore: 50,
  pinheiro: 54,
  arbusto: 20,
  pedra: 16,
  cristal: 32,
  placaBloqueio: 70,
  bipe: 52,
  entulho: 14,
};

/** Cor-chave do modo mapa: cada objeto vira um disco de 2 px de tela. Quem não está aqui (torre, placa, cristal) continua sprite. */
const CHAVE: Partial<Record<NomeSprite, string>> = {
  cataVento: P.pa,
  turbinaEolica: P.pa,
  painelSolar: P.painel,
  bateria: P.leaf,
  arvore: P.copa,
  pinheiro: P.copa,
  arbusto: P.copa,
  pedra: P.rocha,
  heliostato: P.sky,
  turbinaVapor: P.sun,
  tanque: P.tanque,
  radiador: P.radiadorAleta,
  entulho: P.entulho,
  laboratorio: P.sky,
  universidade: P.sun,
};
const COR_BIPE: Record<PapelBipe, string> = { operador: P.sky, manutencao: P.leaf, cientista: P.sun };
const TETOS: Record<Teto, string> = { coral: P.coral, sun: P.sun, sky: P.sky };
const CICLO_TETOS: readonly Teto[] = ["coral", "sun", "sky"];

const FONTE = (px: number): string => `600 ${px}px Outfit, "Segoe UI", system-ui, sans-serif`;
const FONTE_CALLOUT = FONTE(13);
const FONTE_PLACA = FONTE(12);
const FONTE_COMPACTA = FONTE(11);
const FONTE_MOEDA = FONTE(9);
const COR_GUIA = alfa(P.muted, 0.8);
const COR_PILULA = alfa(P.card, 0.9);
const COR_CAIXA = alfa(P.card, 0.85);

// Rampa de calor com cache por centésimo (0..1,2): nada de misturar() por frame.
const rampaCache: (string | undefined)[] = [];
function rampa(T: number): string {
  const i = Math.max(0, Math.min(120, Math.round(T * 100)));
  return rampaCache[i] ?? (rampaCache[i] = corRampa(i / 100));
}

// ---------------------------------------------------------------------------------------------
// Utilidades de grade
// ---------------------------------------------------------------------------------------------

const cheb = (a: readonly [number, number], b: readonly [number, number]): number => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));

function ilhaPorId(arq: Arquipelago, id: IlhaId): IlhaGerada | undefined {
  return arq.ilhas.find((i) => i.id === id);
}

/** Terra sem caminho, fora da plataforma e sem objeto. */
function casaLivre(arq: Arquipelago, ocup: Uint8Array, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= arq.n || y >= arq.n) return false;
  const i = indiceCasa(arq.n, x, y);
  return arq.terra[i] === 1 && arq.caminho[i] === 0 && ocup[i] === 0 && !naPlataforma(arq.plataforma, x, y);
}

/** Casa do Bipe operador: encostada na aresta frontal-esquerda da plataforma, fora dela. */
function casaDoOperador(arq: Arquipelago, ocup: Uint8Array): [number, number] {
  const { x0, y0, lado, meio } = arq.plataforma;
  const cand: [number, number][] = [
    [meio - 1, y0 + lado],
    [meio, y0 + lado],
    [meio - 2, y0 + lado],
    [x0 + lado, meio + 1],
    [x0 + lado, meio],
    [x0 - 1, meio + 1],
  ];
  for (const [x, y] of cand) if (casaLivre(arq, ocup, x, y)) return [x, y];
  return cand[0];
}

function novoObjeto(arq: Arquipelago, nome: NomeSprite, x: number, y: number, estado: EstadoSprite, jx = 0, jy = 0): Objeto {
  const c = centro(x + jx, y + jy);
  const cy = naPlataforma(arq.plataforma, x, y) ? c[1] - ELEV : c[1];
  return { nome, x, y, cx: c[0], cy, estado, alto: ALTO[nome] ?? 40, prof: x + y + jx + jy, massa: false, mapa: false, popPendente: false, desdeMs: 0 };
}

// ---------------------------------------------------------------------------------------------
// Povoamento: obstáculos, ilhas fechadas, construções e Núcleo
// ---------------------------------------------------------------------------------------------

const SPRITE_OBSTACULO: Record<TipoObstaculo, NomeSprite> = {
  arbusto: "arbusto",
  arvore: "arvore",
  pedra: "pedra",
  pantano: "pantano",
  montanha: "montanha",
  pico: "pico",
};

const SPRITE_CONSTRUCAO: Record<TipoConstrucao, NomeSprite> = {
  cataVento: "cataVento",
  turbinaEolica: "turbinaEolica",
  painelSolar: "painelSolar",
  bairro: "casaVila",
  bateria: "bateria",
  subestacao: "subestacao",
  laboratorio: "laboratorio",
  universidade: "universidade",
};

/** Um cristal por casa aberta por montanha dinamitada. */
function construirCristais(cena: Cena, cristais: readonly CristalCena[]): void {
  const { arq, semente } = cena;
  const r = rnd((semente >>> 0) * 181 + 7);
  cena.cristais = cristais.map((c) => novoObjeto(arq, "cristal", c.x, c.y, { lod: "perto", escala: 0.55 + r() * 0.25, fase: r() }));
  cena.cristaisRef = cristais;
}

/** Um sprite por obstáculo de pé. Árvores viram massa de copas em `longe`; a montanha ocupa 2×2. */
function construirObstaculos(cena: Cena, obstaculos: readonly ObstaculoCena[]): void {
  const { arq, semente } = cena;
  const r = rnd((semente >>> 0) * 97 + 13);
  const objetos: Objeto[] = [];
  for (const o of obstaculos) {
    const nome = SPRITE_OBSTACULO[o.tipo];
    const estado: EstadoSprite = { lod: "perto", variante: Math.floor(r() * 3), escala: o.tipo === "arvore" ? 0.8 + r() * 0.5 : 1, fase: r() };
    if (o.progresso !== undefined) estado.progresso = o.progresso;
    const jx = o.tipo === "arvore" || o.tipo === "arbusto" ? (r() - 0.5) * 0.4 : 0;
    const jy = o.tipo === "arvore" || o.tipo === "arbusto" ? (r() - 0.5) * 0.4 : 0;
    const obj = novoObjeto(arq, nome, o.x, o.y, estado, jx, jy);
    obj.massa = o.tipo === "arvore" || o.tipo === "arbusto";
    objetos.push(obj);
  }
  cena.obstaculos = objetos;
  cena.obstaculosRef = obstaculos;
  const [esc, clara] = construirMassa(objetos);
  cena.massaEsc = esc;
  cena.massaClara = clara;
}

/** Ilhas fechadas: placa de expedição no centro + 6 cata-ventos fantasmas em casas livres da própria ilha. */
function construirBloqueio(cena: Cena, placas: readonly PlacaCena[]): void {
  const { arq, semente } = cena;
  const objetos: Objeto[] = [];
  const lista: Placa[] = [];
  placas.forEach((pl, k) => {
    const ilha = ilhaPorId(arq, pl.ilha);
    if (!ilha) return;
    const estado: EstadoSprite = { lod: "perto", preco: pl.preco, nome: pl.nome };
    const o = novoObjeto(arq, "placaBloqueio", ilha.centro[0], ilha.centro[1], estado);
    objetos.push(o);
    lista.push({ ilha: pl.ilha, nome: pl.nome, preco: pl.preco, rotulo: `${pl.preco} · ${pl.nome}`, estado, cx: o.cx, cy: o.cy });
    const r = rnd((semente >>> 0) * 53 + k + 1);
    const nome: NomeSprite = k % 2 ? "painelSolar" : "cataVento";
    let postos = 0;
    for (const i of ilha.casas) {
      if (postos >= 6) break;
      const x = i % arq.n;
      const y = Math.floor(i / arq.n);
      if (arq.obstaculos[i] !== 255 || arq.distBorda[i] < 2) continue;
      if (cheb([x, y], ilha.centro) < 2 || (x + y) % 3 !== 0) continue;
      objetos.push(novoObjeto(arq, nome, x, y, { lod: "perto", fase: r(), vel: 0.3, fantasma: true }));
      postos++;
    }
  });
  cena.bloqueio = objetos;
  cena.placas = lista;
  cena.placasRef = placas;
}

/** Um sprite por construção colocada, com fase e variante determinísticas pela casa. */
function construirRede(cena: Cena, construcoes: readonly ConstrucaoCena[], carga: number): void {
  const { arq, semente } = cena;
  const objetos: Objeto[] = [];
  let nVila = 0;
  for (const c of construcoes) {
    const r = rnd((semente >>> 0) * 131 + indiceCasa(arq.n, c.x, c.y) + 1);
    const estado: EstadoSprite = { lod: "perto" };
    switch (c.tipo) {
      case "cataVento":
        estado.fase = r();
        estado.vel = 0.7 + r() * 0.5;
        break;
      case "turbinaEolica":
        estado.fase = r();
        estado.vel = 0.9;
        break;
      case "bairro":
        estado.teto = CICLO_TETOS[nVila++ % 3];
        estado.variante = Math.floor(r() * 3);
        estado.densidade = c.nivel + 1;
        break;
      case "bateria":
        estado.carga = carga;
        break;
      case "subestacao":
        estado.nivel = c.nivel;
        break;
      default:
        break;
    }
    estado.semEscoamento = c.semEscoamento;
    objetos.push(novoObjeto(arq, SPRITE_CONSTRUCAO[c.tipo], c.x, c.y, estado));
  }
  cena.rede = objetos;
  cena.redeObjetos = objetos;
  cena.construcoesRef = construcoes;
}

/** Peças do Núcleo nas casas da plataforma, feixes dos espelhos e o Bipe operador ao lado da plataforma. */
function construirNucleo(cena: Cena, nu: NucleoCena | null): void {
  const { arq } = cena;
  const objetos: Objeto[] = [];
  const pecaObjetos: Objeto[] = [];
  const feixes: Feixe[] = [];
  cena.receptor = null;
  cena.operador = null;
  if (nu) {
    let k = 0;
    for (const p of nu.pecas) {
      let o: Objeto;
      switch (p.tipo) {
        case "receptor":
          o = novoObjeto(arq, "receptor", p.x, p.y, { lod: "perto", T: nu.T, scram: nu.scram });
          cena.receptor = o.estado;
          break;
        case "heliostato":
          // fases bem distintas entre espelhos: a varredura de rastreamento não sincroniza
          o = novoObjeto(arq, "heliostato", p.x, p.y, { lod: "perto", anel: p.anel, alvo: cena.torre, rastreamento: nu.rastreamento, fase: k * 1.17 });
          k++;
          break;
        case "turbina":
          o = novoObjeto(arq, "turbinaVapor", p.x, p.y, { lod: "perto", consumo: nu.consumo, scram: nu.scram });
          break;
        case "radiador":
          o = novoObjeto(arq, "radiador", p.x, p.y, { lod: "perto", atividade: nu.T });
          break;
        case "tanque":
          o = novoObjeto(arq, "tanque", p.x, p.y, { lod: "perto", nivel: nu.T });
          break;
        case "entulho":
          o = novoObjeto(arq, "entulho", p.x, p.y, { lod: "perto", gratis: p.gratis });
          o.popPendente = p.desdeMs !== undefined;
          o.desdeMs = p.desdeMs ?? 0;
          break;
      }
      objetos.push(o);
      pecaObjetos.push(o);
    }
    let j = 0;
    for (const o of objetos) {
      if (o.nome !== "heliostato") continue;
      feixes.push({ de: [o.cx, o.cy], para: cena.torre, forca: 0.9, fase: j / k, lod: "perto", zoom: 1 });
      j++;
    }
    const [ox, oy] = cena.casaOperador;
    const op = novoObjeto(arq, "bipe", ox, oy, { lod: "perto", papel: "operador", expressao: "apontando", fase: 0.2 });
    objetos.push(op);
    cena.operador = op.estado;
  }
  cena.nucleo = objetos;
  cena.pecaObjetos = pecaObjetos;
  cena.feixes = feixes;
  cena.pecasRef = nu ? nu.pecas : null;
}

/** Junta os grupos em ordem do pintor (x + y, y, x) e refaz os discos do modo mapa. */
function montar(cena: Cena): void {
  const objetos = cena.obstaculos.concat(cena.cristais, cena.bloqueio, cena.rede, cena.nucleo, cena.manutencao ? [cena.manutencao] : []);
  objetos.sort((a, b) => a.prof - b.prof || a.y - b.y || a.x - b.x);
  cena.objetos = objetos;
  const grupos = new Map<string, number[]>();
  const gruposFantasma = new Map<string, number[]>();
  const telhados: Telhado[] = [];
  for (const o of objetos) {
    o.mapa = false;
    if (o.nome === "casaVila") {
      telhados.push({ x: o.cx, y: o.cy - 4, cor: TETOS[o.estado.teto ?? "coral"] });
      o.mapa = true;
      continue;
    }
    const cor = o.nome === "bipe" ? COR_BIPE[o.estado.papel ?? "operador"] : CHAVE[o.nome];
    if (!cor) continue;
    const g = o.estado.fantasma ? gruposFantasma : grupos;
    let pts = g.get(cor);
    if (!pts) {
      pts = [];
      g.set(cor, pts);
    }
    pts.push(o.cx, o.cy);
    o.mapa = true;
  }
  const empacotar = (g: Map<string, number[]>): GrupoMapa[] => [...g].map(([cor, pts]) => ({ cor, pts: Float32Array.from(pts) }));
  cena.mapa = empacotar(grupos);
  cena.mapaFantasma = empacotar(gruposFantasma);
  cena.telhados = telhados;
}

/** Floresta em `longe`: massa de copas (manchas cobrindo 2–3 casas), sem troncos. Só do cenário: montada uma vez. */
function construirMassa(cenario: readonly Objeto[]): [Path2D, Path2D] {
  const esc = new Path2D();
  const clara = new Path2D();
  for (const o of cenario) {
    if (!o.massa) continue;
    const e = o.estado.escala ?? 1;
    const r = (o.nome === "arbusto" ? 14 : 22) * e;
    esc.moveTo(o.cx + r, o.cy - 6);
    esc.arc(o.cx, o.cy - 6, r, 0, TAU);
    clara.moveTo(o.cx - 4 + r * 0.75, o.cy - 12);
    clara.arc(o.cx - 4, o.cy - 12, r * 0.75, 0, TAU);
  }
  return [esc, clara];
}

/**
 * Âncoras dos callouts em mundo: Torre (esfera), Grade (vértice frontal; no celular o esquerdo),
 * Vento (centro da ilha principal projetado para fora da plataforma) e Vila (praça dos caminhos).
 */
function construirAncoras(arq: Arquipelago, torre: [number, number], esfera: [number, number]): Record<AncoraCallout, Ancora> {
  const { x0, y0, lado } = arq.plataforma;
  const e = iso(x0 + lado, y0 + lado);
  const m = iso(x0, y0 + lado);
  const grade: Ancora = { wx: e[0], wy: e[1] - ELEV + 4, lado: 1, torre: false, wxM: m[0] + 6, wyM: m[1] - ELEV - 2, ladoM: 1 };

  const principal = arq.ilhas[0];
  const cv = centro(principal.centro[0], principal.centro[1]);
  const vento: Ancora = { wx: cv[0], wy: cv[1] - 24, lado: cv[0] >= torre[0] ? 1 : -1, torre: false };

  // praça: a casa de caminho mais perto do centro da plataforma
  let praca: [number, number] = [arq.plataforma.meio, arq.plataforma.meio];
  let dm = Infinity;
  for (let i = 0; i < arq.n * arq.n; i++) {
    if (arq.caminho[i] !== 1) continue;
    const x = i % arq.n;
    const y = Math.floor(i / arq.n);
    const d = Math.hypot(x - arq.plataforma.meio, y - arq.plataforma.meio);
    if (d < dm) {
      dm = d;
      praca = [x, y];
    }
  }
  const pv = centro(praca[0], praca[1]);
  return {
    torre: { wx: esfera[0] + 10, wy: esfera[1] - 14, lado: 1, torre: true },
    grade,
    vento,
    vila: { wx: pv[0], wy: pv[1] - 24, lado: 1, torre: false },
  };
}

// ---------------------------------------------------------------------------------------------
// Comparações baratas (sem alocar) para saber o que refazer em `atualizarCena`
// ---------------------------------------------------------------------------------------------

function mesmasPecas(a: readonly PecaCena[] | null, b: readonly PecaCena[] | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    const q = b[i];
    if (p.x !== q.x || p.y !== q.y || p.tipo !== q.tipo || p.anel !== q.anel) return false;
  }
  return true;
}

function mesmasConstrucoes(a: readonly ConstrucaoCena[] | null, b: readonly ConstrucaoCena[]): boolean {
  if (a === b) return true;
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    const q = b[i];
    if (p.x !== q.x || p.y !== q.y || p.tipo !== q.tipo) return false;
  }
  return true;
}

function mesmosObstaculos(a: readonly ObstaculoCena[] | null, b: readonly ObstaculoCena[]): boolean {
  if (a === b) return true;
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].x !== b[i].x || a[i].y !== b[i].y || a[i].tipo !== b[i].tipo) return false;
  }
  return true;
}

function mesmosCristais(a: readonly CristalCena[] | null, b: readonly CristalCena[]): boolean {
  if (a === b) return true;
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
  return true;
}

function mesmasPlacas(a: readonly PlacaCena[] | null, b: readonly PlacaCena[]): boolean {
  if (a === b) return true;
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i].ilha !== b[i].ilha) return false;
  return true;
}

// ---------------------------------------------------------------------------------------------
// API: criar, atualizar
// ---------------------------------------------------------------------------------------------

/** Povoamento completo. Chamar quando a estrutura muda (arquipélago, semente). */
export function criarCena(entrada: EntradaCena): Cena {
  const { arq, semente } = entrada;
  const { meio } = arq.plataforma;
  const rc = centro(meio, meio);
  const torre: [number, number] = [rc[0], rc[1] - ELEV];
  const esfera: [number, number] = [torre[0], torre[1] - ALTURAS.esfera];

  const ocup = new Uint8Array(arq.n * arq.n);
  const casaOperador = casaDoOperador(arq, ocup);

  const cena: Cena = {
    torre,
    esfera,
    realce: null,
    cascata: null,
    reduzido: movimentoReduzido(),
    arq,
    semente,
    tempoMs: entrada.tempoMs,
    casaOperador,
    obstaculos: [],
    obstaculosRef: null,
    cristais: [],
    cristaisRef: null,
    bloqueio: [],
    rede: [],
    nucleo: [],
    cabos: [],
    alcances: [],
    manutencao: null,
    objetos: [],
    pecasRef: null,
    pecaObjetos: [],
    construcoesRef: null,
    redeObjetos: [],
    placasRef: null,
    placas: [],
    receptor: null,
    operador: null,
    feixes: [],
    mapa: [],
    mapaFantasma: [],
    telhados: [],
    massaEsc: new Path2D(),
    massaClara: new Path2D(),
    ancoras: construirAncoras(arq, torre, esfera),
    callouts: [],
  };
  atualizarCena(cena, entrada);
  return cena;
}

/**
 * Barato, a cada frame: T, scram, consumo, rastreamento, nível dos tanques, carga, realce, textos dos callouts
 * e entulhos. Refaz só o grupo afetado (Rede, Núcleo ou bloqueio) quando a estrutura dele muda.
 */
export function atualizarCena(cena: Cena, entrada: EntradaCena): void {
  cena.tempoMs = entrada.tempoMs;
  cena.realce = entrada.realce;
  const nu = entrada.nucleo;
  let remontar = false;

  if (!mesmasPlacas(cena.placasRef, entrada.placas)) {
    construirBloqueio(cena, entrada.placas);
    remontar = true;
  } else {
    for (let i = 0; i < cena.placas.length; i++) {
      const pl = cena.placas[i];
      const e = entrada.placas[i];
      if (pl.nome !== e.nome || pl.preco !== e.preco) {
        pl.nome = e.nome;
        pl.preco = e.preco;
        pl.rotulo = `${e.preco} · ${e.nome}`;
        pl.estado.nome = e.nome;
        pl.estado.preco = e.preco;
      }
    }
    cena.placasRef = entrada.placas;
  }
  if (!mesmasPecas(cena.pecasRef, nu ? nu.pecas : null)) {
    construirNucleo(cena, nu);
    remontar = true;
  } else {
    cena.pecasRef = nu ? nu.pecas : null;
  }
  if (!mesmasConstrucoes(cena.construcoesRef, entrada.construcoes)) {
    construirRede(cena, entrada.construcoes, entrada.bateriaCarga);
    remontar = true;
  } else {
    cena.construcoesRef = entrada.construcoes;
  }
  if (!mesmosCristais(cena.cristaisRef, entrada.cristais)) {
    construirCristais(cena, entrada.cristais);
    remontar = true;
  } else {
    cena.cristaisRef = entrada.cristais;
  }
  if (!mesmosObstaculos(cena.obstaculosRef, entrada.obstaculos)) {
    construirObstaculos(cena, entrada.obstaculos);
    remontar = true;
  } else {
    cena.obstaculosRef = entrada.obstaculos;
    // a barra de tempo muda todo frame
    for (let i = 0; i < entrada.obstaculos.length; i++) cena.obstaculos[i].estado.progresso = entrada.obstaculos[i].progresso;
  }

  // --- Bipe de manutenção: existe enquanto houver remoção em curso, na casa do obstáculo
  const rem = entrada.remocao;
  if (!rem) {
    if (cena.manutencao) {
      cena.manutencao = null;
      remontar = true;
    }
  } else if (!cena.manutencao || cena.manutencao.x !== rem.x || cena.manutencao.y !== rem.y) {
    cena.manutencao = novoObjeto(cena.arq, "bipe", rem.x, rem.y, { lod: "perto", papel: "manutencao", expressao: "apontando", fase: 0.4 }, 0.55, 0.55);
    remontar = true;
  }

  cena.cabos = entrada.cabos;
  cena.alcances = entrada.alcances;
  if (remontar) montar(cena);

  // --- Núcleo: estado dinâmico por peça
  if (nu) {
    const pecas = nu.pecas;
    for (let i = 0; i < pecas.length; i++) {
      const p = pecas[i];
      const e = cena.pecaObjetos[i].estado;
      switch (p.tipo) {
        case "receptor":
          e.T = nu.T;
          e.scram = nu.scram;
          break;
        case "heliostato":
          e.rastreamento = nu.rastreamento;
          break;
        case "turbina":
          e.consumo = nu.consumo;
          e.scram = nu.scram;
          break;
        case "radiador":
          e.atividade = nu.T;
          break;
        case "tanque":
          e.nivel = nu.T;
          break;
        case "entulho":
          e.gratis = p.gratis;
          break;
      }
    }
    if (cena.operador) cena.operador.expressao = nu.scram || cena.cascata ? "alarmado" : "apontando";
  }

  // --- Rede: carga das baterias, nível das subestações e marca de "sem escoamento"
  const construcoes = entrada.construcoes;
  for (let i = 0; i < construcoes.length; i++) {
    const c = construcoes[i];
    const e = cena.redeObjetos[i].estado;
    if (c.tipo === "bateria") e.carga = entrada.bateriaCarga;
    if (c.tipo === "subestacao") e.nivel = c.nivel;
    e.semEscoamento = c.semEscoamento;
  }

  // --- callouts: textos no lugar; lista refeita só se as chaves/âncoras mudarem
  const lista = entrada.callouts;
  const atual = cena.callouts;
  let iguais = atual.length === lista.length;
  if (iguais) {
    for (let i = 0; i < lista.length; i++) {
      if (atual[i].chave !== lista[i].chave || atual[i].ancora !== cena.ancoras[lista[i].ancora]) {
        iguais = false;
        break;
      }
    }
  }
  if (iguais) {
    for (let i = 0; i < lista.length; i++) atual[i].texto = lista[i].texto;
  } else {
    cena.callouts = lista.map((c) => ({ chave: c.chave, texto: c.texto, ancora: cena.ancoras[c.ancora] }));
  }
}

// ---------------------------------------------------------------------------------------------
// Cascata: flash, 12 brasas, tremor, onda de choque (o entulho chega pelo sim em `pecas`)
// ---------------------------------------------------------------------------------------------

/** Dispara os efeitos da Cascata em `t0` (s do relógio de animação). */
export function dispararCascata(cena: Cena, t0: number): void {
  const r = rnd((cena.semente >>> 0) * 31 + 7);
  const brasas: Brasa[] = [];
  // 12 brasas num leque simétrico −π/2 ± 1,2 rad, vy inicial ≈ −120 px/s
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + (-1.2 + (2.4 * i) / 11) + (r() - 0.5) * 0.12;
    const v = 110 + r() * 70;
    brasas.push({ vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, vida: 1 + r() * 0.5, seed: r() });
  }
  cena.cascata = { t0, brasas };
  if (cena.operador) cena.operador.expressao = "alarmado";
}

const TREMOR: [number, number] = [0, 0];

/** Tremor de 300 ms (±3 px de tela) após a Cascata; zero com movimento reduzido. Devolve uma tupla compartilhada. */
export function tremorCena(cena: Cena, t: number): [number, number] {
  TREMOR[0] = 0;
  TREMOR[1] = 0;
  if (!cena.cascata || cena.reduzido) return TREMOR;
  const dt = t - cena.cascata.t0;
  if (dt < 0 || dt > 0.3) return TREMOR;
  const amp = 3 * (1 - dt / 0.3);
  TREMOR[0] = amp * Math.sin(dt * 97);
  TREMOR[1] = amp * Math.cos(dt * 131);
  return TREMOR;
}

/** Placa de local bloqueado sob o ponto de mundo (wx, wy), com raio generoso; a mais próxima se houver mais de uma. */
export function placaEm(cena: Cena, wx: number, wy: number): IlhaId | null {
  let melhor: IlhaId | null = null;
  let dm = RAIO_PLACA;
  for (const pl of cena.placas) {
    const d = Math.hypot(wx - pl.cx, (wy - (pl.cy - 8)) * 2);
    if (d <= dm) {
      dm = d;
      melhor = pl.ilha;
    }
  }
  return melhor;
}

// ---------------------------------------------------------------------------------------------
// Desenho do mundo (câmera já aplicada)
// ---------------------------------------------------------------------------------------------

const PART: EstadoSprite = { lod: "perto", vida: 1, cor: P.sun, seed: 0 };
const BRASA: EstadoSprite = { lod: "perto", vida: 1, seed: 0 };
const REALCE_PLAT: EstadoSprite = { lod: "perto", anel: 2, realce: "valido" };

export function desenharCena(ctx: CanvasRenderingContext2D, cena: Cena, cam: Camera, t: number): void {
  const z = cam.zoom || 1;
  const lod = lodDe(z);
  const perto = lod === "perto";
  const mapa = z < ZOOM_MAPA;
  const vx0 = -cam.tx / z - 80;
  const vy0 = -cam.ty / z - 40;
  const vx1 = (cam.w - cam.tx) / z + 80;
  const vy1 = (cam.h - cam.ty) / z + 40;
  const scram = cena.receptor?.scram === true;
  let cas = cena.cascata;
  let dtc = cas ? t - cas.t0 : -1;
  if (cas && dtc > DUR_CASCATA) {
    cena.cascata = null;
    cas = null;
    dtc = -1;
    if (cena.operador) cena.operador.expressao = scram ? "alarmado" : "apontando";
  }
  const { x0, y0, lado, meio } = cena.arq.plataforma;
  ctx.save();
  ctx.lineJoin = "round";

  // 1. realce da casa sob o ponteiro (chão): na plataforma usa a casa do Núcleo; fora dela, um losango
  const re = cena.realce;
  if (re && !mapa) {
    const naPlat = re.x >= x0 && re.x < x0 + lado && re.y >= y0 && re.y < y0 + lado;
    const c = centro(re.x, re.y);
    if (naPlat) {
      const a = Math.max(Math.abs(re.x - meio), Math.abs(re.y - meio)) + 1;
      REALCE_PLAT.anel = a <= 1 ? 1 : a === 2 ? 2 : 3;
      REALCE_PLAT.realce = re.valido ? "valido" : "invalido";
      REALCE_PLAT.lod = lod;
      desenharSprite("casaNucleo", ctx, c[0], c[1] - ELEV, 1, REALCE_PLAT, t);
    } else {
      const cor = re.valido ? P.leaf : P.coral;
      ctx.save();
      ctx.translate(c[0], c[1]);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = alfa(cor, 0.25);
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(32, 0);
      ctx.lineTo(0, 16);
      ctx.lineTo(-32, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = cor;
      ctx.lineWidth = 2 / z;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  // 1b. alcance das subestações selecionadas (sob os objetos)
  if (!mapa) for (const a of cena.alcances) desenharAlcance(ctx, a.x, a.y, a.alcance, cam, a.cheio);

  // 2. feixes (antes dos objetos; apagados no SCRAM)
  if (cena.receptor && !scram) {
    for (let i = 0; i < cena.feixes.length; i++) {
      const f = cena.feixes[i];
      f.lod = lod;
      f.zoom = z;
      desenharFeixe(ctx, f, t);
    }
  }

  // 3. floresta em longe: massa de copas (duas camadas); as árvores individuais só em perto
  if (!perto) {
    ctx.fillStyle = P.copa2;
    ctx.fill(cena.massaEsc);
    ctx.fillStyle = P.copa;
    ctx.fill(cena.massaClara);
  }

  // 4. modo mapa: discos de 2 px de tela por cor-chave; fantasmas em α .35; a vila = telhados de 2,5 px com 1 px de parede
  if (mapa) {
    const r = 2 / z;
    desenharDiscos(ctx, cena.mapa, r, vx0, vy0, vx1, vy1);
    ctx.globalAlpha = 0.35;
    desenharDiscos(ctx, cena.mapaFantasma, r, vx0, vy0, vx1, vy1);
    ctx.globalAlpha = 1;
    const telhados = cena.telhados;
    if (telhados.length) {
      const rt = 2.5 / z;
      ctx.fillStyle = P.vilaParede2;
      ctx.beginPath();
      for (let i = 0; i < telhados.length; i++) {
        const th = telhados[i];
        ctx.moveTo(th.x + rt, th.y + 1 / z);
        ctx.arc(th.x, th.y + 1 / z, rt, 0, TAU);
      }
      ctx.fill();
      for (let i = 0; i < telhados.length; i++) {
        const th = telhados[i];
        ctx.fillStyle = th.cor;
        ctx.beginPath();
        ctx.arc(th.x, th.y, rt, 0, TAU);
        ctx.fill();
      }
    }
  }

  // 5. objetos em ordem do pintor, com culling pelo viewport e altura por sprite
  const objs = cena.objetos;
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i];
    if (mapa && o.mapa) continue;
    if (!perto && o.massa) continue;
    if (o.cx < vx0 || o.cx > vx1 || o.cy + 20 < vy0 || o.cy - o.alto > vy1) continue;
    if (o.popPendente) {
      // pop resolvido no primeiro frame: idade em s desde o nascimento no relógio do jogo, +150 ms depois do flash
      const idade = Math.max(0, (cena.tempoMs - o.desdeMs) / 1000);
      o.estado.t0 = t - idade + 0.15;
      o.popPendente = false;
    }
    o.estado.lod = lod;
    o.estado.zoom = z;
    desenharSprite(o.nome, ctx, o.cx, o.cy, 1, o.estado, t);
    // barra de tempo do obstáculo em remoção (o Bipe de manutenção está ao lado)
    if (perto && o.estado.progresso !== undefined) {
      ctx.save();
      ctx.translate(o.cx, o.cy);
      barraProgresso(ctx, 0, -o.alto - 16, 40, o.estado.progresso);
      ctx.restore();
    }
    // marca de "sem escoamento" (GDD §7): um alerta coral pulsando acima da usina
    if (perto && o.estado.semEscoamento) {
      const py = o.cy - o.alto - 10;
      ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 3);
      ctx.fillStyle = P.coral;
      ctx.beginPath();
      ctx.arc(o.cx, py, 7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = P.navy;
      ctx.beginPath();
      ctx.rect(o.cx - 1, py - 4, 2, 5);
      ctx.rect(o.cx - 1, py + 2, 2, 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // 6. partículas de calor sobre a esfera, quantidade ∝ T (só perto, fora do SCRAM)
  const ex = cena.esfera[0];
  const ey = cena.esfera[1];
  if (perto && cena.receptor && !scram && ex > vx0 && ex < vx1 && ey > vy0 && ey < vy1) {
    const T = cena.receptor.T ?? 0;
    const n = Math.ceil(6 * clamp01(T));
    PART.cor = rampa(T);
    PART.lod = lod;
    for (let i = 0; i < n; i++) {
      PART.vida = 1 - frac(t * 0.35 + i / 6);
      PART.seed = i * 1.7;
      desenharSprite("particula", ctx, ex + 10 * Math.sin(i * 2.1), ey - 16, 1, PART, t);
    }
  }

  // 7. Cascata: flash, onda de choque (px de tela), brasas
  if (cas && dtc >= 0) {
    if (dtc < 0.12) {
      const k = dtc / 0.12;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.9 * (1 - k);
      ctx.fillStyle = P.ink;
      ctx.beginPath();
      ctx.arc(ex, ey, 16 + 44 * k, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
    const durOnda = cena.reduzido ? 0.2 : 0.7;
    if (dtc < durOnda) {
      const k = dtc / durOnda;
      const esc = Math.min(z, 1);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = P.coral;
      ctx.lineWidth = (6 * (1 - k) + 3) / esc;
      ctx.beginPath();
      ctx.arc(ex, ey, 220 * k, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.6 * (1 - k);
      ctx.strokeStyle = P.ink;
      ctx.lineWidth = 2 / esc;
      ctx.beginPath();
      ctx.arc(ex, ey, 220 * k * 0.8, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
    BRASA.lod = lod;
    const brasas = cas.brasas;
    for (let i = 0; i < brasas.length; i++) {
      const b = brasas[i];
      if (dtc >= b.vida) continue;
      BRASA.vida = 1 - dtc / b.vida;
      BRASA.seed = b.seed;
      desenharSprite("brasa", ctx, ex + b.vx * dtc, ey + b.vy * dtc + 120 * dtc * dtc, 1, BRASA, t);
    }
  }
  ctx.restore();
}

function desenharDiscos(ctx: CanvasRenderingContext2D, grupos: readonly GrupoMapa[], r: number, vx0: number, vy0: number, vx1: number, vy1: number): void {
  for (let g = 0; g < grupos.length; g++) {
    const { cor, pts } = grupos[g];
    ctx.fillStyle = cor;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i];
      const y = pts[i + 1];
      if (x < vx0 || x > vx1 || y < vy0 || y > vy1) continue;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------------------------
// Tela: placas dos locais bloqueados e callouts (px CSS; transformação base do chamador)
// ---------------------------------------------------------------------------------------------

/** Cache de measureText (fonte + texto). Textos mudam (percentuais): esvazia ao passar do teto. */
const larguras = new Map<string, number>();
function largura(ctx: CanvasRenderingContext2D, fonte: string, texto: string): number {
  const k = fonte + "|" + texto;
  let w = larguras.get(k);
  if (w === undefined) {
    if (larguras.size >= MAX_LARGURAS) larguras.clear();
    ctx.font = fonte;
    w = ctx.measureText(texto).width;
    larguras.set(k, w);
  }
  return w;
}

/** Retângulos já ocupados na tela (reservas do chamador + placas + callouts), num pool sem alocação por frame. */
const RETS: [number, number, number, number][] = [];
let nRets = 0;
function reservar(x: number, y: number, w: number, h: number): void {
  let r = RETS[nRets];
  if (!r) {
    r = [0, 0, 0, 0];
    RETS.push(r);
  }
  r[0] = x;
  r[1] = y;
  r[2] = w;
  r[3] = h;
  nRets++;
}
function colide(bx: number, by: number, bw: number, bh: number): [number, number, number, number] | null {
  for (let i = 0; i < nRets; i++) {
    const r = RETS[i];
    if (bx < r[0] + r[2] + 4 && bx + bw + 4 > r[0] && by < r[1] + r[3] + 4 && by + bh + 4 > r[1]) return r;
  }
  return null;
}
/** Empurra a caixa para o lado livre (para cima; se não couber, para baixo), até 4 passos. */
function acomodar(bx: number, by: number, bw: number, bh: number, h: number): number {
  let y = by;
  for (let passo = 0; passo < 4; passo++) {
    const r = colide(bx, y, bw, bh);
    if (!r) return y;
    y = r[1] - bh - 6;
    if (y < 6) break;
  }
  y = by;
  for (let passo = 0; passo < 4; passo++) {
    const r = colide(bx, y, bw, bh);
    if (!r) return y;
    y = r[1] + r[3] + 6;
    if (y + bh > h - 6) break;
  }
  return Math.max(6, Math.min(h - bh - 6, by));
}

/** Ícone de cadeado 10×12 em `muted` (arco + corpo). */
function cadeado(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.strokeStyle = P.muted;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + 5, y + 4, 3, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = P.muted;
  retArred(ctx, x, y + 4, 10, 8, 2);
  ctx.fill();
  ctx.fillStyle = P.card;
  ctx.beginPath();
  ctx.arc(x + 5, y + 7.5, 1.3, 0, TAU);
  ctx.fill();
}

/**
 * Placa completa (moeda + "₵ 6,8 mil · Colinas" + cadeado, 26 px) a partir de zoom 0,2; entre 0,1 e 0,2 a versão
 * compacta (moeda r 6 + preço + cadeado, 22 px): a mecânica "novos locais" continua legível no preset do celular.
 */
function desenharPlacas(ctx: CanvasRenderingContext2D, cena: Cena, cam: Camera, w: number, h: number): void {
  const z = cam.zoom || 1;
  if (z < 0.1) return;
  const compacta = z < 0.2;
  const fonte = compacta ? FONTE_COMPACTA : FONTE_PLACA;
  ctx.textBaseline = "middle";
  const placas = cena.placas;
  for (let i = 0; i < placas.length; i++) {
    const pl = placas[i];
    const sx = pl.cx * z + cam.tx;
    const sy = (pl.cy - 8) * z + cam.ty;
    if (sx < -40 || sx > w + 40 || sy < -40 || sy > h + 40) continue;
    const texto = compacta ? pl.preco : pl.rotulo;
    const tw = largura(ctx, fonte, texto);
    const rm = compacta ? 6 : 7;
    const bh = compacta ? 22 : 26;
    const bw = Math.ceil(tw) + 8 + rm * 2 + 6 + 8 + 12 + 8;
    let bx = Math.round(sx - bw / 2);
    let by = Math.round(sy - (compacta ? 12 : 16) - bh);
    bx = Math.max(8, Math.min(w - bw - 8, bx));
    by = acomodar(bx, by, bw, bh, h);
    reservar(bx, by, bw, bh);
    ctx.strokeStyle = COR_GUIA;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 4);
    ctx.lineTo(sx, by + bh);
    ctx.stroke();
    retArred(ctx, bx, by, bw, bh, bh / 2);
    ctx.fillStyle = COR_PILULA;
    ctx.fill();
    ctx.strokeStyle = P.cardBorda;
    ctx.stroke();
    const cy = by + bh / 2;
    const mx = bx + 8 + rm;
    ctx.fillStyle = P.sun;
    ctx.beginPath();
    ctx.arc(mx, cy, rm, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = P.gold;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = P.navy;
    ctx.font = FONTE_MOEDA;
    ctx.textAlign = "center";
    ctx.fillText("₵", mx, cy + 0.5);
    const tx = mx + rm + 6;
    ctx.fillStyle = P.ink;
    ctx.font = fonte;
    ctx.textAlign = "left";
    ctx.fillText(texto, tx, cy + 0.5);
    cadeado(ctx, tx + tw + 8, cy - 6);
  }
}

/**
 * Motivo do realce em px de tela (GDD §2.4, v0.6): "sem escoamento", "esteira −40 %", "Ilha fechada…".
 * Pílula curta logo acima da casa sob o ponteiro, verde quando dá e coral quando não dá.
 */
function desenharMotivoRealce(ctx: CanvasRenderingContext2D, cena: Cena, cam: Camera, w: number, h: number): void {
  const re = cena.realce;
  if (!re || !re.texto) return;
  const z = cam.zoom || 1;
  const c = centro(re.x, re.y);
  const sx = c[0] * z + cam.tx;
  const sy = c[1] * z + cam.ty;
  if (sx < 0 || sx > w || sy < 0 || sy > h) return;
  const fonte = FONTE_COMPACTA;
  const tw = largura(ctx, fonte, re.texto);
  const bw = Math.ceil(tw) + 18;
  const bh = 22;
  const bx = Math.max(8, Math.min(w - bw - 8, Math.round(sx - bw / 2)));
  const by = Math.max(8, Math.round(sy - 34 - bh));
  reservar(bx, by, bw, bh);
  retArred(ctx, bx, by, bw, bh, bh / 2);
  ctx.fillStyle = COR_PILULA;
  ctx.fill();
  ctx.strokeStyle = alfa(re.valido ? P.leaf : P.coral, 0.8);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = re.valido ? P.leaf : P.coral;
  ctx.font = fonte;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(re.texto, bx + 9, by + bh / 2 + 0.5);
}

/** Lista de callouts do frame (reaproveitada: nada alocado por frame). */
const LISTA: Callout[] = [];

/**
 * Callouts em px de tela: âncora r 3, guia 18 ↑ + 14 →, caixa `card` α .85; α = clamp((zoom − 0,55)/0,15), nada abaixo
 * de α .35; abaixo de zoom 0,7 só a Torre e o mais próximo do centro; no máximo 4; empurra ao colidir. Também as placas.
 * `reservas`: retângulos de tela (controles, minimapa) que nem callouts nem placas podem cobrir.
 */
export function desenharCallouts(ctx: CanvasRenderingContext2D, cena: Cena, cam: Camera, reservas?: readonly Reserva[]): void {
  const z = cam.zoom || 1;
  const a = clamp01((z - 0.55) / 0.15);
  const w = cam.w;
  const h = cam.h;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.lineCap = "round";
  nRets = 0;
  if (reservas) for (const q of reservas) reservar(q[0], q[1], q[2], q[3]);
  desenharPlacas(ctx, cena, cam, w, h);
  desenharMotivoRealce(ctx, cena, cam, w, h);
  if (a >= 0.35) {
    ctx.globalAlpha = a;
    ctx.font = FONTE_CALLOUT;
    ctx.textBaseline = "middle";
    const todos = cena.callouts;
    LISTA.length = 0;
    if (z < 0.7) {
      let melhor: Callout | null = null;
      let dm = Infinity;
      for (let i = 0; i < todos.length; i++) {
        const c = todos[i];
        if (c.ancora.torre) {
          LISTA.push(c);
          continue;
        }
        const d = Math.hypot(c.ancora.wx * z + cam.tx - w / 2, c.ancora.wy * z + cam.ty - h / 2);
        if (d < dm) {
          dm = d;
          melhor = c;
        }
      }
      if (melhor) LISTA.push(melhor);
    } else {
      for (let i = 0; i < todos.length; i++) LISTA.push(todos[i]);
    }
    const pequeno = w < 600;
    let n = 0;
    for (let i = 0; i < LISTA.length && n < 4; i++) {
      const c = LISTA[i];
      const an = c.ancora;
      const texto = c.texto;
      // celular: a Grade ancora no vértice esquerdo da plataforma; a Torre 40 px abaixo do centro da esfera, à direita
      const wx = pequeno && an.wxM !== undefined ? an.wxM : an.wx;
      const wy = pequeno && an.wyM !== undefined ? an.wyM : an.wy;
      const sx = wx * z + cam.tx;
      const sy = wy * z + cam.ty + (pequeno && an.torre ? 40 : 0);
      if (sx < 8 || sx > w - 8 || sy < 8 || sy > h - 8) continue;
      if (colide(sx - 3, sy - 3, 6, 6)) continue; // a âncora cai sobre um overlay: sem callout
      const tw = largura(ctx, FONTE_CALLOUT, texto);
      const bw = Math.ceil(tw) + 20;
      const bh = 26;
      let lado: 1 | -1 = (pequeno && an.ladoM) || an.lado;
      if (lado > 0 && sx + 14 + bw + 8 > w) lado = -1;
      if (lado < 0 && sx - 14 - bw < 8) lado = 1;
      // 4 tentativas (cima/baixo × lado): a caixa E o segmento vertical da guia não podem cruzar reservas
      let bx = 0;
      let by = 0;
      let ok = false;
      const baixoPrimeiro = pequeno && an.torre;
      for (let tent = 0; tent < 4 && !ok; tent++) {
        const acima = (tent % 2 === 0) !== baixoPrimeiro;
        const l: 1 | -1 = tent < 2 ? lado : lado > 0 ? -1 : 1;
        bx = l > 0 ? sx + 14 : sx - 14 - bw;
        by = acima ? sy - 18 - bh / 2 : sy + 18 - bh / 2;
        bx = Math.max(8, Math.min(w - bw - 8, bx));
        const by2 = acomodar(bx, by, bw, bh, h);
        const gy2 = by2 + bh / 2;
        if (!colide(sx - 1, Math.min(sy, gy2), 2, Math.abs(gy2 - sy))) {
          by = by2;
          lado = l;
          ok = true;
        }
      }
      if (!ok) {
        bx = lado > 0 ? sx + 14 : sx - 14 - bw;
        bx = Math.max(8, Math.min(w - bw - 8, bx));
        by = acomodar(bx, sy - 18 - bh / 2, bw, bh, h);
      }
      reservar(bx, by, bw, bh);
      const gy = by + bh / 2;
      ctx.strokeStyle = COR_GUIA;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, gy);
      ctx.lineTo(lado > 0 ? bx : bx + bw, gy);
      ctx.stroke();
      ctx.fillStyle = P.ink;
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, TAU);
      ctx.fill();
      retArred(ctx, bx, by, bw, bh, 8);
      ctx.fillStyle = COR_CAIXA;
      ctx.fill();
      ctx.strokeStyle = P.cardBorda;
      ctx.stroke();
      ctx.fillStyle = P.ink;
      ctx.textAlign = "left";
      ctx.fillText(texto, bx + 10, by + bh / 2 + 0.5);
      n++;
    }
  }
  ctx.restore();
}
