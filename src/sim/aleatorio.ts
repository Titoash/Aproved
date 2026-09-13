/** Geradores determinísticos (o tabuleiro nunca usa `Math.random`). TypeScript puro. */

/** LCG de 32 bits. A mesma semente dá sempre a mesma sequência. */
export function rnd(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Ruído de valor 2D suave e determinístico, periódico a cada 256 unidades. */
export function ruido(seed: number): (x: number, y: number) => number {
  const r = rnd(seed);
  const g = new Float32Array(256 * 256);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const lerp = (a: number, b: number, t: number) => a + (b - a) * (t * t * (3 - 2 * t));
  return (x, y) => {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const v = (i: number, j: number) => g[((yi + j) & 255) * 256 + ((xi + i) & 255)];
    return lerp(lerp(v(0, 0), v(1, 0), xf), lerp(v(0, 1), v(1, 1), xf), yf);
  };
}
