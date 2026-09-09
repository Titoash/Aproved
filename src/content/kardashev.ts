/** Medidor Kardashev (GDD §6): escala log de potência instalada com marcos reais. */

export interface MarcoKardashev {
  id: string;
  nome: string;
  watts: number;
  texto: string;
  /** Marco auxiliar (desenhado menor). */
  auxiliar?: boolean;
}

export const MARCOS_KARDASHEV: readonly MarcoKardashev[] = [
  { id: "megawatt", nome: "1 MW", watts: 1e6, texto: "K = 0: a escala de Sagan começa aqui.", auxiliar: true },
  { id: "humanidade", nome: "Humanidade (2026)", watts: 2e13, texto: "Tudo o que a civilização usa hoje, ~20 TW." },
  { id: "tipoI", nome: "Tipo I", watts: 1e16, texto: "Toda a energia que chega do Sol ao planeta." },
  { id: "tipoII", nome: "Tipo II", watts: 1e26, texto: "Toda a energia de uma estrela." },
  { id: "sol", nome: "Sol", watts: 3.8e26, texto: "A luminosidade real do Sol." },
];

export const ESCALA_KARDASHEV = {
  /** Extremos da barra, em W (log10). */
  minW: 1e3,
  maxW: 1e27,
  /** K = (log10 P − base) ÷ divisor (Sagan). */
  base: 6,
  divisor: 10,
} as const;
