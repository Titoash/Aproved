# 15 minutos por dia — ideia em stand by

**Situação:** parada por decisão do autor, depois da v0.9. Nada disto é contrato: o GDD não foi tocado por esta ideia.

## O que o autor propôs
"Não só essa questão de espera, mas sempre que você for upando, e poderíamos fazer um jogo cuja temática seja de jogar apenas 15 minutos por dia." Dois pontos: (1) a espera não está só nas janelas medidas em `docs/correcoes-gdd-v0.9.md`, mas em toda subida de nível (o laço comprar → esperar juntar → comprar); (2) o tema do jogo passaria a ser uma sessão diária de 15 minutos.

## O que foi feito antes de parar
A gestão abriu um levantamento com vários agentes (medir a espera em cada compra, mapear o que no GDD e no código depende de tempo, pesquisar jogos de sessão diária) seguido de quatro desenhos concorrentes — "turno do operador" (offline-first), "um dia por dia" (ciclo dia/noite de 15 min com o pico da curva do pato), "obras com prazo real" e "mudança mínima". Foi interrompido quando o autor pôs a ideia em stand by. Só o mapa de restrições terminou; ele está abaixo, sem revisão linha a linha.

## Achados conferidos pela gestão (valem com ou sem a ideia)
1. **Offline do reator rende a janela inteira** (defeito, contra Parte 2 §5.2). `sim/offline.ts` credita a potência, a 🔬 e a Estabilidade do equilíbrio salvo por toda a ausência; as varetas só são marcadas como gastas. Medido com 6 varetas: 8 h fora rendem 48× a 🔬 de 10 min fora (🔬 209 mil). Entrou na parte 0 da Sessão 9.
2. **Aba em segundo plano perde o tempo.** O loop limita o acumulado a 5 s (`sim/tempo.ts`, `DT_ACUMULADO_MAX_MS`) e `store/useTick.ts` salva ao ocultar a aba mas não aplica o offline quando ela volta. A mesma ausência vale ≈ 0 com a aba viva e até 8 h se o navegador descartou a aba. O GDD só manda aplicar o offline "no load" (Parte 1 §11); é decisão pendente (ver `docs/ESTADO.md`).
3. **O offline enche a Estabilidade e o caixa.** Offline, a Estabilidade sobe na taxa da faixa ×0,7 por até 8 h (`sim/offline.ts`): 8 h × 2,5 × 0,7 = 840 pontos, a barra inteira numa noite. Com a receita do fim da Era 1 medida na simulação (₵ 1 171/s), 8 h fora × 0,5 dão ≈ ₵ 16,9 milhões — trinta vezes a soma das expedições da era (₵ 0,54 milhão). O ritmo de 60 min por era só vale para quem joga sem fechar, e `scripts/simular.ts` nunca simula ausência. Qualquer retomada desta ideia começa por aqui.

## Onde retomar
Os quatro ângulos acima, com o mapa abaixo como ponto de partida. A leitura do mapa: o modelo "dia de jogo" mantém quase toda a calibragem atual e troca só o contrato do offline; o modelo "offline-first" obriga a escolher entre automação (fere "nada é comprado sozinho") e crescimento só nos 15 minutos. As Ocorrências (v0.9) servem aos dois.

---

## Anexo — mapa de restrições (levantamento automático, não conferido item a item)

(A) = "offline-first": o jogo roda sozinho entre sessões (~24 h) e a sessão de 15 min é para decidir. (B) = "dia de jogo": um dia com ciclo dia/noite dura ~15 min reais e é jogado uma vez por dia. Os números de receita do anexo (₵ 620/s no minuto 20) não foram conferidos; os da seção de achados foram. As referências "GDD1:linha" são de antes da v0.9.


### Três achados antes da tabela
1. **O offline de hoje já estoura o ritmo de quem fecha o jogo.** No minuto 20 da simulação a receita é ₵ 620/s. Oito horas ausente × 0,5 dão **₵ 8,9 mi**. Só 4 universidades e 4 laboratórios rendem **61 mil de pesquisa** no mesmo tempo. Para comparar: as expedições da Era 1 somam ₵ 0,54 mi e a árvore inteira da era custa 22 mil (GDD1:251). A Estabilidade também enche offline: 57 min na zona de ouro ×0,7, 95 min na normal. O alvo de 60 min/era (GDD1:152) só vale para quem joga sem fechar, e `scripts/simular.ts` nunca simula ausência.
2. **Bug: o reator rende a janela offline inteira com combustível para 10 min.** `offline.ts:61` credita a potência do equilíbrio salvo pelas 8 h. `offline.ts:70` só marca as varetas como gastas no fim. O teste (`era2.test.ts:269`) confere apenas que houve pesquisa.
3. **Aba em segundo plano perde o tempo.** O acumulado do loop é limitado a 5 s (`tempo.ts:6`, `loop.ts:46`). `useTick.ts:12–20` salva quando a aba some, mas não aplica o offline quando ela volta. A mesma ausência vale 0 com a aba viva e 8 h se o navegador descartou a aba.

### Item por item

| Item | Hoje | Tipo | (A) offline-first | (B) dia de jogo |
|---|---|---|---|---|
| Tempo | tick fixo de 100 ms (`tempo.ts:4`), rAF com acumulador | contrato (CLAUDE.md, regra 1) | Fica, mas o offline tem de ser fechado. Medi 0,009 ms/tick no estado inicial e ~0,2 ms com o bot no meio do jogo: 24 h tick a tick custariam até ~3 min de CPU. | Fica. Um dia = 9 000 ticks, com o relógio do dia como função pura de `tempoMs`. Sol, vento e demanda passam a variar por hora (hoje são constantes). |
| Offline | 8 h, ₵ ×0,5, pesquisa de lab/univ. ×0,5, Núcleo ×0,7, sem bateria, nada comprado, sem Cascata, relógio para trás = 0 (GDD1:149; `offline.ts:29–94`; `era1.ts:116–125`) | regras são contrato; valores são calibragem | Teto sobe para 24 h e os fatores caem muito (achado 1). "Nada comprado" choca com "roda sozinho": ou tudo só acumula, ou entra automação, que fere GDD1:45 e GDD1:150. | Entre um dia e outro quase nada pode render: 8 h × 0,5 equivalem a 16 sessões. A pausa com a aba oculta, que B quer, o loop atual já quase faz. |
| Save | v8 (`state.ts:199`), migração versão a versão (`save.ts:291–386`), carimbo `salvoEmMs` | implementação | Campos novos (vida da vareta, fila offline); mudança aditiva. | `dia`, fase do dia, dia encerrado; mudança aditiva. Nos dois modelos, decidir antes da Sessão 9 para caber no v9 já previsto. |
| Estabilidade | 1,5/min (normal, e também frio e alerta) e 2,5/min (ouro) (`era1-nucleo.ts:124–128`); offline ×0,7; 100 % libera a era (`era.ts:45`) | trava de era = contrato; taxas = calibragem | Enche numa noite e deixa de travar. Ou sobe só com o jogo aberto (~3 sessões), ou offline mínimo. | Continua valendo: 40–75 min (faixa da revisão da v0.9) = 3–5 dias. A proposta (c), 1,8/min, cabe. |
| Cascata/SCRAM | 5 s acima de 100 %, −30 pontos, SCRAM de 20 s (Era 2: 60 + 30 s) (`era1-nucleo.ts:132–145`; GDD2:100) | contrato | Só existe nos 15 min. Offline, `T* ≥ 95 %` desliga o Núcleo o dia todo: a faixa de alerta vira proibida. A zona de ouro continua possível. | Intacta: os tempos são de reação e cabem no dia. |
| Bateria | 20 kWh, ±10 kW; 1 kWh = 1 kW·s (`era1.ts:55`) | contrato ("oscilação curta", GDD1:79) | Irrelevante (desligada offline). | Ganha papel: a noite pede minutos de reserva, cerca de 100× o tamanho atual. A frase do §4.1 muda. |
| Capítulos | condição de estado, um por tick (`capitulos.ts:100`) | implementação | Compatíveis; "trocaEmFaixa" só com o jogo aberto. | Compatíveis; podem virar a meta do dia. |
| Árvore | Era 1 ≈ 22 mil, Era 2 ≈ 193 mil de pesquisa | calibragem | Reescalar para o orçamento de 24 h. | Fica como está se o entre-dias render ~0. |
| Ritmo | 60 min/era; bot mede 41,4 min (Era 1) e 60,9 min (Era 2) (GDD1:217; GDD2:165) | calibragem | Vira "N dias por era". O gargalo passa a ser toques: na Era 1 o bot faz 146 colocações, 23 nós e 6 expedições, casa a casa. Não cabe em 15 min. | 60 min = 4 dias de 15 min; `simular.ts` só precisa cortar em dias. |
| Combustível Era 2 | vareta de 600 s (no máximo ~1 h com barra, MOX e Água pesada), troca após 180 s; esgota offline; térmica paga ×0,5 (GDD2:97–102) | esgotar e decair = contrato; tempos = calibragem | Reator morto 23 h por dia. Ou a vareta dura horas e a troca escalonada vira plano diário, ou o Núcleo da Era 2 perde a função. | A troca como rotina cabe: 600 s são 2/3 do dia. |
| Remoção | 0,5–15 s, 2 Bipes (GDD1:238). Offline, só a remoção em curso termina; a fila não anda (`mundo.ts:389–400`) | calibragem | Tempo longo vira conteúdo ("mande limpar e saia"), e a fila precisa andar offline. A v0.8 foi na direção oposta. | A v0.8 serve. |
| Acoplamento Era 3 | contenção consome potência da Rede; apagão leva à Cascata (GDD1:28, 99) | contrato | Com Rede congelada e sem Cascata offline, esse risco some em 99 % do tempo. | A noite sem sol vira a crise natural do dia. |
| Kardashev | GDD diz potência "instalada", mas o código soma a oferta do instante; em SCRAM o Núcleo conta 0 (`kardashev.ts:8–10`) | fórmula = contrato; código diverge | Sem efeito. | Com o sol variando, K oscilaria ao longo do dia; tem de usar potência de placa. |
| Prestígio | pós-MVP (GDD1:137) | em aberto | Ciclo semanal ou mensal. | Idem; não trava nenhum dos dois. |

### Limites da plataforma
- **Sem push garantido** (no iOS, só com PWA instalado). A não consegue avisar "vareta acabou"; B não consegue avisar "o dia está pronto". A volta depende de hábito.
- **Relógio manipulável.** O relógio para trás conta 0 (`offline.ts:29–32`), mas adiantar o relógio é livre e repetível, porque o carimbo se renova a cada carga. Em A isso dá recurso grátis até o teto; em B abre o dia seguinte. Sem servidor não há como impedir; só o teto limita o dano.
- **Abas estranguladas.** O rAF para com a aba oculta, e os timers caem para 1/min no Chrome depois de 5 min. Ver achado 3.
- **localStorage** fica em um aparelho só: não sincroniza celular e desktop. O Safari apaga os dados depois de 7 dias sem visita (fora de PWA). Exportar JSON já existe (`save.ts:451`).

### Invariante × calibragem
**Invariantes (não mudam em nenhum modelo):**
- sim puro com tick fixo de 100 ms;
- Rede × Núcleo acoplados;
- três balanças com a zona de ouro perto do limite;
- Cascata que volta uma etapa, com card, sem game over e sem perder pesquisa;
- trava de era: Estabilidade + nó + ₵;
- nada sobe sem decisão, nada é comprado sozinho;
- nunca há Cascata durante a ausência;
- física real e marcos reais no Kardashev;
- espaço conquistado; Bipes.

**Calibragem:** teto e fatores do offline; taxas de Estabilidade; custos da árvore, das expedições e das evoluções; vida da vareta, meia-vida e SCRAM; tempos de remoção e número de Bipes; tamanho da bateria; minutos por era.

**Conflito a decidir:** A obriga a escolher entre ceder em "nada sobe sem decisão" (automação) e aceitar que o crescimento só acontece nos 15 min, o que na prática é B com offline alto. B mantém a calibragem atual e troca só o contrato do offline (GDD1:149).
