/**
 * Roteiro de verificação da Sessão 9 (GDD v0.8/v0.9) — melhorias por tipo, cidade inteira, remoção com N
 * Bipes e em área, HUD de quatro números e "ver acontecendo" (pulsos, "+₵", diário).
 *
 * Roda contra `npm run dev -- --host 127.0.0.1 --port 5173` nos dois tamanhos (1280×800 e 390×844),
 * com o Chromium do ambiente:
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/sessao-9.cjs
 *
 * Capturas em `docs/capturas/sessao-9/` (ou em `CAPTURAS=` quando rodado como regressão).
 * Sai com código 1 se qualquer verificação falhar.
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.URL ?? "http://127.0.0.1:5173/";
const SAIDA = process.env.CAPTURAS ? path.resolve(process.env.CAPTURAS) : path.resolve(__dirname, "../../docs/capturas/sessao-9");
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

const estado = (page) => page.evaluate(() => window.__jogo.store.getState().state);

async function fecharCards(page) {
  for (let i = 0; i < 12; i++) {
    const b = page.locator("button", { hasText: /^(Próximo|Entendi)$/ }).first();
    if ((await b.count()) === 0 || !(await b.isVisible())) break;
    await b.click();
    await page.waitForTimeout(120);
  }
}

/** Injeta um estado pronto sem passar pela economia: o roteiro testa mecânica, não ritmo. */
async function carregar(page, mudar) {
  await page.evaluate((corpo) => {
    const loja = window.__jogo.store.getState();
    const base = JSON.parse(JSON.stringify(loja.state));
    const fn = new Function("s", corpo);
    fn(base);
    loja.importar(JSON.stringify(base));
  }, mudar);
  await page.waitForTimeout(250);
}

const avancar = (page, ticks) => page.evaluate((n) => window.__jogo.store.getState().avancarTicks(n), ticks);

/** Coloca construções pelo store em casas livres da ilha principal com subestação no alcance. */
async function plantar(page, tipo, quantos) {
  return page.evaluate(
    ([t, q]) => {
      const arq = window.__tabuleiro.arquipelago();
      const n = arq.n;
      const postas = [];
      for (const i of arq.ilhas[0].casas) {
        if (postas.length >= q) break;
        const st = window.__jogo.store.getState().state;
        if (arq.obstaculos[i] !== 255 && !st.mundo.removidos.includes(i)) continue;
        if (arq.caminho[i] === 1 || st.mundo.construcoes[i]) continue;
        const plat = arq.plataforma;
        const x = i % n;
        const y = Math.floor(i / n);
        if (x >= plat.x0 - 1 && x <= plat.x0 + plat.lado && y >= plat.y0 - 1 && y <= plat.y0 + plat.lado) continue;
        const subs = Object.keys(st.mundo.construcoes)
          .map(Number)
          .filter((j) => st.mundo.construcoes[j].tipo === "subestacao");
        if (!subs.some((j) => Math.max(Math.abs(x - (j % n)), Math.abs(y - Math.floor(j / n))) <= 3)) continue;
        if (window.__jogo.store.getState().colocar(i, t)) postas.push(i);
      }
      return postas;
    },
    [tipo, quantos],
  );
}

/** Um bloco de obstáculos pequenos (arbusto, árvore, pedra) na ilha principal, para a seleção em área. */
async function blocoDeObstaculos(page) {
  return page.evaluate(() => {
    const arq = window.__tabuleiro.arquipelago();
    const n = arq.n;
    const st = window.__jogo.store.getState().state;
    let melhor = null;
    for (const i of arq.ilhas[0].casas) {
      const x = i % n;
      const y = Math.floor(i / n);
      let k = 0;
      for (let dy = 0; dy < 3; dy++)
        for (let dx = 0; dx < 3; dx++) {
          const j = (y + dy) * n + x + dx;
          if (arq.obstaculos[j] !== 255 && arq.obstaculos[j] < 3 && !st.mundo.removidos.includes(j)) k++;
        }
      if (!melhor || k > melhor.k) melhor = { x, y, k };
    }
    return melhor;
  });
}

/** Aproxima a câmera de uma casa (zoom de jogo, não de mapa) e devolve o ponto dela na janela. */
async function focar(page, x, y, fator = 3) {
  await page.evaluate(
    ([cx, cy, f]) => {
      const c = window.__tabuleiro.controle();
      c.preset("ilha", true);
      const r = document.querySelector(".tabuleiro-area").getBoundingClientRect();
      const [sx, sy] = window.__tabuleiro.telaDaCasa(cx, cy);
      c.zoomEm(sx - r.left, sy - r.top, f);
    },
    [x, y, fator],
  );
  await page.waitForTimeout(300);
}

async function rodar(tamanho) {
  const toque = tamanho.nome === "celular";
  console.log(`\n— ${tamanho.nome} (${tamanho.w}×${tamanho.h}) —`);
  const browser = await chromium.launch({ args: ARGS });
  const contexto = await browser.newContext({ viewport: { width: tamanho.w, height: tamanho.h }, deviceScaleFactor: 1, hasTouch: toque, isMobile: false });
  const page = await contexto.newPage();
  const erros = [];
  page.on("console", (m) => m.type() === "error" && erros.push(m.text()));
  page.on("pageerror", (e) => erros.push(String(e)));
  const captura = async (nome, alvo) => {
    // um card que abriu no caminho (primeira compra, capítulo) não pode cobrir a captura
    await fecharCards(page);
    if (toque && !nome.includes("paleta")) await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    if (alvo) await page.locator(alvo).screenshot({ path: path.join(SAIDA, `${tamanho.nome}-${nome}.png`) });
    else await page.screenshot({ path: path.join(SAIDA, `${tamanho.nome}-${nome}.png`) });
  };

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__jogo && !!window.__tabuleiro, null, { timeout: 20000 });
  await page.waitForTimeout(900);
  await fecharCards(page);

  /* 1. HUD limpo: quatro números, capítulo numa linha, sem 👥 e sem 🛡 soltos */
  const itens = await page.locator(".hud .hud-item").count();
  ok(itens === 4, "o HUD tem quatro itens (₵, ⚡, 🔥, 🔬)", itens);
  const hud = await page.locator(".hud").innerText();
  ok(!/habitantes/.test(hud) && !/Estabilidade/.test(hud), "👥 e 🛡 saíram do HUD", hud.replace(/\n/g, " "));
  ok(/[+−]₵/.test(hud), "o ₵ mostra a taxa líquida com sinal", hud.slice(0, 60).replace(/\n/g, " "));
  const altCapitulo = await page.locator(".capitulo").evaluate((e) => e.getBoundingClientRect().height);
  ok(altCapitulo <= 40, "o capítulo cabe numa linha", altCapitulo);
  // o capítulo não pode cobrir o tabuleiro (defeito do desktop até a Sessão 8)
  const sobreposto = await page.evaluate(() => {
    const c = document.querySelector(".capitulo").getBoundingClientRect();
    const t = document.querySelector(".tabuleiro").getBoundingClientRect();
    return c.bottom > t.top + 1;
  });
  ok(!sobreposto, "o capítulo não cobre o tabuleiro");
  await captura("01-hud");

  /* 2. Nível de usina pela carta da paleta (v0.8): "Nv n" e o botão do próximo */
  await carregar(page, "s.creditos = 100000; s.pesquisa = 5000; s.cardsVistos = [...new Set([...(s.cardsVistos || []), 'abertura'])];");
  await fecharCards(page);
  await plantar(page, "cataVento", 3);
  await fecharCards(page);
  const botaoUsina = page.locator(".paleta-carta", { hasText: /^Cata-vento/ }).locator('.paleta-nivel[data-nivel="usina"]');
  ok((await botaoUsina.count()) === 1, "a carta do cata-vento tem a faixa de nível");
  const kwAntes = await page.evaluate(() => window.__jogo.analise().brutoKw);
  await botaoUsina.click();
  await page.waitForTimeout(250);
  const sUsina = await estado(page);
  const kwDepois = await page.evaluate(() => window.__jogo.analise().brutoKw);
  ok(sUsina.melhorias.usinas.cataVento === 1, "o nível do tipo sobe pela carta", sUsina.melhorias.usinas);
  ok(Math.abs(kwDepois / kwAntes - 1.5) < 1e-6, "os cata-ventos rendem ×1,5 com Nv 1", [kwAntes, kwDepois]);
  const faixa = await page.locator(".paleta-carta", { hasText: /^Cata-vento/ }).locator(".paleta-nivel").innerText();
  ok(/Nv 1/.test(faixa), 'a carta mostra "Nv 1"', faixa);
  // o rádio continua sendo o botão da carta: clicar no centro escolhe o prédio
  ok(await page.locator(".paleta-item", { hasText: /^Cata-vento/ }).first().isEnabled(), "a carta continua escolhível");
  if (toque) await page.locator(".paleta").first().scrollIntoViewIfNeeded();
  await captura("02-paleta-nivel", toque ? ".paleta >> nth=0" : ".rede");

  /* 3. Nível de peça no painel do Núcleo */
  await page.evaluate(() => {
    const loja = window.__jogo.store.getState();
    loja.desbloquearNucleo();
    const l = window.__jogo.store.getState();
    for (const i of [7, 11, 13, 17, 0]) l.colocarPeca(i, "heliostato");
    for (const i of [6, 8]) l.colocarPeca(i, "turbina");
  });
  await fecharCards(page);
  await page.evaluate(() => window.__jogo.store.getState().selecionarFerramenta("heliostato"));
  await page.waitForTimeout(200);
  const botaoPeca = page.locator('.peca-carta [data-acao="nivel-peca"]').first();
  await botaoPeca.click();
  await page.waitForTimeout(250);
  const sPeca = await estado(page);
  ok(sPeca.melhorias.pecas.heliostato === 1, "o nível do heliostato sobe no painel do Núcleo", sPeca.melhorias.pecas);
  await page.evaluate(() => window.__jogo.store.getState().pedirPreset("nucleo"));
  await page.waitForTimeout(900);
  await captura("03-nucleo-nivel", toque ? null : ".coluna-nucleo");

  /* 4. A cidade evolui inteira: ₵ e 🔬 × N; o bairro novo nasce na densidade dela */
  await carregar(page, "s.creditos = 500000; s.pesquisa = 20000;");
  await fecharCards(page);
  await plantar(page, "bairro", 2);
  const sCid0 = await estado(page);
  const bairros = Object.values(sCid0.mundo.construcoes).filter((c) => c.tipo === "bairro").length;
  await page.locator(".linha", { hasText: "Aldeia" }).locator("button", { hasText: "Evoluir" }).first().click();
  await page.waitForTimeout(300);
  await fecharCards(page);
  const sCid1 = await estado(page);
  ok(sCid1.cidade.densidade === 2 && bairros >= 2, "a cidade inteira vira vila pelo botão do painel", [sCid1.cidade, bairros]);
  // o custo × N medido sem tick no meio (o capítulo "a aldeia vira vila" paga 🔬 no tick seguinte)
  const custoCidade = await page.evaluate(() => {
    const loja = window.__jogo.store.getState();
    const n = Object.values(loja.state.mundo.construcoes).filter((c) => c.tipo === "bairro").length;
    const antes = loja.state.pesquisa;
    loja.evoluirCidade();
    return { n, gasto: antes - window.__jogo.store.getState().state.pesquisa, densidade: window.__jogo.store.getState().state.cidade.densidade };
  });
  ok(custoCidade.densidade === 3 && Math.abs(custoCidade.gasto - 150 * custoCidade.n) < 1e-6, "a evolução custa 🔬 × N bairros (vila → cidade: 150 × N)", custoCidade);
  const custoNovo = await page.evaluate(() => {
    const loja = window.__jogo.store.getState();
    const antes = loja.state;
    return { c: antes.creditos, p: antes.pesquisa };
  });
  const novo = await plantar(page, "bairro", 1);
  const sCid2 = await estado(page);
  ok(novo.length === 1 && Math.abs(custoNovo.p - sCid2.pesquisa - 180) < 1, "o bairro novo nasce na cidade e paga a 🔬 acumulada por bairro (30 + 150)", [custoNovo.p, sCid2.pesquisa]);
  const painelCidade = await page.locator(".rede").innerText();
  ok(/👥/.test(painelCidade) && /Cidade/.test(painelCidade), "👥 e a densidade moram no painel da Cidade", painelCidade.slice(0, 120));

  /* 5. Dois Bipes derrubam ao mesmo tempo (v0.8) */
  await carregar(page, "s.creditos = 100000;");
  await fecharCards(page);
  const paralelo = await page.evaluate(() => {
    const arq = window.__tabuleiro.arquipelago();
    const st = window.__jogo.store.getState().state;
    const arvores = arq.ilhas[0].casas.filter((i) => arq.obstaculos[i] === 1 && !st.mundo.removidos.includes(i)).slice(0, 2);
    for (const i of arvores) window.__jogo.store.getState().desmatar(i);
    const fila = window.__jogo.store.getState().state.mundo.remocoes;
    return { arvores, emCurso: fila.filter((r) => r.fimMs > 0).map((r) => r.bipe) };
  });
  ok(paralelo.emCurso.length === 2 && paralelo.emCurso[0] !== paralelo.emCurso[1], "duas árvores começam juntas, uma por Bipe", paralelo);
  await avancar(page, 16);
  await page.waitForTimeout(300);
  const sArv = await estado(page);
  ok(paralelo.arvores.every((i) => sArv.mundo.removidos.includes(i)), "as duas caem em 1,5 s", paralelo.arvores);
  const diario = await page.locator(".diario").innerText().catch(() => "");
  ok(/caiu|caíram/.test(diario), "o diário do tabuleiro registra a queda", diario);
  await captura("04-diario", ".tabuleiro");

  /* 6. Seleção em área: o custo total aparece antes de cobrar */
  await carregar(page, "s.creditos = 100000; s.mundo.remocoes = [];");
  await fecharCards(page);
  const bloco = await blocoDeObstaculos(page);
  await focar(page, bloco.x + 1, bloco.y + 1);
  const [ax, ay] = await page.evaluate(([x, y]) => window.__tabuleiro.telaDaCasa(x, y), [bloco.x, bloco.y]);
  const [bx, by] = await page.evaluate(([x, y]) => window.__tabuleiro.telaDaCasa(x, y), [bloco.x + 2, bloco.y + 2]);
  if (!toque) {
    await page.evaluate(() => window.__jogo.store.getState().selecionarFerramentaMundo("desmatar"));
    await page.mouse.move(ax, ay);
    await page.mouse.down();
    await page.mouse.move(bx, by, { steps: 8 });
    await page.mouse.up();
  } else {
    await page.evaluate(() => window.scrollTo(0, 0));
    const cdp = await contexto.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: ax, y: ay }] });
    await page.waitForTimeout(650);
    for (let k = 1; k <= 8; k++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: ax + ((bx - ax) * k) / 8, y: ay + ((by - ay) * k) / 8 }] });
      await page.waitForTimeout(30);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await page.waitForTimeout(400);
  const sel = await page.evaluate(() => window.__jogo.store.getState().selecaoArea);
  ok(sel && sel.fase === "confirmar", toque ? "toque longo e arrastar selecionam uma área" : "arrastar com Desmatar seleciona uma área", sel);
  const orcamento = await page.locator("[data-testid=orcamento-area]").innerText().catch(() => "");
  ok(/obstáculo/.test(orcamento) && /₵/.test(orcamento) && /Bipes/.test(orcamento), "a confirmação mostra quantos, ₵ e o tempo com os Bipes", orcamento);
  await captura("05-area", ".tabuleiro");
  const antesArea = await estado(page);
  await page.locator(".confirmacao-area button", { hasText: /^Confirmar/ }).click();
  await page.waitForTimeout(300);
  const depoisArea = await estado(page);
  ok(depoisArea.mundo.remocoes.length >= 2 && depoisArea.creditos < antesArea.creditos, "confirmar cobra de uma vez e enche a fila", [antesArea.creditos, depoisArea.creditos, depoisArea.mundo.remocoes.length]);
  ok(depoisArea.mundo.remocoes.filter((r) => r.fimMs > 0).length === 2, "os dois Bipes pegam a fila", depoisArea.mundo.remocoes.length);
  await page.waitForTimeout(500);
  await captura("06-bipes", ".tabuleiro");

  /* 7. Ver acontecendo: "+₵" nasce sobre os bairros atendidos, e os fios existem */
  await carregar(page, "s.creditos = 100000; s.mundo.remocoes = [];");
  await fecharCards(page);
  await plantar(page, "cataVento", 6);
  await plantar(page, "laboratorio", 1);
  // enquadra um bairro atendido: o "+₵" só nasce no que está na tela
  const bairro = await page.evaluate(() => {
    const st = window.__jogo.store.getState().state;
    const n = window.__tabuleiro.arquipelago().n;
    const i = Object.keys(st.mundo.construcoes).map(Number).find((j) => st.mundo.construcoes[j].tipo === "bairro");
    return [i % n, Math.floor(i / n)];
  });
  await focar(page, bairro[0], bairro[1], 2);
  const emitidos0 = await page.evaluate(() => window.__tabuleiro.cena().vidaContagem.emitidos);
  await page.waitForTimeout(4500);
  const vida = await page.evaluate(() => {
    const c = window.__tabuleiro.cena();
    return { emitidos: c.vidaContagem.emitidos, fios: c.fios.length / 4 };
  });
  ok(vida.fios >= 1, "há fio da subestação a cada consumidor atendido", vida);
  ok(vida.emitidos > emitidos0, '"+₵" ou "+🔬" nascem sobre os prédios', [emitidos0, vida.emitidos]);
  await captura("07-vida", ".tabuleiro");

  /* 8. Sem rolagem horizontal e sem erro no console */
  const rolagem = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(!rolagem, "sem rolagem horizontal");
  ok(erros.length === 0, "sem erros no console", erros.slice(0, 3));

  await browser.close();
}

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const tamanhos = [
    { nome: "desktop", w: 1280, h: 800 },
    { nome: "celular", w: 390, h: 844 },
  ];
  for (const t of process.env.SO_CELULAR ? tamanhos.slice(1) : tamanhos) await rodar(t);
  console.log(`\n${feitos} verificações passaram, ${falhas} falharam.`);
  process.exit(falhas > 0 ? 1 : 0);
})();
