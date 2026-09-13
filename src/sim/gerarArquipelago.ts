/**
 * Geração do arquipélago da Era 1 (GDD §2.4, §8.5): 2048 casas de terra repartidas em 8 ilhas separadas por
 * mar, numa grade de 64×64. TypeScript puro e determinístico: a mesma semente dá sempre o mesmo mapa.
 *
 * As ilhas crescem por fila de prioridade a partir das sementes do conteúdo. O custo de uma casa é a
 * distância à semente deformada por ruído (forma orgânica) e dividida pelo peso da ilha. Uma casa só é
 * tomada se estiver longe o bastante das casas de outra ilha (canal de mar) e da borda da grade. Cada ilha
 * para exatamente na sua cota de §8.5, então o total fecha em 2048 por construção.
 */
import {
  ARQUIPELAGO,
  ILHAS,
  OBSTACULOS,
  ORDEM_OBSTACULOS,
  CABO,
  type IlhaDef,
  type TipoObstaculo,
} from "../content/era1-arquipelago";
import { rnd, ruido } from "./aleatorio";
import {
  ORDEM_TERRENOS,
  indiceCasa,
  naPlataforma,
  type Arquipelago,
  type IlhaGerada,
  type Plataforma,
  type Rota,
} from "./arquipelago";

/** Lados de uma casa: 0 NE (y−1), 1 SE (x+1), 2 SW (y+1), 3 NW (x−1). */
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const idTerreno = (t: (typeof ORDEM_TERRENOS)[number]): number => ORDEM_TERRENOS.indexOf(t);
const idObstaculo = (o: TipoObstaculo): number => ORDEM_OBSTACULOS.indexOf(o);

/* ------------------------------------------------------------------ */
/* Fila de prioridade (heap binário de pares custo/valor)              */
/* ------------------------------------------------------------------ */

class Fila {
  private custos: number[] = [];
  private valores: number[] = [];

  get tamanho(): number {
    return this.custos.length;
  }

  inserir(custo: number, valor: number): void {
    this.custos.push(custo);
    this.valores.push(valor);
    let i = this.custos.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.custos[p] <= this.custos[i]) break;
      this.trocar(p, i);
      i = p;
    }
  }

  retirar(): number {
    const topo = this.valores[0];
    const c = this.custos.pop() as number;
    const v = this.valores.pop() as number;
    if (this.custos.length > 0) {
      this.custos[0] = c;
      this.valores[0] = v;
      let i = 0;
      for (;;) {
        const e = i * 2 + 1;
        const d = e + 1;
        let m = i;
        if (e < this.custos.length && this.custos[e] < this.custos[m]) m = e;
        if (d < this.custos.length && this.custos[d] < this.custos[m]) m = d;
        if (m === i) break;
        this.trocar(m, i);
        i = m;
      }
    }
    return topo;
  }

  private trocar(a: number, b: number): void {
    const c = this.custos[a];
    this.custos[a] = this.custos[b];
    this.custos[b] = c;
    const v = this.valores[a];
    this.valores[a] = this.valores[b];
    this.valores[b] = v;
  }
}

/* ------------------------------------------------------------------ */
/* Geração                                                             */
/* ------------------------------------------------------------------ */

export function gerarArquipelago(semente: number = ARQUIPELAGO.semente): Arquipelago {
  const seed = semente >>> 0 || 1;
  const n = ARQUIPELAGO.n;
  const nn = n * n;
  const lado = ARQUIPELAGO.ladoPlataforma;
  const principal = ILHAS[0];
  const x0 = principal.sx - (lado >> 1);
  const y0 = principal.sy - (lado >> 1);
  const plataforma: Plataforma = { x0, y0, lado, meio: principal.sx };
  const idx = (x: number, y: number) => indiceCasa(n, x, y);
  const dentro = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n;

  const ruForma = ILHAS.map((_, i) => ruido(seed * 17 + i * 101 + 3));
  const ruAlt = ruido(seed * 13 + 5);
  const ruColina = ruido(seed * 29 + 7);
  const r = rnd(seed * 7 + 1);

  // 1. Crescimento das ilhas ---------------------------------------------------------------
  const ilhaDe = new Int8Array(nn).fill(-1);
  const restam = ILHAS.map((d) => d.casas);
  const margem = ARQUIPELAGO.margem;
  const canal = ARQUIPELAGO.canal;

  const livreParaBorda = (x: number, y: number) => x >= margem && y >= margem && x < n - margem && y < n - margem;

  /** Nenhuma casa de outra ilha a menos de `canal` casas (Chebyshev): garante o mar entre ilhas. */
  const semVizinhaDeOutra = (x: number, y: number, ilha: number): boolean => {
    for (let dy = -canal; dy <= canal; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= n) continue;
      for (let dx = -canal; dx <= canal; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= n) continue;
        const q = ilhaDe[idx(nx, ny)];
        if (q >= 0 && q !== ilha) return false;
      }
    }
    return true;
  };

  const custoDe = (def: IlhaDef, i: number, x: number, y: number): number => {
    const d = Math.hypot(x + 0.5 - (def.sx + 0.5), y + 0.5 - (def.sy + 0.5));
    const f = 1 + ARQUIPELAGO.ruidoForma * (ruForma[i](x * 0.16 + 11, y * 0.16 + 11) - 0.5) * 2;
    return (d * f) / def.peso;
  };

  const fila = new Fila();
  // O par (ilha, casa) cabe num inteiro: ilha × nn + casa.
  const empacotar = (ilha: number, casa: number) => ilha * nn + casa;

  // A plataforma do Núcleo nasce pronta na ilha principal.
  for (let y = y0; y < y0 + lado; y++) {
    for (let x = x0; x < x0 + lado; x++) {
      ilhaDe[idx(x, y)] = 0;
      restam[0]--;
    }
  }
  ILHAS.forEach((def, i) => {
    const casa = idx(def.sx, def.sy);
    if (ilhaDe[casa] < 0) {
      ilhaDe[casa] = i;
      restam[i]--;
    }
    fila.inserir(custoDe(def, i, def.sx, def.sy), empacotar(i, casa));
  });
  // As casas já tomadas (plataforma e sementes) precisam semear a fronteira.
  for (let i = 0; i < nn; i++) {
    const q = ilhaDe[i];
    if (q < 0) continue;
    const x = i % n;
    const y = (i / n) | 0;
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k];
      const ny = y + DY[k];
      if (!dentro(nx, ny) || ilhaDe[idx(nx, ny)] >= 0) continue;
      fila.inserir(custoDe(ILHAS[q], q, nx, ny), empacotar(q, idx(nx, ny)));
    }
  }

  while (fila.tamanho > 0) {
    const pacote = fila.retirar();
    const ilha = Math.floor(pacote / nn);
    const casa = pacote % nn;
    if (restam[ilha] <= 0) continue;
    if (ilhaDe[casa] >= 0) continue;
    const x = casa % n;
    const y = (casa / n) | 0;
    if (!livreParaBorda(x, y) || !semVizinhaDeOutra(x, y, ilha)) continue;
    ilhaDe[casa] = ilha;
    restam[ilha]--;
    if (restam[ilha] <= 0) continue;
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k];
      const ny = y + DY[k];
      if (!dentro(nx, ny) || ilhaDe[idx(nx, ny)] >= 0) continue;
      fila.inserir(custoDe(ILHAS[ilha], ilha, nx, ny), empacotar(ilha, idx(nx, ny)));
    }
  }

  ILHAS.forEach((def, i) => {
    if (restam[i] !== 0) throw new Error(`Ilha ${def.id}: faltaram ${restam[i]} casas de ${def.casas}. Ajuste a semente ou o peso em content/era1-arquipelago.`);
  });

  const terra = new Uint8Array(nn);
  let total = 0;
  for (let i = 0; i < nn; i++) {
    if (ilhaDe[i] >= 0) {
      terra[i] = 1;
      total++;
    }
  }
  if (total !== ARQUIPELAGO.totalCasas) throw new Error(`Arquipélago: ${total} casas de terra, esperava ${ARQUIPELAGO.totalCasas}`);

  // 2. Distância à borda (dentro da terra) e ao mar (fora) ----------------------------------
  const distBorda = new Int16Array(nn).fill(-1);
  const distMar = new Int16Array(nn).fill(-1);
  const fifo = new Int32Array(nn);
  let qh = 0;
  let qt = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = idx(x, y);
      if (!terra[i]) continue;
      let borda = false;
      for (let k = 0; k < 4 && !borda; k++) {
        const nx = x + DX[k];
        const ny = y + DY[k];
        if (!dentro(nx, ny) || !terra[idx(nx, ny)]) borda = true;
      }
      if (borda) {
        distBorda[i] = 1;
        fifo[qt++] = i;
      }
    }
  }
  while (qh < qt) {
    const i = fifo[qh++];
    const x = i % n;
    const y = (i / n) | 0;
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k];
      const ny = y + DY[k];
      if (!dentro(nx, ny)) continue;
      const j = idx(nx, ny);
      if (terra[j] && distBorda[j] < 0) {
        distBorda[j] = distBorda[i] + 1;
        fifo[qt++] = j;
      }
    }
  }
  qh = 0;
  qt = 0;
  for (let i = 0; i < nn; i++) {
    if (terra[i]) {
      distMar[i] = 0;
      fifo[qt++] = i;
    }
  }
  while (qh < qt) {
    const i = fifo[qh++];
    const x = i % n;
    const y = (i / n) | 0;
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k];
      const ny = y + DY[k];
      if (!dentro(nx, ny)) continue;
      const j = idx(nx, ny);
      if (distMar[j] < 0) {
        distMar[j] = distMar[i] + 1;
        fifo[qt++] = j;
      }
    }
  }

  // 3. Terreno por casa --------------------------------------------------------------------
  const terreno = new Uint8Array(nn).fill(255);
  const altura = new Float32Array(nn);
  const T_PLANICIE = idTerreno("planicie");
  const T_COLINA = idTerreno("colina");
  const T_LITORAL = idTerreno("litoral");
  const T_ROCHA = idTerreno("rocha");
  for (let i = 0; i < nn; i++) {
    const q = ilhaDe[i];
    if (q < 0) continue;
    const def = ILHAS[q];
    const x = i % n;
    const y = (i / n) | 0;
    const larguraLitoral = def.terrenoDominante === "litoral" ? 2 : 1;
    let t: number;
    if (naPlataforma(plataforma, x, y)) t = T_PLANICIE;
    else if (distBorda[i] <= larguraLitoral) t = T_LITORAL;
    else if (def.terrenoDominante === "rocha") t = T_ROCHA;
    else t = ruColina(x * 0.19 + q * 31 + 3, y * 0.19 + q * 31 + 3) < def.colinas ? T_COLINA : T_PLANICIE;
    terreno[i] = t;
    altura[i] = clamp01(0.5 + 0.5 * (ruAlt(x * 0.12 + 3, y * 0.12 + 3) - 0.5) + (t === T_COLINA ? 0.2 : 0) - 0.18 / (1 + distBorda[i]));
  }

  // 4. Caminhos da aldeia (só na principal, ao lado da plataforma) --------------------------
  const caminho = new Uint8Array(nn);
  const py = y0 + lado + 1;
  const px = x0 + 1;
  for (let k = 0; k < 9; k++) {
    const x = px + k;
    if (dentro(x, py) && ilhaDe[idx(x, py)] === 0 && !naPlataforma(plataforma, x, py)) caminho[idx(x, py)] = 1;
  }
  for (let k = 1; k < 5; k++) {
    const y = py + k;
    const x = px + 3;
    if (dentro(x, y) && ilhaDe[idx(x, y)] === 0) caminho[idx(x, y)] = 1;
  }

  // 5. Ilhas montadas ----------------------------------------------------------------------
  const ilhas: IlhaGerada[] = ILHAS.map((def, i) => ({
    id: def.id,
    indice: i,
    nome: def.nome,
    terrenoDominante: def.terrenoDominante,
    expedicao: def.expedicao,
    casas: [],
    centro: [def.sx, def.sy],
    litoral: [],
  }));
  for (let i = 0; i < nn; i++) {
    const q = ilhaDe[i];
    if (q < 0) continue;
    ilhas[q].casas.push(i);
    if (distBorda[i] === 1) ilhas[q].litoral.push(i);
  }
  for (const ilha of ilhas) {
    let sx = 0;
    let sy = 0;
    for (const i of ilha.casas) {
      sx += i % n;
      sy += (i / n) | 0;
    }
    const cx = sx / ilha.casas.length;
    const cy = sy / ilha.casas.length;
    let dm = Infinity;
    for (const i of ilha.casas) {
      const d = Math.hypot((i % n) - cx, ((i / n) | 0) - cy);
      if (d < dm) {
        dm = d;
        ilha.centro = [i % n, (i / n) | 0];
      }
    }
  }

  // 6. Aldeia e subestação de nascença (GDD §8.5) -------------------------------------------
  const aldeia: number[] = [];
  let subestacao = -1;
  {
    const candidatas: number[] = [];
    for (let k = 0; k < 9; k++) {
      const x = px + k;
      const y = py + 1;
      if (dentro(x, y) && ilhaDe[idx(x, y)] === 0 && caminho[idx(x, y)] === 0) candidatas.push(idx(x, y));
    }
    for (let k = 0; k < 9; k++) {
      const x = px + k;
      const y = py - 1;
      if (dentro(x, y) && ilhaDe[idx(x, y)] === 0 && caminho[idx(x, y)] === 0 && !naPlataforma(plataforma, x, y)) candidatas.push(idx(x, y));
    }
    if (candidatas.length < 2) throw new Error("Arquipélago: sem casas para a aldeia de nascença.");
    aldeia.push(candidatas[1]);
    subestacao = candidatas[0];
  }

  // 7. Obstáculos de nascença ---------------------------------------------------------------
  const obstaculos = new Uint8Array(nn).fill(255);
  const montanhas: number[] = [];
  const clareira = (i: number): boolean => {
    const x = i % n;
    const y = (i / n) | 0;
    if (ilhaDe[i] !== 0) return false;
    const dPlat = Math.max(Math.abs(x - plataforma.meio), Math.abs(y - plataforma.meio)) - (lado >> 1);
    if (dPlat <= ARQUIPELAGO.clareiraPlataforma) return true;
    for (const a of [...aldeia, subestacao]) {
      if (Math.max(Math.abs(x - (a % n)), Math.abs(y - Math.floor(a / n))) <= ARQUIPELAGO.clareiraAldeia) return true;
    }
    return false;
  };
  const podeObstaculo = (i: number): boolean => terra[i] === 1 && obstaculos[i] === 255 && caminho[i] === 0 && !naPlataforma(plataforma, i % n, (i / n) | 0) && !clareira(i);

  ILHAS.forEach((def, q) => {
    const ilha = ilhas[q];
    // quantidades exatas primeiro (montanha 2×2 e pico querem espaço)
    for (const tipo of ORDEM_OBSTACULOS) {
      const quantos = def.quantidade[tipo] ?? 0;
      if (quantos <= 0) continue;
      const o = OBSTACULOS[tipo];
      let postos = 0;
      // candidatas longe da borda, na ordem determinística das casas, com espaçamento
      const usadas: number[] = [];
      for (const i of ilha.casas) {
        if (postos >= quantos) break;
        const x = i % n;
        const y = (i / n) | 0;
        if (distBorda[i] < (o.lado === 2 ? 3 : 2)) continue;
        if (usadas.some((u) => Math.max(Math.abs(x - (u % n)), Math.abs(y - Math.floor(u / n))) < 5)) continue;
        let cabe = true;
        for (let dy = 0; dy < o.lado && cabe; dy++) {
          for (let dx = 0; dx < o.lado && cabe; dx++) {
            const j = dentro(x + dx, y + dy) ? idx(x + dx, y + dy) : -1;
            if (j < 0 || ilhaDe[j] !== q || !podeObstaculo(j)) cabe = false;
          }
        }
        if (!cabe) continue;
        for (let dy = 0; dy < o.lado; dy++) for (let dx = 0; dx < o.lado; dx++) obstaculos[idx(x + dx, y + dy)] = idObstaculo(tipo);
        if (o.lado === 2) montanhas.push(i);
        usadas.push(i);
        postos++;
      }
    }
    // densidades
    for (const i of ilha.casas) {
      if (!podeObstaculo(i)) continue;
      const v = r();
      let acumulado = 0;
      for (const tipo of ORDEM_OBSTACULOS) {
        const d = def.densidade[tipo] ?? 0;
        if (d <= 0) continue;
        acumulado += d;
        if (v < acumulado) {
          obstaculos[i] = idObstaculo(tipo);
          break;
        }
      }
    }
  });

  // 8. Rotas dos cabos: do litoral da ilha ao litoral aberto mais próximo, em linha sobre o mar ---
  const rotas: (Rota | null)[] = ILHAS.map(() => null);
  for (let q = 1; q < ilhas.length; q++) {
    rotas[q] = rotaDoCabo(n, terra, ilhaDe, ilhas[q], ilhas[0]);
  }

  return {
    n,
    semente: seed,
    terra,
    total,
    caminho,
    distBorda,
    distMar,
    altura,
    ilha: ilhaDe,
    ilhas,
    terreno,
    obstaculos,
    montanhas,
    plataforma,
    rotas,
    inicio: { aldeia, subestacao },
  };
}

/** Par de litorais mais próximo entre duas ilhas e a linha de mar entre eles (Bresenham). */
function rotaDoCabo(n: number, terra: Uint8Array, ilhaDe: Int8Array, de: IlhaGerada, para: IlhaGerada): Rota {
  let melhorA = de.litoral[0];
  let melhorB = para.litoral[0];
  let dm = Infinity;
  for (const a of de.litoral) {
    const ax = a % n;
    const ay = (a / n) | 0;
    for (const b of para.litoral) {
      const d = Math.hypot(ax - (b % n), ay - Math.floor(b / n));
      if (d < dm) {
        dm = d;
        melhorA = a;
        melhorB = b;
      }
    }
  }
  const casas: number[] = [];
  let x = melhorA % n;
  let y = (melhorA / n) | 0;
  const bx = melhorB % n;
  const by = Math.floor(melhorB / n);
  let guarda = 0;
  while ((x !== bx || y !== by) && guarda++ < 4 * n) {
    const sx = Math.sign(bx - x);
    const sy = Math.sign(by - y);
    // anda no eixo de maior distância restante
    if (Math.abs(bx - x) >= Math.abs(by - y)) x += sx;
    else y += sy;
    const i = indiceCasa(n, x, y);
    if (terra[i] === 0) casas.push(i);
    else if (ilhaDe[i] !== de.indice && ilhaDe[i] !== para.indice) break;
  }
  return { ilha: de.indice, casas, de: melhorA, para: melhorB, custo: CABO.custoFixo + CABO.custoPorCasa * casas.length };
}

let arquipelagoEra1: Arquipelago | null = null;

/** Arquipélago da Era 1 (semente do conteúdo), gerado uma única vez. */
export function arquipelagoDaEra1(): Arquipelago {
  if (!arquipelagoEra1) arquipelagoEra1 = gerarArquipelago(ARQUIPELAGO.semente);
  return arquipelagoEra1;
}
