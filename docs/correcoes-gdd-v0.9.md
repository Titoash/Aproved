# Correções do GDD v0.8 → v0.9 (a espera)

O autor perguntou como resolver a espera, com um sub-jogo se possível. A gestão rodou `npm run simular` (Era 1 + Era 2, tick real) e mediu cinco janelas em que potência e população ficam paradas e o dinheiro só acumula:

| Janela | O que fica parado | O que trava |
|---|---|---|
| Era 1, min 3–10 | 60 kW por 7 min; ₵ 3 mil → 33 mil | 🔬 (o próximo passo é o nó de 🔬 800) |
| Era 1, min 20–30 | 308 kW e 12 mil hab. por 10 min; ₵ 150 mil → 318 mil | 🔬 e as expedições caras |
| Era 1, min 40–44 | tudo; só a barra anda | 🛡 |
| Era 2, min 45–49 | só a barra anda | 🛡 |
| Era 2, min 50–61 | 17,9 MW por 11 min; ₵ 3 → 7,6 milhões | 🔬 (Reator 7×7, Fusão básica) |

São ≈ 35 dos 102 minutos. A espera dominante é 🔬 com ₵ sobrando; a barra de Estabilidade é a segunda. As melhorias da v0.8 dão destino ao ₵, mas não geram 🔬.

| Decisão | Onde no GDD | Sessão |
|---|---|---|
| **Ciência com nível**: laboratório, universidade e instituto ganham nível incremental por tipo (+25 % de 🔬 por nível, `base × 3ⁿ × N`, máximo 5). Era a peça que faltava no modelo "toda melhoria é por tipo" da v0.8, e converte o ₵ parado em 🔬 | Parte 1 §7.1, §8.6; Parte 2 §4.2, §9 | 9 (parte A) |
| **Ocorrências**: sub-jogo opcional de operação do Núcleo. Oferta a cada 4 min de jogo ativo, 60 s para aceitar, um controle só (carga das turbinas na Era 1, barras de controle na Era 2), meta de segurar `T` na zona de ouro (ou a potência numa faixa), recompensa escolhida pelo jogador: 🛡 +3 ou 🔬 igual a 60 s da produção. Nunca offline. Três na Era 1 (Nuvem, Céu limpo e frio, Turbina em meia carga) e três na Era 2 (Seguimento de carga, Xenônio, Turbina em meia carga), cada uma com frase de física | Parte 1 §4.4, §4.2, §6, §10.1; Parte 2 §5.4 | 10 |
| **Estabilidade 1,8/min no ouro e 1,2/min fora**, +3 por Ocorrência superada: ≈ 42 min jogando, ≈ 56 min deixando rodar. Reabre o ajuste 1 da Sessão 7, que só voltaria se o playtest do autor pedisse; pediu. Entra junto com as Ocorrências, nunca antes | Parte 1 §7, §8.4; Parte 2 §5 | 10 |
| **Sessão 10 = Ocorrências; Era 3 passa para a Sessão 11** | Parte 1 §12; Parte 2 §6 | — |

Textos que ainda contradiziam a v0.8, corrigidos sem mudança de design:
- Parte 1 §2.4: "um Bipe" → os Bipes (dois de nascença).
- Parte 1 §2.5 e §7: evoluir "um bairro" → evoluir a cidade, custo × N bairros.
- Parte 1 §7: "três níveis na árvore" das peças → nível incremental no painel + degrau de era na árvore.
- Parte 1 §8.2: "Lâminas de fibra ₵ 200, 🔬 não gasto" → nó da árvore (🔬 25) desde a v0.6.
- Parte 1 §8.5: tempos antigos de remoção tirados da linha de custos (os da v0.8 estão no parágrafo seguinte).
- Parte 1, cabeçalho: v0.6 → v0.9.
- Parte 2 §6: Arcologia exige só a Megacidade (ajuste 4 da Sessão 8); "Era 3 (Sessão 9)" → Sessão 11.

O que não muda: fórmulas de `r`, calor, `Q*`, Cascata, bateria, offline, árvore e capítulos. As Ocorrências entram no motor como multiplicadores; nenhuma equação de §4.2 ou §8.3 muda.

Uma troca em relação à proposta feita ao autor: a "Onda de calor" da Era 2 saiu e entrou "Turbina em meia carga". A torre dissipa um valor fixo, e pela metade ela move `T` só 12,5 pontos numa grade na zona de ouro, sem tirá-la do ouro (Parte 2 §5.4).

**Em stand by:** "jogar 15 minutos por dia" como tema do jogo. O autor pediu para deixar a ideia parada; o levantamento parcial está em `docs/analises/15-minutos-por-dia.md`.
