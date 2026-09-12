/**
 * Regras que valem em **todas** as eras (GDD §4.1, §4.2, §5, §7, §8.5.7).
 *
 * Moravam em `era1.ts` e `era1-nucleo.ts` porque a Era 1 foi a primeira a
 * existir, não porque sejam dela. O §8.5.7 é explícito: Cascata, modo seguro e
 * offline têm os mesmos números na Era 2. Ficam aqui para que `src/sim/` leia
 * regras sem importar o conteúdo de uma era específica.
 */

/* ------------------------------------------------------------------ */
/* Balança do Calor (GDD §4.2)                                         */
/* ------------------------------------------------------------------ */

export type FaixaCalorId = "frio" | "normal" | "ouro" | "alerta" | "critico";

export interface FaixaCalor {
  id: FaixaCalorId;
  nome: string;
  /** Limite superior de T = Q ÷ capacidade. */
  ate: number;
  ateInclusivo: boolean;
  /** Multiplicador de pesquisa. */
  pesquisa: number;
  /** Estabilidade ganha por minuto de operação nesta faixa. */
  estabilidadePorMinuto: number;
}

/**
 *   T < 40 %          frio      pesquisa ×0,5
 *   40 % ≤ T < 70 %   normal    ×1
 *   70 % ≤ T ≤ 90 %   ouro      ×1,3, Estabilidade acelerada
 *   90 % < T ≤ 100 %  alerta    ×1
 *   T > 100 %         crítico   conta o cronômetro da Cascata
 */
export const FAIXAS_CALOR: readonly FaixaCalor[] = [
  { id: "frio", nome: "Frio", ate: 0.4, ateInclusivo: false, pesquisa: 0.5, estabilidadePorMinuto: 1.5 },
  { id: "normal", nome: "Normal", ate: 0.7, ateInclusivo: false, pesquisa: 1, estabilidadePorMinuto: 1.5 },
  { id: "ouro", nome: "Zona de ouro", ate: 0.9, ateInclusivo: true, pesquisa: 1.3, estabilidadePorMinuto: 2.5 },
  { id: "alerta", nome: "Alerta", ate: 1, ateInclusivo: true, pesquisa: 1, estabilidadePorMinuto: 1.5 },
  { id: "critico", nome: "Crítico", ate: Infinity, ateInclusivo: true, pesquisa: 1, estabilidadePorMinuto: 0 },
];


/* ------------------------------------------------------------------ */
/* Cascata e modo seguro (GDD §5, §8.5.7)                              */
/* ------------------------------------------------------------------ */

/** Cascata (GDD §5). */
export const CASCATA = {
  /** T acima deste valor conta o cronômetro. */
  limiarT: 1,
  /** Tempo contínuo acima do limiar até a Cascata, em ms. */
  atrasoMs: 5000,
  perdaEstabilidade: 30,
  scramMs: 20_000,
  /** Fração da carga da bateria perdida. */
  perdaBateria: 0.1,
  /** Reconstruir uma peça de entulho custa esta fração do preço. */
  fracaoReconstrucao: 0.5,
  /** Limpar entulho sem reconstruir é grátis depois deste tempo. */
  limpezaGratisMs: 30_000,
} as const;

/** Modo seguro (GDD §5): SCRAM automático e potência reduzida. */
export const MODO_SEGURO = {
  limiarT: 0.95,
  fatorPotencia: 0.7,
} as const;

/* ------------------------------------------------------------------ */
/* Balança Oferta × Demanda (GDD §4.1)                                 */
/* ------------------------------------------------------------------ */

export type FaixaId = "apagao" | "neutroBaixo" | "zonaDeOuro" | "neutroAlto" | "saturacao";

export interface FaixaR {
  id: FaixaId;
  nome: string;
  /** Limite superior da faixa. */
  ate: number;
  /** Se o limite superior pertence à faixa. */
  ateInclusivo: boolean;
  multiplicador: number;
}

/**
 * Faixas da razão r = oferta ÷ demanda, em ordem crescente.
 *
 *   r < 0,8          apagão        ×0,5   (multa contratual)
 *   0,8 ≤ r < 0,9    neutro        ×1
 *   0,9 ≤ r ≤ 1,1    zona de ouro  ×1,25
 *   1,1 < r ≤ 1,25   neutro        ×1
 *   r > 1,25         saturação     ×0,75  (excedente vai para a bateria, o resto é desperdiçado)
 */
export const FAIXAS_R: readonly FaixaR[] = [
  { id: "apagao", nome: "Apagão", ate: 0.8, ateInclusivo: false, multiplicador: 0.5 },
  { id: "neutroBaixo", nome: "Neutro", ate: 0.9, ateInclusivo: false, multiplicador: 1 },
  { id: "zonaDeOuro", nome: "Zona de ouro", ate: 1.1, ateInclusivo: true, multiplicador: 1.25 },
  { id: "neutroAlto", nome: "Neutro", ate: 1.25, ateInclusivo: true, multiplicador: 1 },
  { id: "saturacao", nome: "Saturação", ate: Infinity, ateInclusivo: true, multiplicador: 0.75 },
];

/* ------------------------------------------------------------------ */
/* Economia (GDD §7)                                                   */
/* ------------------------------------------------------------------ */

/** Melhoria por nível (GDD §7): custo `custoBase × 3^nível`, produção `× (1 + 0,5 × nível)`. */
export const MELHORIA = {
  crescimento: 3,
  bonusPorNivel: 0.5,
} as const;

/* ------------------------------------------------------------------ */
/* Offline (GDD §7)                                                    */
/* ------------------------------------------------------------------ */

export const OFFLINE = {
  /** Janela máxima creditada: 8 h. */
  janelaMaxMs: 8 * 60 * 60 * 1000,
  /** Receita da Rede offline, sobre o balanço congelado sem bateria. */
  fatorRede: 0.5,
  /** Núcleo em modo seguro obrigatório: potência, pesquisa e Estabilidade × este fator. */
  fatorNucleo: 0.7,
  /** Só mostra o relatório "Enquanto você esteve fora" a partir desta ausência. */
  minimoRelatorioMs: 60_000,
} as const;

