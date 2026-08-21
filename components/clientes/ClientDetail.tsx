"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Link2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TriangleAlert,
  UserRound,
} from "lucide-react";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";
import { ConfirmDelete } from "@/components/shared/Modal";
import TagPicker, {
  TagChips,
} from "@/components/shared/TagPicker";

import ClientForm from "@/components/clientes/ClientForm";

import {
  ManualClientDraft,
  useClients,
} from "@/lib/context/ClientsContext";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";
import { useImpact } from "@/lib/context/ImpactContext";

import { ptBR } from "@/lib/services/reputation.service";
import { isOpen } from "@/lib/services/case.service";

import { kindTone } from "@/lib/models/client";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const statusTone: Record<string, string> = {
  Resolvido: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  "Não resolvido": "bg-rose-50 text-rose-700 ring-rose-100",
  Novo: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  "Aguardando avaliação":
    "bg-amber-50 text-amber-700 ring-amber-100",
  "Aguardando nossa réplica":
    "bg-sky-50 text-sky-700 ring-sky-100",
};

function br(date?: string) {
  if (!date) return "—";
  return date.split("-").reverse().join("/");
}

export default function ClientDetail({
  slug,
}: {
  slug: string;
}) {

  const {
    findClient,
    enrich,
    updateManual,
    removeClient,
    isManual,
  } = useClients();

  const { establishments, findEstablishment } =
    useEstablishments();

  const { records } = useImpact();

  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [establishmentOpen, setEstablishmentOpen] =
    useState(false);

  const client = findClient(slug);

  const impactos = useMemo(
    () =>
      client
        ? records.filter(
            (item) => item.clientSlug === client.slug
          )
        : [],
    [records, client]
  );

  /**
   * Um resumo por canal, do mais recente para o mais antigo.
   *
   * Sai dos próprios casos (`Case.source`) em vez de uma tabela nova: o
   * canal já está em cada reclamação, e uma segunda fonte para o mesmo
   * fato divergiria assim que alguém corrigisse a origem de um caso.
   */
  const canais = useMemo(() => {

    const mapa = new Map<
      string,
      {
        nome: string;
        total: number;
        abertos: number;
        primeiro: string;
        ultimo: string;
      }
    >();

    for (const caso of client?.cases ?? []) {

      const nome = caso.source || "Sem canal";

      const atual = mapa.get(nome) ?? {
        nome,
        total: 0,
        abertos: 0,
        primeiro: caso.createdAt,
        ultimo: caso.createdAt,
      };

      atual.total += 1;
      if (isOpen(caso)) atual.abertos += 1;

      if (caso.createdAt < atual.primeiro) {
        atual.primeiro = caso.createdAt;
      }

      if (caso.createdAt > atual.ultimo) {
        atual.ultimo = caso.createdAt;
      }

      mapa.set(nome, atual);
    }

    return [...mapa.values()].sort((a, b) =>
      b.ultimo.localeCompare(a.ultimo)
    );

  }, [client]);

  const estabelecimento = client?.establishmentId
    ? findEstablishment(client.establishmentId)
    : undefined;

  if (!client) {
    return (
      <SurfaceCard>

        <div className="py-16 text-center">

          <UserRound
            size={30}
            className="mx-auto text-zinc-300"
          />

          <p className="mt-3 text-sm text-zinc-500">
            Cliente não encontrado.
          </p>

          <Link
            href="/clientes"
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-violet-200 px-4 py-2.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
          >
            <ArrowLeft size={15} />
            Voltar para a lista
          </Link>

        </div>

      </SurfaceCard>
    );
  }

  function salvarEdicao(data: ManualClientDraft) {

    if (!client) return;

    if (client.manual) {
      // Cadastro manual: o registro inteiro vive em ManualClient,
      // então a edição reescreve nome e contato também.
      updateManual(client.slug, data);
    } else {
      // Derivado de reclamação: só o que a operação pode
      // sobrepor (ver ClientEnrichment) é salvo.
      enrich(client.slug, {
        kind: data.kind,
        establishmentId: data.establishmentId,
        document: data.document,
        notes: data.notes,
      });
    }

    setFormOpen(false);
  }

  const dados: [string, React.ReactNode][] = [
    [
      "E-mail",
      client.email ?? "—",
    ],
    ["Telefone", client.phone ?? "—"],
    ["Documento", client.document ?? "—"],
    [
      "Localização",
      client.city
        ? `${client.city}${
            client.state ? `/${client.state}` : ""
          }`
        : "—",
    ],
    [
      "Cliente desde",
      br(client.firstCase),
    ],
  ];

  return (
    <div className="space-y-6">

      <Link
        href="/clientes"
        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-violet-700"
      >
        <ArrowLeft size={15} />
        Clientes
      </Link>

      <PageHeading
        eyebrow="Cliente"
        title={client.name}
        description={
          client.manual
            ? "Cadastrado manualmente pela operação."
            : `Histórico extraído de ${client.total} reclamação(ões) reais do Reclame Aqui.`
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

          {isManual(client.slug) && (
            <button
              onClick={() => setDeleting(true)}
              title="Excluir cadastro manual"
              className="rounded-xl border border-zinc-200 p-2.5 text-zinc-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 size={15} />
            </button>
          )}

        </div>

      </PageHeading>

      <div className="flex flex-wrap items-center gap-2">

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
            kindTone[client.kind]
          }`}
        >
          {client.kind}
        </span>

        {client.manual && (
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
            Cadastro manual
          </span>
        )}

        {client.email && (
          <span className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
            <Mail size={11} />
            {client.email}
          </span>
        )}

        {client.phone && (
          <span className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
            <Phone size={11} />
            {client.phone}
          </span>
        )}

        {client.city && (
          <span className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
            <MapPin size={11} />
            {client.city}/{client.state}
          </span>
        )}

      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <StatTile
          label="Reclamações"
          description="Total de casos vinculados a esta pessoa."
          value={client.total}
          hint={`${client.open} em aberto`}
          icon={UserRound}
          tone="primary"
        />

        <StatTile
          label="Nota média"
          description="Média das avaliações dadas nas reclamações resolvidas."
          value={
            client.evaluated === 0
              ? "—"
              : ptBR(client.averageScore)
          }
          hint={
            client.evaluated === 0
              ? "ainda não avaliou"
              : `${client.evaluated} avaliação(ões)`
          }
          icon={Star}
          tone="info"
        />

        <StatTile
          label="Voltaria a comprar"
          description="Quantas vezes esta pessoa disse que voltaria a fazer negócio."
          value={`${client.wouldReturn}/${client.evaluated || client.total}`}
          hint={
            client.wouldReturn > 0
              ? "sinal positivo"
              : "atenção"
          }
          icon={
            client.wouldReturn >=
            (client.evaluated || client.total) / 2
              ? ThumbsUp
              : ThumbsDown
          }
          tone={
            client.wouldReturn >=
            (client.evaluated || client.total) / 2
              ? "success"
              : "warning"
          }
        />

        <StatTile
          label="Risco de churn"
          description="Reclamações desta pessoa sinalizadas como risco de cancelamento."
          value={client.churnRisk}
          hint={
            client.churnRisk > 0
              ? "precisa de atenção"
              : "sem sinais"
          }
          icon={TriangleAlert}
          tone={client.churnRisk > 0 ? "danger" : "success"}
        />

      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">

        <div className="space-y-6">

          <SurfaceCard
            title="Dados de contato"
            description="Como esta pessoa foi identificada no Reclame Aqui."
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

          </SurfaceCard>

          {/*
            Por onde esta pessoa já falou com a gente.

            A mesma pessoa reclama no Reclame Aqui, chama no WhatsApp e
            responde a pesquisa de NPS — e cada um desses é uma porta
            diferente, com número diferente. Sem esta lista, "3 casos"
            não dizia se foram três reclamações públicas ou uma pública
            e duas conversas, que pedem tratativas opostas.
          */}
          <SurfaceCard
            title="Canais"
            description="Por onde esta pessoa já passou, e quando."
          >

            {canais.length === 0 ? (

              <p className="text-sm text-zinc-400">
                Ainda sem passagem registrada.
              </p>

            ) : (

              <ul className="space-y-2.5">

                {canais.map((canal) => (

                  <li
                    key={canal.nome}
                    className="flex items-baseline justify-between gap-3 rounded-xl border border-zinc-100 px-3 py-2"
                  >

                    <span className="min-w-0">

                      <span className="block text-sm font-medium text-zinc-800">
                        {canal.nome}
                      </span>

                      <span className="text-[11px] text-zinc-400">
                        {canal.primeiro === canal.ultimo
                          ? br(canal.ultimo)
                          : `${br(canal.primeiro)} → ${br(canal.ultimo)}`}
                        {canal.abertos > 0 &&
                          ` · ${canal.abertos} em aberto`}
                      </span>

                    </span>

                    <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-700">
                      {canal.total}
                    </span>

                  </li>

                ))}

              </ul>

            )}

          </SurfaceCard>

          <SurfaceCard
            title="Estabelecimento"
            description="Restaurante ao qual esta pessoa está ligada."
          >

            {estabelecimento ? (

              <Link
                href={`/estabelecimentos/${estabelecimento.slug}`}
                className="flex items-center gap-3 rounded-xl border border-zinc-200/80 px-3.5 py-3 transition-colors hover:border-violet-200 hover:bg-violet-50/40"
              >

                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-100">
                  <Building2 size={16} />
                </span>

                <span className="min-w-0 flex-1">

                  <span className="block truncate text-sm font-medium text-zinc-800">
                    {estabelecimento.name}
                  </span>

                  <span className="block truncate text-[11px] text-zinc-500">
                    {estabelecimento.segment ?? "—"}
                  </span>

                </span>

                <ArrowUpRight
                  size={14}
                  className="shrink-0 text-zinc-300"
                />

              </Link>

            ) : establishmentOpen ? (

              <select
                autoFocus
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    enrich(client.slug, {
                      establishmentId: e.target.value,
                    });
                  }
                  setEstablishmentOpen(false);
                }}
                onBlur={() => setEstablishmentOpen(false)}
                className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-violet-400"
              >
                <option value="">
                  Selecione um estabelecimento
                </option>

                {establishments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

            ) : (

              <button
                onClick={() => setEstablishmentOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 py-6 text-sm font-medium text-zinc-500 transition-colors hover:border-violet-300 hover:text-violet-700"
              >
                <Link2 size={15} />
                Vincular estabelecimento
              </button>

            )}

          </SurfaceCard>

          <SurfaceCard
            title="Etiquetas"
            description="Marcações internas sobre este cliente."
            action={
              <TagPicker
                selected={client.tags}
                onToggle={(tag) => {
                  const has = client.tags.includes(tag);

                  enrich(client.slug, {
                    tags: has
                      ? client.tags.filter(
                          (item) => item !== tag
                        )
                      : [...client.tags, tag],
                  });
                }}
              />
            }
          >

            {client.tags.length === 0 ? (
              <p className="text-sm text-zinc-400">
                Nenhuma etiqueta aplicada.
              </p>
            ) : (
              <TagChips tags={client.tags} limit={8} />
            )}

          </SurfaceCard>

          {client.notes && (

            <SurfaceCard
              title="Observações"
              description="Contexto registrado pela operação."
            >
              <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-600">
                {client.notes}
              </p>
            </SurfaceCard>

          )}

        </div>

        <div className="space-y-6">

          <SurfaceCard
            title="Histórico de reclamações"
            description={
              client.total === 0
                ? "Nenhuma reclamação registrada para esta pessoa."
                : `${client.total} reclamação(ões), da mais recente para a mais antiga.`
            }
          >

            {client.cases.length === 0 ? (

              <p className="rounded-xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
                Cliente cadastrado manualmente, sem
                reclamação vinculada ainda.
              </p>

            ) : (

              <ol className="relative space-y-5 border-l border-zinc-200 pl-5">

                {client.cases.map((item) => (

                  <li key={item.id} className="relative">

                    <span
                      className="absolute -left-[25px] top-1 h-3 w-3 rounded-full ring-4 ring-white"
                      style={{
                        background: item.resolved
                          ? "#10B981"
                          : item.evaluated
                          ? "#F59E0B"
                          : "#A1A1AA",
                      }}
                    />

                    <Link
                      href={`/reclame-aqui/${item.id}`}
                      className="group block rounded-xl border border-zinc-200/80 p-3.5 transition-colors hover:border-violet-200 hover:bg-violet-50/30"
                    >

                      <div className="flex items-start justify-between gap-3">

                        <p className="text-sm font-medium text-zinc-800">
                          {item.title}
                        </p>

                        <ArrowUpRight
                          size={13}
                          className="mt-0.5 shrink-0 text-zinc-300 transition-colors group-hover:text-violet-500"
                        />

                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">

                        <span className="font-mono text-violet-700">
                          {item.protocol}
                        </span>

                        <span>·</span>

                        <span>{br(item.createdAt)}</span>

                        <span>·</span>

                        <span>{item.category}</span>

                        {typeof item.score === "number" && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-0.5 font-semibold text-amber-600">
                              <Star
                                size={10}
                                fill="currentColor"
                              />
                              {ptBR(item.score)}
                            </span>
                          </>
                        )}

                      </div>

                      <span
                        className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                          statusTone[item.status] ??
                          "bg-zinc-100 text-zinc-600 ring-zinc-200"
                        }`}
                      >
                        {item.status}
                      </span>

                    </Link>

                  </li>

                ))}

              </ol>

            )}

          </SurfaceCard>

          <SurfaceCard
            title="Impacto no negócio"
            description="Resultado financeiro atribuído a este cliente."
          >

            {impactos.length === 0 ? (

              <p className="rounded-xl border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-400">
                Nenhum impacto registrado para este cliente.
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

          {client.churnRisk === 0 &&
            client.evaluated > 0 &&
            client.wouldReturn === client.evaluated && (

              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 px-5 py-4">

                <ShieldCheck
                  size={18}
                  className="shrink-0 text-emerald-600"
                />

                <p className="text-sm leading-relaxed text-emerald-900">
                  Cliente sem sinais de risco — avaliou
                  positivamente em todas as reclamações
                  resolvidas.
                </p>

              </div>

            )}

        </div>

      </div>

      <ClientForm
        open={formOpen}
        editing={client}
        onClose={() => setFormOpen(false)}
        onSave={salvarEdicao}
      />

      <ConfirmDelete
        open={deleting}
        label={client.name}
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          removeClient(client.slug);
          setDeleting(false);
          window.location.href = "/clientes";
        }}
      />

    </div>
  );
}
