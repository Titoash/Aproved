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

/** Retângulo mínimo para localizar casas (o mesmo cálculo da cena e do DOM). */
export interface RectGrade {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Índice da casa sob o ponto (x, y) em coordenadas da janela, ou `null` fora da grade.
 * A grade é o quadrado centrado no retângulo, com `lado` casas por linha.
 */
export function indiceDaCasa(x: number, y: number, rect: RectGrade, lado: number): number | null {
  const tamanho = Math.min(rect.width, rect.height);
  if (!(tamanho > 0) || !(lado > 0)) return null;
  const celula = tamanho / lado;
  const x0 = rect.left + (rect.width - tamanho) / 2;
  const y0 = rect.top + (rect.height - tamanho) / 2;
  const col = Math.floor((x - x0) / celula);
  const lin = Math.floor((y - y0) / celula);
  if (col < 0 || lin < 0 || col >= lado || lin >= lado) return null;
  return lin * lado + col;
}
