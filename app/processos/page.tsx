"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import {
  BookOpenCheck,
  Clock3,
  Pencil,
  Plus,
  Timer,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";
import { ConfirmDelete } from "@/components/shared/Modal";

import SlaRuleForm from "@/components/processos/SlaRuleForm";
import MovementRuleForm from "@/components/processos/MovementRuleForm";
import OrphanCategories from "@/components/processos/OrphanCategories";
import PrazosDaDocumentacaoModal from "@/components/processos/PrazosDaDocumentacaoModal";
import ExpedienteCard from "@/components/processos/ExpedienteCard";
import PrazosDeAreaCard from "@/components/processos/PrazosDeAreaCard";

import { useCases } from "@/lib/context/CaseContext";
import {
  SlaRuleDraft,
  useSla,
} from "@/lib/context/SlaContext";

import {
  MovementRuleDraft,
  useMovements,
} from "@/lib/context/MovementsContext";

import {
  coverage,
  slaStatus,
  toneOfSla,
} from "@/lib/services/sla.service";

import {
  lateMovements,
  loadByDestination,
} from "@/lib/services/movement.service";

import { isOpen,
  caseHref,
} from "@/lib/services/case.service";

import {
  ANY_CATEGORY,
  formatHours,
  SlaRule,
} from "@/lib/models/sla";
import { descreverPrazo } from "@/lib/services/horasUteis";

import { MovementRule } from "@/lib/models/movement";
import { AREAS_INTERNAS } from "@/lib/models/mensagens";

/** Prefixo das linhas das áreas do documento, que não têm regra própria. */
const AREA_DO_DOCUMENTO = "area-do-documento:";

export default function ProcessosPage() {

  const { cases } = useCases();

  const {
    rules,
    expediente,
    createRule,
    updateRule,
    removeRule,
    toggleRule,
  } = useSla();

  const [documentacaoAberta, setDocumentacaoAberta] = useState(false);

  const {
    movements,
    rules: movementRules,
    createRule: createMovementRule,
    updateRule: updateMovementRule,
    removeRule: removeMovementRule,
    toggleRule: toggleMovementRule,
  } = useMovements();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SlaRule>();
  const [deleting, setDeleting] = useState<SlaRule>();

  const [movFormOpen, setMovFormOpen] = useState(false);
  const [movEditing, setMovEditing] =
    useState<MovementRule>();
  const [movDeleting, setMovDeleting] =
    useState<MovementRule>();

  const abertos = useMemo(
    () => cases.filter(isOpen),
    [cases]
  );

  /**
   * Só casos em aberto: o prazo de quem já foi encerrado não está
   * correndo, e misturá-los fazia a tabela divergir do indicador.
   */
  const linhas = useMemo(
    () => coverage(abertos, rules, { expediente }),
    [abertos, rules, expediente]
  );

  const metrics = useMemo(() => {

    let estourado = 0;
    let atencao = 0;
    let semRegra = 0;

    for (const item of abertos) {

      const status = slaStatus(item, rules, { expediente });

      if (status.situation === "estourado") estourado++;
      if (status.situation === "atencao") atencao++;
      if (status.situation === "sem-regra") semRegra++;
    }

    return { estourado, atencao, semRegra };

  }, [abertos, rules, expediente]);

  /** Casos abertos fora do prazo, do mais atrasado para o menos. */
  const atrasados = useMemo(
    () =>
      abertos
        .map((item) => ({
          item,
          status: slaStatus(item, rules, { expediente }),
        }))
        .filter(
          (row) => row.status.situation === "estourado"
        )
        .sort(
          (a, b) =>
            a.status.remainingHours -
            b.status.remainingHours
        )
        .slice(0, 8),
    [abertos, rules, expediente]
  );

  /*
    As cinco áreas do documento entram na tabela mesmo sem cadastro.

    Elas são acionadas pelo modelo da documentação, com o prazo pela
    criticidade — não precisam de regra. Sem esta linha, um caso parado
    com o Financeiro não aparecia na carga de ninguém.
  */
  const destinos = useMemo<MovementRule[]>(
    () => [
      ...AREAS_INTERNAS.filter(
        (a) => !movementRules.some((r) => r.destination === a.nome)
      ).map((a) => ({
        id: `${AREA_DO_DOCUMENTO}${a.nome}`,
        destination: a.nome,
        hours: 0,
        active: true,
      })),
      ...movementRules,
    ],
    [movementRules]
  );

  const cargaPorDestino = useMemo(
    () => loadByDestination(movements, destinos, { expediente }),
    [movements, destinos, expediente]
  );

  /** Movimentações pendentes fora do prazo, com o caso de cada uma. */
  const movimentacoesAtrasadas = useMemo(
    () =>
      lateMovements(movements, { expediente }).map((row) => ({
        ...row,
        caso: cases.find(
          (item) => item.id === row.movement.caseId
        ),
      })),
    [movements, cases, expediente]
  );

  function salvar(data: SlaRuleDraft | SlaRule) {

    if ("id" in data) updateRule(data);
    else createRule(data);

    setFormOpen(false);
    setEditing(undefined);
  }

  function salvarMovimento(
    data: MovementRuleDraft | MovementRule
  ) {

    if ("id" in data) updateMovementRule(data);
    else createMovementRule(data);

    setMovFormOpen(false);
    setMovEditing(undefined);
  }

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Conhecimento"
          title="Processos e SLA"
          description="Prazo do 1º contato e da solução por criticidade, em tempo útil, e prazo de retorno das movimentações internas."
        >
          <button
            onClick={() => setDocumentacaoAberta(true)}
            className="flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
          >
            <BookOpenCheck size={16} />
            Usar os prazos da documentação
          </button>

          <button
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
          >
            <Plus size={16} />
            Nova regra
          </button>
        </PageHeading>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">

          <StatTile
            label="Regras ativas"
            description="Regras que estão governando os prazos agora."
            value={
              rules.filter((item) => item.active).length
            }
            hint={`de ${rules.length} cadastradas`}
            icon={Timer}
            tone="primary"
          />

          <StatTile
            label="Fora do prazo"
            description="Casos em aberto que já passaram do prazo da regra aplicável."
            value={metrics.estourado}
            hint="precisam de ação hoje"
            icon={TriangleAlert}
            tone="danger"
          />

          <StatTile
            label="Perto de vencer"
            description="Casos em aberto nos últimos 25% do prazo."
            value={metrics.atencao}
            hint="entram em risco em breve"
            icon={Clock3}
            tone="warning"
          />

          <StatTile
            label="Casos em aberto"
            description="Total de tratativas ainda não encerradas."
            value={abertos.length}
            hint={
              metrics.semRegra > 0
                ? `${metrics.semRegra} sem regra aplicável`
                : "todos cobertos por uma regra"
            }
            icon={BookOpenCheck}
            tone="info"
          />

        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white px-5 py-4">

          <BookOpenCheck
            size={17}
            className="shrink-0 text-zinc-400"
          />

          <p className="flex-1 text-sm leading-relaxed text-zinc-600">
            Esta tela cuida dos{" "}
            <strong className="font-medium text-zinc-800">
              prazos
            </strong>
            . O passo a passo de cada fluxo — com etapas,
            responsáveis e link para o Confluence — fica em
            Documentação.
          </p>

          <Link
            href="/documentacao"
            className="shrink-0 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
          >
            Ver documentação
          </Link>

        </div>

        <ExpedienteCard />

        <OrphanCategories />

        <SurfaceCard
          title="Regras de SLA"
          description="A regra mais específica vence: categoria, depois prioridade, depois alcance do perfil, depois a frente."
          hint="Sem essa ordem, uma regra genérica cadastrada depois passaria por cima de uma específica já existente. Os prazos contam só tempo útil — ver Expediente."
          bodyClassName="p-0"
        >

          <div className="overflow-x-auto">

            <table className="min-w-full">

              <thead className="bg-zinc-50">

                <tr>

                  {[
                    "Aplica-se a",
                    "1º contato",
                    "Solução",
                    "Time",
                    "Em aberto hoje",
                    "",
                  ].map((head, index) => (
                    <th
                      key={head || index}
                      className="whitespace-nowrap px-3 py-3 xl:px-5 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
                    >
                      {head}
                    </th>
                  ))}

                </tr>

              </thead>

              <tbody className="divide-y divide-zinc-100">

                {/*
                  Tabela sem regra nenhuma é o estado normal agora — as
                  seis que existiam eram semente e foram zeradas em
                  23/08. Cabeçalho sozinho com nada embaixo parece tela
                  quebrada; o vazio precisa dizer o que é e o que fazer.
                */}
                {linhas.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-10 text-center"
                    >
                      <p className="text-sm font-medium text-zinc-600">
                        Nenhuma regra de SLA cadastrada.
                      </p>
                      <p className="mx-auto mt-1.5 max-w-md text-sm text-zinc-400">
                        Enquanto não houver regra, nenhum
                        caso é marcado como fora do prazo —
                        não há prazo contra o que comparar.
                      </p>
                      <button
                        type="button"
                        onClick={() => setDocumentacaoAberta(true)}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
                      >
                        <BookOpenCheck size={15} />
                        Usar os prazos da documentação
                      </button>
                    </td>
                  </tr>
                )}

                {linhas.map(({ rule, total, estourado }) => (

                  <tr
                    key={rule.id}
                    className={`group text-sm transition-colors hover:bg-zinc-50/70 ${
                      rule.active ? "" : "opacity-55"
                    }`}
                  >

                    <td className="px-3 py-3.5 xl:px-5">

                      <p className="font-medium text-zinc-800">
                        {rule.category === ANY_CATEGORY
                          ? "Todas as categorias"
                          : rule.category}

                        {rule.canal && (
                          <span className="ml-2 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                            {rule.canal}
                          </span>
                        )}

                        {rule.priority && (
                          <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                            {rule.priority}
                          </span>
                        )}

                        {rule.seguidoresMin && (
                          <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                            {rule.seguidoresMin.toLocaleString("pt-BR")}+ seguidores
                          </span>
                        )}

                        {!rule.active && (
                          <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                            inativa
                          </span>
                        )}
                      </p>

                      {rule.note && (
                        <p className="mt-0.5 max-w-md text-xs leading-relaxed text-zinc-500">
                          {rule.note}
                        </p>
                      )}

                    </td>

                    <td className="whitespace-nowrap px-3 py-3.5 xl:px-5 font-medium tabular-nums text-zinc-700">
                      {descreverPrazo(rule.responseHours)}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3.5 xl:px-5 font-medium tabular-nums text-zinc-700">
                      {rule.solutionHours > 0 ? descreverPrazo(rule.solutionHours) : "sem prazo"}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3.5 xl:px-5 text-zinc-600">
                      {rule.team ?? "—"}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3.5 xl:px-5">

                      <div className="flex items-center gap-2">

                        <span className="font-semibold tabular-nums text-zinc-900">
                          {total}
                        </span>

                        {estourado > 0 && (
                          <span
                            className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-100"
                            title="Casos desta regra que já passaram do prazo"
                          >
                            {estourado} fora do prazo
                          </span>
                        )}

                      </div>

                    </td>

                    <td className="whitespace-nowrap px-3 py-3.5 xl:px-5">

                      <div className="flex items-center justify-end gap-1">

                        <button
                          onClick={() =>
                            toggleRule(rule.id)
                          }
                          title={
                            rule.active
                              ? "Desativar regra"
                              : "Reativar regra"
                          }
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
                        >
                          {rule.active
                            ? "Desativar"
                            : "Ativar"}
                        </button>

                        <button
                          onClick={() => {
                            setEditing(rule);
                            setFormOpen(true);
                          }}
                          title="Editar regra"
                          className="rounded-lg p-2 text-zinc-400 opacity-0 transition-all hover:bg-violet-50 hover:text-violet-700 group-hover:opacity-100"
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          onClick={() => setDeleting(rule)}
                          title="Excluir regra"
                          className="rounded-lg p-2 text-zinc-400 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                        >
                          <Trash2 size={15} />
                        </button>

                      </div>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </SurfaceCard>

        <PrazosDeAreaCard />

        <SurfaceCard
          title="Destinos das movimentações"
          description="Os destinos que aparecem ao acionar. As cinco áreas do documento usam o prazo pela criticidade, acima; os demais, o prazo daqui."
          hint="Relógio separado do prazo do 1º contato: o caso pode estar em dia com o cliente e parado com uma área interna. O prazo fica congelado no registro, então editar o destino aqui não reescreve o histórico."
          action={
            <button
              onClick={() => {
                setMovEditing(undefined);
                setMovFormOpen(true);
              }}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
            >
              <Plus size={15} />
              Novo destino
            </button>
          }
          bodyClassName="p-0"
        >

          <div className="overflow-x-auto">

            <table className="min-w-full">

              <thead className="bg-zinc-50">

                <tr>

                  {[
                    "Destino",
                    "Prazo de retorno",
                    "Em aberto",
                    "Média de retorno",
                    "",
                  ].map((head, index) => (
                    <th
                      key={head || index}
                      className="whitespace-nowrap px-3 py-3 xl:px-5 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
                    >
                      {head}
                    </th>
                  ))}

                </tr>

              </thead>

              <tbody className="divide-y divide-zinc-100">

                {cargaPorDestino.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center"
                    >
                      <p className="text-sm font-medium text-zinc-600">
                        Nenhum destino cadastrado.
                      </p>
                      <p className="mx-auto mt-1.5 max-w-md text-sm text-zinc-400">
                        Cadastre as áreas para as quais a
                        Reputação move caso — e quantas
                        horas cada uma tem para devolver.
                      </p>
                    </td>
                  </tr>
                )}

                {cargaPorDestino.map(
                  ({
                    rule,
                    abertas,
                    atrasadas,
                    mediaRetorno,
                  }) => (

                    <tr
                      key={rule.id}
                      className={`group text-sm transition-colors hover:bg-zinc-50/70 ${rule.active ? "" : "opacity-55"}`}
                    >

                      <td className="px-3 py-3.5 xl:px-5">

                        <p className="font-medium text-zinc-800">
                          {rule.destination}

                          {!rule.active && (
                            <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                              inativo
                            </span>
                          )}
                        </p>

                        {rule.note && (
                          <p className="mt-0.5 max-w-md text-xs leading-relaxed text-zinc-500">
                            {rule.note}
                          </p>
                        )}

                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 xl:px-5 font-medium tabular-nums text-zinc-700">
                        {AREAS_INTERNAS.some((a) => a.nome === rule.destination)
                          ? "Pela criticidade"
                          : formatHours(rule.hours)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 xl:px-5">

                        <div className="flex items-center gap-2">

                          <span className="font-semibold tabular-nums text-zinc-900">
                            {abertas}
                          </span>

                          {atrasadas > 0 && (
                            <span
                              className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-100"
                              title="Movimentações deste destino que já passaram do prazo"
                            >
                              {atrasadas} atrasada(s)
                            </span>
                          )}

                        </div>

                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 xl:px-5 tabular-nums text-zinc-600">
                        {mediaRetorno === undefined
                          ? "—"
                          : formatHours(mediaRetorno)}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3.5 xl:px-5">

                        {rule.id.startsWith(AREA_DO_DOCUMENTO) ? (
                          <p className="text-right text-xs text-zinc-400">Área do documento</p>
                        ) : (
                        <div className="flex items-center justify-end gap-1">

                          <button
                            onClick={() =>
                              toggleMovementRule(rule.id)
                            }
                            title={
                              rule.active
                                ? "Desativar destino"
                                : "Reativar destino"
                            }
                            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
                          >
                            {rule.active
                              ? "Desativar"
                              : "Ativar"}
                          </button>

                          <button
                            onClick={() => {
                              setMovEditing(rule);
                              setMovFormOpen(true);
                            }}
                            title="Editar destino"
                            className="rounded-lg p-2 text-zinc-400 opacity-0 transition-all hover:bg-violet-50 hover:text-violet-700 group-hover:opacity-100"
                          >
                            <Pencil size={15} />
                          </button>

                          <button
                            onClick={() =>
                              setMovDeleting(rule)
                            }
                            title="Excluir destino"
                            className="rounded-lg p-2 text-zinc-400 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                          >
                            <Trash2 size={15} />
                          </button>

                        </div>
                        )}

                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        </SurfaceCard>

        <SurfaceCard
          title="Movimentações fora do prazo"
          description="Casos parados com uma área interna ou esperando o cliente."
        >

          {movimentacoesAtrasadas.length === 0 ? (

            <p className="rounded-xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
              Nenhuma movimentação atrasada. Todas as áreas
              em dia.
            </p>

          ) : (

            <ul className="space-y-2">

              {movimentacoesAtrasadas.map(
                ({ movement, status, caso }) => (

                  <li key={movement.id}>

                    <Link
                      href={
                        caso
                          ? caseHref(caso)
                          : `/reclame-aqui/${movement.caseId}`
                      }
                      className="flex items-center gap-3 rounded-xl border border-zinc-200/80 px-4 py-3 transition-colors hover:border-violet-200 hover:bg-violet-50/40"
                    >

                      <span className="min-w-0 flex-1">

                        <span className="block truncate text-sm font-medium text-zinc-800">
                          {caso?.title ??
                            "Caso não encontrado"}
                        </span>

                        <span className="mt-0.5 block truncate text-[11px] text-zinc-500">

                          <span className="font-mono text-violet-700">
                            {caso?.protocol ??
                              movement.caseId}
                          </span>

                          {" · com "}
                          {movement.destination}
                          {" · "}
                          {movement.reason}

                        </span>

                      </span>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${toneOfSla(status.situation)}`}
                        title={`Prazo do destino: ${formatHours(movement.dueHours)}`}
                      >
                        {formatHours(
                          Math.abs(status.remainingHours)
                        )}{" "}
                        de atraso
                      </span>

                    </Link>

                  </li>

                )
              )}

            </ul>

          )}

        </SurfaceCard>

        <SurfaceCard
          title="Fora do prazo agora"
          description="Casos em aberto que já passaram do prazo da regra aplicável."
          hint="Enquanto não há resposta pública vale o prazo de resposta; depois dela, passa a valer o de solução."
        >

          {atrasados.length === 0 ? (

            <p className="rounded-xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
              Nenhum caso fora do prazo. Operação em dia.
            </p>

          ) : (

            <ul className="space-y-2">

              {atrasados.map(({ item, status }) => (

                <li key={item.id}>

                  <Link
                    href={caseHref(item)}
                    className="flex items-center gap-3 rounded-xl border border-zinc-200/80 px-4 py-3 transition-colors hover:border-violet-200 hover:bg-violet-50/40"
                  >

                    <span className="min-w-0 flex-1">

                      <span className="block truncate text-sm font-medium text-zinc-800">
                        {item.title}
                      </span>

                      <span className="mt-0.5 block truncate text-[11px] text-zinc-500">

                        <span className="font-mono text-violet-700">
                          {item.protocol}
                        </span>

                        {" · "}
                        {item.category} · {item.priority}

                      </span>

                    </span>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${toneOfSla(
                        status.situation
                      )}`}
                      title={`Prazo da regra: 1º contato em até ${descreverPrazo(
                        status.rule?.responseHours ?? 0
                      )}${status.rule?.solutionHours ? `, solução em até ${descreverPrazo(status.rule.solutionHours)}` : ""}. Contado em tempo útil.`}
                    >
                      {status.label}
                    </span>

                  </Link>

                </li>

              ))}

            </ul>

          )}

        </SurfaceCard>

      </div>

      {formOpen && (
        <SlaRuleForm
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

      {movFormOpen && (
        <MovementRuleForm
          editing={movEditing}
          onClose={() => {
            setMovFormOpen(false);
            setMovEditing(undefined);
          }}
          onSave={salvarMovimento}
        />
      )}

      <ConfirmDelete
        open={Boolean(movDeleting)}
        label={movDeleting?.destination ?? ""}
        onCancel={() => setMovDeleting(undefined)}
        onConfirm={() => {
          if (movDeleting) {
            removeMovementRule(movDeleting.id);
          }
          setMovDeleting(undefined);
        }}
      />

      {documentacaoAberta && (
        <PrazosDaDocumentacaoModal onClose={() => setDocumentacaoAberta(false)} />
      )}

      <ConfirmDelete
        open={Boolean(deleting)}
        label={
          deleting
            ? deleting.category === ANY_CATEGORY
              ? "Regra padrão"
              : deleting.category
            : ""
        }
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) removeRule(deleting.id);
          setDeleting(undefined);
        }}
      />

    </MainLayout>
  );
}
