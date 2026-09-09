import { MARCOS_KARDASHEV } from "../content/kardashev";
import { formatarNumero, formatarPotencia } from "../sim/formatar";
import { formatarWatts, indiceK, kVisivel, posicaoNaBarra, potenciaInstaladaW, proximoMarco } from "../sim/kardashev";
import { useGameStore } from "../store/gameStore";

export function PainelKardashev() {
  const state = useGameStore((s) => s.state);
  const w = potenciaInstaladaW(state);
  const k = indiceK(w);
  const proximo = proximoMarco(w);
  const pos = posicaoNaBarra(w);

  return (
    <section className="painel painel-kardashev" aria-label="Medidor Kardashev">
      <div className="kardashev-cabecalho">
        <h2>Medidor Kardashev</h2>
        <div className="kardashev-valores">
          <span className="kardashev-p">P = {formatarWatts(w)}</span>
          <span className="kardashev-k">
            {k !== null && kVisivel(w) ? `K = ${formatarNumero(k, 2)}` : "K abaixo da escala"}
          </span>
          {proximo ? (
            <span className="kardashev-proximo">
              próximo: {proximo.nome} · faltam {formatarPotencia((proximo.watts - w) / 1000)}
            </span>
          ) : (
            <span className="kardashev-proximo">além do Sol</span>
          )}
        </div>
      </div>
      <div className="kardashev-barra" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={pos}>
        <div className="kardashev-preenchida" style={{ width: `${pos * 100}%` }} />
        {MARCOS_KARDASHEV.map((m) => (
          <div
            key={m.id}
            className={`kardashev-marco ${m.auxiliar ? "kardashev-marco--auxiliar" : ""} ${w >= m.watts ? "kardashev-marco--passado" : ""}`}
            style={{ left: `${posicaoNaBarra(m.watts) * 100}%` }}
            title={`${m.nome}: ${formatarWatts(m.watts)} — ${m.texto}`}
          >
            <span className="kardashev-marco-rotulo kardashev-marco-rotulo--longo">{m.nome}</span>
            <span className="kardashev-marco-rotulo kardashev-marco-rotulo--curto">{m.nomeCurto}</span>
          </div>
        ))}
        <div className="kardashev-cursor" style={{ left: `${pos * 100}%` }} />
      </div>
    </section>
  );
}
