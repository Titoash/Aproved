# Sessão 10 — Ocorrências: a espera vira operação (v0.9)

> Pressupõe a Sessão 9 aprovada e incorporada. Produção no branch `claude/sessao-10` conforme `docs/PRODUCAO.md`. Leia `docs/correcoes-gdd-v0.9.md` (a espera medida e o que mudou), a Parte 1 §4.2, §4.4, §5, §7, §8.4, §10.1 e a Parte 2 §5 e §5.4. Antes da parte A, aplique `docs/sessoes/sessao-9-ajustes.md` (a gestão escreve ao revisar a Sessão 9).

## Objetivo
O jogador nunca fica só olhando uma barra subir. A cada ~4 minutos de jogo ativo o Núcleo oferece uma Ocorrência curta e opcional. Quem aceita opera um controle só contra uma perturbação física de verdade e ganha 🛡 ou 🔬, à escolha; quem recusa não perde nada. A Estabilidade passiva cai para 1,8/min no ouro e 1,2/min fora dele, e as Ocorrências devolvem o ritmo a quem joga: na Era 1 a barra enche em ≈ 42 min jogando e ≈ 56 deixando rodar. Na Era 2 a saída também depende da 🔬 da Fusão básica, e a rota operador mede o fechamento das duas eras (meta da Parte 1 §7).

## Partes
- **0 · Ajustes da Sessão 9.** `sessao-9-ajustes.md`, em commit próprio.
- **A · Ocorrências (sim puro).**
  - `sim/ocorrencias.ts`, com o estado da oferta e da Ocorrência em curso em `state.ocorrencia`: tipo, fase (oferta ou ativa), início, valor do controle, tempo na meta e semente.
  - Relógio de 4 min de jogo ativo, guardado como acumulador de tempo de tick (não como carimbo de `tempoMs`, que o offline avança em `offline.ts`). Só anda sem oferta e sem Ocorrência, e recomeça ao fim da Ocorrência (superada ou não) ou da oferta recusada ou expirada.
  - Sorteio determinístico com `sim/aleatorio.ts` entre as Ocorrências cujas exigências a grade atende **e que se podem ganhar**: existe valor do controle, dentro dos limites, que põe o `Q*` perturbado perto de 80 % da capacidade (Parte 1 §4.4). Depois de um SCRAM na Era 2, a próxima oferta é o Xenônio (Parte 2 §5.4).
  - Bloqueio da oferta com o Núcleo bloqueado, desligado, em SCRAM ou sem turbina.
  - Ações `aceitarOcorrencia`, `ajustarControle` (com os limites do content), `recusarOcorrencia` e `escolherRecompensa`.
  - A meta é avaliada no tick: 75 % da duração na faixa, sem Cascata e sem SCRAM — ou, onde a Ocorrência diz, a potência na faixa.
  - Recompensa: 🛡 +3, com teto de 100, ou 🔬 igual a 60 s da 🔬/s total no instante.
  - A perturbação e o controle entram no motor como multiplicadores (entrada, dissipação, fator das turbinas). Na Era 2 a "entrada" multiplicável é só a injeção das varetas **ativas**: o `MotorCalor` da Era 2 passa a separar `entradaAtivaUs` de `decaimentoUs` (ou o multiplicador entra dentro de `entradaReatorUs`, antes de somar o decaimento). Barras de controle e Xenônio multiplicam só a parcela ativa; o decaimento das varetas gastas e do SCRAM não muda. Nenhuma fórmula de Parte 1 §4.2, §8.3 ou Parte 2 §5 muda.
  - O offline ignora Ocorrências: a oferta pendente e a Ocorrência em curso ao fechar são descartadas sem recompensa, e o controle volta a 100 %.
  - Save **v10** com migração v9 → v10: sem Ocorrência, relógio zerado e "primeira oferta ainda não saiu".
  - A primeira oferta de cada save é a Nuvem; um save que chega à v10 já na Era 2 recebe primeiro o Xenônio (a Nuvem exige heliostato).
- **B · Conteúdo.**
  - `content/ocorrencias.ts` com as seis Ocorrências de Parte 1 §4.4 e Parte 2 §5.4 (menos as cortadas pela ordem de corte). Cada uma traz: perturbação, perfil no tempo (rampas de 5 s, ou o perfil próprio da tabela: Xenônio 15/30/15 s; o Seguimento de carga sem perturbação, só meta de potência), duração, exigência, meta, faixa do controle por era e frase de física.
  - No mesmo arquivo: o intervalo de 4 min, a janela de 60 s, a meta de 75 % e a recompensa (+3 e 60 s).
  - Estabilidade em `content/era1-nucleo.ts`: frio, normal e alerta 1,5 → **1,2**; ouro 2,5 → **1,8**.
- **C · Testes.** Os exemplos das duas tabelas viram testes, no espírito da regra 2 do `CLAUDE.md`, exceto os das Ocorrências cortadas pela ordem de corte. A Resposta das tabelas vale para o trecho estável: o teste aplica o controle acompanhando a rampa, com o modo seguro **desligado**.
  - Teste obrigatório: "com `h = 5, t = 2`, a Nuvem com a carga em 100 % tira `T` da zona de ouro (`Q*` = 50) e não é superada; com a carga em 60 % `Q*` volta a 83,3 e é superada. A Turbina em meia carga da Era 1, sem mexer no controle, dispara a Cascata 5 s depois de `T` passar de 100 % (`Q*` = 111,1). Na Era 2, a Turbina em meia carga com as barras em potência 75 % devolve `Q*` = 416,7, e nem as barras nem o Xenônio mexem no decaimento de uma vareta gasta. Com `h = 8` (anel 1: 4 heliostatos, 2 turbinas, 2 radiadores; anel 2: 8 heliostatos) e `t = 2`, a Nuvem não é sorteada."
  - Testam também:
    - o sorteio é determinístico (mesma semente, mesma sequência);
    - nenhuma oferta sai em SCRAM, nem offline;
    - a recompensa em 🔬 é proporcional à produção, e a de 🛡 não passa de 100;
    - o relógio recomeça ao fim da Ocorrência (e da oferta recusada ou expirada) e não conta o tempo offline;
    - as taxas novas de Estabilidade valem também no offline, com o fator ×0,7.
- **D · Interface.** Tudo nos dois tamanhos.
  - **Oferta:** cartão no painel do Núcleo com nome, duração, recompensa, frase de física, "Aceitar" / "Agora não" e a contagem dos 60 s. O 🔥 do HUD pulsa enquanto há oferta, e tocar nele abre o cartão.
  - **Durante a Ocorrência:**
    - um **controle grande**, para arrastar com o polegar, rotulado "Carga das turbinas · 60 %" ou "Barras de controle · potência 70 %" (com o ícone das barras; arrastar para cima = retirar barras = mais potência);
    - a faixa-alvo desenhada na barra de calor, com a marca de `Q*` andando ao vivo;
    - o tempo restante e o tempo na meta.
  - **Fim:** ao superar, a escolha da recompensa em dois botões.
  - **Registros:** uma linha no diário (Parte 1 §10.1; a Sessão 9 não pode cortá-lo); o card "Ocorrências" (2 telas, com os Bipes) na primeira oferta.
- **E · Cena.** Dentro do orçamento de quadro da Sessão 9:
  - sombra de nuvem atravessando o campo de heliostatos (Nuvem);
  - céu um tom mais claro (Céu limpo e frio);
  - a turbina afetada girando pela metade (meia carga);
  - na Era 2, as barras entram pelo topo do Vaso, como no PWR: potência abaixo de 100 % = barras descendo; acima de 100 % = barras subindo.
- **F · Balanceamento.**
  - `scripts/simular.ts` ganha a rota **"operador"**, além de "corrida" e "cidade" (que recusam toda Ocorrência). A rota operador:
    - aceita toda Ocorrência;
    - acompanha o perfil: a cada tick põe o controle no valor que a fórmula de `Q*` pede para o multiplicador daquele instante (1 ÷ multiplicador), e não o valor do platô já no aceite;
    - escolhe 🛡 quando a Estabilidade é o que trava e 🔬 quando é a 🔬.
  - Metas: as de era da Parte 1 §7 (50–70 min nas rotas que recusam, 40–50 min na rota operador), sem nenhuma janela parada de mais de 5 min na rota operador.
  - Medir de novo as janelas de `correcoes-gdd-v0.9.md` nas três rotas.
  - Calibrar o intervalo, a recompensa e as perturbações no content; as taxas de Estabilidade só mudam se o content não fechar, com o conflito no relatório.
  - Registrar o resultado na Parte 1 §4.4 e na Parte 2 §5.4.
- **G · Verificação.**
  - Testes.
  - `scripts/e2e/sessao-10.cjs`:
    - a oferta aparece e expira;
    - aceitar mostra o controle, e mexer nele move a marca de `Q*`;
    - superar mostra a escolha, e 🛡 +3 aparece no painel do Núcleo;
    - recusar não muda nada;
    - nenhuma oferta aparece com o Núcleo em SCRAM.
  - Roteiros 6–9 verdes, com as capturas fora do repositório.
  - Capturas em `docs/capturas/sessao-10/`; `ESTADO.md`; relatório.

Se não couber tudo, a ordem de corte é: cena da parte E, o Céu limpo e frio, o Seguimento de carga. Nunca cortar 0, A, B, C, D, F e G, nem a Nuvem, a Turbina em meia carga (nas duas eras) e o Xenônio.

## Checklist
- [ ] ajustes da Sessão 9 aplicados
- [ ] `sim/ocorrencias.ts`: oferta, relógio, sorteio determinístico, controle, meta, recompensa; multiplicadores no motor; save v10 com migração
- [ ] `content/ocorrencias.ts` com as seis Ocorrências (menos as cortadas pela ordem de corte); Estabilidade 1,8/1,2
- [ ] testes com as tabelas de Parte 1 §4.4 e Parte 2 §5.4, e o teste obrigatório
- [ ] interface: cartão, 🔥 pulsando, controle, faixa-alvo, escolha da recompensa, diário, card; nos dois tamanhos
- [ ] cena das Ocorrências dentro do orçamento
- [ ] simulação com a rota operador; metas de ritmo; janelas paradas medidas nas três rotas; ajustes registrados
- [ ] roteiro Playwright verde nos dois tamanhos; roteiros 6–9 verdes; capturas; `ESTADO.md`; relatório; `typecheck`, `test`, `lint`, `build`
