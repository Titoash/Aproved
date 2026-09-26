/**
 * Confirmação da seleção em área (GDD §8.5, v0.8): ao soltar o arrasto, o custo total, a 🔬 das montanhas
 * e o tempo com os Bipes de agora aparecem antes de cobrar. Tudo ou nada: sem saldo, "Confirmar" fica
 * desabilitado com o motivo. Enter confirma e Esc cancela no desktop.
 *
 * Só lê o sim e despacha ações pelo store: nenhuma regra aqui.
 */
import { useEffect } from "react";
import { formatarCreditos, formatarNumero } from "../sim/formatar";
import { arquipelagoDaEra1 } from "../sim/gerarArquipelago";
import { bipesDe, orcarArea, retanguloDaArea } from "../sim/mundo";
import { useGameStore } from "../store/gameStore";

/** "0,8 s", "6 s", "1 min 20 s": a área leva de meio segundo a alguns minutos. */
function duracaoCurta(ms: number): string {
  const s = ms / 1000;
  if (s < 10) return `${formatarNumero(s, 1)} s`;
  if (s < 60) return `${Math.round(s)} s`;
  const min = Math.floor(s / 60);
  const resto = Math.round(s - min * 60);
  return resto > 0 ? `${min} min ${resto} s` : `${min} min`;
}

export function ConfirmacaoArea() {
  const sel = useGameStore((s) => s.selecaoArea);
  const state = useGameStore((s) => s.state);
  const confirmar = useGameStore((s) => s.confirmarArea);
  const cancelar = useGameStore((s) => s.cancelarArea);
  const aberta = sel?.fase === "confirmar";

  useEffect(() => {
    if (!aberta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelar();
      else if (e.key === "Enter") confirmar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberta, confirmar, cancelar]);

  if (!sel || !aberta) return null;
  const o = orcarArea(state, retanguloDaArea(sel.a, sel.b, arquipelagoDaEra1().n));
  const qtd = o.alvos.length;
  const partes = [`${qtd} ${qtd === 1 ? "obstáculo" : "obstáculos"}`, formatarCreditos(o.custo)];
  if (o.pesquisa > 0) partes.push(`🔬 ${formatarNumero(o.pesquisa, 0)}`);
  partes.push(`≈ ${duracaoCurta(o.duracaoMs)} com ${bipesDe(state)} Bipes`);

  return (
    <div className={`callout-casa confirmacao-area${sel.cartaoEmCima ? " confirmacao-area--cima" : ""}`} role="dialog" aria-label="Remover a área">
      <div className="callout-casa-topo">
        <span className="callout-casa-nome">Remover a área</span>
        <button type="button" className="callout-casa-fechar" aria-label="Cancelar" onClick={cancelar}>
          ×
        </button>
      </div>
      <p className="callout-casa-detalhe" data-testid="orcamento-area">
        {partes.join(" · ")}
      </p>
      {o.ignorados > 0 && (
        <p className="callout-casa-detalhe">
          {o.ignorados} {o.ignorados === 1 ? "fica" : "ficam"} de fora (pico, ilha fechada ou já na fila).
        </p>
      )}
      <div className="callout-casa-acoes">
        <button type="button" className="pilula pilula--primaria pilula--mini" disabled={!o.ok} title={o.motivo ?? undefined} onClick={() => confirmar()}>
          Confirmar <span className="pilula-custo">{formatarCreditos(o.custo)}</span>
        </button>
        <button type="button" className="pilula pilula--mini" onClick={cancelar}>
          Cancelar
        </button>
        {!o.ok && o.motivo && <span className="callout-casa-detalhe">{o.motivo}</span>}
      </div>
    </div>
  );
}
