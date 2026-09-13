/**
 * Roteiro de verificação da Sessão 6 (GDD v0.6) — arquipélago, colocação, obstáculos, escoamento e cabos.
 *
 * Roda contra `npm run dev -- --host 127.0.0.1 --port 5173` nos dois tamanhos (1280×800 e 390×844),
 * com o Chromium do ambiente:
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/sessao-6.cjs
 *
 * Capturas em `docs/capturas/sessao-6/`. Sai com código 1 se qualquer verificação falhar.
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.URL ?? "http://127.0.0.1:5173/";
// Regra da Sessão 7 (ajuste 7): rodar um roteiro antigo como regressão **não** pode sobrescrever as
// capturas da sessão dele. `CAPTURAS=/caminho/fora/do/repo` redireciona a saída.
const SAIDA = process.env.CAPTURAS ? path.resolve(process.env.CAPTURAS) : path.resolve(__dirname, "../../docs/capturas/sessao-6");
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];

let falhas = 0;
let feitos = 0;

function ok(cond, nome, extra) {
  if (cond) {
    feitos++;
    console.log(`  ✓ ${nome}`);
  } else {
    falhas++;
    console.log(`  ✗ ${nome}${extra !== undefined ? ` — ${JSON.stringify(extra)}` : ""}`);
  }
}

const perto = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

/* ------------------------------------------------------------------ */
/* Utilidades de página                                                */
/* ------------------------------------------------------------------ */

async function fecharCards(page) {
  for (let i = 0; i < 8; i++) {
    const b = page.locator("button", { hasText: /^(Próximo|Entendi)$/ }).first();
    if ((await b.count()) === 0 || !(await b.isVisible())) break;
    await b.click();
    await page.waitForTimeout(120);
  }
}

/** Estado do jogo lido do gancho de desenvolvimento. */
const estado = (page) => page.evaluate(() => window.__jogo.store.getState().state);
const analise = (page) =>
  page.evaluate(() => {
    const a = window.__jogo.analise();
    return {
      ofertaKw: a.ofertaKw,
      brutoKw: a.brutoKw,
      semEscoamentoKw: a.semEscoamentoKw,
      demandaKw: a.demandaKw,
      contagem: a.contagem,
      usinas: a.usinas.map((u) => ({ indice: u.indice, tipo: u.tipo, terreno: u.terreno, brutoKw: u.brutoKw, escoadoKw: u.escoadoKw })),
    };
  });

/** Dá créditos e pesquisa sem passar pela economia (o roteiro testa mecânica, não ritmo). */
async function abastecer(page, creditos = 500000, pesquisa = 200) {
  await page.evaluate(
    ([c, p]) => {
      const s = window.__jogo.store.getState();
      s.importar(JSON.stringify({ ...s.state, creditos: c, pesquisa: p, cardsVistos: ["abertura"] }));
    },
    [creditos, pesquisa],
  );
  await page.waitForTimeout(150);
}

/** Enquadra a câmera num ponto do arquipélago com o zoom pedido. */
async function focar(page, x, y, zoom = 1.1) {
  await page.evaluate(
    ([cx, cy, z]) => {
      const ctl = window.__tabuleiro.controle();
      const cam = ctl.camDe("ilha");
      const p = [(cx + 0.5 - (cy + 0.5)) * 32, (cx + 0.5 + cy + 0.5) * 16];
      cam.zoom = z;
      cam.tx = ctl.w / 2 - p[0] * z;
      cam.ty = ctl.h / 2 - p[1] * z;
      ctl.limitar(cam, "ilha");
    },
    [x, y, zoom],
  );
  await page.waitForTimeout(260);
}

/** Espera a rolagem da página parar (a paleta rola de volta para o tabuleiro no celular). */
async function esperarRolagem(page) {
  let anterior = null;
  await page.waitForTimeout(120);
  for (let i = 0; i < 30; i++) {
    const y = await page.evaluate(() => window.scrollY);
    if (y === anterior) return;
    anterior = y;
    await page.waitForTimeout(80);
  }
}

/** Ponto de tela de uma casa do arquipélago. */
const telaDaCasa = (page, x, y) => page.evaluate(([cx, cy]) => window.__tabuleiro.telaDaCasa(cx, cy), [x, y]);

/** Toque numa casa: ponteiro no desktop, `Input.dispatchTouchEvent` no celular. */
async function tocarCasa(page, x, y, toque) {
  // no celular a página rola: espera a rolagem parar e centraliza o tabuleiro antes de medir o ponto
  await esperarRolagem(page);
  await page.evaluate(() => document.querySelector(".tabuleiro-area").scrollIntoView({ block: "center" }));
  await esperarRolagem(page);
  const p = await telaDaCasa(page, x, y);
  if (!p) throw new Error(`casa ${x},${y} fora do palco`);
  const vp = page.viewportSize();
  if (p[0] < 0 || p[1] < 0 || p[0] > vp.width || p[1] > vp.height) throw new Error(`casa ${x},${y} fora da janela: ${p}`);
  if (toque) {
    // page.touchscreen.tap despacha Input.dispatchTouchEvent (touchStart + touchEnd) com o mesmo id.
    await page.touchscreen.tap(p[0], p[1]);
  } else {
    await page.mouse.move(p[0], p[1]);
    await page.waitForTimeout(40);
    await page.mouse.down();
    await page.waitForTimeout(40);
    await page.mouse.up();
  }
  await page.waitForTimeout(180);
}

async function selecionar(page, nome) {
  await page.locator(".paleta-item", { hasText: new RegExp(`^${nome}`) }).first().click();
  await page.waitForTimeout(500); // a UI rola de volta para o tabuleiro no celular
}

/** Casas do arquipélago que satisfazem um filtro, lidas da geometria. */
function buscarCasas(page, opcoes) {
  return page.evaluate((o) => {
    const arq = window.__tabuleiro.arquipelago();
    const st = window.__jogo.store.getState().state;
    const n = arq.n;
    const TERRENOS = ["planicie", "colina", "litoral", "rocha"];
    const OBS = ["arbusto", "arvore", "pedra", "pantano", "montanha", "pico"];
    const removidos = new Set(st.mundo.removidos);
    const saida = [];
    const ilha = arq.ilhas[o.ilha ?? 0];
    for (const i of ilha.casas) {
      if (saida.length >= (o.max ?? 8)) break;
      const x = i % n;
      const y = Math.floor(i / n);
      const obs = arq.obstaculos[i] === 255 || removidos.has(i) ? null : OBS[arq.obstaculos[i]];
      if (o.obstaculo !== undefined && obs !== o.obstaculo) continue;
      if (o.livre && (obs !== null || arq.caminho[i] === 1 || st.mundo.construcoes[i])) continue;
      if (o.terreno && TERRENOS[arq.terreno[i]] !== o.terreno) continue;
      const plat = arq.plataforma;
      if (x >= plat.x0 && x < plat.x0 + plat.lado && y >= plat.y0 && y < plat.y0 + plat.lado) continue;
      if (o.pertoDe !== undefined) {
        const d = Math.max(Math.abs(x - (o.pertoDe % n)), Math.abs(y - Math.floor(o.pertoDe / n)));
        if (d > (o.raio ?? 3) || d === 0) continue;
      }
      if (o.longeDeSubestacao) {
        let perto = false;
        for (const chave of Object.keys(st.mundo.construcoes)) {
          const j = Number(chave);
          if (st.mundo.construcoes[j].tipo !== "subestacao") continue;
          const d = Math.max(Math.abs(x - (j % n)), Math.abs(y - Math.floor(j / n)));
          if (d <= 4) perto = true;
        }
        if (perto) continue;
      }
      // vizinhança ortogonal limpa (sem obstáculo e sem construção), quando pedido
      if (o.vizinhosLimpos) {
        let limpo = true;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const j = (y + dy) * n + (x + dx);
          const obsV = arq.obstaculos[j] === 255 || removidos.has(j) ? null : OBS[arq.obstaculos[j]];
          if (obsV !== null || st.mundo.construcoes[j]) limpo = false;
        }
        if (!limpo) continue;
      }
      saida.push({ i, x, y, terreno: TERRENOS[arq.terreno[i]], obstaculo: obs });
    }
    return saida;
  }, opcoes);
}

/* ------------------------------------------------------------------ */
/* Roteiro                                                             */
/* ------------------------------------------------------------------ */

async function rodar(tamanho) {
  const toque = tamanho.nome === "celular";
  console.log(`\n— ${tamanho.nome} (${tamanho.w}×${tamanho.h}) —`);
  const browser = await chromium.launch({ args: ARGS });
  const contexto = await browser.newContext({
    viewport: { width: tamanho.w, height: tamanho.h },
    deviceScaleFactor: 1,
    hasTouch: toque,
    isMobile: false,
  });
  const page = await contexto.newPage();
  const erros = [];
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(m.text());
  });
  page.on("pageerror", (e) => erros.push(String(e)));
  const captura = (nome) => page.screenshot({ path: path.join(SAIDA, `${tamanho.nome}-${nome}.png`) });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__jogo && !!window.__tabuleiro, null, { timeout: 15000 });
  await page.waitForTimeout(900);

  // 1. Abertura: 3 telas, o jogo pausado, e o texto do espaço
  const abertura = await page.locator(".card-explicativo, .card").first().innerText();
  ok(/cada casa é uma decisão/i.test(abertura) || /2048 casas/i.test(abertura) || /1 kW/i.test(abertura), "abertura aparece", abertura.slice(0, 60));
  await captura("01-abertura");
  await fecharCards(page);
  await page.waitForTimeout(400);

  // 2. O arquipélago está desenhado e só a principal está aberta
  const s0 = await estado(page);
  ok(s0.mundo.ilhasAbertas.length === 1 && s0.mundo.ilhasAbertas[0] === "principal", "só a ilha principal começa aberta", s0.mundo.ilhasAbertas);
  ok(Object.keys(s0.mundo.construcoes).length === 2, "a aldeia nasce com 1 bairro e 1 subestação", Object.keys(s0.mundo.construcoes).length);
  await captura("02-arquipelago");

  // 3. Escada crescente e degraus que crescem
  const degraus = await page.$$eval(".degrau", (els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      const q = e.querySelector(".degrau-quadro").getBoundingClientRect();
      return { texto: e.textContent, x: r.x, y: r.y, lado: q.width };
    }),
  );
  const arquipelago = degraus.find((d) => d.texto.includes("Arquipélago"));
  const multiverso = degraus.find((d) => d.texto.includes("Multiverso"));
  ok(!!arquipelago && !!multiverso, "a escada tem os seis níveis", degraus.length);
  if (arquipelago && multiverso) {
    if (toque) ok(arquipelago.x < multiverso.x, "celular: escada crescente da esquerda para a direita", [arquipelago.x, multiverso.x]);
    else ok(arquipelago.y > multiverso.y, "desktop: escada crescente de baixo para cima", [arquipelago.y, multiverso.y]);
    ok(multiverso.lado > arquipelago.lado, "os degraus crescem de tamanho", [arquipelago.lado, multiverso.lado]);
  }

  // 4. Nota de ₵ com extrato
  await page.locator(".hud-nota").click();
  await page.waitForTimeout(200);
  const extratoVisivel = await page.locator(".hud-extrato").isVisible();
  ok(extratoVisivel, "a nota de ₵ abre o extrato");
  await captura("03-nota-extrato");
  await page.locator(".hud-extrato button", { hasText: "Fechar" }).click();
  await page.waitForTimeout(150);

  // 5. Terreno: cata-vento em planície (1 kW) e em colina (+25 %)
  await abastecer(page);
  const planicie = (await buscarCasas(page, { terreno: "planicie", livre: true, vizinhosLimpos: true, max: 3 }))[0];
  const colina = (await buscarCasas(page, { terreno: "colina", livre: true, vizinhosLimpos: true, max: 3 }))[0];
  ok(!!planicie && !!colina, "há casas de planície e de colina livres");
  await focar(page, planicie.x, planicie.y, 1.1);
  await selecionar(page, "Cata-vento");
  await tocarCasa(page, planicie.x, planicie.y, toque);
  await focar(page, colina.x, colina.y, 1.1);
  await tocarCasa(page, colina.x, colina.y, toque);
  let a = await analise(page);
  if (process.env.DEBUG) console.log("DEBUG planicie", planicie, "aviso", await page.evaluate(() => window.__jogo.store.getState().avisoGrade), "usinas", a.usinas.map((u) => u.indice));
  const uPlanicie = a.usinas.find((u) => u.indice === planicie.i);
  const uColina = a.usinas.find((u) => u.indice === colina.i);
  ok(!!uPlanicie && perto(uPlanicie.brutoKw, 1, 1e-9), "cata-vento em planície rende 1 kW", uPlanicie && uPlanicie.brutoKw);
  ok(!!uColina && perto(uColina.brutoKw, 1.25, 1e-9), "cata-vento em colina rende +25 %", uColina && uColina.brutoKw);

  // 6. Esteira: um vizinho eólico ortogonal tira 20 %
  const vizinha = (await buscarCasas(page, { pertoDe: planicie.i, raio: 1, livre: true, max: 6 })).find((c) => Math.abs(c.x - planicie.x) + Math.abs(c.y - planicie.y) === 1);
  ok(!!vizinha, "há uma casa ortogonal livre ao lado");
  if (vizinha) {
    await focar(page, planicie.x, planicie.y, 1.4);
    await tocarCasa(page, vizinha.x, vizinha.y, toque);
    a = await analise(page);
    const depois = a.usinas.find((u) => u.indice === planicie.i);
    ok(!!depois && perto(depois.brutoKw, 0.8, 1e-9), "o vizinho eólico tira 20 % (esteira)", depois && depois.brutoKw);
  }
  await captura("04-terreno-e-esteira");

  // 7. Sem escoamento: uma usina longe de qualquer subestação
  const longe = (await buscarCasas(page, { livre: true, longeDeSubestacao: true, max: 4 }))[0];
  ok(!!longe, "há casa longe de subestação");
  if (longe) {
    await focar(page, longe.x, longe.y, 1.1);
    await tocarCasa(page, longe.x, longe.y, toque);
    a = await analise(page);
    const u = a.usinas.find((x) => x.indice === longe.i);
    ok(!!u && u.escoadoKw === 0, "usina fora do alcance não escoa nada", u && u.escoadoKw);
    ok(a.semEscoamentoKw > 0, "o extrato acusa energia sem escoamento", a.semEscoamentoKw);
    const hud = await page.locator(".hud-item--oferta").innerText();
    ok(/sem escoamento/i.test(hud), 'o HUD mostra "sem escoamento"', hud);
    await captura("05-sem-escoamento");
  }

  // 8. Desmatar: o Bipe vai até o obstáculo e a casa fica livre
  const arvore = (await buscarCasas(page, { obstaculo: "arvore", max: 1 }))[0];
  ok(!!arvore, "há árvore para derrubar");
  if (arvore) {
    await focar(page, arvore.x, arvore.y, 1.5);
    await selecionar(page, "Desmatar");
    await tocarCasa(page, arvore.x, arvore.y, toque);
    const emFila = await page.evaluate(() => window.__jogo.store.getState().state.mundo.remocoes.length);
    ok(emFila === 1, "a remoção entra na fila", emFila);
    await page.waitForTimeout(500);
    await captura("06-desmatando");
    await page.waitForTimeout(3200);
    const saiu = await page.evaluate((i) => !window.__jogo.store.getState().state.mundo.removidos.includes(i) === false, arvore.i);
    ok(saiu, "a árvore cai depois do tempo dela");
    await selecionar(page, "Cata-vento");
    await tocarCasa(page, arvore.x, arvore.y, toque);
    const ocupou = await page.evaluate((i) => !!window.__jogo.store.getState().state.mundo.construcoes[i], arvore.i);
    ok(ocupou, "a casa desmatada aceita construção");
  }

  // 9. Expedição e cabo
  await page.locator(".linha", { hasText: "Ventania" }).locator("button", { hasText: "Expedição" }).click();
  await page.waitForTimeout(400);
  await fecharCards(page);
  let s = await estado(page);
  ok(s.mundo.ilhasAbertas.includes("ventania"), "a expedição abre Ventania", s.mundo.ilhasAbertas);
  await page.locator(".linha", { hasText: "Ventania" }).locator("button", { hasText: "Ligar cabo" }).click();
  await page.waitForTimeout(300);
  s = await estado(page);
  // na v7 os cabos viraram ilha → nível (teto próprio de kW, ajuste 1 da gestão)
  ok(s.mundo.cabos.ventania !== undefined, "o cabo submarino liga Ventania à rede", s.mundo.cabos);
  await page.evaluate(() => window.__jogo.store.getState().pedirPreset("ilha"));
  await page.waitForTimeout(900);
  await captura("07-ilha-aberta-e-cabo");

  // 10. Tooltip das peças do Núcleo e card das cinco peças
  await page.evaluate(() => window.__jogo.store.getState().desbloquearNucleo());
  await page.waitForTimeout(300);
  const cardPecas = await page.locator(".card-explicativo, .card").first().innerText().catch(() => "");
  ok(/cinco peças/i.test(cardPecas), 'o card "As cinco peças" abre com o Núcleo', cardPecas.slice(0, 60));
  await captura("08-card-cinco-pecas");
  await fecharCards(page);
  await page.waitForTimeout(200);
  await page.locator(".seletor-pecas button", { hasText: "Tanque" }).click();
  await page.waitForTimeout(150);
  const dica = await page.locator(".seletor-dica").innerText();
  ok(/150 u/.test(dica), "a peça selecionada mostra os números", dica);
  await page.evaluate(() => window.__jogo.store.getState().pedirPreset("nucleo"));
  await page.waitForTimeout(900);
  await captura("09-nucleo");

  // 11. Alcance da subestação desenhado ao selecionar a ferramenta
  await selecionar(page, "Subestação");
  await page.evaluate(() => window.__jogo.store.getState().pedirPreset("ilha"));
  await page.waitForTimeout(900);
  await captura("10-alcance-subestacao");

  // 12. Sem rolagem horizontal
  const rolagem = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  ok(rolagem.w <= rolagem.c + 1, "sem rolagem horizontal", rolagem);

  ok(erros.length === 0, "sem erros no console", erros.slice(0, 3));
  await browser.close();
}

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  if (!process.env.SO_CELULAR) await rodar({ nome: "desktop", w: 1280, h: 800 });
  await rodar({ nome: "celular", w: 390, h: 844 });
  console.log(`\n${feitos} verificações passaram, ${falhas} falharam.`);
  process.exit(falhas > 0 ? 1 : 0);
})();
