/**
 * Tipos da árvore de pesquisa, compartilhados pelas duas eras (GDD §8.6 e Parte 2 §6).
 * Só tipos e a lista de ramos: os nós de cada era vivem em `arvore-era1.ts` e `arvore-era2.ts`.
 */
import type { PecaId, TipoConstrucao, UsinaId } from "../sim/state";

export type RamoId = "vento" | "sol" | "rede" | "nucleo" | "cidade" | "fissao" | "termica" | "offshore" | "rede2" | "cidade2";

export interface RamoDef {
  id: RamoId;
  nome: string;
  descricao: string;
  /** Era a que o ramo pertence: a tela da árvore tem uma aba por era. */
  era: 1 | 2;
}

/** O que um nó muda. Tudo é lido pelo sim; nada é copiado para a UI. */
export type EfeitoNo =
  /** Potência das usinas listadas × `fator`. */
  | { tipo: "potenciaUsinas"; usinas: readonly UsinaId[]; fator: number }
  /** Perda de esteira por vizinho eólico × `fator` (0 = sem esteira). */
  | { tipo: "esteira"; fator: number }
  /** Alcance da subestação, em casas. */
  | { tipo: "alcanceSubestacao"; casas: number }
  /** Capacidade de cada bateria × `fator`. */
  | { tipo: "capacidadeBateria"; fator: number }
  /** Demanda de cada bairro × `fator` (a tarifa não muda). */
  | { tipo: "demandaBairro"; fator: number }
  /** Tarifa × `fator`. */
  | { tipo: "tarifa"; fator: number }
  /** Calor que um Heliostato do anel 1 injeta, em u/s (valor absoluto). */
  | { tipo: "calorPorEspelho"; valor: number }
  /** Calor de todos os espelhos × `fator`. */
  | { tipo: "calorEspelhoFator"; fator: number }
  /** kW por u consumida pela Turbina a vapor da Era 1 × `fator`. */
  | { tipo: "turbinaKwFator"; fator: number }
  /** Radiador ativo: dissipa `dissipacao` u/s e consome `consomeKw` da potência do Núcleo. */
  | { tipo: "radiadorAtivo"; dissipacao: number; consomeKw: number }
  /** Capacidade de cada Tanque de sal × `fator`. */
  | { tipo: "capacidadeTanque"; fator: number }
  /** Capacidade do Receptor +50 u (o Receptor cerâmico de §8.3). */
  | { tipo: "receptorCeramico" }
  /** Lado da grade do Núcleo. */
  | { tipo: "gradeLado"; lado: number }
  /** Libera um prédio na paleta de construção. */
  | { tipo: "desbloqueia"; construcao: TipoConstrucao }
  /** Libera uma peça na paleta do Núcleo. */
  | { tipo: "desbloqueiaPeca"; peca: PecaId }
  /* --- Era 2 (GDD Parte 2 §6) --- */
  /** Calor de cada vareta × `fator` (enriquecimento, água pesada). */
  | { tipo: "varetaCalor"; fator: number }
  /** Vida de cada vareta × `fator` (MOX, água pesada, alta temperatura). */
  | { tipo: "varetaVida"; fator: number }
  /** kW por u consumida pela turbina de alta pressão × `fator`. */
  | { tipo: "reatorKwFator"; fator: number }
  /** Teto de todos os cabos submarinos × `fator` (HVDC). */
  | { tipo: "tetoCabo"; fator: number }
  /** Combustível das térmicas × `fator` (captura de carbono cobra mais). */
  | { tipo: "combustivel"; fator: number }
  /** Efeito da térmica na tarifa dos bairros a ≤ 2 casas (−10 % vira +10 % com cogeração). */
  | { tipo: "vizinhancaTermica"; delta: number }
  /** Energia e potência da bateria de rede × `fator`. */
  | { tipo: "bateriaRede"; fator: number }
  /** Eólica offshore passa a caber em mar fundo (fundação flutuante). */
  | { tipo: "marFundo" };

export interface NoDef {
  id: string;
  ramo: RamoId;
  /** Era do nó: a tela da árvore separa por aba. */
  era: 1 | 2;
  nome: string;
  /** O que o nó faz, em linguagem de jogo. */
  efeitoTexto: string;
  /** Uma frase de física de verdade (GDD §9). */
  fisica: string;
  /** 🔬 gastos. */
  pesquisa: number;
  /** ₵ gastos junto, quando o nó também custa dinheiro. */
  creditos?: number;
  /** Nós exigidos antes deste. */
  pre?: readonly string[];
  /** Nós que este nó torna impossíveis (escolha exclusiva). */
  exclui?: readonly string[];
  /** Só aparece com a era em curso (os nós da Era 2 não vazam para a Era 1). */
  eraMinima?: 1 | 2;
  efeitos: readonly EfeitoNo[];
}
