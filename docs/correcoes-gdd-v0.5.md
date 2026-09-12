# Correções do GDD — v0.5

Extraídas de `docs/sessoes/sessao-5.md` e aplicadas ao `docs/GDD-parte1.md` antes da Sessão 5.

### 1. O motivo: a Parte 2 não existe
O §7 dizia *"Números finos das Eras 2–6 na Parte 2"*, e o cabeçalho prometia a Parte 2 como "próximo passo". Mas `docs/` só tem `GDD-parte1.md`: a Parte 2 nunca foi escrita. A Sessão 5 implementa a Era 2 inteira e o CLAUDE.md diz que o GDD é o contrato — implementar números que o contrato não fixa seria inverter a regra. Então os números finos da **Era 2** saíram da Parte 2 e viraram **§8.5**, escrita antes de qualquer código. As Eras 3–6 continuam remetidas à Parte 2.

O que o GDD **já** fixava da Era 2 e foi respeitado sem alteração: cenário (cidade e rio) e Núcleo (Reator PWR) da tabela do §6; a natureza da balança (combustível esgota, peça gasta continua quente) do §6 e §9.7; o portão de saída da Era 1 do §8.4 (Estabilidade 100 % + 🔬 3 000 + ₵ 50 000) e o card "de kW para MW"; a regra de escala do §7 (potência ×~100, preço ×~0,1); o ritmo de ~60 min por era.

### 2. §8 — a seção deixou de se chamar "Era 1"
`## 8. Era 1 — Vento e Sol (completa)` virou `## 8. As duas eras do MVP`, com uma linha dizendo que §8.1–§8.4 são a Era 1 e §8.5 é a Era 2. Assim toda referência existente a §8.1, §8.2, §8.3 e §8.4 continua resolvendo — nada foi renumerado.

### 3. §8.5 — Era 2 completa (novo)
Os números derivam dos da Era 1 pela regra de escala do §7. Em resumo:

- **Reator PWR, grade 7×7**, Vaso de 1 000 u no centro. Nasce 7×7 porque o jogador já pagou pela geometria maior na Era 1 e tirá-la seria punir progresso. O anel 3 existe mas nenhuma peça da Era 2 o aceita (reservado para a Era 3); não há expansão 9×9.
- **Peças:** Vareta de combustível (40 u/s no anel 1, 20 no anel 2, ₵ 400) · Gerador de vapor (12 % de `Q`/s, 8 kW por u, ₵ 700) · Bomba de refrigerante (60 u/s, ₵ 550) · Pressurizador (+1 500 u, ₵ 800).
- **Combustível:** queima 0,25 %/s ponderado pelo anel → 400 s no anel 1, 800 s no anel 2. Recarga por 60 % do preço.
- **Decaimento:** `0,07 × entradaNominal × 2^(−t/90 s)`, corte em 0,05 u/s, contado do fim da fissão (exaustão **ou** início do SCRAM).
- **Equilíbrio de referência** (a versão Era 2 do exemplo obrigatório do §8.3): 5 varetas + 1 bomba + 2 geradores no anel 1, 2 varetas no anel 2 → `Q* = 750 u`, `T = 75 %`, **1 440 kW**. Era 1 na zona de ouro fazia ~16 kW, então ×90 — dentro do "~×100".
- **Transição:** ₵, 🔬, usinas, vilas, baterias, melhorias e `cardsVistos` atravessam; Núcleo, Estabilidade e calor zeram; preço base cai de 1,0 para 0,1; a demanda base salta 800 kW.

### 4. Decisões que o GDD anterior não tinha como resolver
1. **O SCRAM deixa de ser garantia.** O decaimento conta também a partir do início do SCRAM, não só da exaustão do combustível. Sem isso, o jogador poderia sempre escapar apertando o botão e a era não ensinaria nada — o §9.7 ("peça gasta continua quente") viraria texto decorativo.
2. **Vareta gasta não sai enquanto está quente.** É o que dá consequência ao decaimento; o caminho normal é recarregar, não remover.
3. **A demanda base salta 800 kW na transição.** Sem o salto, `r` explode no instante da troca e o jogador cai em saturação sem ter feito nada — seria punido por progredir.
4. **Estabilidade zera na transição.** A balança nova precisa ser aprendida; manter 100 % abriria a Era 3 de graça.
5. **Usinas da Era 1 continuam compráveis.** O custo inflacionado já as aposenta; "aposentar item" seria código sem necessidade.
6. **Offline nunca piora a grade:** o combustível não queima offline, mas o decaimento das varetas gastas avança pelo relógio (elas esfriam).

### 5. §8.5.8 — saída da Era 2, provisória
Estabilidade 100 % + 🔬 300 000 + ₵ 5 000 000 → Era 3, escalado pela regra do §7. Marcado como provisório no próprio GDD: vale até a Era 3 ser especificada.
