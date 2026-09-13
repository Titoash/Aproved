/** Ilha-tabuleiro da Era 1, regiões, vagas e escalas (GDD §2.4, §6, §8.5). Números do jogo: nada disto na UI ou na cena. */
import type { RegiaoId, TipoRegiao } from "../sim/ilha";
import type { UsinaId } from "../sim/state";

export const ILHA = {
  /** Lado da grade que contém a ilha. */
  n: 52,
  /** Casas de terra, exatas. */
  totalCasas: 2048,
  /** Semente da Era 1: a ilha é a mesma para todo jogador. */
  semente: 7,
  /** Plataforma do Núcleo (a Grade 7×7 é o último upgrade da era). */
  ladoPlataforma: 7,
  /** Faixa de grama em volta da plataforma que pertence à região do Núcleo. */
  margemNucleo: 2,
  /** Superelipse da forma: raio em casas e expoente. */
  raio: 24.5,
  expoente: 2.6,
  /** Raio do lago em casas. */
  raioLago: 4.9,
} as const;

/** Categorias de vaga: cada item da Rede ocupa uma vaga da própria categoria. */
export type CategoriaVaga = "vento" | "sol" | "vila" | "bateria";

export const CATEGORIA_VAGA: Record<UsinaId | "vila" | "bateria", CategoriaVaga> = {
  cataVento: "vento",
  turbinaEolica: "vento",
  painelSolar: "sol",
  vila: "vila",
  bateria: "bateria",
};

export interface RegiaoDef {
  id: RegiaoId;
  nome: string;
  tipo: TipoRegiao;
  /** Ângulo da semente na grade, em graus (0 = +x, 90 = +y), e raio em casas a partir do centro. */
  ang: number;
  r: number;
  /** Peso aditivo do Voronoi (maior = região maior). */
  peso: number;
  /** Vagas por categoria. Regiões sem vagas são cenário. */
  vagas: Partial<Record<CategoriaVaga, number>>;
  /** Preço para desbloquear; ausente = desbloqueada desde o início. */
  preco?: number;
}

/** Ordem = índice da região na ilha. A primeira é sempre o Núcleo. */
export const REGIOES: readonly RegiaoDef[] = [
  { id: "nucleo", nome: "Núcleo", tipo: "nucleo", ang: 0, r: 0, peso: 0, vagas: {} },
  { id: "vento", nome: "Campo dos Ventos", tipo: "vento", ang: 315, r: 15, peso: 3, vagas: { vento: 48 } },
  { id: "vila", nome: "Vila", tipo: "vila", ang: 150, r: 14, peso: 3, vagas: { vila: 32, bateria: 8 } },
  { id: "sol", nome: "Planalto Solar", tipo: "sol", ang: 225, r: 15, peso: 0, vagas: { sol: 36 } },
  { id: "lago", nome: "Lago", tipo: "lago", ang: 40, r: 15, peso: 0, vagas: {} },
  { id: "floresta", nome: "Floresta", tipo: "floresta", ang: 200, r: 15, peso: -1, vagas: {} },
  { id: "planicie", nome: "Planície", tipo: "livre", ang: 270, r: 16, peso: -2, vagas: { vento: 12, sol: 9, vila: 6 }, preco: 2400 },
  { id: "colinas", nome: "Colinas", tipo: "livre", ang: 90, r: 17, peso: -2, vagas: { vento: 14, sol: 11, vila: 8 }, preco: 6800 },
];

export const REGIOES_INICIAIS: readonly RegiaoId[] = ["nucleo", "vento", "vila", "sol", "lago", "floresta"];

export function regiaoDef(id: RegiaoId): RegiaoDef {
  const def = REGIOES.find((r) => r.id === id);
  if (!def) throw new Error(`Região desconhecida: ${id}`);
  return def;
}

/** Vagas: fileiras em quincôncio (a cada 2 casas, deslocadas), distância mínima à borda por categoria. */
export const VAGAS = {
  distanciaMinimaBorda: { vento: 2, sol: 2, vila: 2, bateria: 2 } as Record<CategoriaVaga, number>,
  /** Vilas e baterias encostam nos caminhos quando há caminho na região. */
  quincuncio: (x: number, y: number): boolean => y % 2 === 0 && (x + (y >> 1)) % 2 === 0,
} as const;

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
  { id: "ilha", titulo: "Ilha", tipo: "até Tipo I", potenciaW: null, potenciaTexto: "", descricao: "A colina onde tudo começa: 2048 casas, a Torre Solar no meio." },
  { id: "planeta", titulo: "Planeta", tipo: "Tipo I", potenciaW: null, potenciaTexto: "10¹⁶ W", descricao: "O globo inteiro: outras ilhas viram novos locais quando a Era 3 chegar." },
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
