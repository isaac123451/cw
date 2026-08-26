"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import {
  Building2,
  HandCoins,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
  TrendingUp,
  UserRound,
  UserRoundCheck,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";
import BarList from "@/components/shared/BarList";
import { ConfirmDelete } from "@/components/shared/Modal";

import ImpactForm from "@/components/impacto/ImpactForm";
import ImpactTypesCard from "@/components/impacto/ImpactTypesCard";
import PlanosDoImpacto from "@/components/impacto/PlanosDoImpacto";

import {
  ImpactDraft,
  useImpact,
} from "@/lib/context/ImpactContext";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";
import { useClients } from "@/lib/context/ClientsContext";

import { ImpactRecord } from "@/lib/models/impact";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const typeTone: Record<string, string> = {
  "Cancelamento evitado":
    "bg-emerald-50 text-emerald-700 ring-emerald-100",
  "Cliente recuperado":
    "bg-violet-50 text-violet-700 ring-violet-100",
  "Módulo contratado":
    "bg-sky-50 text-sky-700 ring-sky-100",
  "Valor recuperado":
    "bg-amber-50 text-amber-700 ring-amber-100",
  "Oferta concedida":
    "bg-rose-50 text-rose-700 ring-rose-100",
};

export default function ImpactoPage() {

  const {
    records,
    createRecord,
    updateRecord,
    removeRecord,
  } = useImpact();

  const { findEstablishment } = useEstablishments();
  const { clients } = useClients();

  const clientBySlug = useMemo(
    () => new Map(clients.map((item) => [item.slug, item])),
    [clients]
  );

  const [formOpen, setFormOpen] = useState(false);

  const [editing, setEditing] = useState<ImpactRecord>();

  const [deleting, setDeleting] =
    useState<ImpactRecord>();

  const metrics = useMemo(() => {

    const soma = (tipos: string[]) =>
      records
        .filter((item) => tipos.includes(item.type))
        .reduce((sum, item) => sum + item.amount, 0);

    const preserved = soma([
      "Cancelamento evitado",
      "Cliente recuperado",
    ]);

    const generated = soma(["Módulo contratado"]);
    const recovered = soma(["Valor recuperado"]);
    const granted = soma(["Oferta concedida"]);

    return {
      preserved,
      generated,
      recovered,
      granted,
      net: preserved + generated + recovered + granted,
      recoveredClients: records.filter(
        (item) => item.type === "Cliente recuperado"
      ).length,
    };

  }, [records]);

  const byType = useMemo(() => {

    const map = new Map<string, number>();

    for (const item of records) {
      map.set(
        item.type,
        (map.get(item.type) ?? 0) + Math.abs(item.amount)
      );
    }

    const total = [...map.values()].reduce(
      (sum, value) => sum + value,
      0
    );

    return [...map.entries()]
      .map(([label, value]) => ({
        label,
        value,
        percent:
          total === 0
            ? 0
            : Math.round((value / total) * 100),
      }))
      .sort((a, b) => b.value - a.value);

  }, [records]);

  const byCompany = useMemo(() => {

    const map = new Map<string, number>();

    for (const item of records) {
      if (item.amount <= 0) continue;

      map.set(
        item.company,
        (map.get(item.company) ?? 0) + item.amount
      );
    }

    const total = [...map.values()].reduce(
      (sum, value) => sum + value,
      0
    );

    return [...map.entries()]
      .map(([label, value]) => ({
        label,
        value,
        percent:
          total === 0
            ? 0
            : Math.round((value / total) * 100),
      }))
      .sort((a, b) => b.value - a.value);

  }, [records]);

  function salvar(data: ImpactDraft | ImpactRecord) {

    if ("id" in data) updateRecord(data);
    else createRecord(data);

    setFormOpen(false);
    setEditing(undefined);
  }

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Resultado"
          title="Impacto no Negócio"
          description="Retorno financeiro gerado pela operação de Reputação."
        >
          <button
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
          >
            <Plus size={16} />
            Novo impacto
          </button>
        </PageHeading>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatTile
            label="Receita preservada"
            description="Valor mantido por cancelamentos evitados e clientes recuperados."
            value={money.format(metrics.preserved)}
            hint="cancelamentos evitados"
            icon={PiggyBank}
            tone="success"
          />

          <StatTile
            label="Receita gerada"
            description="Valor novo vindo de módulos contratados após a tratativa."
            value={money.format(metrics.generated)}
            hint="módulos contratados"
            icon={TrendingUp}
            tone="primary"
          />

          <StatTile
            label="Valor recuperado"
            description="Cobranças indevidas reconciliadas junto ao cliente."
            value={money.format(metrics.recovered)}
            hint="cobranças reconciliadas"
            icon={HandCoins}
            tone="info"
          />

          <StatTile
            label="Clientes recuperados"
            description="Clientes que voltaram a usar a plataforma após a tratativa."
            value={metrics.recoveredClients}
            hint="voltaram a usar a plataforma"
            icon={UserRoundCheck}
            tone="warning"
          />

        </div>

        <SurfaceCard
          title="Resultado líquido"
          description="Entradas menos as ofertas concedidas para reter o cliente."
        >

          <div className="grid gap-4 sm:grid-cols-3">

            <div className="rounded-xl bg-emerald-50/60 p-4 ring-1 ring-inset ring-emerald-100">

              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                Entradas
              </p>

              <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-800">
                {money.format(
                  metrics.preserved +
                    metrics.generated +
                    metrics.recovered
                )}
              </p>

            </div>

            <div className="rounded-xl bg-rose-50/60 p-4 ring-1 ring-inset ring-rose-100">

              <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                Ofertas concedidas
              </p>

              <p className="mt-1 text-xl font-semibold tabular-nums text-rose-800">
                {money.format(metrics.granted)}
              </p>

            </div>

            <div className="rounded-xl bg-violet-50/60 p-4 ring-1 ring-inset ring-violet-100">

              <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                Resultado líquido
              </p>

              <p className="mt-1 text-xl font-semibold tabular-nums text-violet-800">
                {money.format(metrics.net)}
              </p>

            </div>

          </div>

        </SurfaceCard>

        <div className="grid gap-6 lg:grid-cols-2">

          <SurfaceCard
            title="Impacto por tipo"
            description="Distribuição do valor movimentado."
          >
            <BarList data={byType} />
          </SurfaceCard>

          <SurfaceCard
            title="Impacto por conta"
            description="Onde a operação gerou mais retorno — por cliente ou estabelecimento."
          >
            <BarList data={byCompany} color="#22C55E" />
          </SurfaceCard>

        </div>

        <PlanosDoImpacto />

        <ImpactTypesCard />

        <SurfaceCard
          title="Registros de impacto"
          description={`${records.length} movimentação(ões) registradas.`}
          bodyClassName="p-0"
          action={
            <button
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
            >
              <Plus size={15} />
              Adicionar
            </button>
          }
        >

          {records.length === 0 ? (

            <p className="px-6 py-12 text-center text-sm text-zinc-400">
              Nenhum impacto registrado ainda. Comece
              adicionando o primeiro.
            </p>

          ) : (

            <div className="overflow-x-auto">

              <table className="min-w-full">

                <thead className="bg-zinc-50">

                  <tr>

                    {[
                      "Tipo",
                      "Cliente",
                      "Descrição",
                      "Reclamação",
                      "Data",
                    ].map((head) => (
                      <th
                        key={head}
                        className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
                      >
                        {head}
                      </th>
                    ))}

                    <th className="whitespace-nowrap px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Valor
                    </th>

                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Ações
                    </th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-zinc-100">

                  {records.map((item) => {

                    const estabelecimento =
                      item.establishmentId
                        ? findEstablishment(
                            item.establishmentId
                          )
                        : undefined;

                    const cliente = item.clientSlug
                      ? clientBySlug.get(item.clientSlug)
                      : undefined;

                    return (
                    <tr
                      key={item.id}
                      className="group text-sm transition-colors hover:bg-zinc-50/70"
                    >

                      <td className="px-5 py-3">
                        <span
                          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset ${
                            typeTone[item.type] ??
                            "bg-zinc-100 text-zinc-600 ring-zinc-200"
                          }`}
                        >
                          {item.type}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-3 text-zinc-700">

                        <p>{item.company}</p>

                        <div className="mt-0.5 flex items-center gap-2">

                          {estabelecimento && (
                            <Link
                              href={`/estabelecimentos/${estabelecimento.slug}`}
                              title="Ver estabelecimento"
                              className="flex items-center gap-1 text-[10px] font-medium text-violet-600 hover:underline"
                            >
                              <Building2 size={10} />
                              {estabelecimento.name}
                            </Link>
                          )}

                          {cliente && (
                            <Link
                              href={`/clientes/${cliente.slug}`}
                              title="Ver perfil do cliente"
                              className="flex items-center gap-1 text-[10px] font-medium text-sky-600 hover:underline"
                            >
                              <UserRound size={10} />
                              Ver cliente
                            </Link>
                          )}

                        </div>

                      </td>

                      <td className="max-w-[280px] px-5 py-3 text-zinc-500">
                        <span className="line-clamp-2">
                          {item.description || "—"}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-3">
                        {item.relatedCase ? (
                          <span className="font-mono text-[11px] text-violet-700">
                            {item.relatedCase}
                          </span>
                        ) : (
                          <span className="text-zinc-300">
                            —
                          </span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-3 text-zinc-500">
                        {item.date
                          .split("-")
                          .reverse()
                          .join("/")}
                      </td>

                      <td
                        className={`whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums ${
                          item.amount < 0
                            ? "text-rose-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {money.format(item.amount)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-3">

                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">

                          <button
                            onClick={() => {
                              setEditing(item);
                              setFormOpen(true);
                            }}
                            title="Editar registro"
                            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-violet-50 hover:text-violet-700"
                          >
                            <Pencil size={15} />
                          </button>

                          <button
                            onClick={() => setDeleting(item)}
                            title="Excluir registro"
                            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 size={15} />
                          </button>

                        </div>

                      </td>

                    </tr>
                    );
                  })}

                </tbody>

              </table>

            </div>

          )}

        </SurfaceCard>

      </div>

      {formOpen && (
        <ImpactForm
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
        label={
          deleting
            ? `${deleting.type} — ${deleting.company}`
            : ""
        }
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) removeRecord(deleting.id);
          setDeleting(undefined);
        }}
      />

    </MainLayout>
  );
}
