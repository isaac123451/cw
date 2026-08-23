"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import {
  ArrowUpRight,
  Building2,
  MessagesSquare,
  Pencil,
  PiggyBank,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";
import { ConfirmDelete } from "@/components/shared/Modal";

import EstablishmentForm from "@/components/estabelecimentos/EstablishmentForm";

import { useCases } from "@/lib/context/CaseContext";
import { useImpact } from "@/lib/context/ImpactContext";
import {
  EstablishmentDraft,
  useEstablishments,
} from "@/lib/context/EstablishmentsContext";

import { summarize } from "@/lib/services/establishment.service";

import {
  Establishment,
  EstablishmentStatus,
  ESTABLISHMENT_STATUSES,
  planTone,
  statusTone,
} from "@/lib/models/establishment";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

type SortKey = "nome" | "casos" | "abertos" | "mrr";

const sorts: { id: SortKey; label: string; hint: string }[] =
  [
    {
      id: "nome",
      label: "Nome",
      hint: "Ordem alfabética.",
    },
    {
      id: "casos",
      label: "Mais casos",
      hint: "Estabelecimentos com mais reclamações vinculadas.",
    },
    {
      id: "abertos",
      label: "Mais em aberto",
      hint: "Quem tem mais tratativas ainda não encerradas.",
    },
    {
      id: "mrr",
      label: "Maior mensalidade",
      hint: "Contas de maior receita recorrente.",
    },
  ];

export default function EstabelecimentosPage() {

  const { cases } = useCases();
  const { records } = useImpact();

  const {
    establishments,
    createEstablishment,
    updateEstablishment,
    removeEstablishment,
  } = useEstablishments();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<
    EstablishmentStatus | "Todos"
  >("Todos");
  const [sort, setSort] = useState<SortKey>("nome");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Establishment>();
  const [deleting, setDeleting] = useState<Establishment>();

  const rows = useMemo(
    () => summarize(establishments, cases, records),
    [establishments, cases, records]
  );

  const visible = useMemo(() => {

    const termo = search.trim().toLowerCase();

    const list = rows.filter(({ establishment }) => {

      if (
        status !== "Todos" &&
        establishment.status !== status
      ) {
        return false;
      }

      if (!termo) return true;

      return (
        establishment.name
          .toLowerCase()
          .includes(termo) ||
        (establishment.city ?? "")
          .toLowerCase()
          .includes(termo) ||
        (establishment.segment ?? "")
          .toLowerCase()
          .includes(termo) ||
        (establishment.document ?? "").includes(termo)
      );
    });

    const ordered = [...list];

    if (sort === "casos") {
      ordered.sort(
        (a, b) => b.stats.total - a.stats.total
      );
    } else if (sort === "abertos") {
      ordered.sort(
        (a, b) => b.stats.open - a.stats.open
      );
    } else if (sort === "mrr") {
      ordered.sort(
        (a, b) =>
          (b.establishment.mrr ?? 0) -
          (a.establishment.mrr ?? 0)
      );
    } else {
      ordered.sort((a, b) =>
        a.establishment.name.localeCompare(
          b.establishment.name
        )
      );
    }

    return ordered;

  }, [rows, search, status, sort]);

  const metrics = useMemo(() => {

    const ativos = establishments.filter(
      (item) => item.status === "Ativo"
    ).length;

    const emRisco = establishments.filter(
      (item) => item.status === "Em risco"
    );

    return {
      ativos,
      emRisco: emRisco.length,

      mrr: establishments
        .filter((item) => item.status !== "Cancelado")
        .reduce(
          (sum, item) => sum + (item.mrr ?? 0),
          0
        ),

      mrrEmRisco: emRisco.reduce(
        (sum, item) => sum + (item.mrr ?? 0),
        0
      ),
    };

  }, [establishments]);

  const semVinculo = useMemo(
    () =>
      cases.filter((item) => !item.establishmentId).length,
    [cases]
  );

  function salvar(
    data: EstablishmentDraft | Establishment
  ) {

    if ("id" in data) updateEstablishment(data);
    else createEstablishment(data);

    setFormOpen(false);
    setEditing(undefined);
  }

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Base de contas"
          title="Estabelecimentos"
          description="Os restaurantes que contratam a Cardápio Web. As pessoas ficam em Clientes."
        >
          <button
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
          >
            <Plus size={16} />
            Novo estabelecimento
          </button>
        </PageHeading>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatTile
            label="Estabelecimentos"
            description="Contas cadastradas na base, incluindo canceladas."
            value={establishments.length}
            hint={`${metrics.ativos} ativos`}
            icon={Building2}
            tone="primary"
          />

          <StatTile
            label="Em risco"
            description="Contas que sinalizaram cancelamento ou têm tratativa grave aberta."
            value={metrics.emRisco}
            hint="precisam de atenção"
            icon={TriangleAlert}
            tone="danger"
          />

          <StatTile
            label="Receita recorrente"
            description="Soma da mensalidade das contas não canceladas."
            value={money.format(metrics.mrr)}
            hint="mensalidade somada"
            icon={PiggyBank}
            tone="success"
          />

          <StatTile
            label="Receita em risco"
            description="Mensalidade das contas marcadas como em risco."
            value={money.format(metrics.mrrEmRisco)}
            hint="pode ser perdida"
            icon={MessagesSquare}
            tone="warning"
          />

        </div>

        {semVinculo > 0 && (

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/60 px-5 py-4">

            <TriangleAlert
              size={17}
              className="shrink-0 text-amber-600"
            />

            <p className="flex-1 text-sm leading-relaxed text-amber-900">

              <span className="font-semibold">
                {semVinculo} reclamações
              </span>{" "}
              ainda não estão vinculadas a um
              estabelecimento. O export do Reclame Aqui não
              traz essa coluna — o vínculo é feito no
              detalhe de cada caso.

            </p>

            <Link
              href="/reclame-aqui"
              className="shrink-0 rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
            >
              Ver reclamações
            </Link>

          </div>

        )}

        <SurfaceCard bodyClassName="p-4">

          <div className="flex flex-wrap items-center gap-3">

            <div className="relative min-w-[240px] flex-1">

              <Search
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, cidade, segmento ou CNPJ..."
                className="h-11 w-full rounded-xl border border-zinc-200 pl-10 pr-3 text-sm outline-none transition-colors focus:border-violet-400"
              />

            </div>

            <div className="flex flex-wrap items-center gap-1.5">

              {(
                [
                  "Todos",
                  ...ESTABLISHMENT_STATUSES,
                ] as const
              ).map((item) => (

                <button
                  key={item}
                  onClick={() => setStatus(item)}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ring-1 ring-inset ${
                    status === item
                      ? "bg-violet-50 text-violet-700 ring-violet-200"
                      : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  {item}
                </button>

              ))}

            </div>

          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-zinc-100 pt-3">

            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Ordenar
            </span>

            {sorts.map((item) => (

              <button
                key={item.id}
                onClick={() => setSort(item.id)}
                title={item.hint}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  sort === item.id
                    ? "bg-violet-100 text-violet-800"
                    : "text-zinc-500 hover:bg-zinc-100"
                }`}
              >
                {item.label}
              </button>

            ))}

          </div>

        </SurfaceCard>

        {visible.length === 0 ? (

          <SurfaceCard>

            <div className="py-12 text-center">

              <Building2
                size={28}
                className="mx-auto text-zinc-300"
              />

              <p className="mt-3 text-sm text-zinc-500">
                {establishments.length === 0
                  ? "Nenhum estabelecimento cadastrado ainda."
                  : "Nenhum estabelecimento encontrado para esse filtro."}
              </p>

              <button
                onClick={() => {
                  setEditing(undefined);
                  setFormOpen(true);
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-violet-200 px-4 py-2.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
              >
                <Plus size={15} />
                Cadastrar estabelecimento
              </button>

            </div>

          </SurfaceCard>

        ) : (

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

            {visible.map(({ establishment, stats }) => (

              <div
                key={establishment.id}
                className="group relative flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_10px_24px_-14px_rgba(91,42,134,0.4)]"
              >

                <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">

                  <button
                    onClick={() => {
                      setEditing(establishment);
                      setFormOpen(true);
                    }}
                    title="Editar estabelecimento"
                    className="rounded-lg bg-white p-1.5 text-zinc-400 shadow-sm transition-colors hover:text-violet-700"
                  >
                    <Pencil size={13} />
                  </button>

                  <button
                    onClick={() =>
                      setDeleting(establishment)
                    }
                    title="Excluir estabelecimento"
                    className="rounded-lg bg-white p-1.5 text-zinc-400 shadow-sm transition-colors hover:text-rose-600"
                  >
                    <Trash2 size={13} />
                  </button>

                </div>

                <Link
                  href={`/estabelecimentos/${establishment.slug}`}
                  className="flex flex-1 flex-col"
                >

                  <div className="flex items-start gap-3 pr-16">

                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-100">
                      <Building2 size={18} />
                    </span>

                    <div className="min-w-0">

                      <p className="truncate text-sm font-semibold text-zinc-900">
                        {establishment.name}
                      </p>

                      <p className="truncate text-xs text-zinc-500">
                        {establishment.segment ?? "Sem segmento"}
                        {establishment.city
                          ? ` · ${establishment.city}${
                              establishment.state
                                ? `/${establishment.state}`
                                : ""
                            }`
                          : ""}
                      </p>

                    </div>

                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">

                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                        statusTone[establishment.status]
                      }`}
                      title={`Situação da conta: ${establishment.status}`}
                    >
                      {establishment.status}
                    </span>

                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                        planTone[establishment.plan]
                      }`}
                      title={`Plano contratado: ${establishment.plan}`}
                    >
                      {establishment.plan}
                    </span>

                    {establishment.mrr ? (
                      <span
                        className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200"
                        title="Mensalidade da conta"
                      >
                        {money.format(establishment.mrr)}
                        /mês
                      </span>
                    ) : null}

                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">

                    {[
                      {
                        label: "Casos",
                        value: stats.total,
                        hint: "Reclamações vinculadas a este estabelecimento.",
                      },
                      {
                        label: "Abertos",
                        value: stats.open,
                        hint: "Tratativas ainda não encerradas.",
                      },
                      {
                        label: "Impacto",
                        value:
                          stats.impactCount === 0
                            ? "—"
                            : money.format(stats.impact),
                        hint: "Resultado financeiro registrado nesta conta.",
                      },
                    ].map((stat) => (

                      <div
                        key={stat.label}
                        title={stat.hint}
                        className="rounded-xl bg-zinc-50 px-2.5 py-2 text-center"
                      >

                        <p className="text-[10px] uppercase tracking-wide text-zinc-400">
                          {stat.label}
                        </p>

                        <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-zinc-900">
                          {stat.value}
                        </p>

                      </div>

                    ))}

                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-3 text-[11px] text-zinc-400">

                    <span className="truncate">
                      {establishment.owner
                        ? `Responsável: ${establishment.owner}`
                        : "Sem responsável"}
                    </span>

                    <ArrowUpRight
                      size={14}
                      className="shrink-0 transition-colors group-hover:text-violet-500"
                    />

                  </div>

                </Link>

              </div>

            ))}

          </div>

        )}

      </div>

      {formOpen && (
        <EstablishmentForm
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
        label={deleting?.name ?? ""}
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) removeEstablishment(deleting.id);
          setDeleting(undefined);
        }}
      />

    </MainLayout>
  );
}
