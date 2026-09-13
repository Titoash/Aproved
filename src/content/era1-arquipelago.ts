/**
 * Arquipélago da Era 1 (GDD §2.4, §7, §8.5, v0.6). Só números e textos: nenhuma regra aqui.
 * A geometria é derivada disto por `sim/gerarArquipelago.ts`; o que o jogador muda vive em `GameState.mundo`.
 */

export type IlhaId = "principal" | "ventania" | "solar" | "costa" | "bosque" | "pedreira" | "recife" | "farol";

/** Chão da casa. `agua` não é casa: o mar é a ausência de terra. */
export type TipoTerreno = "planicie" | "colina" | "litoral" | "rocha";

/** O que nasce ocupando casas. Floresta e pântano são obstáculos sobre planície: desmatar devolve planície (GDD §2.4). */
export type TipoObstaculo = "arbusto" | "arvore" | "pedra" | "pantano" | "montanha" | "pico";

export const ARQUIPELAGO = {
  /** Lado da grade que contém o mar e as ilhas. */
  n: 64,
  /** Casas de terra, exatas, somando as 8 ilhas. */
  totalCasas: 2048,
  /** Semente da Era 1: o arquipélago é o mesmo para todo jogador. */
  semente: 11,
  /** Plataforma do Núcleo, na ilha principal. */
  ladoPlataforma: 7,
  /** Canal de mar mínimo entre duas ilhas, em casas. */
  canal: 2,
  /** Margem de mar na borda da grade. */
  margem: 2,
  /** Amplitude do ruído que deforma o crescimento (0 = ilhas redondas). */
  ruidoForma: 0.42,
  /** Casas em volta da plataforma e da aldeia que nascem livres de obstáculo. */
  clareiraPlataforma: 2,
  clareiraAldeia: 3,
} as const;

/* ------------------------------------------------------------------ */
/* Terreno (GDD §2.4)                                                  */
/* ------------------------------------------------------------------ */

export interface TerrenoDef {
  id: TipoTerreno;
  nome: string;
  /** Multiplicador da potência de usinas de vento. */
  vento: number;
  /** Multiplicador da potência de painéis solares. */
  sol: number;
  /** Aceita construção. */
  construivel: boolean;
}

export const TERRENOS: Record<TipoTerreno, TerrenoDef> = {
  planicie: { id: "planicie", nome: "Planície", vento: 1, sol: 1.15, construivel: true },
  colina: { id: "colina", nome: "Colina", vento: 1.25, sol: 1, construivel: true },
  litoral: { id: "litoral", nome: "Litoral", vento: 1.5, sol: 1, construivel: true },
  rocha: { id: "rocha", nome: "Rocha", vento: 1, sol: 1, construivel: true },
};

/* ------------------------------------------------------------------ */
/* Vizinhança (GDD §2.4)                                               */
/* ------------------------------------------------------------------ */

export const VIZINHANCA = {
  /** Esteira: cada vizinho eólico ortogonal tira 20 % de um cata-vento ou turbina eólica. */
  esteiraPorVizinho: 0.2,
  esteiraMinima: 0.4,
  /** Sombra: cada vizinho alto ortogonal tira 30 % de um painel. */
  sombraPorVizinho: 0.3,
  sombraMinima: 0.4,
  /** Pico permanente: +30 % de vento em cada vizinho ortogonal. */
  ventoPorPico: 0.3,
} as const;

/* ------------------------------------------------------------------ */
/* Obstáculos (GDD §8.5)                                               */
/* ------------------------------------------------------------------ */

export interface ObstaculoDef {
  id: TipoObstaculo;
  nome: string;
  descricao: string;
  /** ₵ da remoção. */
  custo: number;
  /** 🔬 exigido (acumulado, não gasto nesta sessão). */
  pesquisa?: number;
  /** Tempo de remoção, em ms de jogo. */
  tempoMs: number;
  /** 🔬 devolvidos ao cair (a montanha descobre cristais, GDD §9). */
  devolvePesquisa?: number;
  /** As casas liberadas ficam com cristal: laboratório e universidade rendem mais nelas (GDD §8.6). */
  deixaCristal?: boolean;
  /** Lado em casas (a montanha ocupa 2×2). */
  lado: number;
  /** Não sai nunca (pico). */
  permanente?: boolean;
  /** Faz sombra nos painéis vizinhos (GDD §2.4). */
  alto?: boolean;
}

export const OBSTACULOS: Record<TipoObstaculo, ObstaculoDef> = {
  arbusto: { id: "arbusto", nome: "Arbusto", descricao: "Mato rasteiro. Sai num puxão.", custo: 3, tempoMs: 1_000, lado: 1 },
  arvore: { id: "arvore", nome: "Árvore", descricao: "Derrubada vira planície — e faz sombra enquanto está de pé.", custo: 8, tempoMs: 3_000, lado: 1, alto: true },
  pedra: { id: "pedra", nome: "Pedra", descricao: "Um matacão. Precisa de máquina.", custo: 25, tempoMs: 8_000, lado: 1 },
  pantano: { id: "pantano", nome: "Pântano", descricao: "Drenar leva tempo e deixa planície.", custo: 60, tempoMs: 10_000, lado: 1 },
  montanha: {
    id: "montanha",
    nome: "Montanha",
    descricao: "Quatro casas de rocha. Explosivos, engenharia — e cristais no meio do entulho.",
    custo: 400,
    pesquisa: 20,
    tempoMs: 30_000,
    lado: 2,
    alto: true,
    devolvePesquisa: 40,
    deixaCristal: true,
  },
  pico: { id: "pico", nome: "Pico", descricao: "Permanente. Acelera o vento: +30 % em cada vizinho.", custo: 0, tempoMs: 0, lado: 1, permanente: true, alto: true },
};

export const ORDEM_OBSTACULOS: readonly TipoObstaculo[] = ["arbusto", "arvore", "pedra", "pantano", "montanha", "pico"];

/** Casa de rocha com cristal, deixada por uma montanha dinamitada (GDD §8.6, §9). */
export const CRISTAL = {
  nome: "Cristal",
  descricao: "Rocha com veios de cristal. Laboratório ou universidade aqui rende +50 %.",
  /** Bônus de 🔬 de laboratório e universidade sobre cristal. */
  bonusCiencia: 0.5,
} as const;

/* ------------------------------------------------------------------ */
/* Subestação e cabo (GDD §2.4, §8.5)                                  */
/* ------------------------------------------------------------------ */

export const SUBESTACAO = {
  nome: "Subestação",
  descricao: "Escoa o que as usinas produzem. Alcance 3 casas; acima do teto, a energia é desperdiçada.",
  custoBase: 120,
  crescimento: 1.25,
  /** Distância de Chebyshev. */
  alcance: 3,
  /** Teto de venda, em kW. */
  tetoKw: 40,
  /** Nível: custo × 3ⁿ, teto × 2ⁿ. */
  custoNivel: 3,
  tetoNivel: 2,
  /**
   * Nível máximo (ajuste 2 da Sessão 7): 40 → 80 → 160 → 320 kW. Com o bot instalando ~390 kW, uma
   * subestação só deixa de bastar e a segunda volta a ser decisão no fim da era (GDD §8.5).
   */
  nivelMax: 3,
} as const;

/**
 * Cabo submarino (GDD §8.5). Tem **teto próprio de kW**: ligar a ilha não basta, é preciso dimensionar o
 * cabo. Sem isso o cabo era uma trava (₵ 230–270 contra ₵ 600 a ₵ 100 mil das expedições), e não uma
 * decisão contínua — pendência 1 da Sessão 6, resolvida pelo item 1 dos ajustes da gestão.
 */
export const CABO = {
  nome: "Cabo submarino",
  /** ₵ fixos + ₵ por casa de mar. */
  custoFixo: 150,
  custoPorCasa: 120,
  /** Quanto o cabo leva entre a ilha e a rede principal, nos dois sentidos. */
  tetoKw: 30,
  /** Nível: custo × 3ⁿ sobre o preço da rota, teto × 2ⁿ (como a subestação). */
  custoNivel: 3,
  tetoNivel: 2,
} as const;

/* ------------------------------------------------------------------ */
/* As 8 ilhas (GDD §8.5)                                               */
/* ------------------------------------------------------------------ */

export interface IlhaDef {
  id: IlhaId;
  nome: string;
  /** Casas de terra, exatas. */
  casas: number;
  terrenoDominante: TipoTerreno;
  /** ₵ da expedição; `null` = aberta desde o início. */
  expedicao: number | null;
  /** Semente do crescimento: casa (x, y) na grade. */
  sx: number;
  sy: number;
  /** Peso do crescimento (maior = avança mais barato e ocupa a área melhor). */
  peso: number;
  /** Fração de colinas no interior (o litoral é sempre a borda). */
  colinas: number;
  /** Obstáculos por densidade (0..1 das casas livres). */
  densidade: Partial<Record<TipoObstaculo, number>>;
  /** Obstáculos por quantidade exata (montanha 2×2, pico). */
  quantidade: Partial<Record<TipoObstaculo, number>>;
  descricao: string;
}

/** A ordem é o índice da ilha na grade (`arquipelago.ilha`). A primeira é sempre a principal. */
export const ILHAS: readonly IlhaDef[] = [
  {
    id: "principal",
    nome: "Principal",
    casas: 640,
    terrenoDominante: "planicie",
    expedicao: null,
    sx: 32,
    sy: 32,
    peso: 1,
    colinas: 0.3,
    densidade: { arvore: 0.22, arbusto: 0.18, pedra: 0.09, pantano: 0.05 },
    quantidade: {},
    descricao: "Planície larga com colinas ao norte. A Torre fica aqui, e a aldeia também.",
  },
  {
    id: "ventania",
    nome: "Ventania",
    casas: 320,
    terrenoDominante: "colina",
    expedicao: 1_800,
    sx: 14,
    sy: 14,
    peso: 1.05,
    colinas: 0.72,
    densidade: { arvore: 0.14, arbusto: 0.08 },
    quantidade: { pico: 3 },
    descricao: "Colinas e três picos. O vento chega mais rápido e mais alto.",
  },
  {
    id: "solar",
    nome: "Solar",
    casas: 300,
    terrenoDominante: "planicie",
    expedicao: 5_400,
    sx: 50,
    sy: 50,
    peso: 1.05,
    colinas: 0.08,
    densidade: { arbusto: 0.22, pedra: 0.12 },
    quantidade: {},
    descricao: "Planície rasa e seca. Nada faz sombra aqui.",
  },
  {
    id: "costa",
    nome: "Costa",
    casas: 260,
    terrenoDominante: "litoral",
    expedicao: 13_500,
    sx: 50,
    sy: 14,
    peso: 1,
    colinas: 0.12,
    densidade: { pantano: 0.2, arvore: 0.18, arbusto: 0.08 },
    quantidade: {},
    descricao: "Litoral largo: muita borda, muito vento — e pântano para drenar.",
  },
  {
    id: "bosque",
    nome: "Bosque",
    casas: 220,
    terrenoDominante: "planicie",
    expedicao: 27_000,
    sx: 14,
    sy: 50,
    peso: 1,
    colinas: 0.18,
    densidade: { arvore: 0.86, arbusto: 0.08 },
    quantidade: {},
    descricao: "Floresta fechada. Cada casa aqui é uma árvore a derrubar.",
  },
  {
    id: "pedreira",
    nome: "Pedreira",
    casas: 160,
    terrenoDominante: "rocha",
    expedicao: 60_000,
    sx: 11,
    sy: 32,
    peso: 0.95,
    colinas: 0.55,
    densidade: { pedra: 0.3, arbusto: 0.06 },
    quantidade: { montanha: 4 },
    descricao: "Quatro montanhas e muita pedra. Cara de abrir, generosa depois.",
  },
  {
    id: "recife",
    nome: "Recife",
    casas: 96,
    terrenoDominante: "litoral",
    expedicao: 135_000,
    sx: 53,
    sy: 32,
    peso: 0.95,
    colinas: 0.05,
    densidade: { pedra: 0.26 },
    quantidade: {},
    descricao: "Quase só borda: vento de litoral em cada casa.",
  },
  {
    id: "farol",
    nome: "Farol",
    casas: 52,
    terrenoDominante: "rocha",
    expedicao: 300_000,
    sx: 32,
    sy: 12,
    peso: 0.95,
    colinas: 0.4,
    densidade: {},
    quantidade: { pico: 1 },
    descricao: "Um rochedo com um pico. Pequeno, vazio e ventoso.",
  },
];

export const ILHAS_INICIAIS: readonly IlhaId[] = ["principal"];

export function ilhaDef(id: IlhaId): IlhaDef {
  const def = ILHAS.find((i) => i.id === id);
  if (!def) throw new Error(`Ilha desconhecida: ${id}`);
  return def;
}

export const indiceIlha = (id: IlhaId): number => ILHAS.findIndex((i) => i.id === id);
