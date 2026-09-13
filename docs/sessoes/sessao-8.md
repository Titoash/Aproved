# Sessão 8 — Era 2: Reator de fissão, transição de era, Rede em MW, cidade 5–6, árvore e capítulos da Era 2

> Pressupõe a Sessão 7 aprovada e incorporada. Produção no branch `claude/sessao-8` conforme `docs/PRODUCAO.md`. Leia `docs/GDD-parte2.md` inteiro (é o contrato desta sessão) e, na Parte 1, §4.2, §5, §6, §7, §8.3, §8.4, §8.5, §8.6, §10. Antes da parte A, aplique `docs/sessoes/sessao-7-ajustes.md`.

## Objetivo
O MVP fecha: Eras 1–2 jogáveis de ponta a ponta. A Era 2 traz o reator PWR com combustível finito e calor de decaimento, usinas que cobram para funcionar, construção 2×2 e no mar raso, cidade até a arcologia, árvore e capítulos próprios, e a transição de era com card, câmera e paleta.

## Partes
- **0 · Ajustes da Sessão 7.** Itens 2, 3, 5 e 6 de `sessao-7-ajustes.md` (subestação nível máximo 3; universidade por alunos; callout do bairro na cena; linhas da árvore), em commit próprio, com GDD e testes atualizados. Item 7: roteiros antigos rodados como regressão gravam capturas **fora** do repositório.
- **A · Transição de era (sim puro).** `state.era` (1 | 2); `construirReator` (Parte 2 §2: exige Estabilidade 100 % + `fissaoBasica`, custa ₵ 200 000, desmonta a Torre devolvendo 50 %, Estabilidade zera, grade volta a 5×5, Vaso fixo no centro); o que fica e o que muda, com teste. Save **v8** com migração v7 → v8 (`era: 1` por padrão). Kardashev mostra `K` a partir de 1 MW (já previsto em §6).
- **B · Reator PWR (sim puro).** Peças da Parte 2 §5.1 em `content/era2-nucleo.ts`; motor de calor reaproveitado (`calor.ts`, faixas, Cascata, Estabilidade) com o que é novo: `combustivelS` por vareta, esgotamento, vareta gasta com decaimento (7 %, meia-vida 60 s), troca (₵ 8 000; só < 1 % ou com Piscina vizinha), barra de controle sobre as 8 vizinhas (−50 %, vida ×2, sem somar), Piscina (+250 u, absorve o decaimento das vizinhas), Torre (30 u/s), SCRAM da Era 2 (60 s mínimos, religar em 30 s, decaimento entra no Vaso), Cascata com entulho quente e `Q` preservado, offline com esgotamento. **Testes reproduzindo a tabela de §5.3 inteira**, inclusive o teste obrigatório escrito lá.
- **C · Rede da Era 2 (sim puro + conteúdo).** Construções **2×2** no mundo (quatro casas, mesma ilha, âncora, esteira e sombra por qualquer das quatro); **mar raso colocável** com a regra de pertencimento à ilha mais próxima; usinas da Parte 2 §3.1 (eólica offshore, fazenda solar, térmica a gás com combustível ₵/s que entra no extrato como custo e desliga "sem escoamento"); Subestação de 138 kV, Subestação offshore, Bateria de rede (§3.2); nó "Cabo HVDC" (teto ×10). Nenhuma fórmula de `r`, bateria ou escoamento muda: só entram construções e um custo de operação na receita líquida.
- **D · Cidade da Era 2.** Densidades 5 e 6 (Parte 2 §4.1, curva ×2,5 com o ×10 a partir da 5); Distrito industrial e Instituto de pesquisa (§4.2); tarifa ×2,2 do distrito entrando na média ponderada como qualquer bairro.
- **E · Árvore e capítulos da Era 2.** `content/arvore-era2.ts` com os nós de §6 (custos, efeitos, pré-requisitos, a exclusiva Água pesada × Alta temperatura, e uma frase de física de verdade em cada um; conferir os números: 7 % de calor de decaimento, meia-vida, k = 1, HVDC com perdas ∝ I²R etc.); a árvore da Era 1 continua valendo; **Fusão básica** como saída (aviso "a Era 3 está em produção" ao cumprir, porque a Sessão 9 não existe ainda). `content/capitulos-era2.ts` com os 12 capítulos de §7.
- **F · UI e cena.** Botão "Construir o Reator" no painel do Núcleo; sequência de transição (card "Calor de decaimento" em 3 telas, câmera afasta 3 s e volta, paleta entardecer via tokens); reator desenhado (cilindro, cúpula, torres quando há torre de resfriamento, vapor); varetas com o gradiente que apaga e o brilho residual da gasta; halo da barra; piscina; painel de peça com combustível restante, decaimento e o botão "Trocar" com o motivo quando não pode; paleta de construção com as usinas e construções da Era 2 (2×2 com prévia das quatro casas; mar raso realçado quando a peça é offshore); extrato com **combustível** como linha de custo e receita líquida; tela da árvore com a aba da Era 2; cards da Era 2 (§7). Tudo nos dois tamanhos.
- **G · Balanceamento.** `scripts/simular.ts` estendido: o bot atravessa a Era 1 (como hoje), constrói o reator e joga **60 minutos de Era 2** seguindo os capítulos, com troca escalonada de varetas. Relatório dos 10 primeiros minutos da Era 2 minuto a minuto e depois a cada 5. Calibrar os números da Parte 2 até a Era 2 fechar em **50–70 min** e a receita líquida nunca ficar negativa por mais de 1 min no jogo do bot. Cada ajuste vai para o relatório e para a Parte 2.
- **H · Verificação.** Testes; `scripts/e2e/sessao-8.cjs` (transição, primeira vareta, esgotamento e troca, SCRAM com decaimento, 2×2 recusando casa ocupada, offshore no mar raso, térmica cobrando combustível no extrato, Megacidade, nó da Era 2 comprado); roteiros das Sessões 6 e 7 continuam verdes (capturas fora do repositório); capturas em `docs/capturas/sessao-8/`; `ESTADO.md`; relatório.

Se não couber tudo, a ordem de corte é: Instituto de pesquisa, Bateria de rede, Rede inteligente, Selo verde, Distrito industrial. Nunca cortar 0, A, B, C (offshore e térmica), E, G e H.

## Checklist
- [x] ajustes 2, 3, 5, 6 e 7 da Sessão 7 aplicados, GDD e testes atualizados
- [x] transição de era: `construirReator`, desmonte com devolução, Estabilidade zerada, save v8 com migração
- [x] reator PWR: peças, esgotamento, decaimento, barra, piscina, torre, SCRAM e Cascata da Era 2; tabela §5.3 em testes
- [x] construções 2×2 e mar raso; eólica offshore, fazenda solar, térmica com combustível; 138 kV, offshore, bateria de rede, HVDC
- [x] cidade 5–6, distrito industrial, instituto
- [x] árvore da Era 2 com frases de física; capítulos da Era 2; Fusão básica como saída com aviso
- [x] UI e cena: transição com card, câmera e paleta; reator e varetas desenhados; painel de peça com Trocar; paleta 2×2 e offshore; extrato com combustível
- [x] simulação: Era 1 + Era 2, números recalibrados na Parte 2 (a Era 2 fecha em 60,9 min)
- [x] roteiro Playwright verde nos dois tamanhos; roteiros 6 e 7 verdes; capturas; `ESTADO.md`; relatório; `typecheck`, `test`, `lint`, `build`

*(Marcado pela produção ao fim da sessão; o relatório está em `sessao-8-relatorio.md`.)*
