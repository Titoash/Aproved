/** Ponte entre o DOM e o Phaser: onde o palco do tabuleiro está na janela. */
let palcoElement: HTMLElement | null = null;

/** O palco rola; a cena recorta o desenho a ele para a grade não vazar por cima do HUD. */
export function setPalcoElement(el: HTMLElement | null): void {
  palcoElement = el;
}

export function getPalcoRect(): DOMRect | null {
  if (!palcoElement || !palcoElement.isConnected) return null;
  return palcoElement.getBoundingClientRect();
}
