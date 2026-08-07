"use client";

import Link from "next/link";

import { ArrowUpRight, ExternalLink, Pencil } from "lucide-react";

import { Case } from "@/lib/models/case";
import { useTeams } from "@/lib/context/TeamsContext";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";

interface Props {
  data: Case;
  owners: string[];
  onChange: (patch: Partial<Case>) => void;
}

function Block({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

      <div className="flex items-start justify-between gap-3">

        <h3 className="text-base font-semibold text-zinc-900">
          {title}
        </h3>

        {action}

      </div>

      <div className="mt-3">{children}</div>

    </section>
  );
}

export default function CaseSidebar({
  data,
  owners,
  onChange,
}: Props) {

  const { people } = useTeams();
  const { establishments } = useEstablishments();

  // Pessoas cadastradas em Times + quem já aparece nos casos.
  const opcoes = [
    ...new Set([
      ...people.map((item) => item.name),
      ...owners,
    ]),
  ].sort();

  const avaliada = data.evaluated;

  return (
    <div className="space-y-4">

      <Block
        title="Status"
        action={
          <span className="rounded-lg p-1.5 text-zinc-300">
            <Pencil size={14} />
          </span>
        }
      >

        <span
          className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
            avaliada
              ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
              : "bg-zinc-100 text-zinc-600 ring-zinc-200"
          }`}
        >
          {avaliada
            ? "Reclamação avaliada"
            : "Aguardando avaliação"}
        </span>

        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          {avaliada
            ? "Acompanhar a avaliação final e fechar o ciclo da reclamação."
            : "Cliente ainda não avaliou o atendimento no Reclame Aqui."}
        </p>

      </Block>

      <Block title="Responsável">

        <select
          value={data.owner ?? ""}
          onChange={(e) =>
            onChange({ owner: e.target.value })
          }
          className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors focus:border-violet-400"
        >
          <option value="">Sem responsável</option>

          {opcoes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

      </Block>

      <Block
        title="Estabelecimento"
        action={
          data.establishmentId && (
            <Link
              href={`/estabelecimentos/${
                establishments.find(
                  (item) => item.id === data.establishmentId
                )?.slug ?? ""
              }`}
              title="Ver estabelecimento"
              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:text-violet-700"
            >
              <ArrowUpRight size={14} />
            </Link>
          )
        }
      >

        <select
          value={data.establishmentId ?? ""}
          onChange={(e) =>
            onChange({
              establishmentId:
                e.target.value || undefined,
            })
          }
          className="h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors focus:border-violet-400"
        >
          <option value="">Sem vínculo</option>

          {establishments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          O Reclame Aqui não informa o estabelecimento — o
          vínculo é feito aqui manualmente.
        </p>

      </Block>

      <Block title="Situação">

        <span
          className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
            data.resolved
              ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
              : "bg-amber-50 text-amber-700 ring-amber-100"
          }`}
        >
          {data.resolved ? "Encerrada" : "Em aberto"}
        </span>

        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          {data.resolved
            ? "A tratativa foi concluída e registrada."
            : "A reclamação continua em andamento ativo."}
        </p>

      </Block>

      <Block title="Reclame Aqui">

        <p className="text-sm text-zinc-500">
          Publicado em {data.createdAt}
        </p>

        <p className="mt-0.5 text-sm text-zinc-500">
          Protocolo {data.protocol}
        </p>

        <a
          href="https://www.reclameaqui.com.br/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-violet-200 px-4 py-2.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
        >
          <ExternalLink size={15} />
          Abrir no Reclame Aqui
        </a>

      </Block>

      <Block title="Classificação">

        <dl className="space-y-3">

          {[
            ["Categoria", data.category],
            ["Subcategoria", data.subcategory || "—"],
            ["Time envolvido", data.department || "—"],
            [
              "Nota",
              data.evaluated
                ? String(data.score ?? 0)
                : "—",
            ],
          ].map(([label, value]) => (

            <div key={label}>

              <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                {label}
              </dt>

              <dd className="mt-0.5 text-sm text-zinc-800">
                {value}
              </dd>

            </div>

          ))}

          <div>

            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Voltaria
            </dt>

            <dd className="mt-1">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  data.wouldDoBusiness
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                    : "bg-rose-50 text-rose-700 ring-rose-100"
                }`}
              >
                {data.wouldDoBusiness ? "Sim" : "Não"}
              </span>
            </dd>

          </div>

        </dl>

      </Block>

    </div>
  );
}
