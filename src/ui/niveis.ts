/** Texto dos níveis por tipo (v0.8) para a interface: nome, ícone e o que o nível atual faz. */
import { PECA_POR_ID } from "../content/pecas";
import { USINAS } from "../content/usinas";
import { LABORATORIO, UNIVERSIDADE } from "../content/cidade-era1";
import { INSTITUTO } from "../content/era2";
import { efeitosDe } from "../sim/efeitos";
import { formatarNumero, formatarPotencia } from "../sim/formatar";
import { nivelDe } from "../sim/melhorias";
import { bipesNoNivel, fatorCiencia, fatorPeca, fatorUsina } from "../sim/niveis";
import { ESCOAMENTO, ehSubestacao, ehUsina, tetoCabo, tetoDeSubestacao } from "../sim/producao";
import type { AlvoMelhoria, GameState, TipoConstrucao } from "../sim/state";
import type { ItemIcone } from "./icones";

const NOME_CIENCIA = { laboratorio: LABORATORIO.nome, universidade: UNIVERSIDADE.nome, institutoPesquisa: INSTITUTO.nome } as const;

/** O nível que vale para esta construção: o do tipo dela (v0.8). `null` = o tipo não tem nível. */
export function alvoDoTipo(tipo: TipoConstrucao): AlvoMelhoria | null {
  if (ehUsina(tipo)) return { tipo: "usina", id: tipo };
  if (ehSubestacao(tipo)) return { tipo: "subestacao", id: tipo };
  if (tipo === "laboratorio" || tipo === "universidade" || tipo === "institutoPesquisa") return { tipo: "ciencia", id: tipo };
  return null;
}

/** Nome do tipo, ícone e o que o nível atual faz, em texto curto. */
export function descreverNivel(state: GameState, alvo: AlvoMelhoria): { nome: string; icone: ItemIcone | null; efeito: string } {
  const n = nivelDe(state, alvo);
  switch (alvo.tipo) {
    case "usina":
      return { nome: USINAS[alvo.id].nomePlural, icone: alvo.id, efeito: `produção ×${formatarNumero(fatorUsina(n), 1)}` };
    case "peca":
      return { nome: PECA_POR_ID[alvo.id].nome, icone: null, efeito: `+${formatarNumero((fatorPeca(n) - 1) * 100, 0)} %` };
    case "subestacao":
      return { nome: ESCOAMENTO[alvo.id].nome, icone: alvo.id, efeito: `teto ${formatarPotencia(tetoDeSubestacao(alvo.id, n))} cada` };
    case "cabos":
      return { nome: "Cabos submarinos", icone: null, efeito: `teto ${formatarPotencia(tetoCabo(n, efeitosDe(state)))} cada` };
    case "ciencia":
      return { nome: NOME_CIENCIA[alvo.id], icone: alvo.id, efeito: `🔬 ×${formatarNumero(fatorCiencia(n), 2)}` };
    case "equipe":
      return { nome: "Equipe de manutenção", icone: null, efeito: `${bipesNoNivel(n)} Bipes` };
  }
}

