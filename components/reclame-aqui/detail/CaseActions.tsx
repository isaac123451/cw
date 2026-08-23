"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useState } from "react";

import {
  Building2,
  CalendarPlus,
  UserRound,
  Wallet,
} from "lucide-react";

import ImpactForm from "@/components/impacto/ImpactForm";
import TaskForm from "@/components/agenda/TaskForm";

import { useImpact } from "@/lib/context/ImpactContext";
import { useAgenda } from "@/lib/context/AgendaContext";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";

import { useToast } from "@/lib/context/ToastContext";

import { slugify } from "@/lib/services/slug";

import { Case } from "@/lib/models/case";

/**
 * Atalhos que ligam a reclamação ao resto da plataforma.
 *
 * Estas ligações estavam previstas no código — o ImpactForm já aceitava
 * `presetCaseId` — mas nenhuma tela chamava, então na prática não existia
 * caminho da reclamação para o impacto nem para a agenda.
 */
export default function CaseActions({
  data,
}: {
  data: Case;
}) {

  const { records, createRecord } = useImpact();
  const { tasks, createTask } = useAgenda();
  const { findEstablishment } = useEstablishments();

  const { notify } = useToast();
  const router = useRouter();

  const [impactOpen, setImpactOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  const estabelecimento = data.establishmentId
    ? findEstablishment(data.establishmentId)
    : undefined;

  const impactosDoCaso = records.filter(
    (item) => item.relatedCase === data.protocol
  );

  const tarefasDoCaso = tasks.filter(
    (item) => item.relatedCase === data.protocol
  );

  const money = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

  const impactoTotal = impactosDoCaso.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">

        <button
          onClick={() => setImpactOpen(true)}
          title="Registrar o resultado financeiro gerado por esta tratativa"
          className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
        >
          <Wallet size={15} />
          Registrar impacto

          {impactosDoCaso.length > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                impactoTotal < 0
                  ? "bg-rose-50 text-rose-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {money.format(impactoTotal)}
            </span>
          )}
        </button>

        <button
          onClick={() => setTaskOpen(true)}
          title="Criar uma atividade na agenda já vinculada a esta reclamação"
          className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
        >
          <CalendarPlus size={15} />
          Criar atividade

          {tarefasDoCaso.length > 0 && (
            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
              {tarefasDoCaso.length}
            </span>
          )}
        </button>

        <Link
          href={`/clientes/${slugify(data.customer)}`}
          title={`Ver o histórico completo de ${data.customer}`}
          className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
        >
          <UserRound size={15} />
          Ver cliente
        </Link>

        {estabelecimento && (
          <Link
            href={`/estabelecimentos/${estabelecimento.slug}`}
            title={`Abrir ${estabelecimento.name}`}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
          >
            <Building2 size={15} />
            {estabelecimento.name}
          </Link>
        )}

      </div>

      {impactOpen && (
        <ImpactForm
          key={data.id}
          open={impactOpen}
          presetCaseId={data.id}
          onClose={() => setImpactOpen(false)}
          onSave={(item) => {
            if (!("id" in item)) createRecord(item);
            setImpactOpen(false);
          }}
        />
      )}

      {taskOpen && (
        <TaskForm
          key={data.id}
          open={taskOpen}
          presetCase={{
            protocol: data.protocol,
            company: data.company,
            title: data.title,
          }}
          onClose={() => setTaskOpen(false)}
          onSave={(item) => {

            if (!("id" in item)) createTask(item);

            setTaskOpen(false);

            notify({
              tone: "success",
              title: "Atividade criada.",
              detail: item.title,
            });

            // Levar para a agenda: a atividade nasce aqui, mas é lá que a
            // pessoa acompanha e reagenda.
            router.push("/agenda");
          }}
        />
      )}
    </>
  );
}
