# Sessão 9 — Melhorias por tipo, cidade inteira, remoção rápida, HUD limpo e "ver acontecendo" (v0.8)

> Pressupõe a Sessão 8 aprovada e incorporada. Produção no branch `claude/sessao-9` conforme `docs/PRODUCAO.md`. Leia `docs/correcoes-gdd-v0.8.md` (o que o playtest mudou), a Parte 1 §7.1, §8.3, §8.5, §8.6, §10.1 e a Parte 2 §3.2, §5.1, §9. Antes da parte A, aplique `docs/sessoes/sessao-8-ajustes.md`.

## Objetivo
Melhorar é decisão e o jogo parece vivo. Um modelo só de melhorias (por tipo, incremental em ₵ e de era em 🔬), a cidade evoluindo inteira, o Núcleo com nível por peça na grade, remoção em paralelo e em área, HUD de quatro números e a cena mostrando energia, dinheiro, luz e trabalho acontecendo.

## Partes
- **0 · Ajustes da Sessão 8.** Itens 2, 3, 4 e 8 de `sessao-8-ajustes.md` (callout da subestação offshore com a ilha; bot com rota "cidade" na simulação; Arcologia sem exigir o Instituto; `loop.ts` sem nome de DOM), em commit próprio.
- **A · Modelo de melhorias (sim puro).** `sim/melhorias.ts` com **nível por tipo** para tudo: usinas das duas eras (custo `base × 3ⁿ`, +50 %, máx. 5), peças do Núcleo das duas eras (`5 × custo × 2ⁿ`, +10 % na grandeza da peça, máx. 5; Receptor, Vaso e Barra sem nível), subestações por tipo (`120 × 3ⁿ × N`, teto ×2ⁿ, máx. 3), cabos globais (soma das rotas × 3ⁿ, teto ×2ⁿ). Efeitos entram nas fórmulas existentes como multiplicadores (produção, motor de calor, escoamento) — nenhuma fórmula muda. `melhorarSubestacao` e `melhorarCabo` por unidade saem. Save **v9** com migração v8 → v9: nível global = maior nível existente. Testes para cada custo e efeito.
- **B · Cidade inteira (sim puro).** `densidade` passa para `state.cidade`; `evoluirCidade` cobra `custo × N bairros` (₵ e 🔬); bairro novo nasce na densidade da cidade e custa `₵ 40 × 1,25ⁿ × 2,5^(d−1)`; `evoluirBairro` sai; universidades, tarifa média e capítulos passam a ler a densidade da cidade. Migração: cidade na maior densidade entre os bairros. Testes.
- **C · Núcleo.** Níveis por peça nas duas eras comprados no painel do Núcleo, "Nv n" desenhado na peça; **"Trocar todas as gastas"** na Era 2. Os nós de era da árvore continuam multiplicando por cima. Testes com os exemplos de §8.3 e Parte 2 §5.3 a nível 0 (não mudam) e a nível 2 (mudam como o GDD diz).
- **D · Remoção.** Tempos novos em `content`; **N Bipes** em paralelo (2 de nascença; "Equipe de manutenção" ₵ 150 × 2ⁿ, máx. 4); nós **Máquinas pesadas** (Era 1, 🔬 120) e **Escavadeiras** (Era 2, 🔬 1 500) dividindo os tempos por 2; **seleção em área** (arrastar no desktop, toque longo e arrastar no celular, até 8×8) com custo total antes de confirmar e a fila repartida entre os Bipes. Testes da fila paralela.
- **E · HUD limpo.** Quatro itens (₵, ⚡, 🔥 com anel de Estabilidade, 🔬); 👥 no painel da Cidade e no callout do bairro; 🛡 no painel do Núcleo; capítulo em uma linha; níveis visíveis na paleta ("Nv n" e botão de nível na carta), na peça e na linha da cidade. Nos dois tamanhos.
- **F · Ver acontecendo (cena).** Pulsos de energia nos cabos e da subestação aos bairros na cor da faixa de `r`; "+₵" agregado a cada 2 s por bairro (máx. 12 na tela) e "+🔬" nos laboratórios e universidades; janelas acesas por densidade, piscando e apagando no apagão; um Bipe por remoção em curso; chaminé fumegando; brilho do Núcleo ∝ `T`; diário de três linhas no rodapé do tabuleiro (6 s por linha). Tudo orçado: medir ms por quadro com o arquipélago cheio antes e depois; no máximo 3 ms a mais.
- **G · Balanceamento.** `scripts/simular.ts` com os sumidouros novos (níveis, evolução da cidade inteira, equipe) nas duas rotas (corrida e cidade) e nas duas eras; Era 1 e Era 2 continuam em 50–70 min; registrar cada ajuste na Parte 1/Parte 2.
- **H · Verificação.** Testes; `scripts/e2e/sessao-9.cjs` (nível de usina na paleta, nível de peça na grade, evoluir a cidade inteira, dois Bipes derrubando ao mesmo tempo, seleção em área, HUD com quatro itens, "+₵" aparecendo, diário registrando); roteiros 6, 7 e 8 verdes (capturas fora do repositório; onde um roteiro antigo dependia de "Evoluir" por bairro ou de nível por unidade, atualizar o roteiro, não o jogo); capturas em `docs/capturas/sessao-9/`; `ESTADO.md`; relatório.

Se não couber tudo, a ordem de corte é: diário de eventos, fumaça da chaminé, "+🔬" flutuante, nó Escavadeiras. Nunca cortar 0, A, B, C, D, E, G e H, nem os pulsos, o "+₵" e as janelas acesas de F.

## Checklist
- [ ] ajustes 2, 3, 4 e 8 da Sessão 8 aplicados
- [ ] modelo de melhorias por tipo (usinas, peças, subestações, cabos); efeitos nas fórmulas; save v9 com migração
- [ ] cidade inteira: `evoluirCidade`, bairro novo na densidade da cidade, migração
- [ ] Núcleo: nível por peça nas duas eras, "Nv n" na peça, "Trocar todas as gastas"
- [ ] remoção: tempos, N Bipes, Equipe, Máquinas pesadas e Escavadeiras, seleção em área
- [ ] HUD de quatro itens, capítulo em uma linha, níveis visíveis onde a coisa está
- [ ] cena: pulsos, "+₵" e "+🔬", janelas acesas, Bipes, fumaça, brilho, diário; ms por quadro medidos
- [ ] simulação nas duas rotas e nas duas eras dentro de 50–70 min; ajustes registrados
- [ ] roteiro Playwright verde nos dois tamanhos; roteiros 6, 7 e 8 verdes; capturas; `ESTADO.md`; relatório; `typecheck`, `test`, `lint`, `build`
