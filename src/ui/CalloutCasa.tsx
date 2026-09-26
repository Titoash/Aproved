/**
 * Callout de toque da cena (ajuste 5 da Sessão 7): a construção selecionada no tabuleiro ganha um cartão
 * flutuante sobre o palco, com os números dela e as ações que cabem — "Evoluir" no bairro, o próximo
 * nível **do tipo** em usinas, subestações e ciência (v0.8), "Remover" em tudo. No celular o painel da
 * Cidade abaixo do tabuleiro vira segunda via.
 *
 * Só lê o sim e despacha ações pelo store: nenhuma regra aqui.
 */
import { LABORATORIO, UNIVERSIDADE } from "../content/cidade-era1";
import { ilhaDef } from "../content/era1-arquipelago";
import { BATERIA } from "../content/era1";
import { USINAS } from "../content/usinas";
import { avaliarEvolucaoCidade, custoEvolucaoCidade, defDaCidade, defDaDensidade } from "../sim/cidade";
import { formatarCreditos, formatarNumero, formatarPotencia } from "../sim/formatar";
import { nomeConstrucao, valorRemocao } from "../sim/mundo";
import { analisar, ehSubestacao, ehUsina, ilhaDaCasa } from "../sim/producao";
import type { AlvoMelhoria, GameState, TipoConstrucao } from "../sim/state";
import { useGameStore } from "../store/gameStore";
import { BotaoNivel } from "./LinhaNivel";

/** O nível que vale para esta construção: o do tipo dela (v0.8). `null` = o tipo não tem nível. */
function alvoDoTipo(tipo: TipoConstrucao): AlvoMelhoria | null {
  if (ehUsina(tipo)) return { tipo: "usina", id: tipo };
  if (ehSubestacao(tipo)) return { tipo: "subestacao", id: tipo };
  if (tipo === "laboratorio" || tipo === "universidade" || tipo === "institutoPesquisa") return { tipo: "ciencia", id: tipo };
  return null;
}

function detalhe(state: GameState, indice: number): string {
  const c = state.mundo.construcoes[indice];
  const analise = analisar(state);
  if (c.tipo === "bairro") {
    const def = defDaCidade(state);
    return `${def.nome} · ${formatarPotencia(def.demandaKw)} de demanda · 👥 ${formatarNumero(def.populacao, 0)} · tarifa ×${formatarNumero(def.tarifa, 2)}`;
  }
  if (ehSubestacao(c.tipo)) {
    const s = analise.subestacoes.find((x) => x.indice === indice);
    const numeros = `Nv ${s?.nivel ?? 0} · ${formatarPotencia(s?.usadoKw ?? 0)} de ${formatarPotencia(s?.tetoKw ?? 0)} · alcance ${s?.alcance ?? 0}`;
    // A subestação offshore é a única construção do mar, e é a ilha dona dela que paga o teto do cabo
    // (ajuste 2 da Sessão 8, GDD Parte 2 §3.2).
    if (c.tipo !== "subestacaoOffshore") return numeros;
    const ilha = ilhaDaCasa(indice);
    if (!ilha) return numeros;
    const dona = ilhaDef(ilha).nome;
    if (ilha === "principal") return `${numeros} · pertence à ilha principal`;
    // Sem cabo, a ilha é uma mini-rede: a offshore só alimenta o que está nela (GDD §8.5).
    return state.mundo.cabos[ilha] === undefined
      ? `${numeros} · pertence a ${dona}, que ainda não tem cabo: só alimenta a própria ilha`
      : `${numeros} · pertence a ${dona}: entra no teto do cabo dela`;
  }
  if (c.tipo === "bateria") return `+${BATERIA.capacidadeKwh} kWh · ±${formatarPotencia(BATERIA.potenciaKw)}`;
  if (c.tipo === "laboratorio") return `🔬 ${formatarNumero(LABORATORIO.pesquisaPorSegundo, 1)}/s · −${formatarPotencia(LABORATORIO.consumoKw)}`;
  if (c.tipo === "universidade") return `🔬 pela raiz dos alunos · −${formatarPotencia(UNIVERSIDADE.consumoKw)}`;
  if (ehUsina(c.tipo)) {
    const u = analise.porCasa.get(indice);
    const semEscoamento = u && u.escoadoKw < u.brutoKw - 1e-9;
    return `${formatarPotencia(u?.brutoKw ?? USINAS[c.tipo].potenciaKw)} produzidos · ${formatarPotencia(u?.escoadoKw ?? 0)} escoados${semEscoamento ? " · sem escoamento" : ""}`;
  }
  return "";
}

export function CalloutCasa() {
  const state = useGameStore((s) => s.state);
  const indice = useGameStore((s) => s.casaSelecionada);
  const selecionar = useGameStore((s) => s.selecionarCasa);
  const evoluirCidade = useGameStore((s) => s.evoluirCidade);
  const removerConstrucao = useGameStore((s) => s.removerConstrucao);
  if (indice === null) return null;
  const c = state.mundo.construcoes[indice];
  if (!c) return null;

  const nome = c.tipo === "bairro" ? defDaCidade(state).nome : nomeConstrucao(c.tipo);
  // O bairro não evolui sozinho: o botão evolui a cidade inteira, com o custo × N à mostra (v0.8).
  const custo = c.tipo === "bairro" ? custoEvolucaoCidade(state) : null;
  const proxima = c.tipo === "bairro" ? defDaDensidade(state.cidade.densidade + 1) : null;
  const evolucao = c.tipo === "bairro" ? avaliarEvolucaoCidade(state) : null;
  const alvo = alvoDoTipo(c.tipo);

  return (
    <div className="callout-casa" role="dialog" aria-label={`Construção selecionada: ${nome}`}>
      <div className="callout-casa-topo">
        <span className="callout-casa-nome">{nome}</span>
        <button type="button" className="callout-casa-fechar" aria-label="Fechar" onClick={() => selecionar(null)}>
          ×
        </button>
      </div>
      <p className="callout-casa-detalhe">{detalhe(state, indice)}</p>
      <div className="callout-casa-acoes">
        {custo && proxima ? (
          <button type="button" className="pilula pilula--primaria pilula--mini" disabled={!evolucao?.ok} title={evolucao?.motivo ?? undefined} onClick={() => evoluirCidade()}>
            Evoluir a cidade para {proxima.nome}{" "}
            <span className="pilula-custo">
              {formatarCreditos(custo.creditos)} · 🔬 {formatarNumero(custo.pesquisa, 0)} ({custo.bairros} {custo.bairros === 1 ? "bairro" : "bairros"})
            </span>
          </button>
        ) : null}
        {c.tipo === "bairro" && !custo ? <span className="marca-comprado">✔ densidade máxima</span> : null}
        {alvo ? <BotaoNivel alvo={alvo} /> : null}
        <button
          type="button"
          className="pilula pilula--mini"
          onClick={() => {
            removerConstrucao(indice);
            selecionar(null);
          }}
        >
          Remover <span className="pilula-custo">+{formatarCreditos(valorRemocao(state, c.tipo))}</span>
        </button>
      </div>
    </div>
  );
}
