/**
 * Roteiro de verificação da Sessão 8 (GDD Parte 2) — Era 2: transição, reator PWR com combustível
 * finito e calor de decaimento, construções 2×2, mar raso, térmica com combustível e cidade 5–6.
 *
 * Roda contra `npm run dev -- --host 127.0.0.1 --port 5173` nos dois tamanhos (1280×800 e 390×844),
 * com o Chromium do ambiente:
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/sessao-8.cjs
 *
 * Capturas em `docs/capturas/sessao-8/` (ou em `CAPTURAS=` quando rodado como regressão).
 * Sai com código 1 se qualquer verificação falhar.
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.URL ?? "http://127.0.0.1:5173/";
const SAIDA = process.env.CAPTURAS ? path.resolve(process.env.CAPTURAS) : path.resolve(__dirname, "../../docs/capturas/sessao-8");
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

async function rodar(tamanho) {
  console.log(`\n— ${tamanho.nome} (${tamanho.w}×${tamanho.h}) —`);
  const browser = await chromium.launch({ args: ARGS });
  const contexto = await browser.newContext({ viewport: { width: tamanho.w, height: tamanho.h }, deviceScaleFactor: 1, hasTouch: tamanho.nome === "celular", isMobile: false });
  const page = await contexto.newPage();
  const erros = [];
  page.on("console", (m) => m.type() === "error" && erros.push(m.text()));
  page.on("pageerror", (e) => erros.push(String(e)));
  const captura = async (nome) => {
    // no celular a página rola: as capturas do tabuleiro começam do topo
    if (tamanho.nome === "celular" && !nome.includes("extrato")) await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SAIDA, `${tamanho.nome}-${nome}.png`) });
  };

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__jogo && !!window.__tabuleiro, null, { timeout: 20000 });
  await page.waitForTimeout(900);
  await fecharCards(page);
  await page.waitForTimeout(300);

  /* 1. A porta da Era 2: Estabilidade 100 % + Fissão básica + ₵ 200 000 */
  await carregar(page, `
    s.creditos = 400000;
    s.pesquisa = 300000;
    s.cardsVistos = ["abertura", "cincoPecas"];
    s.pesquisados = Array.from(new Set([...s.pesquisados, "receptorCeramico", "turbinaAltaPressao", "fissaoBasica"]));
    if (!s.nucleo) s.nucleo = { era: 1, lado: 5, grade: [], calorU: 0, tempoAcimaDoLimiteMs: 0, scramRestanteMs: 0, scramInicioMs: null, trocasEmFaixa: 0, estabilidade: 0, modoSeguro: false, receptorCeramico: false, cascatas: 0, ultimaCascataMs: null, ultimaCascata: null };
    s.nucleo.estabilidade = 100;
  `);
  const botao = page.locator("button", { hasText: "Construir o Reator" });
  ok((await botao.count()) > 0, 'o botão "Construir o Reator" aparece com Estabilidade 100 % e Fissão básica');
  ok(await botao.first().isEnabled(), "o botão está habilitado com ₵ 200 000 em caixa");
  await captura("01-construir-reator");

  await botao.first().click();
  await page.waitForTimeout(400);
  await fecharCards(page);
  await page.waitForTimeout(1200);
  const depois = await estado(page);
  ok(depois.era === 2, "o clique leva à Era 2", depois.era);
  ok(depois.nucleo.era === 2 && depois.nucleo.lado === 5, "o Núcleo vira Reator numa grade 5×5", [depois.nucleo.era, depois.nucleo.lado]);
  ok(depois.nucleo.estabilidade === 0, "a Estabilidade zera: ela é da era, não do jogador", depois.nucleo.estabilidade);
  ok(depois.nucleo.grade.filter(Boolean).length === 1, "só o Vaso fica na grade", depois.nucleo.grade.filter(Boolean).length);
  ok(depois.mundo.ilhasAbertas.length >= 1 && depois.creditos > 0, "o resto do mundo continua igual", [depois.mundo.ilhasAbertas.length, Math.round(depois.creditos)]);
  const eraDom = await page.getAttribute(".app", "data-era");
  ok(eraDom === "2", "a paleta entardecer entra pelo `data-era` do app", eraDom);
  await page.waitForTimeout(3200); // a câmera afasta 3 s e volta ao Núcleo
  await fecharCards(page);
  await page.waitForTimeout(400);
  await captura("02-era2-reator");

  /* 2. Primeira vareta: combustível e calor */
  await page.evaluate(() => {
    const loja = window.__jogo.store.getState();
    loja.colocarPeca(11, "turbinaAlta");
    loja.colocarPeca(13, "turbinaAlta");
    for (const i of [6, 7, 8, 16]) loja.colocarPeca(i, "vareta");
    for (const i of [0, 4]) loja.colocarPeca(i, "vareta");
  });
  await avancar(page, 600);
  const comVaretas = await estado(page);
  const varetas = comVaretas.nucleo.grade.filter((c) => c && c.tipo === "peca" && c.id === "vareta");
  ok(varetas.length === 6, "seis varetas na grade", varetas.length);
  ok(varetas.every((v) => v.vareta && v.vareta.restanteS < 600 && v.vareta.restanteS > 500), "as varetas gastam combustível a cada tick", varetas[0] && varetas[0].vareta);
  const calor = await page.evaluate(() => {
    const s = window.__jogo.store.getState().state;
    return { t: s.nucleo.calorU, cascatas: s.nucleo.cascatas };
  });
  ok(calor.t > 300 && calor.t < 420 && calor.cascatas === 0, "6 varetas + 2 turbinas sobem para a zona de ouro sem cascatear", calor);
  const painel = await page.locator(".coluna-nucleo .palco").last().innerText();
  ok(/varetas 6 ativas/.test(painel), "o painel do Núcleo conta as varetas ativas", painel.slice(0, 200));
  await captura("03-varetas");

  /* 3. Callout da peça: combustível, decaimento e o botão Trocar */
  await page.evaluate(() => window.__jogo.store.getState().selecionarCasaNucleo(6));
  await page.waitForTimeout(200);
  const calloutTexto = await page.locator(".callout-casa--peca").innerText();
  ok(/combustível/.test(calloutTexto), "o callout da vareta mostra o combustível que resta", calloutTexto.slice(0, 160));
  await captura("04-callout-vareta");

  /* 4. Esgotamento e troca: sem piscina espera, com piscina troca na hora */
  await avancar(page, 6100); // 610 s de jogo: as varetas esgotam
  await page.waitForTimeout(300);
  const gastas = await page.evaluate(() => {
    const s = window.__jogo.store.getState().state;
    const v = s.nucleo.grade[6];
    return { gasta: !!(v && v.vareta && v.vareta.gastaDesdeMs !== null), potencia: s.nucleo.calorU };
  });
  ok(gastas.gasta, "aos 600 s a vareta esgota e passa a só decair", gastas);
  const naoPode = await page.evaluate(() => {
    const loja = window.__jogo.store.getState();
    loja.selecionarCasaNucleo(6);
    return !loja.trocarVareta(6);
  });
  ok(naoPode, "a troca é recusada enquanto o decaimento está acima de 1 %");
  const motivo = await page.locator(".callout-casa--peca").innerText();
  ok(/gasta|decaimento/.test(motivo), "o callout mostra o decaimento da vareta gasta", motivo.slice(0, 160));
  await captura("05-vareta-gasta");

  const comPiscina = await page.evaluate(() => {
    const loja = window.__jogo.store.getState();
    // a piscina precisa do nó da árvore; a casa 11 é vizinha da vareta 6
    const base = JSON.parse(JSON.stringify(loja.state));
    base.pesquisados = Array.from(new Set([...base.pesquisados, "barraDeControle", "piscinaDeResfriamento"]));
    loja.importar(JSON.stringify(base));
    const l = () => window.__jogo.store.getState();
    l().selecionarFerramenta("remover");
    l().agirNaCasa(11);
    const posta = l().colocarPeca(11, "piscina");
    const antes = l().state.creditos;
    const trocou = l().trocarVareta(6);
    const s = l().state;
    return { posta, trocou, custo: antes - s.creditos, restante: s.nucleo.grade[6] && s.nucleo.grade[6].vareta ? s.nucleo.grade[6].vareta.restanteS : null };
  });
  ok(comPiscina.trocou === true, "com Piscina vizinha a troca é imediata", comPiscina);
  ok(Math.round(comPiscina.custo) === 8000, "a troca custa ₵ 8 000", comPiscina.custo);
  ok(comPiscina.restante === 600, "a vareta trocada volta com 600 s", comPiscina.restante);

  /* 5. SCRAM da Era 2: 90 s e o decaimento entrando no Vaso */
  const scram = await page.evaluate(() => {
    const loja = window.__jogo.store.getState();
    loja.scramManual();
    const s = window.__jogo.store.getState().state;
    return { restante: s.nucleo.scramRestanteMs, inicio: s.nucleo.scramInicioMs, tempo: s.tempoMs };
  });
  ok(scram.restante === 90000, "o SCRAM da Era 2 são 60 s de parada + 30 s para religar", scram.restante);
  ok(scram.inicio === scram.tempo, "o SCRAM marca o instante: é dele que sai o decaimento", scram);
  await fecharCards(page);
  const antesDoScram = await page.evaluate(() => {
    const s = window.__jogo.store.getState().state;
    return s.nucleo.grade.map((c) => (c && c.tipo === "peca" && c.id === "vareta" && c.vareta ? c.vareta.restanteS : null));
  });
  await avancar(page, 300);
  const duranteScram = await page.evaluate(() => {
    const s = window.__jogo.store.getState().state;
    return {
      combustivel: s.nucleo.grade.map((c) => (c && c.tipo === "peca" && c.id === "vareta" && c.vareta ? c.vareta.restanteS : null)),
      calor: s.nucleo.calorU,
    };
  });
  ok(
    JSON.stringify(duranteScram.combustivel) === JSON.stringify(antesDoScram),
    "em SCRAM o combustível não some: as varetas voltam de onde estavam",
    [antesDoScram.filter((v) => v !== null), duranteScram.combustivel.filter((v) => v !== null)],
  );
  await captura("06-scram");
  await avancar(page, 950); // sai do SCRAM

  /* 6. Construção 2×2: quatro casas, e recusa quando uma está ocupada */
  const doisPorDois = await page.evaluate(() => {
    const loja = window.__jogo.store.getState();
    const arq = window.__tabuleiro.arquipelago();
    const n = arq.n;
    const s0 = window.__jogo.store.getState().state;
    const plat = arq.plataforma;
    const livre = (i) => {
      const x = i % n;
      const y = Math.floor(i / n);
      if (arq.terra[i] !== 1 || arq.caminho[i] === 1) return false;
      if (x >= plat.x0 && x < plat.x0 + plat.lado && y >= plat.y0 && y < plat.y0 + plat.lado) return false;
      if (arq.obstaculos[i] !== 255 && !s0.mundo.removidos.includes(i)) return false;
      return !s0.mundo.construcoes[i];
    };
    // uma âncora cujas quatro casas estão livres
    let ancora = null;
    for (const i of arq.ilhas[0].casas) {
      const casas = [i, i + 1, i + n, i + n + 1];
      if (casas.every(livre)) {
        ancora = i;
        break;
      }
    }
    if (ancora === null) return { erro: "sem espaço 2×2" };
    const casas = [ancora, ancora + 1, ancora + n, ancora + n + 1];
    const posto = loja.colocar(ancora, "fazendaSolar");
    const depois = window.__jogo.store.getState().state;
    // a construção mora só na âncora, mas as quatro casas ficam ocupadas
    const soNaAncora = depois.mundo.construcoes[ancora] && !depois.mundo.construcoes[casas[3]];
    const recusa = !window.__jogo.store.getState().colocar(casas[3], "cataVento");
    return { posto, soNaAncora: !!soNaAncora, recusa, ancora, construcoes: Object.keys(depois.mundo.construcoes).length };
  });
  ok(doisPorDois.posto === true, "a fazenda solar 2×2 entra numa âncora com as quatro casas livres", doisPorDois);
  ok(doisPorDois.soNaAncora === true, "a 2×2 vive numa âncora só (as outras três não têm construção própria)", doisPorDois);
  ok(doisPorDois.recusa === true, "as outras três casas da 2×2 recusam qualquer coisa", doisPorDois);

  /* 7. Mar raso: eólica offshore e a subestação do mar */
  const offshore = await page.evaluate(() => {
    const loja = window.__jogo.store.getState();
    const base = JSON.parse(JSON.stringify(loja.state));
    base.pesquisados = Array.from(new Set([...base.pesquisados, "subestacaoOffshore"]));
    base.creditos = 500000;
    loja.importar(JSON.stringify(base));
    const arq = window.__tabuleiro.arquipelago();
    const n = arq.n;
    const rasas = [];
    for (let i = 0; i < n * n; i++) if (arq.terra[i] !== 1 && arq.distMar[i] >= 1 && arq.distMar[i] <= 3) rasas.push(i);
    const l = window.__jogo.store.getState();
    let sub = null;
    let eolica = null;
    for (const i of rasas) {
      if (sub === null && l.colocar(i, "subestacaoOffshore")) sub = i;
      else if (sub !== null && eolica === null && l.colocar(i, "eolicaOffshore")) eolica = i;
      if (sub !== null && eolica !== null) break;
    }
    const a = window.__jogo.analise();
    const emTerra = arq.ilhas[0].casas.find((i) => !window.__jogo.store.getState().state.mundo.construcoes[i]);
    const recusaTerra = !window.__jogo.store.getState().colocar(emTerra, "eolicaOffshore");
    return { sub, eolica, recusaTerra, offshoreKw: a.usinas.filter((u) => u.tipo === "eolicaOffshore").reduce((t, u) => t + u.brutoKw, 0) };
  });
  ok(offshore.sub !== null && offshore.eolica !== null, "subestação offshore e eólica offshore entram no mar raso", offshore);
  ok(offshore.recusaTerra === true, "a eólica offshore recusa terra firme", offshore.recusaTerra);
  ok(offshore.offshoreKw >= 400, "a eólica offshore produz 400 kW", offshore.offshoreKw);
  await fecharCards(page);
  // enquadra o mar: é lá que a offshore mora
  await page.evaluate(() => {
    window.__jogo.store.getState().selecionarCasaNucleo(null);
    window.__jogo.store.getState().selecionarFerramentaMundo("eolicaOffshore");
    window.__jogo.store.getState().pedirPreset("ilha");
  });
  await page.waitForTimeout(1400);
  await captura("07-offshore");

  /* 8. Térmica a gás: combustível como custo no extrato */
  const termica = await page.evaluate(() => {
    const loja = window.__jogo.store.getState();
    const base = JSON.parse(JSON.stringify(loja.state));
    base.pesquisados = Array.from(new Set([...base.pesquisados, "subestacaoDe138kV"]));
    base.creditos = 1000000;
    loja.importar(JSON.stringify(base));
    const arq = window.__tabuleiro.arquipelago();
    const n = arq.n;
    const l = window.__jogo.store.getState();
    const s0 = l.state;
    const plat = arq.plataforma;
    const livre = (i) => {
      const x = i % n;
      const y = Math.floor(i / n);
      if (arq.terra[i] !== 1 || arq.caminho[i] === 1) return false;
      if (x >= plat.x0 && x < plat.x0 + plat.lado && y >= plat.y0 && y < plat.y0 + plat.lado) return false;
      if (arq.obstaculos[i] !== 255 && !s0.mundo.removidos.includes(i)) return false;
      return !window.__jogo.store.getState().state.mundo.construcoes[i];
    };
    // primeiro a térmica, depois a subestação de 138 kV **ao lado dela**: sem escoamento ela desliga
    let ancora = null;
    for (const i of arq.ilhas[0].casas) {
      const casas = [i, i + 1, i + n, i + n + 1];
      if (casas.every(livre) && window.__jogo.store.getState().colocar(i, "termicaGas")) {
        ancora = i;
        break;
      }
    }
    let sub = null;
    if (ancora !== null) {
      const ax = ancora % n;
      const ay = Math.floor(ancora / n);
      for (let dy = -3; dy <= 4 && sub === null; dy++) {
        for (let dx = -3; dx <= 4 && sub === null; dx++) {
          const j = (ay + dy) * n + ax + dx;
          if (j < 0 || j >= n * n || !livre(j)) continue;
          if (window.__jogo.store.getState().colocar(j, "subestacao138")) sub = j;
        }
      }
    }
    const a = window.__jogo.analise();
    const t = a.usinas.find((u) => u.tipo === "termicaGas");
    return { sub, ancora, custo: a.custoOperacaoPorSegundo, termicas: a.contagem.termicaGas, escoado: t ? t.escoadoKw : 0 };
  });
  ok(termica.ancora !== null, "a térmica a gás 2×2 entra em terra", termica);
  ok(termica.custo > 0, "a térmica queima combustível: ₵/s de custo de operação", termica.custo);
  await page.waitForTimeout(400);
  const extrato = await page.locator(".rede .extrato").innerText();
  ok(/Combustível/.test(extrato), "o extrato mostra o combustível como custo", extrato.slice(0, 260));
  ok(/Receita líquida/.test(extrato), "o extrato mostra a receita líquida", extrato.slice(0, 260));
  await fecharCards(page);
  await page.evaluate(() => window.__jogo.store.getState().selecionarCasaNucleo(null));
  await page.locator(".rede .extrato").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await captura("08-extrato-combustivel");
  await page.evaluate(() => window.scrollTo(0, 0));

  /* 9. Cidade: megacidade só com o nó da Era 2 */
  const megacidade = await page.evaluate(() => {
    const loja = window.__jogo.store.getState();
    const base = JSON.parse(JSON.stringify(loja.state));
    base.creditos = 2000000;
    base.pesquisa = 200000;
    const casa = Object.keys(base.mundo.construcoes).map(Number).find((i) => base.mundo.construcoes[i].tipo === "bairro");
    base.mundo.construcoes[casa].nivel = 3;
    loja.importar(JSON.stringify(base));
    const semNo = !window.__jogo.store.getState().evoluirBairro(casa);
    const comNo = JSON.parse(JSON.stringify(window.__jogo.store.getState().state));
    comNo.pesquisados = Array.from(new Set([...comNo.pesquisados, "megacidade"]));
    window.__jogo.store.getState().importar(JSON.stringify(comNo));
    const evoluiu = window.__jogo.store.getState().evoluirBairro(casa);
    return { semNo, evoluiu, nivel: window.__jogo.store.getState().state.mundo.construcoes[casa].nivel };
  });
  ok(megacidade.semNo === true, "sem o nó Megacidade a metrópole não evolui", megacidade);
  ok(megacidade.evoluiu === true && megacidade.nivel === 4, "com o nó, o bairro chega à densidade 5", megacidade);

  /* 10. Árvore da Era 2: aba, nó comprado e as linhas de ligação */
  await page.evaluate(() => window.__jogo.store.getState().abrirArvore());
  await page.waitForTimeout(400);
  const abas = await page.locator(".arvore-abas button").allInnerTexts();
  ok(abas.join(",").includes("Era 2"), "a tela da árvore tem a aba da Era 2", abas);
  await page.locator(".arvore-abas button", { hasText: "Era 2" }).click();
  await page.waitForTimeout(400);
  const ligacoes = await page.locator(".arvore-ligacao").count();
  ok(ligacoes > 0, "a árvore desenha as linhas entre pré-requisito e nó", ligacoes);
  const cicloVisivel = await page.locator('[data-no="cicloCombinado"]').count();
  ok(cicloVisivel > 0, "os nós da Era 2 aparecem na aba da Era 2", cicloVisivel);
  await page.locator('[data-no="cicloCombinado"] button', { hasText: "Pesquisar" }).first().click();
  await page.waitForTimeout(300);
  const comprou = await page.evaluate(() => window.__jogo.store.getState().state.pesquisados.includes("cicloCombinado"));
  ok(comprou === true, "um nó da Era 2 pode ser comprado pela tela da árvore", comprou);
  await page.waitForTimeout(300);
  await captura("09-arvore-era2");
  await page.evaluate(() => window.__jogo.store.getState().fecharArvore());
  await page.waitForTimeout(300);

  /* 11. Kardashev em MW e sem rolagem horizontal */
  const kardashev = await page.locator(".kardashev, .painel-kardashev").first().innerText().catch(() => "");
  ok(kardashev.length > 0, "a régua Kardashev continua na tela", kardashev.slice(0, 80));
  const rolagem = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  ok(rolagem.w <= rolagem.c + 1, "sem rolagem horizontal", rolagem);

  // Arquipélago ao entardecer: a câmera afasta para o mar aparecer (GDD Parte 2 §8)
  await fecharCards(page);
  await page.evaluate(() => window.__jogo.store.getState().pedirPreset("ilha"));
  await page.waitForTimeout(1400);
  await fecharCards(page);
  await page.waitForTimeout(600);
  await captura("10-arquipelago-era2");

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
