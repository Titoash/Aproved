/**
 * Painel da Rede (GDD §2.1, v0.6): a lista de compra virou **paleta de construção** — escolhe-se um prédio e
 * toca-se numa casa do arquipélago. Abaixo dela ficam o extrato, as ilhas (expedição e cabo) e as melhorias.
 */
import { MELHORIAS, ORDEM_MELHORIAS, ORDEM_USINAS, USINAS, VILA, BATERIA, type Desbloqueio } from "../content/era1";
import { CABO, ILHAS, OBSTACULOS, SUBESTACAO, type IlhaId } from "../content/era1-arquipelago";
import { custoProximaMelhoria, desbloqueado, podeMelhorarUsina } from "../sim/acoes";
import { fatorMelhoria } from "../sim/custos";
import { formatarCreditos, formatarNumero, formatarPotencia } from "../sim/formatar";
import { custoCabo, custoColocar, custoExpedicao, ilhaAberta, podeComprarIlha, podeLigarCabo, temCabo } from "../sim/mundo";
import { fatorPotenciaUsina, podeComprarMelhoria } from "../sim/melhorias";
import { analisar } from "../sim/producao";
import type { GameState, TipoConstrucao } from "../sim/state";
import { useGameStore, type FerramentaMundo } from "../store/gameStore";
import { BotaoCompra } from "./BotaoCompra";
import { Extrato } from "./Extrato";
import { IconeCadeado, IconeItem } from "./icones";

function textoBloqueio(state: GameState, desbloqueio: Desbloqueio | undefined): string | null {
  if (desbloqueado(state, desbloqueio)) return null;
  const partes: string[] = [];
  const analise = analisar(state);
  if (desbloqueio?.usina) {
    const [id, n] = desbloqueio.usina;
    const nome = n === 1 ? USINAS[id].nome : USINAS[id].nomePlural;
    if (analise.contagem[id] < n) partes.push(`${n} ${nome.toLowerCase()} (${analise.contagem[id]}/${n})`);
  }
  if (desbloqueio?.pesquisa !== undefined && state.pesquisa < desbloqueio.pesquisa) {
    partes.push(`🔬 ${desbloqueio.pesquisa} (${formatarNumero(state.pesquisa, 0)}/${desbloqueio.pesquisa})`);
  }
  return `Desbloqueia com ${partes.join(" e ")}`;
}

interface ItemPaleta {
  id: FerramentaMundo;
  nome: string;
  detalhe: string;
  desbloqueio?: Desbloqueio;
}

function itensDaPaleta(state: GameState): ItemPaleta[] {
  const itens: ItemPaleta[] = ORDEM_USINAS.map((id) => ({
    id,
    nome: USINAS[id].nome,
    detalhe: `${formatarPotencia(USINAS[id].potenciaKw * fatorMelhoria(state.rede.usinas[id].nivel) * fatorPotenciaUsina(state.melhorias, id))} por unidade`,
    desbloqueio: USINAS[id].desbloqueio,
  }));
  itens.push({ id: "vila", nome: VILA.nome, detalhe: `+${formatarPotencia(VILA.demandaKw)} de demanda` });
  itens.push({ id: "subestacao", nome: SUBESTACAO.nome, detalhe: `alcance ${SUBESTACAO.alcance} · teto ${formatarPotencia(SUBESTACAO.tetoKw)}` });
  itens.push({ id: "bateria", nome: BATERIA.nome, detalhe: `+${BATERIA.capacidadeKwh} kWh · ±${formatarPotencia(BATERIA.potenciaKw)}`, desbloqueio: BATERIA.desbloqueio });
  return itens;
}

function BotaoPaleta({ item }: { item: ItemPaleta }) {
  const state = useGameStore((s) => s.state);
  const ferramenta = useGameStore((s) => s.ferramentaMundo);
  const selecionar = useGameStore((s) => s.selecionarFerramentaMundo);
  const bloqueio = textoBloqueio(state, item.desbloqueio);
  const custo = custoColocar(state, item.id as TipoConstrucao);
  const caro = state.creditos < custo;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ferramenta === item.id}
      className={`paleta-item ${ferramenta === item.id ? "paleta-item--ativa" : ""} ${bloqueio ? "paleta-item--bloqueada" : ""}`}
      disabled={!!bloqueio}
      title={bloqueio ?? item.detalhe}
      onClick={() => selecionar(item.id)}
    >
      <IconeItem id={item.id as never} />
      <span className="paleta-nome">{item.nome}</span>
      {bloqueio ? (
        <span className="paleta-custo paleta-custo--bloqueio">
          <IconeCadeado /> {bloqueio.replace("Desbloqueia com ", "")}
        </span>
      ) : (
        <span className={`paleta-custo ${caro ? "pilula-custo--caro" : ""}`}>{formatarCreditos(custo)}</span>
      )}
      <span className="paleta-detalhe">{item.detalhe}</span>
    </button>
  );
}

function Ferramentas() {
  const ferramenta = useGameStore((s) => s.ferramentaMundo);
  const selecionar = useGameStore((s) => s.selecionarFerramentaMundo);
  const opcoes: { id: FerramentaMundo; nome: string; detalhe: string; icone: "remover" | "arvore" }[] = [
    { id: "remover", nome: "Remover", detalhe: "devolve 50 % do custo", icone: "remover" },
    { id: "desmatar", nome: "Desmatar", detalhe: `árvore ${formatarCreditos(OBSTACULOS.arvore.custo)} · pedra ${formatarCreditos(OBSTACULOS.pedra.custo)}`, icone: "arvore" },
  ];
  return (
    <div className="paleta paleta--ferramentas" role="radiogroup" aria-label="Ferramentas">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={ferramenta === o.id}
          className={`paleta-item ${ferramenta === o.id ? "paleta-item--ativa" : ""}`}
          title={o.detalhe}
          onClick={() => selecionar(o.id)}
        >
          <IconeItem id={o.icone} />
          <span className="paleta-nome">{o.nome}</span>
          <span className="paleta-detalhe">{o.detalhe}</span>
        </button>
      ))}
    </div>
  );
}

function LinhaMelhoria({ id }: { id: (typeof ORDEM_MELHORIAS)[number] }) {
  const state = useGameStore((s) => s.state);
  const comprarMelhoria = useGameStore((s) => s.comprarMelhoria);
  const def = MELHORIAS[id];
  const comprada = state.melhorias[id];
  return (
    <li className={`linha ${comprada ? "linha--comprada" : ""}`}>
      <IconeItem id={id} />
      <div className="linha-texto">
        <span className="linha-nome">
          {def.nome}
          {comprada ? <span className="marca-comprado"> ✔ comprada</span> : null}
        </span>
        <span className="linha-meta">{def.descricao}</span>
      </div>
      {comprada ? null : (
        <div className="linha-acoes">
          <BotaoCompra titulo="Comprar" custo={def.custo} creditos={state.creditos} habilitado={podeComprarMelhoria(state, id)} requisito={def.pesquisa !== undefined ? `🔬 ${def.pesquisa}` : undefined} onClick={() => comprarMelhoria(id)} />
        </div>
      )}
    </li>
  );
}

function LinhaNivelUsina({ id }: { id: (typeof ORDEM_USINAS)[number] }) {
  const state = useGameStore((s) => s.state);
  const melhorarUsina = useGameStore((s) => s.melhorarUsina);
  const analise = analisar(state);
  if (analise.contagem[id] === 0) return null;
  const nivel = state.rede.usinas[id].nivel;
  return (
    <li className="linha">
      <IconeItem id={id} />
      <div className="linha-texto">
        <span className="linha-nome">{USINAS[id].nome}</span>
        <span className="linha-meta">
          ×{analise.contagem[id]} · nível {nivel} · produção ×{formatarNumero(fatorMelhoria(nivel), 1)}
        </span>
      </div>
      <div className="linha-acoes">
        <BotaoCompra titulo={`Nível ${nivel + 1}`} custo={custoProximaMelhoria(state, id)} creditos={state.creditos} habilitado={podeMelhorarUsina(state, id)} onClick={() => melhorarUsina(id)} />
      </div>
    </li>
  );
}

/** Uma ilha do arquipélago: expedição (₵) e depois o cabo submarino (₵ 150 + ₵ 40 por casa de mar). */
function LinhaIlha({ id }: { id: IlhaId }) {
  const state = useGameStore((s) => s.state);
  const comprarIlha = useGameStore((s) => s.comprarIlha);
  const ligarCabo = useGameStore((s) => s.ligarCabo);
  const def = ILHAS.find((i) => i.id === id);
  if (!def || def.expedicao === null) return null;
  const aberta = ilhaAberta(state.mundo, id);
  const cabo = temCabo(state.mundo, id);
  return (
    <li className={`linha ${cabo ? "linha--comprada" : ""}`}>
      <div className="linha-texto">
        <span className="linha-nome">
          {def.nome}
          {aberta ? <span className="marca-comprado"> ✔ aberta</span> : null}
          {cabo ? <span className="marca-comprado"> ✔ com cabo</span> : null}
        </span>
        <span className="linha-meta">
          {def.casas} casas · {def.descricao}
        </span>
      </div>
      <div className="linha-acoes">
        {!aberta ? (
          <BotaoCompra titulo="Expedição" custo={custoExpedicao(id) ?? 0} creditos={state.creditos} habilitado={podeComprarIlha(state, id)} variante="primario" onClick={() => comprarIlha(id)} />
        ) : !cabo ? (
          <BotaoCompra titulo="Ligar cabo" custo={custoCabo(id)} creditos={state.creditos} habilitado={podeLigarCabo(state, id)} variante="primario" onClick={() => ligarCabo(id)} />
        ) : null}
      </div>
    </li>
  );
}

export function PainelRede() {
  const itens = itensDaPaleta(useGameStore((s) => s.state));
  return (
    <section className="rede" aria-label="Rede">
      <h2>Construir</h2>
      <p className="rede-dica">Escolha e toque numa casa. Cada casa é uma decisão: terreno, vizinhos e escoamento mudam o que ela rende.</p>
      <div className="paleta" role="radiogroup" aria-label="Paleta de construção">
        {itens.map((item) => (
          <BotaoPaleta key={item.id} item={item} />
        ))}
      </div>
      <Ferramentas />

      <h2 className="rede-subtitulo">Extrato</h2>
      <Extrato />

      <h2 className="rede-subtitulo">Ilhas</h2>
      <p className="rede-dica">
        A expedição abre a ilha; o cabo ({formatarCreditos(CABO.custoFixo)} + {formatarCreditos(CABO.custoPorCasa)} por casa de mar) liga a energia dela à rede principal.
      </p>
      <ul className="lista">
        {ILHAS.filter((i) => i.expedicao !== null).map((i) => (
          <LinhaIlha key={i.id} id={i.id} />
        ))}
      </ul>

      <h2 className="rede-subtitulo">Melhorias</h2>
      <ul className="lista">
        {ORDEM_USINAS.map((id) => (
          <LinhaNivelUsina key={id} id={id} />
        ))}
        {ORDEM_MELHORIAS.filter((id) => MELHORIAS[id].camada === "rede").map((id) => (
          <LinhaMelhoria key={id} id={id} />
        ))}
      </ul>
    </section>
  );
}
