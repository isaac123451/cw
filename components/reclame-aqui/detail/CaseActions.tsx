"use client";

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
import MenuMais from "@/components/shared/MenuMais";

import { useImpact } from "@/lib/context/ImpactContext";
import { useAgenda } from "@/lib/context/AgendaContext";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";

import { useToast } from "@/lib/context/ToastContext";

import { slugify } from "@/lib/services/slug";

import { Case, semNome } from "@/lib/models/case";

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
      {/*
        Num menu "Mais" ao lado das ações do dia a dia (03/11/2026): a ficha
        abria com duas fileiras de botões, dez ao todo, e as que se usam em
        toda reclamação (WhatsApp, área da empresa, dossiê) se perdiam.
      */}
      <MenuMais
        itens={[
          {
            rotulo: impactosDoCaso.length > 0 ? `Registrar impacto · ${money.format(impactoTotal)}` : "Registrar impacto",
            icone: Wallet,
            dica: "Registrar o resultado financeiro gerado por esta tratativa",
            onClick: () => setImpactOpen(true),
          },
          {
            rotulo: tarefasDoCaso.length > 0 ? `Criar atividade · ${tarefasDoCaso.length} já criada${tarefasDoCaso.length > 1 ? "s" : ""}` : "Criar atividade",
            icone: CalendarPlus,
            dica: "Criar uma atividade na agenda já vinculada a esta reclamação",
            onClick: () => setTaskOpen(true),
          },
          ...(!semNome(data.customer)
            ? [{ rotulo: "Ver cliente", icone: UserRound, dica: `Ver o histórico completo de ${data.customer}`, onClick: () => router.push(`/clientes/${slugify(data.customer)}`) }]
            : []),
          ...(estabelecimento
            ? [{ rotulo: estabelecimento.name, icone: Building2, dica: `Abrir ${estabelecimento.name}`, onClick: () => router.push(`/estabelecimentos/${estabelecimento.slug}`) }]
            : []),
        ]}
      />

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
