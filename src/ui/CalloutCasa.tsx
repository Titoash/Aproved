/**
 * Callout de toque da cena (ajuste 5 da Sessão 7): a construção selecionada no tabuleiro ganha um cartão
 * flutuante sobre o palco, com os números dela e as ações que cabem — "Evoluir" no bairro, "Melhorar" na
 * subestação, "Remover" em tudo. No celular o painel da Cidade abaixo do tabuleiro vira segunda via.
 *
 * Só lê o sim e despacha ações pelo store: nenhuma regra aqui.
 */
import { LABORATORIO, UNIVERSIDADE } from "../content/cidade-era1";
import { DENSIDADES } from "../content/cidade";
import { SUBESTACAO } from "../content/era1-arquipelago";
import { BATERIA } from "../content/era1";
import { USINAS } from "../content/usinas";
import { avaliarEvolucao, custoEvolucao, densidadeDe } from "../sim/cidade";
import { formatarCreditos, formatarNumero, formatarPotencia } from "../sim/formatar";
import { avaliarMelhoriaSubestacao, custoNivelSubestacao, nomeConstrucao, valorRemocao } from "../sim/mundo";
import { analisar, ehUsina } from "../sim/producao";
import { tetoSubestacao } from "../sim/producao";
import type { GameState } from "../sim/state";
import { useGameStore } from "../store/gameStore";

function detalhe(state: GameState, indice: number): string {
  const c = state.mundo.construcoes[indice];
  const analise = analisar(state);
  if (c.tipo === "bairro") {
    const def = densidadeDe(c);
    return `${def.nome} · ${formatarPotencia(def.demandaKw)} de demanda · ${formatarNumero(def.populacao, 0)} hab · tarifa ×${formatarNumero(def.tarifa, 2)}`;
  }
  if (c.tipo === "subestacao") {
    const s = analise.subestacoes.find((x) => x.indice === indice);
    return `nível ${c.nivel + 1} · ${formatarPotencia(s?.usadoKw ?? 0)} de ${formatarPotencia(tetoSubestacao(c.nivel))} · alcance ${SUBESTACAO.alcance}`;
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
  const evoluirBairro = useGameStore((s) => s.evoluirBairro);
  const melhorarSubestacao = useGameStore((s) => s.melhorarSubestacao);
  const removerConstrucao = useGameStore((s) => s.removerConstrucao);
  if (indice === null) return null;
  const c = state.mundo.construcoes[indice];
  if (!c) return null;

  const nome = c.tipo === "bairro" ? densidadeDe(c).nome : nomeConstrucao(c.tipo);
  const custo = c.tipo === "bairro" ? custoEvolucao(c.nivel) : null;
  const proxima = c.tipo === "bairro" ? DENSIDADES[Math.min(DENSIDADES.length - 1, c.nivel + 1)] : null;
  const evolucao = c.tipo === "bairro" ? avaliarEvolucao(state, indice) : null;
  const melhoria = c.tipo === "subestacao" ? avaliarMelhoriaSubestacao(state, indice) : null;

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
          <button type="button" className="pilula pilula--primaria pilula--mini" disabled={!evolucao?.ok} title={evolucao?.motivo ?? undefined} onClick={() => evoluirBairro(indice)}>
            Evoluir para {proxima.nome} <span className="pilula-custo">{formatarCreditos(custo.creditos)} · 🔬 {custo.pesquisa}</span>
          </button>
        ) : null}
        {c.tipo === "bairro" && !custo ? <span className="marca-comprado">✔ densidade máxima</span> : null}
        {melhoria ? (
          <button type="button" className="pilula pilula--mini" disabled={!melhoria.ok} title={melhoria.motivo ?? undefined} onClick={() => melhorarSubestacao(indice)}>
            Nível {c.nivel + 2} <span className="pilula-custo">{formatarCreditos(custoNivelSubestacao(c.nivel))}</span>
          </button>
        ) : null}
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
