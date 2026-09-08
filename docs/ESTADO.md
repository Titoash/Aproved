# Estado do projeto

## Implementado

### Sessão 1 — Scaffold + Rede da Era 1 (concluída)
- **Ferramental:** Vite 8 + React 19 + TypeScript 6 (strict), Zustand 5, Phaser 3.90, Vitest 5, oxlint. Scripts `dev`, `build`, `test`, `typecheck`, `lint`. Phaser sai em chunk próprio.
- **`src/sim/` (puro, testado):**
  - `state.ts` — `GameState`/`RedeState`, `VERSAO_SAVE = 1`, `estadoInicial()` (₵ 50, 5 kW de demanda, 0 kW, `nucleo: null`).
  - `tick.ts` — `tick(state, dtMs)` em passo fixo de 100 ms; `avancarTicks`; `DT_ACUMULADO_MAX_MS = 5000`.
  - `rede.ts` — potência ofertada, demanda, `r`, tabela `FAIXAS_R` (GDD §4.1), bateria, `balancoRede()` para o HUD e `passoRede()` na ordem produção → venda → bateria → receita.
  - `custos.ts` — `custoUnidade` (`custoBase × crescimento^n`), `custoMelhoria` (`custoBase × 3^nível`), `fatorMelhoria` (`1 + 0,5 × nível`).
  - `acoes.ts` — `comprarUsina`, `melhorarUsina`, `comprarVila`, `comprarBateria` como funções puras; desbloqueio por quantidade.
  - `formatar.ts` — PT-BR com vírgula: potência (kW → MW → GW…), créditos (mil/mi/bi/tri), energia, taxa, razão.
  - `save.ts` — único ponto com `localStorage`; salva a cada 10 s; carrega com validação e normalização; exportar/importar JSON; `migrar()` pronto para versões futuras.
  - `loop.ts` — `createLoop()` com `requestAnimationFrame` + acumulador limitado a 5 s.
- **`src/content/era1.ts`:** usinas, vila, bateria, `ECONOMIA` e `MELHORIA` com os números do GDD §7/§8.2. Requisito de pesquisa fica como campo (`desbloqueio.pesquisa`), sem efeito.
- **`src/store/`:** `gameStore.ts` (snapshot + ações + autosave) e `useTick.ts` (liga o loop ao store; salva ao ocultar a aba ou sair).
- **`src/ui/`:** HUD (₵ e ₵/s, ⚡ ofertada, 🏙 demanda, `r` com chip colorido, 🔋 carga/capacidade e fluxo), lista da Rede (cards com quantidade, potência, nível, comprar e melhorar com custos, requisito de desbloqueio), painel de progresso (salvar, exportar, importar, resetar). Tokens do GDD §10 em `tokens.css`; HUD em uma coluna abaixo de 600 px.
- **`src/scene/`:** `GameCanvas` (um `Phaser.Game` em `ref`, `destroy(true)` no cleanup) e `BackgroundScene` (gradiente radial `#241B55` → `#0D1230`, estrelas de 1–2 px cintilando). Sem grade.
- **Testes (`npm test`, 47 testes):** custo da n-ésima unidade e da melhoria; multiplicador por faixa de `r` (0,7 → ×0,5; 1,0 → ×1,25; 1,3 → ×0,75; 1,15 → ×1) e todos os limites do §4.1; bateria carrega/descarrega respeitando a capacidade; 100 ticks com 5 kW a preço 1,0 e `r` neutro rendem ₵ 50; tick puro; ordem do tick; formatação; save (ida e volta, corrompido, versão futura, normalização); ações; loop; store.
- **Verificação no navegador (Playwright + Chromium):** todos os critérios de pronto da `sessao-1.md` conferidos, inclusive recarregar a página, exportar (arquivo baixado) e importar, um único canvas com StrictMode e HUD em uma coluna a 390 px.

## Próxima sessão
`docs/sessoes/sessao-2.md` (a escrever) — grade da Torre Solar em Phaser, Calor, zona de ouro, Cascata com entulho e SCRAM, Estabilidade, pesquisa. Pronto quando reproduzir os exemplos do GDD §8.3. O estado já reserva `nucleo: null` e `pesquisa`.

## Conflitos com o GDD apontados na Sessão 1
1. **Bateria em kWh × tempo real.** O GDD §7 cobra a energia em ₵ por kW·s e o §8.2 dá a bateria em kWh. Fisicamente 1 kW por 1 s = 1/3600 kWh: uma bateria de 20 kWh levaria mais de uma hora real para reagir e o critério "bateria visível carregando" não fecharia. Adotei a escala `ECONOMIA.kwhPorKwSegundo = 1` (1 kW por 1 s guarda 1 kWh; 20 kWh cobrem 5 kW de déficit por 4 s), que é o que o §4.1 descreve ("tolera oscilação curta"). **Proposta:** fixar no GDD "1 s real = 1 h de rede para energia armazenada", ou trocar a unidade da bateria para segundos de reserva.
2. **Desbloqueio por pesquisa sem pesquisa.** Turbina eólica (🔬 40) e Bateria (🔬 20) só dependem de pesquisa, que nasce com o Núcleo na Sessão 2. Como a sessão manda deixar o campo sem efeito, as duas ficam compráveis desde o início, com a nota "sem efeito até o Núcleo existir" no card. Quando a pesquisa entrar, basta `desbloqueado()` em `acoes.ts` checar `desbloqueio.pesquisa`.
3. **Interpretações onde o GDD não fixa o detalhe:** custo da n-ésima unidade com `n` = unidades já possuídas (a 1ª custa o custo base); melhoria com `nível` = nível comprado (nível 1 do cata-vento custa ₵ 45); zona de ouro inclusiva nos dois limites (0,9 ≤ r ≤ 1,1), neutro em 0,8 ≤ r < 0,9 e 1,1 < r ≤ 1,25, saturação só acima de 1,25.
4. **Observação de ritmo:** com 7 kW em saturação, a primeira Vila (+8 kW) leva `r` a 0,54 (apagão). É o número do GDD; vale conferir na Sessão 3 (balanceamento) se a primeira vila deveria ser menor.

## Pendências
- Melhorias nomeadas da Rede do GDD §8.2 (Lâminas de fibra ₵ 200, Rastreamento ₵ 150 + 🔬 30): não estavam nas entregas da Sessão 1.
- Pesquisa com efeito, Núcleo, Cascata, Estabilidade, cards explicativos, medidor Kardashev, modo seguro, som, Bipes, Eras 2+ — fora de escopo por sessão.
- Cálculo offline (GDD §7): hoje uma aba em segundo plano aplica no máximo 5 s ao voltar. Sessão 3.
- Fontes Outfit e Nunito vêm do Google Fonts com fallback para a fonte do sistema; se o jogo for servido offline, trazer os arquivos para `public/`.
- O HUD re-renderiza a cada frame (aceitável no tamanho atual; revisar se a lista crescer).
- Ícone do favicon ainda é o do Vite; trocar por SVG próprio no passe de arte.
- Compra em lote (×10, máx.) e atalhos de teclado.
