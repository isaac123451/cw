"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  CalendarCheck,
  CalendarX,
  ChevronDown,
  ExternalLink,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Repeat,
  Trash2,
  Unplug,
} from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import { ConfirmDelete, PrimaryButton } from "@/components/shared/Modal";

import GoogleEventForm from "@/components/agenda/GoogleEventForm";

import {
  deleteGoogleEvent,
  disconnectGoogle,
  getGoogleStatus,
  getUpcomingEvents,
  GoogleStatus,
  pushTaskToGoogle,
  startGoogleAuth,
  updateGoogleEvent,
} from "@/lib/actions/google";

import {
  EventRange,
  GoogleEvent,
  GoogleEventDraft,
  RANGE_LABELS,
  RangeKind,
} from "@/lib/models/google";

import { useToast } from "@/lib/context/ToastContext";

const DIAS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Hoje/Amanhã em vez da data crua: é a leitura que a operação faz. */
function rotuloDia(iso: string) {

  const hoje = hojeIso();

  const amanha = new Date(Date.now() + 86400000)
    .toISOString()
    .slice(0, 10);

  if (iso === hoje) return "Hoje";
  if (iso === amanha) return "Amanhã";

  const [ano, mes, dia] = iso.split("-").map(Number);

  // `Date.UTC` para o dia da semana não escorregar por fuso.
  const semana =
    DIAS[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];

  return `${semana.slice(0, 3)}, ${String(dia).padStart(
    2,
    "0"
  )}/${String(mes).padStart(2, "0")}`;
}

/** Traduz a escolha da tela no que a action espera. */
function janelaDe(range: EventRange) {

  if (range.kind === "custom") {
    return { start: range.start, end: range.end };
  }

  if (range.kind === "hoje") {
    return { start: hojeIso(), end: hojeIso() };
  }

  return {
    dias: Number(range.kind.replace("d", "")),
  };
}

export default function GoogleCalendarCard() {

  const { notify } = useToast();

  const [status, setStatus] = useState<GoogleStatus>();
  const [eventos, setEventos] = useState<GoogleEvent[]>([]);

  const [range, setRange] = useState<EventRange>({
    kind: "7d",
  });

  /** Falha ao ler a agenda — recarregar substitui. */
  const [erro, setErro] = useState<string>();

  /**
   * Motivo que voltou do consentimento (`?google=erro&motivo=...`).
   *
   * Lido na inicialização do estado, não num efeito: `setState` dentro
   * de efeito é a dívida que o `eslint` marca aqui. Não quebra a
   * hidratação porque o componente renderiza `null` até `status`
   * chegar — servidor e cliente produzem a mesma saída inicial.
   */
  const [erroConexao, setErroConexao] = useState<
    string | undefined
  >(() => {

    if (typeof window === "undefined") return undefined;

    const params = new URLSearchParams(
      window.location.search
    );

    return params.get("google") === "erro"
      ? params.get("motivo") ??
          "Não foi possível conectar."
      : undefined;
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<GoogleEvent>();
  const [excluindo, setExcluindo] =
    useState<GoogleEvent>();

  const [salvando, setSalvando] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [pending, startTransition] = useTransition();

  /** Só busca — não toca em estado, para poder rodar dentro do efeito. */
  async function buscar(alvo: EventRange) {

    const atual = await getGoogleStatus();

    if (!atual.conectado) {
      return { status: atual, events: [] as GoogleEvent[] };
    }

    const { events, error } = await getUpcomingEvents(
      janelaDe(alvo)
    );

    return { status: atual, events, error };
  }

  function aplicar(dados: {
    status: GoogleStatus;
    events: GoogleEvent[];
    error?: string;
  }) {
    setStatus(dados.status);
    setEventos(dados.events);
    setErro(dados.error);
  }

  function carregar(alvo = range) {
    return buscar(alvo).then(aplicar);
  }

  useEffect(() => {

    let ativo = true;

    buscar(range).then((dados) => {
      if (ativo) aplicar(dados);
    });

    return () => {
      ativo = false;
    };

    // `range` completo mudaria a identidade a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.kind, range.start, range.end]);

  useEffect(() => {

    // Limpa o ?google=... da barra para um F5 não repetir a mensagem.
    // O motivo em si já foi lido na inicialização do estado acima.
    if (
      new URLSearchParams(window.location.search).has(
        "google"
      )
    ) {
      window.history.replaceState(
        {},
        "",
        window.location.pathname
      );
    }

  }, []);

  /** Agrupa por dia, preservando a ordem que o Google já devolveu. */
  const porDia = useMemo(() => {

    const mapa = new Map<string, GoogleEvent[]>();

    for (const evento of eventos) {
      mapa.set(evento.date, [
        ...(mapa.get(evento.date) ?? []),
        evento,
      ]);
    }

    return [...mapa.entries()];
  }, [eventos]);

  function conectar() {
    startTransition(async () => {
      try {
        setErroConexao(undefined);
        window.location.href = await startGoogleAuth();
      } catch (e) {
        setErroConexao(
          e instanceof Error
            ? e.message
            : "Falha ao iniciar a conexão."
        );
      }
    });
  }

  function desconectar() {
    setMenuOpen(false);
    startTransition(async () => {
      await disconnectGoogle();
      setErroConexao(undefined);
      await carregar();
      notify({
        tone: "info",
        title: "Google Agenda desconectada.",
        detail:
          "Seus eventos continuam no Google — só deixamos de exibi-los aqui.",
      });
    });
  }

  async function salvar(dados: GoogleEventDraft) {

    setSalvando(true);

    const resultado = editando
      ? await updateGoogleEvent(editando.id, dados)
      : await pushTaskToGoogle(dados);

    setSalvando(false);

    if (!resultado.ok) {
      notify({
        tone: "error",
        title: editando
          ? "Não foi possível salvar o evento."
          : "Não foi possível criar o evento.",
        detail: resultado.error,
      });
      return;
    }

    setFormOpen(false);
    setEditando(undefined);

    await carregar();

    notify({
      tone: "success",
      title: editando
        ? "Evento atualizado."
        : "Evento criado na sua agenda.",
      detail: dados.title,
      href: resultado.link,
      hrefLabel: "Abrir no Google",
    });
  }

  function excluir() {

    if (!excluindo) return;

    const alvo = excluindo;

    startTransition(async () => {

      const resultado = await deleteGoogleEvent(alvo.id);

      setExcluindo(undefined);

      if (!resultado.ok) {
        notify({
          tone: "error",
          title: "Não foi possível excluir o evento.",
          detail: resultado.error,
        });
        return;
      }

      await carregar();

      notify({
        tone: "success",
        title: "Evento excluído.",
        detail: alvo.title,
      });
    });
  }

  if (!status) return null;

  /* Sem credenciais: a tela ensina o que falta, em vez de esconder. */
  if (!status.configurado) {
    return (
      <SurfaceCard
        title="Google Agenda"
        description="Integração ainda não configurada neste ambiente."
      >
        <p className="text-sm leading-relaxed text-zinc-600">
          Falta definir{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
            GOOGLE_CLIENT_ID
          </code>{" "}
          e{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
            GOOGLE_CLIENT_SECRET
          </code>
          . O passo a passo está em{" "}
          <strong className="font-medium text-zinc-700">
            DEPLOY.md
          </strong>
          , seção &quot;Google Agenda&quot;.
        </p>
      </SurfaceCard>
    );
  }

  if (!status.conectado) {
    return (
      <SurfaceCard
        title="Google Agenda"
        description="Conecte sua conta para ver seus compromissos junto das tarefas."
        action={
          <PrimaryButton
            onClick={conectar}
            disabled={pending}
          >
            <CalendarCheck size={15} />
            Conectar
          </PrimaryButton>
        }
      >

        {erroConexao && (
          <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-700 ring-1 ring-inset ring-rose-100">
            {erroConexao}
          </p>
        )}

        <p className="flex items-center gap-2 text-sm text-zinc-500">
          <CalendarX size={16} className="text-zinc-300" />
          Cada pessoa conecta a própria agenda — ninguém vê
          a do outro.
        </p>

      </SurfaceCard>
    );
  }

  return (
    <>
      <SurfaceCard
        title="Google Agenda"
        description={status.email}
        action={
          <div className="flex shrink-0 items-center gap-1.5">

            <button
              onClick={() => {
                setEditando(undefined);
                setFormOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-violet-200 px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50"
            >
              <Plus size={14} />
              Novo evento
            </button>

            <button
              onClick={() => startTransition(() => carregar())}
              disabled={pending}
              title="Atualizar"
              className="rounded-xl border border-zinc-200 p-1.5 text-zinc-500 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              <RefreshCw size={14} />
            </button>

            {/* Desconectar sai do caminho: é raro e destrutivo. */}
            <div className="relative">

              <button
                onClick={() => setMenuOpen((v) => !v)}
                title="Mais opções"
                className="rounded-xl border border-zinc-200 p-1.5 text-zinc-500 transition-colors hover:bg-zinc-50"
              >
                <ChevronDown size={14} />
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                  />

                  <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-52 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-[0_12px_32px_-12px_rgba(16,24,40,0.25)]">
                    <button
                      onClick={desconectar}
                      className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Unplug size={14} />
                      Desconectar conta
                    </button>
                  </div>
                </>
              )}

            </div>

          </div>
        }
      >

        {/* Período */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">

          {(
            Object.keys(RANGE_LABELS) as RangeKind[]
          ).map((k) => (

            <button
              key={k}
              onClick={() =>
                setRange(
                  k === "custom"
                    ? {
                        kind: "custom",
                        start: hojeIso(),
                        end: hojeIso(),
                      }
                    : { kind: k }
                )
              }
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ring-1 ring-inset ${
                range.kind === k
                  ? "bg-violet-50 text-violet-700 ring-violet-200"
                  : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
              }`}
            >
              {RANGE_LABELS[k]}
            </button>

          ))}

          <span className="ml-auto text-xs tabular-nums text-zinc-400">
            {eventos.length} evento(s)
          </span>

        </div>

        {range.kind === "custom" && (

          <div className="mb-3 flex flex-wrap items-center gap-2">

            <input
              type="date"
              value={range.start ?? ""}
              max={range.end}
              onChange={(e) =>
                setRange((r) => ({
                  ...r,
                  start: e.target.value,
                }))
              }
              className="h-9 rounded-xl border border-zinc-200 px-2.5 text-xs outline-none transition-colors focus:border-violet-400"
            />

            <span className="text-xs text-zinc-400">
              até
            </span>

            <input
              type="date"
              value={range.end ?? ""}
              min={range.start}
              onChange={(e) =>
                setRange((r) => ({
                  ...r,
                  end: e.target.value,
                }))
              }
              className="h-9 rounded-xl border border-zinc-200 px-2.5 text-xs outline-none transition-colors focus:border-violet-400"
            />

          </div>

        )}

        {erro && (
          <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-700 ring-1 ring-inset ring-rose-100">
            {erro}
          </p>
        )}

        {eventos.length === 0 ? (

          <p className="py-8 text-center text-sm text-zinc-400">
            Nenhum compromisso no período.
          </p>

        ) : (

          /* Altura fechada: sem isto, 30 dias empurram a agenda da
             operação para fora da tela. */
          <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">

            {porDia.map(([dia, doDia]) => (

              <div key={dia}>

                <div className="mb-1.5 flex items-center gap-2">

                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    {rotuloDia(dia)}
                  </p>

                  <span className="h-px flex-1 bg-zinc-100" />

                </div>

                <ul className="space-y-1">

                  {doDia.map((evento) => (

                    <li
                      key={evento.id}
                      className="group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-zinc-50"
                    >

                      <span className="w-24 shrink-0 text-[11px] font-medium tabular-nums text-zinc-500">
                        {evento.allDay
                          ? "dia inteiro"
                          : evento.endTime
                          ? `${evento.time}–${evento.endTime}`
                          : evento.time}
                      </span>

                      <span className="flex min-w-0 flex-1 items-center gap-1.5">

                        <span className="truncate text-sm text-zinc-700">
                          {evento.title}
                        </span>

                        {evento.recurring && (
                          <Repeat
                            size={11}
                            className="shrink-0 text-zinc-300"
                          />
                        )}

                      </span>

                      <span className="flex shrink-0 items-center">

                        {evento.readOnly ? (

                          <span
                            title="Criado por outra pessoa — só quem organiza pode alterar."
                            className="p-1 text-zinc-300"
                          >
                            <Lock size={12} />
                          </span>

                        ) : (

                          <span className="flex opacity-0 transition-opacity group-hover:opacity-100">

                            <button
                              onClick={() => {
                                setEditando(evento);
                                setFormOpen(true);
                              }}
                              title="Editar"
                              className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-violet-50 hover:text-violet-700"
                            >
                              <Pencil size={12} />
                            </button>

                            <button
                              onClick={() =>
                                setExcluindo(evento)
                              }
                              title="Excluir"
                              className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 size={12} />
                            </button>

                          </span>

                        )}

                        {evento.link && (
                          <a
                            href={evento.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir no Google"
                            className="rounded-md p-1 text-zinc-300 transition-colors hover:text-violet-600"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}

                      </span>

                    </li>

                  ))}

                </ul>

              </div>

            ))}

          </div>

        )}

      </SurfaceCard>

      {/* `key` remonta o formulário a cada abertura: os campos são
          inicializados no useState, sem setState em efeito. */}
      {formOpen && (
        <GoogleEventForm
          key={editando?.id ?? "novo"}
          open={formOpen}
          editing={editando}
          presetDate={
            range.kind === "custom"
              ? range.start
              : undefined
          }
          saving={salvando}
          onClose={() => {
            setFormOpen(false);
            setEditando(undefined);
          }}
          onSave={salvar}
        />
      )}

      <ConfirmDelete
        open={Boolean(excluindo)}
        label={excluindo?.title ?? ""}
        onCancel={() => setExcluindo(undefined)}
        onConfirm={excluir}
      />
    </>
  );
}
