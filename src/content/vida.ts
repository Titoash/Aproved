/**
 * Números do "ver acontecendo" (GDD Parte 1 §10.1, v0.8): o que a cena e o diário usam para o jogo parecer
 * vivo sem ler número. A cena só lê daqui (regra 3 do CLAUDE.md).
 */
export const VIDA = {
  /** "+₵" e "+🔬" agregados por consumidor a cada 2 s de jogo. */
  janelaFlutuanteMs: 2_000,
  /** No máximo 12 flutuantes na tela. */
  flutuantesMax: 12,
  /** Quanto um flutuante sobe e dura, em px de tela e s. */
  flutuanteSobePx: 28,
  flutuanteDuracaoS: 1.6,
  /** Diário no rodapé do tabuleiro: três linhas, cada uma some em 6 s de jogo. */
  diarioLinhas: 3,
  diarioLinhaMs: 6_000,
  /** Janelas apagam com menos da metade da demanda atendida; piscam na faixa de apagão (§4.1, r < 0,8). */
  janelasApagadasAbaixoDe: 0.5,
  /** Pulsos de energia: casas por segundo com o fio cheio, e espaçamento entre pontos (casas). */
  pulsoVelocidade: 2.2,
  pulsoEspacamento: 1.4,
  /** O Bipe começa a andar a 3 casas do obstáculo e leva 1,2 s para chegar. */
  bipeDistanciaCasas: 3,
  bipeCaminhadaS: 1.2,
} as const;
