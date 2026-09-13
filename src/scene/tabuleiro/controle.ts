/**
 * Ponte entre o DOM, a câmera e o store: um controle de câmera por app, ligado ao palco pela UI.
 * Toques viram ações do store (casa da plataforma → `agirNaCasa`; placa de local → `desbloquearRegiao`).
 */
import { ILHA } from "../../content/era1-tabuleiro";
import { ilhaDaEra1 } from "../../sim/gerarIlha";
import { naPlataforma } from "../../sim/ilha";
import { useGameStore } from "../../store/gameStore";
import { getPalcoRect } from "../layout";
import { centro, movimentoReduzido } from "./base";
import { ControleCamera, type RetornoToque } from "./camera";
import { placaEm, type Cena } from "./cena";
import { ajustarCameraEscala, marcadorEscala } from "./escalas";
import { casaEm, ELEV_PLAT, limitesIlha, minimapaParaMundo } from "./terreno";

/** Minimapa desenhado pela cena no canto inferior direito do palco (px CSS). */
export const MINIMAPA = { w: 120, h: 80, margem: 12 } as const;
/** Largura reservada à escada de escalas no desktop. */
export const RESERVA_ESCADA_PX = 104;
export const LARGURA_DESKTOP_PX = 900;

let controle: ControleCamera | null = null;
let cenaAtual: Cena | null = null;

export function controleCamera(): ControleCamera {
  if (!controle) {
    const ilha = ilhaDaEra1();
    controle = new ControleCamera({
      limitesIlha: () => limitesIlha(ilha).topo,
      centroNucleo: () => {
        const c = centro(ilha.plataforma.meio, ilha.plataforma.meio);
        return [c[0], c[1] - ELEV_PLAT];
      },
      ajustarEscala: ajustarCameraEscala,
      marcadorEscala,
      forma: { centro: ILHA.n / 2, raio: ILHA.raio, expoente: ILHA.expoente },
      reduzido: movimentoReduzido(),
    });
  }
  return controle;
}

export function registrarCena(cena: Cena | null): void {
  cenaAtual = cena;
}

/** Casa da plataforma (x, y) → índice na grade jogável do sim, ou `null` fora dela (anel 3 antes da Grade 7×7). */
export function indiceDaGrade(x: number, y: number, lado: number): number | null {
  const p = ilhaDaEra1().plataforma;
  const desloc = (p.lado - lado) / 2;
  const col = x - p.x0 - desloc;
  const lin = y - p.y0 - desloc;
  if (col < 0 || lin < 0 || col >= lado || lin >= lado) return null;
  return lin * lado + col;
}

/** Índice na grade jogável → casa da plataforma. */
export function casaDaGrade(indice: number, lado: number): [number, number] {
  const p = ilhaDaEra1().plataforma;
  const desloc = (p.lado - lado) / 2;
  return [p.x0 + desloc + (indice % lado), p.y0 + desloc + Math.floor(indice / lado)];
}

function retanguloMinimapa(w: number, h: number): [number, number, number, number] {
  return [w - MINIMAPA.w - MINIMAPA.margem, h - MINIMAPA.h - MINIMAPA.margem, MINIMAPA.w, MINIMAPA.h];
}

function noMinimapa(px: number, py: number, w: number, h: number): boolean {
  const [x, y, mw, mh] = retanguloMinimapa(w, h);
  return px >= x && py >= y && px <= x + mw && py <= y + mh;
}

/** Liga o palco (elemento do DOM) ao controle; devolve a função que desliga. */
export function anexarPalco(el: HTMLElement): () => void {
  const ctl = controleCamera();
  const ilha = ilhaDaEra1();
  const store = useGameStore;

  const casaSob = (p: RetornoToque): { indice: number | null; naPlataforma: boolean } => {
    const casa = casaEm(ilha, p.wx, p.wy);
    if (!casa) return { indice: null, naPlataforma: false };
    const plat = naPlataforma(ilha.plataforma, casa[0], casa[1]);
    const nucleo = store.getState().state.nucleo;
    if (!plat || !nucleo) return { indice: null, naPlataforma: plat };
    return { indice: indiceDaGrade(casa[0], casa[1], nucleo.lado), naPlataforma: true };
  };

  return ctl.anexar(el, {
    toque(p) {
      if (ctl.nivel !== "ilha" || ctl.transicao) return;
      if (noMinimapa(p.px, p.py, ctl.w, ctl.h)) {
        const [x, y] = retanguloMinimapa(ctl.w, ctl.h);
        const [wx, wy] = minimapaParaMundo(ilha, p.px - x, p.py - y, MINIMAPA.w, MINIMAPA.h);
        const c = ctl.camDe("ilha");
        c.tx = ctl.w / 2 - wx * c.zoom;
        c.ty = ctl.h / 2 - wy * c.zoom;
        ctl.limitar(c, "ilha");
        return;
      }
      const { indice, naPlataforma: plat } = casaSob(p);
      if (indice !== null) {
        store.getState().agirNaCasa(indice);
        return;
      }
      if (plat) return;
      const placa = cenaAtual ? placaEm(cenaAtual, p.wx, p.wy) : null;
      if (placa) store.getState().desbloquearRegiao(placa);
    },
    toqueDuplo() {
      if (ctl.nivel !== "ilha" || ctl.transicao) return;
      const c = ctl.camDe("ilha");
      ctl.animarPara(ctl.presetIlha(c.zoom > 0.8 ? "ilha" : "nucleo"), 0.5);
    },
    hover(p) {
      const s = store.getState();
      if (!p || ctl.nivel !== "ilha") {
        s.setCasaSobPonteiro(null);
        s.setRegiaoSobPonteiro(null);
        return;
      }
      const { indice } = casaSob(p);
      s.setCasaSobPonteiro(indice);
      s.setRegiaoSobPonteiro(indice === null && cenaAtual ? placaEm(cenaAtual, p.wx, p.wy) : null);
    },
    mudou() {
      /* a cena lê a câmera a cada frame */
    },
  });
}

/** Casa da ilha → ponto em px da janela (para o roteiro de teste e depuração). `null` sem palco. */
export function telaDaCasa(x: number, y: number): [number, number] | null {
  const rect = getPalcoRect();
  if (!rect) return null;
  const ctl = controleCamera();
  const c = centro(x, y);
  const plat = ilhaDaEra1().plataforma;
  const cy = naPlataforma(plat, x, y) ? c[1] - ELEV_PLAT : c[1];
  const [sx, sy] = ctl.paraTela(c[0], cy);
  return [rect.left + sx, rect.top + sy];
}

declare global {
  interface Window {
    __tabuleiro?: { telaDaCasa: typeof telaDaCasa; casaDaGrade: typeof casaDaGrade; controle: () => ControleCamera };
  }
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  window.__tabuleiro = { telaDaCasa, casaDaGrade, controle: controleCamera };
}
