"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";

import { ArrowUpRight, Building2, Loader2, Mail, Phone, Plus } from "lucide-react";

import { Case, semNome } from "@/lib/models/case";

import { loadCaseTexts } from "@/lib/actions/cases";
import {
  addCaseNote,
  CaseNote,
  listCaseNotes,
} from "@/lib/actions/notes";

import SurfaceCard from "@/components/shared/SurfaceCard";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";
import { slugify } from "@/lib/services/slug";
import CampoQueSalva from "@/components/shared/CampoQueSalva";
import { nomearConsumidor } from "@/lib/actions/tratativa";

function iniciais(nome: string) {
  return nome.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/** O link do WhatsApp Web para o telefone do caso, se ele estiver completo. */
function whatsappDe(telefone?: string | null) {
  let d = String(telefone ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length >= 12 ? `https://wa.me/${d}` : null;
}

interface Props {
  data: Case;
  onChange: (patch: Partial<Case>) => void;

  /**
   * O que veio do servidor, e não do teclado.
   *
   * Separado de `onChange` porque a diferença é de autoria. O relato é
   * pesado e fica fora da listagem; buscá-lo ao abrir entregava o texto
   * pelo mesmo caminho da digitação, e **abrir o caso passava a contar
   * como tê-lo editado** — a barra "Salvar" aparecia sozinha em toda
   * reclamação, e sair da tela pedia confirmação de um trabalho que
   * ninguém fez.
   */
  onLoad: (dados: Partial<Case>) => void;
}

const field =
  "h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400";

const label =
  "text-[11px] font-semibold uppercase tracking-wide text-zinc-400";

export default function OverviewTab({
  data,
  onChange,
  onLoad,
}: Props) {

  const { findEstablishment } = useEstablishments();
  /** O nome de antes, enquanto o "desfazer" do nome recém-salvo está à vista. */
  const [nomeSalvo, setNomeSalvo] = useState<string | null>(null);
  const estabelecimento = data.establishmentId ? findEstablishment(data.establishmentId) : undefined;

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

    /*
      Busca se falta **algum** dos dois textos.

      Era `if (data.description)`: com o relato já presente — o caso
      recém-criado, por exemplo —, a busca era pulada, e a resposta
      pública, que nunca vem na lista, ficaria sem carregar.
    */
    if (
      (data.description &&
        data.publicResponse !== undefined) ||
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
    loadCaseTexts(pedido)
      .then((textos) => {
        if (buscado.current !== pedido) return;

        /*
          Os dois textos que a lista não traz, no rascunho **sem sujá-lo**.

          A resposta pública entra junto do relato desde 10/09/2026.
          Sem ela a aba Avaliação mostrava a resposta vazia em toda
          reclamação, e o botão de publicar o rascunho — que junta
          "resposta existente + rascunho" — gravava só o rascunho por
          cima da resposta de verdade.
        */
        onLoad({
          ...(textos.description
            ? { description: textos.description }
            : {}),
          publicResponse: textos.publicResponse,
        });
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

  }, [
    data.protocol,
    data.description,
    data.publicResponse,
    onLoad,
  ]);

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

    const pedido = data.protocol;

    setCarregandoNotas(true);

    /*
      Confere o protocolo, e não um booleano de "ainda montado" — o
      mesmo conserto do relato, logo acima, que ficou faltando aqui.

      Com `let ativo` zerado na limpeza e o `ref` de "já busquei", a
      montagem dupla do modo de desenvolvimento jogava fora a resposta:
      "Carregando anotações…" para sempre, com a lista no banco. Achado
      na conferência da Fase 3, em 13/09/2026.
    */
    listCaseNotes(pedido)
      .then((lista) => {
        if (notasDe.current === pedido) setComments(lista);
      })
      .catch((error: unknown) => {
        console.error(
          "[caso] anotações não carregaram",
          error
        );
      })
      .finally(() => {
        if (notasDe.current === pedido) setCarregandoNotas(false);
      });

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
        description="Quem está nesta reclamação — clique para abrir a ficha de cada um."
        action={
          <span className="shrink-0 rounded-xl bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600">
            {estabelecimento ? "cliente e conta" : "1 pessoa vinculada"}
          </span>
        }
      >

        <ul className="space-y-2">

          <li className="rounded-xl bg-violet-50/50 p-3 ring-1 ring-inset ring-violet-100">
            {semNome(data.customer) ? (
              /* Chegou sem nome (a leitura do portal nem sempre traz): o nome se escreve aqui e grava ao sair. */
              <CampoQueSalva
                id="nome-do-consumidor"
                rotulo="Nome do consumidor"
                valor=""
                placeholder="Ainda sem nome — digite e saia do campo"
                maximo={120}
                onSalvar={async (nome) => {
                  const r = await nomearConsumidor({ protocol: data.protocol, nome });
                  if (r.ok) {
                    /* O campo vira o nome: o "salvo · desfazer" continua ao lado dele por alguns segundos. */
                    setNomeSalvo(data.customer);
                    window.setTimeout(() => setNomeSalvo(null), 10000);
                    onLoad({ customer: nome });
                  }
                  return r;
                }}
              />
            ) : (
            <Link
              href={`/clientes/${slugify(data.customer)}`}
              title={`Abrir a ficha de ${data.customer}: todas as reclamações, NPS e conversas`}
              className="group flex min-w-0 items-center gap-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-100">
                {iniciais(data.customer)}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 truncate text-sm font-semibold text-zinc-900 group-hover:text-violet-700">
                  {data.customer}
                  <ArrowUpRight size={13} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                <span className="block text-[11px] text-zinc-500">Consumidor{data.city ? ` · ${data.city}/${data.state}` : ""}</span>
              </span>
            </Link>
            )}
            {nomeSalvo !== null && !semNome(data.customer) && (
              <p aria-live="polite" className="mt-1 flex items-center gap-1.5 pl-[52px] text-[11px]">
                <span className="text-emerald-700">nome salvo</span>
                <button
                  type="button"
                  onClick={async () => {
                    const anterior = nomeSalvo || "Não informado";
                    const r = await nomearConsumidor({ protocol: data.protocol, nome: anterior });
                    if (r.ok) {
                      setNomeSalvo(null);
                      onLoad({ customer: anterior });
                    }
                  }}
                  className="rounded px-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                >
                  desfazer
                </button>
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5 pl-[52px]">
              {whatsappDe(data.phone) ? (
                <a
                  href={whatsappDe(data.phone)!}
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir a conversa no WhatsApp Web"
                  className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[11px] text-zinc-700 ring-1 ring-inset ring-violet-100 hover:text-emerald-700 hover:ring-emerald-200"
                >
                  <Phone size={10} />
                  {data.phone}
                </a>
              ) : (
                <span className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[11px] text-zinc-400 ring-1 ring-inset ring-violet-100">
                  <Phone size={10} />—
                </span>
              )}
              {data.email ? (
                <a
                  href={`mailto:${data.email}`}
                  className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[11px] text-zinc-700 ring-1 ring-inset ring-violet-100 hover:text-violet-700"
                >
                  <Mail size={10} />
                  {data.email}
                </a>
              ) : (
                <span className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-[11px] text-zinc-400 ring-1 ring-inset ring-violet-100">
                  <Mail size={10} />—
                </span>
              )}
            </div>
          </li>

          {estabelecimento && (
            <li>
              <Link
                href={`/estabelecimentos/${estabelecimento.slug}`}
                className="group flex items-center gap-3 rounded-xl p-3 ring-1 ring-inset ring-zinc-100 transition-colors hover:bg-zinc-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-50 text-zinc-500 ring-1 ring-inset ring-zinc-200">
                  <Building2 size={16} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 truncate text-sm font-semibold text-zinc-900 group-hover:text-violet-700">
                    {estabelecimento.name}
                    <ArrowUpRight size={13} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                  <span className="block text-[11px] text-zinc-500">
                    {["Conta", estabelecimento.plan, estabelecimento.status].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </Link>
            </li>
          )}

        </ul>

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
                    timeZone: "America/Sao_Paulo",
                  })}
                </p>

              </li>

            ))}

          </ul>

        )}

        {/* Uma linha e um botão pequeno: Enter adiciona, Shift+Enter quebra a linha. */}
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            publish();
          }}
        >
          <label htmlFor="nova-anotacao" className="sr-only">
            Nova anotação
          </label>
          <textarea
            id="nova-anotacao"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              e.currentTarget.style.height = "auto";
              e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                publish();
              }
            }}
            rows={1}
            placeholder="Anotar contexto, próximo passo ou decisão… (Enter adiciona)"
            className="min-h-[38px] flex-1 resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400"
          />
          <button
            type="submit"
            disabled={draft.trim() === "" || anotando}
            title="Adicionar a anotação"
            className="flex h-[38px] shrink-0 items-center gap-1.5 rounded-xl bg-zinc-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {anotando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Adicionar
          </button>
        </form>

      </SurfaceCard>

    </div>
  );
}
