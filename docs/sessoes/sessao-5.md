# Sessão 5 — Era 2: fissão (esgotamento e calor de decaimento) e transição de era

> Pressupõe a Sessão 4 concluída (Era 1 completa e bonita: arte, cards, Bipes, Grade 7×7). Antes de planejar, leia `docs/ESTADO.md`. Nada da Sessão 4 ficou pendente.

## Objetivo
Fechar o MVP das Eras 1–2 (GDD §12): a Era 1 ganha uma saída de verdade e a Era 2 entra com a primeira balança que **muda de natureza**, não que só cresce. Em vez de um regime de equilíbrio estático (Era 1: `h` espelhos contra radiadores, para sempre), a Era 2 tem um regime que **envelhece**: o combustível queima, a entrada cai sozinha, e a peça que parou de produzir **continua esquentando**.

A lição que a era cobra, em uma frase: **na Era 1 o SCRAM sempre salva; na Era 2, não.**

Referências: GDD §4.2 (Calor), §5 (Cascata), §6 (progressão e eras), §7 (economia, offline), §8.4 (saída da Era 1), §9.7 (detalhes físicos que viram mecânica), §10 (arte).

---

## Conflito com o contrato, resolvido antes de codar

GDD §7 diz: *"Números finos das Eras 2–6 na Parte 2."* **A Parte 2 não existe** — `docs/` tem só `GDD-parte1.md`. O que o contrato fixa da Era 2:

| Fixado pelo GDD | Onde |
|---|---|
| Cenário: cidade e rio; Núcleo: Reator PWR | §6, tabela de eras |
| Balança que muda: combustível esgota, peça gasta continua quente | §6, §9.7 |
| Saída da Era 1: Estabilidade 100 % + 🔬 3 000 ("Fissão básica") + ₵ 50 000 | §8.4 |
| Card de transição: "de kW para MW" | §8.4 |
| Transição com zoom cósmico e troca de paleta | §6, §9.6 |
| Escala: potência ×~100, preço ×~0,1 por era → Era 2 tem preço base 0,1 | §7 |
| Ritmo: ~60 min de jogo ativo por era | §7 |

Tudo o mais (peças, capacidades, taxas de queima, meia-vida do decaimento, preços das usinas) está **proposto abaixo** e vira **GDD §8.5** no passo 0 do plano. Os números foram derivados dos da Era 1 pela regra de escala do §7, e o exemplo de equilíbrio abaixo é a versão Era 2 do exemplo obrigatório do §8.3.

---

## Parte A — Números propostos para a Era 2 (viram GDD §8.5)

### A.1 Núcleo: Reator PWR, grade 7×7, centro fixo (Vaso)
A grade da Era 2 **nasce 7×7**. O jogador já pagou pela geometria maior na Era 1 e não faz sentido tirá-la; o reator é fisicamente maior que a torre. O anel 3 vale para as peças que o aceitarem. Não há expansão 9×9 nesta sessão (`anel()` corta em 3; 9×9 exigiria anel 4 — fica em Pendências).

| Peça | Anéis | Efeito | Custo |
|---|---|---|---|
| **Vareta de combustível** | 1, 2 | +40 u/s no anel 1, +20 u/s no anel 2. Queima combustível. | ₵ 400 |
| **Gerador de vapor** | 1 (só adjacente) | Consome 12 % de `Q`/s, gera **8 kW por u** | ₵ 700 |
| **Bomba de refrigerante** | 1, 2 (só adjacente) | Dissipa **60 u/s** | ₵ 550 |
| **Pressurizador** | 1, 2 (só adjacente) | **+1 500 u** de capacidade compartilhada | ₵ 800 |

- Capacidade do Vaso: **1 000 u**.
- `kwPorUnidade` = 8 (dez vezes a turbina da Era 1); com `Q` uma ordem de grandeza maior, a potência do Núcleo sai ~×100, como o §7 manda.

### A.2 Combustível que esgota
- Cada vareta nasce com **100 %** e queima **0,25 %/s ponderado pelo anel** (peso 1 no anel 1, 0,5 no anel 2).
  → vareta do anel 1 dura **400 s** (6 min 40 s); a do anel 2, **800 s**.
- A **0 %** a vareta fica **gasta**: para de fissionar (entrada 0) e passa a emitir calor de decaimento.
- **Recarregar** uma vareta gasta: **60 % do preço** (₵ 240), volta a 100 %. É o caminho normal.
- Uma vareta gasta **não pode ser removida enquanto estiver quente** (decaimento acima do corte). O motivo aparece na recusa: *"Ainda quente. Recarregue ou espere esfriar."* É a mecânica que ensina §9.7.

### A.3 Calor de decaimento (o coração da era)
Uma vareta emite, além da fissão, um calor residual que **não depende de estar produzindo**:

```
decaimento(t) = fracaoDecaimento × entradaNominal × 2^(−t / meiaVida)
```

- `fracaoDecaimento` = **0,07** (os ~7 % reais de potência de decaimento logo após o desligamento)
- `meiaVida` = **90 s**
- corte em **0,05 u/s** — abaixo disso conta como zero e a vareta pode ser removida (≈ 6 meias-vidas ≈ 9 min)
- `t` conta do instante em que a vareta parou de fissionar: exaustão do combustível **ou** início do SCRAM, o que vier primeiro.

**Consequência que muda a natureza da balança:** o SCRAM zera a fissão mas **não** zera a entrada. Com 5 varetas no anel 1, o SCRAM começa com `5 × 0,07 × 40 = 14 u/s` entrando e nenhuma turbina consumindo. Se não houver bomba de refrigerante, o calor **sobe durante o SCRAM** e a Cascata acontece assim mesmo. Na Era 1 isso era impossível.

### A.4 Exemplo obrigatório de equilíbrio (versão Era 2 do §8.3)
Anel 1 cheio: **5 varetas + 1 bomba + 2 geradores**; mais **2 varetas no anel 2**.

- entrada de fissão = `5 × 40 + 2 × 20` = **240 u/s**
- dissipação = `1 × 60` = **60 u/s**
- `Q* = (240 − 60) ÷ (0,12 × 2)` = **750 u**; capacidade 1 000 → **T = 75 %** → zona de ouro
- potência = `2 × 0,12 × 750 × 8` = **1 440 kW ≈ 1,4 MW** (Era 1 na zona de ouro: ~16 kW → ×90, dentro do "~×100" do §7)

E o que a Era 1 não tinha: **isso não é estável no tempo**. Aos 400 s as 5 varetas do anel 1 se esgotam de uma vez; a entrada cai de 240 para `40 (anel 2) + 5 × 2,8 (decaimento) = 54 u/s`, abaixo dos 60 da bomba. O calor despenca, a potência com ele, e o jogador aprende a **escalonar as recargas** em vez de trocar tudo junto.

### A.5 Rede da Era 2 (preço base 0,1)

| Item | Custo base | Efeito | Cresc. | Desbloqueio |
|---|---|---|---|---|
| **Hidrelétrica de rio** | ₵ 1 500 | 100 kW | 1,15 | — |
| **Termelétrica a gás** | ₵ 6 000 | 300 kW | 1,15 | 🔬 3 500 |
| **Usina nuclear** | ₵ 20 000 | 900 kW | 1,15 | 🔬 6 000 |
| **Cidade** | ₵ 4 000 | +800 kW de demanda | 1,25 | — |
| **Banco de baterias** | ₵ 8 000 | +2 000 kWh, ±1 000 kW | 1,15 | — |

As usinas e vilas da Era 1 **continuam na lista, continuam produzindo e continuam compráveis**: o custo delas já inflacionou o bastante para se aposentarem sozinhas. Não há código de "aposentar item".

### A.6 Transição de era
Portão (GDD §8.4, sem alteração): **Estabilidade 100 % + 🔬 3 000 + ₵ 50 000**.

O que atravessa e o que zera:

| Atravessa | Zera / troca |
|---|---|
| ₵ e 🔬 (🔬 é acumulado, nunca gasto) | Núcleo: a Torre Solar **é substituída** pelo Reator; peças e entulho da Era 1 somem |
| Usinas, vilas e bateria da Era 1 | Estabilidade volta a 0 (a balança nova precisa ser aprendida) |
| Melhorias da Era 1 (efeitos de Rede seguem valendo) | Calor, SCRAM e cronômetro da Cascata zerados |
| `cardsVistos` | Preço base passa de 1,0 para 0,1 |

A demanda base salta para os **800 kW** da cidade inicial, somada à das vilas já compradas — sem isso `r` explodiria no instante da troca e o jogador cairia em saturação sem ter feito nada.

---

## Parte B — Cards da Era 2
Três, no formato já existente (`content/cards-era2.ts`, tabela `cardParaEvento()`):
1. **Transição** (3 telas, pausa o jogo): de kW para MW; a cidade no lugar da aldeia; o que você levou e o que ficou.
2. **Combustível esgotando**: dispara quando a primeira vareta passa de 20 %. Explica queima e recarga escalonada.
3. **Calor de decaimento**: dispara na primeira vareta gasta. É o card que avisa que o SCRAM não salva mais sozinho. Bipe alarmado.

## Parte C — Arte e cena
- Paleta da Era 2 em `tokens.css` (tokens novos, sem tocar nos da Era 1): concreto, água do rio, verde-cerenkov no Vaso.
- `GridScene` desenha as peças do reator: vareta com barra de combustível na própria peça, gasta em cinza com halo de decaimento pulsando na meia-vida; gerador de vapor com pluma; bomba com rotor; pressurizador com nível.
- **Zoom cósmico** na transição: a câmera afasta da colina para a cidade, a paleta troca no meio do movimento, o card entra no fim. `prefers-reduced-motion` corta para um fade.

---

## Fora do escopo desta sessão
Era 3 e Contenção; expansão 9×9 (anel 4); prestígio; som; retrabalho dos painéis para seletores fatiados.

## Checklist
- [ ] GDD §8.5 escrito com os números da Parte A
- [ ] Save v5 com migração v4 → v5 testada
- [ ] Registry de eras: nenhum número de era em `sim/`
- [ ] Era 1 sem mudança de comportamento (testes antigos passam sem edição)
- [ ] Combustível queima, esgota e recarrega
- [ ] Calor de decaimento entra no balanço, no SCRAM, no modo seguro e no offline
- [ ] SCRAM com varetas gastas e sem bomba **cascateia** (teste explícito)
- [ ] Portão da era e troca de estado
- [ ] Rede da Era 2 e formatação em MW
- [ ] Cards e cena da Era 2
- [ ] `typecheck`, `test` e `build` passando; `ESTADO.md` atualizado
