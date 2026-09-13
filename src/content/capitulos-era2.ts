/**
 * Capítulos da Era 2 (GDD Parte 2 §7). Só dados.
 *
 * Doze objetivos curtos, na ordem em que a era ensina: primeiro o reator existir, depois o combustível
 * acabar, depois a rede crescer em MW e a cidade acompanhar. As recompensas estão na régua da era.
 */
import type { CapituloDef } from "./capitulos-tipos";

export const CAPITULOS_ERA2: readonly CapituloDef[] = [
  {
    id: "oVaso",
    era: 2,
    titulo: "O Vaso",
    objetivo: "Construa o Reator: ₵ 200 000 e a Torre desmontada.",
    condicao: { tipo: "era", minima: 2 },
    recompensa: { creditos: 20_000 },
  },
  {
    id: "primeiraVareta",
    era: 2,
    titulo: "Primeira vareta",
    objetivo: "Ponha uma vareta de combustível na grade.",
    condicao: { tipo: "pecas", peca: "vareta", n: 1 },
    recompensa: { creditos: 15_000 },
  },
  {
    id: "ouro800",
    era: 2,
    titulo: "Zona de ouro a 800 kW",
    objetivo: "Leve o reator a 800 kW (6 varetas e 2 turbinas dão 83 %).",
    condicao: { tipo: "potenciaNucleoKw", kw: 800 },
    recompensa: { creditos: 30_000, pesquisa: 500 },
  },
  {
    id: "umaTorre",
    era: 2,
    titulo: "Uma torre de resfriamento",
    objetivo: "Ponha uma torre de resfriamento: é ela que segura o calor depois de um SCRAM.",
    condicao: { tipo: "pecas", peca: "torreResfriamento", n: 1 },
    recompensa: { creditos: 25_000 },
  },
  {
    id: "trocaEscalonada",
    era: 2,
    titulo: "Troca escalonada",
    objetivo: "Troque uma vareta sem o reator sair da zona de ouro.",
    condicao: { tipo: "trocaEmFaixa", n: 1 },
    recompensa: { creditos: 40_000, pesquisa: 1_000 },
  },
  {
    id: "cento38",
    era: 2,
    titulo: "138 kV",
    objetivo: "Coloque uma subestação de 138 kV.",
    condicao: { tipo: "construcoes", construcao: "subestacao138", n: 1 },
    recompensa: { creditos: 60_000 },
  },
  {
    id: "cincoOffshore",
    era: 2,
    titulo: "Cinco offshore",
    objetivo: "Coloque 5 eólicas offshore no mar raso.",
    condicao: { tipo: "construcoes", construcao: "eolicaOffshore", n: 5 },
    recompensa: { creditos: 80_000, pesquisa: 1_500 },
  },
  {
    id: "umaTermica",
    era: 2,
    titulo: "Uma térmica",
    objetivo: "Coloque uma térmica a gás — e veja o combustível no extrato.",
    condicao: { tipo: "construcoes", construcao: "termicaGas", n: 1 },
    recompensa: { creditos: 100_000 },
  },
  {
    id: "dezMW",
    era: 2,
    titulo: "10 MW instalados",
    objetivo: "Chegue a 10 MW de potência instalada.",
    condicao: { tipo: "potenciaKw", kw: 10_000 },
    recompensa: { creditos: 150_000, pesquisa: 3_000 },
  },
  {
    id: "megacidade",
    era: 2,
    titulo: "Megacidade",
    objetivo: "Leve um bairro à densidade 5.",
    condicao: { tipo: "densidade", minima: 5 },
    recompensa: { creditos: 200_000, pesquisa: 4_000 },
  },
  {
    id: "industria",
    era: 2,
    titulo: "Indústria",
    objetivo: "Coloque um distrito industrial e alimente os 3 MW dele.",
    condicao: { tipo: "construcoes", construcao: "distritoIndustrial", n: 1 },
    recompensa: { creditos: 300_000, pesquisa: 6_000 },
  },
  {
    id: "estabilidadeEra2",
    era: 2,
    titulo: "Estabilidade 100 %",
    objetivo: "Opere o reator até a Estabilidade chegar a 100 %.",
    condicao: { tipo: "estabilidade", valor: 100 },
    recompensa: { creditos: 500_000 },
  },
];
