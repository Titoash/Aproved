# Estado do projeto

Atualizado ao fim da **Sessão 8** (Era 2: reator PWR com combustível finito e calor de decaimento, transição de era, Rede em MW, cidade 5–6, árvore e capítulos da Era 2). **O MVP fechou: Eras 1–2 jogáveis de ponta a ponta.**

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

## Próxima sessão
`docs/sessoes/sessao-9.md` — melhorias por tipo em dois degraus, cidade que evolui inteira, Núcleo com nível por peça, remoção rápida e em área, HUD limpo e "ver acontecendo" (GDD v0.8, `docs/correcoes-gdd-v0.8.md`). A Era 3 passa para a Sessão 10.

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

- **Cortes assumidos da Era 2:** nenhum. Instituto, bateria de rede, rede inteligente, selo verde e distrito industrial (a ordem de corte da especificação) entraram todos.
- **O distrito industrial e o instituto não aparecem no jogo do bot** dentro dos 75 minutos simulados: ele prioriza a saída da era. Os dois estão testados no Vitest e no roteiro Playwright, mas nunca foram vistos num playtest de ritmo.
- **A Era 2 fecha em 60,9 min com o bot jogando para fechar.** Um jogador que evolua a cidade até o fim chega a 47 MW instalados mas demora mais: as duas rotas cabem na janela, e só o playtest humano diz qual é a natural.
- **A arcologia (densidade 6) nunca foi alcançada na simulação** — o nó custa 🔬 14 000 e vem depois do instituto. Vale conferir se ela não ficou cara demais para o tempo da era.
- **A escolha exclusiva Água pesada × Alta temperatura não foi exercitada pelo bot** (ela vem depois do Reator 7×7, já na reta final). Está testada como regra, não como decisão de ritmo.
- **O bairro na cena tem callout de toque; a peça do Núcleo também.** O que falta é o callout da **subestação offshore no mar** — ela é selecionável, mas o texto do callout não diz a qual ilha ela pertence.
- Régua Kardashev, `OffscreenCanvas`, Android real e o cristal sem arte própria na régua do minimapa continuam como na Sessão 6.
- Remover um obstáculo comum (árvore, pedra, pântano) continua sem devolver nada — por desenho (ajuste 4 da Sessão 7).
