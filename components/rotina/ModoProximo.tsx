"use client";

import Link from "next/link";

import { useEffect, useMemo, useRef, useState } from "react";

import { AppWindow, ArrowUpRight, CalendarArrowUp, Check, CircleSlash, List, Loader2, ChevronLeft, ChevronRight, X } from "lucide-react";

import IconeDaFrente from "@/components/shared/IconeDaFrente";

import { useAgenda } from "@/lib/context/AgendaContext";
import { useCases } from "@/lib/context/CaseContext";
import { useJanelas } from "@/lib/context/JanelasContext";
import { useSla } from "@/lib/context/SlaContext";
import { useToast } from "@/lib/context/ToastContext";
import { filaDoDia, posicaoNaFila, resumoDosPassos, type PassoParaFechar } from "@/lib/models/guiaParaFechar";
import { frente as frenteInfo } from "@/lib/models/frentes";
import { idDaJanela, type PedidoDeJanela } from "@/lib/models/janelas";
import { isSocial } from "@/lib/services/case.service";
import { proximoDiaUtil } from "@/lib/services/horasUteis";

import type { useMeuDia } from "@/components/rotina/useMeuDia";
import { usePassosParaFechar } from "@/components/rotina/usePassosParaFechar";

type MeuDia = ReturnType<typeof useMeuDia>;

interface Props {
  dia: MeuDia;
  /** As marcas como estão na tela: atividade marcada sai da fila. */
  marcadas: Set<string>;
  onFechar: () => void;
}

/**
 * O modo próximo: a fila do dia, um item por vez.
 *
 * Em vez de quarenta links em seis listas, um item na frente, com os
 * passos que faltam para ele sair do dia. "Abrir na janela" traz a ficha
 * inteira ao lado; o que se registra ali marca o passo aqui na hora, e
 * quando o item deixa de pertencer ao dia (respondido, contatado,
 * encerrado) o modo passa sozinho para o seguinte — no mesmo lugar da
 * fila, e não de volta ao começo.
 *
 * **A ordem não muda com o modo aberto.** O Isaac: "quando realizo, vai
 * para a fila de novo e ele me direciona para aquela etapa, e preciso
 * voltar tudo". Registrar o 1º contato mudava o caso de atividade, a fila
 * se reordenava e o modo seguia o caso até a nova posição. Agora cada
 * item guarda o lugar em que apareceu; o que entra depois vai para o fim.
 */
export default function ModoProximo({ dia, marcadas, onFechar }: Props) {

  const { janelas, abrir, alternarCompleta } = useJanelas();
  const passosDe = usePassosParaFechar();
  const { tasks, toggleTask, moveTask } = useAgenda();
  const { cases } = useCases();
  const { expediente } = useSla();
  const { notify } = useToast();
  const [gravando, setGravando] = useState<"concluir" | "adiar" | "feito" | "tirar" | null>(null);
  const [verFila, setVerFila] = useState(false);

  const base = useMemo(
    () => (dia.contagens ? filaDoDia(dia.doDia, dia.contagens, marcadas) : []),
    [dia.doDia, dia.contagens, marcadas]
  );

  /* O lugar de cada item, na ordem em que apareceu desde que o modo abriu. */
  const [ordem, setOrdem] = useState<string[]>([]);
  const novosNaFila = base.filter((i) => !ordem.includes(i.chave));
  if (novosNaFila.length) setOrdem([...ordem, ...novosNaFila.map((i) => i.chave)]);

  const fila = useMemo(() => {
    const lugar = new Map(ordem.map((k, n) => [k, n]));
    return [...base].sort((x, y) => (lugar.get(x.chave) ?? Infinity) - (lugar.get(y.chave) ?? Infinity));
  }, [base, ordem]);

  const [chave, setChave] = useState<string | null>(null);
  const [indice, setIndice] = useState(0);
  const [saidos, setSaidos] = useState<string[]>([]);
  const [recemSaido, setRecemSaido] = useState<string | null>(null);


  const posicao = posicaoNaFila(fila, chave, indice);
  const item = posicao >= 0 ? fila[posicao] : null;

  /* O item atual saiu da fila: foi resolvido em algum lugar. Fica o aviso, e a fila segue do mesmo ponto. */
  const anterior = useRef<{ chave: string; titulo: string } | null>(null);
  useEffect(() => {
    const antes = anterior.current;
    if (antes && !fila.some((i) => i.chave === antes.chave)) {
      setSaidos((s) => (s.includes(antes.chave) ? s : [...s, antes.chave]));
      setRecemSaido(antes.titulo);
      const t = window.setTimeout(() => setRecemSaido(null), 5000);
      anterior.current = item ? { chave: item.chave, titulo: item.titulo } : null;
      setChave(item?.chave ?? null);
      setIndice(Math.max(posicao, 0));
      return () => window.clearTimeout(t);
    }
    anterior.current = item ? { chave: item.chave, titulo: item.titulo } : null;
  }, [fila, item, posicao]);

  function irPara(i: number) {
    if (fila.length === 0) return;
    const n = (i + fila.length) % fila.length;
    setIndice(n);
    setChave(fila[n].chave);
    setRecemSaido(null);
  }

  /* ← e → andam pela fila, fora de campo de texto e sem janela em foco de digitação. */
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return;
      if (e.key === "ArrowRight") irPara(posicao + 1);
      else if (e.key === "ArrowLeft") irPara(posicao - 1);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  /*
    Atividade da agenda: conclui ou passa para o próximo dia útil aqui
    mesmo. Com protocolo vinculado, a ficha do caso vem junto.
  */
  const tarefa = item && !item.frente && item.chave.startsWith("pendencias:") ? tasks.find((t) => t.id === item.ref) ?? null : null;
  const casoDaTarefa = tarefa?.relatedCase ? cases.find((c) => c.protocol === tarefa.relatedCase) ?? null : null;

  const ficha: PedidoDeJanela | null =
    item?.janela ??
    (casoDaTarefa ? { frente: isSocial(casoDaTarefa) ? "redes" : "reclame-aqui", ref: casoDaTarefa.id, titulo: casoDaTarefa.title } : null);

  /*
    Feito hoje / não se aplica: sai de todas as atividades em que está
    hoje. Nada muda no caso — é o Meu dia que deixa de pedir o item.
  */
  async function tirarDoDia(tipo: "feito" | "tirar") {
    if (!item || gravando) return;
    setGravando(tipo);
    try {
      const r = await dia.marcarItens(
        item.chaves.map((c) => ({ chave: c, item: item.chave, titulo: item.titulo })),
        tipo === "feito" ? "feito" : "dispensado",
        "hoje"
      );
      if (!r.ok) {
        notify({ tone: "error", title: "O item não saiu da fila.", detail: r.erro });
        return;
      }
      notify({
        tone: "success",
        title: tipo === "feito" ? "Marcado como feito hoje." : "Tirado do dia.",
        detail: `${item.titulo} — dá para devolver na lista da atividade, em Rotina de hoje.`,
      });
    } catch {
      notify({ tone: "error", title: "O item não saiu da fila.", detail: "Tente de novo em instantes." });
    } finally {
      setGravando(null);
    }
  }

  async function gravarTarefa(tipo: "concluir" | "adiar") {
    if (!tarefa || gravando) return;
    setGravando(tipo);
    const dia2 = tipo === "adiar" && dia.hoje ? proximoDiaUtil(dia.hoje, expediente) : null;
    const r = tipo === "concluir" ? await toggleTask(tarefa.id) : await moveTask(tarefa.id, dia2!);
    setGravando(null);
    if (r.ok) {
      notify({
        tone: "success",
        title: tipo === "concluir" ? "Atividade concluída." : `Atividade passada para ${dia2!.split("-").reverse().slice(0, 2).join("/")}.`,
        detail: tarefa.title,
      });
    }
  }

  function abrirNaJanela() {
    if (!ficha) return;
    abrir(ficha);
    const id = idDaJanela(ficha.frente, ficha.ref);
    if (!janelas.find((j) => j.id === id)?.completa) alternarCompleta(id);
  }

  /* A barra mede o que saiu da fila desde que o modo abriu, contra o que ainda resta — o devolvido volta a contar como aberto. */
  const fechados = saidos.filter((k) => !fila.some((i) => i.chave === k));
  const total = fila.length + fechados.length;
  const pct = total ? Math.round((fechados.length / total) * 100) : 0;

  const passos = ficha ? passosDe(ficha.frente, ficha.ref) : null;
  const resumo = passos ? resumoDosPassos(passos) : null;

  return (
    <section aria-label="Modo próximo" className="min-w-0 overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

      <header className="flex items-center gap-3 border-b border-zinc-100 px-5 py-2.5">
        <p className="text-[13px] font-semibold text-zinc-900">Um por vez</p>
        {fila.length > 0 && (
          <span className="text-xs tabular-nums text-zinc-500">
            {posicao + 1} de {fila.length}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {fila.length > 1 && (
            <button
              type="button"
              onClick={() => setVerFila((v) => !v)}
              aria-expanded={verFila}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${verFila ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"}`}
            >
              <List size={13} /> Ver a fila
            </button>
          )}
          {fechados.length > 0 && (
            <span className="hidden items-center gap-2 text-xs text-zinc-500 sm:flex">
              <span className="tabular-nums">{fechados.length} fechado(s) agora</span>
              <span className="h-1 w-20 overflow-hidden rounded-full bg-zinc-100">
                <span className="block h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${pct}%` }} />
              </span>
            </span>
          )}
          <button type="button" onClick={onFechar} aria-label="Sair do modo um por vez" className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <X size={15} />
          </button>
        </div>
      </header>

      {verFila && fila.length > 0 && (
        <ol className="max-h-64 overflow-y-auto overscroll-contain border-b border-zinc-100 px-3 py-1.5">
          {fila.map((i, n) => (
            <li key={i.chave}>
              <button
                type="button"
                onClick={() => {
                  irPara(n);
                  setVerFila(false);
                }}
                aria-current={n === posicao}
                className={`flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-xs ${n === posicao ? "bg-violet-50 text-violet-900" : "text-zinc-700 hover:bg-zinc-50"}`}
              >
                <span className="w-6 shrink-0 text-right tabular-nums text-zinc-400">{n + 1}</span>
                {i.frente ? <IconeDaFrente frente={i.frente} size={12} /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" />}
                <span className={`min-w-0 flex-1 truncate ${i.atrasado ? "text-rose-700" : ""}`}>{i.titulo}</span>
                <span className="hidden max-w-[40%] shrink-0 truncate text-[11px] text-zinc-400 sm:block">{i.atividades.join(" · ")}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {recemSaido && (
        <p className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/60 px-5 py-1.5 text-xs text-emerald-800">
          <Check size={13} strokeWidth={2.5} />
          <span className="min-w-0 truncate">
            <strong className="font-medium">{recemSaido}</strong> saiu do dia.
          </span>
        </p>
      )}

      {/* `carregando` junto: sem ele, a rotina que ainda não chegou passava
          por rotina vazia e o modo anunciava "está marcada" antes da hora. */}
      {dia.carregando || !dia.contagens ? (
        <p className="px-5 py-8 text-center text-sm text-zinc-400">Lendo a fila do dia…</p>
      ) : !item ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium text-zinc-800">Nada na fila das atividades abertas.</p>
          <p className="mt-1 text-xs text-zinc-500">
            {dia.doDia.some((a) => !marcadas.has(a.id)) ? "O que resta é marcar as atividades feitas e salvar." : "A rotina de hoje está marcada."}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              {item.frente && (
                <span className="flex items-center gap-1 font-medium text-zinc-600">
                  <IconeDaFrente frente={item.frente} size={12} />
                  {frenteInfo(item.frente).curto}
                </span>
              )}
              <span className="truncate">{item.atividades.join(" · ")}</span>
            </div>

            <h3 className="mt-1.5 text-[15px] font-semibold leading-snug text-zinc-900 [overflow-wrap:anywhere]">{item.titulo}</h3>
            {item.detalhe && <p className="mt-0.5 text-xs text-zinc-500 [overflow-wrap:anywhere]">{item.detalhe}</p>}
            {item.atrasado && (
              <span className="mt-2 inline-block rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-100">fora do prazo</span>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {tarefa && (
                <>
                  <button
                    type="button"
                    onClick={() => gravarTarefa("concluir")}
                    disabled={gravando !== null}
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                  >
                    {gravando === "concluir" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={2.5} />} Concluir atividade
                  </button>
                  <button
                    type="button"
                    onClick={() => gravarTarefa("adiar")}
                    disabled={gravando !== null || !dia.hoje}
                    title="Passa para o próximo dia útil, no mesmo horário"
                    className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    {gravando === "adiar" ? <Loader2 size={14} className="animate-spin" /> : <CalendarArrowUp size={14} />} Próximo dia útil
                  </button>
                </>
              )}
              {ficha ? (
                <button
                  type="button"
                  onClick={abrirNaJanela}
                  className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${tarefa ? "text-zinc-700 hover:bg-zinc-100" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}
                >
                  <AppWindow size={14} /> {tarefa ? "Caso na janela" : "Abrir na janela"}
                </button>
              ) : null}
              <Link
                href={item.href}
                className={`flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium ${ficha || tarefa ? "text-zinc-600 hover:bg-zinc-100" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}
              >
                {tarefa ? "Agenda" : item.janela ? "Tela cheia" : "Abrir"} <ArrowUpRight size={13} />
              </Link>
              {!tarefa && (
                <>
                  <button
                    type="button"
                    onClick={() => tirarDoDia("feito")}
                    disabled={gravando !== null}
                    title="Fiz por fora (ou o registro não acompanhou): sai da fila e das atividades de hoje"
                    className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                  >
                    {gravando === "feito" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={2.5} />} Feito hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => tirarDoDia("tirar")}
                    disabled={gravando !== null}
                    title="Não se aplica hoje: sai da fila e volta amanhã, se ainda for trabalho"
                    className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-60"
                  >
                    {gravando === "tirar" ? <Loader2 size={14} className="animate-spin" /> : <CircleSlash size={14} />} Tirar do dia
                  </button>
                </>
              )}
              <div className="ml-auto flex items-center">
                <button type="button" onClick={() => irPara(posicao - 1)} disabled={fila.length < 2} title="Anterior (←)" aria-label="Item anterior" className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 disabled:opacity-40">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" onClick={() => irPara(posicao + 1)} disabled={fila.length < 2} title="Pular para o próximo (→)" className="flex h-8 items-center gap-0.5 rounded-lg pl-2 pr-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40">
                  Pular <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>

          <div className="min-w-0 md:border-l md:border-zinc-100 md:pl-5">
            {passos ? (
              <>
                <p className="text-[11px] font-medium text-zinc-500">
                  {resumo!.total > 0 ? `${resumo!.feitos} de ${resumo!.total} passos` : "Passos"}
                </p>
                <ol className="mt-2 space-y-1.5">
                  {passos.map((p) => (
                    <Passo key={p.id} passo={p} />
                  ))}
                </ol>
              </>
            ) : (
              <p className="text-xs leading-relaxed text-zinc-500">
                {tarefa
                  ? "Atividade da agenda: concluída aqui, sai da fila e da Agenda."
                  : ficha
                    ? "Os passos desta ficha aparecem quando ela carregar — abra na janela para ver tudo."
                    : "Este item se resolve na própria tela: abra, conclua e ele sai da fila."}
              </p>
            )}
          </div>

        </div>
      )}
    </section>
  );
}

function Passo({ passo }: { passo: PassoParaFechar }) {
  const { estado } = passo;
  return (
    <li className="flex min-w-0 items-start gap-2.5">
      <span
        aria-hidden
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
          estado === "feito"
            ? "bg-emerald-500 text-white"
            : estado === "atual"
              ? "border-[1.5px] border-zinc-900 bg-white text-zinc-900"
              : estado === "opcional"
                ? "border border-dashed border-zinc-300"
                : "border border-zinc-300"
        }`}
      >
        {estado === "feito" && <Check size={10} strokeWidth={3} />}
        {estado === "atual" && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </span>
      <div className="min-w-0">
        <p
          className={`text-xs leading-4 ${
            estado === "feito" ? "text-zinc-400" : estado === "atual" ? "font-semibold text-zinc-900" : "text-zinc-600"
          }`}
        >
          {passo.titulo}
          {estado === "opcional" && <span className="font-normal text-zinc-400"> · se couber</span>}
          <span className="sr-only"> — {estado}</span>
        </p>
        {estado === "atual" && passo.detalhe && (
          <p className={`mt-0.5 text-[11px] leading-snug [overflow-wrap:anywhere] ${passo.alerta ? "text-rose-700" : "text-zinc-500"}`}>{passo.detalhe}</p>
        )}
      </div>
    </li>
  );
}
