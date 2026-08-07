"use client";

import { useState } from "react";

import {
  Check,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { useJourney } from "@/lib/context/JourneyContext";

interface Props {
  company: string;
  author: string;
}

const PALETTE = [
  "#EF4444",
  "#22C55E",
  "#0EA5E9",
  "#7C3AED",
  "#F59E0B",
  "#EC4899",
];

export default function JourneyTopics({
  company,
  author,
}: Props) {

  const {
    topics,
    entries,
    saveTopic,
    removeTopic,
    addEntry,
    updateEntry,
    removeEntry,
  } = useJourney();

  const [drafts, setDrafts] = useState<
    Record<string, string>
  >({});

  const [editing, setEditing] = useState<string | null>(
    null
  );

  const [editText, setEditText] = useState("");

  const [renaming, setRenaming] = useState<string | null>(
    null
  );

  function addTopic() {
    saveTopic({
      id: crypto.randomUUID(),
      name: "Novo tópico",
      icon: "note",
      color: PALETTE[topics.length % PALETTE.length],
      order: topics.length + 1,
    });
  }

  function publish(topicId: string) {

    const text = (drafts[topicId] ?? "").trim();

    if (!text) return;

    addEntry({ company, topicId, text, author });

    setDrafts((prev) => ({ ...prev, [topicId]: "" }));
  }

  return (
    <SurfaceCard
      title="Tópicos da jornada"
      description="Crie tópicos para ir moldando o acompanhamento deste cliente."
      action={
        <button
          onClick={addTopic}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
        >
          <Plus size={15} />
          Novo tópico
        </button>
      }
    >

      <div className="space-y-4">

        {topics.map((topic) => {

          const list = entries.filter(
            (item) =>
              item.company === company &&
              item.topicId === topic.id
          );

          return (
            <section
              key={topic.id}
              className="rounded-2xl border border-zinc-100"
            >

              <header className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">

                <div className="flex min-w-0 items-center gap-2.5">

                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: topic.color }}
                  />

                  {renaming === topic.id ? (

                    <input
                      autoFocus
                      value={topic.name}
                      onChange={(e) =>
                        saveTopic({
                          ...topic,
                          name: e.target.value,
                        })
                      }
                      onBlur={() => setRenaming(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          setRenaming(null);
                      }}
                      className="h-8 rounded-lg border border-zinc-200 px-2 text-sm font-semibold outline-none focus:border-violet-400"
                    />

                  ) : (

                    <h3 className="truncate text-sm font-semibold text-zinc-800">
                      {topic.name}
                    </h3>

                  )}

                  <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 text-[11px] font-medium text-zinc-500">
                    {list.length}
                  </span>

                </div>

                <div className="flex shrink-0 items-center gap-1">

                  <div className="mr-1 hidden gap-1 sm:flex">
                    {PALETTE.map((color) => (
                      <button
                        key={color}
                        onClick={() =>
                          saveTopic({ ...topic, color })
                        }
                        aria-label={`Cor ${color}`}
                        className={`h-4 w-4 rounded-full transition-transform hover:scale-110 ${
                          topic.color === color
                            ? "ring-2 ring-zinc-900 ring-offset-1"
                            : ""
                        }`}
                        style={{ background: color }}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => setRenaming(topic.id)}
                    title="Renomear tópico"
                    className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-violet-50 hover:text-violet-700"
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    onClick={() => removeTopic(topic.id)}
                    title={
                      list.length > 0
                        ? `Remove o tópico e ${list.length} registro(s)`
                        : "Excluir tópico"
                    }
                    className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>

                </div>

              </header>

              <div className="p-4">

                {list.length === 0 ? (

                  <p className="mb-3 rounded-xl border border-dashed border-zinc-200 py-5 text-center text-xs text-zinc-400">
                    Nenhum registro neste tópico ainda.
                  </p>

                ) : (

                  <ul className="mb-3 space-y-2">

                    {list.map((entry) => (

                      <li
                        key={entry.id}
                        className="group rounded-xl bg-zinc-50 px-3.5 py-3"
                      >

                        {editing === entry.id ? (

                          <div className="space-y-2">

                            <textarea
                              autoFocus
                              value={editText}
                              onChange={(e) =>
                                setEditText(e.target.value)
                              }
                              rows={3}
                              className="w-full resize-none rounded-lg border border-zinc-200 p-2.5 text-sm outline-none focus:border-violet-400"
                            />

                            <div className="flex justify-end gap-1.5">

                              <button
                                onClick={() =>
                                  setEditing(null)
                                }
                                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-200"
                              >
                                <X size={12} />
                                Cancelar
                              </button>

                              <button
                                onClick={() => {
                                  updateEntry(
                                    entry.id,
                                    editText
                                  );
                                  setEditing(null);
                                }}
                                className="flex items-center gap-1 rounded-lg bg-violet-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-violet-800"
                              >
                                <Check size={12} />
                                Salvar
                              </button>

                            </div>

                          </div>

                        ) : (

                          <>
                            <p className="text-sm leading-relaxed text-zinc-700">
                              {entry.text}
                            </p>

                            <div className="mt-1.5 flex items-center justify-between gap-2">

                              <p className="text-[11px] text-zinc-400">
                                {entry.author} ·{" "}
                                {entry.createdAt}
                              </p>

                              <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">

                                <button
                                  onClick={() => {
                                    setEditing(entry.id);
                                    setEditText(entry.text);
                                  }}
                                  title="Editar registro"
                                  className="rounded-md p-1 text-zinc-400 hover:bg-white hover:text-violet-700"
                                >
                                  <Pencil size={12} />
                                </button>

                                <button
                                  onClick={() =>
                                    removeEntry(entry.id)
                                  }
                                  title="Excluir registro"
                                  className="rounded-md p-1 text-zinc-400 hover:bg-white hover:text-rose-600"
                                >
                                  <Trash2 size={12} />
                                </button>

                              </div>

                            </div>
                          </>

                        )}

                      </li>

                    ))}

                  </ul>

                )}

                <div className="flex items-end gap-2">

                  <textarea
                    value={drafts[topic.id] ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [topic.id]: e.target.value,
                      }))
                    }
                    rows={2}
                    placeholder={`Adicionar em "${topic.name}"...`}
                    className="flex-1 resize-none rounded-xl border border-zinc-200 p-2.5 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400"
                  />

                  <button
                    onClick={() => publish(topic.id)}
                    disabled={
                      (drafts[topic.id] ?? "").trim() === ""
                    }
                    className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-violet-700 px-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
                  >
                    <Plus size={14} />
                    Add
                  </button>

                </div>

              </div>

            </section>
          );
        })}

        {topics.length === 0 && (
          <p className="rounded-2xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
            Nenhum tópico criado. Comece adicionando um.
          </p>
        )}

      </div>

    </SurfaceCard>
  );
}
