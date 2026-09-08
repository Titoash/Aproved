# KARDASHEV (codinome) — Documento de Design v0.3 · Parte 1 de 2

> Parte 1: conceito, os três sistemas, Cascata, economia, Era 1 completa, direção de arte, arquitetura e roteiro de sessões.
> Parte 2 (próximo passo): Eras 2–6 detalhadas, prestígio, roteiro dos cards explicativos.

---

## 1. Conceito em uma frase

Você começa com cata-ventos numa colina e termina cercando uma estrela. Um idle de gerenciamento de energia em duas camadas: a **Rede** (lista de usinas, números) e o **Núcleo** (grade de peças, geometria). Três balanças precisam ficar na faixa; sair dela dispara uma **Cascata**, que não encerra o jogo, mas faz você **voltar uma etapa**.

**Referências:** Reactor – Energy Sector Tycoon (usinas, calor que vira energia ou explode, pesquisa, novos locais) · estética flat-vector de infográfico científico, cores saturadas sobre fundo escuro (mascotes e identidade originais).

**Plataforma:** web (Vite + React + TypeScript + Phaser 3), desktop e mobile-first no navegador. Save local com exportação.

---

## 2. As duas camadas

### 2.1 Rede (lista) — escala e dinheiro
Lista de usinas com botão de comprar e melhorar. Produz **potência** (kW) de forma passiva. Aqui vive a balança **Oferta × Demanda**. Idle-friendly: roda sozinha, cresce com dinheiro.

### 2.2 Núcleo (grade) — risco e pesquisa
Um tabuleiro por era com a usina crítica da época (Torre Solar → Reator de fissão → Tokamak → Anel de antimatéria → Reator de buraco negro → Enxame de Dyson). A **posição importa**: peças trocam calor com vizinhas. Aqui vivem as balanças **Calor** e, a partir da Era 3, **Contenção**. É a **única fonte de Pesquisa** e o único lugar onde a Cascata acontece.

### 2.3 Acoplamento entre camadas (o que faz o híbrido valer)
- O Núcleo gera Pesquisa; Pesquisa desbloqueia usinas da Rede e a próxima era. Sem Núcleo bem operado, a Rede estagna.
- A partir da Era 3 o Núcleo **consome potência da Rede** para a contenção. Apagão na Rede → contenção cai → Cascata. A balança "tranquila" passa a ter dentes.
- O Núcleo produz potência que também vai para a Rede (e conta para o medidor Kardashev).

---

## 3. Recursos

| Ícone | Recurso | Unidade | Onde vive | Papel |
|---|---|---|---|---|
| ₵ | Créditos | ₵ | global | compra tudo |
| ⚡ | Potência | kW (prefixos SI reais) | Rede + Núcleo | vendida até a demanda |
| 🔋 | Bateria | kWh | Rede | amortece a balança Oferta × Demanda |
| 🏙 | Demanda | kW | Rede | quanto a cidade compra |
| 🔥 | Calor | u (unidades) | Núcleo | produzido e dissipado por peças |
| 🔬 | Pesquisa | pontos | Núcleo → global | desbloqueios e eras |
| 🛡 | Estabilidade | 0–100 % | Núcleo | progresso da era; a Cascata derruba |
| 🧲 | Contenção | margem % | Núcleo (Era 3+) | campo × pressão |

Números em JavaScript puro (double) bastam: a Esfera de Dyson chega a ~10²⁶ W, longe do limite de 10³⁰⁸. Sem biblioteca de big numbers.

---

## 4. As três balanças

Cada balança tem uma **zona de ouro** (bônus), uma **zona neutra** e **zonas de falha**. O jogador é premiado por operar perto do limite, não longe dele.

### 4.1 Oferta × Demanda (Rede) — razão r = potência ofertada ÷ demanda
| Faixa | Efeito |
|---|---|
| r < 0,8 | **Apagão**: preço ×0,5 (multa contratual). Era 3+: contenção perde potência |
| 0,8–0,9 e 1,1–1,25 | neutro |
| **0,9–1,1** | **zona de ouro**: preço ×1,25 |
| r > 1,25 | **Saturação**: preço ×0,75; excedente vai para a bateria, o resto é desperdiçado |

A bateria carrega com excedente e descarrega em déficit, então a balança tolera oscilação curta, não desequilíbrio sustentado.

### 4.2 Calor (Núcleo) — T = calor armazenado ÷ capacidade do componente crítico
| Faixa | Efeito |
|---|---|
| < 40 % | seguro e lento: pesquisa ×0,5 |
| 40–70 % | normal |
| **70–90 %** | **zona de ouro**: pesquisa ×1,3 e Estabilidade sobe mais rápido |
| 90–100 % | alerta (barra pisca, som) |
| > 100 % por 5 s | **Cascata** (o calor acumula acima da capacidade; nunca é truncado em 100 %) |

Fisicamente coerente: turbinas rendem mais com o receptor quente (Carnot), por isso a zona de ouro é quente e perto do limite. Isso também torna o sistema **auto-estabilizante**: o consumo das turbinas cresce com a temperatura, então cada configuração de peças converge para uma temperatura de equilíbrio. O jogador ajusta a proporção espelhos/turbinas para cair na faixa — não precisa "pilotar" a barra segundo a segundo.

### 4.3 Contenção (Núcleo, Era 3+) — margem = (campo − pressão) ÷ pressão
Bobinas geram campo e consomem potência da Rede; células de plasma geram pressão. Margem entre 5 % e 20 % é zona de ouro (energia ×1,2). Margem < 0 por 3 s → Cascata. Detalhes na Parte 2.

---

## 5. Cascata — o "voltar um pouco"

**Gatilhos:** Calor > 100 % por 5 s, ou Contenção < 0 por 3 s. Os 5 s de tolerância são o tempo de reagir (desligar uma peça, comprar um radiador).

**Efeitos (Era 1; as eras seguintes variam a receita):**
1. As peças sobrecarregadas e as adjacentes ao ponto crítico viram **entulho**. Reconstruir custa 50 %; limpar sem reconstruir é grátis após 30 s.
2. **Estabilidade −30 pontos.** Esse é o "voltar uma etapa": a barra que libera a próxima era regride.
3. **SCRAM**: Núcleo desligado por 20 s — sem pesquisa, sem potência do Núcleo.
4. Bateria −10 %.
5. Pesquisa acumulada **não** é perdida (não punir duas vezes).

**Apresentação:** onda de choque branca a partir do ponto crítico, tremor leve de tela, e um **card explicativo** no estilo infográfico: "O que aconteceu: o calor excedeu a dissipação por 5 s. Cada turbina extra a mais teria…". O jogo ensina em vez de só punir.

**Modo seguro (toggle):** SCRAM automático a 95 %, com potência do Núcleo ×0,7. Existe para quem quer jogar idle; quem joga ativo ganha mais operando na mão. Offline o modo seguro é sempre ligado.

---

## 6. Progressão e eras

- **Estabilidade** sobe enquanto o Núcleo opera dentro da faixa (mais rápido na zona de ouro). Chega a 100 % → habilita o botão da próxima era.
- **Próxima era** exige: Estabilidade 100 % + pesquisa específica concluída + custo em ₵.
- A era nova traz: novo cenário (a câmera afasta: colina → cidade → oceano → órbita → espaço profundo → estrela), nova grade com peças novas, novas usinas na lista, e **uma balança que muda de natureza**.

| Era | Cenário | Núcleo | O que muda na balança |
|---|---|---|---|
| 1 Vento e Sol | colina | Torre Solar (CSP) | só Calor; aprende o básico |
| 2 Fissão | cidade e rio | Reator PWR | combustível esgota; peças gastas **continuam quentes** (calor de decaimento) |
| 3 Fusão | plataforma no oceano | Tokamak | entra a **Contenção**, que consome potência da Rede |
| 4 Antimatéria | órbita / Lua | Anel acelerador | no vácuo só se dissipa por radiação: radiadores rendem menos; armadilhas precisam de energia constante |
| 5 Buraco negro | espaço profundo | Reator Hawking | balança **invertida**: massa baixa demais explode, alta demais rende pouco |
| 6 Dyson | a estrela | Enxame de coletores | balança de **luz**: cobrir demais a estrela congela as colônias (demanda colapsa) |

**Medidor Kardashev:** potência total instalada em watts, numa escala log com marcos reais — humanidade em 2026 (~2×10¹³ W), Tipo I (10¹⁶ W), Tipo II (10²⁶ W), Sol (3,8×10²⁶ W). O jogador vê onde está de verdade.

**Prestígio** ("Nova simulação"): pós-MVP. Depois da Era 6 (ou a partir da Era 4), reiniciar por **Constantes** permanentes. Definido na Parte 2.

---

## 7. Economia — regras gerais

- **Custo da n-ésima unidade** de uma usina da lista: `custo_base × 1,15^n` (Vilas e cidades: 1,25).
- **Melhoria** (nível): `custo_base × 3^nível`, produção `× (1 + 0,5 × nível)`.
- **Peças da grade:** preço fixo por era, sem inflação por unidade (a limitação é o espaço e o calor, não o preço).
- **Receita/s** = potência vendida (kW) × preço (₵ por kW·s) × multiplicador da balança Rede.
- **Preço base** por era: Era 1 = 1,0; cada era multiplica a escala de potência por ~100 e o preço por ~0,1 (mais watts, menos ₵ por watt — reflete o custo da energia caindo). Números finos das Eras 2–6 na Parte 2.
- **Pesquisa/s** = potência do Núcleo ÷ 10 × multiplicador da zona de calor.
- **Offline:** até 8 h. Rede a 50 %, Núcleo em modo seguro a 70 %. Nunca há Cascata offline.
- **Ritmo definido:** ~60 min de jogo ativo por era. Estabilidade sobe +1,5 pontos/min na faixa normal e +2,5/min na zona de ouro (100 % em 40–65 min, contando paradas e Cascatas).

---

## 8. Era 1 — Vento e Sol (completa)

### 8.1 Estado inicial
₵ 50 · demanda inicial 5 kW (aldeia) · potência 0 · Núcleo bloqueado.

### 8.2 Rede
| Usina | Custo base | Potência | Desbloqueio |
|---|---|---|---|
| Cata-vento | ₵ 15 | 1 kW | início |
| Painel solar | ₵ 60 | 3 kW | 5 cata-ventos |
| Turbina eólica | ₵ 120 | 6 kW | 🔬 40 |
| Bateria | ₵ 80 | +20 kWh de capacidade | 🔬 20 |
| Vila | ₵ 40 | +8 kW de demanda | início (custo ×1,25) |

Melhorias da Rede (lista): Lâminas de fibra (eólica +25 %, ₵ 200) · Rastreamento (solar +25 %, ₵ 150 + 🔬 30).

### 8.3 Núcleo: Torre Solar (grade 5×5, centro fixo)
Desbloqueio: ₵ 100 (tutorial guiado: "construa o receptor").

| Peça | Custo | Função |
|---|---|---|
| **Receptor** (centro, fixo) | — | capacidade 100 u; converte calor via turbinas adjacentes |
| Heliostato (espelho) | ₵ 30 | +4 u/s no Receptor se adjacente (anel 1); +2 u/s no anel 2 |
| Turbina a vapor | ₵ 50 | só adjacente ao Receptor; consome `0,12 × calor armazenado` u/s e gera 0,8 kW por u consumida |
| Radiador | ₵ 40 | −6 u/s no Receptor se adjacente |
| Tanque de sal fundido | ₵ 60 | adjacente ao Receptor: +150 u de capacidade compartilhada (amortece picos) |

**Anéis:** anel 1 = as 8 casas vizinhas do Receptor, diagonais incluídas; anel 2 = as 16 casas restantes do 5×5.

**A tensão de projeto:** o anel 1 tem só 8 casas. Cada casa é espelho a 100 % **ou** turbina **ou** radiador. O jogador escolhe a proporção.

**Equilíbrio (por que funciona):** com `h` espelhos efetivos (anel 1 conta 1, anel 2 conta 0,5), `t` turbinas e `rad` radiadores adjacentes, `dQ/dt = 4·h − 6·rad − 0,12·t·Q`, e o calor converge para `Q* = (4·h − 6·rad) ÷ (0,12·t)` — sem radiador, `33,3 × h ÷ t` unidades. A aproximação é assintótica: `Q` encosta em `Q*` e não passa. Exemplos com capacidade 100:
| Configuração | Q* | Resultado |
|---|---|---|
| h = 5 (4 no anel 1 + 2 no anel 2), t = 2 | 83,3 | **zona de ouro**, 16 kW (8 kW por turbina) |
| h = 5,5, t = 2 | 91,7 | alerta |
| **h = 6, t = 2** | **100,0** | **limite exato — alerta permanente, nunca cascateia** |
| **h = 6,5, t = 2** | **108,3** | **Cascata 5 s depois** de T passar de 100 % |
| h = 6,5, t = 2, **1 radiador** | 83,3 | volta para a zona de ouro |

**Tanque de sal fundido** aumenta a capacidade sem mudar Q*: com um tanque, T = 100 ÷ 250 = 40 % — sai da zona de ouro e a pesquisa cai para ×0,5. O tanque compra margem e cobra em pesquisa (precisa de card explicativo).

Melhorias do Núcleo: Receptor cerâmico (capacidade +50, ₵ 300 + 🔬 80) · Grade 7×7 (₵ 800 + 🔬 150; abre o anel 3 a 25 %).

### 8.4 Saída da Era 1
Estabilidade 100 % + pesquisa "Fissão básica" (🔬 3 000) + ₵ 50 000 → Era 2. (Com o Núcleo em ~16 kW na zona de ouro, 🔬 3 000 leva 20–30 min de operação.) Card explicativo de transição: de kW para MW.

---

## 9. O que faz o jogo surpreender

1. **Unidades reais e medidor Kardashev** com marcos de verdade (humanidade hoje, Tipo I, Tipo II, o Sol).
2. **Cards explicativos** por era (3 telas, ciência real, tom curioso e direto): Carnot, calor de decaimento, contenção magnética, radiação no vácuo, radiação Hawking, sombra de Dyson.
3. **Balanças que mudam de natureza** a cada era em vez de só crescer números — inclusive uma invertida (Era 5).
4. **Acoplamento entre camadas**: apagão na Rede derruba a contenção do Núcleo.
5. **Cascata como "voltar um pouco"** com card do que deu errado, não game over.
6. **Transição de era com zoom cósmico** e mudança de paleta.
7. **Detalhes físicos que viram mecânica**: turbina rende mais quente; peça gasta continua quente; no vácuo não há convecção.

---

## 10. Direção de arte (flat-vector de infográfico científico)

**Princípios:** formas geométricas simples (círculo, hexágono, cápsula), sem contorno preto (contorno fino em tom mais escuro do próprio preenchimento, quando houver), **sombra chapada deslocada** 4–8 px na mesma matiz, brilho (glow) só no que está quente ou energizado, muito espaço negativo, tudo com cantos arredondados.

**Fundo:** navy profundo `#0D1230` com gradiente radial para `#241B55`; estrelas como pontos de 1–2 px com opacidade variada.

**Paleta base (tokens):**
| Token | Hex | Uso |
|---|---|---|
| `--ink` | `#F4F6FF` | texto |
| `--muted` | `#9AA3C7` | texto secundário |
| `--card` | `#161B3D` | painéis, raio 16 px, borda `rgba(255,255,255,.08)` |
| `--sun` | `#FFD23F` | Era 1 principal |
| `--sky` | `#4CC9F0` | Era 1 secundária, água |
| `--leaf` | `#6BE585` | grama, positivo |
| `--coral` | `#FF6B6B` | alerta, calor alto |
| `--plasma` | `#FF4FD8` | Era 3 |
| `--ion` | `#7CF5FF` | Era 4 |
| `--void` | `#8A5CFF` | Era 5 |
| `--gold` | `#FFB703` | Era 6 |

**Rampa de calor** (corpo negro, física de verdade): frio `#3A6FF2` → `#FFD23F` → `#FF7A1A` → branco `#FFFFFF` em 100 %. A cor da peça diz a temperatura sem precisar ler número.

**Tipografia:** Outfit (títulos, geométrica) + Nunito (texto), números tabulares. Fontes abertas.

**Movimento:** ease-out-back nos "pops" de compra; respiração de 2 s no Núcleo; partículas de calor subindo; onda de choque radial na Cascata; transição de era = câmera afasta em 3 s com troca de paleta.

**Mascotes originais:** os **Bipes** — robôs esféricos de manutenção com uma antena e um olho único. Aparecem nos cards explicativos, no tutorial e limpando entulho depois da Cascata. Sem passarinhos, sem logo de terceiros.

---

## 11. Arquitetura

```
src/
  sim/        # TypeScript puro: estado, tick de 100 ms (timestep fixo), fórmulas,
              # balanças, Cascata, save/load com migração de versão. Sem React, sem Phaser.
              # Testável com Vitest (ex.: "6,5 espelhos efetivos e 2 turbinas cascateiam em 5 s").
  ui/         # React: HUD, lista da Rede, balanças, cards explicativos, menus, medidor Kardashev.
  scene/      # Phaser 3: GridScene (Núcleo), rampa de calor, partículas, Cascata, transição de era.
  content/    # dados das eras (peças, usinas, preços, textos dos cards) em JSON/TS.
  store/      # Zustand: snapshot do estado do sim para React e Phaser.
```
- O sim é a única fonte de verdade; React e Phaser só leem e despacham ações.
- Save: localStorage a cada 10 s + exportar/importar JSON.
- Offline: no load, calcula o tempo ausente e aplica as regras da seção 7.
- Mobile-first: grade com toque/arrastar, HUD em uma coluna.

---

## 12. Roteiro de sessões no Claude Code

| Sessão | Entrega | Pronto quando |
|---|---|---|
| 1 | Scaffold Vite + React + TS + Phaser; `sim/` com tick; Rede da Era 1; balança Oferta × Demanda; HUD mínima | comprar cata-ventos e vilas, ver o preço mudar com r |
| 2 | Grade da Torre Solar em Phaser; Calor; zona de ouro; Cascata com entulho e SCRAM; Estabilidade; save | reproduzir os exemplos da seção 8.3 |
| 3 | Passe de arte (tokens, rampa de calor, sombras, glow); 3 cards da Era 1; medidor Kardashev; modo seguro; offline | jogo bonito e completo até o fim da Era 1 |
| 4 | Era 2 (fissão: esgotamento e calor de decaimento) e transição de era | MVP: Eras 1–2 |
| 5 | Era 3 (Contenção + acoplamento com a Rede) | |
| 6–8 | Eras 4–6, balanceamento, prestígio, som | jogo completo |

Cada sessão nasce de um `CLAUDE.md` do projeto (escrito no próximo passo) que carrega este documento como contrato.

---

## 13. Perguntas abertas para você

1. Idioma da interface: só PT-BR no MVP?
2. Som e música: no MVP ou só no final?
3. Nome: "Kardashev" é codinome. Trocar?

---

*v0.2 — ritmo fixado em ~1 h por era; Era 1 recalibrada.*
*v0.3 — §8.3 corrigido: 16 kW no exemplo da zona de ouro, h = 6 é assintótico (Cascata só com h = 6,5), Q* derivado das peças; anéis definidos; §4.2 diz que o calor passa de 100 %; §8.4 com 20–30 min. Ver `docs/correcoes-gdd-v0.3.md`.*
