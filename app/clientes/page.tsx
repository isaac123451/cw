"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import {
  ArrowUpRight,
  Plus,
  Search,
  Star,
  TriangleAlert,
  UserRound,
  Users,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";

import ClientForm from "@/components/clientes/ClientForm";

import {
  ManualClientDraft,
  useClients,
} from "@/lib/context/ClientsContext";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";

import { ptBR } from "@/lib/services/reputation.service";

import { CLIENT_KINDS, kindTone } from "@/lib/models/client";

type SortKey =
  | "recente"
  | "volume"
  | "nota"
  | "risco"
  | "nome";

const sorts: { id: SortKey; label: string }[] = [
  { id: "recente", label: "Mais recentes" },
  { id: "volume", label: "Mais reclamações" },
  { id: "risco", label: "Maior risco" },
  { id: "nota", label: "Pior nota" },
  { id: "nome", label: "Nome" },
];

export default function ClientesPage() {

  const { clients, createClient } = useClients();
  const { establishments } = useEstablishments();

  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<string>("Todos");
  const [sort, setSort] = useState<SortKey>("volume");
  const [formOpen, setFormOpen] = useState(false);

  const estabelecimentoPorId = useMemo(
    () =>
      new Map(
        establishments.map((item) => [item.id, item])
      ),
    [establishments]
  );

  const visible = useMemo(() => {

    const termo = search.trim().toLowerCase();

    const list = clients.filter((item) => {

      if (kind !== "Todos" && item.kind !== kind) {
        return false;
      }

      if (!termo) return true;

      return (
        item.name.toLowerCase().includes(termo) ||
        (item.city ?? "").toLowerCase().includes(termo) ||
        (item.email ?? "").toLowerCase().includes(termo) ||
        (item.phone ?? "").includes(termo)
      );
    });

    const ordered = [...list];

    if (sort === "volume") {
      ordered.sort((a, b) => b.total - a.total);
    } else if (sort === "risco") {
      ordered.sort(
        (a, b) => b.churnRisk - a.churnRisk
      );
    } else if (sort === "nota") {
      ordered.sort((a, b) => {
        if (a.evaluated === 0) return 1;
        if (b.evaluated === 0) return -1;
        return a.averageScore - b.averageScore;
      });
    } else if (sort === "nome") {
      ordered.sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    } else {
      ordered.sort((a, b) =>
        (b.lastCase ?? b.firstCase ?? "").localeCompare(
          a.lastCase ?? a.firstCase ?? ""
        )
      );
    }

    return ordered;

  }, [clients, search, kind, sort]);

  const atRisk = clients.filter(
    (item) => item.churnRisk > 0
  ).length;

  const semEstabelecimento = clients.filter(
    (item) => !item.establishmentId
  ).length;

  const worst = [...clients]
    .filter((item) => item.evaluated > 0)
    .sort((a, b) => a.averageScore - b.averageScore)[0];

  function salvar(data: ManualClientDraft) {
    createClient(data);
    setFormOpen(false);
  }

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Base de pessoas"
          title="Clientes"
          description="As pessoas por trás de cada reclamação — consumidores, donos e operadores dos estabelecimentos."
        >
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
          >
            <Plus size={16} />
            Novo cliente
          </button>
        </PageHeading>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatTile
            label="Clientes na base"
            description="Pessoas distintas extraídas das reclamações, mais os cadastros manuais."
            value={clients.length}
            hint="com histórico registrado"
            icon={Users}
            tone="primary"
          />

          <StatTile
            label="Com risco de churn"
            description="Clientes com ao menos uma reclamação sinalizada como risco de cancelamento."
            value={atRisk}
            hint="precisam de atenção"
            icon={TriangleAlert}
            tone="danger"
          />

          <StatTile
            label="Sem estabelecimento"
            description="Pessoas ainda não vinculadas a um restaurante da base."
            value={semEstabelecimento}
            hint="vínculo pendente"
            icon={UserRound}
            tone="warning"
          />

          <StatTile
            label="Pior nota média"
            description="Cliente com a menor média de avaliação entre os que avaliaram."
            value={
              worst ? ptBR(worst.averageScore) : "—"
            }
            hint={worst?.name ?? "—"}
            icon={Star}
            tone="info"
          />

        </div>

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
                placeholder="Buscar por nome, cidade, e-mail ou telefone..."
                className="h-11 w-full rounded-xl border border-zinc-200 pl-10 pr-3 text-sm outline-none transition-colors focus:border-violet-400"
              />

            </div>

            <div className="flex flex-wrap items-center gap-1.5">

              {["Todos", ...CLIENT_KINDS].map((item) => (

                <button
                  key={item}
                  onClick={() => setKind(item)}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ring-1 ring-inset ${
                    kind === item
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
            <p className="py-12 text-center text-sm text-zinc-400">
              Nenhum cliente encontrado para essa busca.
            </p>
          </SurfaceCard>

        ) : (

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

            {visible.map((item) => {

              const estabelecimento = item.establishmentId
                ? estabelecimentoPorId.get(
                    item.establishmentId
                  )
                : undefined;

              return (
                <Link
                  key={item.slug}
                  href={`/clientes/${item.slug}`}
                  className="group flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_10px_24px_-14px_rgba(91,42,134,0.4)]"
                >

                  <div className="flex items-start justify-between gap-3">

                    <div className="flex min-w-0 items-center gap-3">

                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-100">
                        <UserRound size={18} />
                      </span>

                      <div className="min-w-0">

                        <p className="truncate text-sm font-semibold text-zinc-900">
                          {item.name}
                        </p>

                        <p className="truncate text-xs text-zinc-500">
                          {item.city
                            ? `${item.city}${
                                item.state
                                  ? `/${item.state}`
                                  : ""
                              }`
                            : estabelecimento
                            ? estabelecimento.name
                            : "Sem localização"}
                        </p>

                      </div>

                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ring-inset ${
                        kindTone[item.kind]
                      }`}
                      title={`Tipo de relação: ${item.kind}`}
                    >
                      {item.kind}
                    </span>

                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">

                    {[
                      {
                        label: "Casos",
                        value: item.total,
                      },
                      {
                        label: "Abertos",
                        value: item.open,
                      },
                      {
                        label: "Nota",
                        value:
                          item.evaluated === 0
                            ? "—"
                            : ptBR(item.averageScore),
                      },
                    ].map((stat) => (

                      <div
                        key={stat.label}
                        className="rounded-xl bg-zinc-50 px-2.5 py-2 text-center"
                      >

                        <p className="text-[10px] uppercase tracking-wide text-zinc-400">
                          {stat.label}
                        </p>

                        <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-900">
                          {stat.value}
                        </p>

                      </div>

                    ))}

                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">

                    {item.manual && (
                      <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                        Cadastro manual
                      </span>
                    )}

                    {item.reclameAqui > 0 && (
                      <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                        RA {item.reclameAqui}
                      </span>
                    )}

                    {item.social > 0 && (
                      <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                        Social {item.social}
                      </span>
                    )}

                    {item.churnRisk > 0 && (
                      <span className="flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                        <TriangleAlert size={9} />
                        {item.churnRisk} churn
                      </span>
                    )}

                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-3 text-[11px] text-zinc-400">

                    <span className="truncate">
                      {estabelecimento
                        ? estabelecimento.name
                        : item.topCategory ?? "—"}
                    </span>

                    <ArrowUpRight
                      size={14}
                      className="shrink-0 transition-colors group-hover:text-violet-500"
                    />

                  </div>

                </Link>
              );
            })}

          </div>

        )}

      </div>

      <ClientForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={salvar}
      />

    </MainLayout>
  );
}
