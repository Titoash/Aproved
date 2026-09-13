# Sessão 6 — relatório de produção

Branch `claude/sessao-6`, a partir de `claude/era1-scaffold-rede-pqkglz`. GDD v0.6, roteiro em
`docs/sessoes/sessao-6.md`. Este arquivo abre com o plano (passo a passo) e termina com decisões, medições
e pendências.

## Plano

**A · Geração do arquipélago (sim puro)**
1. `content/era1-arquipelago.ts`: grade 64×64, semente, plataforma, as 8 ilhas de §8.5 (casas, terreno
   dominante, expedição, obstáculos de nascença), tabela de obstáculos (custo, 🔬, tempo), subestação
   (custo, alcance, teto, níveis), cabo (fixo + por casa de mar), terrenos e seus fatores.
2. `sim/arquipelago.ts` (tipos) e `sim/gerarArquipelago.ts`: crescimento determinístico por fila de
   prioridade a partir de 8 sementes, com canal de mar obrigatório entre ilhas; terreno por casa;
   obstáculos de nascença; clareira inicial em volta da plataforma e da aldeia; rota de cabo por ilha.
3. Testes: 2048 casas exatas repartidas nos tamanhos de §8.5, ilhas 4-conexas e separadas por mar,
   plataforma 7×7 na principal, terreno válido, determinismo.

**B · Estado e ações (sim puro)**
4. `GameState.mundo`: `construcoes`, `obstaculos` (os de nascença menos os `removidos`), fila de remoção,
   `ilhasAbertas`, `cabos`.
5. `sim/mundo.ts`: colocar, remover (50 %), remover obstáculo (cobra e agenda), comprar ilha, ligar cabo.
6. `sim/producao.ts`: produção por usina = base × nível × terreno × esteira × sombra × pico; escoamento
   por subestação (alcance 3, teto em kW); demanda dos bairros com subestação; "sem escoamento" como
   sumidouro. Contagens da Rede derivadas das construções.
7. Save v6 com migração v5 → v6 (unidades recolocadas na principal, excedente reembolsado).

**C · Cena**
8. Mar com ondulação, litoral, céu e horizonte no lugar do espaço.
9. Terreno do arquipélago: 8 ilhas com penhasco, ilhas fechadas com véu e placa de expedição.
10. Obstáculos como sprites (árvore, arbusto, pedra, pântano, montanha 2×2, pico), cabos submarinos,
    alcance da subestação, realce de colocação com motivo, Bipe de manutenção na remoção com barra.

**D · UI**
11. Paleta de construção no lugar da lista de compra; extrato da Rede.
12. Escada crescente (esquerda → direita no celular, baixo → cima no desktop) com degraus que crescem.
13. Nota de ₵ desenhada no HUD com extrato ao tocar.
14. Tooltips das peças do Núcleo e card "As cinco peças"; abertura reescrita em torno de espaço.

**E · Verificação**
15. Testes do sim (geração, colocação, esteira, sombra, alcance/teto, remoção com tempo, expedição,
    cabo, migração v6, contagens derivadas) e medições de ms/tick.
16. Roteiro Playwright em `scripts/e2e/sessao-6.cjs` nos dois tamanhos, capturas em
    `docs/capturas/sessao-6/`, `ESTADO.md`, checklist e este relatório.

---

## O que foi feito

### A · Geração (commit "sim: arquipélago de 8 ilhas em 2048 casas…")
- `content/era1-arquipelago.ts` guarda **todos** os números: as 8 ilhas com as casas exatas de §8.5
  (640 + 320 + 300 + 260 + 220 + 160 + 96 + 52 = 2048), terreno dominante, preço da expedição, semente
  (x, y) e peso do crescimento, fração de colinas, densidade e quantidade de obstáculos; a tabela de
  obstáculos; os fatores de terreno e de vizinhança; a subestação e o cabo.
- `sim/gerarArquipelago.ts` faz o mapa com uma **fila de prioridade**: as 8 ilhas crescem ao mesmo tempo a
  partir das sementes, o custo de uma casa é a distância à semente deformada por ruído dividida pelo peso,
  e uma casa só é tomada se nenhuma casa de outra ilha estiver a menos de 2 casas (o canal de mar) e se
  estiver longe da borda da grade. Cada ilha para exatamente na sua cota, então o total fecha em 2048 por
  construção — e o teste verifica ilha por ilha.
- Depois vêm: distância à borda e ao mar (BFS), terreno por casa (litoral na borda — duas casas nas ilhas
  de litoral largo —, rocha nas ilhas de rocha, colina por ruído com a fração da ilha, planície no resto),
  caminhos da aldeia, aldeia e subestação de nascença, obstáculos (quantidades exatas primeiro, para
  montanha 2×2 e pico terem espaço; depois densidades), e a rota de cabo de cada ilha até o litoral mais
  próximo da principal.
- A geração leva ~35 ms e roda uma vez (`arquipelagoDaEra1()`).

### B · Mundo, produção e save (commit "sim: mundo colocado…")
- `GameState.mundo` com `construcoes` (casa → `{tipo, nivel, colocadoEmMs}`), `removidos` (as casas cujo
  obstáculo já caiu — guardar os removidos é bem menor no save do que guardar os que restam), a fila
  `remocoes` (só a primeira em curso: um Bipe de manutenção de cada vez), `ilhasAbertas` e `cabos`.
- `sim/mundo.ts` tem as ações puras e, o que mais importa para a interface, **`avaliarCasa`**, que devolve
  `ok`, o `motivo` da recusa ("Só se constrói em terra", "Ilha fechada: faça a expedição", "Árvore: remova
  primeiro", "₵ insuficientes") e o `aviso` de rendimento ("sem escoamento", "esteira −20 %",
  "sombra −30 %", "subestação no teto"). A cena desenha esse texto na pílula do realce.
- `sim/producao.ts` é a única fonte das contagens e da potência: percorre as construções, calcula a
  produção bruta por casa, distribui o escoamento (cada subestação varre só o próprio alcance 7×7),
  conta os bairros atendidos e trata as ilhas sem cabo. O resultado é memoizado por identidade do
  `mundo` + níveis das usinas + melhorias — a carga da bateria não entra na chave, senão o tick
  recalcularia tudo a cada 100 ms (foi o primeiro defeito de desempenho que apareceu: 7,8 ms por tick).
- As fórmulas de §4.1 não mudaram: `balancoRede` passou a aceitar `ofertaUsinasKw` e `demandaKw` prontos.
- Save **v6**: `mundo` sanitizado casa a casa (fora da terra, tipo desconhecido, ilha inexistente e
  obstáculo que não existe são descartados) e migração v5 → v6 em `sim/migracao-v6.ts`.

### C · Cena (commits "cena e UI…", "cena: mar sem fim…")
- `scene/tabuleiro/mar.ts`: o mar cobre o palco inteiro, com gradiente entre dois azuis, brilho quente do
  Sol na água no alto à esquerda, três faixas de água rasa até 3 casas da terra, espuma no litoral e
  ondulação que sobe 1 casa a cada 6 s. Também os cabos submarinos (tracejado que corre quando ligado) e
  o losango pontilhado do alcance da subestação (coral quando o teto está cheio).
- `terreno.ts` passou de regiões para **ilhas** e o tom do topo passou a vir do **terreno da casa**: a
  decisão "colina rende +25 %" precisa ser visível antes de construir. O litoral virou areia.
- `cena.ts`: o povoamento aleatório da Sessão 5 saiu; os objetos agora vêm do sim (obstáculos de pé,
  construções colocadas, peças do Núcleo, placas das ilhas fechadas). Entraram a marca coral de "sem
  escoamento" sobre a usina, a barra de tempo do obstáculo em remoção, o Bipe de manutenção ao lado dele
  e o realce de qualquer casa (não só da plataforma) com a pílula do motivo.
- `sprites.ts` ganhou pântano (juncos que balançam), montanha 2×2 (com neve), pico (com rajadas de vento)
  e subestação (pórtico com isoladores por nível e arco de energia).
- `fundo.ts` perdeu o Sol, o planeta e as órbitas do nível 0 — agora é céu, e o mar cobre tudo.

### D · Interface
- **Paleta de construção** no lugar da lista de compra, com o custo da próxima unidade e o efeito de cada
  prédio; duas ferramentas (Remover, Desmatar). No celular, escolher um prédio rola a página de volta
  para o tabuleiro (senão o jogador escolhe e some com a ilha).
- **Extrato** (componente compartilhado): receita e faixa, vendido × demanda, quanto está sem escoamento,
  tabela por tipo (quantos, quanto produz, quanto escoa) com as linhas em coral quando sobra energia, e
  as ilhas sem cabo. Aparece no painel e no popover da **nota de ₵** desenhada no HUD.
- **Escada crescente** por CSS (`column-reverse` no desktop, `row` no celular) com `--degrau-escala`
  crescendo 12 % por nível.
- **Tooltip das peças** do Núcleo: a frase com os números da peça selecionada aparece abaixo do seletor
  (no celular o `title` não serve).
- Cards novos: abertura reescrita em três telas (o número, o espaço, o escoamento), "As cinco peças" ao
  desbloquear a torre, "Uma ilha nova" na primeira expedição e "A subestação é a torneira" na primeira
  subestação.

### E · Verificação
- 279 testes no Vitest, incluindo `desempenho.test.ts`, que enche as 2048 casas e mede o tick.
- `scripts/e2e/sessao-6.cjs`: **52 verificações verdes** nos dois tamanhos (1280×800 e 390×844), com
  toque real no celular (`Input.dispatchTouchEvent` via `page.touchscreen.tap`). Capturas em
  `docs/capturas/sessao-6/` (10 por tamanho).

---

## Medições

Chromium do ambiente, renderização por software (`--use-angle=swiftshader`), 1280×800. Numa máquina com
GPU os números do quadro caem bastante; os do tick não dependem de GPU.

| O quê | Medida |
|---|---|
| Tick com 1 999 construções (as 2048 casas menos a plataforma) | **0,010 ms** (análise memoizada) |
| Análise completa do mundo cheio, **sem** cache (uma colocação a dispara) | **4,7 ms** |
| Geração do arquipélago (uma vez, no carregamento) | ~35 ms |
| Quadro com a ilha inicial (≈ 900 obstáculos) | **1,6 ms** (mar 0,0 · terreno 0,1 · cena 0,8) |
| Quadro com 2048 casas ocupadas, arquipélago inteiro na tela | **2,6 ms** (cena 1,6) |
| Quadro com 2048 casas, zoom 1,6 | **3,0 ms** (cena 2,0) |
| Ação de colocar um prédio com o mundo cheio | **0,4 ms** |

A métrica da análise do Reactor ("tick < 16 ms com as 2048 casas ocupadas") fica com folga de três ordens
de grandeza no caminho quente e de 3× no pior caso (a colocação, que recalcula tudo).

Duas otimizações saíram dessas medidas:
1. a chave do cache da análise não pode incluir a identidade de `rede` (o tick troca o objeto da bateria a
   cada 100 ms) nem usar `removidos.includes` (O(n) por vizinho consultado);
2. a cena era **recriada inteira** a cada colocação (chave de estrutura). Agora ela é montada uma vez e
   `atualizarCena` refaz só o grupo que mudou.

---

## Decisões fora do GDD (e os ajustes que fiz nele)

1. **A aldeia nasce com 1 bairro, não 3.** §8.5 dizia "aldeia (3 bairros d1)" e §8.1 dizia "demanda
   inicial 5 kW (aldeia)" — os dois não podem valer juntos, porque na v0.6 a demanda é a soma dos bairros
   e o menor bairro pede 8 kW. Com 3 bairros o jogo abre com 24 kW de demanda, ₵ 50 e 0 kW de oferta: são
   ~22 cata-ventos (≈ ₵ 2 mil) só para sair do apagão, com receita ×0,5 o caminho inteiro — uns 10 minutos
   de nada acontecendo. Com 1 bairro são 8 cata-ventos (≈ ₵ 205) até a zona de ouro. **Ajustei o GDD**
   (§8.1 e §8.5) para 1 bairro e registrei que a demanda não tem mais valor de base.
2. **Floresta e pântano são obstáculos, não chão.** O roteiro listava "terreno por casa (planície, colina,
   litoral, floresta, pântano, rocha, pico, montanha 2×2)", mas §2.4 também diz "floresta desmatada vira
   planície". A única forma coerente é: o chão é planície, colina, litoral ou rocha; floresta, pântano,
   arbusto, pedra, montanha e pico são obstáculos **em cima** do chão, e os dois primeiros nascem sempre
   sobre planície. **Ajustei o GDD** (§2.4).
3. **O mar cobre o palco inteiro e não há horizonte.** §10 pedia "horizonte com céu que escurece para o
   navy do HUD". Numa câmera isométrica de cima, uma linha de horizonte só poderia ser falsa — e a
   primeira versão, com o mar num losango finito, reproduzia exatamente o defeito que o playtest apontou
   (a ilha flutuando). O mar agora é infinito e o Sol aparece como **brilho na água**, no alto à esquerda,
   de onde vem a luz de todos os sprites. **Ajustei o GDD** (§10).
4. **O nível 0 chama-se "Arquipélago" só na interface.** O id interno continua `ilha` (a câmera, as
   escalas, o fundo e os presets falam dele); renomear seria churn sem ganho.
5. **Ilha aberta sem cabo vira uma mini-rede que sempre se equilibra:** ela entra na balança global apenas
   até a demanda dos próprios bairros, e o excedente é "sem escoamento". Assim §4.1 continua com uma única
   razão `r`, e "sem cabo, a ilha só alimenta bairros e subestações dela mesma" vale ao pé da letra.
6. **Um toque resolve o caso comum.** Com um prédio selecionado, tocar numa casa com obstáculo manda o
   Bipe desmatar (cobrando) em vez de recusar; "Remover" e "Desmatar" continuam explícitos na paleta. Sem
   isso, o celular exigiria dois toques em ferramentas diferentes para cada casa de floresta.
7. **🔬 continua requisito, não gasto** — inclusive na montanha (₵ 400 + 🔬 20 = "precisa de 🔬 20
   acumulado"). É o que o roteiro pediu ("🔬 continua como está"); quem gasta é a árvore da Sessão 7.
8. **A migração v5 → v6 dá subestações de cortesia.** Recolocar as unidades antigas sem escoamento deixaria
   o save migrado rendendo zero. Cada grupo colocado pela migração ganha uma subestação de graça — o
   jogador já tinha pago pelas usinas.

## Defeitos encontrados e corrigidos no caminho

- **Toque duplo pelo relógio errado.** A detecção de toque duplo usava o relógio da animação (que só anda
  quando um quadro é desenhado). Com o quadro lento, dois toques deliberados em casas vizinhas viravam um
  toque duplo e o segundo prédio não era colocado. Agora usa `performance.now()` com janela de 300 ms.
  Na v0.5 isso quase não aparecia (só a plataforma respondia ao toque); com tudo colocado, aparecia sempre.
- **Escolher na paleta rolava a página para longe do tabuleiro no celular.** A escolha agora traz o
  tabuleiro de volta (rolagem instantânea: com rolagem suave, um toque logo depois caía na casa errada).
- **"Sem escoamento" sumia no HUD compacto** (o celular esconde os rótulos do HUD). Virou um elemento
  próprio, sempre visível — é decisão de jogo, não enfeite.
- Os dois de desempenho descritos acima.

## O recurso que só sobe (GDD §7)

Ao fim da sessão, **🔬 é o único recurso que só acumula sem decisão**. Era o combinado (a árvore é a
Sessão 7), mas registro como o defeito que §7 manda registrar: enquanto ela não existir, a Pesquisa é um
limiar que passa e nunca mais é olhado. ₵ ganhou cinco sumidouros novos nesta sessão (colocar, desmatar,
expedição, cabo, nível de subestação) e potência ganhou o dela (o desperdício por falta de escoamento).

## Pendências (também em `ESTADO.md`)

1. **Cabo barato demais.** Canais de 2–3 casas ⇒ ₵ 230–270, contra ₵ 600 a ₵ 100 mil das expedições. Hoje
   o cabo é uma trava (lembrar de ligar), não uma decisão econômica. Proponho para a gestão: ₵ 40 → ₵ 200
   por casa de mar, **ou** canal mínimo de 4 casas na geração (muda o mapa), **ou** cabo com um teto de kW
   próprio (vira decisão contínua). Não apliquei porque muda ritmo, e o ritmo se mede na simulação de
   60 minutos da Sessão 7.
2. **Ritmo do início não medido.** O roteiro testa mecânica. A conta de padaria acima (8 cata-ventos até a
   zona de ouro) sugere que o começo está bom, mas quero a simulação antes de afirmar.
3. **Sem recompensa por desmatar.** §9 promete "dinamitar uma montanha e descobrir cristais"; hoje a
   montanha só custa. Sugiro a Sessão 7 amarrar isso ao 🔬 (a montanha devolve 🔬, ou abre uma casa de
   rocha com bônus).
4. Régua Kardashev: "Tipo II" e "Sol" seguem sobrepostos.
5. O minimapa não mostra quais ilhas já têm cabo.
6. Android real: pinch e inércia continuam verificados só com eventos sintéticos.

## O que a gestão deve verificar primeiro

1. **O mapa.** `docs/capturas/sessao-6/desktop-02-arquipelago.png` e o jogo rodando: as 8 ilhas com os
   tamanhos de §8.5, o canal de mar, a leitura do terreno (areia no litoral, verde claro nas colinas).
   Se a forma do arquipélago não agradar, é um ajuste de sementes/pesos em `content/era1-arquipelago.ts` —
   a geração é determinística e o teste garante os totais.
2. **A decisão de espaço.** Colocar um cata-vento numa colina e ao lado de outro, e ver o extrato mudar
   (`desktop-04-terreno-e-esteira.png`). É o coração da v0.6.
3. **O escoamento.** Colocar longe de subestação e ver a marca coral, o HUD e o extrato
   (`desktop-05-sem-escoamento.png`). É o sumidouro novo de §7.
4. **O ritmo inicial de verdade**, jogando 10 minutos do zero: é o único ponto que não consegui medir.
5. **O preço do cabo** (pendência 1) e o texto dos cards novos (abertura, cinco peças, ilha, subestação).

## Como rodar

```
npm run dev -- --host 127.0.0.1 --port 5173
NODE_PATH=/opt/node22/lib/node_modules node scripts/e2e/sessao-6.cjs
```

`npm run typecheck`, `npx vitest run`, `npm run lint`, `npm run build` e `npm run build:artifact` passam.
