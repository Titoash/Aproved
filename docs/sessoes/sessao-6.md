# Sessão 6 — Mundo: arquipélago, obstáculos, colocação manual, subestações

> Pressupõe a Sessão 5 concluída e o GDD v0.6 aplicado (`docs/correcoes-gdd-v0.6.md`). Produção no branch `claude/sessao-6` conforme `docs/PRODUCAO.md`. Antes de planejar, leia `docs/ESTADO.md`, o GDD (§2.1, §2.4, §7, §8.5, §10) e `docs/analises/reactor-e-volume1.md`.

## Objetivo
O tabuleiro deixa de ser uma ilha flutuando no espaço e vira um arquipélago no mar onde **tudo é colocado** e o **espaço é conquistado**: obstáculos para remover, ilhas para comprar, cabos e subestações para escoar. Nenhuma fórmula de calor muda. A cidade e a árvore de pesquisa ficam para a Sessão 7: nesta sessão os bairros ainda são "Vila" colocada (densidade 1) e 🔬 continua como está.

## Partes
- **A · Geração do arquipélago (sim puro).** `content/era1-arquipelago.ts` (ilhas de §8.5: casas, terreno dominante, expedição, obstáculos de nascença; obstáculos com custo/tempo; subestação; cabo). `sim/gerarArquipelago.ts`: grade 64×64, 8 ilhas com os tamanhos exatos (2048 no total), litoral, terreno por casa (planície, colina, litoral, floresta, pântano, rocha, pico, montanha 2×2), obstáculos de nascença determinísticos. Testes: totais exatos, ilhas conexas, plataforma 7×7 na principal, terreno válido.
- **B · Estado e ações (sim puro).** `GameState.mundo`: `construcoes: Record<indice, Construcao>` (tipo, nível, colocadoEmMs), `obstaculos` restantes com remoção em curso (fila com fim em ms), `ilhasAbertas`, `cabos`. Ações: `colocar`, `remover` (devolve 50 %), `removerObstaculo` (cobra e agenda), `comprarIlha`, `ligarCabo`. Contagens da Rede passam a ser **derivadas** das construções (as fórmulas de §4.1 não mudam). Produção por usina = base × terreno × esteira × sombra; venda só com subestação no alcance e dentro do teto (energia sem escoamento aparece no HUD como "sem escoamento"). Save v6 com migração v5 → v6: as unidades existentes são colocadas uma vez pela alocação antiga na ilha principal; excedentes viram crédito de ₵ (reembolso integral).
- **C · Cena.** Mar com ondulação, litoral, horizonte; 8 ilhas com penhasco; obstáculos como sprites (árvore, arbusto, pedra, pântano, montanha 2×2, pico); ilhas fechadas com véu e placa de expedição; cabos submarinos tracejados; subestações com raio de alcance visível ao selecionar; realce de colocação com o motivo em texto curto ("sem escoamento", "esteira −40 %", "sombra"); Bipe de manutenção andando até o obstáculo em remoção com barra de tempo. Câmera, escada, minimapa e escalas como na Sessão 5. A Torre e a Cascata como estão.
- **D · UI.** Paleta única de construção (usinas, vila, bateria, subestação, cabo, ferramentas Remover e Desmatar) no lugar da lista de compra; a lista vira o **extrato** (o que existe, quanto rende, quanto está sem escoamento). Escada de escalas **crescente da esquerda para a direita** no celular e de baixo para cima no desktop, com degraus que crescem de tamanho. HUD com a **nota de ₵** desenhada e o extrato ao tocar. Tooltips das peças do Núcleo com os números e card "As cinco peças" ao desbloquear a torre. Abertura reescrita em torno de espaço ("cada casa é uma decisão").
- **E · Verificação.** Testes do sim (geração, colocação, esteira, sombra, alcance e teto da subestação, remoção de obstáculos com tempo, expedição, cabo, migração v6, contagens derivadas). Roteiro Playwright nos dois tamanhos: colocar cata-vento em colina e ver +25 %; vizinho eólico tira 20 %; usina fora do alcance mostra "sem escoamento"; desmatar e ver o Bipe; comprar Ventania e ligar cabo; escada crescente; nota de ₵; tooltip da peça. Capturas em `docs/capturas/sessao-6/`; `ESTADO.md`; relatório em `docs/sessoes/sessao-6-relatorio.md`.

## Princípio que vale para tudo (GDD §7)
Nada acumula sem sumidouro. Nesta sessão: potência fora do alcance ou acima do teto das subestações é desperdiçada e aparece como "sem escoamento" no HUD e na usina; ₵ tem sumidouros novos (colocar, remover, desmatar, expedição, cabo, subestação, níveis de subestação). Se ao fim do roteiro sobrar um recurso que só sobe sem decisão, registre no relatório como defeito.

## Decisões já tomadas (não reabrir)
- Bateria continua global. Cascata continua como está. Escada e níveis como na Sessão 5.
- 8 ilhas com os tamanhos de §8.5; só a principal aberta no início, com ~45 % de obstáculos e uma subestação de nascença ao lado da aldeia.
- Custos de §7/§8.5 são iniciais: se um número não fechar no roteiro, registrar no relatório e propor.

## Checklist
- [ ] GDD v0.6 lido; `content/era1-arquipelago.ts` com todos os números
- [ ] `gerarArquipelago`: 2048 casas exatas em 8 ilhas conexas, terreno e obstáculos determinísticos
- [ ] estado `mundo`, ações de colocar/remover/obstáculo/ilha/cabo com testes; contagens derivadas
- [ ] produção por terreno, esteira e sombra; escoamento por subestação com teto
- [ ] save v6 e migração v5 → v6
- [ ] cena: mar, ilhas, obstáculos, cabos, alcance, realce com motivo, Bipe removendo
- [ ] paleta de construção, extrato, escada crescente, nota de ₵, tooltips e card das peças, abertura nova
- [ ] roteiro Playwright verde nos dois tamanhos; capturas; `ESTADO.md`; relatório
- [ ] `typecheck`, `test`, `lint`, `build` verdes; branch `claude/sessao-6` empurrado
