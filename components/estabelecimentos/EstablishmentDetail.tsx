"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import {
  ArrowLeft,
  Building2,
  Link2,
  Link2Off,
  Mail,
  MessagesSquare,
  Pencil,
  Phone,
  Plus,
  Search,
  Star,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import { ExternalLink } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import {
  documentoFormatado,
  tipoDeDocumento,
} from "@/lib/models/establishment";
import { ConfirmDelete } from "@/components/shared/Modal";

import EstablishmentForm from "@/components/estabelecimentos/EstablishmentForm";
import ImpactForm from "@/components/impacto/ImpactForm";

import { useCases } from "@/lib/context/CaseContext";
import { useClients } from "@/lib/context/ClientsContext";
import { useImpact } from "@/lib/context/ImpactContext";
import { useToast } from "@/lib/context/ToastContext";
import {
  EstablishmentDraft,
  useEstablishments,
} from "@/lib/context/EstablishmentsContext";

import {
  buildStats,
  casesOf,
  impactsOf,
} from "@/lib/services/establishment.service";

import { ptBR } from "@/lib/services/reputation.service";

import {
  Establishment,
  planTone,
  statusTone,
} from "@/lib/models/establishment";

import { kindTone } from "@/lib/models/client";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function br(date?: string) {
  if (!date) return "—";
  return date.split("-").reverse().join("/");
}

export default function EstablishmentDetail({
  slug,
}: {
  slug: string;
}) {

  const { cases, updateCase } = useCases();

  const { notify } = useToast();

  /**
   * Alterar tem de dizer que alterou.
   *
   * Vincular e desvincular reclamação são atos fechados — não há o que
   * segurar num rascunho. O que faltava era a confirmação: a tela
   * gravava calada, e só a falha aparecia.
   */
  function confirmar(titulo: string, detalhe?: string) {
    notify({ tone: "success", title: titulo, detail: detalhe });
  }
  const { clients } = useClients();
  const { records, createRecord } = useImpact();

  const {
    findEstablishment,
    updateEstablishment,
    removeEstablishment,
  } = useEstablishments();

  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [caseSearch, setCaseSearch] = useState("");
  const [impactOpen, setImpactOpen] = useState(false);

  const establishment = findEstablishment(slug);

  const vinculados = useMemo(
    () =>
      establishment
        ? casesOf(cases, establishment.id)
        : [],
    [cases, establishment]
  );

  const impactos = useMemo(
    () =>
      establishment
        ? impactsOf(records, establishment.id)
        : [],
    [records, establishment]
  );

  const stats = useMemo(
    () => buildStats(vinculados, impactos),
    [vinculados, impactos]
  );

  const pessoas = useMemo(
    () =>
      establishment
        ? clients.filter(
            (item) =>
              item.establishmentId === establishment.id
          )
        : [],
    [clients, establishment]
  );

  const resultados = useMemo(() => {

    const termo = caseSearch.trim().toLowerCase();

    if (!termo) return [];

    return cases
      .filter(
        (item) =>
          item.establishmentId !== establishment?.id &&
          (item.protocol.toLowerCase().includes(termo) ||
            item.customer
              .toLowerCase()
              .includes(termo) ||
            item.title.toLowerCase().includes(termo))
      )
      .slice(0, 6);

  }, [cases, caseSearch, establishment]);

  if (!establishment) {
    return (
      <SurfaceCard>

        <div className="py-16 text-center">

          <Building2
            size={30}
            className="mx-auto text-zinc-300"
          />

          <p className="mt-3 text-sm text-zinc-500">
            Estabelecimento não encontrado.
          </p>

          <Link
            href="/estabelecimentos"
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-violet-200 px-4 py-2.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
          >
            <ArrowLeft size={15} />
            Voltar para a lista
          </Link>

        </div>

      </SurfaceCard>
    );
  }

  function salvar(
    data: EstablishmentDraft | Establishment
  ) {

    if ("id" in data) {
      updateEstablishment(data);
      confirmar("Estabelecimento salvo.", data.name);
    }

    setFormOpen(false);
  }

  const dados: [string, string][] = [
    [
      tipoDeDocumento(establishment.document) ||
        "CPF/CNPJ",
      documentoFormatado(establishment.document) || "—",
    ],
    ["Segmento", establishment.segment ?? "—"],
    [
      "Cidade",
      establishment.city
        ? `${establishment.city}${
            establishment.state
              ? `/${establishment.state}`
              : ""
          }`
        : "—",
    ],
    ["Plano", establishment.plan],
    [
      "Mensalidade",
      establishment.mrr
        ? `${money.format(establishment.mrr)}/mês`
        : "—",
    ],
    ["Cliente desde", br(establishment.startedAt)],
    ["Responsável na CW", establishment.owner ?? "—"],
    ["Conta no CW Engine", establishment.externalId ?? "—"],
  ];

  /**
   * O endereço da conta no portal, quando a carga o trouxe.
   *
   * Fica fora da lista acima porque é **link**, e link em lista de
   * texto vira número para copiar à mão. Daqui a operação abre a conta
   * do restaurante em um clique — que é o motivo de o campo existir.
   *
   * Não é montado a partir do id da conta: são **dois números
   * diferentes** — a conta 27409 abre em /contas/25681 —, e montar a
   * URL pelo id errado levaria à ficha de outro restaurante.
   */
  const noPortal = establishment.portalUrl?.trim();

  return (
    <div className="space-y-6">

      <Link
        href="/estabelecimentos"
        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-violet-700"
      >
        <ArrowLeft size={15} />
        Estabelecimentos
      </Link>

      <PageHeading
        eyebrow="Estabelecimento"
        title={establishment.name}
        description={
          establishment.notes ??
          "Conta acompanhada pela operação de Reputação."
        }
      >

        <div className="flex items-center gap-2">

          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <Pencil size={15} />
            Editar
          </button>

          <button
            onClick={() => setDeleting(true)}
            title="Excluir estabelecimento"
            className="rounded-xl border border-zinc-200 p-2.5 text-zinc-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 size={15} />
          </button>

        </div>

      </PageHeading>

      <div className="flex flex-wrap items-center gap-2">

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
            statusTone[establishment.status]
          }`}
        >
          {establishment.status}
        </span>

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
            planTone[establishment.plan]
          }`}
        >
          Plano {establishment.plan}
        </span>

        {establishment.phone && (
          <span className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
            <Phone size={11} />
            {establishment.phone}
          </span>
        )}

        {establishment.email && (
          <span className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
            <Mail size={11} />
            {establishment.email}
          </span>
        )}

      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <StatTile
          label="Reclamações"
          description="Casos vinculados a este estabelecimento."
          value={stats.total}
          hint={`${stats.reclameAqui} no Reclame Aqui`}
          icon={Building2}
          tone="primary"
        />

        <StatTile
          label="Em aberto"
          description="Tratativas ainda não encerradas."
          value={stats.open}
          hint={`${stats.resolved} resolvidas`}
          icon={MessagesSquare}
          tone="warning"
        />

        <StatTile
          label="Nota no período"
          description="Nota RA calculada só com as reclamações desta conta."
          value={
            stats.reclameAqui === 0
              ? "—"
              : ptBR(stats.raScore)
          }
          hint={
            stats.reclameAqui === 0
              ? "sem base para cálculo"
              : `${ptBR(stats.responseIndex)}% respondidas`
          }
          icon={Star}
          tone="info"
        />

        <StatTile
          label="Impacto registrado"
          description="Resultado financeiro atribuído a esta conta."
          value={
            stats.impactCount === 0
              ? "—"
              : money.format(stats.impact)
          }
          hint={`${stats.impactCount} registro(s)`}
          icon={Wallet}
          tone="success"
        />

      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">

        <div className="space-y-6">

          <SurfaceCard
            title="Dados cadastrais"
            description="Informações da conta na Cardápio Web."
          >

            <dl className="space-y-3">

              {dados.map(([label, value]) => (

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

            {noPortal ? (
              <a
                href={noPortal}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-violet-300 hover:text-violet-700"
              >
                Abrir a conta no portal
                <ExternalLink size={13} />
              </a>
            ) : null}

          </SurfaceCard>

          <SurfaceCard
            title="Pessoas vinculadas"
            description="Clientes ligados a este estabelecimento."
            action={
              <Link
                href="/clientes"
                className="shrink-0 rounded-xl border border-violet-200 px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50"
              >
                Ver clientes
              </Link>
            }
          >

            {pessoas.length === 0 ? (

              <p className="rounded-xl border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-400">
                Nenhuma pessoa vinculada. O vínculo é feito
                no perfil do cliente.
              </p>

            ) : (

              <ul className="space-y-2">

                {pessoas.map((item) => (

                  <li key={item.slug}>

                    <Link
                      href={`/clientes/${item.slug}`}
                      className="flex items-center gap-3 rounded-xl border border-zinc-200/80 px-3.5 py-2.5 transition-colors hover:border-violet-200 hover:bg-violet-50/40"
                    >

                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                        <UserRound size={15} />
                      </span>

                      <span className="min-w-0 flex-1">

                        <span className="block truncate text-sm font-medium text-zinc-800">
                          {item.name}
                        </span>

                        <span className="block truncate text-[11px] text-zinc-500">
                          {item.total} reclamação(ões)
                        </span>

                      </span>

                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                          kindTone[item.kind]
                        }`}
                      >
                        {item.kind}
                      </span>

                    </Link>

                  </li>

                ))}

              </ul>

            )}

          </SurfaceCard>

        </div>

        <div className="space-y-6">

          <SurfaceCard
            title="Reclamações vinculadas"
            description={`${vinculados.length} caso(s) ligados a este estabelecimento.`}
          >

            <div className="relative">

              <Search
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
              />

              <input
                value={caseSearch}
                onChange={(e) =>
                  setCaseSearch(e.target.value)
                }
                placeholder="Buscar reclamação para vincular..."
                className="h-11 w-full rounded-xl border border-zinc-200 pl-10 pr-3 text-sm outline-none transition-colors focus:border-violet-400"
              />

            </div>

            {resultados.length > 0 && (

              <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-zinc-200">

                {resultados.map((item) => (

                  <li key={item.id}>

                    <button
                      onClick={() => {
                        updateCase({
                          ...item,
                          establishmentId:
                            establishment.id,

                          // Escolha de gente trava o automático.
                          establishmentManual: true,
                        });

                        confirmar(
                          "Reclamação vinculada.",
                          `${item.protocol} — ${establishment.name}`
                        );

                        setCaseSearch("");
                      }}
                      className="flex w-full items-center gap-3 border-b border-zinc-100 px-3.5 py-2.5 text-left transition-colors last:border-0 hover:bg-violet-50/50"
                    >

                      <span className="min-w-0 flex-1">

                        <span className="block truncate text-sm font-medium text-zinc-800">
                          {item.title}
                        </span>

                        <span className="mt-0.5 block truncate font-mono text-[11px] text-violet-700">
                          {item.protocol} · {item.customer}
                        </span>

                      </span>

                      <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-800">
                        <Link2 size={11} />
                        Vincular
                      </span>

                    </button>

                  </li>

                ))}

              </ul>

            )}

            <div className="mt-4">

              {vinculados.length === 0 ? (

                <p className="rounded-xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
                  Nenhuma reclamação vinculada ainda. Use a
                  busca acima para ligar um caso a esta
                  conta.
                </p>

              ) : (

                <ul className="space-y-2">

                  {vinculados.map((item) => (

                    <li
                      key={item.id}
                      className="group flex items-center gap-3 rounded-xl border border-zinc-200/80 px-3.5 py-3 transition-colors hover:border-violet-200"
                    >

                      <Link
                        href={`/reclame-aqui/${item.id}`}
                        className="min-w-0 flex-1"
                      >

                        <p className="truncate text-sm font-medium text-zinc-800">
                          {item.title}
                        </p>

                        <p className="mt-0.5 truncate text-[11px] text-zinc-500">

                          <span className="font-mono text-violet-700">
                            {item.protocol}
                          </span>

                          {" · "}
                          {item.customer} · {br(item.createdAt)}

                        </p>

                      </Link>

                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                          item.resolved
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                            : "bg-amber-50 text-amber-700 ring-amber-100"
                        }`}
                      >
                        {item.status}
                      </span>

                      <button
                        onClick={() => {

                          updateCase({
                            ...item,
                            establishmentId: undefined,

                            /**
                             * Sem esta marca, o CNPJ religaria no
                             * salvamento seguinte e o botão pareceria
                             * não funcionar.
                             */
                            establishmentManual: true,
                          });

                          confirmar(
                            "Reclamação desvinculada.",
                            item.protocol
                          );
                        }}
                        title="Desvincular deste estabelecimento"
                        className="shrink-0 rounded-lg p-1.5 text-zinc-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                      >
                        <Link2Off size={14} />
                      </button>

                    </li>

                  ))}

                </ul>

              )}

            </div>

          </SurfaceCard>

          <SurfaceCard
            title="Impacto no negócio"
            description="Resultado financeiro registrado nesta conta."
            action={
              <button
                onClick={() => setImpactOpen(true)}
                title="Registrar um resultado financeiro já vinculado a este estabelecimento"
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-violet-200 px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50"
              >
                <Plus size={13} />
                Registrar impacto
              </button>
            }
          >

            {impactos.length === 0 ? (

              <p className="rounded-xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
                Nenhum impacto registrado para este
                estabelecimento.
              </p>

            ) : (

              <ul className="space-y-2">

                {impactos.map((item) => (

                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-zinc-200/80 px-3.5 py-3"
                  >

                    <span className="min-w-0 flex-1">

                      <span className="block truncate text-sm font-medium text-zinc-800">
                        {item.type}
                      </span>

                      <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                        {br(item.date)}
                        {item.relatedCase
                          ? ` · ${item.relatedCase}`
                          : ""}
                      </span>

                    </span>

                    <span
                      className={`shrink-0 text-sm font-semibold tabular-nums ${
                        item.amount < 0
                          ? "text-rose-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {money.format(item.amount)}
                    </span>

                  </li>

                ))}

              </ul>

            )}

          </SurfaceCard>

        </div>

      </div>

      {formOpen && (
        <EstablishmentForm
          key={establishment.id}
          open={formOpen}
          editing={establishment}
          onClose={() => setFormOpen(false)}
          onSave={salvar}
        />
      )}

      {impactOpen && (
        <ImpactForm
          key={establishment.id}
          open={impactOpen}
          presetEstablishmentId={establishment.id}
          onClose={() => setImpactOpen(false)}
          onSave={(item) => {
            if (!("id" in item)) createRecord(item);
            setImpactOpen(false);
          }}
        />
      )}

      <ConfirmDelete
        open={deleting}
        label={establishment.name}
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          removeEstablishment(establishment.id);
          setDeleting(false);
          window.location.href = "/estabelecimentos";
        }}
      />

    </div>
  );
}
