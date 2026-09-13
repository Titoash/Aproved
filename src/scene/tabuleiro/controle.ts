/**
 * Ponte entre o DOM, a câmera e o store: um controle de câmera por app, ligado ao palco pela UI.
 * Toques viram ações do store: casa da plataforma → `agirNaCasa`; casa do arquipélago → `agirNoMundo`;
 * placa de expedição → `comprarIlha`; minimapa → recentrar.
 */
import { ARQUIPELAGO } from "../../content/era1-arquipelago";
import { naPlataforma } from "../../sim/arquipelago";
import { arquipelagoDaEra1 } from "../../sim/gerarArquipelago";
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
    const arq = arquipelagoDaEra1();
    controle = new ControleCamera({
      limitesIlha: () => limitesIlha(arq).topo,
      centroNucleo: () => {
        const c = centro(arq.plataforma.meio, arq.plataforma.meio);
        return [c[0], c[1] - ELEV_PLAT];
      },
      ajustarEscala: ajustarCameraEscala,
      marcadorEscala,
      // O arquipélago ocupa a grade inteira: a superelipse do limite é quase um círculo em volta dela.
      forma: { centro: ARQUIPELAGO.n / 2, raio: ARQUIPELAGO.n / 2 + 2, expoente: 2.2 },
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
  const p = arquipelagoDaEra1().plataforma;
  const desloc = (p.lado - lado) / 2;
  const col = x - p.x0 - desloc;
  const lin = y - p.y0 - desloc;
  if (col < 0 || lin < 0 || col >= lado || lin >= lado) return null;
  return lin * lado + col;
}

/** Índice na grade jogável → casa da plataforma. */
export function casaDaGrade(indice: number, lado: number): [number, number] {
  const p = arquipelagoDaEra1().plataforma;
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

/** O que há sob o toque: casa do mundo, casa da grade do Núcleo (se for a plataforma) ou nada. */
interface Sob {
  /** Índice da casa no arquipélago, ou `null` no mar. */
  casa: number | null;
  /** Índice na grade jogável do Núcleo, ou `null` fora dela. */
  grade: number | null;
  naPlataforma: boolean;
}

/** Liga o palco (elemento do DOM) ao controle; devolve a função que desliga. */
export function anexarPalco(el: HTMLElement): () => void {
  const ctl = controleCamera();
  const arq = arquipelagoDaEra1();
  const store = useGameStore;

  const sob = (p: RetornoToque): Sob => {
    const casa = casaEm(arq, p.wx, p.wy);
    if (!casa) return { casa: null, grade: null, naPlataforma: false };
    const indice = casa[1] * arq.n + casa[0];
    const plat = naPlataforma(arq.plataforma, casa[0], casa[1]);
    const nucleo = store.getState().state.nucleo;
    if (!plat) return { casa: indice, grade: null, naPlataforma: false };
    return { casa: indice, grade: nucleo ? indiceDaGrade(casa[0], casa[1], nucleo.lado) : null, naPlataforma: true };
  };

  return ctl.anexar(el, {
    toque(p) {
      if (ctl.nivel !== "ilha" || ctl.transicao) return;
      if (noMinimapa(p.px, p.py, ctl.w, ctl.h)) {
        const [x, y] = retanguloMinimapa(ctl.w, ctl.h);
        const [wx, wy] = minimapaParaMundo(arq, p.px - x, p.py - y, MINIMAPA.w, MINIMAPA.h);
        const c = ctl.camDe("ilha");
        c.tx = ctl.w / 2 - wx * c.zoom;
        c.ty = ctl.h / 2 - wy * c.zoom;
        ctl.limitar(c, "ilha");
        return;
      }
      const alvo = sob(p);
      if (alvo.grade !== null) {
        store.getState().agirNaCasa(alvo.grade);
        return;
      }
      if (alvo.naPlataforma) return;
      if (alvo.casa !== null) {
        store.getState().agirNoMundo(alvo.casa);
        return;
      }
      const placa = cenaAtual ? placaEm(cenaAtual, p.wx, p.wy) : null;
      if (placa) store.getState().comprarIlha(placa);
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
        s.setCasaMundoSobPonteiro(null);
        s.setIlhaSobPonteiro(null);
        return;
      }
      const alvo = sob(p);
      s.setCasaSobPonteiro(alvo.grade);
      s.setCasaMundoSobPonteiro(alvo.naPlataforma ? null : alvo.casa);
      s.setIlhaSobPonteiro(alvo.casa === null && cenaAtual ? placaEm(cenaAtual, p.wx, p.wy) : null);
    },
    mudou() {
      /* a cena lê a câmera a cada frame */
    },
  });
}

/** Casa do arquipélago → ponto em px da janela (para o roteiro de teste e depuração). `null` sem palco. */
export function telaDaCasa(x: number, y: number): [number, number] | null {
  const rect = getPalcoRect();
  if (!rect) return null;
  const ctl = controleCamera();
  const c = centro(x, y);
  const plat = arquipelagoDaEra1().plataforma;
  const cy = naPlataforma(plat, x, y) ? c[1] - ELEV_PLAT : c[1];
  const [sx, sy] = ctl.paraTela(c[0], cy);
  return [rect.left + sx, rect.top + sy];
}

declare global {
  interface Window {
    __tabuleiro?: {
      telaDaCasa: typeof telaDaCasa;
      casaDaGrade: typeof casaDaGrade;
      controle: () => ControleCamera;
      arquipelago: typeof arquipelagoDaEra1;
    };
  }
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  window.__tabuleiro = { telaDaCasa, casaDaGrade, controle: controleCamera, arquipelago: arquipelagoDaEra1 };
}
