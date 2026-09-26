# Sessão 10 — Ocorrências: a espera vira operação (v0.9)

> Pressupõe a Sessão 9 aprovada e incorporada. Produção no branch `claude/sessao-10` conforme `docs/PRODUCAO.md`. Leia `docs/correcoes-gdd-v0.9.md` (a espera medida e o que mudou), a Parte 1 §4.2, §4.4, §5, §7, §8.4, §10.1 e a Parte 2 §5 e §5.4. Antes da parte A, aplique `docs/sessoes/sessao-9-ajustes.md` (a gestão escreve ao revisar a Sessão 9).

## Objetivo
O jogador nunca fica só olhando uma barra subir. A cada ~4 minutos de jogo ativo o Núcleo oferece uma Ocorrência curta e opcional. Quem aceita opera um controle só contra uma perturbação física de verdade e ganha 🛡 ou 🔬, à escolha; quem recusa não perde nada. A Estabilidade passiva cai para 1,8/min no ouro e 1,2/min fora dele, e as Ocorrências devolvem o ritmo a quem joga: ≈ 42 min jogando, ≈ 56 min deixando rodar.

## Partes
- **0 · Ajustes da Sessão 9.** `sessao-9-ajustes.md`, em commit próprio.
- **A · Ocorrências (sim puro).**
  - `sim/ocorrencias.ts`, com o estado da oferta e da Ocorrência em curso em `state.ocorrencia`: tipo, fase (oferta ou ativa), início, valor do controle, tempo na meta e semente.
  - Relógio de 4 min de jogo ativo, que recomeça quando a oferta termina, qualquer que seja o desfecho.
  - Sorteio determinístico com `sim/aleatorio.ts` entre as Ocorrências cujas exigências a grade atende.
  - Bloqueio da oferta com o Núcleo bloqueado, desligado, em SCRAM ou sem turbina.
  - Ações `aceitarOcorrencia`, `ajustarControle` (com os limites do content), `recusarOcorrencia` e `escolherRecompensa`.
  - A meta é avaliada no tick: 75 % da duração na faixa, sem Cascata e sem SCRAM — ou, onde a Ocorrência diz, a potência na faixa.
  - Recompensa: 🛡 +3, com teto de 100, ou 🔬 igual a 60 s da 🔬/s total no instante.
  - A perturbação e o controle entram no `MotorCalor` como multiplicadores (entrada, dissipação, fator das turbinas). Na Era 2 o controle age só na injeção das varetas **ativas**: o decaimento não muda. Nenhuma fórmula de Parte 1 §4.2, §8.3 ou Parte 2 §5 muda.
  - O offline ignora Ocorrências: uma em curso ao fechar é descartada sem recompensa, e o controle volta a 100 %.
  - Save **v10** com migração v9 → v10: sem Ocorrência e relógio zerado.
  - A primeira oferta do jogo é sempre a Nuvem.
- **B · Conteúdo.**
  - `content/ocorrencias.ts` com as seis Ocorrências de Parte 1 §4.4 e Parte 2 §5.4. Cada uma traz: perturbação, perfil no tempo com rampas de 5 s, duração, exigência, meta, faixa do controle por era e frase de física.
  - No mesmo arquivo: o intervalo de 4 min, a janela de 60 s, a meta de 75 % e a recompensa (+3 e 60 s).
  - Estabilidade em `content/era1-nucleo.ts`: frio, normal e alerta 1,5 → **1,2**; ouro 2,5 → **1,8**.
- **C · Testes.** Os exemplos das duas tabelas viram testes, no espírito da regra 2 do `CLAUDE.md`.
  - Teste obrigatório: "com `h = 5, t = 2`, a Nuvem com a carga em 100 % tira `T` da zona de ouro (`Q*` = 50) e não é superada; com a carga em 60 % `Q*` volta a 83,3 e é superada. O Céu limpo e frio, sem mexer no controle, dispara a Cascata 5 s depois de `T` passar de 100 %. Na Era 2, a Turbina em meia carga com as barras em 75 % devolve `Q*` = 416,7, e as barras não mexem no decaimento de uma vareta gasta."
  - Testam também:
    - o sorteio é determinístico (mesma semente, mesma sequência);
    - nenhuma oferta sai em SCRAM, nem offline;
    - a recompensa em 🔬 é proporcional à produção, e a de 🛡 não passa de 100;
    - o relógio de 4 min recomeça ao fim da oferta;
    - as taxas novas de Estabilidade valem também no offline, com o fator ×0,7.
- **D · Interface.** Tudo nos dois tamanhos.
  - **Oferta:** cartão no painel do Núcleo com nome, duração, recompensa, frase de física, "Aceitar" / "Agora não" e a contagem dos 60 s. O 🔥 do HUD pulsa enquanto há oferta, e tocar nele abre o cartão.
  - **Durante a Ocorrência:**
    - um **controle grande**, para arrastar com o polegar, rotulado "Carga das turbinas" ou "Barras de controle", com o valor em %;
    - a faixa-alvo desenhada na barra de calor, com a marca de `Q*` andando ao vivo;
    - o tempo restante e o tempo na meta.
  - **Fim:** ao superar, a escolha da recompensa em dois botões.
  - **Registros:** uma linha no diário (Parte 1 §10.1); o card "Ocorrências" (2 telas, com os Bipes) na primeira oferta.
- **E · Cena.** Dentro do orçamento de quadro da Sessão 9:
  - sombra de nuvem atravessando o campo de heliostatos (Nuvem);
  - céu um tom mais claro (Céu limpo e frio);
  - a turbina afetada girando pela metade (meia carga);
  - na Era 2, barras descendo e subindo no Vaso conforme o controle.
- **F · Balanceamento.**
  - `scripts/simular.ts` ganha a rota **"operador"**, além de "corrida" e "cidade" (que recusam toda Ocorrência). A rota operador:
    - aceita toda Ocorrência;
    - põe o controle no valor que a fórmula de `Q*` pede;
    - escolhe 🛡 quando a Estabilidade é o que trava e 🔬 quando é a 🔬.
  - Metas:
    - Era 1 e Era 2 em 50–70 min nas rotas que recusam;
    - 40–50 min na rota operador, sem nenhuma janela parada de mais de 5 min.
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
- [ ] `content/ocorrencias.ts` com as seis Ocorrências; Estabilidade 1,8/1,2
- [ ] testes com as tabelas de Parte 1 §4.4 e Parte 2 §5.4, e o teste obrigatório
- [ ] interface: cartão, 🔥 pulsando, controle, faixa-alvo, escolha da recompensa, diário, card; nos dois tamanhos
- [ ] cena das Ocorrências dentro do orçamento
- [ ] simulação com a rota operador; metas de ritmo; janelas paradas medidas nas três rotas; ajustes registrados
- [ ] roteiro Playwright verde nos dois tamanhos; roteiros 6–9 verdes; capturas; `ESTADO.md`; relatório; `typecheck`, `test`, `lint`, `build`
