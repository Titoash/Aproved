/** Medidor Kardashev (GDD §6): escala log de potência instalada com marcos reais. */

export interface MarcoKardashev {
  id: string;
  nome: string;
  /** Rótulo para telas estreitas. */
  nomeCurto: string;
  watts: number;
  texto: string;
  /** Marco auxiliar (desenhado menor). */
  auxiliar?: boolean;
  /** Acima do Sol não há marco físico: ficção declarada (GDD §6, v0.5). */
  especulativo?: boolean;
}

export const MARCOS_KARDASHEV: readonly MarcoKardashev[] = [
  { id: "megawatt", nome: "1 MW", nomeCurto: "1 MW", watts: 1e6, texto: "K = 0: a escala de Sagan começa aqui.", auxiliar: true },
  { id: "humanidade", nome: "Humanidade (2026)", nomeCurto: "Hoje", watts: 2e13, texto: "Tudo o que a civilização usa hoje, ~20 TW." },
  { id: "tipoI", nome: "Tipo I", nomeCurto: "I", watts: 1e16, texto: "Toda a energia que chega do Sol ao planeta." },
  { id: "tipoII", nome: "Tipo II", nomeCurto: "II", watts: 1e26, texto: "Toda a energia de uma estrela." },
  { id: "sol", nome: "Sol", nomeCurto: "Sol", watts: 3.8e26, texto: "A luminosidade real do Sol." },
  { id: "tipoIII", nome: "Tipo III", nomeCurto: "III", watts: 1e36, texto: "Toda a energia de uma galáxia." },
  { id: "tipoIV", nome: "Tipo IV", nomeCurto: "IV", watts: 1e46, texto: "Especulativo: a energia de um universo observável.", especulativo: true },
  { id: "tipoV", nome: "Tipo V", nomeCurto: "V", watts: 1e50, texto: "Especulativo: além de um universo.", especulativo: true },
];

export const ESCALA_KARDASHEV = {
  /** Extremos da barra, em W (log10). */
  minW: 1e3,
  maxW: 1e50,
  /** Acima disto a potência aparece só em notação científica (prefixos SI param no yotta). */
  maxSiW: 1e24,
  /** K = (log10 P − base) ÷ divisor (Sagan). */
  base: 6,
  divisor: 10,
} as const;
