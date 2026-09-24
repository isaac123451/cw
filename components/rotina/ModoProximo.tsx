"use client";

import Link from "next/link";
import LinksDoRa from "@/components/shared/LinksDoRa";

import { useEffect, useMemo, useRef, useState } from "react";

import { AppWindow, ArrowUpRight, CalendarArrowUp, CalendarClock, Check, CircleSlash, List, Loader2, ChevronLeft, ChevronRight, Timer, X } from "lucide-react";

import IconeDaFrente from "@/components/shared/IconeDaFrente";
import OpcoesDeAdiar from "@/components/rotina/OpcoesDeAdiar";

import { useAgenda } from "@/lib/context/AgendaContext";
import { useCases } from "@/lib/context/CaseContext";
import { useJanelas } from "@/lib/context/JanelasContext";
import { useSla } from "@/lib/context/SlaContext";
import { useToast } from "@/lib/context/ToastContext";
import { filaDoDia, posicaoNaFila, resumoDosPassos, type ItemDaFila, type PassoParaFechar } from "@/lib/models/guiaParaFechar";
import { FRENTES_DA_OPERACAO, frente as frenteInfo, type FrenteId } from "@/lib/models/frentes";
import { JANELA_DO_G_MS } from "@/lib/models/atalhosDeTeclado";
import { diaCurtoDaMarca, opcoesDeAdiar } from "@/lib/models/meuDia";
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
  const [gravando, setGravando] = useState<"concluir" | "adiar" | "feito" | "tirar" | "adiado" | null>(null);
  const [menuAdiar, setMenuAdiar] = useState(false);
  const menuAdiarRef = useRef<HTMLDivElement>(null);
  const [verFila, setVerFila] = useState(false);
  /* Os marcados na lista da fila, para fazer de uma vez. */
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const todos = useMemo(
    () => (dia.contagens ? filaDoDia(dia.doDia, dia.contagens, marcadas) : []),
    [dia.doDia, dia.contagens, marcadas]
  );

  /*
    Foco por frente (Fase 24): "só Reclame Aqui", "só os críticos", "só
    o fora do prazo". O filtro não tira nada do dia — só da vista do Um
    por vez, enquanto ele estiver ligado.
  */
  const [foco, setFoco] = useState<"tudo" | "criticos" | "atrasados" | FrenteId>("tudo");
  const base = useMemo(
    () =>
      foco === "tudo"
        ? todos
        : todos.filter((i) => (foco === "criticos" ? i.critico : foco === "atrasados" ? i.atrasado : i.frente === foco)),
    [todos, foco]
  );
  const opcoesDeFoco = [
    { id: "tudo" as const, rotulo: "Tudo", n: todos.length },
    ...FRENTES_DA_OPERACAO.map((f) => ({ id: f.id, rotulo: f.curto, n: todos.filter((i) => i.frente === f.id).length })).filter((o) => o.n > 0),
    { id: "criticos" as const, rotulo: "Críticos", n: todos.filter((i) => i.critico).length },
    { id: "atrasados" as const, rotulo: "Fora do prazo", n: todos.filter((i) => i.atrasado).length },
  ].filter((o) => o.id === "tudo" || o.n > 0);

  /*
    O bloco de foco: 25 ou 45 minutos na fila, com o relógio no cabeçalho
    e quantos itens saíram durante ele. Só na tela — não grava nada.
  */
  const [bloco, setBloco] = useState<{ fim: number; minutos: number; inicio: number } | null>(null);
  const [agoraDoBloco, setAgoraDoBloco] = useState(() => Date.now());
  useEffect(() => {
    if (!bloco) return;
    const t = window.setInterval(() => setAgoraDoBloco(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [bloco]);

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

  /*
    O que acabou de sair, na linha fixa embaixo dos botões.

    Era um aviso no canto e uma faixa que entrava em cima do item: os
    botões desciam no mesmo instante em que o mouse estava sobre eles. O
    Isaac: "pop-up de quando coloco tirar do dia, aí o botão desce". A
    linha existe sempre, vazia ou não — nada muda de lugar.
  */
  const [saida, setSaida] = useState<{ texto: string; titulo: string; ids?: string[] } | null>(null);
  const relogioDaSaida = useRef<number | null>(null);
  function mostrarSaida(nova: { texto: string; titulo: string; ids?: string[] } | null) {
    if (relogioDaSaida.current) window.clearTimeout(relogioDaSaida.current);
    setSaida(nova);
    if (nova) relogioDaSaida.current = window.setTimeout(() => setSaida(null), 8000);
  }
  useEffect(() => () => {
    if (relogioDaSaida.current) window.clearTimeout(relogioDaSaida.current);
  }, []);


  const posicao = posicaoNaFila(fila, chave, indice);
  const item = posicao >= 0 ? fila[posicao] : null;

  /* O item atual saiu da fila: foi resolvido em algum lugar. Fica o aviso, e a fila segue do mesmo ponto. */
  const anterior = useRef<{ chave: string; titulo: string } | null>(null);
  useEffect(() => {
    const antes = anterior.current;
    /* Sumiu só da vista, pelo filtro de foco: não saiu do dia. */
    if (antes && !fila.some((i) => i.chave === antes.chave) && todos.some((i) => i.chave === antes.chave)) {
      anterior.current = item ? { chave: item.chave, titulo: item.titulo } : null;
      return;
    }
    if (antes && !fila.some((i) => i.chave === antes.chave)) {
      setSaidos((s) => (s.includes(antes.chave) ? s : [...s, antes.chave]));
      /* Saído por Feito hoje ou Tirar do dia, a linha já diz — e com o desfazer. */
      setSaida((atual) => (atual?.titulo === antes.titulo ? atual : { texto: "saiu do dia", titulo: antes.titulo }));
      anterior.current = item ? { chave: item.chave, titulo: item.titulo } : null;
      setChave(item?.chave ?? null);
      setIndice(Math.max(posicao, 0));
      return;
    }
    anterior.current = item ? { chave: item.chave, titulo: item.titulo } : null;
  }, [fila, item, posicao, todos]);

  function irPara(i: number) {
    if (fila.length === 0) return;
    const n = (i + fila.length) % fila.length;
    setIndice(n);
    setChave(fila[n].chave);
  }

  /*
    O teclado, para quem passa a manhã na fila.

    ← → ou J K andam; F é feito (na atividade da agenda, concluir); T tira
    do dia; A passa a atividade da agenda para o próximo dia útil; Enter
    abre na janela. Fora de campo de texto, sem modificador — e com uma
    janela aberta por cima, a tecla é dela: o foco está lá dentro.
  */
  /* A tecla anterior: depois de "g", a letra é do atalho de tela ("g t" é o Relatório), não da fila. */
  const teclaAnterior = useRef<{ tecla: string; em: number } | null>(null);
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const antes = teclaAnterior.current;
      teclaAnterior.current = { tecla: e.key, em: Date.now() };
      if (antes?.tecla === "g" && Date.now() - antes.em < JANELA_DO_G_MS) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return;
      /* Enter num botão ou link é o clique dele, não "abrir na janela". */
      if (e.key === "Enter" && alvo && alvo.closest("button, a, [role=dialog]")) return;
      if (alvo && alvo.closest("[role=dialog]")) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === "ArrowRight" || k === "j") irPara(posicao + 1);
      else if (k === "ArrowLeft" || k === "k") irPara(posicao - 1);
      else if (k === "f" && item) void (tarefa ? gravarTarefa("concluir") : tirarDoDia("feito"));
      else if (k === "t" && item && !tarefa) void tirarDoDia("tirar");
      else if (k === "a" && tarefa) void gravarTarefa("adiar");
      else if (k === "a" && item && dia.hoje) void tirarDoDia("adiado", opcoesDeAdiar(dia.hoje, expediente).at(-1)!.volta);
      else if (k === "Enter" && ficha) abrirNaJanela();
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
  function tirarDoDia(tipo: "feito" | "tirar" | "adiado", volta?: string) {
    if (!item) return;
    return marcarDaFila([item], tipo, volta);
  }

  /* Atividade da agenda não tem marca: conclui-se ou passa de dia, pelos botões dela. */
  const ehTarefa = (i: ItemDaFila) => !i.frente && i.chave.startsWith("pendencias:");

  /*
    Feito, tirar ou adiar — um item ou vários da lista da fila, numa
    gravação só. O desfazer da linha fixa devolve todos.
  */
  async function marcarDaFila(alvos: ItemDaFila[], tipo: "feito" | "tirar" | "adiado", volta?: string) {
    const validos = alvos.filter((i) => !ehTarefa(i));
    if (!validos.length || gravando || (tipo === "adiado" && !volta)) return;
    setMenuAdiar(false);
    setGravando(tipo);
    try {
      const r = await dia.marcarItens(
        validos.flatMap((i) => i.chaves.map((c) => ({ chave: c, item: i.chave, titulo: i.titulo }))),
        tipo === "feito" ? "feito" : tipo === "adiado" ? "adiado" : "dispensado",
        "hoje",
        volta
      );
      if (!r.ok) {
        notify({ tone: "error", title: validos.length > 1 ? "Os itens não saíram da fila." : "O item não saiu da fila.", detail: r.erro });
        return;
      }
      setSelecionados((sel) => sel.filter((k) => !validos.some((i) => i.chave === k)));
      mostrarSaida({
        texto: tipo === "feito" ? "feito hoje" : tipo === "adiado" ? `volta em ${diaCurtoDaMarca(volta!)}` : "tirado do dia",
        titulo: validos.length > 1 ? `${validos.length} itens` : validos[0].titulo,
        ids: r.marcas.map((m) => m.id),
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
      mostrarSaida({
        texto: tipo === "concluir" ? "atividade concluída" : `passada para ${dia2!.split("-").reverse().slice(0, 2).join("/")}`,
        titulo: tarefa.title,
      });
    }
  }

  /* O menu de adiar fecha com Esc e com clique fora. */
  useEffect(() => {
    if (!menuAdiar) return;
    function fora(e: MouseEvent) {
      if (menuAdiarRef.current && !menuAdiarRef.current.contains(e.target as Node)) setMenuAdiar(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuAdiar(false);
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [menuAdiar]);

  /* Devolve à fila o que Feito hoje ou Tirar do dia acabou de tirar. */
  async function desfazerSaida() {
    if (!saida?.ids?.length || gravando) return;
    const { ids, titulo } = saida;
    mostrarSaida(null);
    const r = await dia.desfazerMarcas(ids);
    if (!r.ok) {
      notify({ tone: "error", title: "Não voltou para a fila.", detail: r.erro });
      mostrarSaida({ texto: "tirado do dia", titulo, ids });
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
          {bloco ? (
            (() => {
              const resta = Math.max(0, bloco.fim - agoraDoBloco);
              const mm = String(Math.floor(resta / 60000)).padStart(2, "0");
              const ss = String(Math.floor((resta % 60000) / 1000)).padStart(2, "0");
              const noBloco = fechados.length - bloco.inicio;
              return (
                <span className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs tabular-nums ${resta === 0 ? "bg-emerald-50 text-emerald-800" : "bg-violet-50 text-violet-900"}`}>
                  <Timer size={13} />
                  {resta === 0 ? `Bloco de ${bloco.minutos} min: ${noBloco} fechado(s)` : `${mm}:${ss} · ${noBloco} fechado(s)`}
                  <button type="button" onClick={() => setBloco(null)} aria-label="Encerrar o bloco de foco" className="rounded p-0.5 text-current/60 hover:bg-white/60">
                    <X size={12} />
                  </button>
                </span>
              );
            })()
          ) : (
            fila.length > 0 && (
              <span className="hidden items-center gap-0.5 text-xs text-zinc-500 sm:flex" title="Um bloco de foco: o relógio no cabeçalho e quantos itens saíram durante ele">
                <Timer size={13} className="mr-0.5" /> Foco
                {[25, 45].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setAgoraDoBloco(Date.now());
                      setBloco({ fim: Date.now() + m * 60_000, minutos: m, inicio: fechados.length });
                    }}
                    className="rounded-md px-1.5 py-1 font-medium tabular-nums text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    {m} min
                  </button>
                ))}
              </span>
            )
          )}
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

      {opcoesDeFoco.length > 2 && (
        <div role="group" aria-label="Foco da fila" className="flex flex-wrap items-center gap-1 border-b border-zinc-100 px-5 py-1.5">
          {opcoesDeFoco.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={foco === o.id}
              onClick={() => setFoco(o.id)}
              className={`rounded-md px-2 py-0.5 text-xs font-medium tabular-nums ${foco === o.id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
            >
              {o.rotulo} <span className={foco === o.id ? "text-white/60" : "text-zinc-400"}>{o.n}</span>
            </button>
          ))}
        </div>
      )}

      {verFila && fila.length > 0 && (() => {
        const marcaveis = fila.filter((i) => !ehTarefa(i));
        const escolhidos = fila.filter((i) => selecionados.includes(i.chave));
        const voltaUtil = dia.hoje ? opcoesDeAdiar(dia.hoje, expediente).at(-1)!.volta : null;
        return (
          <div className="border-b border-zinc-100">
            {/*
              A barra do que está marcado fica sempre no mesmo lugar, em cima
              da lista: marcar um item não empurra nada para baixo.
            */}
            <div className="flex h-9 items-center gap-2 border-b border-zinc-50 px-5 text-xs">
              <input
                id="fila-todos"
                type="checkbox"
                checked={marcaveis.length > 0 && escolhidos.length === marcaveis.length}
                onChange={(e) => setSelecionados(e.target.checked ? marcaveis.map((i) => i.chave) : [])}
                aria-label="Marcar todos da fila"
                className="h-3.5 w-3.5 accent-violet-700"
              />
              {escolhidos.length === 0 ? (
                <span className="text-zinc-400">Marque itens para fazer de uma vez — ou use os botões de cada linha.</span>
              ) : (
                <>
                  <span className="font-medium tabular-nums text-zinc-700">{escolhidos.length} marcado(s)</span>
                  <button type="button" disabled={gravando !== null} onClick={() => void marcarDaFila(escolhidos, "feito")} className="rounded-md px-2 py-1 font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                    Feito hoje
                  </button>
                  <button type="button" disabled={gravando !== null} onClick={() => void marcarDaFila(escolhidos, "tirar")} className="rounded-md px-2 py-1 font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50">
                    Tirar do dia
                  </button>
                  {voltaUtil && (
                    <button type="button" disabled={gravando !== null} onClick={() => void marcarDaFila(escolhidos, "adiado", voltaUtil)} className="rounded-md px-2 py-1 font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50">
                      Adiar para {diaCurtoDaMarca(voltaUtil)}
                    </button>
                  )}
                  <button type="button" onClick={() => setSelecionados([])} className="ml-auto rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                    Limpar
                  </button>
                </>
              )}
            </div>
            <ol className="max-h-64 overflow-y-auto overscroll-contain px-3 py-1.5">
              {fila.map((i, n) => {
                const tarefaDaLinha = ehTarefa(i);
                return (
                  <li key={i.chave} className={`group flex min-w-0 items-center gap-1 rounded-md pl-2 ${n === posicao ? "bg-violet-50" : "hover:bg-zinc-50"}`}>
                    <input
                      id={`fila-${n}`}
                      type="checkbox"
                      disabled={tarefaDaLinha}
                      checked={selecionados.includes(i.chave)}
                      onChange={(e) => setSelecionados((sel) => (e.target.checked ? [...sel, i.chave] : sel.filter((k) => k !== i.chave)))}
                      aria-label={`Marcar ${i.titulo}`}
                      title={tarefaDaLinha ? "Atividade da agenda: conclua ou passe de dia no próprio item" : undefined}
                      className="h-3.5 w-3.5 shrink-0 accent-violet-700 disabled:opacity-30"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        irPara(n);
                        setVerFila(false);
                      }}
                      aria-current={n === posicao}
                      className={`flex min-w-0 flex-1 items-center gap-2 px-1 py-1 text-left text-xs ${n === posicao ? "text-violet-900" : "text-zinc-700"}`}
                    >
                      <span className="w-6 shrink-0 text-right tabular-nums text-zinc-400">{n + 1}</span>
                      {i.frente ? <IconeDaFrente frente={i.frente} size={12} /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" />}
                      <span className={`min-w-0 flex-1 truncate ${i.atrasado ? "text-rose-700" : ""}`}>{i.titulo}</span>
                      <span className="hidden max-w-[40%] shrink-0 truncate text-[11px] text-zinc-400 sm:block">{i.atividades.join(" · ")}</span>
                    </button>
                    {!tarefaDaLinha && (
                      <span className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                        <button type="button" disabled={gravando !== null} onClick={() => void marcarDaFila([i], "feito")} title="Feito hoje" aria-label={`Feito hoje: ${i.titulo}`} className="rounded-md p-1 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-700">
                          <Check size={13} strokeWidth={2.5} />
                        </button>
                        <button type="button" disabled={gravando !== null} onClick={() => void marcarDaFila([i], "tirar")} title="Tirar do dia" aria-label={`Tirar do dia: ${i.titulo}`} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                          <CircleSlash size={13} />
                        </button>
                        {voltaUtil && (
                          <button type="button" disabled={gravando !== null} onClick={() => void marcarDaFila([i], "adiado", voltaUtil)} title={`Adiar para ${diaCurtoDaMarca(voltaUtil)}`} aria-label={`Adiar para ${diaCurtoDaMarca(voltaUtil)}: ${i.titulo}`} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                            <CalendarClock size={13} />
                          </button>
                        )}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })()}

      {/* `carregando` junto: sem ele, a rotina que ainda não chegou passava
          por rotina vazia e o modo anunciava "está marcada" antes da hora. */}
      {dia.carregando || !dia.contagens ? (
        <p className="px-5 py-8 text-center text-sm text-zinc-400">Lendo a fila do dia…</p>
      ) : !item && foco !== "tudo" && todos.length > 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium text-zinc-800">Nada neste foco agora.</p>
          <button type="button" onClick={() => setFoco("tudo")} className="mt-1 text-xs font-medium text-violet-700 hover:underline">
            Ver a fila inteira ({todos.length})
          </button>
        </div>
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
            <div className="flex h-5 items-center gap-2 text-[11px] text-zinc-500">
              {item.frente && (
                <span className="flex items-center gap-1 font-medium text-zinc-600">
                  <IconeDaFrente frente={item.frente} size={12} />
                  {frenteInfo(item.frente).curto}
                </span>
              )}
              <span className="min-w-0 truncate">{item.atividades.join(" · ")}</span>
              {item.atrasado && (
                <span className="shrink-0 rounded-md bg-rose-50 px-1.5 text-[11px] font-semibold leading-4 text-rose-700 ring-1 ring-inset ring-rose-100">fora do prazo</span>
              )}
            </div>

            {/* Duas linhas de título e uma de detalhe, sempre: de um item para o outro, os botões ficam na mesma altura. */}
            <h3 title={item.titulo} className="mt-1.5 line-clamp-2 min-h-[2lh] text-[15px] font-semibold leading-snug text-zinc-900 [overflow-wrap:anywhere]">{item.titulo}</h3>
            <p title={item.detalhe ?? undefined} className="mt-0.5 line-clamp-1 min-h-[1lh] text-xs text-zinc-500 [overflow-wrap:anywhere]">{item.detalhe}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {tarefa && (
                <>
                  <button
                    type="button"
                    onClick={() => gravarTarefa("concluir")}
                    disabled={gravando !== null}
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                  >
                    {gravando === "concluir" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={2.5} />} Concluir atividade <Tecla>F</Tecla>
                  </button>
                  <button
                    type="button"
                    onClick={() => gravarTarefa("adiar")}
                    disabled={gravando !== null || !dia.hoje}
                    title="Passa para o próximo dia útil, no mesmo horário (A)"
                    className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    {gravando === "adiar" ? <Loader2 size={14} className="animate-spin" /> : <CalendarArrowUp size={14} />} Próximo dia útil <Tecla>A</Tecla>
                  </button>
                </>
              )}
              {ficha ? (
                <button
                  type="button"
                  onClick={abrirNaJanela}
                  className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${tarefa ? "text-zinc-700 hover:bg-zinc-100" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}
                >
                  <AppWindow size={14} /> {tarefa ? "Caso na janela" : "Abrir na janela"} <Tecla>Enter</Tecla>
                </button>
              ) : null}
              <Link
                href={item.href}
                className={`flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium ${ficha || tarefa ? "text-zinc-600 hover:bg-zinc-100" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}
              >
                {tarefa ? "Agenda" : item.janela ? "Tela cheia" : "Abrir"} <ArrowUpRight size={13} />
              </Link>
              {item.ra && <LinksDoRa caso={item.ra} className="[&>a]:p-2" />}
              {!tarefa && (
                <>
                  <button
                    type="button"
                    onClick={() => tirarDoDia("feito")}
                    disabled={gravando !== null}
                    title="Fiz por fora (ou o registro não acompanhou): sai da fila e das atividades de hoje (F)"
                    className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                  >
                    {gravando === "feito" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={2.5} />} Feito hoje <Tecla>F</Tecla>
                  </button>
                  <button
                    type="button"
                    onClick={() => tirarDoDia("tirar")}
                    disabled={gravando !== null}
                    title="Não se aplica hoje: sai da fila e volta amanhã, se ainda for trabalho (T)"
                    className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-60"
                  >
                    {gravando === "tirar" ? <Loader2 size={14} className="animate-spin" /> : <CircleSlash size={14} />} Tirar do dia <Tecla>T</Tecla>
                  </button>
                  <div ref={menuAdiarRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuAdiar((v) => !v)}
                      disabled={gravando !== null || !dia.hoje}
                      aria-haspopup="menu"
                      aria-expanded={menuAdiar}
                      title="Some até o dia escolhido e volta sozinho (A: próximo dia útil)"
                      className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-60 ${menuAdiar ? "bg-zinc-100" : ""}`}
                    >
                      {gravando === "adiado" ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />} Adiar <Tecla>A</Tecla>
                    </button>
                    {menuAdiar && (
                      <div role="menu" className="absolute left-0 top-[calc(100%+4px)] z-30 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-[0_12px_32px_-12px_rgba(16,24,40,0.25)]">
                        <OpcoesDeAdiar id="um-por-vez-adiar" onAdiar={(volta) => void tirarDoDia("adiado", volta)} />
                      </div>
                    )}
                  </div>
                </>
              )}
              <div className="ml-auto flex items-center">
                <button type="button" onClick={() => irPara(posicao - 1)} disabled={fila.length < 2} title="Anterior (← ou K)" aria-label="Item anterior" className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 disabled:opacity-40">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" onClick={() => irPara(posicao + 1)} disabled={fila.length < 2} title="Pular para o próximo (→ ou J)" className="flex h-8 items-center gap-0.5 rounded-lg pl-2 pr-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40">
                  Pular <ChevronRight size={15} />
                </button>
              </div>
            </div>

            <p aria-live="polite" className="mt-2 flex h-6 min-w-0 items-center gap-1.5 text-xs text-emerald-800">
              {saida && (
                <>
                  <Check size={13} strokeWidth={2.5} className="shrink-0" />
                  <span className="min-w-0 truncate">
                    <strong className="font-medium">{saida.titulo}</strong> · {saida.texto}
                  </span>
                  {saida.ids?.length ? (
                    <button type="button" onClick={desfazerSaida} className="shrink-0 rounded px-1 font-semibold text-emerald-900 underline-offset-2 hover:underline">
                      desfazer
                    </button>
                  ) : null}
                </>
              )}
            </p>
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

/* A tecla do atalho, discreta ao lado do rótulo; some no celular, onde não há teclado. */
function Tecla({ children }: { children: string }) {
  return <kbd className="ml-0.5 hidden rounded border border-current/20 px-1 font-sans text-[10px] font-medium leading-4 opacity-60 sm:inline">{children}</kbd>;
}
