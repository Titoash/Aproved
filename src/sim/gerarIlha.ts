/**
 * Geração da ilha-tabuleiro da Era 1 (GDD §2.4): 2048 casas de terra numa grade 52×52, regiões (Voronoi com
 * pesos), lago, altura e caminhos da vila. TypeScript puro e determinístico: a mesma semente dá sempre a mesma
 * ilha. Números vêm de `content/era1-tabuleiro`; o que o jogador muda (regiões desbloqueadas) não vive aqui.
 */
import { ILHA, REGIOES } from "../content/era1-tabuleiro";
import { rnd, ruido } from "./aleatorio";
import { indiceCasa, naPlataforma, type Ilha, type Plataforma, type Regiao, type RegiaoId, type TipoRegiao } from "./ilha";

/** Lados de uma casa: 0 NE (vizinho y−1), 1 SE (x+1), 2 SW (y+1), 3 NW (x−1). */
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

interface Semente {
  i: number;
  id: RegiaoId;
  nome: string;
  tipo: TipoRegiao;
  peso: number;
  x: number;
  y: number;
}

export function gerarIlha(semente: number = ILHA.semente): Ilha {
  const seed = semente >>> 0 || 1;
  const n = ILHA.n;
  const nn = n * n;
  const total = ILHA.totalCasas;
  const lado = ILHA.ladoPlataforma;
  const c = n / 2; // centro geométrico da grade
  const x0 = Math.floor((n - lado) / 2);
  const y0 = x0;
  const meio = x0 + (lado >> 1); // casa central da plataforma (o Receptor)
  const plataforma: Plataforma = { x0, y0, lado, meio };
  const idx = (x: number, y: number) => indiceCasa(n, x, y);
  const dentro = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n;
  const r = rnd(seed);
  const ruForma = ruido(seed * 7 + 1);
  const ruAlt = ruido(seed * 13 + 5);
  const ruLago = ruido(seed * 31 + 9);

  // 1. Campo de forma: superelipse (quase círculo na grade = elipse 2:1 na tela) com raio modulado por ruído
  //    em duas frequências. Valor alto = mais "dentro". A plataforma recebe valor infinito (sempre terra).
  const valor = new Float64Array(nn);
  const EXP = ILHA.expoente;
  const RAIO = ILHA.raio;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const rho = Math.pow(Math.pow(Math.abs(dx) / RAIO, EXP) + Math.pow(Math.abs(dy) / RAIO, EXP), 1 / EXP);
      const th = Math.atan2(dy, dx);
      const co = Math.cos(th);
      const si = Math.sin(th);
      // amplitude ≈ 0,3 do raio: oitava 1 com período ≈ 18 casas, oitava 2 ≈ 9 casas
      const R =
        1 +
        0.24 * (0.7 * (ruForma(co * 1.35 + 40, si * 1.35 + 40) - 0.5) * 2 + 0.3 * (ruForma(co * 2.7 + 90, si * 2.7 + 90) - 0.5) * 2);
      valor[idx(x, y)] = naPlataforma(plataforma, x, y) ? 1e9 : R - rho;
    }
  }

  // 2. Limiar por bissecção até contar exatamente `total` casas.
  const contar = (lim: number) => {
    let q = 0;
    for (let i = 0; i < nn; i++) if (valor[i] > lim) q++;
    return q;
  };
  let lo = -3;
  let hi = 3;
  for (let it = 0; it < 90; it++) {
    const mid = (lo + hi) / 2;
    if (contar(mid) >= total) lo = mid;
    else hi = mid;
  }
  const terra = new Uint8Array(nn);
  let contagem = 0;
  for (let i = 0; i < nn; i++) {
    if (valor[i] > lo) {
      terra[i] = 1;
      contagem++;
    }
  }
  if (contagem !== total) throw new Error(`Ilha: ${contagem} casas de terra, esperava ${total} (limiar ${lo})`);

  // 3. Distância à borda (BFS a partir das casas de borda): usada pelo lago e pela altura.
  const distBorda = new Int16Array(nn).fill(-1);
  const fila = new Int32Array(nn);
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
        fila[qt++] = i;
      }
    }
  }
  while (qh < qt) {
    const i = fila[qh++];
    const x = i % n;
    const y = (i / n) | 0;
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k];
      const ny = y + DY[k];
      if (!dentro(nx, ny)) continue;
      const j = idx(nx, ny);
      if (terra[j] && distBorda[j] < 0) {
        distBorda[j] = distBorda[i] + 1;
        fila[qt++] = j;
      }
    }
  }

  // 4. Regiões: Voronoi com pesos aditivos sobre sementes fixas do conteúdo (com leve jitter determinístico).
  //    Na tela x−y é horizontal e x+y vertical: 315° fica à direita, 225° em cima, 45° embaixo, 135° à esquerda.
  const sementes: Semente[] = REGIOES.map((s, i) => {
    const a = ((s.ang + (r() - 0.5) * 12) * Math.PI) / 180;
    const rr = s.r + (r() - 0.5) * 2;
    return {
      i,
      id: s.id,
      nome: s.nome,
      tipo: s.tipo,
      peso: s.peso,
      x: i === 0 ? meio + 0.5 : c + Math.cos(a) * rr,
      y: i === 0 ? meio + 0.5 : c + Math.sin(a) * rr,
    };
  });
  const regiao = new Int8Array(nn).fill(-1);
  const m = ILHA.margemNucleo;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = idx(x, y);
      if (!terra[i]) continue;
      if (x >= x0 - m && x < x0 + lado + m && y >= y0 - m && y < y0 + lado + m) {
        regiao[i] = 0;
        continue;
      }
      let melhor = 0;
      let dm = Infinity;
      for (const s of sementes) {
        const d = Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y) - s.peso;
        if (d < dm) {
          dm = d;
          melhor = s.i;
        }
      }
      regiao[i] = melhor;
    }
  }

  // 5. Lago: mancha de ruído em volta da semente 'lago', longe da borda e fora do Núcleo. Água conta como terra.
  const agua = new Uint8Array(nn);
  const sl = sementes.find((s) => s.tipo === "lago");
  if (sl) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = idx(x, y);
        if (!terra[i] || regiao[i] !== sl.i || distBorda[i] < 3) continue;
        const rl = ILHA.raioLago * (1 + 0.6 * (ruLago(x * 0.27 + 7, y * 0.27 + 7) - 0.5));
        if (Math.hypot(x + 0.5 - sl.x, y + 0.5 - sl.y) < rl) agua[i] = 1;
      }
    }
    for (let passo = 0; passo < 2; passo++) {
      // remove pontas de uma casa
      for (let y = 1; y < n - 1; y++) {
        for (let x = 1; x < n - 1; x++) {
          const i = idx(x, y);
          if (!agua[i]) continue;
          let v = 0;
          for (let k = 0; k < 4; k++) v += agua[idx(x + DX[k], y + DY[k])];
          if (v < 2) agua[i] = 0;
        }
      }
    }
  }

  // 6. Altura 0..1 (só tom da grama): ruído em duas frequências + leve domo, mais baixo junto à borda.
  const altura = new Float32Array(nn);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = idx(x, y);
      if (!terra[i]) continue;
      const a =
        0.5 +
        0.55 * (ruAlt(x * 0.11 + 3, y * 0.11 + 3) - 0.5) +
        0.25 * (ruAlt(x * 0.31 + 9, y * 0.31 + 9) - 0.5) +
        0.12 * (1 - Math.hypot(x + 0.5 - c, y + 0.5 - c) / 26) -
        0.18 / (1 + distBorda[i]);
      altura[i] = clamp01(a);
    }
  }

  // 7. Caminhos da vila: praça 2×2 na semente + 4 ramos em linha 4-conexa até alvos a ~7 casas.
  const caminho = new Uint8Array(nn);
  const sv = sementes.find((s) => s.tipo === "vila");
  if (sv) {
    const podeCaminho = (x: number, y: number) =>
      dentro(x, y) && terra[idx(x, y)] === 1 && agua[idx(x, y)] === 0 && regiao[idx(x, y)] === sv.i;
    const casasVila: number[] = [];
    for (let i = 0; i < nn; i++) if (regiao[i] === sv.i && !agua[i]) casasVila.push(i);
    let px = Math.round(sv.x - 0.5);
    let py = Math.round(sv.y - 0.5);
    if (!podeCaminho(px, py)) {
      let dm = Infinity;
      for (const i of casasVila) {
        const d = Math.hypot((i % n) + 0.5 - sv.x, ((i / n) | 0) + 0.5 - sv.y);
        if (d < dm) {
          dm = d;
          px = i % n;
          py = (i / n) | 0;
        }
      }
    }
    for (const [ox, oy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]) {
      if (podeCaminho(px + ox, py + oy)) caminho[idx(px + ox, py + oy)] = 1;
    }
    for (let q = 0; q < 4; q++) {
      const alvoAng = ((q * 90 + 45 + (r() - 0.5) * 40) * Math.PI) / 180;
      const alvoDist = 6.5 + r() * 2.5;
      let melhor = -1;
      let dm = Infinity;
      for (const i of casasVila) {
        const cx = (i % n) - px;
        const cy = ((i / n) | 0) - py;
        const d = Math.hypot(cx, cy);
        if (d < 4) continue;
        let da = Math.atan2(cy, cx) - alvoAng;
        da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
        const custo = da * 4 + Math.abs(d - alvoDist);
        if (custo < dm) {
          dm = custo;
          melhor = i;
        }
      }
      if (melhor < 0) continue;
      // dois trechos (praça → cotovelo → alvo) para o caminho não sair reto demais
      const tx = melhor % n;
      const ty = (melhor / n) | 0;
      const desvio = (r() < 0.5 ? -1 : 1) * (1 + Math.round(r()));
      const ang = Math.atan2(ty - py, tx - px);
      const mx = Math.round((px + tx) / 2 - Math.sin(ang) * desvio);
      const my = Math.round((py + ty) / 2 + Math.cos(ang) * desvio);
      let x = px;
      let y = py;
      let ok = true;
      for (const [ax, ay] of [
        [mx, my],
        [tx, ty],
      ]) {
        const ox = x;
        const oy = y;
        while (ok && (x !== ax || y !== ay)) {
          // passo no eixo que mantém o ponto mais perto da reta ideal
          const sx = Math.sign(ax - x);
          const sy = Math.sign(ay - y);
          const ex = sx ? Math.abs((x + sx - ox) * (ay - oy) - (y - oy) * (ax - ox)) : Infinity;
          const ey = sy ? Math.abs((x - ox) * (ay - oy) - (y + sy - oy) * (ax - ox)) : Infinity;
          if (ex <= ey) x += sx;
          else y += sy;
          if (!podeCaminho(x, y) || naPlataforma(plataforma, x, y)) {
            ok = false;
            break;
          }
          caminho[idx(x, y)] = 1;
        }
      }
    }
  }

  // 8. Montagem das regiões (casas e casa representativa).
  const regioes: Regiao[] = sementes.map((s) => ({ id: s.id, indice: s.i, nome: s.nome, tipo: s.tipo, casas: [], centro: [0, 0] }));
  for (let i = 0; i < nn; i++) if (regiao[i] >= 0) regioes[regiao[i]].casas.push(i);
  for (const reg of regioes) {
    if (reg.tipo === "nucleo") {
      reg.centro = [meio, meio];
      continue;
    }
    let sx = 0;
    let sy = 0;
    for (const i of reg.casas) {
      sx += i % n;
      sy += (i / n) | 0;
    }
    const cx = sx / reg.casas.length + 0.5;
    const cy = sy / reg.casas.length + 0.5;
    let dm = Infinity;
    for (const i of reg.casas) {
      if (agua[i] || caminho[i]) continue;
      const d = Math.hypot((i % n) + 0.5 - cx, ((i / n) | 0) + 0.5 - cy);
      if (d < dm) {
        dm = d;
        reg.centro = [i % n, (i / n) | 0];
      }
    }
  }

  return { n, semente: seed, terra, total: contagem, agua, caminho, distBorda, altura, regiao, regioes, plataforma };
}

let ilhaEra1: Ilha | null = null;

/** Ilha da Era 1 (semente do conteúdo), gerada uma única vez. */
export function ilhaDaEra1(): Ilha {
  if (!ilhaEra1) ilhaEra1 = gerarIlha(ILHA.semente);
  return ilhaEra1;
}
