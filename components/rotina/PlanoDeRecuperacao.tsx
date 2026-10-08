"use client";

import { useEffect, useState, useTransition } from "react";

import { Loader2, SlidersHorizontal } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import IconeDaFrente from "@/components/shared/IconeDaFrente";

import { salvarAjusteDaRecuperacao } from "@/lib/actions/recuperacao";
import { frente as frenteInfo, type FrenteId } from "@/lib/models/frentes";
import { diaCurtoDaMarca } from "@/lib/models/meuDia";
import {
  AJUSTE_PADRAO,
  cotasOferecidas,
  FRENTES_DA_RECUPERACAO,
  LIMITES,
  planoDeRecuperacao,
  type AjusteDaFrente,
  type AjusteDaRecuperacao,
} from "@/lib/models/recuperacao";
import { useSla } from "@/lib/context/SlaContext";
import { useToast } from "@/lib/context/ToastContext";

import {
  adiantarHoje,
  chaveDaCota,
  chaveDoInicio,
  definirAjusteDaRecuperacao,
  esquecerCotasDoDia,
  gravarGuardado,
  lerTexto,
  useAjusteDaRecuperacao,
  useOQueValeHoje,
  type PlanoDaFrenteHoje,
} from "@/components/rotina/recuperacaoDoDia";
import type { useMeuDia } from "@/components/rotina/useMeuDia";

type MeuDia = ReturnType<typeof useMeuDia>;

const DIA_DA_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const nomeDoDia = (dia: string) => DIA_DA_SEMANA[new Date(`${dia}T12:00:00Z`).getUTCDay()];

/** De quanto em quanto "adiantar" soma ao dia, depois de batida a cota. */
const PASSO_DE_ADIANTAR = 10;

/**
 * O plano de recuperação do acumulado, no Meu dia (Fase 24; ajustável na
 * 1.122; "o que vale hoje" na 1.124).
 *
 * Aparece para as frentes que passam do mínimo de cada uma (10 fora do
 * prazo, se ninguém ajustou). Diz a cota que zera no prazo escolhido ("30
 * por dia, zera na quarta"), deixa trocar a cota do dia, mostra quanto
 * saiu hoje — e, desde a 1.124, quantos do acumulado ficam para os
 * próximos dias: a fila do dia só leva a cota. Batida a cota, "adiantar"
 * traz mais 10 para hoje.
 */
export default function PlanoDeRecuperacao({ dia, ajustarInicial = false }: { dia: MeuDia; ajustarInicial?: boolean }) {

  const ajuste = useAjusteDaRecuperacao();
  const [ajustando, setAjustando] = useState(ajustarInicial);
  const { planos, paraDepois } = useOQueValeHoje(dia, dia.feitasHoje);

  if (dia.carregando || !dia.hoje || !ajuste) return null;
  if (planos.length === 0 && !ajustando) return null;

  return (
    <SurfaceCard className="p-0">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-100 px-5 py-3">
        <div>
          <h2 className="text-[13px] font-semibold text-zinc-900">Plano de recuperação do acumulado</h2>
          <p className="mt-0.5 text-xs text-zinc-500">O que está fora do prazo não cabe num dia. Uma cota por dia útil — só ela entra na fila de hoje —, e o dia em que zera.</p>
        </div>
        {!ajustando && (
          <button
            type="button"
            onClick={() => setAjustando(true)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            <SlidersHorizontal size={13} /> Ajustar
          </button>
        )}
      </div>

      {ajustando && (
        <EditorDoPlano
          ajuste={ajuste}
          onFechar={() => setAjustando(false)}
          onSalvo={(novo) => {
            definirAjusteDaRecuperacao(novo);
            setAjustando(false);
          }}
        />
      )}

      {planos.length > 0 ? (
        <ul className="divide-y divide-zinc-100">
          {planos.map((p) => (
            <LinhaDaFrente key={p.frente} plano={p} depois={paraDepois.get(p.frente) ?? 0} hoje={dia.hoje!} />
          ))}
        </ul>
      ) : (
        <p className="px-5 py-3 text-xs text-zinc-500">Nenhuma frente passa do mínimo hoje — o plano aparece aqui quando passar.</p>
      )}
    </SurfaceCard>
  );
}

const campo =
  "h-8 w-16 rounded-lg border border-zinc-200 bg-white px-2 text-right text-sm tabular-nums outline-none transition-colors focus:border-violet-400";

/** O ajuste por frente, na própria tela — e só vai à conta no Salvar. */
function EditorDoPlano({ ajuste, onFechar, onSalvo }: { ajuste: AjusteDaRecuperacao; onFechar: () => void; onSalvo: (a: AjusteDaRecuperacao) => void }) {
  const { notify } = useToast();
  const [rascunho, setRascunho] = useState<AjusteDaRecuperacao>(ajuste);
  const [salvando, startSalvar] = useTransition();
  const sujo = JSON.stringify(rascunho) !== JSON.stringify(ajuste);

  const mudar = (f: FrenteId, parte: Partial<AjusteDaFrente>) => setRascunho((r) => ({ ...r, [f]: { ...r[f], ...parte } }));

  const salvar = () =>
    startSalvar(async () => {
      const r = await salvarAjusteDaRecuperacao(rascunho);
      if (r.erro || !r.ajuste) {
        notify({ tone: "error", title: "Não foi possível salvar o plano.", detail: r.erro });
        return;
      }
      esquecerCotasDoDia();
      notify({ tone: "success", title: "Plano de recuperação salvo.", detail: "Vale a partir de agora, para você." });
      onSalvo(r.ajuste);
    });

  return (
    <div className="border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400">
              <th className="py-1.5 pr-3 font-semibold">Frente</th>
              <th className="px-2 py-1.5 font-semibold">Mostrar</th>
              <th className="px-2 py-1.5 font-semibold">A partir de</th>
              <th className="px-2 py-1.5 font-semibold">Zerar em</th>
              <th className="py-1.5 pl-2 font-semibold">Cota por dia</th>
            </tr>
          </thead>
          <tbody>
            {FRENTES_DA_RECUPERACAO.map((f) => {
              const a = rascunho[f];
              return (
                <tr key={f} className={a.ligado ? "" : "text-zinc-400"}>
                  <td className="py-1.5 pr-3">
                    <span className="flex items-center gap-1.5">
                      <IconeDaFrente frente={f} size={13} />
                      {frenteInfo(f).nome}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={a.ligado}
                      onChange={(e) => mudar(f, { ligado: e.target.checked })}
                      aria-label={`Mostrar o plano de ${frenteInfo(f).nome}`}
                      className="h-4 w-4 accent-violet-700"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <input
                        type="number"
                        min={LIMITES.minimo[0]}
                        max={LIMITES.minimo[1]}
                        value={a.minimo}
                        disabled={!a.ligado}
                        onChange={(e) => mudar(f, { minimo: Number(e.target.value) || AJUSTE_PADRAO.minimo })}
                        aria-label={`A partir de quantos fora do prazo em ${frenteInfo(f).nome}`}
                        className={campo}
                      />
                      fora do prazo
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <input
                        type="number"
                        min={LIMITES.dias[0]}
                        max={LIMITES.dias[1]}
                        value={a.dias}
                        disabled={!a.ligado || a.cota !== null}
                        onChange={(e) => mudar(f, { dias: Number(e.target.value) || AJUSTE_PADRAO.dias })}
                        aria-label={`Em quantos dias úteis zerar ${frenteInfo(f).nome}`}
                        className={campo}
                      />
                      dias úteis
                    </span>
                  </td>
                  <td className="py-1.5 pl-2">
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <select
                        value={a.cota === null ? "sugerida" : "fixa"}
                        disabled={!a.ligado}
                        onChange={(e) => mudar(f, { cota: e.target.value === "sugerida" ? null : a.cota ?? 20 })}
                        aria-label={`Cota de ${frenteInfo(f).nome}`}
                        className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-violet-400"
                      >
                        <option value="sugerida">Sugerida pelo prazo</option>
                        <option value="fixa">Fixa</option>
                      </select>
                      {a.cota !== null && (
                        <input
                          type="number"
                          min={LIMITES.cota[0]}
                          max={LIMITES.cota[1]}
                          value={a.cota}
                          disabled={!a.ligado}
                          onChange={(e) => mudar(f, { cota: Number(e.target.value) || 1 })}
                          aria-label={`Cota fixa por dia de ${frenteInfo(f).nome}`}
                          className={campo}
                        />
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">Com cota fixa, o prazo deixa de valer: o dia em que zera sai da cota.</p>
        <div className="flex gap-2">
          <button type="button" onClick={onFechar} className="h-8 rounded-lg px-3 text-sm text-zinc-600 hover:text-zinc-900">
            {sujo ? "Descartar" : "Fechar"}
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={!sujo || salvando}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-violet-800 px-3 text-sm font-medium text-white transition-colors hover:bg-violet-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvando && <Loader2 size={13} className="animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function LinhaDaFrente({ plano, depois, hoje }: { plano: PlanoDaFrenteHoje; depois: number; hoje: string }) {

  const { expediente } = useSla();
  const { frente, acumulado, naFrente, cota, saiu, restante, adiantado, ajuste } = plano;

  /* A primeira abertura do dia fica guardada: é a régua do "saiu hoje". */
  useEffect(() => {
    let guardado: { dia?: string } | null = null;
    try {
      guardado = JSON.parse(lerTexto(chaveDoInicio(frente)) ?? "null");
    } catch {
      guardado = null;
    }
    if (guardado?.dia !== hoje) gravarGuardado(chaveDoInicio(frente), { dia: hoje, n: naFrente });
  }, [frente, hoje, naFrente]);

  /* Com a cota valendo para a frente inteira, zera quando a frente inteira cabe na cota. */
  const zera = planoDeRecuperacao(naFrente, cota, hoje, expediente);
  const dandoConta = cota > 0 && saiu >= cota;
  const pct = cota > 0 ? Math.min(100, Math.round((saiu / cota) * 100)) : 0;
  const info = frenteInfo(frente);

  return (
    <li className="grid gap-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-zinc-800">
          <IconeDaFrente frente={frente} size={13} />
          <strong className="font-semibold tabular-nums">{acumulado}</strong> {info.nome} fora do prazo
          {zera && (
            <span className="text-zinc-500">
              · {cota} por dia, zera {zera.dias === 1 ? "hoje" : `${zera.zeraEm === hoje ? "hoje" : `na ${nomeDoDia(zera.zeraEm)}`} (${diaCurtoDaMarca(zera.zeraEm)})`}
            </span>
          )}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
          <span className="h-1.5 w-32 overflow-hidden rounded-full bg-zinc-100" role="img" aria-label={`${saiu} de ${cota} hoje`}>
            <span className={`block h-full rounded-full ${dandoConta ? "bg-emerald-500" : "bg-violet-500"}`} style={{ width: `${pct}%` }} />
          </span>
          <span className={`tabular-nums ${dandoConta ? "font-medium text-emerald-700" : "text-zinc-500"}`}>
            {dandoConta ? `cota de hoje batida: ${saiu} saíram` : `hoje: ${saiu} de ${cota} · faltam ${Math.max(0, cota - saiu)}`}
          </span>
          {depois > 0 && (
            <span className="text-zinc-500">
              · <span className="tabular-nums">{depois}</span> ficam para os próximos dias
              {restante === 0 && (
                <button
                  type="button"
                  onClick={() => adiantarHoje(frente, hoje, adiantado, PASSO_DE_ADIANTAR)}
                  className="ml-1.5 font-medium text-violet-700 underline-offset-2 hover:underline"
                >
                  adiantar mais {Math.min(PASSO_DE_ADIANTAR, depois)}
                </button>
              )}
            </span>
          )}
        </div>
      </div>
      <div role="group" aria-label={`Cota por dia de ${info.nome}`} className="flex items-center gap-0.5 text-xs">
        <span className="mr-1 text-zinc-400">por dia</span>
        {cotasOferecidas(acumulado, ajuste.dias, ajuste.cota).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={cota === c}
            onClick={() => gravarGuardado(chaveDaCota(frente), c)}
            className={`rounded-md px-2 py-1 font-medium tabular-nums ${cota === c ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
          >
            {c}
          </button>
        ))}
      </div>
    </li>
  );
}
