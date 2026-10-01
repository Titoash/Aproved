# Relatório da Sessão 10 — Ocorrências: a espera vira operação (v0.9)

Branch `claude/adoring-fermat-wnbjgz`, a partir de `8eeb972` (o último commit da Sessão 9). Especificação: `docs/sessoes/sessao-10.md`, com o GDD v0.9 revisado.

**Branch.** `docs/PRODUCAO.md` manda produzir em `claude/sessao-10` a partir do branch principal. Esta sessão só pode fazer push em `claude/adoring-fermat-wnbjgz`, e o autor mandou começar com o PR da Sessão 9 ([Titoash/Aproved#1](https://github.com/Titoash/Aproved/pull/1)) ainda aberto. Por isso a Sessão 10 entrou no mesmo branch, em commits próprios depois de `8eeb972`. Se a gestão quiser revisar as duas sessões separadas, basta abrir um branch a partir de `8eeb972`.

## 1. Plano

1. **Parte 0:** não existe `docs/sessoes/sessao-9-ajustes.md`. Nada foi aplicado, e as seis decisões da Sessão 9 em `ESTADO.md` ficaram como estavam. O autor mandou começar sem ajustes.
2. **B:** Estabilidade em 1,8/1,2 e `content/ocorrencias.ts`.
3. **A:** multiplicadores no motor (injeção ativa separada do decaimento), `sim/ocorrencias.ts` e save v10.
4. **C:** testes das duas tabelas e o teste obrigatório.
5. **D:** interface nos dois tamanhos.
6. **E:** cena.
7. **F:** rota operador e balanceamento.
8. **G:** verificação.

A ordem de corte era: cena da parte E, depois o Céu limpo e frio, depois o Seguimento de carga. **Nada foi cortado.**

## 2. O que foi feito

- **Estabilidade** em +1,8/min no ouro e +1,2/min fora dele (`content/era1-nucleo.ts`). Vale também offline, com o fator ×0,7.
- **`content/ocorrencias.ts`:**
  - as seis Ocorrências, cada uma com perturbação, perfil, exigência, meta e frase de física;
  - as regras comuns: intervalo de 4 min, janela de 60 s, meta de 75 %, recompensa (+3 ou 60 s de 🔬), alvo de 80 % e semente;
  - os controles: carga das turbinas de 50 a 150 % e barras de 50 a 125 %.
- **Motor (`sim/motor.ts`, `sim/reator.ts`):**
  - `MultiplicadoresMotor` sobre a entrada, a dissipação e o fator das turbinas;
  - o `MotorCalor` ganha `entradaAtivaUs` e `decaimentoUs`;
  - na Era 2, barras e Xenônio multiplicam só a injeção das varetas ativas.
  - Nenhuma fórmula mudou: sem Ocorrência os multiplicadores são 1.
- **`sim/ocorrencias.ts`:**
  - o relógio (acumulador de tempo de tick);
  - o sorteio determinístico entre as Ocorrências que a grade atende e pode ganhar;
  - a primeira oferta do save (Nuvem, ou Xenônio na Era 2) e o Xenônio depois de um SCRAM da Era 2;
  - o bloqueio em SCRAM, sem turbina ou com o Núcleo desligado;
  - as ações aceitar, ajustar o controle, recusar e escolher a recompensa;
  - a meta no tick: Cascata ou SCRAM reprovam;
  - a recompensa, o descarte ao carregar e o resumo para a interface;
  - `controleQueCompensa`, usado pela rota operador e pelos testes.
- **Tick:** a perturbação e o controle entram nos passos 1 e 4; as Ocorrências viram o passo 7, antes dos capítulos.
- **Offline:** descarta a oferta e a Ocorrência em curso. O relógio não anda.
- **Save v10** com migração v9 → v10.
- **Interface:**
  - cartão sobre o pé do tabuleiro, com oferta, Ocorrência em curso e escolha da recompensa;
  - controle grande: horizontal para a carga, vertical com o ícone das barras;
  - faixa-alvo e marca de Q* viva na barra de calor;
  - barra de potência no Seguimento;
  - 🔥 do HUD pulsando e virando botão;
  - "🛡 +3" ao lado da Estabilidade;
  - diário (oferta, resultado, recompensa) e card "Ocorrências" (2 telas, com Bipe).
- **Cena:**
  - sombra da nuvem atravessando o campo, com os feixes esmaecendo;
  - céu um tom mais claro;
  - a primeira turbina girando pela metade;
  - na Era 2, as barras saindo do topo do Vaso e subindo ou descendo com a potência.
- **Simulação:** rota operador; corrida e cidade recusam toda oferta; minutos com Ocorrência em curso não contam como parados.
- **Defeito da Sessão 8 corrigido no caminho:** `CardExplicativo` lia só `CARDS_ERA1`. Os cards da Era 2 (Calor de decaimento, Vareta gasta, SCRAM) abriam invisíveis e travavam a fila dos seguintes. Corrigido em `fe6c37c` e verificado no roteiro.

## 3. Decisões fora do GDD

Todas foram registradas na Parte 1 §4.4 como "leituras da Sessão 10, a confirmar pela gestão".

1. **O relógio dos 4 min só anda com o Núcleo desbloqueado.** Contar desde o começo faria a primeira oferta sair junto com a primeira turbina.
2. **"Núcleo desligado" é o Núcleo sem calor líquido** (equilíbrio zero). Fora SCRAM e falta de turbina, é o que sobra da lista de bloqueio.
3. **"Só se oferece o que se pode ganhar":** no platô da perturbação, o controle que mira 80 % de T (ou 70 % da potência), limitado aos extremos, tem de deixar o equilíbrio dentro da meta.
4. **A primeira oferta e o Xenônio depois de um SCRAM são preferências.** Se a grade não pode ganhá-los, sai o sorteio normal, e a marca se consome do mesmo jeito.
5. **A meta de potência usa a potência bruta**, sem o ×0,7 do modo seguro. Senão, ligar o modo seguro cumpria o Seguimento de carga sozinho.
6. **A 🔬 da recompensa é calculada no instante em que a Ocorrência é superada** e fica guardada até a escolha. A escolha pendente vai para o save (já foi ganha) e segura o relógio ("uma por vez").
7. **O card "Ocorrências" pausa o jogo**, como a abertura: ele chega com a janela de 60 s correndo.
8. **Mudar de era no meio de uma oferta ou Ocorrência a descarta**, sem recompensa.
9. **"1 ÷ multiplicador" virou "o controle que devolve o Q* de antes".**
   - Sem radiador e sem decaimento, as duas coisas são iguais.
   - Com radiadores (Era 1) ou decaimento e torres (Era 2), 1 ÷ multiplicador erra o alvo. A forma exata é `(E·m − D) ÷ (E − D)`.
   - A rota operador e os testes usam a forma exata.
   - Se o Q* de antes não estava no ouro, o alvo é 80 %.
10. **Onde fica o cartão.** No desktop o painel do Núcleo tem ≈ 160 px de altura visível, e o controle não caberia ali com a barra de calor à vista. Por isso o cartão fica sobre o pé do tabuleiro, ainda dentro da coluna do Núcleo, com a barra de calor logo abaixo nos dois tamanhos.
    - Aceitar enquadra o Núcleo no terço de cima do tabuleiro (preset novo da câmera), para a cena da perturbação ficar à vista.
    - Tocar no 🔥 rola até o cartão e põe o foco em "Aceitar". A rolagem é instantânea, como em `rolarParaOTabuleiro`.
11. **Cena.** Na meia carga gira pela metade a primeira turbina da grade. Na Era 2 as barras aparecem durante qualquer Ocorrência, inclusive no Seguimento de carga, que não perturba o motor mas é operado pelas barras.

## 4. Medições

### 4.1 Simulação (`npm run simular`, três rotas, Estabilidade 1,8/1,2)

| | corrida (recusa) | cidade (recusa) | operador |
|---|---|---|---|
| Era 1 fecha em | 56,9 min | 57,6 min | **43,0 min** |
| Era 1 parada (maior janela) | 6 de 58 min (2) | 8 de 58 min (3) | 3 de 43 min (3) |
| Era 1: Ocorrências | 14 recusadas | 14 recusadas | 9/9 superadas, 🛡 9× |
| Era 2 fecha em | 57,8 min | 67,0 min | **47,3 min** |
| Era 2 parada (maior janela) | 6 de 58 min (2) | 27 de 67 min (4) | 3 de 48 min (3) |
| Era 2: Ocorrências | 19 recusadas | 19 recusadas | 15/15 superadas, 🛡 14×, 🔬 1× |
| potência / população no fim | 166 MW / 5,7 mi | 110 MW / 5,5 mi | 60 MW / 301 mil |
| receita líquida negativa | 0 min | 0 min | 0 min |

As metas de Parte 1 §7 fecharam sem calibrar nada:
- 50–70 min recusando as Ocorrências;
- 40–50 min operando;
- nenhuma janela parada de mais de 5 min na rota operador.

A barra da Era 1 enche aos 43,0 min jogando e aos 56,9 deixando rodar. A conta do GDD dava ≈ 42 e ≈ 56.

Por Ocorrência, na rota operador:

| Ocorrência | Superadas / oferecidas |
|---|---|
| Nuvem | 3/3 |
| Céu limpo e frio | 4/4 |
| Turbina em meia carga (Era 1) | 2/2 |
| Xenônio | 6/6 |
| Seguimento de carga | 5/5 |
| Turbina em meia carga (Era 2) | 4/4 |

### 4.2 As janelas de `correcoes-gdd-v0.9.md`, medidas de novo

A medida da v0.9 tinha ≈ 36 de ≈ 105 minutos parados, em cinco janelas, sobre o código da Sessão 8. Agora:

| Rota | Era 1 | Era 2 | Total parado |
|---|---|---|---|
| corrida | min 4–6, 15–17 (🔬) e 29–31 (🛡) | min 1–3, 5–7 e 20–22 (🔬) | 12 de 116 min |
| cidade | min 7–10 (🔬), 30–32 (₵) e 52–55 (🛡) | dez janelas de 2–4 min (🔬 até o min 20, ₵ depois) | 35 de 125 min |
| operador | min 39–42 (🛡) | min 44–47 (🔬) | 6 de 91 min |

A janela "min 40–44, tudo parado esperando a barra" da v0.9 virou, na rota operador, uma de 3 min no fim da Era 1.

A rota cidade continua a mais parada no começo da Era 2: ela junta ₵ e 🔬 para levar a cidade inteira à megacidade (pendência da Sessão 9). Mesmo assim, nenhuma janela passa de 4 min.

### 4.3 Desempenho (`scripts/e2e/perf-cena.cjs`)

O roteiro ganhou duas medidas, as duas no mundo cheio com 6 Bipes:
- `quadroOcorrencia`: o enquadramento do aceite sem Ocorrência;
- `ocorrencia`: o mesmo enquadramento com a Nuvem em curso.

Medianas de três rodadas, em ms por quadro, com o Chromium por software do ambiente:

| | ilha | nucleo | enquadramento do aceite | com a Nuvem |
|---|---|---|---|---|
| desktop | 3,35 | 4,34 | 6,55 | 6,77 |
| celular | 3,54 | 3,52 | 4,91 | 4,98 |

- **O efeito da Ocorrência custa +0,22 ms no desktop e +0,07 ms no celular.** É a sombra da nuvem: três elipses por quadro. O teto de §10.1 é +3 ms.
- **O enquadramento do aceite custa mais que o "nucleo".** O zoom 1 mostra mais mundo no LOD de perto, o mesmo custo de o jogador chegar a esse zoom à mão.

### 4.4 Verificação

- `npm run typecheck`, `npm run lint` e `npm run build` passam.
- `npm test`: **554 testes**, 52 a mais que na Sessão 9.
- `scripts/e2e/sessao-10.cjs`: **82 verificações** nos dois tamanhos (1280×800 e 390×844 com toque), capturas em `docs/capturas/sessao-10/`.
  - No celular o arrasto do controle é um toque de verdade (CDP).
  - O roteiro rodou três vezes seguidas depois do "operador" dentro da página.
- **Regressões, com as capturas fora do repositório:**

  | Roteiro | Verificações |
  |---|---|
  | 6 | 52 |
  | 7 | 76 |
  | 8 | 82 |
  | 9 | 52 |

  Todas verdes.
- **Um alarme falso:** o teste de tempo da análise do mundo cheio (`desempenho.test.ts`, < 16 ms) falhou uma vez rodando junto com as regressões, com o Chromium a 300 % de CPU. Sozinho e na suíte inteira com a máquina livre, passa. A Sessão 10 não toca na análise do mundo.

## 5. Conflitos com o GDD

1. **A "Onda de calor" (Parte 2 §5.4) atingiu a condição de volta.**
   - O GDD diz que ela volta "se a simulação da Sessão 10 mostrar grades com torre acima de 77 %".
   - As rotas cidade e operador terminam a Era 2 com 1 torre e `T*` de 84 % e 81 % (com piscina).
   - Não entrou: seria uma sétima Ocorrência sem linha na tabela, e os números dela são da gestão.
   - Proposta: torre ×0,5 por 45 s, exigindo 1 torre, com resposta pelas barras.
2. **"1 ÷ multiplicador" da especificação (parte F)** só vale sem radiador e sem decaimento. A rota operador usa a forma exata (decisão 9).

## 6. O que a gestão deve verificar primeiro

1. **O cartão sobre o pé do tabuleiro (decisão 10).** É a maior escolha de interface da sessão.
   - Capturas: `docs/capturas/sessao-10/*-02-oferta.png`, `*-03-ativa.png` e `*-06-xenonio.png`.
2. **O ritmo** (§4.1): 43 e 47 min operando, 57 e 58 min recusando na corrida.
3. **As leituras 1, 5 e 6 da seção 3**, que mudam o jogo sentido: relógio só com o Núcleo, potência bruta na meta e recompensa guardada.
4. **A Onda de calor** (§5).

## 7. Pendências

- **Onda de calor** (Parte 2 §5.4): condição atingida, decisão da gestão.
- **A rota operador fecha com a cidade pequena** (Vila na saída da Era 1). Na simulação, operar troca crescimento por tempo. Só o playtest diz se a primeira era fica rápida demais para quem joga tudo.
- **O roteiro e2e da Sessão 10 joga contra o relógio real:**
  - o jogo anda em tempo real entre os passos do Playwright;
  - o roteiro liga um "operador" dentro da página enquanto confere e captura;
  - as comparações de antes e depois são feitas no mesmo instante, dentro da página.
- **A rota cidade na Era 2** continua com 27 minutos parados em janelas curtas (pendência da Sessão 9).
- As pendências anteriores continuam como estavam em `docs/ESTADO.md`.
