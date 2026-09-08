/** Ponte entre o DOM e o Phaser: onde a grade do Núcleo deve ser desenhada. */
let gradeElement: HTMLElement | null = null;

export function setGradeElement(el: HTMLElement | null): void {
  gradeElement = el;
}

/** Retângulo da área da grade em coordenadas da janela (as mesmas do canvas fixo). */
export function getGradeRect(): DOMRect | null {
  if (!gradeElement || !gradeElement.isConnected) return null;
  return gradeElement.getBoundingClientRect();
}
