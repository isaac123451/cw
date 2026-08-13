"use client";

import {
  ExternalLink,
  MessageCircle,
  Star,
} from "lucide-react";

import { Case } from "@/lib/models/case";

import SurfaceCard from "@/components/shared/SurfaceCard";
import MovementPanel from "./MovementPanel";

interface Props {
  data: Case;
}

export default function ServiceTab({ data }: Props) {

  const whatsapp = (data.phone ?? "").replace(/\D/g, "");

  return (
    <div className="space-y-5">

      <MovementPanel data={data} />

      <SurfaceCard
        title="Canais de atendimento"
        description="Acesse rapidamente os canais vinculados a esta reclamação."
        action={
          <span className="flex shrink-0 items-center gap-1.5 rounded-xl bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600">
            <Star size={12} className="text-amber-400" />
            {data.evaluated
              ? `Avaliada com nota ${data.score ?? 0}`
              : "Sem avaliação"}
          </span>
        }
      >

        <div className="grid gap-3 sm:grid-cols-2">

          <a
            href={
              whatsapp
                ? `https://wa.me/55${whatsapp}`
                : undefined
            }
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 transition-colors hover:bg-emerald-50"
          >

            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <MessageCircle size={15} />
              WhatsApp
            </p>

            <p className="mt-1 text-xs leading-relaxed text-emerald-700/80">
              Abrir contato rápido com o cliente.
            </p>

          </a>

          <a
            href="https://www.reclameaqui.com.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 transition-colors hover:bg-violet-50"
          >

            <p className="flex items-center gap-2 text-sm font-semibold text-violet-800">
              <ExternalLink size={15} />
              Reclame Aqui
            </p>

            <p className="mt-1 text-xs leading-relaxed text-violet-700/80">
              Abrir a reclamação original no portal externo.
            </p>

          </a>

        </div>

      </SurfaceCard>

      <div className="grid gap-5 lg:grid-cols-2">

        <SurfaceCard title="Contexto operacional">

          <dl className="space-y-3.5">

            {[
              ["Cliente da reclamação", data.customer],
              ["Canal de origem", data.source],
              ["Time responsável", data.department ?? "—"],
              ["Responsável", data.owner ?? "—"],
              [
                "Tempo de resposta",
                data.responseTime ?? "—",
              ],
              [
                "Tempo de solução",
                data.solutionTime ?? "—",
              ],
            ].map(([k, v]) => (

              <div key={k}>

                <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  {k}
                </dt>

                <dd className="mt-0.5 text-sm text-zinc-800">
                  {v}
                </dd>

              </div>

            ))}

          </dl>

        </SurfaceCard>

        <SurfaceCard
          title="Registros internos do atendimento"
          description="Interações registradas pela operação."
        >

          <ol className="relative space-y-4 before:absolute before:left-[5px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-zinc-200 before:content-['']">

            <li className="relative pl-6">
              <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-violet-500 ring-4 ring-white" />
              <p className="text-sm font-medium text-zinc-800">
                Reclamação registrada
              </p>
              <p className="text-xs text-zinc-500">
                {data.createdAt} · {data.source}
              </p>
            </li>

            {data.responseTime !== "-" && (
              <li className="relative pl-6">
                <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-sky-500 ring-4 ring-white" />
                <p className="text-sm font-medium text-zinc-800">
                  Primeiro retorno ao cliente
                </p>
                <p className="text-xs text-zinc-500">
                  Em {data.responseTime} · {data.owner ?? "—"}
                </p>
              </li>
            )}

            {data.resolved && (
              <li className="relative pl-6">
                <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-white" />
                <p className="text-sm font-medium text-zinc-800">
                  Caso encerrado
                </p>
                <p className="text-xs text-zinc-500">
                  {data.updatedAt} · solução em{" "}
                  {data.solutionTime}
                </p>
              </li>
            )}

          </ol>

        </SurfaceCard>

      </div>

    </div>
  );
}
