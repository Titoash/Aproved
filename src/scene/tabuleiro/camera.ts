/**
 * Câmera do tabuleiro: pan, zoom na roda, pinch, inércia, presets (ilha, Núcleo), limites e a transição entre níveis.
 * Recebe os ponteiros de um elemento do DOM (o palco) e nunca toca o sim: toques viram callbacks.
 */
import type { NivelId } from "../../content/era1-tabuleiro";
import { NIVEIS } from "../../content/era1-tabuleiro";
import { desiso, iso, type Camera } from "./base";

export interface Bbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Transicao {
  de: NivelId;
  para: NivelId;
  t0: number;
  /** Ponto de tela em torno do qual os dois níveis escalam. */
  ancora: [number, number];
  subindo: boolean;
}

export interface DependenciasCamera {
  /** Caixa do topo da ilha em px de mundo. */
  limitesIlha: () => Bbox;
  /** Centro da plataforma do Núcleo em px de mundo (já com a elevação). */
  centroNucleo: () => [number, number];
  /** Câmera que enquadra um nível superior. */
  ajustarEscala: (id: NivelId, w: number, h: number) => Camera;
  /** Marcador "você está aqui" do nível superior, em px de tela. */
  marcadorEscala: (id: NivelId, t: number, cam: Camera) => [number, number] | null;
  /** Superelipse da ilha, em casas: centro, raio e expoente (o centro do palco nunca sai dela). */
  forma: { centro: number; raio: number; expoente: number };
  reduzido: boolean;
}

export interface RetornoToque {
  /** Ponto em px de tela relativo ao palco. */
  px: number;
  py: number;
  /** O mesmo ponto em px de mundo do nível atual. */
  wx: number;
  wy: number;
}

export interface Ouvintes {
  toque: (p: RetornoToque) => void;
  toqueDuplo?: (p: RetornoToque) => void;
  hover: (p: RetornoToque | null) => void;
  mudou: () => void;
}

const ZOOM_MIN = 0.12;
const ZOOM_MAX = 2.6;
const LIMIAR_ARRASTO_PX = 6;
const TOQUE_MAX_MS = 250;
const DURACAO_TRANSICAO_S = 0.9;
const DURACAO_TRANSICAO_REDUZIDA_S = 0.2;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const clamp01 = (v: number) => clamp(v, 0, 1);
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

interface AnimCamera {
  de: { lz: number; cx: number; cy: number };
  para: { lz: number; cx: number; cy: number };
  t0: number;
  dur: number;
}

interface Arrasto {
  x0: number;
  y0: number;
  tx0: number;
  ty0: number;
  t0: number;
  moveu: boolean;
  ultX: number;
  ultY: number;
  ultT: number;
  vx: number;
  vy: number;
}

export class ControleCamera {
  nivel: NivelId = "ilha";
  w = 1;
  h = 1;
  /** Largura reservada à esquerda (a escada de escalas) ao enquadrar a ilha no desktop. */
  reservaEsquerda = 0;
  transicao: Transicao | null = null;
  private readonly cams: Partial<Record<NivelId, Camera>> = {};
  private anim: AnimCamera | null = null;
  private inercia: { vx: number; vy: number; t: number } | null = null;
  private tempo = 0;
  private readonly deps: DependenciasCamera;

  constructor(deps: DependenciasCamera) {
    this.deps = deps;
  }

  redimensionar(w: number, h: number): void {
    const antesW = this.w;
    const antesH = this.h;
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    for (const id of Object.keys(this.cams) as NivelId[]) {
      const c = this.cams[id];
      if (!c) continue;
      // mantém o centro do palco no mesmo ponto de mundo
      const cx = (antesW / 2 - c.tx) / c.zoom;
      const cy = (antesH / 2 - c.ty) / c.zoom;
      c.w = this.w;
      c.h = this.h;
      c.tx = this.w / 2 - cx * c.zoom;
      c.ty = this.h / 2 - cy * c.zoom;
      this.limitar(c, id);
    }
  }

  camDe(id: NivelId = this.nivel): Camera {
    let c = this.cams[id];
    if (!c) {
      c = id === "ilha" ? this.presetIlha("ilha") : this.deps.ajustarEscala(id, this.w, this.h);
      c.w = this.w;
      c.h = this.h;
      this.cams[id] = c;
    }
    return c;
  }

  /** Enquadra a ilha na área livre (desktop: reserva a escada à esquerda; celular: pela largura, a 45 % da altura). */
  presetIlha(nome: "ilha" | "nucleo"): Camera {
    const { w, h } = this;
    if (nome === "nucleo") {
      const c = this.deps.centroNucleo();
      const zoom = 1.4;
      return { zoom, tx: w / 2 - c[0] * zoom, ty: h / 2 - (c[1] - 56) * zoom, w, h };
    }
    const b = this.deps.limitesIlha();
    const x0 = b.x0;
    const x1 = b.x1;
    const y0 = b.y0 - 110;
    const y1 = b.y1 + 96;
    // Celular (sem escada ao lado): enquadra pela largura, com a ilha a 45 % da altura.
    if (this.reservaEsquerda === 0 && w < 600) {
      const m = 10;
      const zoom = clamp((w - 2 * m) / (x1 - x0), ZOOM_MIN, ZOOM_MAX);
      return { zoom, tx: w / 2 - ((x0 + x1) / 2) * zoom, ty: h * 0.45 - ((b.y0 + b.y1) / 2) * zoom, w, h };
    }
    const esc = this.reservaEsquerda;
    const m = 20;
    const topo = 16;
    const base = 16;
    const zoom = clamp(Math.min((w - esc - 2 * m) / (x1 - x0), (h - topo - base - 2 * m) / (y1 - y0)), ZOOM_MIN, ZOOM_MAX);
    return { zoom, tx: (w + esc) / 2 - ((x0 + x1) / 2) * zoom, ty: (h + topo - base) / 2 - ((y0 + y1) / 2) * zoom, w, h };
  }

  limitar(cam: Camera, id: NivelId): Camera {
    const { w, h } = this;
    if (id === "ilha") {
      cam.zoom = clamp(cam.zoom, ZOOM_MIN, ZOOM_MAX);
      const b = this.deps.limitesIlha();
      const z = cam.zoom;
      const fx = (b.x1 - b.x0) * 0.15;
      const fy = (b.y1 - b.y0) * 0.15;
      cam.tx = clamp(cam.tx, w / 2 - (b.x1 - fx) * z, w / 2 - (b.x0 + fx) * z);
      cam.ty = clamp(cam.ty, h / 2 - (b.y1 - fy) * z, h / 2 - (b.y0 - 150 + fy) * z);
      const { centro: C, raio, expoente } = this.deps.forma;
      const wx = (w / 2 - cam.tx) / z;
      const wy = (h / 2 - cam.ty) / z;
      const g = desiso(wx, wy);
      const dx = g[0] - C;
      const dy = g[1] - C;
      const rho = Math.pow(Math.pow(Math.abs(dx) / raio, expoente) + Math.pow(Math.abs(dy) / raio, expoente), 1 / expoente);
      if (rho > 0.85) {
        const k = 0.85 / rho;
        const p = iso(C + dx * k, C + dy * k);
        cam.tx = w / 2 - p[0] * z;
        cam.ty = h / 2 - p[1] * z;
      }
    } else {
      const a = this.deps.ajustarEscala(id, w, h);
      cam.zoom = clamp(cam.zoom, a.zoom * 0.5, a.zoom * 6);
      cam.tx = clamp(cam.tx, -w * 0.5, w * 1.5);
      cam.ty = clamp(cam.ty, -h * 0.5, h * 1.5);
    }
    return cam;
  }

  zoomEm(px: number, py: number, f: number): void {
    const cam = this.camDe();
    const z0 = cam.zoom;
    const wx = (px - cam.tx) / z0;
    const wy = (py - cam.ty) / z0;
    cam.zoom = z0 * f;
    this.limitar(cam, this.nivel);
    cam.tx = px - wx * cam.zoom;
    cam.ty = py - wy * cam.zoom;
    this.limitar(cam, this.nivel);
    this.anim = null;
    this.inercia = null;
  }

  animarPara(destino: Camera, dur = 0.5): void {
    const c = this.camDe();
    const { w, h } = this;
    if (this.deps.reduzido) {
      c.zoom = destino.zoom;
      c.tx = destino.tx;
      c.ty = destino.ty;
      this.anim = null;
      return;
    }
    this.anim = {
      de: { lz: Math.log(c.zoom), cx: (w / 2 - c.tx) / c.zoom, cy: (h / 2 - c.ty) / c.zoom },
      para: { lz: Math.log(destino.zoom), cx: (w / 2 - destino.tx) / destino.zoom, cy: (h / 2 - destino.ty) / destino.zoom },
      t0: this.tempo,
      dur,
    };
    this.inercia = null;
  }

  /** Preset da ilha ('ilha' ou 'nucleo') ou um nível da escada. */
  preset(nome: "ilha" | "nucleo" | NivelId, imediato = false): void {
    if (this.transicao && !imediato) return;
    if (nome !== "ilha" && nome !== "nucleo" && NIVEIS.some((n) => n.id === nome)) {
      if (imediato || this.nivel === nome) {
        this.transicao = null;
        this.nivel = nome;
        this.cams[nome] = this.deps.ajustarEscala(nome, this.w, this.h);
      } else this.irPara(nome);
      return;
    }
    if (this.nivel !== "ilha") {
      if (imediato) {
        this.transicao = null;
        this.nivel = "ilha";
      } else this.irPara("ilha");
    }
    const destino = this.presetIlha(nome === "nucleo" ? "nucleo" : "ilha");
    if (imediato || this.nivel !== "ilha") {
      this.cams.ilha = destino;
      this.anim = null;
    } else this.animarPara(destino, 0.5);
  }

  irPara(id: NivelId): void {
    if (id === this.nivel || this.transicao) return;
    const ids = NIVEIS.map((n) => n.id);
    const iDe = ids.indexOf(this.nivel);
    const iPara = ids.indexOf(id);
    if (iPara < 0) return;
    const superior = iPara > iDe ? id : this.nivel;
    const camSup = this.camDe(superior);
    const ancora = this.deps.marcadorEscala(superior, this.tempo, camSup) ?? [this.w / 2, this.h / 2];
    this.transicao = { de: this.nivel, para: id, t0: this.tempo, ancora, subindo: iPara > iDe };
    this.camDe(id);
    this.anim = null;
    this.inercia = null;
  }

  /** Avança animações. Devolve a fração `k` da transição (ou null) e fecha a transição ao chegar a 1. */
  passo(t: number): { k: number; e: number } | null {
    this.tempo = t;
    if (this.anim) {
      const a = this.anim;
      const k = easeInOut(clamp01((t - a.t0) / a.dur));
      const c = this.camDe();
      const z = Math.exp(lerp(a.de.lz, a.para.lz, k));
      const cx = lerp(a.de.cx, a.para.cx, k);
      const cy = lerp(a.de.cy, a.para.cy, k);
      c.zoom = z;
      c.tx = this.w / 2 - cx * z;
      c.ty = this.h / 2 - cy * z;
      if (k >= 1) this.anim = null;
    }
    if (this.inercia) {
      const c = this.camDe();
      const dt = Math.min(0.05, Math.max(0, t - this.inercia.t));
      this.inercia.t = t;
      c.tx += this.inercia.vx * dt * 1000;
      c.ty += this.inercia.vy * dt * 1000;
      this.limitar(c, this.nivel);
      const f = Math.pow(0.92, dt * 60);
      this.inercia.vx *= f;
      this.inercia.vy *= f;
      if (Math.hypot(this.inercia.vx, this.inercia.vy) < 0.01) this.inercia = null;
    }
    if (this.transicao) {
      const dur = this.deps.reduzido ? DURACAO_TRANSICAO_REDUZIDA_S : DURACAO_TRANSICAO_S;
      const k = clamp01((t - this.transicao.t0) / dur);
      const e = easeInOut(k);
      if (k >= 1) {
        this.nivel = this.transicao.para;
        this.transicao = null;
        return { k: 1, e: 1 };
      }
      return { k, e };
    }
    return null;
  }

  animando(): boolean {
    return !!(this.transicao || this.anim || this.inercia);
  }

  /** Ponto de tela → mundo no nível atual. */
  paraMundo(px: number, py: number): [number, number] {
    const c = this.camDe();
    return [(px - c.tx) / c.zoom, (py - c.ty) / c.zoom];
  }

  /** Mundo → tela no nível atual. */
  paraTela(wx: number, wy: number): [number, number] {
    const c = this.camDe();
    return [wx * c.zoom + c.tx, wy * c.zoom + c.ty];
  }

  /** Liga os ouvintes de ponteiro e roda ao palco; devolve a função que desliga. */
  anexar(el: HTMLElement, ouvintes: Ouvintes): () => void {
    const ponteiros = new Map<number, { x: number; y: number }>();
    let arrasto: Arrasto | null = null;
    let pinch: { d0: number; z0: number; wx: number; wy: number } | null = null;
    let ultimoToque = { t: -9, x: 0, y: 0 };
    const posLocal = (e: PointerEvent | WheelEvent): [number, number] => {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const retorno = (px: number, py: number): RetornoToque => {
      const [wx, wy] = this.paraMundo(px, py);
      return { px, py, wx, wy };
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== undefined && e.button > 0) return;
      el.setPointerCapture(e.pointerId);
      const [x, y] = posLocal(e);
      ponteiros.set(e.pointerId, { x, y });
      this.anim = null;
      this.inercia = null;
      if (ponteiros.size === 2) {
        const [a, b] = [...ponteiros.values()];
        const c = this.camDe();
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        pinch = { d0: Math.max(8, Math.hypot(a.x - b.x, a.y - b.y)), z0: c.zoom, wx: (mx - c.tx) / c.zoom, wy: (my - c.ty) / c.zoom };
        arrasto = null;
      } else if (ponteiros.size === 1) {
        const c = this.camDe();
        const agora = performance.now();
        arrasto = { x0: x, y0: y, tx0: c.tx, ty0: c.ty, t0: agora, moveu: false, ultX: x, ultY: y, ultT: agora, vx: 0, vy: 0 };
      }
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      const [x, y] = posLocal(e);
      if (!ponteiros.has(e.pointerId)) {
        ouvintes.hover(retorno(x, y));
        return;
      }
      ponteiros.set(e.pointerId, { x, y });
      const c = this.camDe();
      if (pinch && ponteiros.size >= 2) {
        const [a, b] = [...ponteiros.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        c.zoom = (pinch.z0 * d) / pinch.d0;
        this.limitar(c, this.nivel);
        c.tx = mx - pinch.wx * c.zoom;
        c.ty = my - pinch.wy * c.zoom;
        this.limitar(c, this.nivel);
        ouvintes.mudou();
        return;
      }
      if (arrasto) {
        const dx = x - arrasto.x0;
        const dy = y - arrasto.y0;
        if (!arrasto.moveu && Math.hypot(dx, dy) > LIMIAR_ARRASTO_PX) {
          arrasto.moveu = true;
          ouvintes.hover(null);
        }
        if (arrasto.moveu) {
          c.tx = arrasto.tx0 + dx;
          c.ty = arrasto.ty0 + dy;
          this.limitar(c, this.nivel);
          const agora = performance.now();
          const dt = Math.max(1, agora - arrasto.ultT);
          arrasto.vx = (x - arrasto.ultX) / dt;
          arrasto.vy = (y - arrasto.ultY) / dt;
          arrasto.ultX = x;
          arrasto.ultY = y;
          arrasto.ultT = agora;
          ouvintes.mudou();
        }
      }
    };
    const onUp = (e: PointerEvent) => {
      const [x, y] = posLocal(e);
      ponteiros.delete(e.pointerId);
      if (ponteiros.size < 2) pinch = null;
      if (arrasto && ponteiros.size === 0) {
        const dur = performance.now() - arrasto.t0;
        if (!arrasto.moveu && dur < TOQUE_MAX_MS) {
          const ts = this.tempo;
          if (ts - ultimoToque.t < 0.5 && Math.hypot(x - ultimoToque.x, y - ultimoToque.y) < 20) {
            ultimoToque = { t: -9, x: 0, y: 0 };
            (ouvintes.toqueDuplo ?? ouvintes.toque)(retorno(x, y));
          } else {
            ultimoToque = { t: ts, x, y };
            ouvintes.toque(retorno(x, y));
          }
        } else if (arrasto.moveu && performance.now() - arrasto.ultT < 80 && Math.hypot(arrasto.vx, arrasto.vy) > 0.05) {
          this.inercia = { vx: arrasto.vx, vy: arrasto.vy, t: this.tempo };
        }
        arrasto = null;
        ouvintes.mudou();
      }
    };
    const onCancel = (e: PointerEvent) => {
      ponteiros.delete(e.pointerId);
      if (ponteiros.size < 2) pinch = null;
      if (ponteiros.size === 0) arrasto = null;
    };
    const onLeave = () => ouvintes.hover(null);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const [x, y] = posLocal(e);
      const passo = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaMode === 2 ? e.deltaY * 200 : e.deltaY;
      const f = clamp(Math.exp(-passo * 0.0022), 1 / 1.35, 1.35);
      this.zoomEm(x, y, f);
      ouvintes.mudou();
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("wheel", onWheel);
    };
  }
}
