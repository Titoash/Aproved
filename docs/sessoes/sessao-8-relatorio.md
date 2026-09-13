# Sessão 8 — relatório de produção

> Era 2 (fissão), transição de era, Rede em MW, cidade 5–6, árvore e capítulos da Era 2.
> Branch `claude/sessao-8`, a partir de `201dfcd` ("GDD Parte 2: Era 2 completa (v0.7) e especificação da Sessão 8").

## Plano (escrito antes de codar, conforme a regra 2 da produção)

1. **Parte 0 — ajustes da Sessão 7.** Subestação com nível máximo 3; universidade rendendo por alunos
   (`√(pop ÷ n_universidades ÷ 1 000)`); callout de toque na cena para a construção selecionada (bairro com
   "Evoluir"); linhas de ligação na árvore de pesquisa; capturas dos roteiros antigos fora do repositório.
   GDD §8.5 e §8.6 atualizados, testes novos. Commit próprio.
2. **Parte A — transição de era (sim puro).** `state.era` e `nucleo.era`; `construirReator` (Estabilidade
   100 % + `fissaoBasica` + ₵ 200 000): desmonta a Torre devolvendo 50 %, volta a grade para 5×5 com o Vaso no
   centro, zera a Estabilidade, guarda tudo o mais. Save **v8** com migração v7 → v8 (`era: 1` por padrão).
3. **Parte B — reator PWR (sim puro).** `content/era2-nucleo.ts` com as peças de §5.1; motor de calor
   unificado (`motor.ts`) para as duas eras, mantendo `T = Q ÷ capacidade`, faixas, Cascata e Estabilidade;
   `sim/reator.ts` com combustível finito, esgotamento, calor de decaimento, barra de controle sobre as 8
   vizinhas, piscina, torre, troca de vareta, SCRAM da Era 2 e Cascata com entulho quente. A tabela de §5.3
   inteira vira teste, mais o teste obrigatório escrito lá.
4. **Parte C — Rede da Era 2.** Construções 2×2 (âncora + 3 casas), mar raso colocável com pertencimento à
   ilha mais próxima, eólica offshore, fazenda solar, térmica a gás com combustível em ₵/s no extrato,
   subestação de 138 kV, subestação offshore, bateria de rede, nó Cabo HVDC.
5. **Parte D — cidade da Era 2.** Densidades 5 e 6, distrito industrial e instituto de pesquisa.
6. **Parte E — árvore e capítulos da Era 2.** `content/arvore-era2.ts` (frases de física conferidas) e
   `content/capitulos-era2.ts`; Fusão básica como saída com o aviso de que a Era 3 está em produção.
7. **Parte F — UI e cena.** Botão "Construir o Reator", card "Calor de decaimento", câmera que afasta e
   volta, paleta entardecer, reator/varetas/barra/piscina desenhados, callout de peça com "Trocar", paleta
   com as construções da Era 2 (prévia 2×2 e mar raso realçado), extrato com combustível e receita líquida,
   aba da Era 2 na árvore, cards da Era 2.
8. **Parte G — balanceamento.** `scripts/simular.ts` atravessando a Era 1, construindo o reator e jogando
   60 minutos de Era 2; calibrar até a Era 2 fechar em 50–70 min sem receita líquida negativa por mais de
   1 minuto.
9. **Parte H — verificação.** `npm run typecheck`, `npx vitest run`, `npm run lint`, `npm run build`,
   `npm run build:artifact`; `scripts/e2e/sessao-8.cjs` nos dois tamanhos; regressão das Sessões 6 e 7 com
   capturas fora do repositório; capturas em `docs/capturas/sessao-8/`; `ESTADO.md` e este relatório.

Ordem de corte, se faltar tempo (de `sessao-8.md`): Instituto, Bateria de rede, Rede inteligente, Selo verde,
Distrito industrial. Nunca 0, A, B, C (offshore e térmica), E, G, H.

Base medida antes de começar: `typecheck`, `lint` e **299 testes** verdes em `201dfcd`.

---

## O que foi feito

(preenchido ao longo da sessão)
