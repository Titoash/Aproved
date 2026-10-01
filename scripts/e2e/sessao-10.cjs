/**
 * Roteiro de verificação da Sessão 10 (GDD v0.9) — Ocorrências: a oferta aparece e expira; aceitar mostra o
 * controle, e mexer nele move a marca de Q*; superar mostra a escolha, e 🛡 +3 aparece no painel do Núcleo;
 * recusar não muda nada; nenhuma oferta aparece com o Núcleo em SCRAM. Mais o card das Ocorrências, o 🔥 do HUD,
 * o diário, a cena e a Era 2 (Xenônio depois do SCRAM, barras de controle, card da Era 2 aparecendo).
 *
 * Roda contra `npm run dev -- --host 127.0.0.1 --port 5173` nos dois tamanhos (1280×800 e 390×844 com toque),
 * com o Chromium do ambiente:
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/sessao-10.cjs
 *
 * Capturas em `docs/capturas/sessao-10/` (ou em `CAPTURAS=` quando rodado como regressão).
 * Sai com código 1 se qualquer verificação falhar.
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.URL ?? "http://127.0.0.1:5173/";
const SAIDA = process.env.CAPTURAS ? path.resolve(process.env.CAPTURAS) : path.resolve(__dirname, "../../docs/capturas/sessao-10");
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
const avancar = (page, ticks) => page.evaluate((n) => window.__jogo.store.getState().avancarTicks(n), ticks);

async function fecharCards(page) {
  for (let i = 0; i < 12; i++) {
    const b = page.locator("button", { hasText: /^(Próximo|Entendi)$/ }).first();
    if ((await b.count()) === 0 || !(await b.isVisible())) break;
    await b.click();
    await page.waitForTimeout(120);
  }
}

/**
 * Monta o Núcleo de referência da era (Era 1: h = 5, t = 2, §8.3; Era 2: 4 + 4 varetas, 2 turbinas e uma torre),
 * no equilíbrio. `extra` é corpo de função que mexe em `s` antes de importar.
 */
async function montar(page, era, extra = "") {
  await page.evaluate(
    ([e, corpo]) => {
      const loja = window.__jogo.store.getState();
      const s = JSON.parse(JSON.stringify(loja.state));
      s.cardsVistos = ["abertura", "cincoPecas", "calorDeDecaimento", "ocorrencias"];
      s.creditos = 50000;
      const g = Array(25).fill(null);
      g[12] = { tipo: "receptor" };
      const nucleo = { lado: 5, tempoAcimaDoLimiteMs: 0, scramRestanteMs: 0, scramInicioMs: null, trocasEmFaixa: 0, estabilidade: 40, modoSeguro: false, receptorCeramico: false, cascatas: 0, ultimaCascataMs: null, ultimaCascata: null };
      if (e === 1) {
        s.era = 1;
        for (const i of [6, 7, 8, 16, 0, 4]) g[i] = { tipo: "peca", id: "heliostato" };
        for (const i of [11, 13]) g[i] = { tipo: "peca", id: "turbina" };
        s.nucleo = { ...nucleo, era: 1, grade: g, calorU: 250 / 3 };
      } else {
        s.era = 2;
        // 4 + 4 varetas, 2 turbinas e 1 torre: T* = 75 %, e a torre segura o decaimento durante o SCRAM
        for (const i of [6, 7, 8, 16, 0, 1, 2, 3]) g[i] = { tipo: "peca", id: "vareta", vareta: { restanteS: 600, gastaDesdeMs: null } };
        for (const i of [11, 13]) g[i] = { tipo: "peca", id: "turbinaAlta" };
        g[17] = { tipo: "peca", id: "torreResfriamento" };
        s.nucleo = { ...nucleo, era: 2, grade: g, calorU: 375 };
      }
      s.ocorrencia = { relogioMs: 0, semente: 20260930, primeiraOfertaFeita: true, xenonioPendente: false, atual: null, recompensa: null, superadas: 0 };
      new Function("s", corpo)(s);
      loja.importar(JSON.stringify(s));
    },
    [era, extra],
  );
  await page.waitForTimeout(250);
  await fecharCards(page);
}

/** Relógio a um tick dos 4 min: o próximo tick oferece. */
async function quaseNaHora(page) {
  await page.evaluate(() => {
    const loja = window.__jogo.store;
    const st = loja.getState().state;
    loja.setState({ state: { ...st, ocorrencia: { ...st.ocorrencia, relogioMs: 239_900 } } });
  });
}

const dentroDaTela = (page, seletor) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top >= -1 && r.bottom <= window.innerHeight + 1 && r.left >= -1 && r.right <= window.innerWidth + 1;
  }, seletor);

/** Posição da marca de Q* na barra de calor (fração 0..1 do trilho), pelo destino dela (a marca anda com transição). */
const posicaoMarca = (page) =>
  page.evaluate(() => {
    const m = document.querySelector(".palco [data-testid='marca-q']");
    return m ? parseFloat(m.style.left) / 100 : null;
  });

/** Arrasta o controle até a fração `f` (0 = mínimo, 1 = máximo): mouse no desktop, toque de verdade no celular. */
async function arrastarControle(page, toque, f) {
  const trilho = page.locator(".controle-trilho");
  await trilho.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const b = await trilho.boundingBox();
  const vertical = (await trilho.getAttribute("aria-orientation")) === "vertical";
  const ponto = (k) => (vertical ? [b.x + b.width / 2, b.y + b.height * (1 - k)] : [b.x + b.width * k, b.y + b.height / 2]);
  const [x0, y0] = ponto(0.5);
  const [x1, y1] = ponto(f);
  if (!toque) {
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(x0 + ((x1 - x0) * i) / 6, y0 + ((y1 - y0) * i) / 6);
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  const toqueEm = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  await toqueEm("touchStart", x0, y0);
  for (let i = 1; i <= 6; i++) await toqueEm("touchMove", x0 + ((x1 - x0) * i) / 6, y0 + ((y1 - y0) * i) / 6);
  await toqueEm("touchEnd", x1, y1);
  await cdp.detach();
}

/**
 * Liga um operador dentro da página que acompanha o perfil enquanto o roteiro confere e captura: o jogo anda em
 * tempo real entre os passos, e sem isto o controle ficava parado no valor do platô durante a rampa de saída.
 */
const ligarOperador = (page) =>
  page.evaluate(() => {
    window.__operador = setInterval(() => {
      const loja = window.__jogo.store;
      const s = loja.getState().state;
      if (s.ocorrencia.atual?.fase === "ativa") loja.getState().ajustarControle(window.__jogo.ocorrencias.controleQueCompensa(s, s.tempoMs + 100));
    }, 30);
  });

/** Opera a Ocorrência até o fim acompanhando o perfil (como a rota operador da simulação) e desliga o operador. */
async function operarAteOFim(page) {
  await page.evaluate(() => {
    clearInterval(window.__operador);
    const loja = window.__jogo.store;
    const sim = window.__jogo.ocorrencias;
    for (let i = 0; i < 1000 && loja.getState().state.ocorrencia.atual?.fase === "ativa"; i++) {
      const s = loja.getState().state;
      loja.getState().ajustarControle(sim.controleQueCompensa(s, s.tempoMs + 100));
      loja.getState().avancarTicks(1);
    }
  });
  await page.waitForTimeout(250);
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
    await page.waitForTimeout(200);
    if (alvo) await page.locator(alvo).screenshot({ path: path.join(SAIDA, `${tamanho.nome}-${nome}.png`) });
    else await page.screenshot({ path: path.join(SAIDA, `${tamanho.nome}-${nome}.png`) });
  };

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__jogo && !!window.__tabuleiro && !!window.__jogo.ocorrencias, null, { timeout: 20000 });
  await page.waitForTimeout(900);
  await fecharCards(page);

  /* 1. A primeira oferta abre o card "Ocorrências" (2 telas), que pausa o jogo */
  await montar(page, 1, "s.cardsVistos = s.cardsVistos.filter((c) => c !== 'ocorrencias'); s.ocorrencia.primeiraOfertaFeita = false;");
  await quaseNaHora(page);
  await avancar(page, 1);
  await page.waitForTimeout(250);
  const card = await page.locator(".card-explicativo").isVisible().catch(() => false);
  const passo = card ? await page.locator(".card-explicativo-passo").innerText() : "";
  ok(card && /1 de 2/.test(passo), 'a primeira oferta abre o card "Ocorrências" em 2 telas', passo);
  const t0 = (await estado(page)).tempoMs;
  await avancar(page, 50);
  ok((await estado(page)).tempoMs === t0, "o card das Ocorrências pausa o jogo (a janela de 60 s não corre)");
  await captura("01-card");
  await fecharCards(page);

  /* 2. A oferta: Nuvem primeiro, cartão no painel do Núcleo, 🔥 pulsando, diário */
  const s1 = await estado(page);
  ok(s1.ocorrencia.atual?.id === "nuvem" && s1.ocorrencia.atual.fase === "oferta", "a primeira oferta do save é a Nuvem", s1.ocorrencia.atual);
  const cartao = page.locator(".ocorrencia[data-fase='oferta']");
  ok(await cartao.isVisible(), "o cartão da oferta aparece no painel do Núcleo");
  const textoCartao = await cartao.innerText();
  ok(/Nuvem sobre o campo/.test(textoCartao) && /45 s/.test(textoCartao) && /🛡 \+3 ou 🔬/.test(textoCartao), "o cartão diz nome, duração e recompensa", textoCartao.slice(0, 80));
  ok(/nuvem derruba a luz direta/i.test(textoCartao), "o cartão traz a frase de física");
  ok((await page.locator("[data-acao='aceitar-ocorrencia']").count()) === 1 && (await page.locator("[data-acao='recusar-ocorrencia']").count()) === 1, 'botões "Aceitar" e "Agora não"');
  ok(/expira em 60 s/.test(await page.locator("[data-testid='contagem-oferta']").innerText()), "a contagem dos 60 s aparece");
  ok((await page.locator(".hud-item--oferta-ocorrencia").count()) === 1, "o 🔥 do HUD pulsa enquanto há oferta");
  const diario = await page.evaluate(() => window.__jogo.store.getState().diario.map((l) => l.texto));
  ok(diario.some((t) => /Ocorrência: Nuvem/.test(t)), "o diário registra a oferta", diario);
  if (toque) {
    // no celular o cartão pode estar fora da vista: tocar no 🔥 leva até ele
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);
    await page.locator("[data-acao='abrir-ocorrencia']").tap();
    await page.waitForTimeout(700);
    ok(await dentroDaTela(page, ".ocorrencia"), "tocar no 🔥 traz o cartão da oferta para a tela");
    await page.evaluate(() => window.scrollTo(0, 0));
  } else {
    await page.locator("[data-acao='abrir-ocorrencia']").click();
    await page.waitForTimeout(400);
    ok(await page.evaluate(() => document.activeElement?.getAttribute("data-acao") === "aceitar-ocorrencia"), 'clicar no 🔥 põe o foco em "Aceitar"');
  }
  await captura("02-oferta");

  /* 3. A oferta expira em 60 s sem custo */
  const antesExpira = await estado(page);
  await avancar(page, 600);
  const depoisExpira = await estado(page);
  ok(depoisExpira.ocorrencia.atual === null && (await page.locator(".ocorrencia").count()) === 0, "a oferta expira em 60 s e o cartão some");
  // o jogo segue em tempo real entre os passos do roteiro: o relógio já andou uns ticks desde que zerou
  ok(depoisExpira.ocorrencia.relogioMs < 30_000, "o relógio recomeça quando a oferta expira", depoisExpira.ocorrencia.relogioMs);
  ok(depoisExpira.nucleo.cascatas === antesExpira.nucleo.cascatas, "deixar expirar não custa nada");

  /* 4. "Agora não" não muda nada além do relógio */
  await quaseNaHora(page);
  await avancar(page, 1);
  // antes e depois no mesmo instante (o jogo segue em tempo real): o clique no botão é síncrono
  const igual = await page.evaluate(() => {
    const loja = window.__jogo.store;
    const semOcorrencia = (s) => JSON.stringify({ ...s, ocorrencia: null, eventos: [] });
    const antes = semOcorrencia(loja.getState().state);
    document.querySelector("[data-acao='recusar-ocorrencia']").click();
    return antes === semOcorrencia(loja.getState().state);
  });
  await page.waitForTimeout(200);
  const depoisRecusa = await estado(page);
  ok(igual, "recusar não muda nada no jogo");
  ok(depoisRecusa.ocorrencia.atual === null && depoisRecusa.ocorrencia.relogioMs < 5000, "recusar tira a oferta e recomeça o relógio", depoisRecusa.ocorrencia.relogioMs);

  /* 5. Aceitar: o controle aparece, e mexer nele move a marca de Q* (a Nuvem, posta na mesa como o sorteio poria) */
  await page.evaluate(() => {
    const loja = window.__jogo.store;
    const st = loja.getState().state;
    const atual = { id: "nuvem", fase: "oferta", inicioMs: st.tempoMs, controle: 1, naMetaMs: 0, potenciaRefKw: 0, aposScram: false };
    loja.setState({ state: { ...st, ocorrencia: { ...st.ocorrencia, atual } } });
  });
  await page.waitForTimeout(200);
  const idAceita = (await estado(page)).ocorrencia.atual.id;
  await page.locator("[data-acao='aceitar-ocorrencia']").click();
  await page.waitForTimeout(600);
  ok((await page.locator(".controle-trilho[role='slider']").count()) === 1, "aceitar mostra o controle grande");
  ok(/Carga das turbinas · 100 %/.test(await page.locator("[data-testid='rotulo-controle']").innerText()), 'o controle se chama "Carga das turbinas · 100 %"');
  ok((await page.locator("[data-testid='faixa-alvo']").count()) === 1, "a faixa-alvo aparece na barra de calor");
  await avancar(page, 30); // 3 s parado em 100 %: no meio da rampa a marca já mostra o Q* caindo
  const marcaAntes = await posicaoMarca(page);
  // arrasta até o valor que compensa a perturbação no platô (a Nuvem pede 60 %)
  const alvo = await page.evaluate(() => {
    const st = window.__jogo.store.getState().state;
    return window.__jogo.ocorrencias.controleQueCompensa(st, st.tempoMs + 10_000);
  });
  await arrastarControle(page, toque, (alvo - 0.5) / 1.0);
  await page.waitForTimeout(400);
  const marcaDepois = await posicaoMarca(page);
  const controle = (await estado(page)).ocorrencia.atual?.controle ?? null;
  ok(controle !== null && Math.abs(controle - alvo) < 0.03, `arrastar põe a carga das turbinas onde o dedo soltou (${toque ? "toque" : "mouse"})`, [idAceita, alvo, controle]);
  ok(marcaAntes !== null && marcaDepois !== null && Math.abs(marcaDepois - marcaAntes) > 0.03, "mexer no controle move a marca de Q* na barra de calor", [marcaAntes, marcaDepois]);
  ok(/faltam \d+ s/.test(await page.locator("[data-testid='tempo-ocorrencia']").innerText()), "o cartão mostra o tempo que falta");
  ok(/na meta \d+ s de \d+ s/.test(await page.locator("[data-testid='na-meta']").innerText()), "o cartão mostra o tempo na meta");
  await ligarOperador(page);
  const cena = await page.evaluate(() => window.__tabuleiro.cena().ocorrencia);
  ok(cena !== null && cena.id === idAceita, "a cena recebe a Ocorrência em curso", cena);
  await captura("03-ativa");
  await captura("04-cena", ".tabuleiro");

  /* 6. Superar: a escolha da recompensa; 🛡 +3 aparece no painel do Núcleo */
  await operarAteOFim(page);
  const sSuperada = await estado(page);
  ok(sSuperada.ocorrencia.recompensa !== null, "operando acompanhando a rampa, a Ocorrência é superada", sSuperada.ocorrencia);
  ok((await page.locator("[data-acao='recompensa-estabilidade']").count()) === 1 && (await page.locator("[data-acao='recompensa-pesquisa']").count()) === 1, "superar mostra a escolha em dois botões");
  await captura("05-recompensa");
  // antes e depois no mesmo instante: o jogo segue em tempo real e a barra sobe sozinha entre dois passos
  const premio = await page.evaluate(() => {
    const loja = window.__jogo.store;
    const antes = loja.getState().state.nucleo.estabilidade;
    document.querySelector("[data-acao='recompensa-estabilidade']").click();
    return [antes, loja.getState().state.nucleo.estabilidade];
  });
  await page.waitForTimeout(250);
  ok(Math.abs(premio[1] - Math.min(100, premio[0] + 3)) < 1e-6, "🛡 +3 na Estabilidade", premio);
  const ganho = page.locator("[data-testid='ganho-estabilidade']");
  ok((await ganho.count()) === 1 && /🛡 \+3/.test(await ganho.innerText()), '"🛡 +3" aparece no painel do Núcleo');
  const diario2 = await page.evaluate(() => window.__jogo.store.getState().diario.map((l) => l.texto));
  ok(diario2.some((t) => /Recompensa: 🛡 \+3/.test(t)), "o diário registra a recompensa", diario2);

  /* 7. Nenhuma oferta com o Núcleo em SCRAM */
  await page.locator("button", { hasText: "SCRAM manual" }).click();
  await page.waitForTimeout(150);
  await quaseNaHora(page);
  await avancar(page, 50);
  const sScram = await estado(page);
  ok(sScram.nucleo.scramRestanteMs > 0 && sScram.ocorrencia.atual === null && (await page.locator(".ocorrencia").count()) === 0, "nenhuma oferta aparece com o Núcleo em SCRAM");

  /* 8. Era 2: o card do SCRAM aparece (a fila dos cards da Era 2 não trava), Xenônio depois do SCRAM, barras */
  await montar(page, 2, "s.cardsVistos = s.cardsVistos.filter((c) => c !== 'scramEra2');");
  await page.locator("button", { hasText: "SCRAM manual" }).click();
  await page.waitForTimeout(300);
  const cardEra2 = await page.locator(".card-explicativo h3").innerText().catch(() => "");
  ok(cardEra2.length > 0, "o card da Era 2 (SCRAM) aparece: o card explicativo lê as duas eras", cardEra2);
  await fecharCards(page);
  await quaseNaHora(page);
  await avancar(page, 950); // 90 s de SCRAM: a oferta sai quando o reator volta
  const sXe = await estado(page);
  ok(sXe.ocorrencia.atual?.id === "xenonio" && sXe.ocorrencia.atual.aposScram, "depois do SCRAM da Era 2 a próxima oferta é o Xenônio", sXe.ocorrencia.atual);
  ok(/SCRAM/.test(await page.locator(".ocorrencia-causa").innerText().catch(() => "")), "o cartão do Xenônio diz a causa");
  await page.locator("[data-acao='aceitar-ocorrencia']").click();
  await page.waitForTimeout(500);
  const trilhoXe = page.locator(".controle-trilho");
  ok((await trilhoXe.getAttribute("aria-orientation")) === "vertical", "as barras de controle são um controle vertical");
  ok(/Barras de controle · potência 100 %/.test(await page.locator("[data-testid='rotulo-controle']").innerText()), 'o controle se chama "Barras de controle · potência 100 %"');
  await avancar(page, 30); // o xenônio age devagar: 3 s depois do aceite a rampa mal começou
  await arrastarControle(page, toque, 1); // para cima = retirar barras = mais potência
  await page.waitForTimeout(300);
  const pXe = (await estado(page)).ocorrencia.atual.controle;
  ok(pXe > 1.2, "arrastar para cima retira as barras (mais potência)", pXe);
  const barras = await page.evaluate(() => window.__tabuleiro.cena().receptor?.barras);
  ok(Math.abs(barras - pXe) < 1e-9, "as barras aparecem no Vaso com a potência escolhida", [barras, pXe]);
  await ligarOperador(page);
  await captura("06-xenonio");
  await operarAteOFim(page);
  const sXeFim = await estado(page);
  ok(sXeFim.ocorrencia.recompensa?.id === "xenonio", "o Xenônio acompanhado pela rampa é superado");
  await page.locator("[data-acao='recompensa-pesquisa']").click();
  await page.waitForTimeout(200);
  ok((await estado(page)).pesquisa > sXeFim.pesquisa, "a escolha 🔬 soma a 🔬 guardada");

  /* 9. Sem rolagem horizontal e sem erro no console */
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
