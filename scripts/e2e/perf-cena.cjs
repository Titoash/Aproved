/**
 * Medida do custo por quadro da cena (GDD §10.1: no máximo 3 ms a mais com o arquipélago cheio), usada na
 * parte F da Sessão 9 para comparar antes e depois. Só roda contra `npm run dev` (o `window.__perf` só
 * existe em desenvolvimento):
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/perf-cena.cjs
 *
 * Monta um mundo cheio (todas as ilhas abertas, construção em toda casa de terra, Núcleo na zona de ouro,
 * seis remoções em curso quando a Equipe existe), mede nos enquadramentos "ilha" e "nucleo" nos dois tamanhos,
 * e desde a Sessão 10 também com a Nuvem em curso no enquadramento do aceite ("ocorrencia"), e imprime a
 * mediana de três rodadas de ~4 s, em ms por quadro, por etapa.
 */
const { chromium } = require("playwright");

const BASE = process.env.URL ?? "http://127.0.0.1:5173/";
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const TAMANHOS = process.env.SO_DESKTOP ? [{ nome: "desktop", w: 1280, h: 800 }] : [
  { nome: "desktop", w: 1280, h: 800 },
  { nome: "celular", w: 390, h: 844 },
];

async function fecharCards(page) {
  for (let i = 0; i < 12; i++) {
    const b = page.locator("button", { hasText: /^(Próximo|Entendi)$/ }).first();
    if ((await b.count()) === 0 || !(await b.isVisible())) break;
    await b.click();
    await page.waitForTimeout(120);
  }
}

/** O mundo cheio, montado dentro da página com o mesmo arquipélago do jogo. */
async function mundoCheio(page) {
  await page.evaluate(() => {
    const loja = window.__jogo.store.getState();
    const arq = window.__tabuleiro.arquipelago();
    const n = arq.n;
    const s = JSON.parse(JSON.stringify(loja.state));
    const tipos = ["subestacao", "bairro", "painelSolar", "laboratorio", "turbinaEolica", "cataVento", "bairro"];
    const construcoes = {};
    const livres = [];
    let k = 0;
    const plat = arq.plataforma;
    for (let i = 0; i < n * n; i++) {
      if (arq.terra[i] !== 1) continue;
      const x = i % n;
      const y = Math.floor(i / n);
      if (x >= plat.x0 && x < plat.x0 + plat.lado && y >= plat.y0 && y < plat.y0 + plat.lado) continue;
      // deixa alguns obstáculos de pé para os Bipes
      if (arq.obstaculos[i] !== 255 && arq.obstaculos[i] <= 3 && livres.length < 150) {
        livres.push(i);
        continue;
      }
      construcoes[i] = { tipo: tipos[k++ % tipos.length], nivel: 0, colocadoEmMs: 0 };
    }
    const removidos = [];
    for (let i = 0; i < n * n; i++) if (arq.obstaculos[i] !== 255 && !livres.includes(i)) removidos.push(i);
    s.creditos = 1e7;
    s.pesquisa = 1e5;
    const ilhas = ["principal", "ventania", "solar", "costa", "bosque", "pedreira", "recife", "farol"];
    s.mundo = { construcoes, removidos, remocoes: [], cristais: [], ilhasAbertas: ilhas, cabos: {} };
    for (const id of ilhas) if (id !== "principal") s.mundo.cabos[id] = 0;
    s.cidade = { densidade: 4 };
    if (s.melhorias) s.melhorias.equipe = 4;
    s.pesquisados = [...new Set([...(s.pesquisados ?? []), "laboratorio", "universidade", "bateria", "turbinaEolica"])];
    s.nucleo = null;
    loja.importar(JSON.stringify(s));
    const depois = window.__jogo.store.getState();
    for (const i of livres) depois.desmatar(i);
    // Núcleo na zona de ouro: h = 5 (4 no anel 1 + 2 no anel 2), t = 2 (§8.3)
    depois.desbloquearNucleo();
    const l2 = window.__jogo.store.getState();
    for (const i of [7, 11, 13, 17, 0, 4]) l2.colocarPeca(i, "heliostato");
    for (const i of [6, 8]) l2.colocarPeca(i, "turbina");
  });
}

function mediana(v) {
  const o = [...v].sort((a, b) => a - b);
  return o[Math.floor(o.length / 2)];
}

(async () => {
  const resultado = {};
  for (const tam of TAMANHOS) {
    const browser = await chromium.launch({ args: ARGS });
    const ctx = await browser.newContext({ viewport: { width: tam.w, height: tam.h }, deviceScaleFactor: 1, hasTouch: tam.nome === "celular" });
    const page = await ctx.newPage();
    const erros = [];
    page.on("pageerror", (e) => erros.push(String(e)));
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForFunction(() => !!window.__jogo && !!window.__tabuleiro && !!window.__perf, null, { timeout: 20000 });
    await page.waitForTimeout(800);
    await fecharCards(page);
    await mundoCheio(page);
    await page.waitForTimeout(500);
    await fecharCards(page);
    const bipes = await page.evaluate(() => window.__jogo.store.getState().state.mundo.remocoes.filter((r) => r.fimMs > 0).length);
    // "quadroOcorrencia" é o mesmo enquadramento do aceite sem a Ocorrência: a diferença para "ocorrencia" é o
    // custo do efeito em si (o enquadramento mais aberto mostra mais mundo e custa por conta própria).
    for (const preset of ["ilha", "nucleo", "quadroOcorrencia", "ocorrencia"]) {
      if (preset === "quadroOcorrencia") {
        await page.evaluate(() => {
          const loja = window.__jogo.store;
          loja.setState({ presetPedido: { nome: "ocorrencia", serie: (loja.getState().presetPedido?.serie ?? 0) + 1 } });
        });
      } else if (preset === "ocorrencia") {
        // Sessão 10: a Nuvem em curso (sombra atravessando o campo, feixes esmaecidos) no enquadramento do aceite
        await page.evaluate(() => {
          const loja = window.__jogo.store;
          const st = loja.getState().state;
          const atual = { id: "nuvem", fase: "oferta", inicioMs: st.tempoMs, controle: 1, naMetaMs: 0, potenciaRefKw: 0, aposScram: false };
          loja.setState({ state: { ...st, ocorrencia: { ...st.ocorrencia, recompensa: null, atual } } });
          loja.getState().aceitarOcorrencia();
          loja.getState().ajustarControle(0.6);
        });
      } else await page.evaluate((p) => window.__jogo.store.getState().pedirPreset(p), preset);
      await page.waitForTimeout(900);
      const rodadas = [];
      for (let r = 0; r < 3; r++) {
        await page.evaluate(() => window.__perf.zerar());
        await page.waitForTimeout(4000);
        rodadas.push(await page.evaluate(() => window.__perf.ler()));
      }
      const etapas = Object.keys(rodadas[0]);
      const med = Object.fromEntries(etapas.map((k) => [k, Number(mediana(rodadas.map((x) => x[k] ?? 0)).toFixed(3))]));
      const agora = await page.evaluate(() => window.__jogo.store.getState().state.mundo.remocoes.filter((r) => r.fimMs > 0).length);
      resultado[`${tam.nome}/${preset}`] = med;
      console.log(`${tam.nome} · ${preset} · Bipes em curso: ${bipes} no começo, ${agora} no fim:`, JSON.stringify(med));
    }
    if (erros.length) console.log("erros:", erros);
    await browser.close();
  }
  if (process.env.SAIDA_JSON) require("node:fs").writeFileSync(process.env.SAIDA_JSON, JSON.stringify(resultado, null, 2));
})();
