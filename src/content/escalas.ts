/**
 * Escada de escalas: do arquipélago ao multiverso (GDD §2.4, §6). Só dados.
 * O nível 0 chama-se "Arquipélago"; o id `ilha` é interno e não aparece na interface.
 */

/* ------------------------------------------------------------------ */
/* Escalas (GDD §6, v0.5): do tabuleiro da ilha ao multiverso           */
/* ------------------------------------------------------------------ */

export type NivelId = "ilha" | "planeta" | "sistema" | "galaxia" | "universo" | "multiverso";

export interface NivelDef {
  id: NivelId;
  titulo: string;
  /** Tipo Kardashev atingido ao dominar o nível. */
  tipo: string;
  /** Potência instalada que abre o nível, em W; `null` = aberto desde o início. */
  potenciaW: number | null;
  /** Rótulo da potência em notação científica, PT-BR. */
  potenciaTexto: string;
  descricao: string;
  /** Acima do Sol não há marco físico: ficção declarada. */
  especulativo?: boolean;
}

export const NIVEIS: readonly NivelDef[] = [
  { id: "ilha", titulo: "Arquipélago", tipo: "até Tipo I", potenciaW: null, potenciaTexto: "", descricao: "Oito ilhas no mar, 2048 casas de terra e a Torre Solar na principal." },
  { id: "planeta", titulo: "Planeta", tipo: "Tipo I", potenciaW: null, potenciaTexto: "10¹⁶ W", descricao: "O globo inteiro: outros arquipélagos abrem quando a Era 3 chegar." },
  { id: "sistema", titulo: "Sistema", tipo: "Tipo II", potenciaW: 1e26, potenciaTexto: "10²⁶ W", descricao: "O Sol no centro e as vagas do enxame de Dyson em órbita." },
  { id: "galaxia", titulo: "Galáxia", tipo: "Tipo III", potenciaW: 1e36, potenciaTexto: "10³⁶ W", descricao: "Sistemas estelares como vagas nos braços da espiral." },
  { id: "universo", titulo: "Universo", tipo: "Tipo IV", potenciaW: 1e46, potenciaTexto: "10⁴⁶ W", descricao: "Galáxias nos nós da teia cósmica.", especulativo: true },
  { id: "multiverso", titulo: "Multiverso", tipo: "Tipo V", potenciaW: 1e50, potenciaTexto: "10⁵⁰ W", descricao: "Bolhas de universos ligadas por pontes finas.", especulativo: true },
];

export function nivelDef(id: NivelId): NivelDef {
  const def = NIVEIS.find((n) => n.id === id);
  if (!def) throw new Error(`Nível desconhecido: ${id}`);
  return def;
}
