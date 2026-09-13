/**
 * Migração v5 → v6 (GDD §2.1, v0.6): a Rede deixa de ser contagem e passa a ser colocação.
 *
 * As unidades do save antigo são colocadas uma única vez na ilha principal, em casas livres perto da
 * plataforma, e cada grupo sem escoamento ganha uma subestação (de graça: o jogador já tinha pago pelas
 * usinas). O que não couber vira crédito de ₵ com reembolso integral do que aquelas unidades custaram.
 * TypeScript puro e determinístico.
 */
import { BATERIA } from "../content/era1";
import { USINAS } from "../content/usinas";
import { BAIRRO } from "../content/cidade-era1";
import { SUBESTACAO } from "../content/era1-arquipelago";
import { custoUnidade } from "./custos";
import { arquipelagoDaEra1 } from "./gerarArquipelago";
import { naPlataforma } from "./arquipelago";
import { mundoInicial, type Construcao, type MundoState, type TipoConstrucao, type UsinaId } from "./state";

export interface ResultadoMigracao {
  mundo: MundoState;
  /** ₵ devolvidos pelas unidades que não couberam. */
  reembolso: number;
  /** Quantas unidades não couberam, por tipo. */
  excedentes: Partial<Record<TipoConstrucao, number>>;
}

const ORDEM: readonly TipoConstrucao[] = ["cataVento", "turbinaEolica", "painelSolar", "bairro", "bateria"];

function custoDe(tipo: TipoConstrucao): { custoBase: number; crescimento: number } {
  if (tipo === "bairro") return BAIRRO;
  if (tipo === "bateria") return BATERIA;
  if (tipo === "subestacao") return SUBESTACAO;
  return USINAS[tipo as UsinaId];
}

/** Coloca `contagens` unidades na ilha principal, em casas livres ordenadas pela distância à plataforma. */
export function migrarParaMundo(contagens: Partial<Record<TipoConstrucao, number>>): ResultadoMigracao {
  const arq = arquipelagoDaEra1();
  const n = arq.n;
  const mundo = mundoInicial();
  const construcoes: Record<number, Construcao> = { ...mundo.construcoes };
  const ocupada = (i: number) => construcoes[i] !== undefined;

  const meio = arq.plataforma.meio;
  const livres = arq.ilhas[0].casas
    .filter((i) => arq.obstaculos[i] === 255 && arq.caminho[i] === 0 && !naPlataforma(arq.plataforma, i % n, Math.floor(i / n)))
    .sort((a, b) => {
      const da = Math.hypot((a % n) - meio, Math.floor(a / n) - meio);
      const db = Math.hypot((b % n) - meio, Math.floor(b / n) - meio);
      return da - db || a - b;
    });

  let cursor = 0;
  let reembolso = 0;
  const excedentes: Partial<Record<TipoConstrucao, number>> = {};
  const colocadas: number[] = [];

  for (const tipo of ORDEM) {
    const quantos = Math.max(0, Math.floor(contagens[tipo] ?? 0));
    for (let k = 0; k < quantos; k++) {
      while (cursor < livres.length && ocupada(livres[cursor])) cursor++;
      if (cursor >= livres.length) {
        excedentes[tipo] = (excedentes[tipo] ?? 0) + 1;
        reembolso += custoUnidade(custoDe(tipo), k);
        continue;
      }
      const casa = livres[cursor++];
      construcoes[casa] = { tipo, nivel: 0, colocadoEmMs: 0 };
      colocadas.push(casa);
    }
  }

  // Subestações de cortesia: toda usina/bairro colocado pela migração precisa de escoamento.
  const cheb = (a: number, b: number) => Math.max(Math.abs((a % n) - (b % n)), Math.abs(Math.floor(a / n) - Math.floor(b / n)));
  const subestacoes = Object.keys(construcoes)
    .map(Number)
    .filter((i) => construcoes[i].tipo === "subestacao");
  for (const casa of colocadas) {
    if (construcoes[casa].tipo === "bateria") continue;
    if (subestacoes.some((s) => cheb(s, casa) <= SUBESTACAO.alcance)) continue;
    const vaga = livres.find((i) => !ocupada(i) && cheb(i, casa) <= SUBESTACAO.alcance);
    if (vaga === undefined) continue;
    construcoes[vaga] = { tipo: "subestacao", nivel: 0, colocadoEmMs: 0 };
    subestacoes.push(vaga);
  }

  return { mundo: { ...mundo, construcoes }, reembolso, excedentes };
}
