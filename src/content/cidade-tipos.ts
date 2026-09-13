/** Tipos da cidade, compartilhados pelas duas eras (GDD §8.6 e Parte 2 §4.1). */

/** 1 = aldeia … 4 = metrópole (Era 1); 5 = megacidade, 6 = arcologia (Era 2). */
export type Densidade = 1 | 2 | 3 | 4 | 5 | 6;

export interface DensidadeDef {
  densidade: Densidade;
  nome: string;
  nomePlural: string;
  descricao: string;
  /** kW que o bairro pede. */
  demandaKw: number;
  /** Habitantes. */
  populacao: number;
  /** Multiplicador do preço por kW vendido (GDD §7). */
  tarifa: number;
  /** Custo de evoluir para a densidade seguinte; `null` na última. */
  evolucao: { creditos: number; pesquisa: number } | null;
  /** Nó da árvore que libera **esta** densidade (GDD Parte 2 §4.1). */
  no?: string;
}
