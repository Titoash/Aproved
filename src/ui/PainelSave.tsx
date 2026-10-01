import { useEffect, useRef, useState } from "react";
import { INTERVALO_SAVE_MS } from "../sim/save";
import { useGameStore } from "../store/gameStore";

type Aviso = { tipo: "ok" | "erro"; texto: string } | null;

function baixarArquivo(nome: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Rodapé discreto: salvar, exportar, importar (abre a caixa) e resetar. O reset pede confirmação no
 * próprio rodapé, sem `window.confirm`: diálogos nativos são bloqueados em iframes com sandbox.
 */
export function PainelSave() {
  const salvoEmRelogio = useGameStore((s) => s.salvoEmRelogio);
  const salvarAgora = useGameStore((s) => s.salvarAgora);
  const exportar = useGameStore((s) => s.exportar);
  const importar = useGameStore((s) => s.importar);
  const resetar = useGameStore((s) => s.resetar);

  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [confirmandoReset, setConfirmandoReset] = useState(false);
  const caixaReset = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirmandoReset) return;
    // no celular o rodapé fica no fim da rolagem: a pergunta não pode nascer abaixo da borda
    caixaReset.current?.scrollIntoView({ block: "nearest" });
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmandoReset(false);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [confirmandoReset]);

  const aoSalvar = () => {
    setAviso(salvarAgora() ? { tipo: "ok", texto: "Progresso salvo." } : { tipo: "erro", texto: "Não foi possível salvar (armazenamento indisponível)." });
  };
  const aoExportar = () => {
    const json = exportar();
    setTexto(json);
    setAberto(true);
    baixarArquivo(`kardashev-save-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`, json);
    setAviso({ tipo: "ok", texto: "JSON exportado: arquivo baixado e copiado para a caixa." });
  };
  const aoImportar = () => {
    try {
      importar(texto);
      setAviso({ tipo: "ok", texto: "Save importado." });
    } catch (erro) {
      setAviso({ tipo: "erro", texto: erro instanceof Error ? erro.message : "Falha ao importar." });
    }
  };
  const aoResetar = () => {
    resetar();
    setConfirmandoReset(false);
    setTexto("");
    setAviso({ tipo: "ok", texto: "Progresso apagado." });
  };

  return (
    <footer className="rodape-save" aria-label="Progresso">
      <span className="rodape-info">
        Salvo a cada {INTERVALO_SAVE_MS / 1000} s{salvoEmRelogio ? ` · último ${new Date(salvoEmRelogio).toLocaleTimeString("pt-BR")}` : ""}
      </span>
      <div className="rodape-acoes">
        <button type="button" className="pilula pilula--texto" onClick={aoSalvar}>
          Salvar agora
        </button>
        <button type="button" className="pilula pilula--texto" onClick={aoExportar}>
          Exportar JSON
        </button>
        <button type="button" className="pilula pilula--texto" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
          Importar JSON…
        </button>
        <button type="button" className="pilula pilula--texto pilula--perigo" aria-expanded={confirmandoReset} onClick={() => setConfirmandoReset((v) => !v)}>
          Resetar
        </button>
      </div>
      {confirmandoReset ? (
        <div ref={caixaReset} className="rodape-confirmar" role="alertdialog" aria-label="Apagar o progresso">
          <span>Apagar todo o progresso e começar de novo? Não dá para desfazer.</span>
          <button type="button" className="pilula pilula--mini pilula--perigo" onClick={aoResetar}>
            Apagar tudo
          </button>
          <button type="button" className="pilula pilula--mini" onClick={() => setConfirmandoReset(false)}>
            Cancelar
          </button>
        </div>
      ) : null}
      {aberto ? (
        <div className="rodape-importar">
          <textarea aria-label="JSON do save" placeholder="Cole aqui um save exportado." value={texto} onChange={(e) => setTexto(e.target.value)} spellCheck={false} />
          <button type="button" className="pilula" onClick={aoImportar} disabled={texto.trim() === ""}>
            Importar
          </button>
        </div>
      ) : null}
      {aviso ? <span className={`aviso aviso--${aviso.tipo}`}>{aviso.texto}</span> : null}
    </footer>
  );
}
