/**
 * Textos do diário do tabuleiro (GDD Parte 1 §10.1, v0.8): uma linha curta por acontecimento, no molde de
 * `cardParaEvento`. Quem chama passa os nomes que dependem do mapa ou do nível; aqui só o texto.
 * As Ocorrências (Sessão 10) registram a oferta, o resultado e a recompensa.
 */
import type { EventoJogo } from "../sim/state";
import { NO_POR_ID } from "./arvore";
import { CAPITULO_POR_ID } from "./capitulos";
import { DENSIDADES } from "./cidade";
import { OBSTACULOS, ilhaDef, type TipoObstaculo } from "./era1-arquipelago";
import { OCORRENCIAS_DEF } from "./ocorrencias";

export interface ContextoDiario {
  /** Nome da ilha onde fica a casa ("Bosque"). */
  nomeIlha: (indice: number) => string;
  /** Nome do tipo que subiu de nível ("Cata-ventos"). */
  nomeDoNivel: (evento: Extract<EventoJogo, { tipo: "melhoria" }>) => string;
  formatarCreditos: (valor: number) => string;
}

/** "Árvore caiu em Bosque"; "12 obstáculos caíram em Bosque" quando vários caem juntos. */
export function textoDeRemocao(obstaculos: readonly TipoObstaculo[], ilha: string): string {
  if (obstaculos.length === 1) {
    const o = obstaculos[0];
    return o === "montanha" ? `Montanha dinamitada em ${ilha}: cristal` : `${OBSTACULOS[o].nome} caiu em ${ilha}`;
  }
  const montanhas = obstaculos.filter((o) => o === "montanha").length;
  return `${obstaculos.length} obstáculos caíram em ${ilha}${montanhas > 0 ? " · cristal" : ""}`;
}

/** Texto de um evento sozinho, ou `null` quando ele não vai para o diário. As remoções agrupam à parte. */
export function textoDoDiario(evento: EventoJogo, ctx: ContextoDiario): string | null {
  switch (evento.tipo) {
    case "obstaculoRemovido":
      return textoDeRemocao([evento.obstaculo], ctx.nomeIlha(evento.indice));
    case "capituloConcluido": {
      const r = CAPITULO_POR_ID[evento.id]?.recompensa;
      const partes = [r?.creditos ? `+${ctx.formatarCreditos(r.creditos)}` : null, r?.pesquisa ? `+🔬 ${r.pesquisa}` : null].filter(Boolean);
      return `Capítulo concluído${partes.length > 0 ? `: ${partes.join(" ")}` : ""}`;
    }
    case "varetaEsgotada":
      return `Vareta ${evento.indice} esgotou`;
    case "varetaTrocada":
      return `Vareta ${evento.indice} trocada`;
    case "noPesquisado":
      return `Pesquisado: ${NO_POR_ID[evento.id]?.nome ?? evento.id}`;
    case "ilhaAberta":
      return `Expedição chegou a ${ilhaDef(evento.id).nome}`;
    case "cidadeEvoluida":
      return `A cidade virou ${DENSIDADES[evento.densidade - 1]?.nome ?? `densidade ${evento.densidade}`}`;
    case "melhoria":
      return `${ctx.nomeDoNivel(evento)}: Nv ${evento.nivel}`;
    case "cascata":
      return "Cascata: o Núcleo passou do limite";
    case "scram":
      return "SCRAM: Núcleo desligado";
    case "eraMudou":
      return "O Reator acendeu: Era 2";
    case "nucleoDesbloqueado":
      return "Núcleo desbloqueado";
    case "ocorrenciaOferecida":
      return `Ocorrência: ${OCORRENCIAS_DEF[evento.id].nome} · ${OCORRENCIAS_DEF[evento.id].duracaoS} s`;
    case "ocorrenciaTerminou":
      return `${OCORRENCIAS_DEF[evento.id].nome}: ${evento.superada ? "superada" : "não superada"}`;
    case "recompensaEscolhida":
      return evento.recompensa === "estabilidade" ? `Recompensa: 🛡 +${evento.valor}` : `Recompensa: +🔬 ${Math.round(evento.valor)}`;
    case "primeiroCarregamento":
    case "primeiraCompra":
      return null;
  }
}
