# Plano da Sessão 5 — Era 2 (fissão) e transição de era

> Escrito antes de qualquer código. Nada foi implementado nesta sessão: o único arquivo criado é este.
> Baseline verificado no commit `04ddd52`: `npm test` = 235 testes em 16 arquivos, todos passando; `npm run typecheck` limpo.

---

## 0. O problema de partida

**`docs/sessoes/sessao-5.md` não existe** — nem no repositório, nem em nenhum commit de nenhum branch (`git log --all --name-only` não encontra o arquivo). O `docs/ESTADO.md` a chama de "a escrever". **A Parte 2 do GDD, que o `GDD-parte1.md` diz conter "Eras 2–6 detalhadas, prestígio, roteiro dos cards explicativos", também não existe.**

Ou seja: a Sessão 5 é a primeira sem contrato. Tudo o que o GDD fixa sobre a Era 2 são cinco linhas:

| Onde | O que fixa |
|---|---|
| §6, tabela de eras | Era 2 = Fissão · cenário "cidade e rio" · Núcleo = Reator PWR · "combustível esgota; peças gastas **continuam quentes** (calor de decaimento)" |
| §6 | A era nova traz cenário novo, grade nova com peças novas, usinas novas na lista, e uma balança que muda de natureza |
| §6, §10 | Transição = câmera afasta em 3 s com troca de paleta |
| §7 | Cada era multiplica a escala de potência por ~100 e o preço por ~0,1 (Era 1 = 1,0 → **Era 2 = 0,1**). Ritmo: ~60 min por era |
| §8.4 | Saída da Era 1: **Estabilidade 100 % + 🔬 3 000 + ₵ 50 000**. Card de transição "de kW para MW" |
| §5 | "as eras seguintes variam a receita" da Cascata |
| §12 | Sessão 5 = "Era 2 (fissão: esgotamento e calor de decaimento) e transição de era" → pronto quando "MVP: Eras 1–2" |

Nenhum número de peça, usina, custo ou capacidade da Era 2 existe em lugar nenhum.

O `CLAUDE.md` diz: *"O design completo está em `docs/GDD-parte1.md`. É o contrato. Se o design precisar mudar, edite o GDD primeiro."* Então o **passo 1 desta sessão é escrever o contrato**, não código. Ele não é burocracia: sem os números da Era 2 fixados em algum lugar, o passo 6 (conteúdo) vira invenção livre e o `CLAUDE.md` regra 3 ("números de jogo vivem em `src/content/`") não tem de onde copiar.

---

## 1. Reconciliação — o que a Sessão 5 pressupõe e não encontra

Cada item traz o que existe hoje (com arquivo e linha), por que a Era 2 esbarra nele, e a decisão proposta.

### 1.1 Não há contrato da Era 2 (bloqueante)
- **Hoje:** ver seção 0.
- **Decisão proposta:** passo 1 escreve `docs/GDD-parte2.md` (Era 2 completa, no formato da §8) e `docs/sessoes/sessao-5.md` (a especificação da sessão, no formato da Sessão 4). O `GDD-parte1.md` ganha só um ponteiro na §8.4 e no rodapé de versão. Motivo de arquivo separado: a Parte 1 já está fechada em v0.4 e as Eras 3–6 vão para o mesmo arquivo novo depois. **Ver pergunta 1.**

### 1.2 Não existe transição de era nenhuma
- **Hoje:** `grep -rn "avancarEra\|proximaEra"` em `src/` não retorna nada. A Estabilidade sobe até 100 % (`sim/estabilidade.ts:limitarEstabilidade`) e **não acontece nada**. Os requisitos da §8.4 (🔬 3 000, ₵ 50 000) não aparecem em nenhum arquivo: `grep -rn "3000\|50000"` em `src/` só acha um `delay` de tween e um teste de faixa.
- **Decisão proposta:** passo 8 cria `sim/eras.ts` com `podeAvancarEra` / `avancarEra`, e o passo 9 põe o botão na UI. Os requisitos vêm de `content/eras.ts`, não hardcoded.

### 1.3 `GameState.era` é o literal `1`, não um tipo
- **Hoje:** `src/sim/state.ts:84` — `era: 1;`. E `src/sim/save.ts:172` — `era: 1,`, cravado dentro de `normalizar()`: **qualquer save com `era: 2` volta como Era 1, em silêncio.**
- **Decisão proposta:** `export type EraId = 1 | 2` no passo 2; `save.ts` valida contra as chaves de `ERAS` em vez de cravar.

### 1.4 O `sim/` importa o conteúdo da Era 1 direto, no topo do módulo
- **Hoje:** `state.ts:2-3`, `nucleo.ts:5`, `calor.ts:2`, `cascata.ts:2`, `rede.ts:5`, `offline.ts:5-6`, `melhorias.ts:2-3`, `tick.ts:10`, `acoes.ts:2`, `acoesNucleo.ts:2`. Não existe a noção de "conteúdo da era corrente".
- **Decisão proposta:** passo 2 cria `src/content/eras.ts` com `ERAS: Record<EraId, EraDef>`, e a Era 1 entra ali **reexportando os objetos que já existem** — nenhum número muda de lugar no passo 2. As funções do sim passam a receber o pedaço de conteúdo de que precisam, com o valor da Era 1 como padrão do parâmetro, para os 235 testes atuais seguirem chamando sem argumento.

### 1.5 `precoBase` é constante de módulo dentro do cálculo de receita
- **Hoje:** `src/sim/rede.ts:189` e `:233` usam `ECONOMIA.precoBase` direto. `balancoRede` e `passoRede` não recebem a era.
- **Por que dói:** o preço da Era 2 é ×0,1 (GDD §7). Sem isso a Era 2 rende 10× a mais do que o projetado e o ritmo de ~60 min por era vai embora.
- **Decisão proposta:** passo 3 acrescenta `economia` a `OpcoesBalanco` (padrão = a da Era 1); `tick.ts`, `offline.ts` e `kardashev.ts` passam `ERAS[state.era].economia`.

### 1.6 Os `Record` de ids explodem no `typecheck` quando os ids crescem
- **Hoje:** `PecaId` (`state.ts:32`), `UsinaId` (`:5`) e `MelhoriaId` (`:6`) são uniões só da Era 1, e o conteúdo declara `Record` **total** sobre elas: `PECAS: Record<PecaId, PecaDef>` (`era1-nucleo.ts:57`), `USINAS: Record<UsinaId, UsinaDef>` (`era1.ts:58`), `MELHORIAS: Record<MelhoriaId, MelhoriaDef>` (`era1.ts:134`). Mais `melhoriasIniciais()` (`state.ts:101`) e o literal de `estadoInicial()` (`state.ts:145`).
- **Isso é bom:** no instante em que a Era 2 acrescenta um id, o `npm run typecheck` aponta **todos** os lugares que precisam de atenção. É o mecanismo de prova dos passos 6 e 7.
- **Cuidado:** um lugar **não** é pego pelo compilador — `src/sim/save.ts:80`, `const IDS_USINA: readonly UsinaId[] = ["cataVento", "painelSolar", "turbinaEolica"]`, uma lista literal. Se as usinas da Era 2 não entrarem ali, **elas não sobrevivem ao save, sem erro nenhum**. O passo 6 troca essa lista por `Object.keys(USINAS_TODAS)` e adiciona um teste que grava e recarrega uma usina da Era 2.
- **Decisão proposta:** ids continuam uniões fechadas (união de todas as eras), não `string`. O compilador é o melhor teste que temos aqui.

### 1.7 `sim/nucleo.ts` é a Torre Solar, não "o Núcleo"
- **Hoje:** `contar()` (`:35-75`) faz `switch (casa.id)` com `heliostato`/`turbina`/`radiador`/`tanque`; `balancoDeCalor` (`:101`), `equilibrioU` (`:119`), `potenciaNucleoKw` (`:128`) e `capacidadeU` (`:87`) são as fórmulas da §8.3. Junto no mesmo arquivo estão as funções puramente geométricas (`anel`, `podeColocar`, `expandirGrade`, `entulharAnel1`), que servem a qualquer era.
- **Decisão proposta:** passo 4 separa **geometria** (`sim/grade.ts`) de **física** (`sim/nucleo/era1.ts`, depois `era2.ts`), com `sim/nucleo.ts` virando o despachante que escolhe a física pela era e **reexporta tudo o que já exportava**. Critério de pronto do passo: os 235 testes passam **sem editar nenhum arquivo de teste**.

### 1.8 `Casa` não tem estado por peça — e a Era 2 precisa
- **Hoje:** `state.ts:35-39` — `{ tipo: "peca"; id: PecaId }`. Uma peça é só um id.
- **Por que dói:** o coração da Era 2 é *"combustível esgota"*. Cada vareta precisa carregar quanto lhe resta. Sem campo por peça, não há Era 2.
- **Decisão proposta:** `{ tipo: "peca"; id: PecaId; combustivelU?: number }` (opcional, ausente na Era 1). Save v5 normaliza o campo. **Ver pergunta 6** sobre o destino da vareta gasta.

### 1.9 `passoCalor` devolve um número; a Era 2 precisa devolver a grade também
- **Hoje:** `sim/nucleo.ts:140` — `passoCalor(...): number`. `tick.ts:72` guarda só o `calorU`.
- **Por que dói:** consumir combustível é uma mutação da grade dentro do passo de calor.
- **Decisão proposta:** passo 7 muda para `passoCalor(...): { grade, calorU }`. `tick.ts` e `offline.ts` acompanham. Assinatura nova em um passo só, com os testes da Era 1 atualizados no mesmo commit (é a única quebra intencional de teste do plano — ver Riscos).

### 1.10 SCRAM e offline assumem que o calor para quando se desliga
- **Hoje:** `tick.ts:66` — `entradaUs = scramAtivo ? 0 : ...`; `nucleo.ts:109` — `entrada = emScram ? 0 : ...`; `offline.ts:46-60` congela tudo em `equilibrioU` e assume que existe um `Q*` estável.
- **Por que dói:** calor de decaimento é exatamente *"o calor não para quando você desliga"* — é o ponto da era. E com combustível esgotando não existe `Q*` constante: o equilíbrio anda ao longo do tempo.
- **Decisão proposta:** passo 7 dá à física de cada era uma função `entradaDeCalor(grade, emScram)` própria — a da Era 1 devolve 0 em SCRAM, a da Era 2 devolve o decaimento. Passo 13 troca o modelo offline da Era 2 de "equilíbrio congelado" por integração em passos grossos (1 por minuto simulado). **Ver pergunta 7.**

### 1.11 A receita da Cascata é a da Era 1, fixa
- **Hoje:** `sim/cascata.ts:57` chama `entulharAnel1` sempre; `CASCATA` (`era1-nucleo.ts:132`) é um objeto único. GDD §5 diz que "as eras seguintes variam a receita".
- **Decisão proposta:** `cascata` vira campo de `EraDef` no passo 2 (com a Era 1 apontando para a constante atual) e a Era 2 define a sua no passo 6. Se a receita da Era 2 for igual à da Era 1, isso fica sendo só um dado — mas fica no lugar certo.

### 1.12 A UI e a cena são da Era 1, por importação direta
- **Hoje:** `ui/PainelRede.tsx:1` e `ui/PainelNucleo.tsx:2-3` importam `ORDEM_USINAS`/`ORDEM_PECAS`/`PECAS` de `content/era1*`. `ui/CardExplicativo.tsx:1` e `store/gameStore.ts:8` importam `CARDS_ERA1`. `scene/GridScene.ts:222` usa `NUCLEO.consumoTurbina` e o `switch` de desenho em `:296-310` conhece as quatro peças da Era 1. `content/cards-era1.ts:100` — `cardParaEvento` mapeia `item === "tanque"` sem olhar a era.
- **Decisão proposta:** passos 9 (listas), 10 (cards) e 11 (desenho) trocam cada importação direta por uma leitura da era corrente.

### 1.13 A paleta por era já existe nos tokens, sem ninguém usar
- **Hoje:** `ui/tokens.css:35-38` já declara `--plasma`, `--ion`, `--void`, `--gold` com o comentário "Era 3/4/5/6". Não há token de Era 2, e `--sun`/`--sky` (Era 1) são usados diretamente em todo o CSS e no `GridScene` (`COR.sky`, `COR.torre`).
- **Decisão proposta:** passo 11 introduz `--era-primaria` / `--era-secundaria`, define-os por `[data-era="1"]` / `[data-era="2"]` e troca os usos "de era" (não os semânticos, como `--coral` de alerta). A Era 2 usa `--sky` como primária (cidade e rio, água) e um verde-fissão novo como secundária. Os tokens `--sun`/`--sky` continuam existindo.

### 1.14 Rampa de calor única
- **Hoje:** `RAMPA_CALOR` (`era1-nucleo.ts:154`) é uma lista só, lida por `scene/rampa.ts` e pela UI. A armadilha da Sessão 4 ("se a UI e a cena divergirem em uma parada, a esfera e o número de 🔥 mostram cores diferentes") continua valendo.
- **Decisão proposta:** `rampa` vira campo de `EraDef`; `scene/rampa.ts` recebe a rampa como argumento em vez de importar. Uma fonte por era, ainda uma fonte só.

### 1.15 Dois testes assertam o objeto de melhorias inteiro
- **Hoje:** `src/sim/__tests__/save.test.ts:69` e `:139` — `expect(s.melhorias).toEqual({ laminasDeFibra: false, rastreamentoSolar: false, grade7x7: false })`. `normalizarMelhorias` (`save.ts:131`) itera `Object.keys(MELHORIAS)`, então **acrescentar qualquer melhoria da Era 2 quebra esses dois testes.**
- **Decisão proposta:** o passo 6 troca as duas asserções por `expect(s.melhorias).toEqual(melhoriasIniciais())`, que continua provando o que o teste quer provar (nada vem ligado de um save antigo) e não quebra na Era 3.

### 1.16 Pendências herdadas da Sessão 4
Do `ESTADO.md`: painéis assinam o `state` inteiro e re-renderizam a 10 Hz; o Bipe do entulho é a versão mínima em `Graphics`; o tremor da Cascata só aparece dentro do recorte do palco.
- **Decisão proposta:** **nenhuma delas entra.** A de re-render é a única que a Sessão 5 piora (mais peças na grade, mais linhas na Rede) — mas continua sendo otimização, não requisito. Fica registrada em "Pendências" e, se o Playwright do passo 14 mostrar queda de quadros, vira Sessão 6.

### 1.17 Ambiente
`node_modules/` não vem no clone. `npm install` roda limpo neste ambiente (verificado). O primeiro comando da sessão de execução é `npm install`.

---

## 2. Passos

Cada passo termina com um comando que prova que acabou. Onde diz `npm test && npm run typecheck`, os **dois** têm que passar — o `CLAUDE.md` cobra os dois a cada passo.

---

### Passo 1 — Contrato da Era 2 (documentos, zero código)

**Cria:** `docs/GDD-parte2.md`, `docs/sessoes/sessao-5.md`
**Altera:** `docs/GDD-parte1.md` (ponteiro na §8.4 + linha de versão v0.5)

`docs/GDD-parte2.md` — Era 2 no formato da §8, com:
- **§2.1 Estado inicial da Era 2:** o que entra, o que sai, o que carrega da Era 1.
- **§2.2 Rede:** tabela de usinas (nome, custo base, potência, desbloqueio) na escala ×100, mais o item de demanda ("Cidade", no lugar da Vila) e o banco de baterias. Preço base **0,1**.
- **§2.3 Núcleo — Reator PWR:** grade, peça central, tabela de peças com custo e função, definição dos anéis, e as **duas mecânicas novas**:
  - *esgotamento* — cada vareta tem `combustivelU` e queima a uma taxa; ao zerar, vira vareta gasta;
  - *calor de decaimento* — a vareta gasta injeta uma fração da entrada original, decaindo com meia-vida, **inclusive em SCRAM**.
- **§2.4 Equilíbrio:** a conta análoga à da §8.3, com a tabela de exemplos que o Vitest vai reproduzir (é isso que vira teste no passo 7 — a regra 2 do `CLAUDE.md`). Pelo menos: uma configuração na zona de ouro, uma no limite exato, uma que cascateia, e uma que **só** cascateia depois que o combustível acaba (o decaimento sozinho não dá conta da dissipação).
- **§2.5 Receita da Cascata na Era 2** (§5 diz que varia).
- **§2.6 Saída da Era 2** (fica declarada mesmo com a Era 3 fora de escopo).
- **§2.7 Transição de era:** o que exatamente carrega, zera ou some ao trocar de era (respostas às perguntas 3, 4, 5, 9).

`docs/sessoes/sessao-5.md` no formato da Sessão 4: Objetivo · Partes · Testes · Critérios de pronto · Fora de escopo · Armadilhas conhecidas.

**Testes:** nenhum (é documento).
**Prova:** `ls docs/GDD-parte2.md docs/sessoes/sessao-5.md` e leitura sua. **Este passo para e espera sua aprovação dos números antes do passo 2** — todo o resto do plano copia deles.
**Por que primeiro:** `CLAUDE.md` — "Se o design precisar mudar, edite o GDD primeiro e explique o porquê no commit". Sem isso os passos 6 e 7 inventam números, que é exatamente o que o contrato existe para impedir.

---

### Passo 2 — Registro de eras e `era` de verdade no estado e no save

**Cria:** `src/content/eras.ts`, `src/sim/__tests__/eras.test.ts`
**Altera:** `src/sim/state.ts`, `src/sim/save.ts`

- `content/eras.ts`: `export type EraId = 1 | 2` (a Era 2 já declarada, ainda sem conteúdo próprio) e `EraDef = { id, nome, cenario, economia, nucleo, pecas, ordemPecas, usinas, ordemUsinas, melhorias, ordemMelhorias, faixasCalor, cascata, rampa, modoSeguro, saida }`. `ERAS[1]` **aponta para os objetos que já existem** em `content/era1.ts` e `content/era1-nucleo.ts` — nenhum número se move, nenhum valor se duplica. `ERAS[2]` fica com um `TODO` explícito que o passo 6 preenche (ou, mais seguro, `ERAS` começa só com a Era 1 e o passo 6 adiciona a chave 2 — o `Record<EraId, EraDef>` obriga o compilador a cobrar).
- `state.ts`: `era: EraId`; `estadoInicial(era: EraId = 1)`.
- `save.ts`: `VERSAO_SAVE = 5`; `normalizar` valida `era` contra as chaves de `ERAS` (era desconhecida → 1) em vez do `era: 1` fixo de `:172`; migração `v4 → v5` acrescenta `era: 1` a quem não tiver.

**Testes novos (`eras.test.ts` e `save.test.ts`):**
- `ERAS[1].usinas` é o **mesmo objeto** que `USINAS` de `content/era1` (`toBe`, não `toEqual`) — prova que o registro não duplicou números;
- toda `EraDef` registrada tem `ordemUsinas`/`ordemPecas` cujos ids existem no respectivo `Record`;
- save v4 → v5 preserva Rede, Núcleo, melhorias e `cardsVistos`, e chega com `era: 1`;
- save com `era: 99` volta como 1;
- ida e volta de um estado com `era` preservando o campo.

**Prova:** `npm test && npm run typecheck`
**Depende de:** 1 (a forma de `EraDef` sai do contrato).

> **Nota sobre a v5:** os passos 2, 5 e 6 mexem todos na forma do save v5. Como nenhum save v5 sai deste repositório entre um passo e outro, a versão é bumpada **uma vez só**, no passo 2, e os passos seguintes estendem a normalização da mesma v5. O que precisa ficar estável desde o passo 2 é a migração **v4 → v5**, porque essa sim tem saves reais do outro lado.

---

### Passo 3 — Preço e economia por era no cálculo da Rede

**Altera:** `src/sim/rede.ts`, `src/sim/tick.ts`, `src/sim/offline.ts`, `src/sim/kardashev.ts`
**Altera testes:** `src/sim/__tests__/rede.test.ts` (acrescenta casos; os existentes ficam)

- `OpcoesBalanco` ganha `economia?: EconomiaDef` (padrão: a da Era 1). `balancoRede:189` e `passoRede:233` passam a ler `economia.precoBase`.
- `balancoDoEstado(state)` (`tick.ts:30`) passa `ERAS[state.era].economia`. Idem `offline.ts` e o `potenciaInstaladaW` do Kardashev (que só usa a oferta, mas passa a era pela mesma porta, para não haver dois caminhos).
- `demandaKw` (`rede.ts:44`) usa `VILA.demandaKw` importado direto: passa a ler o item de demanda da era.

**Testes novos:**
- mesma Rede, `precoBase: 0,1` → receita/s é exatamente 1/10 da com `precoBase: 1`;
- o multiplicador da faixa continua se aplicando por cima do preço da era (ouro ×1,25 sobre 0,1);
- um tick da Era 1 rende exatamente o que rendia antes (regressão explícita contra este passo).

**Prova:** `npm test && npm run typecheck`
**Depende de:** 2.
**Por que antes da Era 2:** se a Era 2 nascer com o preço da Era 1, o ritmo de ~60 min por era (§7) já sai errado do primeiro balanceamento e todos os números do passo 1 viram ruído.

---

### Passo 4 — Separar geometria de física no Núcleo

**Cria:** `src/sim/grade.ts`, `src/sim/nucleo/era1.ts`
**Altera:** `src/sim/nucleo.ts` (vira despachante), `src/sim/cascata.ts`, `src/sim/save.ts`, `src/scene/GridScene.ts` e `src/ui/PainelNucleo.tsx` (só caminhos de import)

- `sim/grade.ts` — o que serve a qualquer era: `indiceReceptor`, `ladoDaGrade`, `anel`, `adjacenteAoReceptor`, `podeColocar`, `colocar`, `podeRemover`, `remover`, `entulharAnel1`, `expandirGrade`. `podeColocar` deixa de importar `PECAS` e recebe a tabela de peças da era.
- `sim/nucleo/era1.ts` — a Torre Solar: `contar`, `espelhosEfetivos*`, `capacidadeU`, `balancoDeCalor`, `equilibrioU`, `potenciaNucleoKw`, `passoCalor`, `entradaDeCalor`.
- `sim/nucleo.ts` — `fisicaDaEra(era: EraId): FisicaNucleo` e **reexporta todos os nomes que exporta hoje**, com a implementação da Era 1 como padrão.

**Testes:** **nenhum teste novo, e nenhum teste alterado.** É esse o ponto: `nucleo.test.ts` (210 linhas) e `grade7.test.ts` (184 linhas) continuam importando de `../nucleo` e passando sem uma linha editada. Um refactor que precisa mexer nos testes não é um refactor.

**Prova:** `npm test && npm run typecheck` — e, especificamente, `git diff --stat src/sim/__tests__/` **vazio**.
**Depende de:** 2.
**Cuidado:** `save.ts:8` importa `anel` de `./nucleo`, e `nucleo.ts` passará a importar `ERAS`, que importa `content/era1*`, que importa tipos de `state.ts`. Se aparecer ciclo de import, `grade.ts` não importa `eras.ts` — quem precisa de conteúdo recebe por parâmetro. Vitest e Vite toleram bastante ciclo em ESM, mas um `const` lido no topo do módulo dentro de um ciclo vira `undefined` sem avisar; a regra deste passo é **nenhum acesso a conteúdo no escopo de módulo em `sim/`**.

---

### Passo 5 — Estado por peça na `Casa`

**Altera:** `src/sim/state.ts`, `src/sim/save.ts`, `src/sim/grade.ts`
**Altera testes:** `src/sim/__tests__/save.test.ts` (acrescenta casos)

- `Casa` vira `{ tipo: "peca"; id: PecaId; combustivelU?: number }`. O entulho ganha o mesmo campo, para a vareta gasta que virou entulho não ressuscitar cheia ao ser reconstruída.
- `colocar(grade, indice, pecaId, pecas)` inicializa `combustivelU` a partir da definição da peça, quando a peça tiver combustível.
- `normalizarCasa` (`save.ts:86`) preserva e sanitiza o campo (número finito ≥ 0, limitado ao máximo da peça).

**Testes novos:**
- peça sem combustível faz ida e volta sem ganhar o campo (a Era 1 não muda de forma);
- `combustivelU` negativo, `NaN` ou acima do máximo da peça é saneado na carga;
- reconstruir uma vareta gasta devolve a vareta com o combustível que ela tinha, não cheia.

**Prova:** `npm test && npm run typecheck`
**Depende de:** 2 e 4.

---

### Passo 6 — Conteúdo da Era 2 (só dados)

**Cria:** `src/content/era2.ts`, `src/content/era2-nucleo.ts`, `src/sim/__tests__/era2-conteudo.test.ts`
**Altera:** `src/sim/state.ts` (`UsinaId`, `PecaId`, `MelhoriaId` ganham os ids da Era 2), `src/content/eras.ts` (`ERAS[2]`), `src/sim/save.ts` (`IDS_USINA` → derivado), `src/sim/__tests__/save.test.ts:69` e `:139`

- Números todos vindos do passo 1. Nada de fórmula aqui: `CLAUDE.md` regra 3.
- `save.ts:80`: `IDS_USINA` deixa de ser lista literal e passa a sair das chaves da tabela de usinas de todas as eras. **É o item 1.6 — o único ponto do plano onde um esquecimento não daria erro de compilação.**
- `save.test.ts:69` e `:139`: as duas asserções `toEqual({ laminasDeFibra... })` viram `toEqual(melhoriasIniciais())`.

**Testes novos (`era2-conteudo.test.ts`):**
- todo id de `ordemPecas`/`ordemUsinas`/`ordemMelhorias` da Era 2 existe na tabela correspondente, e vice-versa (nada órfão, nada esquecido);
- toda peça da Era 2 declara pelo menos um anel válido para o lado inicial da grade da Era 2;
- os custos e potências da Era 2 batem com a tabela do `GDD-parte2.md` §2.2 e §2.3 — asserção literal, é o contrato virando teste;
- uma usina da Era 2 sobrevive a `exportarJson` → `importarJson` (o teste que pega o `IDS_USINA` esquecido).

**Prova:** `npm test && npm run typecheck`. Aqui o `typecheck` faz o trabalho pesado: ao abrir as uniões de id, ele lista `PECAS`, `USINAS`, `MELHORIAS`, `melhoriasIniciais()`, o literal de `estadoInicial()` e o `COR_FAIXA` — todo lugar que precisa de atenção.
**Depende de:** 1 (números) e 2 (registro).

---

### Passo 7 — Física da Era 2: esgotamento e calor de decaimento

**Cria:** `src/sim/nucleo/era2.ts`, `src/sim/__tests__/era2-nucleo.test.ts`
**Altera:** `src/sim/nucleo.ts` (registra a física da Era 2), `src/sim/nucleo/era1.ts` e `src/sim/tick.ts` (nova assinatura de `passoCalor`), `src/sim/offline.ts`
**Altera testes:** `src/sim/__tests__/nucleo.test.ts` e `tick.test.ts` (adaptar às novas assinaturas — **a única quebra intencional de teste do plano**)

- `passoCalor(...)` passa a devolver `{ grade, calorU }` em vez de `number` (item 1.9). A implementação da Era 1 devolve a grade intacta.
- `entradaDeCalor(grade, emScram)` por era: Era 1 → 0 em SCRAM; Era 2 → o decaimento continua (item 1.10).
- Era 2: cada vareta queima `taxaQueima × dt`; ao zerar `combustivelU` vira vareta gasta e passa a injetar `fracaoDecaimento` da entrada original, caindo por meia-vida a partir do instante do esgotamento. Barras de controle modulam a entrada das varetas vizinhas (não dissipam — é isso que as diferencia do trocador).
- `tick.ts:64-72` passa a guardar a grade devolvida; os `entradaUs`/`saidaUs` do card da Cascata saem de `entradaDeCalor` da era, não da conta de espelhos cravada em `:66-67`.

**Testes novos (`era2-nucleo.test.ts`) — as tabelas do `GDD-parte2.md` §2.4 viram Vitest, no espírito da regra 2 do `CLAUDE.md`:**
- uma vareta com `combustivelU = C` e taxa `q` esgota em exatamente `C / q` segundos de tick, nem um tick antes;
- vareta gasta injeta `fracaoDecaimento × entrada` no instante do esgotamento, e metade disso uma meia-vida depois;
- **em SCRAM, a entrada da Era 2 não é zero** (é o decaimento) — e a da Era 1 continua sendo;
- a configuração "zona de ouro" do §2.4 estabiliza na faixa de ouro e não cascateia no horizonte declarado;
- a configuração "cascateia só depois que o combustível acaba" **não** cascateia enquanto há combustível e **cascateia** depois — o exemplo que prova que o decaimento é mecânica, não enfeite;
- a Era 1 continua reproduzindo a tabela da §8.3 (h = 6 com 2 turbinas estabiliza em 100 % e não cascateia em 120 s; +1 espelho de anel 2 dispara a Cascata 5 s depois) — a regressão que protege tudo o que veio antes.

**Prova:** `npm test && npm run typecheck`
**Depende de:** 4, 5, 6.
**É o passo mais pesado da sessão.** Se algum passo for partido em dois commits, é este.

---

### Passo 8 — A transição de era no sim

**Cria:** `src/sim/eras.ts`, `src/sim/__tests__/transicao.test.ts`
**Altera:** `src/sim/state.ts` (`EventoJogo` ganha `{ tipo: "eraAvancada"; era: EraId }`), `src/sim/save.ts`

- `podeAvancarEra(state)`: Estabilidade ≥ 100 **e** 🔬 ≥ `saida.pesquisa` **e** ₵ ≥ `saida.creditos`, tudo lido de `ERAS[state.era].saida` (Era 1: 100 % / 3 000 / 50 000, GDD §8.4).
- `avancarEra(state)`: cobra os ₵, troca `era`, monta o Núcleo da era nova, aplica as decisões das perguntas 3/4/5/9, preserva 🔬 e `cardsVistos`, emite o evento.

**Testes novos:**
- falta qualquer um dos três requisitos → `null` (um teste por requisito, no limite exato);
- com os três → `era = 2`, ₵ debitados **uma vez**, 🔬 preservado, Estabilidade conforme a decisão da pergunta 4;
- avançar duas vezes seguidas não passa da Era 2 (não há Era 3);
- save/carga na Era 2 preserva era, grade e combustível das varetas;
- o evento `eraAvancada` aparece exatamente uma vez.

**Prova:** `npm test && npm run typecheck`
**Depende de:** 6, 7.

---

### Passo 9 — Store e UI: botão de era, listas por era

**Cria:** `src/ui/PainelEra.tsx`
**Altera:** `src/store/gameStore.ts`, `src/ui/PainelRede.tsx`, `src/ui/PainelNucleo.tsx`, `src/ui/Hud.tsx`, `src/App.tsx`, `src/ui/app.css`
**Altera testes:** `src/store/gameStore.test.ts`

- Store: ação `avancarEra`.
- `PainelRede` e `PainelNucleo` leem `ORDEM_*` e as tabelas de `ERAS[state.era]` em vez de importar `content/era1*` direto (item 1.12).
- `PainelEra`: os três requisitos com o progresso de cada um (`🛡 100 % · 🔬 2 140/3 000 · ₵ 12,4 mil/50 mil`) e o botão, com o brilho da §10 só quando os três estão cumpridos — a quarta e última exceção da regra "glow só em três lugares" do `ESTADO.md`, a registrar lá.
- O Hud mostra a era corrente.

**Testes novos (`gameStore.test.ts`):**
- `avancarEra` pela store muda o estado e enfileira o card de abertura da Era 2;
- com requisitos faltando, a ação devolve `false` e não altera nada;
- a lista da Rede na Era 2 traz as usinas da Era 2 (asserção sobre o que `ORDEM_USINAS` da era devolve, não sobre DOM).

**Prova:** `npm test && npm run typecheck`
**Depende de:** 8.

---

### Passo 10 — Cards da Era 2

**Cria:** `src/content/cards-era2.ts`, `src/sim/__tests__/cards.test.ts`
**Altera:** `src/content/cards-era1.ts` (`cardParaEvento` fica só com a Era 1), `src/content/eras.ts` (`EraDef.cards`), `src/store/gameStore.ts:8,104`, `src/ui/CardExplicativo.tsx:1,18`

- Abertura da Era 2 em 3 telas (texto na §2.7 do `GDD-parte2.md`, escrito no passo 1 — de kW para MW; o que é calor de decaimento e por que a física real cobra isso; o que muda na Cascata).
- Card do primeiro esgotamento de vareta.
- `cardParaEvento(evento, era)`: a tabela evento → card passa a ser por era, uma só por era (item 1.12). O `store` e o `CardExplicativo` param de importar `CARDS_ERA1` e passam a resolver pela era corrente.

**Testes novos:**
- `cardParaEvento` da Era 1 devolve exatamente o que devolvia (regressão);
- `primeiraCompra` de uma peça da Era 2 não acha um card da Era 1 com o mesmo gatilho;
- `eraAvancada` → abertura da Era 2;
- cada card registrado tem `telas` não vazias e todo `{placeholder}` de texto tem quem o preencha.

**Prova:** `npm test && npm run typecheck`
**Depende de:** 8, 9.

---

### Passo 11 — Arte da Era 2 na grade e paleta por era

**Cria:** `src/scene/pecas/era1.ts`, `src/scene/pecas/era2.ts`
**Altera:** `src/scene/GridScene.ts`, `src/scene/rampa.ts`, `src/ui/tokens.css`, `src/ui/app.css`, `src/ui/Hud.tsx`, `src/App.tsx`

- O `switch` de desenho (`GridScene.ts:296-310`) e o `consumoPorTurbina` cravado (`:222`) passam por um mapa de desenhistas por era; as funções da Era 1 saem de dentro do `GridScene` intactas, só mudam de arquivo.
- Peças da Era 2, no vocabulário da §10 (formas simples, sem contorno preto, sombra chapada 4 px, cor comunica estado): vareta com o nível de combustível visível no próprio corpo, vareta gasta em tom apagado com o brilho do decaimento, barra de controle descendo entre as varetas, trocador, gerador de vapor.
- `--era-primaria` / `--era-secundaria` nos tokens, definidos por `[data-era]`, com o atributo no `.app`. `--coral` (alerta) e `--leaf` (positivo) **não** mudam com a era: são semânticos.
- `scene/rampa.ts` recebe a rampa por parâmetro em vez de importar `RAMPA_CALOR` (item 1.14).

**Testes novos:**
- `src/scene/rampa.test.ts` (novo): a rampa da Era 2 interpola as paradas dela; a rampa da Era 1 devolve exatamente as cores de hoje.
O resto deste passo é visual e se prova no passo 14.

**Prova:** `npm test && npm run typecheck` + `npm run build`
**Depende de:** 6, 7, 9.

---

### Passo 12 — Transição visual: zoom cósmico de 3 s

**Altera:** `src/scene/BackgroundScene.ts`, `src/scene/GameCanvas.tsx`, `src/store/gameStore.ts`, `src/ui/app.css`

- `BackgroundScene` ganha um cenário por era (Era 1 colina, Era 2 cidade e rio — vetorial, no espírito da §10) e um tween de 3 s de afastamento de câmera disparado pelo evento `eraAvancada`, com a paleta trocando durante o movimento (GDD §6, §10).
- `prefers-reduced-motion` corta o tween e faz o corte seco — a mesma regra que a Sessão 4 aplicou a partículas, giro, pulso e tremor.
- A transição **não** pausa o sim (só o card de abertura pausa, e o card de abertura da Era 2 vem depois dela).

**Testes:** nenhum unitário (é Phaser e tempo). Prova no passo 14.
**Prova:** `npm run build` e a captura do passo 14.
**Depende de:** 8, 11.

---

### Passo 13 — Offline na Era 2

**Altera:** `src/sim/offline.ts`
**Altera testes:** `src/sim/__tests__/offline.test.ts` (acrescenta bloco da Era 2; os 8 casos da Era 1 ficam)

O modelo de hoje — congelar `Q*` e multiplicar pelo tempo (`offline.ts:46-60`) — não vale na Era 2, porque o combustível acaba no meio da janela (item 1.10). Proposta: a Era 2 integra em passos grossos (um passo por minuto simulado, teto de 8 h = 480 passos, barato) sobre a mesma física do passo 7, mantendo as regras da §7 que não mudam: modo seguro obrigatório, ×0,7, nunca cascateia, Rede sem bateria e ×0,5.
O relatório "Enquanto você esteve fora" ganha a linha "as varetas acabaram depois de X min" quando for o caso.

**Testes novos:**
- 8 h offline com combustível para 30 min → créditos e 🔬 de ~30 min de produção mais o rabo do decaimento, não de 8 h;
- a Era 1 offline continua batendo os valores de hoje, ao centavo (é o que os 8 testes existentes já cobram — este passo não pode movê-los);
- nunca há Cascata offline, mesmo com a configuração que cascateia acordado;
- ao voltar, `Q` respeita o teto de 95 % da capacidade.

**Prova:** `npm test && npm run typecheck`
**Depende de:** 7.

---

### Passo 14 — Verificação no navegador e fechamento

**Altera:** `docs/ESTADO.md`, `docs/sessoes/sessao-5.md` (checklist)

- Playwright + Chromium em 1280×800 e 390×844, como na Sessão 4: chegar à Era 2 por save montado, conferir a transição de 3 s, a paleta nova, as peças novas, o esgotamento de uma vareta com o card, o decaimento visível em SCRAM, os requisitos do `PainelEra` e a ordem mobile.
- `docs/ESTADO.md`: seção da Sessão 5, decisões que o GDD não fixava, pendências.

**Prova:** `npm test && npm run typecheck && npm run build`, mais as capturas.
**Depende de:** todos.

---

## 3. Ordem e dependências

```
1 contrato (BLOQUEIA TUDO — aprovação sua)
└─ 2 registro de eras + era no save
   ├─ 3 preço por era ──────────────┐
   └─ 4 geometria × física          │
      └─ 5 estado por peça          │
         └─ 6 conteúdo da Era 2 ◄───┘   (6 precisa dos números do 1)
            └─ 7 física da Era 2  ← o passo pesado
               ├─ 8 transição no sim
               │  └─ 9 store e UI
               │     ├─ 10 cards da Era 2
               │     └─ 11 arte e paleta
               │        └─ 12 zoom cósmico
               └─ 13 offline na Era 2
                              └─ 14 navegador e ESTADO.md
```

O raciocínio da ordem, em uma linha cada:

- **1 antes de tudo** porque `CLAUDE.md` manda editar o GDD primeiro, e porque os passos 6 e 7 são cópia dos números dele.
- **2 antes de 3–6** porque `EraId` e `ERAS` são a porta por onde todo o resto lê conteúdo.
- **3 cedo, e sozinho,** porque muda dinheiro: se entrar depois do conteúdo da Era 2, todo balanceamento feito até ali estará 10× errado e terá de ser refeito.
- **4 antes de 5 e 6** porque é o único refactor de risco puro (zero comportamento novo). Fazê-lo num passo em que os testes não podem mudar é o que garante que ele não escondeu regressão. Se vier depois da Era 2, some no meio do ruído.
- **5 antes de 6** porque as peças da Era 2 declaram combustível, e o campo precisa existir antes de alguém declarar.
- **6 antes de 7** porque separa dado de regra — e porque abrir as uniões de id no 6 faz o `typecheck` listar, de graça, todos os lugares que o 7 vai visitar.
- **7 antes de 8** porque não faz sentido dar ao jogador um botão para uma era que ainda não simula.
- **8 antes de 9** porque a UI só espelha o que o sim já resolve (`CLAUDE.md` regra 4).
- **10, 11 e 12 depois de 9** porque cards, arte e câmera consomem o evento `eraAvancada`, que nasce no 8 e chega à UI no 9. **12 depois de 11** porque o zoom cósmico troca a paleta, que só existe a partir do 11.
- **13 pendurado no 7, não no fim,** porque é a mesma física; fica separado só para não inchar o 7, e pode ser feito em paralelo com 9–12.
- **14 por último** por definição.

**Onde dá para paralelizar,** se a sessão apertar: 3 é independente de 4/5; 13 é independente de 9–12.

---

## 4. Riscos

### R1 — O passo 4 quebra os 235 testes de uma vez
O maior risco do plano: mover `contar`, `balancoDeCalor`, `equilibrioU`, `potenciaNucleoKw` e `capacidadeU` para outro arquivo enquanto 10 módulos e 5 arquivos de teste importam de `sim/nucleo`.
**Como o passo lida:** `sim/nucleo.ts` continua exportando **exatamente** os mesmos nomes, agora por reexport. O critério de pronto do passo é `git diff --stat src/sim/__tests__/` vazio — se um teste precisou mudar, o refactor mudou comportamento e volta atrás.

### R2 — Ciclo de import entre `sim/` e `content/`
`nucleo.ts` passa a precisar de `ERAS`; `ERAS` importa `content/era1*`; `content/era1*` importa tipos de `state.ts`; `state.ts` já importa `ECONOMIA` e `NUCLEO` (`state.ts:2-3`). Um ciclo aqui não dá erro: dá `undefined` no escopo de módulo, em silêncio, e alguns testes passam.
**Como o passo lida:** regra dura no passo 4 — **nenhum módulo de `sim/` lê conteúdo no escopo de módulo**; conteúdo chega por parâmetro ou por chamada de função dentro do corpo. `grade.ts` não importa `eras.ts` de jeito nenhum. E o passo 2 aproveita para tirar os imports de conteúdo do topo de `state.ts`, passando `ECONOMIA.creditosIniciais` e `NUCLEO.ladoInicial` para dentro de `estadoInicial()`/`gradeVazia()`.

### R3 — Mudar a assinatura de `passoCalor` (passo 7)
É a única quebra intencional de teste do plano: `nucleo.test.ts` e `tick.test.ts` chamam `passoCalor` esperando `number`.
**Como o passo lida:** a mudança e a adaptação dos testes vão no **mesmo commit**, e as asserções sobre o valor do calor continuam idênticas — muda só `passoCalor(...)` para `passoCalor(...).calorU`. Nenhum número esperado muda. Um teste cujo valor esperado mudou neste passo é sinal de regressão, não de adaptação.

### R4 — Abrir `PecaId`/`UsinaId`/`MelhoriaId` (passo 6)
Quebra `PECAS`, `USINAS`, `MELHORIAS`, `melhoriasIniciais()`, o literal de `estadoInicial()` e `COR_FAIXA` de uma vez.
**Como o passo lida:** isso é o mecanismo, não o acidente — `npm run typecheck` vira a checklist do passo. **O único ponto que o compilador não pega é `save.ts:80` (`IDS_USINA`, lista literal), e por isso o passo 6 tem um teste dedicado**: gravar e recarregar uma usina da Era 2 e conferir a quantidade.

### R5 — Os dois testes que assertam o objeto de melhorias inteiro
`save.test.ts:69` e `:139` quebram no instante em que a Era 2 declara uma melhoria.
**Como o passo lida:** o passo 6 troca as duas por `toEqual(melhoriasIniciais())`, no mesmo commit que abre as uniões.

### R6 — Balanceamento da Era 2 sair errado
O plano fixa números no passo 1 e só os exercita de verdade no 7. Se a Era 2 fechar em 20 min ou 3 h em vez de ~60 (§7), a correção volta ao passo 1.
**Como o passo lida:** as configurações-alvo da §2.4 viram teste no passo 7 (zona de ouro, limite exato, cascata, cascata-só-depois-do-esgotamento). Elas não provam o ritmo, mas prendem os pontos de operação; o ritmo se confere na mão no passo 14, e se estiver fora, o ajuste é de dado em `content/era2*` mais uma correção no `GDD-parte2.md` — nunca só no código.

### R7 — Custo de re-render da UI (pendência da Sessão 4)
Os painéis assinam o `state` inteiro e re-renderizam a 10 Hz. A Era 2 traz mais linhas na Rede e potencialmente mais casas na grade.
**Como o passo lida:** não entra no escopo. O passo 14 mede; se o mobile cair de quadros, vira item de Sessão 6, não desvio desta.

### R8 — A sessão é maior do que a Sessão 4
14 passos, sendo 7 deles no sim, mais um passe de arte e uma transição animada. A Sessão 4 tinha 4 partes e já foi longa.
**Como o plano lida:** existe uma linha de corte natural depois do passo 10 — passos 1–10 e 13 entregam a **Era 2 jogável** (transição, fissão, esgotamento, decaimento, cards, offline) com a arte da Era 1 reaproveitada; 11, 12 e 14 são o passe de arte e o zoom cósmico. **Ver pergunta 8.**

---

## 5. Perguntas — só você responde

1. **Onde vai o contrato da Era 2?** Proponho `docs/GDD-parte2.md` novo (Era 2 agora, Eras 3–6 depois), com o `GDD-parte1.md` ganhando só um ponteiro na §8.4. A alternativa é uma §8.5 dentro da Parte 1. Prefiro o arquivo novo porque a Parte 1 já está fechada em v0.4 e o próprio documento anuncia a Parte 2.

2. **Os números da Era 2 saem de mim ou de você?** Proponho: no passo 1 eu escrevo uma tabela completa (usinas, custos, potências, peças, capacidades, taxas de queima, meia-vida do decaimento) derivada das duas âncoras que o GDD §7 dá — potência ×100 e preço ×0,1 — e **paro para você aprovar antes do passo 2**. Se você já tem os números, me passe e o passo 1 vira só transcrição.

3. **O que acontece com a Rede da Era 1 ao entrar na Era 2?** O GDD §6 só diz que a era nova traz "novas usinas na lista". Três saídas:
   (a) as usinas da Era 1 continuam na lista, comprávelis e produzindo (ficam irrelevantes por escala);
   (b) somem da lista mas a potência delas continua somando como "legado";
   (c) são zeradas na transição.
   Proponho **(a)**: é o mais honesto com um idle, não joga fora nada que o jogador comprou, e a irrelevância por escala é justamente o que a §7 ("×100 por era") já cobra. Mas (a) deixa a lista comprida, e o `ESTADO.md` já registra que a lista re-renderiza a 10 Hz.

4. **A Estabilidade zera ao entrar na Era 2?** Proponho **zerar**. Sem isso a Era 2 nasce com um dos três requisitos da Era 3 já cumprido, e a §6 ("Estabilidade sobe enquanto o Núcleo opera... chega a 100 % → habilita a próxima era") só faz sentido se ela recomeçar. O GDD não diz.

5. **A grade da Era 2 recomeça no 5×5?** Ou seja: a Grade 7×7 (₵ 800 + 🔬 150), comprada na Era 1, vale para o reator da Era 2? Proponho **recomeçar no lado inicial da Era 2** e a expansão da Era 2 ser uma melhoria própria — o Núcleo é outro prédio, e reaproveitar a melhoria entrega o último upgrade da Era 1 de graça no começo da Era 2.

6. **A vareta gasta some sozinha ou o jogador tira?** Proponho **o jogador tira à mão**: ela continua esquentando (decaimento), ocupa a casa, e você precisa decidir quando parar o reator para trocar — isso é a tensão da era, e é o que a §6 quer dizer com "peças gastas continuam quentes". A alternativa (some sozinha ao esfriar) é mais gentil e vira uma era sem decisão.

7. **O combustível esgota offline?** Proponho **sim**, com o relatório dizendo "as varetas acabaram depois de X min". A §7 diz que offline "nada é comprado" e "nunca há Cascata", mas não fala de esgotamento. Se o combustível **não** esgotar offline, 8 h offline viram produção infinita de graça e a mecânica da era não existe fora da aba aberta.

8. **Corto a sessão?** Passos 1–10 e 13 entregam a Era 2 jogável reaproveitando a arte da Era 1; 11, 12 e 14 são a arte da Era 2, o zoom cósmico e a verificação. Faço a sessão inteira, ou fecho em 1–10+13 e o passe de arte vira Sessão 5b (que é como a Sessão 4 se organizou — mecânica primeiro, arte depois)?

9. **O Núcleo da Era 2 vem desbloqueado?** Na Era 1 o Núcleo custa ₵ 100 à parte (§8.3). Proponho que na Era 2 ele venha montado e vazio junto com a era, já que a transição cobra ₵ 50 000. Sem isso o jogador troca de era e cai numa tela vazia com outro botão de compra.

10. **Som continua fora?** A §13 do GDD ainda lista "som e música: no MVP ou só no final?" como pergunta aberta, e a §12 só coloca som na faixa 7–9. Estou tratando como **fora desta sessão** — confirma?
