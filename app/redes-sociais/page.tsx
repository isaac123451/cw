"use client";

import Link from "next/link";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  ArrowUpRight,
  Camera,
  CheckCircle2,
  Inbox,
  MessagesSquare,
  Pencil,
  Plus,
  Trash2,
  Filter,
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

function RedesSociaisConteudo() {

  const {
    cases: todosOsSociais,
    moveCase,
    createCase,
    updateCase,
    deleteCase,
  } = useScopedCases("social");

  /**
   * O recorte que veio pelo link do gráfico.
   *
   * Clicar num assunto frequente traz `?categoria=Entrega` — a mesma
   * convenção da fila do Reclame Aqui, em português porque o endereço é
   * lido por gente.
   *
   * O filtro vale para a lista e para o quadro, e **não** para os
   * gráficos: recortar o gráfico pelo que ele mesmo filtrou deixaria uma
   * barra só, e a comparação — que é a razão do gráfico existir — some.
   */
  const params = useSearchParams();

  const categoriaFiltrada = params.get("categoria") ?? "";
  const statusFiltrado = params.get("status") ?? "";

  const social = useMemo(
    () =>
      todosOsSociais
        .filter(
          (c) =>
            !categoriaFiltrada ||
            c.category === categoriaFiltrada
        )
        .filter(
          (c) =>
            !statusFiltrado ||
            c.status === statusFiltrado
        ),
    [todosOsSociais, categoriaFiltrada, statusFiltrado]
  );

  const recorte = categoriaFiltrada || statusFiltrado;

  const { workflow } = useWorkflow();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Case>();
  const [deleting, setDeleting] = useState<Case>();

  const byCategory = useMemo(
    () => groupBy(todosOsSociais, "category"),
    [todosOsSociais]
  );

  const byStatus = useMemo(
    () => groupBy(todosOsSociais, "status"),
    [todosOsSociais]
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

        {/*
          Um zero filtrado precisa dizer que é filtrado.

          Chegando por um link de gráfico — `?categoria=Sistema` — os
          contadores passam a contar só aquele recorte. Sem esta faixa,
          "0 atendimentos" é lido como "o módulo está vazio", que é o
          mesmo zero mudo do SLA e do teto: o número certo, a conclusão
          errada, e ninguém sabe por quê.
        */}
        {recorte && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-violet-50/60 px-4 py-3 text-sm ring-1 ring-inset ring-violet-100">

            <Filter size={15} className="text-violet-600" />

            <span className="text-zinc-700">
              Mostrando só{" "}
              <strong className="font-semibold">
                {categoriaFiltrada || statusFiltrado}
              </strong>{" "}
              — {social.length} de{" "}
              {todosOsSociais.length} atendimento(s).
            </span>

            <Link
              href="/redes-sociais"
              className="ml-auto rounded-lg px-2.5 py-1 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100"
            >
              Ver todos
            </Link>

          </div>
        )}

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
                {/*
                  Clicar no assunto abre os casos dele.

                  "quando eu clicar em um assunto frequente seja possível
                  verificar os casos daquela categoria." Mesma leitura
                  das outras telas: o número diz quantos, e a pergunta
                  seguinte é sempre quais.
                */}
                <BarList
                  data={byCategory}
                  color="#EC4899"
                  hrefDe={(categoria) =>
                    `/redes-sociais?categoria=${encodeURIComponent(categoria)}`
                  }
                />
              </SurfaceCard>

              <SurfaceCard
                title="Distribuição por status"
                description="Como a fila do canal está hoje."
              >
                <BarList
                  data={byStatus}
                  color="#0EA5E9"
                  hrefDe={(status) =>
                    `/redes-sociais?status=${encodeURIComponent(status)}`
                  }
                />
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

/**
 * useSearchParams suspende o render.
 *
 * Sem o <Suspense>, a página inteira vira dinâmica e perde a
 * pré-renderização — o mesmo cuidado da fila do Reclame Aqui.
 */
export default function RedesSociaisPage() {
  return (
    <Suspense fallback={null}>
      <RedesSociaisConteudo />
    </Suspense>
  );
}
