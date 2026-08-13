"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import {
  MessageSquareQuote,
  Search,
  Sparkles,
} from "lucide-react";

import { useMacros } from "@/lib/context/MacrosContext";
import { useSession } from "@/lib/context/SessionContext";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";

import { applyMacro } from "@/lib/models/macro";
import { Case } from "@/lib/models/case";

interface Props {
  data: Case;
  /** Recebe o texto já com as variáveis substituídas. */
  onInsert: (text: string) => void;
}

/**
 * Escolhe uma resposta pronta e insere na resposta pública, com o nome
 * do cliente e o protocolo já preenchidos.
 */
export default function MacroPicker({
  data,
  onInsert,
}: Props) {

  const { macros, registerUse } = useMacros();
  const session = useSession();
  const { findEstablishment } = useEstablishments();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const estabelecimento = data.establishmentId
    ? findEstablishment(data.establishmentId)?.name
    : undefined;

  const resultados = useMemo(() => {

    const termo = search.trim().toLowerCase();

    const lista = macros.filter(
      (item) =>
        !termo ||
        item.title.toLowerCase().includes(termo) ||
        item.body.toLowerCase().includes(termo)
    );

    // Respostas da mesma categoria do caso vêm primeiro.
    return [...lista].sort((a, b) => {

      const aMatch = a.category === data.category ? 0 : 1;
      const bMatch = b.category === data.category ? 0 : 1;

      return aMatch - bMatch || b.uses - a.uses;
    });

  }, [macros, search, data.category]);

  function inserir(id: string, body: string) {

    onInsert(
      applyMacro(body, {
        cliente: data.customer,
        protocolo: data.protocol,
        responsavel:
          data.owner ?? session?.name ?? "nossa equipe",
        estabelecimento:
          estabelecimento ?? "seu estabelecimento",
      })
    );

    registerUse(id);
    setOpen(false);
    setSearch("");
  }

  return (
    <div className="relative">

      <button
        onClick={() => setOpen((value) => !value)}
        title="Inserir um texto aprovado da biblioteca de respostas"
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50"
      >
        <MessageSquareQuote size={13} />
        Usar resposta pronta
      </button>

      {open && (

        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[420px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_32px_-12px_rgba(16,24,40,0.25)]">

            <div className="border-b border-zinc-100 p-3">

              <div className="relative">

                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                />

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  autoFocus
                  placeholder="Buscar resposta..."
                  className="h-10 w-full rounded-xl border border-zinc-200 pl-9 pr-3 text-sm outline-none transition-colors focus:border-violet-400"
                />

              </div>

            </div>

            {resultados.length === 0 ? (

              <p className="px-4 py-8 text-center text-sm text-zinc-400">
                Nenhuma resposta encontrada.
              </p>

            ) : (

              <ul className="max-h-[320px] overflow-y-auto p-1.5">

                {resultados.map((item) => (

                  <li key={item.id}>

                    <button
                      onClick={() =>
                        inserir(item.id, item.body)
                      }
                      className="w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-violet-50/60"
                    >

                      <span className="flex items-center gap-2">

                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800">
                          {item.title}
                        </span>

                        {item.category ===
                          data.category && (
                          <span
                            className="flex shrink-0 items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800"
                            title="Mesma categoria desta reclamação"
                          >
                            <Sparkles size={9} />
                            sugerida
                          </span>
                        )}

                      </span>

                      <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-zinc-500">
                        {item.body}
                      </span>

                    </button>

                  </li>

                ))}

              </ul>

            )}

            <Link
              href="/base-conhecimento"
              onClick={() => setOpen(false)}
              className="block border-t border-zinc-100 px-4 py-2.5 text-center text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-violet-700"
            >
              Gerenciar respostas prontas
            </Link>

          </div>
        </>

      )}

    </div>
  );
}
