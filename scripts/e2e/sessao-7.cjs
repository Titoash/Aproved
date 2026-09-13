/**
 * Roteiro de verificação da Sessão 7 (GDD v0.6) — cidade com densidade, laboratório, universidade,
 * 🔬 gasto na árvore de pesquisa e capítulos.
 *
 * Roda contra `npm run dev -- --host 127.0.0.1 --port 5173` nos dois tamanhos (1280×800 e 390×844),
 * com o Chromium do ambiente:
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/sessao-7.cjs
 *
 * Capturas em `docs/capturas/sessao-7/`. Sai com código 1 se qualquer verificação falhar.
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.URL ?? "http://127.0.0.1:5173/";
// Regra da Sessão 7 (ajuste 7): rodar um roteiro antigo como regressão **não** pode sobrescrever as
// capturas da sessão dele. `CAPTURAS=/caminho/fora/do/repo` redireciona a saída.
const SAIDA = process.env.CAPTURAS ? path.resolve(process.env.CAPTURAS) : path.resolve(__dirname, "../../docs/capturas/sessao-7");
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
const analise = (page) =>
  page.evaluate(() => {
    const a = window.__jogo.analise();
    return {
      populacao: a.populacao,
      tarifa: a.tarifa,
      demandaKw: a.demandaKw,
      pesquisaPorSegundo: a.pesquisaPorSegundo,
      limiteUniversidades: a.limiteUniversidades,
      universidadesAtivas: a.universidadesAtivas,
      contagem: a.contagem,
      usinas: a.usinas.map((u) => ({ indice: u.indice, tipo: u.tipo, brutoKw: u.brutoKw, fatorEsteira: u.fatorEsteira })),
    };
  });

async function fecharCards(page) {
  for (let i = 0; i < 10; i++) {
    const b = page.locator("button", { hasText: /^(Próximo|Entendi)$/ }).first();
    if ((await b.count()) === 0 || !(await b.isVisible())) break;
    await b.click();
    await page.waitForTimeout(120);
  }
}

/** Dá ₵ e 🔬 sem passar pela economia (o roteiro testa mecânica, não ritmo). */
async function abastecer(page, creditos = 500000, pesquisa = 5000) {
  await page.evaluate(
    ([c, p]) => {
      const s = window.__jogo.store.getState();
      s.importar(JSON.stringify({ ...s.state, creditos: c, pesquisa: p, cardsVistos: ["abertura"] }));
    },
    [creditos, pesquisa],
  );
  await page.waitForTimeout(200);
}

/** Coloca construções direto pelo store, em casas livres da ilha principal (sem depender do toque). */
async function plantar(page, tipo, quantos) {
  return page.evaluate(
    ([t, q]) => {
      const loja = window.__jogo.store.getState();
      const arq = window.__tabuleiro.arquipelago();
      const n = arq.n;
      const postas = [];
      void loja;
      for (const i of arq.ilhas[0].casas) {
        if (postas.length >= q) break;
        const st = window.__jogo.store.getState().state;
        if (arq.obstaculos[i] !== 255 && !st.mundo.removidos.includes(i)) continue;
        if (arq.caminho[i] === 1 || st.mundo.construcoes[i]) continue;
        const plat = arq.plataforma;
        const x = i % n;
        const y = Math.floor(i / n);
        if (x >= plat.x0 && x < plat.x0 + plat.lado && y >= plat.y0 && y < plat.y0 + plat.lado) continue;
        // só casas com subestação no alcance: sem escoamento o prédio não pede nem rende
        const subs = Object.keys(st.mundo.construcoes)
          .map(Number)
          .filter((j) => st.mundo.construcoes[j].tipo === "subestacao");
        const perto = subs.some((j) => Math.max(Math.abs(x - (j % n)), Math.abs(y - Math.floor(j / n))) <= 3);
        if (!perto) continue;
        if (window.__jogo.store.getState().colocar(i, t)) postas.push(i);
      }
      return postas;
    },
    [tipo, quantos],
  );
}

const esperarTicks = (page, ms = 400) => page.waitForTimeout(ms);

async function rodar(tamanho) {
  const toque = tamanho.nome === "celular";
  console.log(`\n— ${tamanho.nome} (${tamanho.w}×${tamanho.h}) —`);
  const browser = await chromium.launch({ args: ARGS });
  const contexto = await browser.newContext({ viewport: { width: tamanho.w, height: tamanho.h }, deviceScaleFactor: 1, hasTouch: toque, isMobile: false });
  const page = await contexto.newPage();
  const erros = [];
  page.on("console", (m) => m.type() === "error" && erros.push(m.text()));
  page.on("pageerror", (e) => erros.push(String(e)));
  const captura = (nome) => page.screenshot({ path: path.join(SAIDA, `${tamanho.nome}-${nome}.png`) });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__jogo && !!window.__tabuleiro, null, { timeout: 20000 });
  await page.waitForTimeout(900);
  await fecharCards(page);
  await page.waitForTimeout(300);

  /* 1. HUD: 🔬 como saldo gastável, 👥 população e o capítulo ativo */
  const hudCiencia = await page.locator(".hud-item--ciencia").innerText();
  ok(/🔬/.test(hudCiencia) && /próximo:/.test(hudCiencia), "o HUD mostra 🔬 com o próximo nó à vista", hudCiencia.replace(/\n/g, " "));
  const hudPop = await page.locator(".hud-item--populacao").innerText();
  ok(/100/.test(hudPop), "o HUD mostra 👥 população (a aldeia nasce com 100)", hudPop.replace(/\n/g, " "));
  const capitulo = await page.locator(".capitulo").innerText();
  ok(/cata-vento/i.test(capitulo), "o capítulo ativo aparece no HUD com o objetivo", capitulo.replace(/\n/g, " "));
  await captura("01-hud-capitulo");

  /* 2. Capítulo concluído: 5 cata-ventos pagam a recompensa e a fila anda */
  await abastecer(page, 300, 0); // o suficiente para cinco cata-ventos, e nada mais
  const antes = await estado(page);
  await plantar(page, "cataVento", 5);
  await esperarTicks(page, 700);
  await fecharCards(page);
  const depois = await estado(page);
  ok(depois.capitulos.includes("primeirosVentos"), "o capítulo dos 5 cata-ventos conclui sozinho", depois.capitulos);
  ok(depois.creditos > antes.creditos - 5 * 25, "a recompensa do capítulo entra em ₵", [antes.creditos, depois.creditos]);
  const capitulo2 = await page.locator(".capitulo").innerText();
  ok(!/Os primeiros ventos/.test(capitulo2), "o capítulo seguinte assume o HUD", capitulo2.replace(/\n/g, " "));
  await captura("02-capitulo-concluido");

  /* 3. Cidade: o painel do bairro mostra densidade, população e demanda */
  await abastecer(page);
  const painelCidade = await page.locator(".rede").innerText();
  ok(/Cidade/.test(painelCidade) && /Aldeia/.test(painelCidade), "o painel da Cidade lista o bairro e a densidade", painelCidade.slice(0, 80));
  const a0 = await analise(page);
  ok(a0.populacao === 100 && a0.tarifa === 1, "aldeia: 100 habitantes e tarifa ×1", [a0.populacao, a0.tarifa]);

  /* 4. Evoluir um bairro: gasta ₵ + 🔬 e muda demanda, população e tarifa */
  const s0 = await estado(page);
  await page.locator(".linha", { hasText: "Aldeia" }).locator("button", { hasText: "Evoluir" }).first().click();
  await page.waitForTimeout(400);
  await fecharCards(page);
  const s1 = await estado(page);
  const a1 = await analise(page);
  // o capítulo "A aldeia vira vila" paga no mesmo tick, então o saldo de ₵ pode até subir: o que se
  // mede é o débito da evolução (🔬 cai) e a densidade que subiu
  ok(s1.pesquisa < s0.pesquisa, "evoluir gasta 🔬 do saldo", [s0.pesquisa, s1.pesquisa]);
  ok(Object.values(s1.mundo.construcoes).some((c) => c.tipo === "bairro" && c.nivel === 1), "o bairro sobe de densidade");
  ok(a1.populacao === 400, "a vila tem 400 habitantes", a1.populacao);
  ok(Math.abs(a1.tarifa - 1.15) < 1e-9, "a tarifa da vila é ×1,15", a1.tarifa);
  ok(Math.abs(a1.demandaKw - 20) < 1e-9, "a vila pede 20 kW", a1.demandaKw);
  await captura("03-bairro-evoluido");

  /* 5. Universidade: aparece com 1 000 habitantes e não antes */
  await fecharCards(page);
  const bloqueada = await page.locator(".paleta-item", { hasText: /^Universidade/ }).first();
  ok(await bloqueada.isDisabled(), "a universidade nasce bloqueada pelo nó da árvore");
  await page.locator(".hud-pesquisa").click();
  await page.waitForTimeout(300);
  await page.locator('.no[data-no="universidade"]').locator("button", { hasText: "Pesquisar" }).click();
  await page.waitForTimeout(300);
  const sU = await estado(page);
  ok(sU.pesquisados.includes("universidade"), "o nó Universidade é comprado com 🔬", sU.pesquisados.length);
  await page.locator(".arvore button", { hasText: "Fechar" }).click();
  await page.waitForTimeout(250);
  ok(!(await page.locator(".paleta-item", { hasText: /^Universidade/ }).first().isDisabled()), "a universidade entra na paleta depois do nó");

  // com 400 habitantes não há alunos; com 1 000+, há
  await plantar(page, "universidade", 1);
  await esperarTicks(page, 400);
  await fecharCards(page);
  const aPoucos = await analise(page);
  ok(aPoucos.limiteUniversidades === 0 && aPoucos.universidadesAtivas === 0, "com 400 habitantes a universidade fica sem alunos", [aPoucos.limiteUniversidades, aPoucos.universidadesAtivas]);
  await page.locator(".linha", { hasText: "Vila" }).locator("button", { hasText: "Evoluir" }).first().click();
  await page.waitForTimeout(400);
  await fecharCards(page);
  const aMuitos = await analise(page);
  ok(aMuitos.populacao >= 1000, "a cidade passa de 1 000 habitantes", aMuitos.populacao);
  ok(aMuitos.limiteUniversidades >= 1 && aMuitos.universidadesAtivas >= 1, "com 1 000 habitantes a universidade liga", [aMuitos.limiteUniversidades, aMuitos.universidadesAtivas]);
  ok(aMuitos.pesquisaPorSegundo > 0, "a universidade passa a render 🔬/s", aMuitos.pesquisaPorSegundo);
  await captura("04-universidade");

  /* 6. Laboratório: ciência e demanda */
  const semLab = await analise(page);
  await plantar(page, "laboratorio", 2);
  await esperarTicks(page, 400);
  await fecharCards(page);
  const comLab = await analise(page);
  ok(comLab.contagem.laboratorio === 2, "dois laboratórios colocados", comLab.contagem.laboratorio);
  ok(comLab.pesquisaPorSegundo > semLab.pesquisaPorSegundo, "o laboratório soma 🔬/s", [semLab.pesquisaPorSegundo, comLab.pesquisaPorSegundo]);
  ok(comLab.demandaKw > semLab.demandaKw, "o laboratório também consome kW", [semLab.demandaKw, comLab.demandaKw]);

  /* 7. Árvore: gastar 🔬 num nó e ver o efeito na produção */
  await fecharCards(page);
  const antesNo = await analise(page);
  const cataVentos = antesNo.usinas.filter((u) => u.tipo === "cataVento");
  ok(cataVentos.length >= 5, "há cata-ventos para medir", cataVentos.length);
  const sAntes = await estado(page);
  await page.locator(".hud-pesquisa").click();
  await page.waitForTimeout(300);
  const fisica = await page.locator('.no[data-no="laminasDeFibra"]').innerText();
  ok(/fibra de vidro/i.test(fisica), "cada nó traz uma frase de física", fisica.slice(0, 70));
  await captura("05-arvore");
  await page.locator('.no[data-no="laminasDeFibra"]').locator("button", { hasText: "Pesquisar" }).click();
  await page.waitForTimeout(350);
  const sDepois = await estado(page);
  ok(sDepois.pesquisados.includes("laminasDeFibra"), "o botão da árvore compra o nó", sDepois.pesquisados.length);
  ok(sDepois.pesquisados.length > sAntes.pesquisados.length, "a lista de nós comprados cresce", [sAntes.pesquisados.length, sDepois.pesquisados.length]);
  // O débito se mede num passo só: com laboratórios e universidades ligados o saldo sobe entre duas
  // leituras, e a diferença de fora do tick não diz nada.
  const debito = await page.evaluate(() => {
    const antes = window.__jogo.store.getState().state.pesquisa;
    window.__jogo.store.getState().pesquisar("painelBifacial");
    return antes - window.__jogo.store.getState().state.pesquisa;
  });
  ok(Math.abs(debito - 60) < 1e-9, "o nó cobra o 🔬 exato do saldo (Painel bifacial: 60)", debito);
  const depoisNo = await analise(page);
  const antesKw = antesNo.usinas.filter((u) => u.tipo === "cataVento").reduce((s, u) => s + u.brutoKw, 0);
  const depoisKw = depoisNo.usinas.filter((u) => u.tipo === "cataVento").reduce((s, u) => s + u.brutoKw, 0);
  ok(Math.abs(depoisKw - antesKw * 1.25) < 1e-6, "os cata-ventos rendem +25 % na hora", [antesKw, depoisKw]);

  /* 8. Exclusões visíveis na árvore */
  const exclusiva = await page.locator('.no[data-no="eixoVertical"]').innerText();
  ok(/escolha exclusiva/i.test(exclusiva), "a escolha exclusiva aparece no nó", exclusiva.slice(0, 80));
  const marcado = await page.locator(".no--comprado").count();
  ok(marcado >= 2, "os nós comprados ficam marcados", marcado);
  await page.locator(".arvore button", { hasText: "Fechar" }).click();
  await page.waitForTimeout(250);

  /* 9. Cristal: dinamitar a montanha devolve 🔬 e deixa cristal (ajuste 2 da gestão) */
  const cristal = await page.evaluate(async () => {
    const loja = window.__jogo.store.getState();
    const arq = window.__tabuleiro.arquipelago();
    loja.comprarIlha("pedreira");
    const ancora = arq.montanhas[0];
    const antes = window.__jogo.store.getState().state.pesquisa;
    window.__jogo.store.getState().desmatar(ancora);
    return { ancora, antes };
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__jogo.store.getState().avancarTicks(320)); // 32 s de jogo
  await page.waitForTimeout(300);
  await fecharCards(page);
  const sCristal = await estado(page);
  ok(sCristal.mundo.cristais.length === 4, "a montanha deixa quatro casas de cristal", sCristal.mundo.cristais.length);
  ok(sCristal.pesquisa > cristal.antes, "dinamitar a montanha devolve 🔬", [cristal.antes, sCristal.pesquisa]);

  /* 10. Cabo com teto próprio (ajuste 1 da gestão) */
  const cabo = await page.evaluate(() => {
    const loja = window.__jogo.store.getState();
    loja.comprarIlha("ventania");
    loja.ligarCabo("ventania");
    const s = window.__jogo.store.getState().state;
    const antes = s.mundo.cabos.ventania;
    window.__jogo.store.getState().melhorarCabo("ventania");
    return { antes, depois: window.__jogo.store.getState().state.mundo.cabos.ventania };
  });
  ok(cabo.antes === 0 && cabo.depois === 1, "o cabo tem nível e sobe de nível", cabo);
  const extrato = await page.locator(".rede .extrato").innerText();
  ok(/Cabo · Ventania/.test(extrato), "o extrato mostra o teto do cabo", extrato.slice(0, 200));
  await captura("06-extrato-cidade");

  /* 11. Régua Kardashev: "Sol" sem rótulo (ajuste 3 da gestão) */
  const rotulos = await page.$$eval(".kardashev-marco-rotulo--longo", (els) => els.map((e) => e.textContent));
  ok(!rotulos.includes("Sol") && rotulos.includes("Tipo II"), 'a régua mantém "Tipo II" e tira o rótulo do Sol', rotulos);

  /* 12. Sem rolagem horizontal */
  const rolagem = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  ok(rolagem.w <= rolagem.c + 1, "sem rolagem horizontal", rolagem);

  await page.evaluate(() => window.__jogo.store.getState().pedirPreset("ilha"));
  await page.waitForTimeout(900);
  await captura("07-arquipelago");

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
