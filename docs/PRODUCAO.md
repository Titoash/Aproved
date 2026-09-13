# Produção em duas sessões

Uma sessão de **gestão** (planejamento, revisão, verificação) e sessões de **produção** (uma por sessão do roteiro), em Opus, rodando em contêiner próprio.

## Contrato
1. A produção só começa com `docs/sessoes/sessao-N.md` escrito e o GDD atualizado pela gestão.
2. A produção trabalha no branch `claude/sessao-N` a partir de `claude/era1-scaffold-rede-pqkglz`, em commits pequenos em português, e empurra ao fim de cada parte.
3. Antes de encerrar: `npm run typecheck`, `npm test`, `npm run lint`, `npm run build` verdes; roteiro Playwright da sessão passando nos dois tamanhos (1280×800 e 390×844); capturas em `docs/capturas/sessao-N/`; `docs/ESTADO.md` atualizado; relatório em `docs/sessoes/sessao-N-relatorio.md` (o que fez, decisões fora do GDD, pendências, medições).
4. A gestão revisa o branch (código, testes, capturas), roda o roteiro, publica o playtest com `npm run build:artifact` e devolve ajustes como itens numerados em `docs/sessoes/sessao-N-ajustes.md`. A produção aplica e empurra. Repete até "aprovado".
5. Aprovado, a gestão faz o merge no branch principal do projeto.

## Regras que a produção não negocia
As de `CLAUDE.md`, e mais: nada de personagens ou marcas de terceiros; números de jogo só em `src/content/`; sim puro; fórmulas com teste; quando um número do GDD não fechar, apontar o conflito no relatório e propor o ajuste em vez de contornar.
