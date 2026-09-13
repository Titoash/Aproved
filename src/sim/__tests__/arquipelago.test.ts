import { describe, expect, it } from "vitest";
import { ARQUIPELAGO, CABO, ILHAS, OBSTACULOS, ORDEM_OBSTACULOS } from "../../content/era1-arquipelago";
import { ORDEM_TERRENOS, indiceCasa, naPlataforma } from "../arquipelago";
import { arquipelagoDaEra1, gerarArquipelago } from "../gerarArquipelago";

const arq = arquipelagoDaEra1();
const n = arq.n;
const casa = (i: number): [number, number] => [i % n, Math.floor(i / n)];

describe("geração do arquipélago (GDD §2.4, §8.5)", () => {
  it("tem 2048 casas de terra repartidas nos tamanhos de §8.5", () => {
    expect(arq.total).toBe(ARQUIPELAGO.totalCasas);
    let soma = 0;
    for (const ilha of arq.ilhas) {
      const def = ILHAS[ilha.indice];
      expect(ilha.casas.length).toBe(def.casas);
      soma += ilha.casas.length;
    }
    expect(soma).toBe(2048);
    expect(arq.ilhas.length).toBe(8);
  });

  it("cada ilha é 4-conexa", () => {
    for (const ilha of arq.ilhas) {
      const conjunto = new Set(ilha.casas);
      const vistas = new Set<number>([ilha.casas[0]]);
      const pilha = [ilha.casas[0]];
      while (pilha.length) {
        const i = pilha.pop() as number;
        const [x, y] = casa(i);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const j = indiceCasa(n, x + dx, y + dy);
          if (x + dx < 0 || y + dy < 0 || x + dx >= n || y + dy >= n) continue;
          if (conjunto.has(j) && !vistas.has(j)) {
            vistas.add(j);
            pilha.push(j);
          }
        }
      }
      expect(vistas.size).toBe(ilha.casas.length);
    }
  });

  it("as ilhas ficam separadas por pelo menos duas casas de mar", () => {
    const c = ARQUIPELAGO.canal;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const q = arq.ilha[indiceCasa(n, x, y)];
        if (q < 0) continue;
        for (let dy = -c; dy <= c; dy++) {
          for (let dx = -c; dx <= c; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
            const p = arq.ilha[indiceCasa(n, nx, ny)];
            if (p >= 0) expect(p).toBe(q);
          }
        }
      }
    }
  });

  it("a plataforma 7×7 do Núcleo fica inteira na ilha principal", () => {
    const p = arq.plataforma;
    expect(p.lado).toBe(7);
    for (let y = p.y0; y < p.y0 + p.lado; y++) {
      for (let x = p.x0; x < p.x0 + p.lado; x++) {
        const i = indiceCasa(n, x, y);
        expect(arq.terra[i]).toBe(1);
        expect(arq.ilha[i]).toBe(0);
        expect(arq.obstaculos[i]).toBe(255);
      }
    }
    expect(naPlataforma(p, p.meio, p.meio)).toBe(true);
  });

  it("todo o terreno é válido em terra e ausente no mar", () => {
    for (let i = 0; i < n * n; i++) {
      if (arq.terra[i] === 1) {
        expect(arq.terreno[i]).toBeLessThan(ORDEM_TERRENOS.length);
        expect(arq.distBorda[i]).toBeGreaterThan(0);
      } else {
        expect(arq.terreno[i]).toBe(255);
        expect(arq.obstaculos[i]).toBe(255);
      }
    }
  });

  it("o litoral é a borda e a ilha de litoral largo tem mais litoral", () => {
    for (const ilha of arq.ilhas) {
      for (const i of ilha.litoral) expect(arq.distBorda[i]).toBe(1);
    }
    const litoralId = ORDEM_TERRENOS.indexOf("litoral");
    const fracao = (indice: number) => {
      const ilha = arq.ilhas[indice];
      return ilha.casas.filter((i) => arq.terreno[i] === litoralId).length / ilha.casas.length;
    };
    // Recife é quase só borda; a principal é larga.
    expect(fracao(6)).toBeGreaterThan(fracao(0));
  });

  it("obstáculos só em terra, fora da plataforma, dos caminhos e da clareira inicial", () => {
    for (let i = 0; i < n * n; i++) {
      if (arq.obstaculos[i] === 255) continue;
      const [x, y] = casa(i);
      expect(arq.terra[i]).toBe(1);
      expect(arq.caminho[i]).toBe(0);
      expect(naPlataforma(arq.plataforma, x, y)).toBe(false);
      expect(ORDEM_OBSTACULOS[arq.obstaculos[i]]).toBeTruthy();
    }
    // clareira: nada em volta da plataforma
    const p = arq.plataforma;
    for (let y = p.y0 - ARQUIPELAGO.clareiraPlataforma; y < p.y0 + p.lado + ARQUIPELAGO.clareiraPlataforma; y++) {
      for (let x = p.x0 - ARQUIPELAGO.clareiraPlataforma; x < p.x0 + p.lado + ARQUIPELAGO.clareiraPlataforma; x++) {
        const i = indiceCasa(n, x, y);
        if (arq.ilha[i] !== 0) continue;
        expect(arq.obstaculos[i]).toBe(255);
      }
    }
  });

  it("a principal nasce com cerca de 45 % de obstáculos e o Bosque quase só com árvores", () => {
    const conta = (indice: number) => arq.ilhas[indice].casas.filter((i) => arq.obstaculos[i] !== 255).length;
    const principal = arq.ilhas[0];
    const fracao = conta(0) / (principal.casas.length - arq.plataforma.lado ** 2);
    expect(fracao).toBeGreaterThan(0.4);
    expect(fracao).toBeLessThan(0.5);
    const arvore = ORDEM_OBSTACULOS.indexOf("arvore");
    const bosque = arq.ilhas[4];
    const arvores = bosque.casas.filter((i) => arq.obstaculos[i] === arvore).length;
    expect(arvores / bosque.casas.length).toBeGreaterThan(0.8);
  });

  it("cada montanha ocupa 2×2 casas e a Pedreira tem quatro", () => {
    const montanha = ORDEM_OBSTACULOS.indexOf("montanha");
    expect(arq.montanhas.length).toBe(4);
    for (const i of arq.montanhas) {
      const [x, y] = casa(i);
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) expect(arq.obstaculos[indiceCasa(n, x + dx, y + dy)]).toBe(montanha);
      }
      expect(arq.ilha[i]).toBe(5);
    }
    const total = arq.ilhas[5].casas.filter((i) => arq.obstaculos[i] === montanha).length;
    expect(total).toBe(4 * OBSTACULOS.montanha.lado ** 2);
  });

  it("picos são permanentes e ficam em Ventania e no Farol", () => {
    const pico = ORDEM_OBSTACULOS.indexOf("pico");
    expect(OBSTACULOS.pico.permanente).toBe(true);
    expect(arq.ilhas[1].casas.filter((i) => arq.obstaculos[i] === pico).length).toBe(3);
    expect(arq.ilhas[7].casas.filter((i) => arq.obstaculos[i] === pico).length).toBe(1);
  });

  it("cada ilha fechada tem uma rota de cabo só por casas de mar, de litoral a litoral", () => {
    for (let q = 1; q < arq.ilhas.length; q++) {
      const rota = arq.rotas[q];
      expect(rota).not.toBeNull();
      if (!rota) continue;
      expect(rota.casas.length).toBeGreaterThan(0);
      for (const i of rota.casas) expect(arq.terra[i]).toBe(0);
      expect(arq.ilha[rota.de]).toBe(q);
      expect(arq.ilha[rota.para]).toBe(0);
      expect(arq.distBorda[rota.de]).toBe(1);
      expect(arq.distBorda[rota.para]).toBe(1);
      expect(rota.custo).toBe(CABO.custoFixo + CABO.custoPorCasa * rota.casas.length);
    }
    expect(arq.rotas[0]).toBeNull();
  });

  it("a aldeia e a subestação de nascença ficam em terra livre da principal", () => {
    for (const i of [...arq.inicio.aldeia, arq.inicio.subestacao]) {
      expect(arq.ilha[i]).toBe(0);
      expect(arq.caminho[i]).toBe(0);
      expect(arq.obstaculos[i]).toBe(255);
      expect(naPlataforma(arq.plataforma, i % n, Math.floor(i / n))).toBe(false);
    }
    expect(arq.inicio.aldeia.length).toBe(1);
  });

  it("é determinística: a mesma semente dá o mesmo mapa", () => {
    const a = gerarArquipelago(ARQUIPELAGO.semente);
    const b = gerarArquipelago(ARQUIPELAGO.semente);
    expect(Array.from(a.ilha)).toEqual(Array.from(b.ilha));
    expect(Array.from(a.obstaculos)).toEqual(Array.from(b.obstaculos));
    expect(Array.from(a.terreno)).toEqual(Array.from(b.terreno));
    expect(arquipelagoDaEra1()).toBe(arquipelagoDaEra1());
  });
});
