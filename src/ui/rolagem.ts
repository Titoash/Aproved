/**
 * No celular a paleta fica abaixo do tabuleiro: escolher um prédio rolaria a página para longe da ilha.
 * Depois de escolher, o tabuleiro volta para a vista.
 */
export const LARGURA_CELULAR_PX = 900;

export function rolarParaOTabuleiro(): void {
  if (typeof window === "undefined" || window.innerWidth > LARGURA_CELULAR_PX) return;
  const el = document.querySelector(".tabuleiro-area");
  // instantâneo: com rolagem suave, um toque logo depois da escolha cairia na casa errada
  el?.scrollIntoView({ block: "center", behavior: "auto" });
}
