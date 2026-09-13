/**
 * Tipos do arquipélago (GDD §2.4, v0.6). A geometria é determinística, derivada do conteúdo e da semente:
 * não vive no save. O que o jogador muda (construções, obstáculos removidos, ilhas abertas, cabos)
 * fica em `GameState.mundo`.
 */
import type { IlhaId, TipoObstaculo, TipoTerreno } from "../content/era1-arquipelago";

export type { IlhaId, TipoObstaculo, TipoTerreno };

export interface Plataforma {
  x0: number;
  y0: number;
  /** Lado da plataforma do Núcleo (7). A grade jogável pode ser menor (5) até a Grade 7×7. */
  lado: number;
  /** Casa central (o Receptor). */
  meio: number;
}

export interface IlhaGerada {
  id: IlhaId;
  /** Posição em `arquipelago.ilhas` e valor em `arquipelago.ilha`. */
  indice: number;
  nome: string;
  terrenoDominante: TipoTerreno;
  /** ₵ da expedição; `null` = aberta desde o início. */
  expedicao: number | null;
  /** Índices (`y·n + x`) das casas de terra. */
  casas: number[];
  /** Casa representativa (placa de expedição, rótulo). */
  centro: [number, number];
  /** Casas de litoral (borda), para o cabo e para a espuma. */
  litoral: number[];
}

/** Rota do cabo submarino de uma ilha até a rede principal (GDD §8.5). */
export interface Rota {
  /** Índice da ilha ligada pela rota. */
  ilha: number;
  /** Casas de mar atravessadas, em ordem. */
  casas: number[];
  /** Litoral de partida (na ilha) e de chegada (na rede principal). */
  de: number;
  para: number;
  /** ₵ 150 + ₵ 40 por casa de mar. */
  custo: number;
}

export interface Arquipelago {
  n: number;
  semente: number;
  /** 1 = casa de terra (índice `y·n + x`); 0 = mar. */
  terra: Uint8Array;
  /** Total de casas de terra (2048 na Era 1). */
  total: number;
  /** 1 = caminho da aldeia (não constrói, não tem obstáculo). */
  caminho: Uint8Array;
  /** Distância à borda da ilha em casas (1 = litoral); −1 no mar. */
  distBorda: Int16Array;
  /** Distância à terra mais próxima, em casas (0 em terra): profundidade do mar. */
  distMar: Int16Array;
  /** 0..1, só para variar o tom da grama. */
  altura: Float32Array;
  /** Índice da ilha de cada casa; −1 no mar. */
  ilha: Int8Array;
  ilhas: IlhaGerada[];
  /** Terreno por casa (índice em `ORDEM_TERRENOS`); 255 no mar. */
  terreno: Uint8Array;
  /** Obstáculo de nascença por casa (índice em `ORDEM_OBSTACULOS`); 255 = nenhum. */
  obstaculos: Uint8Array;
  /** Casa noroeste de cada montanha 2×2. */
  montanhas: number[];
  plataforma: Plataforma;
  /** Rota do cabo por ilha (vazia para a principal). */
  rotas: (Rota | null)[];
  /** Onde a aldeia e a subestação de nascença ficam (GDD §8.5). */
  inicio: { aldeia: number[]; subestacao: number };
}

export const ORDEM_TERRENOS: readonly TipoTerreno[] = ["planicie", "colina", "litoral", "rocha"];

export const indiceCasa = (n: number, x: number, y: number): number => y * n + x;
export const casaDoIndice = (n: number, i: number): [number, number] => [i % n, Math.floor(i / n)];

export function naPlataforma(p: Plataforma, x: number, y: number): boolean {
  return x >= p.x0 && x < p.x0 + p.lado && y >= p.y0 && y < p.y0 + p.lado;
}

/** Distância de Chebyshev entre duas casas da grade. */
export const chebyshev = (n: number, a: number, b: number): number =>
  Math.max(Math.abs((a % n) - (b % n)), Math.abs(Math.floor(a / n) - Math.floor(b / n)));
