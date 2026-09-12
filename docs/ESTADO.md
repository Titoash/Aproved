# Estado do projeto

Atualizado ao fim da **Sessão 5** (Era 2: fissão, calor de decaimento e transição de era). **MVP das Eras 1–2 fechado.**

## Implementado

### Sessão 1 — Scaffold + Rede da Era 1
- Vite 8 + React 19 + TypeScript 6 (strict), Zustand 5, Phaser 3.90, Vitest 5, oxlint. Scripts `dev`, `build`, `test`, `typecheck`, `lint`.
- `src/sim/`: estado, tick de 100 ms (`sim/tempo.ts`), Rede (balança, bateria, receita), custos, ações, formatação PT-BR, save (único ponto com `localStorage`), loop.
- `src/content/era1.ts`: usinas, vila, bateria, economia e faixas de `r` (GDD §4.1, §7, §8.2).

### Sessão 2 — Núcleo da Era 1
- Torre Solar: `nucleo.ts`, `calor.ts`, `cascata.ts`, `estabilidade.ts`, tick em seis passos, desbloqueio por 🔬, `acoesNucleo.ts`, `GridScene`, painel do Núcleo.

### Sessão 3 — Bateria, offline, Kardashev, melhorias, mobile
- Bateria como amortecedor (faixa efetiva), melhorias nomeadas (Lâminas, Rastreamento), offline puro, medidor Kardashev, input da grade pelo DOM, hi-DPI, página rolando no mobile.

### Sessão 4 — Era 1 bonita
- Grade 7×7 como melhoria (anel 3 a 0,25 só para heliostato), cards explicativos com os textos finais, Bipes em SVG próprio, passe de arte completo (tokens, rampa de calor, HUD em faixa, Núcleo como palco, Rede em lista, mobile em uma coluna). Save v4. 235 testes.

### Sessão 5 — Era 2 (fissão) e transição de era
- **GDD v0.5, §8.5 (passo 0).** O §7 remetia os números finos das Eras 2–6 a uma "Parte 2" que nunca foi escrita. A Era 2 saiu de lá e virou **§8.5**, antes de qualquer código: Reator PWR em grade 7×7, peças, combustível, decaimento, Rede e a tabela da transição. Seção 8 renomeada para "As duas eras do MVP" sem renumerar nada. Ver `docs/correcoes-gdd-v0.5.md`.
- **Estado multi-era e save v5 (passo 1).** `era: 1 | 2`, `NucleoState.tipo` (`torreSolar` | `reatorPwr`), `PecaId` e `UsinaId` como união das duas eras, `combustivel` opcional na casa (`restante` + `paradaEmMs`). Migração v4 → v5; v1, v2 e v3 sobem em cadeia. O centro da grade segue sendo `{ tipo: "receptor" }` — é a marca estrutural do centro; o nome visível vem do conteúdo da era, então nenhuma grade salva precisou migrar.
- **Registry de eras (passo 2).** A chave é contar a grade por **papel**, não por peça: heliostato e vareta aquecem, turbina e gerador convertem, radiador e bomba dissipam, tanque e pressurizador armazenam. `contar()` soma papéis e `nucleo.ts` serve às duas eras sem um `if` de era.
  - `content/tipos.ts` (interfaces), `content/regras.ts` (o que vale em todas as eras e morava em `era1*` por acidente: faixas de calor e de `r`, Cascata, modo seguro, offline, crescimento de melhoria), `content/era2.ts`, `content/era2-nucleo.ts`, `content/eras.ts` (o registry: `defDaEra`, `defDoNucleo`, `usinasAte`).
  - `defDoNucleo` resolve pelo `tipo` da grade, não pela era do estado: é a grade que diz o que ela é.
  - `Contagem` renomeada para nomes de papel (`aquecedoresPorAnel`, `conversores`, `dissipadoresAdjacentes`, `armazenadoresAdjacentes`) e `espelhosEfetivos` → `aquecedoresEfetivos`. Renomeação mecânica: nenhum resultado de teste mudou.
- **Combustível (passo 3).** `sim/combustivel.ts`: queima 0,25 %/s ponderada pelo anel (400 s no anel 1, 800 s no anel 2), exaustão com carimbo do instante da parada, recarga por 60 % do preço. Entra como passo **4a** do tick, antes do balanço: a vareta que esgota neste tick já não injeta calor neste tick. Em SCRAM não queima. Corte de 1e-9 no restante — sem ele o resíduo de ponto flutuante (~1e-13) deixaria a vareta "quase gasta" para sempre e o decaimento nunca começaria.
- **Calor de decaimento (passo 4).** `sim/decaimento.ts`: `0,07 × nominal × 2^(−t/90 s)`, corte em 0,05 u/s, contado de `paradaEmMs` (exaustão **ou** início do SCRAM). O termo entra como entrada no balanço e **não** é zerado pelo SCRAM. `equilibrioU()` passou a receber o instante, porque com decaimento o equilíbrio escorrega. Peça quente não sai da grade.
- **Transição de era (passo 5).** `sim/era.ts`: portão do §8.4 (🛡 100 + 🔬 3 000 + ₵ 50 000) e `avancarEra()`. `faltaParaAvancar()` alimenta o botão, que diz o que falta em vez de só ficar cinza.
- **Rede da Era 2 (passo 6).** Hidrelétrica, termelétrica a gás e usina nuclear a partir da Era 2 (`Desbloqueio.era`); as da Era 1 continuam compráveis. Cidade (+800 kW) e Banco de baterias (2 000 kWh, ±1 000 kW). Preço 0,1 vindo do registry.
- **Cards, paleta e cena (passo 7).** `content/cards-era2.ts` com os três cards (transição em 3 telas, combustível baixo, calor de decaimento) e `content/cards.ts` reunindo as duas eras. Seletor de peças e cena leem a era; a cena despacha o desenho por papel, com vareta (barra de combustível na peça, halo de decaimento pulsando na meia-vida) e Vaso no lugar da torre. Paleta do fundo por era, com fade na troca.
- **Testes (`npm test`, 302):** migrações v3/v4 → v5; combustível (duração por anel, exaustão, recarga, SCRAM não queima); decaimento (meia-vida, corte, anel 2, recusa de remoção); **SCRAM sem bomba cascateia e com bomba não**; cronômetro da Cascata em SCRAM; portão e troca de era; Rede e preço da Era 2; formatação em MW; eventos e cards da Era 2; melhorias da Era 1 não vazando para a Era 2.
- **Verificação no navegador (Playwright + Chromium, 1280×900 e 390×844):** Era 1 abre com o card de abertura; um save da Era 2 carrega com o seletor do Reator, a Rede com Cidade e Banco, as usinas da Era 1 ainda na lista e nenhum heliostato; a lista de recarga mostra a vareta a 14 % e a gasta com "ainda quente, esfria em 518,6 s"; o resumo diz "Vaso do reator · h = 4 · conv = 2 · dis = 1 · ☢ 2,7 u/s de decaimento"; o botão da era aparece com o portão satisfeito e, ao ser clicado, entra na Era 2 e abre o card "De kW para MW". Zero erros de console.

## Próxima sessão
`docs/sessoes/sessao-6.md` (a escrever) — Era 3 (Tokamak: Contenção e acoplamento com a Rede, GDD §4.3). Antes dela, escrever os números da Era 3 no GDD, como o passo 0 desta sessão fez com a Era 2.

## Decisões da Sessão 5 que o GDD não fixava (agora estão no §8.5)
1. **O decaimento conta também a partir do início do SCRAM**, não só da exaustão. Sem isso o jogador escaparia sempre apertando o botão e a era não ensinaria nada.
2. **Vareta gasta não sai enquanto está quente**; o caminho normal é recarregar.
3. **A demanda base salta 800 kW na transição**, senão `r` explode e o jogador é punido por progredir.
4. **Estabilidade zera** na troca; o modo seguro (preferência do jogador) e o histórico de Cascatas atravessam; o Receptor cerâmico não.
5. **Usinas da Era 1 continuam compráveis**; o custo inflacionado as aposenta sozinhas.
6. **Offline nunca piora a grade:** o combustível não queima offline, mas o decaimento das gastas avança pelo relógio (elas esfriam).
7. **A grade da Era 2 nasce 7×7** e nenhuma peça dela aceita o anel 3 (espaço reservado para a Era 3).

## Regra da Era 1 que precisou mudar
O cronômetro da Cascata zerava durante o SCRAM, com o comentário "Núcleo desligado não cascateia" — código da Sessão 2, **não** contrato (o GDD §5 só diz que o SCRAM tira potência e pesquisa). Na Era 1 a regra é invisível: em SCRAM a entrada é 0 e o calor só cai. Na Era 2 ela anularia o §8.5.5 inteiro. Agora o cronômetro zera em SCRAM **se nada mais estiver entrando**; a Era 1 passa 0 sempre, então o comportamento é idêntico. Nenhum teste antigo mudou de resultado.

## Pendências
- **Contadores por era na Rede.** `rede.cidades` e `rede.bateria.bancos` foram **acrescentados** aos da Era 1 em vez de generalizados para contadores por era. A generalização tocaria 32 referências e uma migração, para um formato que não dá para validar contra as Eras 3–6, cujos números não existem. Vale generalizar quando a Era 3 for especificada — antes de a Era 3 acrescentar mais dois campos.
- **Zoom cósmico da transição** (GDD §6, §9.6): a troca de paleta e o card entregam o momento, mas o afastamento de câmera não foi feito.
- **Expansão 9×9** (anel 4): `anel()` corta em 3, o que serve para 5×5 e 7×7. Uma grade maior exige mexer nisso.
- **Melhorias da Era 2**: a era não tem nenhuma. O Reator não tem equivalente do Rastreamento solar nem do Receptor cerâmico.
- **Saída da Era 2** (§8.5.8: 🔬 300 000 + ₵ 5 000 000) está escrita como **provisória** e vale até a Era 3 ser especificada. `ULTIMA_ERA` é 2, então o botão não aparece.
- Painéis assinam o `state` inteiro e re-renderizam a cada tick (10 Hz); se a lista crescer, fatiar com seletores.
- Bipe no entulho é a versão mínima em `Graphics`; a versão SVG completa vive nos cards.
- O tremor da Cascata usa a câmera do Phaser e aparece só dentro do recorte do palco.
- O roteiro de teste usa `dispatchTouchEvent` para o toque (o gesto sintetizado do Chromium não funciona no headless); vale um teste manual em Android.
- Playwright não está no `package.json`: a verificação da sessão usou `npm install --no-save playwright` e o Chromium de `/opt/pw-browsers`. Se virar rotina, vale versionar o roteiro.
