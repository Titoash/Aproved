/**
 * Cidade da Era 2 (GDD Parte 2 §4.1): as densidades 5 e 6. Só dados.
 *
 * A curva de ₵ continua quase exponencial e dá um salto de escala a partir da megacidade — a era subiu
 * ×100 em potência, e a cidade acompanha. A de 🔬 continua ×5 por degrau. Bairros novos continuam
 * baratos: colocar é fácil, **evoluir** é o gasto.
 */
import type { DensidadeDef } from "./cidade-tipos";

export const DENSIDADES_ERA2: readonly DensidadeDef[] = [
  {
    densidade: 5,
    nome: "Megacidade",
    nomePlural: "Megacidades",
    descricao: "Vinte e cinco mil pessoas num quarteirão vertical, com trem e data center.",
    demandaKw: 400,
    populacao: 25_000,
    tarifa: 1.7,
    evolucao: { creditos: 244_000, pesquisa: 15_000 },
    no: "megacidade",
  },
  {
    densidade: 6,
    nome: "Arcologia",
    nomePlural: "Arcologias",
    descricao: "Uma cidade inteira dentro de um prédio: cem mil habitantes e 1,5 MW sem piscar.",
    demandaKw: 1_500,
    populacao: 100_000,
    tarifa: 2,
    evolucao: null,
    no: "arcologia",
  },
];
