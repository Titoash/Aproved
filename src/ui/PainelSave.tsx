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

export function PainelSave() {
  const salvoEmRelogio = useGameStore((s) => s.salvoEmRelogio);
  const salvarAgora = useGameStore((s) => s.salvarAgora);
  const exportar = useGameStore((s) => s.exportar);
  const importar = useGameStore((s) => s.importar);
  const resetar = useGameStore((s) => s.resetar);

  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<Aviso>(null);

  const aoSalvar = () => {
    setAviso(
      salvarAgora()
        ? { tipo: "ok", texto: "Progresso salvo." }
        : { tipo: "erro", texto: "Não foi possível salvar (armazenamento indisponível)." },
    );
  };

  const aoExportar = () => {
    const json = exportar();
    setTexto(json);
    baixarArquivo(`aproved-save-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`, json);
    setAviso({ tipo: "ok", texto: "JSON exportado (arquivo baixado e copiado para a caixa abaixo)." });
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
    <aside className="painel painel-save" aria-label="Progresso">
      <h2>Progresso</h2>
      <p>
        Salvo automaticamente a cada {INTERVALO_SAVE_MS / 1000} s.
        {salvoEmRelogio ? ` Último save: ${new Date(salvoEmRelogio).toLocaleTimeString("pt-BR")}.` : ""}
      </p>
      <div className="card-botoes">
        <button type="button" className="botao botao--secundario" onClick={aoSalvar}>
          <span className="botao-titulo">Salvar agora</span>
        </button>
        <button type="button" className="botao botao--secundario" onClick={aoExportar}>
          <span className="botao-titulo">Exportar JSON</span>
        </button>
        <button type="button" className="botao botao--secundario" onClick={aoImportar} disabled={texto.trim() === ""}>
          <span className="botao-titulo">Importar JSON</span>
        </button>
        <button type="button" className="botao botao--perigo" onClick={aoResetar}>
          <span className="botao-titulo">Resetar</span>
        </button>
      </div>
      <textarea
        aria-label="JSON do save"
        placeholder="Cole aqui um save exportado e clique em Importar JSON."
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        spellCheck={false}
      />
      {aviso ? <div className={`aviso aviso--${aviso.tipo}`}>{aviso.texto}</div> : null}
    </aside>
  );
}
