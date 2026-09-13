# Estado do projeto

Atualizado ao fim da **Sessão 7** (cidade com densidade, laboratórios e universidades, 🔬 gasto numa árvore de pesquisa, capítulos e balanceamento).

## Implementado

### Sessão 1 — Scaffold + Rede da Era 1
- Vite 8 + React 19 + TypeScript 6 (strict), Zustand 5, Phaser 3.90, Vitest 5, oxlint. Scripts `dev`, `build`, `test`, `typecheck`, `lint`.
- `src/sim/`: estado, tick de 100 ms (`sim/tempo.ts`), Rede (balança, bateria, receita), custos, ações, formatação PT-BR, save (único ponto com `localStorage`), loop.
- `src/content/era1.ts`: usinas, vila, bateria, economia e faixas de `r` (GDD §4.1, §7, §8.2).

### Sessão 2 — Núcleo da Era 1
- Torre Solar: `nucleo.ts`, `calor.ts`, `cascata.ts`, `estabilidade.ts`, tick em seis passos, desbloqueio por 🔬, `acoesNucleo.ts`, painel do Núcleo.

### Sessão 3 — Bateria, offline, Kardashev, melhorias, mobile
- Bateria como amortecedor (faixa efetiva), melhorias nomeadas (Lâminas, Rastreamento), offline puro, medidor Kardashev, input da grade pelo DOM, hi-DPI, página rolando no mobile.

### Sessão 4 — Era 1 bonita
- Grade 7×7 como melhoria, cards explicativos com os Bipes, direção de arte (tokens, rampa de calor, sombras chapadas, glow), HUD em faixa, barra de calor com a marca de `Q*`, mobile em uma coluna.

### Sessão 5 — Ilha-tabuleiro e escada de escalas (GDD v0.5)
- Ilha isométrica de 2048 casas com regiões, vagas e locais compráveis; escada de escalas ilha → multiverso; Kardashev I–V; `TabuleiroScene` em Canvas 2D com terreno, sprites, câmera (pan/zoom/pinch), minimapa e escalas.
- **Substituída pela Sessão 6:** vagas, alocação automática e regiões saíram; o terreno, os sprites, a câmera, o minimapa e as escalas continuam.

### Sessão 6 — Arquipélago, colocação e escoamento (GDD v0.6)
- **Conteúdo (`content/era1-arquipelago.ts`):** grade 64×64, semente 11, plataforma 7×7; as 8 ilhas de §8.5 com casas exatas (640/320/300/260/220/160/96/52 = 2048), terreno dominante, preço da expedição, densidade e quantidade de obstáculos de nascença; tabela de obstáculos (custo, 🔬, tempo, lado, permanente, alto); terrenos e seus fatores (colina +25 % vento, litoral +50 %, planície +15 % sol); vizinhança (esteira 20 %/piso 40 %, sombra 30 %/piso 40 %, pico +30 %); subestação (₵ 120 ×1,25ⁿ, alcance 3, teto 40 kW, nível ×3 custo e ×2 teto); cabo (₵ 150 + ₵ 40 por casa de mar). `content/escalas.ts` guarda a escada (o nível 0 agora se chama "Arquipélago").
- **Geração (`sim/gerarArquipelago.ts`):** crescimento determinístico por fila de prioridade a partir das 8 sementes, com canal de mar obrigatório de 2 casas entre ilhas e margem na borda; cada ilha para exatamente na cota. Terreno por casa (litoral na borda, colina por ruído, rocha nas ilhas de rocha), distância à borda e ao mar, caminhos da aldeia, obstáculos de nascença com clareira em volta da plataforma e da aldeia, montanhas 2×2, picos, e a rota de cabo de cada ilha até o litoral mais próximo da principal.
- **Mundo (`sim/mundo.ts`, `sim/producao.ts`):** `GameState.mundo` com `construcoes` (casa → tipo/nível/colocadoEmMs), `removidos`, fila de `remocoes`, `ilhasAbertas` e `cabos`. Ações puras: `colocar` (custo base × 1,25ⁿ, usinas ×1,15ⁿ), `remover` (devolve 50 %), `removerObstaculo` (cobra na hora e agenda; um Bipe de cada vez), `comprarIlha`, `ligarCabo`, `melhorarSubestacao`. `avaliarCasa` devolve o motivo da recusa e o aviso de rendimento ("sem escoamento", "esteira −20 %", "sombra −30 %", "subestação no teto").
- **Produção derivada:** produção = base × nível × melhorias × terreno × esteira × sombra × picos; escoamento por subestação (alcance 3 de Chebyshev, teto em kW, mesma ilha); bairro só pede energia com subestação no alcance; ilha sem cabo só alimenta os próprios bairros e o resto vira "sem escoamento". **As contagens da Rede passaram a ser derivadas** das construções (`derivarRede`), e as fórmulas de §4.1 não mudaram: `balancoRede` recebe `ofertaUsinasKw` e `demandaKw` prontos. Análise memoizada por identidade do mundo + níveis + melhorias.
- **Save v6** com migração v5 → v6: as contagens viram construções na ilha principal (mais subestações de cortesia para não nascer tudo sem escoamento) e o que não cabe volta em ₵.
- **Cena:** `scene/tabuleiro/mar.ts` (mar sem fim em dois azuis, brilho do Sol na água, água rasa em três faixas, espuma, cabos tracejados, alcance da subestação); terreno redesenhado por **ilha** com tom por **terreno da casa** (planície, colina, litoral com areia, rocha) e véu/hachura nas ilhas fechadas; obstáculos como sprites vindos do sim (árvore, arbusto, pedra, pântano, montanha 2×2 com neve, pico com rajadas); subestação com pórtico e arco; realce da casa sob o ponteiro com o motivo em pílula; marca coral de "sem escoamento" sobre a usina; barra de tempo e Bipe de manutenção na remoção. A cena é montada uma vez e só o grupo que muda é refeito.
- **UI:** paleta de construção (usinas, vila, subestação, bateria + ferramentas Remover e Desmatar) no lugar da lista; **extrato** (receita, vendido, sem escoamento, tabela por tipo, ilhas sem cabo) no painel e no popover da **nota de ₵** desenhada no HUD; lista de ilhas com expedição e cabo; escada **crescente** (baixo → cima no desktop, esquerda → direita no celular) com degraus que crescem; tooltip com os números da peça do Núcleo selecionada; cards novos (abertura em torno de espaço, "As cinco peças" ao desbloquear a torre, "Uma ilha nova" na primeira expedição, "A subestação é a torneira").
- **Testes (`npm test`, 279):** geração (2048 casas exatas, ilhas conexas e separadas por mar, plataforma na principal, terreno válido, ~45 % de obstáculos na principal, montanhas 2×2, picos, rotas de cabo, determinismo); mundo (custos, remoção com devolução, recusas, níveis de subestação, fila de remoção com tempo, montanha com 🔬, pico permanente, expedição, cabo); produção (terreno, esteira com piso, sombra com piso, pico, alcance 3, teto, bairro sem subestação, ilha sem cabo, contagens derivadas, memoização); save v6 (ida e volta, saneamento, migração v5 com reembolso); desempenho (tick < 16 ms com as 2048 casas ocupadas).
- **Verificação no navegador:** `scripts/e2e/sessao-6.cjs` (52 verificações verdes nos dois tamanhos) e capturas em `docs/capturas/sessao-6/`.

### Sessão 7 — Cidade, árvore de pesquisa, capítulos (GDD v0.6)
- **Ajustes da Sessão 6 aplicados primeiro:** cabo submarino com **teto próprio** (30 kW, nível custo ×3ⁿ e teto ×2ⁿ) e ₵ 120 por casa de mar; **montanha dinamitada devolve 🔬 40 e deixa quatro casas de rocha com cristal** (laboratório e universidade sobre cristal rendem +50 %); régua Kardashev com o Sol sem rótulo; minimapa com traço nas ilhas já ligadas por cabo.
- **Cidade (`content/cidade-era1.ts`, `sim/cidade.ts`):** o tipo `vila` virou `bairro` com **densidade 1–4** no `nivel` (Aldeia 8 kW/100 hab/×1 → Metrópole 110 kW/6 400 hab/×1,5). `evoluirBairro` gasta ₵ + 🔬 numa curva quase exponencial (₵ ×2,5 e 🔬 ×5 por degrau). A **tarifa média ponderada pela demanda** entra na receita sem mexer na fórmula de `r` (§4.1).
- **Ciência:** laboratório (₵ 60 ×1,25ⁿ, 🔬 0,2/s, 2 kW) e universidade (₵ 400 ×1,5ⁿ, 🔬 0,5/s × √(pop ÷ 1 000), 5 kW, 1 por 2 000 habitantes) são construções que **consomem kW** e só funcionam com subestação no alcance. A população só cresce evoluindo bairro.
- **🔬 virou moeda (`content/arvore-era1.ts`, `sim/arvore.ts`, `sim/efeitos.ts`):** 25 nós em cinco ramos, cada um com custo em 🔬 (e ₵ onde §8.3 pedia), pré-requisitos, **escolha exclusiva** (eixo vertical × horizontal) e uma **frase de física de verdade**. As três melhorias nomeadas e os desbloqueios de usina viraram nós; `state.melhorias` saiu e entrou `state.pesquisados`. Os efeitos são dobrados numa estrutura só, lida por `producao`, `nucleo`, `rede` e `tick`.
- **Capítulos (`content/capitulos-era1.ts`, `sim/capitulos.ts`):** 17 objetivos curtos com recompensa em ₵ ou 🔬, medidos e pagos no tick, com um ativo por vez no HUD.
- **Interface:** tela da árvore (uma coluna por tecnologia), painel da Cidade (densidade, população, demanda, Evoluir), HUD com 🔬 gastável (e o próximo nó à vista), 👥 população e a faixa do capítulo; sprites de laboratório e universidade, e o bairro que cresce com a densidade; cards novos (laboratório, árvore, evolução, universidade, cristal).
- **Save v7** com migração v6 → v7: cabos viram ilha → nível, `vila` vira `bairro`, 🔬 acumulado vira saldo e o que já estava desbloqueado continua desbloqueado **sem cobrar**.
- **Balanceamento (`scripts/simular.ts`, `npm run simular`):** um bot joga 60 minutos com o tick do sim seguindo os capítulos. A partir dele: a árvore ficou 8–10× mais cara no topo (acabava aos 15 min), as expedições ×3 (o arquipélago inteiro abria aos 30 min), entrou o nó **Fissão básica** (🔬 3 000 + ₵ 50 000) como saída da Era 1, e a fila de capítulos deixou de travar.
- **Testes (`npm test`, 299)** e roteiros Playwright: `scripts/e2e/sessao-6.cjs` (52 verificações) e `scripts/e2e/sessao-7.cjs` (76 verificações), nos dois tamanhos, com capturas em `docs/capturas/sessao-7/`.

## Próxima sessão
`docs/sessoes/sessao-8.md` (a escrever) — Era 2 (fissão: esgotamento e calor de decaimento) e transição de era, com o nó "Fissão básica" já no lugar.

## Decisões da Sessão 7 que a gestão precisa confirmar
1. **O branch saiu de `faab8c3`, não de `claude/era1-scaffold-rede-pqkglz`:** essa ref é ancestral da Sessão 6 e sair dela jogaria fora nove commits.
2. **`vila` virou `bairro`.** "Vila" passou a ser o nome da densidade 2 (§8.6); manter o tipo com o nome de uma densidade confundiria tudo. A migração cuida dos saves.
3. **Laboratório e universidade precisam de subestação**, como bairro e usina: energia não anda sem fio. Também consomem kW e por isso entram na demanda.
4. **Laboratórios e universidades rendem 🔬 offline** com o mesmo fator da Rede (×0,5). O GDD não dizia.
5. **O nó "Fissão básica"** (🔬 3 000 + ₵ 50 000) é a leitura de §8.4 com 🔬 virando moeda. A Era 2 continua sendo a Sessão 8.
6. **Os capítulos não são uma fila travável:** qualquer objetivo já cumprido é pago, mesmo fora de ordem. A interface continua mostrando um por vez.

## Pendências
Decisões da gestão sobre estas pendências: `docs/sessoes/sessao-7-ajustes.md` (a Sessão 8 aplica antes da parte A).

- **A Era 1 fecha em ≈ 41 min com jogo perfeito, não em 50–70.** O piso é a Estabilidade (+2,5 pontos/min na zona de ouro = 40 min), e §7 é fórmula que esta sessão não podia mexer. Proposta: ouro 2,5 → ~1,8/min (fecharia em ~55 min). O GDD ganhou a medição em §8.4.
- **A subestação some como decisão no fim da era:** com alcance 5 (nó) e teto ×2 por nível a ₵ ×3, uma subestação só cobre a ilha inteira. O bot termina 60 minutos com **uma**. Sugestão: limitar o nível, ou o alcance 5 não valer para subestação já melhorada.
- **A universidade escala rápido demais com a população**: √(pop ÷ 1 000) com uma metrópole (6 400 hab) já dá ×2,5 por universidade. Com três, 🔬 3 000 sai em minutos.
- **O bairro na cena não tem painel próprio de toque**: seleciona a linha no painel da Cidade, que no celular fica abaixo do tabuleiro.
- Régua Kardashev, `OffscreenCanvas`, Android real e o cristal sem arte própria na régua do minimapa continuam como na Sessão 6.
- Remover um obstáculo comum (árvore, pedra, pântano) continua sem devolver nada — só a montanha devolve 🔬.
