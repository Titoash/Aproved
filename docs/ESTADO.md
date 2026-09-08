# Estado do projeto

Atualizado ao fim da **Sessão 1** (scaffold + Rede da Era 1).

## O que existe

### Ferramental
- Vite 8 + React 19 + TypeScript 6, Zustand 5, Phaser 4.2, Vitest 5, oxlint.
- Scripts: `dev`, `build` (`tsc -b && vite build`), `test`, `test:watch`, `typecheck`, `lint`.
- Phaser sai em chunk próprio no build (`manualChunks`).

### Simulação — `src/sim/` (pura, testada)
| Arquivo | O que faz |
| --- | --- |
| `state.ts` | Tipos `GameState`/`RedeState`, `VERSAO_SAVE = 1`, `estadoInicial()` (₵ 50, 5 kW de demanda, 0 kW). |
| `tick.ts` | `tick(state, dtMs)` em passo fixo de 100 ms; `avancarTicks(state, n)`; limite de 5 s acumulados. |
| `rede.ts` | Potência ofertada, demanda, `r`, tabela `FAIXAS_R` com multiplicador, bateria, `balancoRede()` para o HUD, `passoRede()` na ordem produção → venda → bateria → receita. |
| `custos.ts` | `custoUnidade(def, n)` = base × crescimento^n; `custoMelhoria(def, nivel)`; `fatorMelhoria(nivel)`. |
| `acoes.ts` | `comprarUsina`, `melhorarUsina`, `comprarVila`, `comprarBateria` e os `pode…`/`custoProxima…`; desbloqueio por quantidade. |
| `formatar.ts` | PT-BR com vírgula: `formatarPotencia` (kW→MW→GW…), `formatarCreditos` (mil/mi/bi/tri), energia, taxa, razão, multiplicador. |
| `save.ts` | Único arquivo com `localStorage`. Salva a cada 10 s, carrega com validação/normalização, `exportarJson`/`importarJson`, `ErroSave`. |
| `loop.ts` | `criarLoop()` com `requestAnimationFrame` + acumulador; injetável para testes. |

### Conteúdo — `src/content/era1.ts`
Usinas (cata-vento, painel solar, turbina eólica), vila, bateria, `ECONOMIA` e `MELHORIA`.
**Todos os números são provisórios** (ver "Suposições" abaixo).

### Store — `src/store/`
- `gameStore.ts`: snapshot do `GameState`, ações de compra/melhoria, `avancarTicks` com autosave a cada 10 s de jogo, `salvarAgora`, `exportar`, `importar`, `resetar`.
- `jogo.ts`: `iniciarJogo()` liga o loop ao store e salva ao ocultar a aba / sair.

### UI — `src/ui/`
- `Hud.tsx`: ₵ e ₵/s, ⚡ ofertada (e quanto está vendendo), 🏙 demanda, `r` com chip colorido da faixa, 🔋 carga/capacidade com barra e fluxo (▲ carregando / ▼ descarregando).
- `PainelRede.tsx`: cards de usinas (quantidade, potência total, potência unitária, nível, Comprar com custo, Melhorar com custo e nível), Vila e Bateria; itens bloqueados mostram o requisito e o progresso.
- `PainelSave.tsx`: salvar agora, exportar (baixa `.json` e preenche a caixa), importar da caixa, resetar (com confirmação).
- `tokens.css`: navy, cards, tipografia, `--coral` (apagão), `--sun` (equilíbrio), `--sky` (saturação).

### Canvas — `src/canvas/`
- `GameCanvas.tsx`: monta o Phaser em um `ref`, `destroy(true)` no cleanup (seguro com StrictMode).
- `CenaFundo.ts`: cena vazia com gradiente radial navy e estrelas cintilando; redesenha no resize. Sem grade.

### Testes (`npm test` — 45 testes em 8 arquivos)
- Custo da n-ésima unidade e da melhoria.
- Multiplicador por faixa de `r` (0,7 → ×0,5; 1,0 → ×1,25; 1,3 → ×0,75; 1,15 → ×1) e limites (0,8 e 1,25).
- Bateria: carrega com excedente, descarrega em déficit, respeita capacidade e zero.
- 100 ticks (10 s) com 5 kW vendidos a preço 1,0 e `r` neutro → ₵ 50; tick puro; multiplicador aplicado; ordem produção → venda → bateria → receita.
- Formatação PT-BR; save (ida e volta, corrompido, versão futura, normalização); ações; loop (limite de 5 s); store.

### Verificação manual (Playwright, Chromium)
Roteiro executado no `npm run dev`: comprar cata-vento sobe ⚡ e ₵/s; créditos acumulam; 4 kW → escassez; 5 kW → equilíbrio; 7 kW → saturação e ₵/s cai; vila resolve; painel solar desbloqueia com 5 cata-ventos; melhoria multiplica a potência; bateria carrega e descarrega visivelmente; salvar + recarregar mantém o estado; exportar baixa o arquivo e importar restaura; um único canvas com StrictMode; nenhum erro de console.

## Suposições (o GDD não está no repositório)
`docs/GDD-parte1.md` não existe no repo, então os itens abaixo foram definidos para cumprir os critérios da Sessão 1. **Confira contra o GDD e ajuste** — tudo fica em `src/content/era1.ts` e na tabela `FAIXAS_R` de `src/sim/rede.ts`.

| Item | Valor adotado |
| --- | --- |
| Faixas de `r` (§4.1) | apagão `r < 0,8` ×0,5 · escassez `0,8 ≤ r < 0,95` ×1 · equilíbrio `0,95 ≤ r ≤ 1,05` ×1,25 · excedente `1,05 < r ≤ 1,25` ×1 · saturação `r > 1,25` ×0,75 |
| Definição de `r` | geração das usinas ÷ demanda (a bateria não entra no `r`; a descarga é vendida com o multiplicador da faixa vigente) |
| Escala de tempo | 1 s real = 1 h de rede; preço base ₵ 1 por kWh (5 kW × 10 s = ₵ 50) |
| Custo da unidade (§7) | `custoBase × 1,15^n` (n = já possuídas) |
| Melhoria (§7) | custo `custoBase × 10 × 3^nivel`; cada nível soma +50 % à potência base |
| Cata-vento | ₵ 10, 1 kW |
| Painel solar | ₵ 120, 5 kW, desbloqueia com 5 cata-ventos |
| Turbina eólica | ₵ 1 500, 30 kW, desbloqueia com 5 painéis (campo `pesquisa: 10` sem efeito) |
| Vila | ₵ 30, +3 kW de demanda |
| Bateria | ₵ 80, 10 kWh, desbloqueia com 3 cata-ventos |

## Pendente
- **GDD:** adicionar `docs/GDD-parte1.md` e substituir os números provisórios (`era1.ts`, `FAIXAS_R`).
- **Sessão 2:** grade/Núcleo (`nucleo: null` reservado no estado).
- **Sessão 3:** cálculo offline (hoje uma aba em segundo plano aplica no máximo 5 s ao voltar).
- Pesquisa sem efeito (`pesquisa` fica em 0; `desbloqueio.pesquisa` é ignorado).
- Não feito por estar fora de escopo: Cascata, Estabilidade, cards explicativos, medidor Kardashev, som, Era 2, Bipes.
- Melhorias possíveis: o HUD re-renderiza a cada frame (aceitável no tamanho atual); comprar em lote (×10); ícone/favicon próprio.
