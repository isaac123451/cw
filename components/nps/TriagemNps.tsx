"use client";

import { useMemo, useState } from "react";

import { ChevronDown, ChevronUp, Loader2, Siren, UserCheck } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { nomeDoCliente, segmentOf, type NpsKindOption, type NpsResponseView } from "@/lib/models/nps";
import { filaDeTriagem, ROTULO_DA_TRIAGEM, type ItemDeTriagem, type NivelDeTriagem } from "@/lib/services/nps.service";
import { descreverMinutosUteis } from "@/lib/services/horasUteis";

import { triarNpsEmLote } from "@/lib/actions/nps";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";
import { useSla } from "@/lib/context/SlaContext";
import { useToast } from "@/lib/context/ToastContext";
import { useAgora } from "@/lib/hooks/useAgora";

interface Props {
  itens: NpsResponseView[];
  tipos: NpsKindOption[];
  onOpen: (item: NpsResponseView) => void;
  /** Depois de gravar: recarregar a lista (e o workspace, se abriu revisão). */
  onAplicado: (abriuRevisao: boolean) => Promise<void> | void;
}

const NIVEIS: NivelDeTriagem[] = ["detrator-critico", "detrator", "neutro", "promotor"];

const TOM_DO_NIVEL: Record<NivelDeTriagem, string> = {
  "detrator-critico": "text-rose-700",
  detrator: "text-rose-600",
  neutro: "text-amber-700",
  promotor: "text-emerald-700",
};

/** Quantos de cada nível aparecem antes do "mostrar todos". */
const VISIVEIS = 12;

/**
 * Triagem em lote do que está parado.
 *
 * "Identificação de detratores críticos na base ativa; após isso seguir
 * para neutros" — a ordem do documento de acompanhamento do agente.
 * Parado é o ciclo aberto sem primeiro contato. Daqui dá para assumir e
 * classificar vários de uma vez; o contato em si é um a um, na ficha.
 */
export default function TriagemNps({ itens, tipos, onOpen, onAplicado }: Props) {

  const { notify } = useToast();
  const { expediente } = useSla();
  const { establishments } = useEstablishments();
  const agora = useAgora();

  const [aberta, setAberta] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [tipo, setTipo] = useState("");
  const [confirmando, setConfirmando] = useState<"tipo" | "assumir" | null>(null);
  const [gravando, setGravando] = useState(false);
  const [todosDo, setTodosDo] = useState<Set<NivelDeTriagem>>(new Set());

  const situacao = useMemo(() => {
    const mapa = new Map(establishments.map((e) => [e.id, e.status]));
    return (id: string) => mapa.get(id);
  }, [establishments]);

  const fila = useMemo(
    () => (agora ? filaDeTriagem(itens, { agora, expediente, situacaoDaConta: situacao }) : []),
    [itens, agora, expediente, situacao]
  );

  const porNivel = useMemo(() => {
    const mapa = new Map<NivelDeTriagem, ItemDeTriagem[]>();
    for (const n of NIVEIS) mapa.set(n, []);
    for (const f of fila) mapa.get(f.nivel)!.push(f);
    return mapa;
  }, [fila]);

  /* Só o que ainda está na fila conta: um ciclo contatado noutra aba sai da seleção. */
  const naFila = new Set(fila.map((f) => f.item.id));
  const escolhidos = [...selecionados].filter((id) => naFila.has(id));

  if (fila.length === 0) return null;

  const criticos = porNivel.get("detrator-critico")!.length;
  const estourados = fila.filter((f) => f.estourado).length;

  function alternar(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
    setConfirmando(null);
  }

  function selecionarNivel(nivel: NivelDeTriagem) {
    const ids = porNivel.get(nivel)!.map((f) => f.item.id);
    setSelecionados((atual) => {
      const todos = ids.every((id) => atual.has(id));
      const novo = new Set(atual);
      for (const id of ids) {
        if (todos) novo.delete(id);
        else novo.add(id);
      }
      return novo;
    });
    setConfirmando(null);
  }

  async function aplicar(qual: "tipo" | "assumir") {

    setGravando(true);

    try {
      const r = await triarNpsEmLote({
        ids: escolhidos,
        ...(qual === "tipo" ? { tipo } : { assumir: true }),
      });

      if (!r.ok) {
        notify({ tone: "error", title: "A triagem não foi aplicada.", detail: r.erro });
        return;
      }

      notify({
        tone: "success",
        title: qual === "tipo" ? `${r.atualizados} ciclo(s) classificados como ${tipo}.` : `${r.atualizados} ciclo(s) com ${r.responsavel ?? "você"} como responsável.`,
        detail: r.revisoes > 0 ? `${r.revisoes} revisão(ões) de processo abertas em Projetos e Melhorias.` : "A fila continua na mesma ordem; o próximo passo é o contato, na ficha.",
      });

      setSelecionados(new Set());
      setConfirmando(null);
      await onAplicado(r.revisoes > 0);
    } catch {
      notify({ tone: "error", title: "A triagem não foi aplicada.", detail: "Tente de novo em instantes." });
    } finally {
      setGravando(false);
    }
  }

  const tiposAtivos = tipos.filter((k) => k.active);

  return (
    <SurfaceCard
      title="Triagem do que está parado"
      description={`${fila.length} ciclo(s) abertos sem primeiro contato${estourados ? `, ${estourados} fora do prazo` : ""}. A ordem é a da rotina: detratores críticos primeiro.`}
      action={
        <button
          type="button"
          onClick={() => setAberta((v) => !v)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-violet-300 hover:text-violet-700"
        >
          {aberta ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          {aberta ? "Fechar" : "Abrir a triagem"}
        </button>
      }
      bodyClassName={aberta ? "p-0" : undefined}
    >

      {!aberta ? (
        <div className="flex flex-wrap items-center gap-2">
          {NIVEIS.map((n) => {
            const q = porNivel.get(n)!.length;
            if (q === 0) return null;
            return (
              <span key={n} className="inline-flex items-center gap-1.5 rounded-full bg-zinc-50 px-3 py-1 text-xs text-zinc-600 ring-1 ring-inset ring-zinc-200">
                {n === "detrator-critico" && <Siren size={12} className="text-rose-600" />}
                <strong className={`tabular-nums ${TOM_DO_NIVEL[n]}`}>{q}</strong> {ROTULO_DA_TRIAGEM[n].toLowerCase()}
              </span>
            );
          })}
          {criticos > 0 && (
            <button type="button" onClick={() => setAberta(true)} className="text-xs font-medium text-violet-700 hover:underline">
              Começar pelos {criticos} crítico(s)
            </button>
          )}
        </div>
      ) : (
        <div>

          {/* A barra do lote */}
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-zinc-100 bg-white/95 px-4 py-3 backdrop-blur">
            <span className="text-sm text-zinc-600">
              <strong className="tabular-nums text-zinc-900">{escolhidos.length}</strong> selecionado(s)
            </span>

            <select
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value);
                setConfirmando(null);
              }}
              className="h-9 rounded-lg border border-zinc-200 px-2 text-sm outline-none focus:border-violet-400"
            >
              <option value="">Classificar como…</option>
              {tiposAtivos.map((k) => (
                <option key={k.id} value={k.name}>
                  {k.emoji} {k.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={!tipo || escolhidos.length === 0 || gravando}
              onClick={() => setConfirmando("tipo")}
              className="h-9 rounded-lg bg-violet-700 px-3 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
            >
              Classificar
            </button>

            <button
              type="button"
              disabled={escolhidos.length === 0 || gravando}
              onClick={() => setConfirmando("assumir")}
              className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-300 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <UserCheck size={14} /> Assumir
            </button>

            {confirmando && (
              <span className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900 ring-1 ring-inset ring-violet-100 sm:w-auto">
                {confirmando === "tipo"
                  ? `Classificar ${escolhidos.length} ciclo(s) como ${tipo}${tipo === "Erro Processual" ? " (abre uma revisão de processo para cada)" : ""}?`
                  : `Ficar como responsável por ${escolhidos.length} ciclo(s)?`}
                <button type="button" onClick={() => setConfirmando(null)} className="rounded-md px-2 py-1 text-xs font-medium text-violet-800 hover:bg-violet-100">
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={gravando}
                  onClick={() => aplicar(confirmando)}
                  className="flex items-center gap-1.5 rounded-md bg-violet-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-60"
                >
                  {gravando && <Loader2 size={12} className="animate-spin" />}
                  Confirmar
                </button>
              </span>
            )}
          </div>

          {NIVEIS.map((nivel) => {
            const lista = porNivel.get(nivel)!;
            if (lista.length === 0) return null;
            const mostrar = todosDo.has(nivel) ? lista : lista.slice(0, VISIVEIS);
            const todosMarcados = lista.every((f) => selecionados.has(f.item.id));

            return (
              <div key={nivel} className="border-b border-zinc-100 last:border-b-0">

                <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-50/70 px-4 py-2">
                  <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${TOM_DO_NIVEL[nivel]}`}>
                    {nivel === "detrator-critico" && <Siren size={13} />}
                    {ROTULO_DA_TRIAGEM[nivel]} · {lista.length}
                  </p>
                  <button type="button" onClick={() => selecionarNivel(nivel)} className="text-xs font-medium text-violet-700 hover:underline">
                    {todosMarcados ? "Desmarcar" : `Selecionar os ${lista.length}`}
                  </button>
                </div>

                <ul className="divide-y divide-zinc-100">
                  {mostrar.map((f) => {
                    const cor = segmentOf(f.item.score).color;
                    return (
                      <li key={f.item.id} className={`flex items-start gap-3 px-4 py-2.5 ${f.contaInativa ? "opacity-60" : ""}`}>
                        <input
                          type="checkbox"
                          checked={selecionados.has(f.item.id)}
                          onChange={() => alternar(f.item.id)}
                          aria-label={`Selecionar ${nomeDoCliente(f.item)}`}
                          className="mt-1 h-4 w-4 shrink-0 accent-violet-700"
                        />
                        <span
                          className="mt-0.5 flex h-6 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums"
                          style={{ color: cor, background: `${cor}1a` }}
                        >
                          {f.item.score}
                        </span>
                        <span className="min-w-0 flex-1">
                          <button type="button" onClick={() => onOpen(f.item)} className="max-w-full truncate text-left text-sm font-medium text-zinc-800 hover:text-violet-700 hover:underline">
                            {nomeDoCliente(f.item)}
                          </button>
                          {f.item.comment.trim() && <span className="block truncate text-xs text-zinc-500">{f.item.comment}</span>}
                          <span className="mt-1 flex flex-wrap gap-1">
                            {f.motivos.map((m) => (
                              <span key={m} className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-inset ring-rose-100">
                                {m}
                              </span>
                            ))}
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">{f.item.kind ?? "sem tipo"}</span>
                            {f.item.owner && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">{f.item.owner}</span>}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                            f.estourado ? "bg-rose-50 text-rose-700 ring-rose-100" : "bg-sky-50 text-sky-700 ring-sky-100"
                          }`}
                        >
                          {f.estourado
                            ? f.folgaMin < 0
                              ? `atrasado ${descreverMinutosUteis(f.folgaMin, expediente)}`
                              : "fora do prazo"
                            : `vence em ${descreverMinutosUteis(f.folgaMin, expediente)}`}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {lista.length > VISIVEIS && !todosDo.has(nivel) && (
                  <button
                    type="button"
                    onClick={() => setTodosDo((atual) => new Set(atual).add(nivel))}
                    className="w-full px-4 py-2 text-left text-xs font-medium text-violet-700 hover:bg-violet-50/50"
                  >
                    Mostrar os outros {lista.length - VISIVEIS}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

    </SurfaceCard>
  );
}
