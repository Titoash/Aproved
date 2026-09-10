import { useState } from "react";
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

/** Rodapé discreto: salvar, exportar, importar (abre a caixa) e resetar. */
export function PainelSave() {
  const salvoEmRelogio = useGameStore((s) => s.salvoEmRelogio);
  const salvarAgora = useGameStore((s) => s.salvarAgora);
  const exportar = useGameStore((s) => s.exportar);
  const importar = useGameStore((s) => s.importar);
  const resetar = useGameStore((s) => s.resetar);

  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

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
    if (window.confirm("Apagar todo o progresso e começar de novo?")) {
      resetar();
      setTexto("");
      setAviso({ tipo: "ok", texto: "Progresso apagado." });
    }
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
        <button type="button" className="pilula pilula--texto pilula--perigo" onClick={aoResetar}>
          Resetar
        </button>
      </div>
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
