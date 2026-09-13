/**
 * Tela da árvore de pesquisa (GDD §8.6, v0.6): uma coluna por tecnologia, cada nó com a frase de
 * física, o custo em 🔬 (e ₵ quando cobra) e as exclusões visíveis. É aqui que 🔬 vira decisão.
 */
import { NOS, RAMOS, type NoDef } from "../content/arvore-era1";
import { avaliarNo, disponivel, excluido, pesquisado, podePesquisar } from "../sim/arvore";
import { formatarCreditos, formatarNumero } from "../sim/formatar";
import type { GameState } from "../sim/state";
import { useGameStore } from "../store/gameStore";
import { IconeCadeado } from "./icones";

function estadoDoNo(state: GameState, no: NoDef): "comprado" | "excluido" | "disponivel" | "bloqueado" {
  if (pesquisado(state, no.id)) return "comprado";
  if (excluido(state, no)) return "excluido";
  return disponivel(state, no.id) ? "disponivel" : "bloqueado";
}

function No({ no }: { no: NoDef }) {
  const state = useGameStore((s) => s.state);
  const pesquisar = useGameStore((s) => s.pesquisar);
  const situacao = estadoDoNo(state, no);
  const pode = podePesquisar(state, no.id);
  const motivo = avaliarNo(state, no.id).motivo;
  const falta = situacao === "disponivel" && !pode;
  return (
    <li className={`no no--${situacao}`} data-no={no.id}>
      <div className="no-topo">
        <span className="no-nome">{no.nome}</span>
        <span className={`no-custo ${falta ? "pilula-custo--caro" : ""}`}>
          {situacao === "comprado" ? "✔" : `🔬 ${formatarNumero(no.pesquisa, 0)}`}
          {no.creditos ? ` · ${formatarCreditos(no.creditos)}` : ""}
        </span>
      </div>
      <p className="no-efeito">{no.efeitoTexto}</p>
      <p className="no-fisica">{no.fisica}</p>
      {no.exclui && no.exclui.length > 0 ? (
        <p className="no-exclui">⊗ escolha exclusiva: comprar este fecha {no.exclui.map((id) => NOS.find((n) => n.id === id)?.nome ?? id).join(", ")}</p>
      ) : null}
      {situacao === "comprado" ? null : (
        <button type="button" className="pilula pilula--primaria no-botao" disabled={!pode} onClick={() => pesquisar(no.id)}>
          {situacao === "disponivel" ? "Pesquisar" : <><IconeCadeado /> {motivo}</>}
        </button>
      )}
      {situacao === "disponivel" && !pode ? <span className="no-aviso">{motivo}</span> : null}
    </li>
  );
}

export function PainelArvore() {
  const aberta = useGameStore((s) => s.arvoreAberta);
  const fechar = useGameStore((s) => s.fecharArvore);
  const state = useGameStore((s) => s.state);
  if (!aberta) return null;
  const comprados = state.pesquisados.length;
  return (
    <div className="arvore-fundo" role="dialog" aria-modal="true" aria-label="Árvore de pesquisa">
      <section className="arvore">
        <header className="arvore-cabecalho">
          <div>
            <h2>Árvore de pesquisa</h2>
            <p className="rede-dica">
              🔬 é saldo: cada nó cobra. Saldo atual: <strong>🔬 {formatarNumero(state.pesquisa, state.pesquisa < 100 ? 1 : 0)}</strong> · {comprados} de {NOS.length} nós.
            </p>
          </div>
          <button type="button" className="pilula" onClick={fechar}>
            Fechar
          </button>
        </header>
        <div className="arvore-ramos">
          {RAMOS.map((ramo) => (
            <div key={ramo.id} className="arvore-ramo">
              <h3>{ramo.nome}</h3>
              <p className="arvore-ramo-descricao">{ramo.descricao}</p>
              <ul className="arvore-lista">
                {NOS.filter((n) => n.ramo === ramo.id).map((no) => (
                  <No key={no.id} no={no} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
