import { describe, expect, it } from "vitest";
import { ILHA, REGIOES } from "../content/era1-tabuleiro";
import { gerarIlha, ilhaDaEra1 } from "./gerarIlha";
import { indiceCasa, naPlataforma, type Ilha } from "./ilha";

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

/** BFS 4-conexa a partir da primeira casa de terra: quantas casas alcança. */
function alcancadas(ilha: Ilha): number {
  const { n, terra } = ilha;
  const visto = new Uint8Array(n * n);
  const fila: number[] = [];
  const inicio = terra.indexOf(1);
  if (inicio < 0) return 0;
  visto[inicio] = 1;
  fila.push(inicio);
  let cont = 0;
  while (fila.length) {
    const i = fila.pop()!;
    cont++;
    const x = i % n;
    const y = Math.floor(i / n);
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k];
      const ny = y + DY[k];
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const j = indiceCasa(n, nx, ny);
      if (terra[j] && !visto[j]) {
        visto[j] = 1;
        fila.push(j);
      }
    }
  }
  return cont;
}

function ehBorda(ilha: Ilha, x: number, y: number): boolean {
  const { n, terra } = ilha;
  for (let k = 0; k < 4; k++) {
    const nx = x + DX[k];
    const ny = y + DY[k];
    if (nx < 0 || ny < 0 || nx >= n || ny >= n || !terra[indiceCasa(n, nx, ny)]) return true;
  }
  return false;
}

describe("gerarIlha", () => {
  const ilha = gerarIlha(ILHA.semente);
  const { n } = ilha;

  it("tem exatamente 2048 casas de terra", () => {
    let cont = 0;
    for (let i = 0; i < n * n; i++) cont += ilha.terra[i];
    expect(ilha.total).toBe(ILHA.totalCasas);
    expect(cont).toBe(ILHA.totalCasas);
    expect(n).toBe(ILHA.n);
  });

  it("é determinística: a mesma semente dá a mesma terra", () => {
    const outra = gerarIlha(ILHA.semente);
    expect(Array.from(outra.terra)).toEqual(Array.from(ilha.terra));
    expect(Array.from(outra.agua)).toEqual(Array.from(ilha.agua));
    expect(Array.from(outra.caminho)).toEqual(Array.from(ilha.caminho));
    expect(Array.from(outra.regiao)).toEqual(Array.from(ilha.regiao));
    expect(outra.semente).toBe(ilha.semente);
  });

  it("plataforma 7×7 centrada, toda em terra e toda na região do Núcleo", () => {
    const p = ilha.plataforma;
    expect(p.lado).toBe(ILHA.ladoPlataforma);
    expect(p.x0).toBe(Math.floor((n - p.lado) / 2));
    expect(p.y0).toBe(p.x0);
    expect(p.meio).toBe(p.x0 + (p.lado >> 1));
    for (let y = p.y0; y < p.y0 + p.lado; y++) {
      for (let x = p.x0; x < p.x0 + p.lado; x++) {
        const i = indiceCasa(n, x, y);
        expect(ilha.terra[i]).toBe(1);
        expect(ilha.regiao[i]).toBe(0);
      }
    }
    expect(ilha.regioes[0].id).toBe("nucleo");
    expect(ilha.regioes[0].centro).toEqual([p.meio, p.meio]);
  });

  it("toda casa de terra tem região e nenhuma casa fora da terra tem região", () => {
    for (let i = 0; i < n * n; i++) {
      if (ilha.terra[i]) expect(ilha.regiao[i]).toBeGreaterThanOrEqual(0);
      else expect(ilha.regiao[i]).toBe(-1);
    }
    // as listas de casas das regiões cobrem a terra sem sobreposição
    const soma = ilha.regioes.reduce((s, r) => s + r.casas.length, 0);
    expect(soma).toBe(ILHA.totalCasas);
    for (const r of ilha.regioes) for (const i of r.casas) expect(ilha.regiao[i]).toBe(r.indice);
  });

  it("água só sobre terra e fora da plataforma", () => {
    let cont = 0;
    for (let i = 0; i < n * n; i++) {
      if (!ilha.agua[i]) continue;
      cont++;
      const [x, y] = [i % n, Math.floor(i / n)];
      expect(ilha.terra[i]).toBe(1);
      expect(naPlataforma(ilha.plataforma, x, y)).toBe(false);
    }
    expect(cont).toBeGreaterThan(0);
  });

  it("caminhos só em terra, fora da água e fora da plataforma", () => {
    let cont = 0;
    for (let i = 0; i < n * n; i++) {
      if (!ilha.caminho[i]) continue;
      cont++;
      const [x, y] = [i % n, Math.floor(i / n)];
      expect(ilha.terra[i]).toBe(1);
      expect(ilha.agua[i]).toBe(0);
      expect(naPlataforma(ilha.plataforma, x, y)).toBe(false);
    }
    expect(cont).toBeGreaterThan(0);
  });

  it("é conexa (BFS 4-conexa alcança todas as casas)", () => {
    expect(alcancadas(ilha)).toBe(ILHA.totalCasas);
  });

  it("tem as 8 regiões do conteúdo, na ordem", () => {
    expect(ilha.regioes).toHaveLength(REGIOES.length);
    expect(ilha.regioes.map((r) => r.id)).toEqual(REGIOES.map((r) => r.id));
    ilha.regioes.forEach((r, i) => {
      expect(r.indice).toBe(i);
      expect(r.tipo).toBe(REGIOES[i].tipo);
      expect(r.nome).toBe(REGIOES[i].nome);
      expect(r.casas.length).toBeGreaterThan(0);
      // o centro é uma casa da própria região
      expect(ilha.regiao[indiceCasa(n, r.centro[0], r.centro[1])]).toBe(i);
    });
  });

  it("distBorda vale 1 nas casas de borda, mais no interior e −1 fora da ilha", () => {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = indiceCasa(n, x, y);
        if (!ilha.terra[i]) {
          expect(ilha.distBorda[i]).toBe(-1);
        } else if (ehBorda(ilha, x, y)) {
          expect(ilha.distBorda[i]).toBe(1);
        } else {
          expect(ilha.distBorda[i]).toBeGreaterThan(1);
        }
      }
    }
  });

  it("altura fica em 0..1 nas casas de terra", () => {
    for (let i = 0; i < n * n; i++) {
      if (!ilha.terra[i]) continue;
      expect(ilha.altura[i]).toBeGreaterThanOrEqual(0);
      expect(ilha.altura[i]).toBeLessThanOrEqual(1);
    }
  });

  it("ilhaDaEra1 é memoizada e usa a semente do conteúdo", () => {
    const a = ilhaDaEra1();
    expect(ilhaDaEra1()).toBe(a);
    expect(a.semente).toBe(ILHA.semente);
    expect(Array.from(a.terra)).toEqual(Array.from(ilha.terra));
  });
});
