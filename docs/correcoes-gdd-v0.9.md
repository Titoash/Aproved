# Correções do GDD v0.8 → v0.9 (a espera)

O autor perguntou como resolver a espera, com um sub-jogo se possível. A gestão rodou `npm run simular` (Era 1 + Era 2, tick real) sobre o código da Sessão 8 (v0.7.1: nível por subestação, evolução bairro a bairro, sem níveis de peça nem ciência com nível) e mediu cinco janelas em que potência e população ficam paradas e o dinheiro só acumula:

| Janela | O que fica parado | O que trava |
|---|---|---|
| Era 1, min 3–10 | 60 kW por 7 min; ₵ 3 mil → 33 mil | 🔬 (o próximo passo é o nó de 🔬 800) |
| Era 1, min 20–30 | 308 kW e 12 mil hab. por 10 min; ₵ 150 mil → 318 mil | 🔬 e as expedições caras |
| Era 1, min 40–44 | tudo; a barra enche aos 41,4 e depois só o ₵ junta (3,8 mil no min 41 → 219,7 mil no min 44) | 🛡 até 41,4; depois os ₵ 200 000 do Vaso (Reator aos 44) |
| Era 2, min 45–49 | potência (17,9 MW); a barra enche aos 48,7; a população ainda sobe de 1,02 para 1,14 milhão | 🔬 (Reator 7×7 aos 54, Fusão aos 60,9); a barra não trava a saída |
| Era 2, min 50–61 | 17,9 MW por 11 min; ₵ 3,1 a 8,5 milhões (oscila, sem tendência: 6,0 no min 50, 5,4 no min 60) | 🔬 (Reator 7×7, Fusão básica) |

São ≈ 36 dos ≈ 105 minutos (44 da Era 1 até o Reator + 60,9 da Era 2; o relógio da Era 2 do `simular` começa quando o Vaso é construído). A espera dominante é 🔬 com ₵ sobrando; a barra de Estabilidade é a segunda. As melhorias da v0.8, ainda não implementadas na medida, dão destino ao ₵, mas não geram 🔬.

| Decisão | Onde no GDD | Sessão |
|---|---|---|
| **Ciência com nível**: laboratório, universidade e instituto ganham nível incremental por tipo (+25 % de 🔬 por nível, `base × 3ⁿ × N`, máximo 5 no total por tipo; a unidade nova paga o acumulado do nível, como o bairro novo). Era a peça que faltava no modelo "toda melhoria é por tipo" da v0.8, e converte o ₵ parado em 🔬 | Parte 1 §7.1, §8.6; Parte 2 §4.2, §9 | 9 (parte A) |
| **Ocorrências**: sub-jogo opcional de operação do Núcleo. Oferta a cada 4 min de jogo ativo, 60 s para aceitar, um controle só (carga das turbinas na Era 1, barras de controle na Era 2), meta de segurar `T` na zona de ouro (ou a potência numa faixa), recompensa escolhida pelo jogador: 🛡 +3 ou 🔬 igual a 60 s da produção. Nunca offline. Três na Era 1 (Nuvem, Céu limpo e frio, Turbina em meia carga) e três na Era 2 (Seguimento de carga, Xenônio, Turbina em meia carga), cada uma com frase de física | Parte 1 §4.4, §4.2, §6, §10.1; Parte 2 §5.4 | 10 |
| **Estabilidade 1,8/min no ouro e 1,2/min fora**, +3 por Ocorrência superada com 🛡 escolhido: a barra enche em ≈ 42 min jogando e escolhendo 🛡, ≈ 56 min deixando rodar (Era 1; cada Cascata soma ≈ 12,5 ou ≈ 17 min; faixa 40–75 min). Reabre o ajuste 1 da Sessão 7, que só voltaria se o playtest do autor pedisse; pediu. Entra junto com as Ocorrências, nunca antes | Parte 1 §7, §8.4; Parte 2 §5 | 10 |
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

Uma troca em relação à proposta feita ao autor: a "Onda de calor" da Era 2 saiu e entrou "Turbina em meia carga". A torre dissipa um valor fixo, e pela metade ela move `T` 12,5 pontos, o que só tira do ouro grades com `T*` acima de 77,5 %; ficou de fora por ora (Parte 2 §5.4).

## Revisão adversarial da v0.9

Uma revisão em três frentes (contas, consistência, física) confirmou 32 achados, 13 médios e 19 baixos, nenhum alto. Aplicados:

- **Xenônio (Parte 2 §5.4):** a Resposta passa a "potência 110–120 %". Com as rampas de 15 s, as barras paradas em 125 % desde o aceite ficam só 69 % do tempo no ouro. Os 15/30/15 s ficam como exceção declarada às rampas de 5 s (o xenônio age devagar), e a rota operador da Sessão 10 acompanha a rampa.
- **Faixa da Estabilidade:** 40–65 → 40–75 min. Uma Cascata tira 30 pontos, ≈ 17 min a 1,8/min, e com a faixa antiga uma só já estourava. A meta por era (50–70 recusando, 40–50 operando) está em Parte 1 §7, e §8.4 remete a ela.
- **Os ≈ 42 min são da barra na Era 1**, não do fechamento da era. Na Era 2 a saída também depende da 🔬 (Parte 1 §4.4, §12).
- **+3 só com 🛡 escolhido** (Parte 1 §6, §7; Parte 2 §5). Lido ao pé da letra, o texto antigo dava o 🛡 sempre e ainda deixava escolher.
- **Relógio das ofertas:** acumulador de tempo de tick, que só anda sem oferta e sem Ocorrência e recomeça ao fim delas. Oferta pendente ao fechar é descartada. **Só se oferece o que se pode ganhar:** existe valor do controle que devolve o ouro. Sem isso, a Nuvem numa grade com muitos radiadores não se ganhava.
- **Modo seguro:** a Resposta vale para o trecho estável, e nas rampas o jogador acompanha. O teste obrigatório da Sessão 10 roda sem modo seguro.
- **Era 2:** o MotorCalor separa injeção ativa de decaimento, e Barras e Xenônio multiplicam só a ativa. O controle passa a ser "potência das varetas" (menos potência = barras mais inseridas). A primeira oferta de um save da Era 2 é o Xenônio, e depois de um SCRAM também.
- **Física:** Turbina em meia carga da Era 1 — calor, não vapor, e o tanque desacopla; a "carga" é abstração do jogo. Turbina em meia carga da Era 2 — desvio de vapor e barras entrando; a queda de grupo existe só em alguns reatores. Xenônio — "retira barras", com a causa (potência baixa ou SCRAM) à vista.
- **Ciência com nível (Parte 1 §7.1, Parte 2 §4.2):** 5 níveis no total por tipo; o nível atravessa a transição; **unidade nova de subestação ou ciência paga o acumulado do nível**. É a mesma correção do bairro novo: herdando de graça, subir com uma universidade e construir as outras depois dividia o custo por N. O exemplo da Era 2 passa a valer para qualquer rota, porque o total não depende da ordem.
- **Sessões:** a Sessão 10 testa a Turbina em meia carga da Era 1, não o Céu limpo e frio, que é cortável. O diário sai da ordem de corte da Sessão 9 (a 10 registra nele).
- **Textos velhos:** "única fonte de Pesquisa" (§2.2); 🔬 "em evoluções de bairro" (§3); "bairro evoluído" (§7); linha Vila na tabela de usinas (§8.2); preço da Grade 7×7 (§8.3); "três níveis por peça" (§8.6); "Bairros novos continuam ₵ 40 × 1,25ⁿ" (Parte 2 §4.1); comentários de código que ainda chamavam a Era 3 de "Sessão 9".

**Em stand by:** "jogar 15 minutos por dia" como tema do jogo. O autor pediu para deixar a ideia parada; o levantamento parcial está em `docs/analises/15-minutos-por-dia.md`.
