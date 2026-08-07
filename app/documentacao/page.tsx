"use client";

import { useMemo, useState } from "react";

import {
  BookOpenCheck,
  Check,
  CircleAlert,
  Clock3,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";
import { ConfirmDelete } from "@/components/shared/Modal";

import PlaybookForm from "@/components/documentacao/PlaybookForm";

import {
  PlaybookDraft,
  useDocs,
} from "@/lib/context/DocsContext";

import { Playbook } from "@/lib/data/mockPlaybooks";

const scopeTone: Record<string, string> = {
  "Reclame Aqui": "bg-violet-50 text-violet-700 ring-violet-100",
  "Redes Sociais": "bg-sky-50 text-sky-700 ring-sky-100",
  Plataforma: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  Comercial: "bg-amber-50 text-amber-700 ring-amber-100",
  Financeiro: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Tecnologia: "bg-rose-50 text-rose-700 ring-rose-100",
};

export default function DocumentacaoPage() {

  const {
    playbooks,
    createPlaybook,
    updatePlaybook,
    removePlaybook,
  } = useDocs();

  const [selected, setSelected] = useState<string | null>(
    null
  );

  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Playbook>();
  const [deleting, setDeleting] = useState<Playbook>();

  const visible = useMemo(() => {

    const termo = search.trim().toLowerCase();

    if (!termo) return playbooks;

    return playbooks.filter(
      (item) =>
        item.title.toLowerCase().includes(termo) ||
        item.summary.toLowerCase().includes(termo) ||
        item.scope.toLowerCase().includes(termo)
    );

  }, [playbooks, search]);

  const current =
    visible.find((item) => item.slug === selected) ??
    visible[0];

  function salvar(data: PlaybookDraft | Playbook) {

    if ("id" in data) updatePlaybook(data);
    else createPlaybook(data);

    setFormOpen(false);
    setEditing(undefined);
  }

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Conhecimento"
          title="Documentação da operação"
          description="Como a área atende, do primeiro contato ao registro do resultado final."
        >
          <button
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
          >
            <Plus size={16} />
            Novo documento
          </button>
        </PageHeading>

        <SurfaceCard bodyClassName="p-4">

          <div className="relative max-w-md">

            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar documento, escopo ou assunto..."
              className="h-11 w-full rounded-xl border border-zinc-200 pl-10 pr-3 text-sm outline-none transition-colors focus:border-violet-400"
            />

          </div>

        </SurfaceCard>

        {visible.length === 0 ? (

          <SurfaceCard>
            <p className="py-12 text-center text-sm text-zinc-400">
              Nenhum documento encontrado.
            </p>
          </SurfaceCard>

        ) : (

          <>
            <div className="grid gap-3 md:grid-cols-3">

              {visible.map((item) => {

                const active =
                  item.slug === current?.slug;

                return (
                  <div
                    key={item.id}
                    className={`group relative rounded-2xl border p-5 transition-all ${
                      active
                        ? "border-violet-300 bg-violet-50/40 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
                        : "border-zinc-200/80 bg-white hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_10px_24px_-14px_rgba(91,42,134,0.4)]"
                    }`}
                  >

                    <button
                      onClick={() =>
                        setSelected(item.slug)
                      }
                      className="w-full text-left"
                    >

                      <div className="flex items-start justify-between gap-3">

                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset ${
                            scopeTone[item.scope] ??
                            "bg-zinc-100 text-zinc-600 ring-zinc-200"
                          }`}
                        >
                          {item.scope}
                        </span>

                        <span className="shrink-0 text-[11px] text-zinc-400">
                          v{item.version}
                        </span>

                      </div>

                      <h3 className="mt-3 pr-16 text-sm font-semibold leading-snug text-zinc-900">
                        {item.title}
                      </h3>

                      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-zinc-500">
                        {item.summary}
                      </p>

                    </button>

                    <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">

                      <button
                        onClick={() => {
                          setEditing(item);
                          setFormOpen(true);
                        }}
                        title="Editar documento"
                        className="rounded-lg bg-white p-1.5 text-zinc-400 shadow-sm transition-colors hover:text-violet-700"
                      >
                        <Pencil size={13} />
                      </button>

                      <button
                        onClick={() => setDeleting(item)}
                        title="Excluir documento"
                        className="rounded-lg bg-white p-1.5 text-zinc-400 shadow-sm transition-colors hover:text-rose-600"
                      >
                        <Trash2 size={13} />
                      </button>

                    </div>

                  </div>
                );
              })}

            </div>

            {current && (

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">

                <SurfaceCard
                  title={current.title}
                  description={current.summary}
                  action={
                    <span className="shrink-0 rounded-xl bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600">
                      {current.steps.length} etapas
                    </span>
                  }
                >

                  {current.steps.length === 0 ? (

                    <p className="rounded-xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
                      Nenhuma etapa cadastrada. Edite o
                      documento para adicionar.
                    </p>

                  ) : (

                    <ol className="space-y-4">

                      {current.steps.map((step, index) => (

                        <li
                          key={`${step.title}-${index}`}
                          className="rounded-2xl border border-zinc-100 p-5"
                        >

                          <div className="flex flex-wrap items-start justify-between gap-3">

                            <div className="flex min-w-0 items-start gap-3">

                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">
                                {index + 1}
                              </span>

                              <h3 className="text-sm font-semibold text-zinc-900">
                                {step.title.replace(
                                  /^\d+\.\s*/,
                                  ""
                                )}
                              </h3>

                            </div>

                            <div className="flex shrink-0 items-center gap-2">

                              {step.owner && (
                                <span className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600">
                                  <UserRound size={11} />
                                  {step.owner}
                                </span>
                              )}

                              {step.sla && (
                                <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-100">
                                  <Clock3 size={11} />
                                  {step.sla}
                                </span>
                              )}

                            </div>

                          </div>

                          {step.detail && (
                            <p className="mt-3 pl-10 text-sm leading-relaxed text-zinc-600">
                              {step.detail}
                            </p>
                          )}

                          {step.checklist && (

                            <ul className="mt-3 space-y-1.5 pl-10">

                              {step.checklist.map((entry) => (

                                <li
                                  key={entry}
                                  className="flex items-start gap-2 text-sm text-zinc-500"
                                >

                                  <Check
                                    size={13}
                                    className="mt-0.5 shrink-0 text-emerald-500"
                                  />

                                  {entry}

                                </li>

                              ))}

                            </ul>

                          )}

                        </li>

                      ))}

                    </ol>

                  )}

                </SurfaceCard>

                <div className="space-y-4">

                  {current.confluenceUrl && (

                    <a
                      href={current.confluenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50/60 p-4 transition-colors hover:bg-sky-50"
                    >

                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sky-600 ring-1 ring-inset ring-sky-100">
                        <ExternalLink size={17} />
                      </span>

                      <span className="min-w-0">

                        <span className="block text-sm font-semibold text-sky-900">
                          Abrir no Confluence
                        </span>

                        <span className="block truncate text-xs text-sky-700/70">
                          Documentação oficial completa
                        </span>

                      </span>

                    </a>

                  )}

                  <SurfaceCard title="Regras da operação">

                    {current.rules &&
                    current.rules.length > 0 ? (

                      <ul className="space-y-3">

                        {current.rules.map((rule) => (

                          <li
                            key={rule}
                            className="flex items-start gap-2.5 text-sm leading-relaxed text-zinc-600"
                          >

                            <CircleAlert
                              size={14}
                              className="mt-0.5 shrink-0 text-violet-500"
                            />

                            {rule}

                          </li>

                        ))}

                      </ul>

                    ) : (

                      <p className="text-sm text-zinc-400">
                        Sem regras específicas registradas.
                      </p>

                    )}

                  </SurfaceCard>

                  <SurfaceCard title="Ficha do documento">

                    <dl className="space-y-3">

                      {[
                        ["Escopo", current.scope],
                        ["Responsável", current.owner],
                        ["Versão", current.version],
                        [
                          "Atualizado em",
                          current.updatedAt,
                        ],
                      ].map(([label, value]) => (

                        <div key={label}>

                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                            {label}
                          </dt>

                          <dd className="mt-0.5 text-sm text-zinc-800">
                            {value}
                          </dd>

                        </div>

                      ))}

                    </dl>

                    <button
                      onClick={() => {
                        setEditing(current);
                        setFormOpen(true);
                      }}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 py-2.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
                    >
                      <Pencil size={14} />
                      Editar documento
                    </button>

                    <p className="mt-4 flex items-start gap-2 border-t border-zinc-100 pt-4 text-xs leading-relaxed text-zinc-400">
                      <BookOpenCheck
                        size={13}
                        className="mt-0.5 shrink-0"
                      />
                      Documento vivo — revisado a cada
                      mudança de processo.
                    </p>

                  </SurfaceCard>

                </div>

              </div>

            )}
          </>

        )}

      </div>

      <PlaybookForm
        open={formOpen}
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(undefined);
        }}
        onSave={salvar}
      />

      <ConfirmDelete
        open={Boolean(deleting)}
        label={deleting?.title ?? ""}
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) removePlaybook(deleting.id);
          setDeleting(undefined);
        }}
      />

    </MainLayout>
  );
}
