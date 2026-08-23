"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import {
  BookOpenCheck,
  Check,
  Copy,
  MessageSquareQuote,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";
import { ConfirmDelete } from "@/components/shared/Modal";

import MacroForm from "@/components/base-conhecimento/MacroForm";

import {
  MacroDraft,
  useMacros,
} from "@/lib/context/MacrosContext";

import { Macro } from "@/lib/models/macro";

export default function BaseConhecimentoPage() {

  const {
    macros,
    createMacro,
    updateMacro,
    removeMacro,
  } = useMacros();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Macro>();
  const [deleting, setDeleting] = useState<Macro>();

  const [copied, setCopied] = useState<string>();

  const categorias = useMemo(
    () =>
      [
        ...new Set(macros.map((item) => item.category)),
      ].sort(),
    [macros]
  );

  const visible = useMemo(() => {

    const termo = search.trim().toLowerCase();

    return macros.filter((item) => {

      if (category && item.category !== category) {
        return false;
      }

      if (!termo) return true;

      return [
        item.title,
        item.body,
        item.category,
        ...item.tags,
      ].some((campo) =>
        campo.toLowerCase().includes(termo)
      );
    });

  }, [macros, search, category]);

  const maisUsada = useMemo(
    () =>
      [...macros].sort((a, b) => b.uses - a.uses)[0],
    [macros]
  );

  async function copiar(item: Macro) {

    try {
      await navigator.clipboard.writeText(item.body);
      setCopied(item.id);
      window.setTimeout(() => setCopied(undefined), 1600);
    } catch {
      // Área de transferência bloqueada — o texto segue visível na tela.
    }
  }

  function salvar(data: MacroDraft | Macro) {

    if ("id" in data) updateMacro(data);
    else createMacro(data);

    setFormOpen(false);
    setEditing(undefined);
  }

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Conhecimento"
          title="Respostas prontas"
          description="Textos aprovados para responder no Reclame Aqui sem reescrever do zero."
        >
          <button
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
          >
            <Plus size={16} />
            Nova resposta
          </button>
        </PageHeading>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatTile
            label="Respostas prontas"
            description="Textos aprovados disponíveis para a operação."
            value={macros.length}
            hint="disponíveis"
            icon={MessageSquareQuote}
            tone="primary"
          />

          <StatTile
            label="Categorias cobertas"
            description="Tipos de caso que já têm resposta padrão."
            value={categorias.length}
            hint="com texto padrão"
            icon={BookOpenCheck}
            tone="info"
          />

          <StatTile
            label="Inserções"
            description="Quantas vezes as respostas foram usadas em um caso."
            value={macros.reduce(
              (sum, item) => sum + item.uses,
              0
            )}
            hint="usos registrados"
            icon={Copy}
            tone="success"
          />

          <StatTile
            label="Mais usada"
            description="Resposta que a operação mais aproveita."
            value={maisUsada?.uses ?? 0}
            hint={maisUsada?.title ?? "—"}
            icon={Sparkles}
            tone="warning"
          />

        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white px-5 py-4">

          <MessageSquareQuote
            size={17}
            className="shrink-0 text-zinc-400"
          />

          <p className="flex-1 text-sm leading-relaxed text-zinc-600">
            Estas respostas aparecem dentro da reclamação,
            na aba{" "}
            <strong className="font-medium text-zinc-800">
              Avaliação RA
            </strong>
            , já com o nome do cliente e o protocolo
            preenchidos. Os procedimentos completos ficam em
            Documentação.
          </p>

          <Link
            href="/documentacao"
            className="shrink-0 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
          >
            Ver documentação
          </Link>

        </div>

        <SurfaceCard bodyClassName="p-4">

          <div className="flex flex-wrap gap-3">

            <div className="relative min-w-[240px] flex-1">

              <Search
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título, texto ou etiqueta..."
                className="h-11 w-full rounded-xl border border-zinc-200 pl-10 pr-3 text-sm outline-none transition-colors focus:border-violet-400"
              />

            </div>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-11 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-700 outline-none transition-colors focus:border-violet-400"
            >
              <option value="">
                Todas as categorias
              </option>

              {categorias.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

          </div>

        </SurfaceCard>

        {visible.length === 0 ? (

          <SurfaceCard>

            <div className="py-12 text-center">

              <MessageSquareQuote
                size={28}
                className="mx-auto text-zinc-300"
              />

              <p className="mt-3 text-sm text-zinc-500">
                {macros.length === 0
                  ? "Nenhuma resposta pronta cadastrada."
                  : "Nenhuma resposta encontrada para essa busca."}
              </p>

            </div>

          </SurfaceCard>

        ) : (

          <div className="grid gap-4 md:grid-cols-2">

            {visible.map((item) => (

              <article
                key={item.id}
                className="group flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:border-violet-200"
              >

                <div className="flex items-start justify-between gap-3">

                  <div className="min-w-0">

                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-100">
                      {item.category}
                    </span>

                    <h3 className="mt-2.5 text-sm font-semibold leading-snug text-zinc-900">
                      {item.title}
                    </h3>

                  </div>

                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">

                    <button
                      onClick={() => {
                        setEditing(item);
                        setFormOpen(true);
                      }}
                      title="Editar resposta"
                      className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-violet-50 hover:text-violet-700"
                    >
                      <Pencil size={13} />
                    </button>

                    <button
                      onClick={() => setDeleting(item)}
                      title="Excluir resposta"
                      className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={13} />
                    </button>

                  </div>

                </div>

                <p className="mt-3 flex-1 whitespace-pre-line rounded-xl bg-zinc-50 p-3.5 text-xs leading-relaxed text-zinc-600">
                  {item.body}
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">

                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600"
                    >
                      {tag}
                    </span>
                  ))}

                </div>

                <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">

                  <span className="text-[11px] text-zinc-400">
                    {item.owner} · usada {item.uses}x
                  </span>

                  <button
                    onClick={() => copiar(item)}
                    title="Copiar o texto para a área de transferência"
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      copied === item.id
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-violet-700 hover:bg-violet-50"
                    }`}
                  >
                    {copied === item.id ? (
                      <>
                        <Check size={13} />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        Copiar
                      </>
                    )}
                  </button>

                </div>

              </article>

            ))}

          </div>

        )}

      </div>

      {formOpen && (
        <MacroForm
          key={editing?.id ?? "novo"}
          open={formOpen}
          editing={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(undefined);
          }}
          onSave={salvar}
        />
      )}

      <ConfirmDelete
        open={Boolean(deleting)}
        label={deleting?.title ?? ""}
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) removeMacro(deleting.id);
          setDeleting(undefined);
        }}
      />

    </MainLayout>
  );
}
