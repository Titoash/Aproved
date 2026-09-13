# Análise: Reactor 1, Reactor 2 e o "Volume 1" comparados com o KARDASHEV

Fontes: descrições oficiais nas lojas, guias (Level Winner, MustGames, Droid Gamers), wiki do Reactor Idle e o documento `Game Design Document – Volume 1: Sistema e Gestão de Energia` enviado pelo autor. Vídeos não foram assistidos: só texto.

## 1. Como o Reactor 1 funciona (Reactor – Energy Sector Tycoon / Reactor Idle)
- **Tudo é colocado casa a casa** num terreno limitado que se expande (mais de dez mapas/zonas).
- **Cata-vento** produz eletricidade direto. Todo o resto produz **calor**: células solares, carvão, células nucleares, tório etc.
- **Calor só vira eletricidade num gerador encostado** (quatro lados, diagonal não conta). Um produtor alimenta até quatro geradores; a saída se reparte entre eles.
- **Gerador estoura** se receber mais calor do que a capacidade. Trocadores e dissipadores levam calor para longe.
- **Escritório vende**: sem escritório a energia não vira dinheiro; cada escritório tem um teto de venda e há tiers (Home, Medium, Large ×24).
- **Pesquisa** vem de **laboratórios** ocupando casas ("encher uma zona de labs").
- Progressão por **desbloqueios comprados com pesquisa** e por **mapas** novos. Offline rende.
- O que os jogadores reclamam: platôs de espera e o equilíbrio calor × geradores no pico.

## 2. O que o Reactor 2 acrescenta (Idle Nuclear Tycoon, 2026)
- **Cidade viva com distritos**: a demanda cresce com a produção; cada expansão é um novo problema de layout.
- **Ilhas**: expandir por ilhas diferentes, "restaurar a rede" de cada uma e adaptar o layout ao espaço disponível.
- **Capítulos e missões** com recompensas: objetivos claros do primeiro cata-vento até as tecnologias finais.
- **Sem punição**: reator superaquecido **pausa e esfria** em vez de explodir; o jogo convida a experimentar.
- Árvore: vento, solar, hidro, marés → carvão, gás, nuclear → fusão, antimatéria, arco, buraco negro.
- Reclamação recorrente: progressão um pouco lenta, "paredes" onde se espera.

## 3. O "Volume 1" enviado pelo autor
Descreve o mesmo núcleo do Reactor: estruturas primárias alocam calor nas células adjacentes; geradores absorvem e **falham na hora** se o calor de um tick passar da capacidade; a eletricidade fica num estoque global e é escoada por **escritórios** com teto de venda; custo de melhoria exponencial (base × 1,15ⁿ) com benefício linear, de propósito, para forçar demolição e redesenho em vez de upgrade infinito. Traz também um plano de tarefas (motor térmico por eventos, shader de alerta, escoamento com cap).

## 4. Comparação

| Dimensão | Reactor 2 | KARDASHEV hoje (v0.5) | KARDASHEV v0.6 (decisão) |
|---|---|---|---|
| Onde as coisas ficam | tudo colocado na grade | Núcleo colocado; Rede é lista com alocação automática em vagas | **tudo colocado**, no arquipélago |
| Espaço | terreno limitado, ilhas para expandir | ilha única de 2048 casas, locais compráveis, sem obstáculos | **arquipélago no mar**: 8 ilhas, expedição + cabo submarino, obstáculos para remover |
| Calor | produtores → geradores encostados; pausa se superaquecer | Torre Solar: espelhos → Receptor (Q) → turbinas; **Cascata** após 5 s acima de 100 % | mantido: a Cascata é identidade (ensina em vez de punir, com card); sem "pausa silenciosa" |
| Venda | escritórios com teto | vendida até a demanda (balança r) | **subestação** com alcance 3 e teto de kW; sem subestação não vende |
| Cidade | distritos crescem com a produção | "Vila ×n" só cresce | **bairros colocados com densidade 1–4**, evolução por ₵ + 🔬 quase exponencial; população libera **universidades** |
| Pesquisa | labs ocupando casas; gasta em desbloqueios | só o Núcleo; 🔬 é limiar, nunca gasto | Núcleo + **laboratório** + **universidades**; 🔬 **gasto** numa árvore com cards de física |
| Melhorias | custo exponencial, benefício linear | nível ×3ⁿ, +50 % linear; 3 melhorias nomeadas | árvore de 5–6 nós por tecnologia, pré-requisitos, escolhas exclusivas, explicação física em cada nó |
| Objetivos | capítulos e missões | cards explicativos | capítulos por era (fila de objetivos curtos) — Sessão 7 |
| Escala | mapas | escada ilha → multiverso (Kardashev) | mantida; ordem crescente da esquerda para a direita |

## 5. O que fica do Volume 1 e o que muda
- **Fica:** escoamento com teto físico (subestações), custo exponencial × benefício linear, motor por eventos (recalcular só o que mudou), alerta visual azul → vermelho pulsante nos geradores.
- **Muda:** "falha catastrófica imediata" vira a Cascata de 5 s com card (o jogo explica); "eletricidade estocada globalmente" vira a bateria (o resto se vende no tick, como no GDD §4.1); a grade 100×100 do plano vira o arquipélago de 2048 casas com tick fixo de 100 ms (métrica: tick < 16 ms com as 2048 casas ocupadas).
