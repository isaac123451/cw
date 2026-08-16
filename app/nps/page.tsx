"use client";

import { useMemo, useState, useTransition } from "react";

import {
  CircleAlert,
  Gauge,
  Plus,
  Star,
  ThumbsDown,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";

import { ConfirmDelete } from "@/components/shared/Modal";

import NpsForm from "@/components/nps/NpsForm";
import NpsDrawer from "@/components/nps/NpsDrawer";
import NpsList from "@/components/nps/NpsList";

import { useNps } from "@/lib/context/NpsContext";
import { invalidarWorkspace } from "@/lib/context/useWorkspace";
import { useToast } from "@/lib/context/ToastContext";
import { useSession } from "@/lib/context/SessionContext";

import {
  confirmNpsResolution,
  deleteNpsResponse,
  NpsDraft,
  registerNpsAttempt,
  saveNpsResponse,
  setNpsAdvocacy,
  setNpsStatus,
} from "@/lib/actions/nps";

import {
  isEncerrado,
  KINDS,
  NpsResponseView,
} from "@/lib/models/nps";

import {
  bySegment,
  byRootCause,
  slaState,
  summarize,
} from "@/lib/services/nps.service";

type Filtro = "abertos" | "todos" | "estourados";

export default function NpsPage() {

  const { responses, loading, recarregar, aplicarLocal } =
    useNps();

  const { notify } = useToast();
  const session = useSession();

  const [filtro, setFiltro] = useState<Filtro>("abertos");
  const [kindFiltro, setKindFiltro] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] =
    useState<NpsResponseView>();
  const [aberto, setAberto] = useState<string>();
  const [salvando, setSalvando] = useState(false);

  const [excluindo, setExcluindo] =
    useState<NpsResponseView>();

  const [, startTransition] = useTransition();

  const resumo = useMemo(
    () => summarize(responses),
    [responses]
  );

  const segmentos = useMemo(
    () => bySegment(responses),
    [responses]
  );

  const causas = useMemo(
    () => byRootCause(responses),
    [responses]
  );

  const visiveis = useMemo(() => {

    return responses.filter((item) => {

      if (
        kindFiltro &&
        item.kind !== kindFiltro
      ) {
        return false;
      }

      if (filtro === "abertos") {
        return !isEncerrado(item.status);
      }

      if (filtro === "estourados") {
        return slaState(item) === "estourado";
      }

      return true;
    });

  }, [responses, filtro, kindFiltro]);

  /** O item aberto vem da lista, para refletir a última gravação. */
  const selecionado = responses.find(
    (r) => r.id === aberto
  );

  async function salvar(dados: NpsDraft) {

    setSalvando(true);

    try {

      await saveNpsResponse(dados);
      await recarregar();

      /**
       * Erro Processual abre um item em Projetos, e a carga do
       * workspace é memoizada no módulo — sem descartar, a revisão só
       * apareceria depois de um F5.
       */
      if (dados.kind === "Erro Processual" && !dados.id) {
        invalidarWorkspace();
      }

      setFormOpen(false);
      setEditando(undefined);

      notify({
        tone: "success",
        title: editando
          ? "Resposta atualizada."
          : "Resposta registrada.",
        detail:
          dados.kind === "Erro Processual" && !editando
            ? "Item de revisão aberto em Projetos e Melhorias."
            : dados.customer,
      });

    } catch (erro) {
      notify({
        tone: "error",
        title: "Não foi possível salvar.",
        detail:
          erro instanceof Error
            ? erro.message
            : "Falha ao gravar.",
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Inteligência"
          title="NPS"
          description="Pesquisa do portal e o ciclo de feedback até o encerramento — reter quem está insatisfeito e aproveitar quem está satisfeito."
        >
          <button
            onClick={() => {
              setEditando(undefined);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
          >
            <Plus size={16} />
            Registrar resposta
          </button>
        </PageHeading>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatTile
            label="NPS"
            description="Percentual de promotores menos o de detratores."
            value={resumo.score}
            hint={`${resumo.total} resposta(s)`}
            icon={Gauge}
            tone="primary"
          />

          <StatTile
            label="Promotores"
            description="Notas 9 e 10 — base para review, depoimento e indicação."
            value={resumo.promotores}
            hint={`de ${resumo.total}`}
            icon={Star}
            tone="success"
          />

          <StatTile
            label="Detratores"
            description="Notas 0 a 6 — risco de cancelamento."
            value={resumo.detratores}
            hint="socorrer primeiro"
            icon={ThumbsDown}
            tone="danger"
          />

          <StatTile
            label="Fora do prazo"
            description="Sem primeiro contato dentro do SLA do segmento."
            value={resumo.estourados}
            hint={`${resumo.abertos} em aberto`}
            icon={CircleAlert}
            tone="warning"
          />

        </div>

        <div className="grid gap-4 lg:grid-cols-2">

          <SurfaceCard
            title="Distribuição"
            description="Como as respostas se dividem entre os três segmentos."
          >
            <div className="space-y-2.5">
              {segmentos.map((s) => (
                <div key={s.label}>

                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-700">
                      {s.label}
                    </span>
                    <span className="tabular-nums text-zinc-500">
                      {s.value} · {s.percent}%
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${s.percent}%`,
                        background: s.color,
                      }}
                    />
                  </div>

                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard
            title="Causa raiz"
            description="Onde investir para parar de perder cliente."
          >
            {causas.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-400">
                Nenhuma causa marcada ainda.
              </p>
            ) : (
              <div className="space-y-2.5">
                {causas.slice(0, 6).map((c) => (
                  <div key={c.label}>

                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-700">
                        {c.label}
                      </span>
                      <span className="tabular-nums text-zinc-500">
                        {c.value} · {c.percent}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-violet-500 transition-all"
                        style={{
                          width: `${c.percent}%`,
                        }}
                      />
                    </div>

                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>

        </div>

        <SurfaceCard
          title="Respostas"
          description="Clique para abrir a tratativa e fechar o ciclo."
          bodyClassName="p-0"
          action={
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">

              {(
                [
                  ["abertos", "Em aberto"],
                  ["estourados", "Fora do prazo"],
                  ["todos", "Todas"],
                ] as [Filtro, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setFiltro(id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ring-1 ring-inset ${filtro === id ? "bg-violet-50 text-violet-700 ring-violet-200" : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"}`}
                >
                  {label}
                </button>
              ))}

              <select
                value={kindFiltro}
                onChange={(e) =>
                  setKindFiltro(e.target.value)
                }
                className="h-7 rounded-lg border border-zinc-200 px-2 text-xs outline-none focus:border-violet-400"
              >
                <option value="">Todos os tipos</option>
                {KINDS.map((k) => (
                  <option key={k.label} value={k.label}>
                    {k.label}
                  </option>
                ))}
              </select>

            </div>
          }
        >

          {loading ? (

            <p className="py-10 text-center text-sm text-zinc-400">
              Carregando...
            </p>

          ) : (

            <NpsList
              itens={visiveis}
              podeExcluir={session?.role === "ADMIN"}
              onOpen={(item) => setAberto(item.id)}
              onEdit={(item) => {
                setEditando(item);
                setFormOpen(true);
              }}
              onDelete={setExcluindo}
            />

          )}

        </SurfaceCard>

      </div>

      {formOpen && (
        <NpsForm
          key={editando?.id ?? "novo"}
          open={formOpen}
          editing={editando}
          saving={salvando}
          onClose={() => {
            setFormOpen(false);
            setEditando(undefined);
          }}
          onSave={salvar}
        />
      )}

      <ConfirmDelete
        open={Boolean(excluindo)}
        label={
          excluindo
            ? `${excluindo.customer} (nota ${excluindo.score})`
            : ""
        }
        onCancel={() => setExcluindo(undefined)}
        onConfirm={() => {

          if (!excluindo) return;

          const alvo = excluindo;
          setExcluindo(undefined);

          startTransition(async () => {

            await deleteNpsResponse(alvo.id);
            await recarregar();

            notify({
              tone: "success",
              title: "Registro excluído.",
              detail: `${alvo.customer} — a nota do período foi recalculada.`,
            });
          });
        }}
      />

      {selecionado && (
        <NpsDrawer
          item={selecionado}
          onClose={() => setAberto(undefined)}
          onAttempt={async (channel, note) => {
            await registerNpsAttempt({
              responseId: selecionado.id,
              channel,
              note,
              actor: session?.name ?? "",
            });
            await recarregar();
          }}
          onConfirm={async (valor) => {
            aplicarLocal(selecionado.id, {
              confirmedAt: valor
                ? new Date().toISOString()
                : undefined,
            });
            await confirmNpsResolution(
              selecionado.id,
              valor
            );
            startTransition(() => {
              recarregar();
            });
          }}
          onStatus={async (status) => {
            await setNpsStatus(selecionado.id, status);
            await recarregar();
            setAberto(undefined);
            notify({
              tone: "success",
              title: status,
              detail: selecionado.customer,
            });
          }}
          onAdvocacy={async (campo, valor) => {
            aplicarLocal(selecionado.id, {
              [`${campo}Asked`]: valor,
            } as Partial<NpsResponseView>);
            await setNpsAdvocacy(
              selecionado.id,
              campo,
              valor
            );
          }}
        />
      )}

    </MainLayout>
  );
}
