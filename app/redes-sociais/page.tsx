"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import {
  ArrowUpRight,
  Camera,
  CheckCircle2,
  Inbox,
  MessagesSquare,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";
import BarList from "@/components/shared/BarList";
import MiniKanban from "@/components/shared/MiniKanban";
import { ConfirmDelete } from "@/components/shared/Modal";

import SocialCaseForm from "@/components/redes-sociais/SocialCaseForm";

import { useScopedCases } from "@/lib/context/useScopedCases";
import { useWorkflow } from "@/lib/context/WorkflowContext";
import { groupBy, isOpen } from "@/lib/services/case.service";

import { Case } from "@/lib/models/case";

export default function RedesSociaisPage() {

  const {
    cases: social,
    moveCase,
    createCase,
    updateCase,
    deleteCase,
  } = useScopedCases("social");

  const { workflow } = useWorkflow();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Case>();
  const [deleting, setDeleting] = useState<Case>();

  const byCategory = useMemo(
    () => groupBy(social, "category"),
    [social]
  );

  const byStatus = useMemo(
    () => groupBy(social, "status"),
    [social]
  );

  const colunas = useMemo(
    () =>
      workflow
        .filter((item) => item.active)
        .sort((a, b) => a.order - b.order)
        .map((item) => ({
          name: item.name,
          color: item.color,
        })),
    [workflow]
  );

  const open = social.filter(isOpen).length;

  const resolved = social.filter(
    (item) => item.resolved
  ).length;

  function salvar(data: Case) {

    if (editing) updateCase(data);
    else createCase(data);

    setFormOpen(false);
    setEditing(undefined);
  }

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Atendimento"
          title="Redes Sociais"
          description="Conversas recebidas pelo Instagram, registradas e acompanhadas pela operação."
        >
          <button
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
          >
            <Plus size={16} />
            Novo atendimento
          </button>
        </PageHeading>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatTile
            label="Total de casos"
            description="Conversas registradas vindas do Instagram."
            value={social.length}
            hint="registrados"
            icon={MessagesSquare}
            tone="primary"
          />

          <StatTile
            label="Em aberto"
            description="Conversas que ainda dependem de ação da operação."
            value={open}
            hint="aguardando tratativa"
            icon={Inbox}
            tone="warning"
          />

          <StatTile
            label="Resolvidos"
            description="Conversas encerradas com solução confirmada."
            value={resolved}
            hint="encerrados com sucesso"
            icon={CheckCircle2}
            tone="success"
          />

          <StatTile
            label="Categorias"
            description="Assuntos distintos tratados no canal."
            value={byCategory.length}
            hint="assuntos distintos"
            icon={Camera}
            tone="info"
          />

        </div>

        {social.length === 0 ? (

          <SurfaceCard>

            <div className="flex flex-col items-center py-14 text-center">

              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-50 text-pink-600 ring-1 ring-inset ring-pink-100">
                <Camera size={24} />
              </span>

              <p className="mt-4 text-sm font-semibold text-zinc-800">
                Nenhum atendimento do Instagram registrado.
              </p>

              <p className="mt-1 max-w-sm text-sm text-zinc-500">
                Os dados importados do Reclame Aqui não incluem
                redes sociais. Registre aqui as conversas do
                direct para acompanhá-las junto da operação.
              </p>

              <button
                onClick={() => {
                  setEditing(undefined);
                  setFormOpen(true);
                }}
                className="mt-5 flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
              >
                <Plus size={15} />
                Registrar o primeiro
              </button>

            </div>

          </SurfaceCard>

        ) : (

          <>
            <div className="grid gap-6 lg:grid-cols-2">

              <SurfaceCard
                title="Assuntos mais frequentes"
                description="Categorias tratadas no canal."
              >
                <BarList data={byCategory} color="#EC4899" />
              </SurfaceCard>

              <SurfaceCard
                title="Distribuição por status"
                description="Como a fila do canal está hoje."
              >
                <BarList data={byStatus} color="#0EA5E9" />
              </SurfaceCard>

            </div>

            <SurfaceCard
              title="Quadro de atendimento"
              description="Arraste um cartão para mover a conversa de etapa."
            >
              <MiniKanban
                cases={social}
                columns={colunas}
                onMove={moveCase}
              />
            </SurfaceCard>

            <SurfaceCard
              title="Conversas registradas"
              description={`${social.length} atendimento(s) no canal.`}
              bodyClassName="p-0"
            >

              <ul className="divide-y divide-zinc-100">

                {social.map((item) => (

                  <li
                    key={item.id}
                    className="group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-zinc-50"
                  >

                    <span className="rounded-xl bg-pink-50 p-2.5 text-pink-600 ring-1 ring-inset ring-pink-100">
                      <Camera size={17} />
                    </span>

                    <Link
                      href={`/redes-sociais/${item.id}`}
                      className="min-w-0 flex-1"
                    >

                      <p className="truncate text-sm font-medium text-zinc-800">
                        {item.title}
                      </p>

                      <p className="mt-0.5 truncate text-xs text-zinc-500">
                        {item.customer}
                        {item.email && ` · ${item.email}`} ·{" "}
                        {item.category}
                      </p>

                    </Link>

                    <span className="hidden shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600 sm:inline">
                      {item.status}
                    </span>

                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">

                      <button
                        onClick={() => {
                          setEditing(item);
                          setFormOpen(true);
                        }}
                        title="Editar atendimento"
                        className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-violet-50 hover:text-violet-700"
                      >
                        <Pencil size={15} />
                      </button>

                      <button
                        onClick={() => setDeleting(item)}
                        title="Excluir atendimento"
                        className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 size={15} />
                      </button>

                      <Link
                        href={`/redes-sociais/${item.id}`}
                        title="Abrir tratativa completa"
                        className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-violet-600"
                      >
                        <ArrowUpRight size={15} />
                      </Link>

                    </div>

                  </li>

                ))}

              </ul>

            </SurfaceCard>
          </>

        )}

      </div>

      {formOpen && (
        <SocialCaseForm
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
        label={deleting?.title ?? ""}
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) deleteCase(deleting.id);
          setDeleting(undefined);
        }}
      />

    </MainLayout>
  );
}
