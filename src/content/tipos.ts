/**
 * Tipos compartilhados pelo conteúdo das eras. Só interfaces: nenhum número
 * mora aqui (CLAUDE.md, regra 3).
 *
 * A ideia que faz o sim ser agnóstico de era é o **papel** da peça. A Torre
 * Solar e o Reator PWR têm os mesmos quatro papéis com nomes e números
 * diferentes — heliostato e vareta aquecem, turbina e gerador convertem,
 * radiador e bomba dissipam, tanque e pressurizador armazenam. O sim raciocina
 * sobre papéis; só o conteúdo sabe os nomes.
 */
import type { Era, NucleoTipo, PecaId, UsinaId } from "../sim/state";

export type Anel = 1 | 2 | 3;

export type PapelPeca = "aquece" | "converte" | "dissipa" | "armazena";

export interface PecaDef {
  id: PecaId;
  nome: string;
  nomePlural: string;
  descricao: string;
  custo: number;
  /** Anéis onde a peça pode ser colocada (anel 1 = as 8 vizinhas do centro, diagonais incluídas). */
  aneis: readonly Anel[];
  /** A peça só produz efeito se estiver adjacente ao centro (anel 1). */
  efeitoSoAdjacente: boolean;
  papel: PapelPeca;
  /**
   * O número da peça, lido conforme o papel:
   * `aquece` → u/s injetadas no anel 1 · `dissipa` → u/s dissipadas ·
   * `armazena` → u de capacidade somadas · `converte` → não usado (os números
   * do conversor são da era inteira, ver `DefinicaoNucleo`).
   */
  valor: number;
  /** A peça consome combustível enquanto aquece (Era 2, GDD §8.5.4). */
  queima?: boolean;
}

/** Combustível e calor de decaimento (GDD §8.5.4 e §8.5.5). Só eras que têm peça que queima. */
export interface DefinicaoCombustivel {
  /** Fração queimada por segundo no anel 1 (o anel 2 queima proporcional ao peso). */
  taxaPorSegundo: number;
  /** Recarregar custa esta fração do preço da peça. */
  fracaoRecarga: number;
  decaimento: {
    /** Fração da entrada nominal emitida no instante em que a peça para de fissionar. */
    fracao: number;
    meiaVidaMs: number;
    /** Abaixo disto o decaimento conta como zero e a peça pode ser removida. */
    corteUs: number;
  };
}

export interface DefinicaoNucleo {
  tipo: NucleoTipo;
  /** Nome da peça central: "Receptor" na Era 1, "Vaso do reator" na Era 2. */
  nomeCentro: string;
  /** Lado da grade ao entrar na era. */
  ladoInicial: number;
  /** Capacidade da peça central, em u. */
  capacidadeCentroU: number;
  /**
   * Peso do calor injetado por anel, índices 0, 1 e 2 para os anéis 1, 2 e 3.
   * Cada era tem **um** tipo de peça que aquece, então o peso é do anel, não da peça.
   */
  pesosAnel: readonly [number, number, number];
  /** Fração do calor armazenado que cada conversor consome por segundo. */
  consumoConversor: number;
  /** kW gerados por u consumida pelo conversor. */
  kwPorUnidade: number;
  /** Pesquisa/s = potência (kW) × este fator × multiplicador da faixa de calor (GDD §7). */
  pesquisaPorKw: number;
  pecas: Readonly<Partial<Record<PecaId, PecaDef>>>;
  ordemPecas: readonly PecaId[];
  combustivel?: DefinicaoCombustivel;
}

export interface Desbloqueio {
  /** Desbloqueia ao possuir pelo menos N unidades da usina indicada. */
  usina?: [UsinaId, number];
  /** Pesquisa (🔬) acumulada necessária. */
  pesquisa?: number;
}

export interface UsinaDef {
  id: UsinaId;
  nome: string;
  nomePlural: string;
  descricao: string;
  custoBase: number;
  /** Fator de crescimento do custo por unidade comprada (GDD §7). */
  crescimento: number;
  potenciaKw: number;
  desbloqueio?: Desbloqueio;
  /** Era em que a usina entra na lista. */
  era: Era;
}

export interface ItemDef {
  nome: string;
  nomePlural: string;
  descricao: string;
  custoBase: number;
  crescimento: number;
  desbloqueio?: Desbloqueio;
}

/** Uma era inteira: o que a Rede oferece, quanto vale a energia e qual é o Núcleo. */
export interface DefinicaoEra {
  id: Era;
  nome: string;
  /** Cenário do fundo (GDD §6). */
  cenario: string;
  /** ₵ por kW·s (GDD §7). */
  precoBase: number;
  /** Demanda que a era acrescenta à base ao ser inaugurada. */
  demandaInicialKw: number;
  /** Item que aumenta a demanda: Vila na Era 1, Cidade na Era 2. */
  consumidor: ItemDef & { demandaKw: number };
  bateria: ItemDef & { capacidadeKwh: number; potenciaKw: number };
  nucleo: DefinicaoNucleo;
}
