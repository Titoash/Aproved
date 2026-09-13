/**
 * Callout da peça do Núcleo selecionada (GDD Parte 2 §7): os números dela e, na vareta, o combustível
 * que resta, o calor de decaimento e o botão **Trocar** — com o motivo quando ainda não dá.
 *
 * Só lê o sim e despacha ações pelo store: nenhuma regra aqui.
 */
import { VARETA } from "../content/era2-nucleo";
import { PECA_POR_ID } from "../content/pecas";
import { avaliarTrocaVareta } from "../sim/acoesNucleo";
import { formatarCalor, formatarCreditos, formatarPorcentagem, formatarSegundos } from "../sim/formatar";
import { calorNominalVaretaUs, fatorVidaVareta, fracaoDecaimento, temBarraVizinha, temPiscinaVizinha } from "../sim/reator";
import { efeitosDe } from "../sim/efeitos";
import { anel } from "../sim/nucleo";
import type { NucleoState } from "../sim/state";
import { useGameStore } from "../store/gameStore";

function detalhePeca(nucleo: NucleoState, indice: number, tempoMs: number, efeitos: ReturnType<typeof efeitosDe>): string[] {
  const casa = nucleo.grade[indice];
  if (!casa || casa.tipo !== "peca") return [];
  const a = Math.max(1, anel(indice, nucleo.lado));
  const linhas: string[] = [PECA_POR_ID[casa.id].descricao, `anel ${a}`];
  if (casa.id === "vareta" && casa.vareta) {
    const v = casa.vareta;
    const vida = fatorVidaVareta(nucleo.grade, indice, nucleo.lado, efeitos);
    const nominal = calorNominalVaretaUs(nucleo.grade, indice, nucleo.lado, efeitos);
    if (v.gastaDesdeMs === null) {
      linhas[1] = `${formatarCalor(nominal)}/s · restam ${formatarSegundos(v.restanteS * vida * 1000)} de combustível`;
      if (temBarraVizinha(nucleo.grade, indice, nucleo.lado)) linhas.push("barra de controle vizinha: −50 % de calor, vida ×2");
    } else {
      const fracao = fracaoDecaimento(tempoMs - v.gastaDesdeMs);
      linhas[1] = `gasta · decaimento ${formatarPorcentagem(fracao, 2)} do nominal (${formatarCalor(nominal * fracao)}/s)`;
      if (temPiscinaVizinha(nucleo.grade, indice, nucleo.lado)) linhas.push("piscina ao lado: o calor vai para ela, e a troca é imediata");
    }
  }
  return linhas;
}

export function CalloutPeca() {
  const state = useGameStore((s) => s.state);
  const indice = useGameStore((s) => s.casaNucleoSelecionada);
  const selecionar = useGameStore((s) => s.selecionarCasaNucleo);
  const trocar = useGameStore((s) => s.trocarVareta);
  const removerPeca = useGameStore((s) => s.removerPeca);
  const nucleo = state.nucleo;
  if (indice === null || !nucleo) return null;
  const casa = nucleo.grade[indice];
  if (!casa || casa.tipo !== "peca") return null;

  const efeitos = efeitosDe(state);
  const linhas = detalhePeca(nucleo, indice, state.tempoMs, efeitos);
  const gasta = casa.id === "vareta" && casa.vareta?.gastaDesdeMs !== null && casa.vareta !== undefined;
  const troca = gasta ? avaliarTrocaVareta(state, indice) : null;

  return (
    <div className="callout-casa callout-casa--peca" role="dialog" aria-label={`Peça selecionada: ${PECA_POR_ID[casa.id].nome}`}>
      <div className="callout-casa-topo">
        <span className="callout-casa-nome">{PECA_POR_ID[casa.id].nome}</span>
        <button type="button" className="callout-casa-fechar" aria-label="Fechar" onClick={() => selecionar(null)}>
          ×
        </button>
      </div>
      {linhas.map((linha, i) => (
        <p key={i} className="callout-casa-detalhe">
          {linha}
        </p>
      ))}
      <div className="callout-casa-acoes">
        {troca ? (
          <button
            type="button"
            className={`pilula pilula--primaria pilula--mini ${troca.ok ? "pilula--brilho" : ""}`}
            data-acao="trocar-vareta"
            disabled={!troca.ok}
            title={troca.motivo ?? undefined}
            onClick={() => trocar(indice)}
          >
            Trocar vareta <span className="pilula-custo">{formatarCreditos(VARETA.custoTroca)}</span>
          </button>
        ) : null}
        {troca && !troca.ok && troca.faltaMs > 0 ? (
          <span className="callout-casa-detalhe">esfria em {formatarSegundos(troca.faltaMs)}</span>
        ) : null}
        <button
          type="button"
          className="pilula pilula--mini"
          onClick={() => {
            removerPeca(indice);
            selecionar(null);
          }}
        >
          Remover
        </button>
      </div>
      {casa.id === "vareta" && casa.vareta && casa.vareta.gastaDesdeMs === null ? (
        <div className="callout-barra" aria-hidden="true">
          <div className="callout-barra-preenchida" style={{ width: `${Math.max(0, Math.min(100, (casa.vareta.restanteS / VARETA.combustivelS) * 100))}%` }} />
        </div>
      ) : null}
    </div>
  );
}
