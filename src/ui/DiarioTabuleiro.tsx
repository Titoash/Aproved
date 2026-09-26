/**
 * Diário do tabuleiro (GDD §10.1, v0.8): três linhas no rodapé ("Árvore caiu em Bosque", "Capítulo
 * concluído: +₵ 120", "Vareta 12 esgotou"); cada uma some em 6 s de jogo. É DOM, não canvas: custo zero no
 * quadro, lido por leitor de tela (`aria-live`) e pelos roteiros de teste. Some enquanto o callout da casa
 * ou a confirmação da área estão abertos, que ocupam o mesmo rodapé.
 */
import { VIDA } from "../content/vida";
import { useGameStore } from "../store/gameStore";

export function DiarioTabuleiro() {
  const diario = useGameStore((s) => s.diario);
  const agora = useGameStore((s) => s.state.tempoMs);
  const ocupado = useGameStore((s) => s.casaSelecionada !== null || s.selecaoArea?.fase === "confirmar");
  const vivas = diario.filter((l) => agora - l.emTempoMs < VIDA.diarioLinhaMs);
  if (ocupado) return null;
  return (
    <ol className="diario" aria-live="polite" aria-label="Diário">
      {vivas.map((l) => {
        const idade = (agora - l.emTempoMs) / VIDA.diarioLinhaMs;
        // o último terço da vida é o apagar
        const opacidade = idade < 2 / 3 ? 1 : Math.max(0, 3 * (1 - idade));
        return (
          <li key={l.id} className="diario-linha" style={{ opacity: opacidade }}>
            {l.texto}
          </li>
        );
      })}
    </ol>
  );
}
