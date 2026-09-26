# Estado do projeto

Atualizado ao fim da **Sessão 9** (melhorias por tipo com a ciência com nível, cidade que evolui inteira, Núcleo com nível por peça, remoção com N Bipes e em área, HUD limpo, "ver acontecendo"; GDD v0.8/v0.9). As Eras 1–2 continuam jogáveis de ponta a ponta.

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
- Ilha isométrica de 2048 casas, escada ilha → multiverso, Kardashev I–V, `TabuleiroScene` em Canvas 2D com terreno, sprites, câmera, minimapa e escalas. **Substituída pela Sessão 6** no que toca a vagas e regiões.

### Sessão 6 — Arquipélago, colocação e escoamento (GDD v0.6)
- Grade 64×64 com as 8 ilhas de §8.5 (2048 casas exatas), obstáculos, terrenos, vizinhança, subestação, cabo submarino; `sim/gerarArquipelago.ts` determinístico; `sim/mundo.ts` e `sim/producao.ts` com colocação, remoção, expedição, cabo e escoamento; save v6; cena do mar, terreno por ilha, sprites dos obstáculos; paleta de construção, extrato, lista de ilhas, escada crescente.

### Sessão 7 — Cidade, árvore de pesquisa, capítulos (GDD v0.6)
- Bairros com densidade 1–4 e evolução por ₵ + 🔬; laboratório e universidade como construções que consomem kW; 🔬 virou moeda numa árvore de 25 nós com frases de física; 17 capítulos; save v7; simulação de 60 min (`npm run simular`) que recalibrou a árvore e as expedições.

### Sessão 8 — Era 2: fissão, transição de era e a Rede em MW (GDD Parte 2)
- **Ajustes da Sessão 7 aplicados primeiro:** subestação com **nível máximo 3** (teto 40 → 320 kW); universidade rendendo **por alunos** (`🔬 0,5/s × √(pop ÷ universidades ativas ÷ 1 000)`); **callout de toque** na cena para a construção selecionada (densidade, demanda e "Evoluir"); **linhas de ligação** na árvore de pesquisa; roteiros antigos aceitam `CAPTURAS=` para gravar fora do repositório.
- **Transição de era (`sim/era.ts`):** `state.era` e `nucleo.era`; `construirReator` exige Estabilidade 100 % + o nó "Fissão básica" + ₵ 200 000, desmonta a Torre devolvendo 50 % de cada peça, planta o Vaso numa grade 5×5, **zera a Estabilidade** e guarda tudo o mais (ilhas, cabos, subestações, usinas, bairros, ₵, 🔬 e os nós da Era 1). Não há volta.
- **Motor de calor unificado (`sim/motor.ts`):** `T = Q ÷ capacidade`, as faixas, a Cascata e a Estabilidade **não mudam de era**. O módulo é o único lugar que sabe qual era está em jogo; a Era 1 continua com espelhos, radiadores e turbinas a vapor, e a Era 2 entra com varetas, torres e turbinas de alta pressão.
- **Reator PWR (`sim/reator.ts`, `content/era2-nucleo.ts`):** Vaso de 500 u; vareta com 600 s de combustível injetando 20/10/5 u/s por anel; **calor de decaimento** (7 % do nominal, meia-vida 60 s); barra de controle sobre as **8 vizinhas** (−50 % de calor, vida ×2, sem somar); piscina (+250 u, absorve o decaimento das vizinhas e libera a troca imediata); torre de resfriamento (30 u/s); troca por ₵ 8 000 depois de 3 meias-vidas; **SCRAM de 60 + 30 s** com as varetas decaindo no Vaso; Cascata com **entulho quente** e `Q` preservado; varetas esgotando offline.
- **Rede da Era 2 (`content/era2.ts`):** construções **2×2** (âncora no canto noroeste, quatro casas, esteira e sombra por qualquer uma delas); **mar raso colocável**, com cada casa de água pertencendo à ilha cujo litoral está mais perto; eólica offshore (400 kW), fazenda solar (300 kW, 2×2, não em colina), térmica a gás (2 000 kW, 2×2, **₵ 300/s de combustível**, desliga sem escoamento); subestação de 138 kV (5 000 kW, alcance 4), subestação offshore, bateria de rede (2 000 kWh, ±1 000 kW) e o nó Cabo HVDC (teto ×10). **Nenhuma fórmula de `r`, de bateria ou de escoamento mudou**: o que entrou foi um custo de operação, que a receita líquida desconta.
- **Cidade da Era 2:** densidades 5 (Megacidade) e 6 (Arcologia), travadas por nó; distrito industrial (3 000 kW, tarifa ×2,2, exige 138 kV no alcance) e instituto de pesquisa (🔬 3/s, 50 kW, +50 % sobre cristal).
- **Árvore e capítulos da Era 2:** `content/arvore-era2.ts` com 23 nós em cinco ramos (≈ 🔬 193 mil), cada um com uma frase de física conferida, a escolha exclusiva Água pesada × Alta temperatura e **Fusão básica** como saída — que mostra o aviso de que a Era 3 está em produção; `content/capitulos-era2.ts` com os 12 capítulos de §7. A árvore da Era 1 continua valendo.
- **Interface e cena:** botão "Construir o Reator"; card "Calor de decaimento" em 3 telas; câmera que afasta 3 s e volta; paleta **entardecer** (mar, céu e tokens); Vaso com cúpula e torres hiperbólicas; vareta com o gradiente que apaga de cima para baixo e o brilho residual da gasta; halo da barra de controle; piscina; **callout da peça** com combustível, decaimento e "Trocar" (com o motivo e o tempo que falta); paleta com as construções da Era 2, **prévia 2×2** e mar raso realçado quando a peça é offshore; extrato com **combustível** e **receita líquida**; aba por era na árvore.
- **Save v8** com migração v7 → v8: saves da Era 1 continuam jogáveis (`era: 1`), e o Núcleo ganha `era`, `scramInicioMs` e `trocasEmFaixa`.
- **Testes (`npm test`, 343)** com a tabela de §5.3 inteira e o teste obrigatório da sessão; **`scripts/e2e/sessao-8.cjs`** com 82 verificações nos dois tamanhos, e os roteiros das Sessões 6 (52) e 7 (76) verdes como regressão; capturas em `docs/capturas/sessao-8/`.
- **Balanceamento (`npm run simular`):** o bot atravessa a Era 1, constrói o Reator aos 44 min e joga a Era 2. **A Era 2 fecha em 60,9 min** (alvo 50–70) e a receita líquida **nunca fica negativa**.

### Sessão 9 — Melhorias por tipo, cidade inteira, remoção em área, HUD limpo e cena viva (GDD v0.8/v0.9)
- **Parte 0 (ajustes da Sessão 8 e defeitos da v0.9):** callout da subestação offshore com a ilha dela; rotas "corrida" e "cidade" na simulação; Arcologia exige só a Megacidade; `loop.ts` sem nome de navegador e teste de pureza do sim; **offline do reator integrado por trechos** enquanto as varetas esgotam (8 h fora não rendem mais 48× a 🔬 de 10 min); Estabilidade da Era 2 só com fissão.
- **Melhorias por tipo (`sim/melhorias.ts`, `sim/niveis.ts`, `content/melhorias.ts`):** usinas (+50 %, máx. 5), peças do Núcleo nas duas eras (+10 %, máx. 5), subestações e cabos (teto ×2), **ciência com nível** (+25 % de 🔬, máx. 5) e Equipe de manutenção (+1 Bipe, máx. 4). Unidade nova de subestação ou ciência **paga o acumulado do nível** (revisão da v0.9). Save **v9** com migração v8 → v9.
- **Cidade inteira:** `state.cidade.densidade`; evoluir custa ₵ e 🔬 × N bairros; bairro novo nasce na densidade da cidade e paga o acumulado (tanto faz evoluir antes ou depois de construir).
- **Núcleo:** "Nv n" desenhado na peça e botão de nível no seletor; **"Trocar todas as gastas"** na Era 2.
- **Remoção:** tempos pela metade, **N Bipes em paralelo** (2 de nascença), nós Máquinas pesadas e Escavadeiras (÷2 cada), **seleção em área** (arrastar com Desmatar ou Shift no desktop; toque longo no celular) com confirmação de custo e tempo; a fila anda offline; a montanha **gasta** 🔬 20.
- **HUD limpo:** quatro números (₵ líquido, ⚡ como r, 🔥 com a Estabilidade em anel, 🔬); 👥 no painel da Cidade e no callout do bairro, 🛡 no painel do Núcleo; capítulo numa linha (e não cobre mais o tabuleiro no desktop); **nível na carta da paleta** (a lista "Níveis" saiu).
- **Ver acontecendo:** fios da subestação a cada consumidor com pulsos na cor da faixa de r; pulsos nos cabos no sentido do fluxo; "+₵" e "+🔬" (pool de 12); janelas acesas pelo atendimento, piscando no apagão; Bipes andando até o obstáculo; fumaça só com a térmica ligada; brilho do Núcleo ∝ T; **diário** de três linhas no rodapé do tabuleiro. Custo por quadro com o mundo cheio e 6 Bipes: **no máximo +0,7 ms** (teto do GDD: +3 ms), medido com `scripts/e2e/perf-cena.cjs`.
- **GDD v0.9 revisado** (32 achados da revisão adversarial aplicados) e **🔬 da megacidade e da arcologia recalibradas** (1 000 e 3 000 por bairro; com a cidade inteira a arcologia custava 🔬 450–750 mil).
- **Balanceamento (`npm run simular`):** cada rota joga as duas eras; o bot compra níveis. Era 1: 41,5 / 42,3 min (piso da 🛡); Era 2 corrida **48,1 min**, cidade **68,3 min** (arcologia aos 67,3). Sem a ciência com nível: Era 2 corrida 51,7 e a cidade não fecha. Minutos parados até o fechamento: 15 de 91 (corrida) e 30 de 112 (cidade), contra ≈ 36 de ≈ 105 na medida da v0.9.
- **Testes:** 502 no Vitest; `scripts/e2e/sessao-9.cjs` nos dois tamanhos; roteiros 6, 7 e 8 atualizados às APIs novas; capturas em `docs/capturas/sessao-9/`. Relatório: `docs/sessoes/sessao-9-relatorio.md`.

## Próxima sessão
`docs/sessoes/sessao-10.md` — **Ocorrências**, o sub-jogo opcional de operação do Núcleo, e a Estabilidade em 1,8/1,2 (GDD v0.9, revisado; `docs/correcoes-gdd-v0.9.md`). Antes da parte A, `docs/sessoes/sessao-9-ajustes.md` (a gestão escreve ao revisar a Sessão 9). A Era 3 é a Sessão 11.

## Decisões da Sessão 9 que a gestão precisa confirmar
Estão detalhadas em `docs/sessoes/sessao-9-relatorio.md`. Em resumo:
1. **Unidade nova de subestação ou ciência paga o acumulado do nível do tipo** (Parte 1 §7.1), como o bairro novo: sem isso, subir o nível com uma unidade e construir depois dividia o custo por N.
2. **🔬 da megacidade e da arcologia: 1 000 e 3 000 por bairro** (eram 3 000 e 15 000; Parte 2 §4.1). O ₵ ficou.
3. **A fila de remoção anda offline** (é trabalho já pago) e **a montanha gasta os 🔬 20** (o código só exigia o saldo).
4. **Seleção em área no desktop só com Desmatar ou Shift**; com as outras ferramentas arrastar continua movendo a câmera. Área **tudo ou nada**.
5. **Janelas: piscam no apagão (r < 0,8) e apagam abaixo de metade atendida** (§10.1 dizia r < 0,5, mas o apagão começa em 0,8).
6. **A Era 2 corrida fecha em 48,1 min** (abaixo de 50) porque agora o piso é a Estabilidade, não a 🔬; a Sessão 10 sobe o piso para ≈ 56 com 1,8/1,2.

## Decisões da Sessão 8 que a gestão precisa confirmar
Estão detalhadas em `docs/sessoes/sessao-8-relatorio.md`. Em resumo:
1. **A peça fixa do centro continua sendo `{ tipo: "receptor" }` no estado**, com a era decidindo se é Receptor ou Vaso. Evitou reescrever save, cena e Cascata por um nome.
2. **A repartição por anel da tabela de §5.3 estava errada** (com 20 u/s no anel 1, "5 + 2" daria 120 u/s, não 110). A coluna "Entrada" é o contrato e não mudou; a repartição virou (4 + 2), (4 + 3), (4 + 4). Registrado na Parte 2.
3. **A troca de vareta espera 3 meias-vidas cheias (180 s)**, não o cruzamento exato de 1 % (168 s), porque 180 s é o número do teste obrigatório de §5.3.
4. **A curva de ₵ da densidade 5 é ×62,5**, não o "×10 fixo" do texto de §4.1 — os números da tabela são o contrato e continuam como estavam.
5. **Quem paga a árvore da Era 2 é a cidade**, não o reator: ele rende 🔬 10,4/s (37 mil por hora) contra os 🔬 193 mil da árvore. Registrado na Parte 2.
6. **O decaimento de uma vareta em SCRAM vai para o Vaso**, e só o da vareta **gasta** vai para a piscina vizinha — é o que mantém a torre de resfriamento sendo a resposta ao SCRAM, como §5.2 escreve.

## Pendências
Decisões da gestão sobre estas pendências: `docs/sessoes/sessao-8-ajustes.md` (a Sessão 9 aplica antes da parte A).

### Da Sessão 9
- **Cortes da Sessão 9:** nenhum da ordem de corte (fumaça, "+🔬" e Escavadeiras entraram).
- **A rota cidade da simulação é sensível ao bot:** a Era 2 fechou entre 45,7 e 70,5 min em rodadas com pequenas mudanças de decisão. No começo da Era 2 ela fica parada juntando ₵ e 🔬 para evoluir a cidade inteira à megacidade; só o playtest humano diz se essa espera é boa (é uma decisão grande) ou ruim.
- **Rolagem de 9 px no painel do Núcleo no desktop de 800 px de altura:** com o capítulo numa linha própria, o painel abaixo do tabuleiro fica com ≈ 160 px e rola; o título "Núcleo · Torre Solar" pode aparecer cortado. Existia antes (escondido pela sobreposição do capítulo).
- **Os "+₵" só nascem no que está na tela** e o pool é de 12: com a ilha inteira no quadro (preset "ilha", modo mapa) quase não aparecem. É o orçamento do GDD; dá para rever se a gestão quiser mais.
- **Rolagem automática na borda durante a seleção em área** não entrou (o retângulo para em 8×8 casas, que cabem na tela no zoom de jogo).
- **Equipe de manutenção** só é comprada pelo bot na rota cidade (Nv 1 aos 34 min); na corrida o espaço não chega a travar.
- **O pool de "+₵" e o diário não vão para o save** (estado de interface), por desenho.

### Da Sessão 8
- **O callout da subestação offshore** diz a ilha dela desde a Sessão 9 (resolvido).
- **O distrito industrial, o instituto, a arcologia e a escolha exclusiva** aparecem no jogo do bot desde a Sessão 9 (resolvido na medida).
- Régua Kardashev, `OffscreenCanvas`, Android real e o cristal sem arte própria na régua do minimapa continuam como na Sessão 6.
- Remover um obstáculo comum (árvore, pedra, pântano) continua sem devolver nada — por desenho (ajuste 4 da Sessão 7).

### Registradas na v0.9 (gestão)
- **"15 minutos por dia" como tema do jogo: em stand by** por decisão do autor. O levantamento parcial e onde retomar estão em `docs/analises/15-minutos-por-dia.md`.
- ~~Offline do reator rende a janela inteira~~ — resolvido na parte 0 da Sessão 9 (integração por trechos).
- **Aba em segundo plano perde o tempo:** o loop acumula no máximo 5 s e voltar à aba não aplica o offline; a mesma ausência vale ≈ 0 com a aba viva e até 8 h se o navegador descartou a aba. O GDD só manda aplicar o offline "no load" (Parte 1 §11); §7 define a janela e diz "ao voltar", sem tratar a aba que volta do segundo plano. Decisão pendente da gestão.
- **O offline enche a Estabilidade e o caixa:** 8 h fora dão 840 pontos de Estabilidade (a barra inteira) e ≈ ₵ 16,9 milhões com a receita do fim da Era 1. O ritmo de 60 min por era só vale para quem joga sem fechar, e a simulação nunca simula ausência. Não bloqueia as Sessões 9 e 10; é o primeiro ponto se a ideia dos 15 minutos voltar.
