/** Tipos dos capítulos, compartilhados pelas duas eras (GDD §12 e Parte 2 §7). */
import type { PecaId, TipoConstrucao } from "../sim/state";
import type { IlhaId, TipoTerreno } from "./era1-arquipelago";

export type CondicaoCapitulo =
  /** Ter `n` construções do tipo (opcionalmente num terreno). */
  | { tipo: "construcoes"; construcao: TipoConstrucao; n: number; terreno?: TipoTerreno }
  /** Ter um bairro na densidade pedida ou acima. */
  | { tipo: "densidade"; minima: number }
  /** População total. */
  | { tipo: "populacao"; n: number }
  /** Nós da árvore comprados (sem contar os que nascem prontos). */
  | { tipo: "pesquisados"; n: number }
  /** Núcleo desbloqueado. */
  | { tipo: "nucleo" }
  /** Era em curso (o reator construído é a Era 2). */
  | { tipo: "era"; minima: 1 | 2 }
  /** Peças do Núcleo de um tipo. */
  | { tipo: "pecas"; peca: PecaId; n: number }
  /** A balança da Rede na zona de ouro. */
  | { tipo: "zonaDeOuro" }
  /** Estabilidade em `valor` % ou mais. */
  | { tipo: "estabilidade"; valor: number }
  /** Potência instalada, em kW. */
  | { tipo: "potenciaKw"; kw: number }
  /** Potência do próprio Núcleo, em kW (a zona de ouro do reator). */
  | { tipo: "potenciaNucleoKw"; kw: number }
  /** Trocas de vareta feitas com o calor na zona de ouro (GDD Parte 2 §7). */
  | { tipo: "trocaEmFaixa"; n: number }
  /** Ilha aberta pela expedição. */
  | { tipo: "ilhaAberta"; ilha: IlhaId }
  /** Ilha ligada por cabo submarino. */
  | { tipo: "cabo"; ilha: IlhaId }
  /** Obstáculos já removidos. */
  | { tipo: "desmatados"; n: number };

export interface CapituloDef {
  id: string;
  titulo: string;
  /** Uma linha do que fazer. */
  objetivo: string;
  condicao: CondicaoCapitulo;
  recompensa: { creditos?: number; pesquisa?: number };
  /** Era a que o capítulo pertence (a fila do HUD é a da era em curso). */
  era?: 1 | 2;
}
