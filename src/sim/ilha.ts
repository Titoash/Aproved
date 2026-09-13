/**
 * Tipos da ilha-tabuleiro (GDD §2.4). A ilha é geometria determinística derivada do conteúdo e da semente:
 * não vive no save. O que o jogador muda (regiões desbloqueadas) fica em `GameState.tabuleiro`.
 */

export type TipoRegiao = "nucleo" | "vento" | "vila" | "sol" | "lago" | "floresta" | "livre";

export type RegiaoId = "nucleo" | "vento" | "vila" | "sol" | "lago" | "floresta" | "planicie" | "colinas";

export interface Regiao {
  id: RegiaoId;
  /** Posição em `ilha.regioes` e valor em `ilha.regiao`. */
  indice: number;
  nome: string;
  tipo: TipoRegiao;
  /** Índices (`y·n + x`) das casas da região. */
  casas: number[];
  /** Casa representativa (placa de preço, callouts). */
  centro: [number, number];
}

export interface Plataforma {
  x0: number;
  y0: number;
  /** Lado da plataforma do Núcleo (7). A grade jogável pode ser menor (5) até a Grade 7×7. */
  lado: number;
  /** Casa central (o Receptor). */
  meio: number;
}

export interface Ilha {
  n: number;
  semente: number;
  /** 1 = casa de terra (índice `y·n + x`). */
  terra: Uint8Array;
  /** Total de casas de terra (2048 na Era 1). */
  total: number;
  /** 1 = lago (sobre terra; conta como terra). */
  agua: Uint8Array;
  /** 1 = caminho da vila. */
  caminho: Uint8Array;
  /** Distância à borda em casas (1 = borda); −1 fora da ilha. */
  distBorda: Int16Array;
  /** 0..1, só para variar o tom da grama. */
  altura: Float32Array;
  /** Índice da região de cada casa; −1 fora da ilha. */
  regiao: Int8Array;
  regioes: Regiao[];
  plataforma: Plataforma;
}

export const indiceCasa = (n: number, x: number, y: number): number => y * n + x;
export const casaDoIndice = (n: number, i: number): [number, number] => [i % n, Math.floor(i / n)];

export function naPlataforma(p: Plataforma, x: number, y: number): boolean {
  return x >= p.x0 && x < p.x0 + p.lado && y >= p.y0 && y < p.y0 + p.lado;
}
