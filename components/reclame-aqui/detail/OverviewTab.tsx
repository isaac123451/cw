"use client";

import { useEffect, useRef, useState } from "react";

import { Mail, Phone, Send, User } from "lucide-react";

import { Case } from "@/lib/models/case";

import { loadCaseDescription } from "@/lib/actions/cases";
import {
  addCaseNote,
  CaseNote,
  listCaseNotes,
} from "@/lib/actions/notes";

import SurfaceCard from "@/components/shared/SurfaceCard";

interface Props {
  data: Case;
  onChange: (patch: Partial<Case>) => void;
}

const field =
  "h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400";

const label =
  "text-[11px] font-semibold uppercase tracking-wide text-zinc-400";

export default function OverviewTab({
  data,
  onChange,
}: Props) {

  const [comments, setComments] = useState<CaseNote[]>(
    []
  );

  const [carregandoNotas, setCarregandoNotas] =
    useState(false);
  const [anotando, setAnotando] = useState(false);

  /** Evita rebuscar as anotações a cada re-render do mesmo caso. */
  const notasDe = useRef<string | null>(null);

  const [draft, setDraft] = useState("");

  const [carregandoRelato, setCarregandoRelato] =
    useState(false);

  /** Evita repetir a busca a cada re-render do mesmo caso. */
  const buscado = useRef<string | null>(null);

  /**
   * O relato não vem na listagem — é metade do payload e só esta tela
   * o mostra. Busca ao abrir o caso, se ainda não veio.
   */
  useEffect(() => {

    if (
      data.description ||
      buscado.current === data.protocol
    ) {
      return;
    }

    buscado.current = data.protocol;

    const pedido = data.protocol;

    setCarregandoRelato(true);

    /*
      Confere o protocolo, e não um booleano de "ainda montado".

      Era `let ativo = true` com `return () => { ativo = false }`, e
      junto com o `ref` de "já busquei" isso **impede a carga** em
      desenvolvimento: o React monta, desmonta e monta de novo cada
      componente de propósito, então a limpeza zera o `ativo` da
      primeira busca, o segundo efeito sai cedo pelo `ref`, e a resposta
      que chega é jogada fora. O relato ficava vazio na tela com 1.482
      caracteres no banco — sem erro, sem aviso.

      Em produção não acontece (a repetição é só do modo de
      desenvolvimento), o que é pior: o defeito só aparecia onde a gente
      confere as coisas.
    */
    loadCaseDescription(pedido)
      .then((texto) => {
        if (buscado.current !== pedido) return;

        if (texto) {
          onChange({ description: texto });
        }
      })
      .catch((error: unknown) => {
        console.error(
          "[caso] relato não carregou",
          error
        );
      })
      .finally(() => {
        if (buscado.current === pedido) {
          setCarregandoRelato(false);
        }
      });

  }, [data.protocol, data.description, onChange]);

  /**
   * As anotações vêm do banco — as mesmas que a extensão grava.
   *
   * Antes isto era `useState([])` e nada mais: o que se escrevia aqui
   * sumia no recarregamento, e o que o painel do WhatsApp gravava nunca
   * aparecia nesta tela. Eram dois históricos paralelos do mesmo
   * atendimento, e nenhum contava a história inteira.
   */
  useEffect(() => {

    if (notasDe.current === data.protocol) return;

    notasDe.current = data.protocol;

    let ativo = true;

    setCarregandoNotas(true);

    listCaseNotes(data.protocol)
      .then((lista) => {
        if (ativo) setComments(lista);
      })
      .catch((error: unknown) => {
        console.error(
          "[caso] anotações não carregaram",
          error
        );
      })
      .finally(() => {
        if (ativo) setCarregandoNotas(false);
      });

    return () => {
      ativo = false;
    };

  }, [data.protocol]);

  async function publish() {

    const texto = draft.trim();

    if (texto === "" || anotando) return;

    setAnotando(true);

    try {

      const criada = await addCaseNote(
        data.protocol,
        texto
      );

      /**
       * A anotação só entra na lista depois de o servidor confirmar —
       * e com o autor que **ele** registrou. Otimismo aqui mostraria
       * "Operação" no lugar de quem realmente anotou.
       */
      if (criada) {
        setComments((prev) => [criada, ...prev]);
        setDraft("");
      }

    } finally {
      setAnotando(false);
    }
  }

  return (
    <div className="space-y-5">

      <SurfaceCard
        title="Dados base da reclamação"
        description="Campos principais do caso. Classificação e checklist ficam na aba Investigação."
      >

        <div className="space-y-4">

          <div>
            <label className={label}>
              Título da reclamação
            </label>

            <input
              value={data.title}
              onChange={(e) =>
                onChange({ title: e.target.value })
              }
              className={`${field} mt-1.5`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">

            <div>
              <label className={label}>
                Nome do cliente
              </label>

              <input
                value={data.customer}
                onChange={(e) =>
                  onChange({ customer: e.target.value })
                }
                className={`${field} mt-1.5`}
              />
            </div>

            <div>
              <label className={label}>
                Data da reclamação
              </label>

              <input
                type="date"
                value={data.createdAt}
                onChange={(e) =>
                  onChange({ createdAt: e.target.value })
                }
                className={`${field} mt-1.5`}
              />
            </div>

            <div>
              <label className={label}>E-mail</label>

              <input
                value={data.email ?? ""}
                onChange={(e) =>
                  onChange({ email: e.target.value })
                }
                placeholder="cliente@email.com"
                className={`${field} mt-1.5`}
              />
            </div>

            <div>
              <label className={label}>Telefone</label>

              <input
                value={data.phone ?? ""}
                onChange={(e) =>
                  onChange({ phone: e.target.value })
                }
                placeholder="(11)90000-0000"
                className={`${field} mt-1.5`}
              />
            </div>

          </div>

          <div>
            <label className={label}>
              Descrição da reclamação
            </label>

            <textarea
              value={data.description}
              onChange={(e) =>
                onChange({ description: e.target.value })
              }
              rows={5}
              placeholder={
                carregandoRelato
                  ? "Carregando o relato..."
                  : undefined
              }
              className="mt-1.5 w-full resize-y rounded-xl border border-zinc-200 p-3 text-sm leading-relaxed outline-none transition-colors placeholder:italic placeholder:text-zinc-400 focus:border-violet-400"
            />
          </div>

        </div>

      </SurfaceCard>

      <SurfaceCard
        title="Pessoas relacionadas"
        description="Contatos vinculados a esta reclamação."
        action={
          <span className="shrink-0 rounded-xl bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600">
            1 pessoa vinculada
          </span>
        }
      >

        <div className="rounded-xl bg-violet-50/50 p-4 ring-1 ring-inset ring-violet-100">

          <div className="flex items-center gap-3">

            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-100">
              {data.customer
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>

            <div className="min-w-0">

              <p className="truncate text-sm font-semibold text-zinc-900">
                {data.customer}
              </p>

              <div className="mt-1.5 flex flex-wrap gap-1.5">

                <span className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[11px] text-zinc-600 ring-1 ring-inset ring-violet-100">
                  <Phone size={10} />
                  {data.phone ?? "—"}
                </span>

                <span className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[11px] text-zinc-600 ring-1 ring-inset ring-violet-100">
                  <Mail size={10} />
                  {data.email ?? "—"}
                </span>

                <span className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[11px] text-zinc-600 ring-1 ring-inset ring-violet-100">
                  <User size={10} />
                  {data.city}/{data.state}
                </span>

              </div>

            </div>

          </div>

        </div>

      </SurfaceCard>

      <SurfaceCard
        title="Anotações"
        description="Andamento, decisões e contexto interno. É a mesma lista que a extensão grava e lê — anotar aqui ou pelo painel dá no mesmo."
        action={
          <span className="shrink-0 rounded-xl bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600">
            {comments.length} anotação(ões)
          </span>
        }
      >

        {carregandoNotas ? (

          <p className="rounded-xl border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-400">
            Carregando anotações...
          </p>

        ) : comments.length === 0 ? (

          <p className="rounded-xl border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-400">
            Ainda não há anotações nesta reclamação — nem aqui, nem pela extensão.
          </p>

        ) : (

          <ul className="space-y-2.5">

            {comments.map((item) => (

              <li
                key={item.id}
                className="rounded-xl border border-zinc-100 p-3.5"
              >

                <p className="text-sm leading-relaxed text-zinc-700">
                  {item.text}
                </p>

                <p className="mt-1.5 text-[11px] text-zinc-400">
                  {item.author} ·{" "}
                  {new Date(
                    item.createdAt
                  ).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>

              </li>

            ))}

          </ul>

        )}

        <div className="mt-4">

          <label className={label}>
            Nova anotação
          </label>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Registre contexto, próximos passos ou decisões internas."
            className="mt-1.5 w-full resize-none rounded-xl border border-zinc-200 p-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400"
          />

          <div className="mt-2 flex justify-end">

            <button
              onClick={publish}
              disabled={draft.trim() === "" || anotando}
              className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
            >
              <Send size={15} />
              {anotando ? "Anotando..." : "Anotar"}
            </button>

          </div>

        </div>

      </SurfaceCard>

    </div>
  );
}
