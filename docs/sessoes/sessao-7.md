# Sessão 7 — Cidade e árvore: bairros, evolução, laboratórios, universidades, 🔬 gasto, capítulos

> Pressupõe a Sessão 6 aprovada. Produção no branch `claude/sessao-7` conforme `docs/PRODUCAO.md`. Leia o GDD (§2.5, §3, §7, §8.6, §9) e `docs/analises/reactor-e-volume1.md`.

## Objetivo
A cidade evolui e a ciência tem de onde vir e para onde ir: bairros com densidade e evolução quase exponencial, população que libera universidades, laboratório, 🔬 gasto numa árvore de pesquisa em que cada nó explica a física, e capítulos com objetivos curtos guiando a Era 1.

## Partes
- **A · Cidade (sim puro).** Bairro como construção com `densidade` 1–4; demanda, população e tarifa por densidade (§8.6); `evoluirBairro` (₵ + 🔬, exponencial); demanda total e tarifa média ponderada entram na balança de §4.1 sem mudar a fórmula de r; população total e o limite de universidades. Testes com os números de §8.6.
- **B · Ciência (sim puro).** Laboratório e universidade como construções que consomem kW e geram 🔬; 🔬 vira **gasto**: `gastarPesquisa`; desbloqueios de usina, melhorias existentes, obstáculos grandes e evoluções passam a debitar. Migração v6 → v7: 🔬 acumulado vira saldo; o que já foi desbloqueado fica desbloqueado sem cobrar.
- **C · Árvore de pesquisa (conteúdo + sim).** Inclui os três níveis por peça do Núcleo (§8.6) e a regra "nada acumula sem sumidouro" (§7): população limitada por bairros evoluídos, 🔬 sempre com nó comprável à vista, ₵ com custo seguinte visível. `content/arvore-era1.ts` com os nós de §8.6 (custo, efeito, pré-requisitos, exclusões, e a frase de física de cada um); `sim/arvore.ts` puro (`podePesquisar`, `pesquisar`, efeitos acumulados aplicados nas fórmulas de produção, esteira, alcance, bateria, tarifa). As melhorias nomeadas atuais viram nós.
- **D · Capítulos.** `content/capitulos-era1.ts`: sequência de objetivos curtos com recompensa em ₵ ou 🔬 ("Coloque 5 cata-ventos numa colina", "Ligue a Ventania por cabo", "Evolua um bairro para vila", "Estabilidade 100 %"). Um objetivo ativo por vez, visível no HUD.
- **E · UI e cena.** Painel do bairro ao tocar (densidade, população, demanda, botão Evoluir com custo); universidades e laboratórios na paleta; árvore de pesquisa como tela própria (nós em colunas por tecnologia, frase de física em cada nó, custo em 🔬, exclusões visíveis); HUD com 🔬 como saldo gastável e 👥 população; capítulo ativo no HUD; cards: primeira evolução, primeira universidade, primeiro nó pesquisado.
- **F · Balanceamento.** Script de simulação de 60 minutos de jogo ativo (bot simples que segue os capítulos) em `scripts/simular.ts`: relatório de ₵, 🔬, população e Estabilidade a cada 5 minutos; ajustar os números de §8.6 até a Era 1 fechar em 50–70 min. Registrar os ajustes no relatório e no GDD.
- **G · Verificação.** Testes; roteiro Playwright (evoluir bairro, universidade aparece com 1 000 habitantes, gastar 🔬 num nó e ver o efeito, capítulo concluído); capturas em `docs/capturas/sessao-7/`; `ESTADO.md`; relatório.

## Checklist
- [x] bairros com densidade, evolução exponencial, tarifa por densidade; testes
- [x] laboratório e universidade; população; 🔬 gasto; migração v6 → v7
- [x] árvore da Era 1 com frases de física; efeitos nas fórmulas; exclusões
- [x] capítulos com recompensas; objetivo ativo no HUD
- [x] UI: painel do bairro, tela da árvore, HUD com 🔬 e 👥, cards
- [x] simulação de 60 min e números recalibrados no GDD
- [x] roteiro Playwright verde; capturas; `ESTADO.md`; relatório; `typecheck`, `test`, `lint`, `build`

*Concluída. Relatório em `docs/sessoes/sessao-7-relatorio.md`; a Era 1 fecha em 41 min na simulação e o
conflito com os 50–70 minutos de §7 (taxa de Estabilidade) está registrado lá e no GDD §8.4.*
