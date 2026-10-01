"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";

import { Loader2, SlidersHorizontal } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import IconeDaFrente from "@/components/shared/IconeDaFrente";

import { salvarAjusteDaRecuperacao } from "@/lib/actions/recuperacao";
import { leitura } from "@/lib/lote";
import { filaDoDia } from "@/lib/models/guiaParaFechar";
import { frente as frenteInfo, type FrenteId } from "@/lib/models/frentes";
import { diaCurtoDaMarca } from "@/lib/models/meuDia";
import {
  AJUSTE_PADRAO,
  ajusteValido,
  cotaDaFrente,
  cotasOferecidas,
  frentesNoPlano,
  FRENTES_DA_RECUPERACAO,
  LIMITES,
  planoDeRecuperacao,
  ritmoDeHoje,
  type AjusteDaFrente,
  type AjusteDaRecuperacao,
} from "@/lib/models/recuperacao";
import { useSla } from "@/lib/context/SlaContext";
import { useToast } from "@/lib/context/ToastContext";

import type { useMeuDia } from "@/components/rotina/useMeuDia";

type MeuDia = ReturnType<typeof useMeuDia>;

/* Em lote, por rota (1.116): sai junto com as outras leituras do Meu dia. */
const lerAjusteDaRecuperacao = leitura("recuperacao");

/*
  A cota escolhida no dia (os botões da linha) e o número da primeira
  abertura do dia ficam no navegador de quem trabalha: são conveniência de
  quem olha, não dado da operação. O ajuste de cada frente (aparecer,
  mínimo, prazo, cota fixa) fica na conta (1.122).
*/
const EVENTO = "cw:recuperacao";
const PREFIXO_DA_COTA = "cw:recuperacao:cota:";

function lerTexto(chave: string) {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}
function gravar(chave: string, valor: unknown) {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem armazenamento: segue com o que está na tela */
  }
  window.dispatchEvent(new Event(EVENTO));
}
/** Depois de salvar o ajuste, as escolhas rápidas do dia saem — vale o que foi salvo. */
function esquecerCotasDoDia() {
  try {
    for (const f of FRENTES_DA_RECUPERACAO) window.localStorage.removeItem(`${PREFIXO_DA_COTA}${f}`);
  } catch {
    /* sem armazenamento: nada guardado */
  }
  window.dispatchEvent(new Event(EVENTO));
}
function ouvir(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

/* No servidor e na hidratação, nada guardado: o valor do navegador entra logo depois, sem divergir. */
function useGuardado<T>(chave: string): T | null {
  const texto = useSyncExternalStore(ouvir, () => lerTexto(chave), () => null);
  try {
    return texto ? (JSON.parse(texto) as T) : null;
  } catch {
    return null;
  }
}

const DIA_DA_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const nomeDoDia = (dia: string) => DIA_DA_SEMANA[new Date(`${dia}T12:00:00Z`).getUTCDay()];

/**
 * O plano de recuperação do acumulado, no Meu dia (Fase 24; ajustável na
 * 1.122).
 *
 * Aparece para as frentes que passam do mínimo de cada uma (10 fora do
 * prazo, se ninguém ajustou). Diz a cota que zera no prazo escolhido ("30
 * por dia, zera na quarta"), deixa trocar a cota do dia, e mostra quanto
 * saiu hoje. "Ajustar" abre, na própria tela, o ajuste por frente —
 * também pela central de Configurações (`/meu-dia?configurar=recuperacao`),
 * que abre mesmo sem acumulado.
 */
export default function PlanoDeRecuperacao({ dia, ajustarInicial = false }: { dia: MeuDia; ajustarInicial?: boolean }) {

  const [ajuste, setAjuste] = useState<AjusteDaRecuperacao | null>(null);
  const [ajustando, setAjustando] = useState(ajustarInicial);

  useEffect(() => {
    let vivo = true;
    lerAjusteDaRecuperacao()
      .then((a) => vivo && setAjuste(ajusteValido(a)))
      .catch(() => vivo && setAjuste(ajusteValido(null)));
    return () => {
      vivo = false;
    };
  }, []);

  const acumulados = useMemo(() => {
    if (!dia.contagens || !ajuste) return [];
    const vencidos = filaDoDia(dia.doDia, dia.contagens).filter((i) => i.atrasado && i.frente);
    const porFrente = new Map<FrenteId, number>();
    for (const i of vencidos) porFrente.set(i.frente!, (porFrente.get(i.frente!) ?? 0) + 1);
    return frentesNoPlano(porFrente, ajuste);
  }, [dia.doDia, dia.contagens, ajuste]);

  if (dia.carregando || !dia.hoje || !ajuste) return null;
  if (acumulados.length === 0 && !ajustando) return null;

  return (
    <SurfaceCard className="p-0">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-100 px-5 py-3">
        <div>
          <h2 className="text-[13px] font-semibold text-zinc-900">Plano de recuperação do acumulado</h2>
          <p className="mt-0.5 text-xs text-zinc-500">O que está fora do prazo não cabe num dia. Uma cota por dia útil, e o dia em que zera.</p>
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
            setAjuste(novo);
            setAjustando(false);
          }}
        />
      )}

      {acumulados.length > 0 ? (
        <ul className="divide-y divide-zinc-100">
          {acumulados.map(([f, n]) => (
            <LinhaDaFrente key={f} frente={f} acumulado={n} hoje={dia.hoje!} ajuste={ajuste[f]} />
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

function LinhaDaFrente({ frente, acumulado, hoje, ajuste }: { frente: FrenteId; acumulado: number; hoje: string; ajuste: AjusteDaFrente }) {

  const { expediente } = useSla();
  const chaveDaCota = `${PREFIXO_DA_COTA}${frente}`;
  const chaveDoInicio = `cw:recuperacao:inicio:${frente}`;

  const cota = useGuardado<number>(chaveDaCota) ?? cotaDaFrente(acumulado, ajuste);
  const salvo = useGuardado<{ dia: string; n: number }>(chaveDoInicio);
  const inicio = salvo?.dia === hoje ? salvo.n : acumulado;

  /* A primeira abertura do dia fica guardada: é a régua do "saiu hoje". */
  useEffect(() => {
    let guardado: { dia?: string } | null = null;
    try {
      guardado = JSON.parse(lerTexto(chaveDoInicio) ?? "null");
    } catch {
      guardado = null;
    }
    if (guardado?.dia !== hoje) gravar(chaveDoInicio, { dia: hoje, n: acumulado });
  }, [chaveDoInicio, hoje, acumulado]);

  const plano = planoDeRecuperacao(acumulado, cota, hoje, expediente);
  const ritmo = ritmoDeHoje(inicio, acumulado, cota);
  const pct = cota > 0 ? Math.min(100, Math.round((ritmo.saiu / cota) * 100)) : 0;
  const info = frenteInfo(frente);

  return (
    <li className="grid gap-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm text-zinc-800">
          <IconeDaFrente frente={frente} size={13} />
          <strong className="font-semibold tabular-nums">{acumulado}</strong> {info.nome} fora do prazo
          {plano && (
            <span className="text-zinc-500">
              {" "}· {cota} por dia, zera {plano.dias === 1 ? "hoje" : `${plano.zeraEm === hoje ? "hoje" : `na ${nomeDoDia(plano.zeraEm)}`} (${diaCurtoDaMarca(plano.zeraEm)})`}
            </span>
          )}
        </p>
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <span className="h-1.5 w-32 overflow-hidden rounded-full bg-zinc-100" role="img" aria-label={`${ritmo.saiu} de ${cota} hoje`}>
            <span className={`block h-full rounded-full ${ritmo.dandoConta ? "bg-emerald-500" : "bg-violet-500"}`} style={{ width: `${pct}%` }} />
          </span>
          <span className={`tabular-nums ${ritmo.dandoConta ? "font-medium text-emerald-700" : "text-zinc-500"}`}>
            {ritmo.dandoConta ? `cota de hoje batida: ${ritmo.saiu} saíram` : `hoje: ${ritmo.saiu} de ${cota} · faltam ${ritmo.falta}`}
          </span>
        </div>
      </div>
      <div role="group" aria-label={`Cota por dia de ${info.nome}`} className="flex items-center gap-0.5 text-xs">
        <span className="mr-1 text-zinc-400">por dia</span>
        {cotasOferecidas(acumulado, ajuste.dias, ajuste.cota).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={cota === c}
            onClick={() => gravar(chaveDaCota, c)}
            className={`rounded-md px-2 py-1 font-medium tabular-nums ${cota === c ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
          >
            {c}
          </button>
        ))}
      </div>
    </li>
  );
}
