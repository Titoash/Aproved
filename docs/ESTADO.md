# Estado do projeto

Atualizado ao fim da **Sessão 6** (arquipélago no mar, colocação casa a casa, obstáculos, subestações e cabos).

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

## Próxima sessão
`docs/sessoes/sessao-7.md` — cidade em bairros com densidade e evolução, laboratório e universidades, 🔬 gasto numa árvore com cards de física, capítulos. Era 2 vai para a Sessão 8.

## Decisões da Sessão 6 que o GDD fixa por mim (conferir)
1. A aldeia de nascença é **1 bairro** (8 kW), não 3: com 3 o jogo abriria com 24 kW de demanda, ₵ 50 e 0 kW — uns 10 minutos de apagão antes do primeiro respiro. §8.1 e §8.5 foram ajustados.
2. Floresta, pântano, pedra, arbusto, montanha e pico são **obstáculos sobre o chão**, não tipos de chão; floresta e pântano nascem sobre planície, então desmatar devolve planície (GDD §2.4 ajustado).
3. O nível 0 da escada mostra "Arquipélago" na interface; o id interno continua `ilha` (menos churn em câmera, escalas e fundo).
4. O mar cobre o palco inteiro (nada de ilha flutuando) e o Sol vira **brilho na água**: numa câmera de cima não há linha de horizonte (GDD §10 ajustado).
5. Ilha aberta **sem cabo** forma uma mini-rede que sempre se equilibra: entra na balança global só até a demanda dos próprios bairros; o resto é "sem escoamento".
6. 🔬 continua sendo **requisito acumulado**, não gasto (inclusive na montanha): quem gasta é a árvore da Sessão 7.

## Pendências
- **🔬 só sobe.** Com a árvore ainda na Sessão 7, a Pesquisa é o único recurso sem sumidouro — é o defeito que o §7 manda registrar. A Sessão 7 resolve.
- **Cabo barato.** Os canais entre ilhas têm 2–3 casas, então o cabo sai por ₵ 230–270 contra ₵ 600–100 mil da expedição: hoje é uma trava, não um custo. Recalibrar (₵ por casa maior, ou canais mais largos) na simulação de 60 min.
- **Ritmo do início não medido.** A simulação de 60 minutos de jogo ativo (GDD §7) fica para a Sessão 7; o roteiro desta sessão testa mecânica, não ritmo.
- Régua Kardashev: "Tipo II" e "Sol" ainda se sobrepõem (marcos a 0,4 década numa escala de 47).
- `OffscreenCanvas` continua sendo requisito (Safari ≥ 16.4).
- Teste manual em Android real: pinch e inércia seguem verificados só com eventos sintéticos.
- O minimapa mostra as ilhas fechadas em navy; falta um lembrete visual de qual delas já tem cabo.
- Remover um obstáculo não devolve nada e não dá recurso: dinamitar montanha "descobre cristais" no GDD §9 e isso ainda não existe.
