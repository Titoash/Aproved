/**
 * Tela da árvore de pesquisa (GDD §8.6, v0.6): uma coluna por tecnologia, cada nó com a frase de
 * física, o custo em 🔬 (e ₵ quando cobra) e as exclusões visíveis. É aqui que 🔬 vira decisão.
 *
 * As **linhas de ligação** entre pré-requisito e nó (ajuste 6 da Sessão 7) são desenhadas num SVG por
 * cima do grid, medindo as caixas no layout: traço fino quando o pré-requisito ainda falta, traço
 * `leaf` mais forte quando ele já está comprado. É o que faz a tela ler como árvore.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { NOS, RAMOS, type NoDef } from "../content/arvore";
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

interface Ligacao {
  chave: string;
  d: string;
  pronta: boolean;
}

/** Curva em S de um nó ao pré-requisito, em coordenadas do grid. */
function curva(de: DOMRect, para: DOMRect, base: DOMRect): string {
  const x1 = de.left - base.left + de.width / 2;
  const y1 = de.bottom - base.top;
  const x2 = para.left - base.left + para.width / 2;
  const y2 = para.top - base.top;
  if (Math.abs(x1 - x2) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const meio = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${meio}, ${x2} ${meio}, ${x2} ${y2}`;
}

export function PainelArvore() {
  const aberta = useGameStore((s) => s.arvoreAberta);
  const fechar = useGameStore((s) => s.fecharArvore);
  const state = useGameStore((s) => s.state);
  const gradeRef = useRef<HTMLDivElement>(null);
  const [ligacoes, setLigacoes] = useState<Ligacao[]>([]);
  const pesquisados = state.pesquisados;

  const medir = useCallback(() => {
    const grade = gradeRef.current;
    if (!grade) return;
    const base = grade.getBoundingClientRect();
    const caixa = (id: string): DOMRect | null => grade.querySelector<HTMLElement>(`[data-no="${id}"]`)?.getBoundingClientRect() ?? null;
    const novas: Ligacao[] = [];
    for (const no of NOS) {
      for (const pre of no.pre ?? []) {
        const a = caixa(pre);
        const b = caixa(no.id);
        if (!a || !b) continue;
        novas.push({ chave: `${pre}→${no.id}`, d: curva(a, b, base), pronta: pesquisados.includes(pre) });
      }
    }
    setLigacoes(novas);
  }, [pesquisados]);

  useLayoutEffect(() => {
    if (!aberta) return;
    medir();
  }, [aberta, medir]);

  useEffect(() => {
    if (!aberta) return;
    const grade = gradeRef.current;
    if (!grade || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(() => medir());
    obs.observe(grade);
    return () => obs.disconnect();
  }, [aberta, medir]);

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
        <div className="arvore-ramos" ref={gradeRef}>
          <svg className="arvore-ligacoes" aria-hidden="true">
            {ligacoes.map((l) => (
              <path key={l.chave} className={`arvore-ligacao ${l.pronta ? "arvore-ligacao--pronta" : ""}`} d={l.d} />
            ))}
          </svg>
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
