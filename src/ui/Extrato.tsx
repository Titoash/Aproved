/**
 * Extrato da Rede (GDD §10, v0.6): o que existe, quanto rende e quanto está sem escoamento.
 * Usado no painel e no popover da nota de ₵ no HUD.
 */
import { ORDEM_USINAS, USINAS } from "../content/era1";
import { BAIRRO, LABORATORIO, UNIVERSIDADE } from "../content/cidade-era1";
import { ilhaDef, SUBESTACAO } from "../content/era1-arquipelago";
import { formatarCreditos, formatarNumero, formatarPotencia, formatarTaxa } from "../sim/formatar";
import { analisar } from "../sim/producao";
import { balancoDoEstado } from "../sim/tick";
import { useGameStore } from "../store/gameStore";

export function Extrato() {
  const state = useGameStore((s) => s.state);
  const analise = analisar(state);
  const b = balancoDoEstado(state);
  const tetoTotal = analise.subestacoes.reduce((soma, s) => soma + s.tetoKw, 0);
  const usadoTotal = analise.subestacoes.reduce((soma, s) => soma + s.usadoKw, 0);

  return (
    <div className="extrato">
      <p className="extrato-linha extrato-linha--forte">
        <span>Receita</span>
        <span>
          {formatarTaxa(b.receitaPorSegundo)} · {b.faixa.nome.toLowerCase()} ×{formatarNumero(b.multiplicador, 2)}
        </span>
      </p>
      <p className="extrato-linha">
        <span>Cidade</span>
        <span>
          👥 {formatarNumero(analise.populacao, 0)} hab · tarifa ×{formatarNumero(analise.tarifa, 2)}
        </span>
      </p>
      <p className="extrato-linha">
        <span>Ciência</span>
        <span>🔬 +{formatarNumero(analise.pesquisaPorSegundo, 2)}/s da cidade</span>
      </p>
      <p className="extrato-linha">
        <span>Vendido</span>
        <span>
          {formatarPotencia(b.vendaDiretaKw + b.cobertoKw)} de {formatarPotencia(b.demandaKw)} de demanda
        </span>
      </p>
      {analise.semEscoamentoKw > 0.001 ? (
        <p className="extrato-linha extrato-linha--alerta">
          <span>Sem escoamento</span>
          <span>{formatarPotencia(analise.semEscoamentoKw)} desperdiçados</span>
        </p>
      ) : null}
      {analise.bairrosSemEscoamento > 0 ? (
        <p className="extrato-linha extrato-linha--alerta">
          <span>Bairros sem subestação</span>
          <span>
            {analise.bairrosSemEscoamento} · não pedem nem pagam
          </span>
        </p>
      ) : null}

      <table className="extrato-tabela">
        <thead>
          <tr>
            <th scope="col">Usina</th>
            <th scope="col">×</th>
            <th scope="col">Produz</th>
            <th scope="col">Escoa</th>
          </tr>
        </thead>
        <tbody>
          {ORDEM_USINAS.filter((id) => analise.contagem[id] > 0).map((id) => {
            const usinas = analise.usinas.filter((u) => u.tipo === id);
            const bruto = usinas.reduce((s, u) => s + u.brutoKw, 0);
            const escoado = usinas.reduce((s, u) => s + u.escoadoKw, 0);
            return (
              <tr key={id} className={escoado < bruto - 1e-9 ? "extrato-alerta" : undefined}>
                <th scope="row">{USINAS[id].nome}</th>
                <td>{analise.contagem[id]}</td>
                <td>{formatarPotencia(bruto)}</td>
                <td>{formatarPotencia(escoado)}</td>
              </tr>
            );
          })}
          {analise.contagem.bairro > 0 ? (
            <tr>
              <th scope="row">{BAIRRO.nomePlural}</th>
              <td>{analise.contagem.bairro}</td>
              <td>−{formatarPotencia(analise.demandaKw)}</td>
              <td>de demanda</td>
            </tr>
          ) : null}
          {analise.contagem.laboratorio > 0 ? (
            <tr>
              <th scope="row">{LABORATORIO.nomePlural}</th>
              <td>{analise.contagem.laboratorio}</td>
              <td>−{formatarPotencia(analise.contagem.laboratorio * LABORATORIO.consumoKw)}</td>
              <td>🔬</td>
            </tr>
          ) : null}
          {analise.contagem.universidade > 0 ? (
            <tr className={analise.universidadesAtivas < analise.contagem.universidade ? "extrato-alerta" : undefined}>
              <th scope="row">{UNIVERSIDADE.nomePlural}</th>
              <td>
                {analise.universidadesAtivas}/{analise.contagem.universidade}
              </td>
              <td>−{formatarPotencia(analise.universidadesAtivas * UNIVERSIDADE.consumoKw)}</td>
              <td>🔬</td>
            </tr>
          ) : null}
          {analise.contagem.subestacao > 0 ? (
            <tr>
              <th scope="row">{SUBESTACAO.nome}</th>
              <td>{analise.contagem.subestacao}</td>
              <td>{formatarPotencia(usadoTotal)}</td>
              <td>de {formatarPotencia(tetoTotal)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {analise.cabos.map((c) => (
        <p key={c.ilha} className={`extrato-linha ${c.usadoKw >= c.tetoKw - 1e-9 ? "extrato-linha--alerta" : ""}`}>
          <span>Cabo · {ilhaDef(c.ilha).nome}</span>
          <span>
            {formatarPotencia(c.usadoKw)} de {formatarPotencia(c.tetoKw)}
            {c.usadoKw >= c.tetoKw - 1e-9 ? " · no teto" : ""}
          </span>
        </p>
      ))}
      {analise.ilhasIsoladas.length > 0 ? (
        <p className="extrato-linha extrato-linha--alerta">
          <span>Sem cabo</span>
          <span>{analise.ilhasIsoladas.map((id) => ilhaDef(id).nome).join(", ")} · só alimenta os próprios bairros</span>
        </p>
      ) : null}
      <p className="extrato-nota">
        Toda usina precisa de uma subestação a até {SUBESTACAO.alcance} casas e com folga no teto. O que passa disso é
        desperdiçado. Créditos: {formatarCreditos(state.creditos)}.
      </p>
    </div>
  );
}
