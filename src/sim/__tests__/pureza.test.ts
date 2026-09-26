/**
 * O sim é TypeScript puro (CLAUDE.md, regra 1): nada de DOM, React, Phaser ou `localStorage` — a única
 * exceção é `sim/save.ts`, que é quem persiste. O loop recebe relógio e agendador de quem chama
 * (ajuste 8 da Sessão 8).
 */
import { describe, expect, it } from "vitest";

const fontes = import.meta.glob("../*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

/** Tira comentários de bloco e de linha: a regra vale para o código, não para a documentação. */
function semComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const PROIBIDOS = ["requestAnimationFrame", "cancelAnimationFrame", "window.", "document.", "performance.", "from \"react", "from \"phaser"];

describe("pureza do sim", () => {
  it("lê os módulos do sim", () => {
    expect(Object.keys(fontes).length).toBeGreaterThan(20);
  });

  for (const [arquivo, fonte] of Object.entries(fontes)) {
    it(`${arquivo} não usa nome de navegador nem de biblioteca de interface`, () => {
      const codigo = semComentarios(fonte);
      for (const nome of PROIBIDOS) expect(codigo.includes(nome), `${arquivo} usa ${nome}`).toBe(false);
      if (!arquivo.endsWith("/save.ts")) expect(codigo.includes("localStorage"), `${arquivo} usa localStorage`).toBe(false);
    });
  }
});
