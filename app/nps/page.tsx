"use client";

import { useMemo, useState, useTransition } from "react";

import {
  CircleAlert,
  Columns3,
  Download,
  Gauge,
  LayoutGrid,
  List,
  Plus,
  SlidersHorizontal,
  Star,
  ThumbsDown,
  Upload,
  Users,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";

import { ConfirmDelete } from "@/components/shared/Modal";

import NpsForm from "@/components/nps/NpsForm";
import NpsDrawer from "@/components/nps/NpsDrawer";
import NpsList from "@/components/nps/NpsList";
import NpsKanban from "@/components/nps/NpsKanban";
import RootCauseManager from "@/components/nps/RootCauseManager";
import StageManager from "@/components/nps/StageManager";
import NpsSheetImport from "@/components/nps/NpsSheetImport";
import WootricImport from "@/components/nps/WootricImport";

import { useNps } from "@/lib/context/NpsContext";
import { invalidarWorkspace } from "@/lib/context/useWorkspace";
import { useToast } from "@/lib/context/ToastContext";
import { useSession } from "@/lib/context/SessionContext";
import { sincronizar } from "@/lib/context/sync";

import {
  confirmNpsResolution,
  deleteNpsResponse,
  exportNps,
  NpsDraft,
  registerNpsAttempt,
  registerPostContact,
  removeNpsRootCause,
  saveNpsResponse,
  saveNpsRootCause,
  setNpsAdvocacy,
  setNpsStatus,
} from "@/lib/actions/nps";

import {
  isEncerrado,
  NpsResponseView,
  RootCauseOption,
  STATUS_EM_TRATATIVA,
  NpsSegment,
  segmentOf,
  SEGMENTS,
  STATUS_SEM_TRATATIVA,
} from "@/lib/models/nps";

import {
  bySegment,
  byRootCause,
  slaState,
  summarize,
} from "@/lib/services/nps.service";

/**
 * "Detrator" vira "Detratores"; "Passivo" vira "Passivos".
 *
 * Terminado em consoante pede "es", terminado em vogal pede "s" —
 * concatenar "es" em tudo produzia "Passivoes".
 */
function plural(palavra: string) {
  return /[aeiou]$/i.test(palavra)
    ? `${palavra}s`
    : `${palavra}es`;
}

type Filtro =
  | "abertos"
  | "todos"
  | "estourados"
  | "sem-tratativa";

export default function NpsPage() {

  const {
    responses,
    rootCauses,
    stages,
    kinds,
    loading,
    recarregar,
    recarregarCausas,
    recarregarCadastro,
    aplicarLocal,
  } = useNps();

  const { notify } = useToast();
  const session = useSession();

  const [filtro, setFiltro] = useState<Filtro>("abertos");
  const [kindFiltro, setKindFiltro] = useState("");

  /** Recorte por segmento — o que os três indicadores do topo acionam. */
  const [segmento, setSegmento] = useState<NpsSegment | "">(
    ""
  );

  /**
   * Recorte por comentário, no vocabulário do Wootric.
   *
   * A pesquisa vem com 89% de respostas sem uma palavra escrita, e é no
   * comentário que mora a causa raiz — separar os dois é o filtro mais
   * usado lá, e faltava aqui.
   */
  const [comentario, setComentario] = useState<
    "" | "com" | "sem" | "com-sem-causa" | "com-sem-tipo"
  >("");
  const [visao, setVisao] = useState<"kanban" | "lista">(
    "kanban"
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] =
    useState<NpsResponseView>();
  const [aberto, setAberto] = useState<string>();
  const [salvando, setSalvando] = useState(false);

  const [exportando, setExportando] = useState(false);

  const [causasOpen, setCausasOpen] = useState(false);
  const [etapasOpen, setEtapasOpen] = useState(false);
  const [planilhaOpen, setPlanilhaOpen] =
    useState(false);

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

      if (
        segmento &&
        segmentOf(item.score).label !== segmento
      ) {
        return false;
      }

      const temComentario = item.comment.trim() !== "";

      if (comentario === "com" && !temComentario) return false;
      if (comentario === "sem" && temComentario) return false;

      if (
        comentario === "com-sem-causa" &&
        (!temComentario || item.rootCause)
      ) {
        return false;
      }

      if (
        comentario === "com-sem-tipo" &&
        (!temComentario || item.kind)
      ) {
        return false;
      }

      if (filtro === "abertos") {
        return !isEncerrado(item.status);
      }

      if (filtro === "estourados") {
        return slaState(item) === "estourado";
      }

      if (filtro === "sem-tratativa") {
        return item.status === STATUS_SEM_TRATATIVA;
      }

      return true;
    });

  }, [responses, filtro, kindFiltro, segmento, comentario]);

  /**
   * Quantos casos cada recorte tem.
   *
   * Existe porque a importação do Wootric trouxe 789 respostas e o
   * recorte padrão mostra ~210: os promotores calados entram na base
   * sem abrir ciclo, e sem o número na aba parecia que a importação
   * tinha perdido o resto.
   */
  const contagens = useMemo(
    () => ({
      abertos: responses.filter(
        (item) => !isEncerrado(item.status)
      ).length,
      estourados: responses.filter(
        (item) => slaState(item) === "estourado"
      ).length,
      "sem-tratativa": responses.filter(
        (item) => item.status === STATUS_SEM_TRATATIVA
      ).length,
      todos: responses.length,
    }),
    [responses]
  );

  /**
   * Quantos comentários cada segmento trouxe.
   *
   * É o número que o Wootric mostra embaixo de cada segmento, e é a
   * leitura que importa: 650 promotores com 61 comentários significa
   * que 589 não disseram nada — e é sobre os 61 que dá para trabalhar.
   */
  const porSegmento = useMemo(() => {

    const mapa = {} as Record<
      NpsSegment,
      { total: number; comentarios: number }
    >;

    for (const s of SEGMENTS) {
      mapa[s.label] = { total: 0, comentarios: 0 };
    }

    for (const item of responses) {
      const alvo = mapa[segmentOf(item.score).label];
      alvo.total += 1;
      if (item.comment.trim() !== "") alvo.comentarios += 1;
    }

    return mapa;
  }, [responses]);

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

  /**
   * Exporta o recorte que está na tela.
   *
   * Manda os ids do que está visível em vez de exportar a base inteira:
   * quem filtrou por "fora do prazo" e clicou aqui quer aqueles.
   */
  async function exportar() {

    setExportando(true);

    try {

      const saida = await exportNps(
        visiveis.map((item) => item.id)
      );

      if (saida.erro || !saida.arquivo) {
        notify({
          tone: "error",
          title: "Não deu para exportar.",
          detail: saida.erro ?? "Arquivo vazio.",
        });
        return;
      }

      // base64 -> bytes -> download, sem passar por servidor de arquivo.
      const bytes = Uint8Array.from(
        atob(saida.arquivo),
        (c) => c.charCodeAt(0)
      );

      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );

      const link = document.createElement("a");
      link.href = url;
      link.download = saida.nome ?? "cw-nps.xlsx";
      link.click();

      URL.revokeObjectURL(url);

      notify({
        tone: "success",
        title: `${saida.total} resposta(s) exportada(s).`,
        detail: saida.nome,
      });

    } catch (erro) {
      notify({
        tone: "error",
        title: "Falha ao exportar.",
        detail:
          erro instanceof Error
            ? erro.message
            : "Erro desconhecido.",
      });
    } finally {
      setExportando(false);
    }
  }

  /**
   * Devolve o resultado, e não só grava.
   *
   * A tela de causa raiz passou a usar o botão Salvar, e o rascunho
   * precisa saber item a item se a gravação foi aceita: só com o lote
   * inteiro gravado ele se funde na base. Falhou alguma, o que não foi
   * gravado **continua na tela**, para dar para corrigir em vez de
   * redigitar.
   */
  async function salvarCausa(causa: RootCauseOption) {

    const resultado = await sincronizar(() =>
      saveNpsRootCause(causa)
    );

    if (resultado.ok) await recarregarCausas();

    return resultado;
  }

  async function excluirCausa(causa: RootCauseOption) {

    try {

      const emUso = await removeNpsRootCause(causa.id);

      await recarregarCausas();

      if (emUso && emUso > 0) {
        notify({
          tone: "info",
          title: "Causa desativada, não excluída.",
          detail: `${emUso} resposta(s) já usam "${causa.name}" — apagar mudaria a série histórica.`,
        });
      }

    } catch (erro) {
      notify({
        tone: "error",
        title: "Não foi possível excluir a causa.",
        detail:
          erro instanceof Error
            ? erro.message
            : "Falha ao gravar.",
      });
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
          <div className="flex flex-wrap items-center gap-2">

            <button
              onClick={() => setEtapasOpen(true)}
              title="As colunas por onde a tratativa caminha e os tipos que classificam cada resposta."
              className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-violet-300 hover:text-violet-700"
            >
              <Columns3 size={15} />
              Etapas e tipos
            </button>

            <button
              onClick={() => setCausasOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-violet-300 hover:text-violet-700"
            >
              <SlidersHorizontal size={15} />
              Causa raiz
            </button>

            <button
              onClick={exportar}
              disabled={exportando || visiveis.length === 0}
              title="Gera um .xlsx com o recorte que está na tela."
              className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-violet-300 hover:text-violet-700 disabled:opacity-50"
            >
              <Download size={15} />
              {exportando
                ? "Exportando..."
                : `Exportar (${visiveis.length})`}
            </button>

            <button
              onClick={() => setPlanilhaOpen(true)}
              title="Um .xlsx ou .csv — o mesmo cabeçalho que a exportação gera."
              className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-violet-300 hover:text-violet-700"
            >
              <Upload size={15} />
              Importar planilha
            </button>

            <WootricImport
              onDone={async (resumo, houveErro) => {

                if (!houveErro) await recarregar();

                notify({
                  tone: houveErro ? "error" : "success",
                  title: houveErro
                    ? "Importação não concluída."
                    : "Wootric importado.",
                  detail: resumo,
                });
              }}
            />

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

          </div>
        </PageHeading>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

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
            description="Notas 9 e 10 — base para review, depoimento e indicação. Clique para ver só estes."
            value={porSegmento.Promotor.total}
            hint={`${porSegmento.Promotor.comentarios} com comentário`}
            icon={Star}
            tone="success"
            ativo={segmento === "Promotor"}
            onClick={() =>
              setSegmento(
                segmento === "Promotor" ? "" : "Promotor"
              )
            }
          />

          <StatTile
            label="Passivos"
            description="Notas 7 e 8 — satisfeitos sem entusiasmo. Costuma ser onde mora a sugestão útil. Clique para ver só estes."
            value={porSegmento.Passivo.total}
            hint={`${porSegmento.Passivo.comentarios} com comentário`}
            icon={Users}
            tone="warning"
            ativo={segmento === "Passivo"}
            onClick={() =>
              setSegmento(
                segmento === "Passivo" ? "" : "Passivo"
              )
            }
          />

          <StatTile
            label="Detratores"
            description="Notas 0 a 6 — risco de cancelamento. Clique para ver só estes."
            value={porSegmento.Detrator.total}
            hint={`${porSegmento.Detrator.comentarios} com comentário`}
            icon={ThumbsDown}
            tone="danger"
            ativo={segmento === "Detrator"}
            onClick={() =>
              setSegmento(
                segmento === "Detrator" ? "" : "Detrator"
              )
            }
          />

          <StatTile
            label="Fora do prazo"
            description="Sem primeiro contato dentro do SLA do segmento."
            value={resumo.estourados}
            hint={`${resumo.abertos} em aberto`}
            icon={CircleAlert}
            tone="warning"
            ativo={filtro === "estourados"}
            onClick={() =>
              setFiltro(
                filtro === "estourados" ? "abertos" : "estourados"
              )
            }
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

              <div className="mr-1 flex items-center gap-0.5 rounded-lg bg-zinc-100 p-0.5">
                {(
                  [
                    ["kanban", LayoutGrid, "Quadro"],
                    ["lista", List, "Lista"],
                  ] as const
                ).map(([id, Icone, titulo]) => (
                  <button
                    key={id}
                    onClick={() => setVisao(id)}
                    title={titulo}
                    className={`rounded-md p-1.5 transition-colors ${visao === id ? "bg-white text-violet-700 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
                  >
                    <Icone size={14} />
                  </button>
                ))}
              </div>

              {(
                [
                  ["abertos", "Em aberto"],
                  ["estourados", "Fora do prazo"],
                  ["sem-tratativa", "Sem tratativa"],
                  ["todos", "Todas"],
                ] as [Filtro, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setFiltro(id)}
                  title={
                    id === "sem-tratativa"
                      ? "Promotores sem comentário: entram na conta do NPS, não abrem ciclo."
                      : undefined
                  }
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ring-1 ring-inset ${filtro === id ? "bg-violet-50 text-violet-700 ring-violet-200" : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"}`}
                >
                  {label}
                  <span className="ml-1.5 tabular-nums opacity-60">
                    {contagens[id]}
                  </span>
                </button>
              ))}

              {/*
                Os três segmentos, na barra de filtros.

                Já dava para filtrar clicando nos indicadores do topo,
                mas ali eles são leitura — ninguém procura filtro num
                cartão de número, e o recorte ficava escondido. Aqui
                estão junto dos outros filtros, com a contagem e a cor
                de cada faixa, e são o mesmo estado: clicar num dos dois
                lugares acende o outro.
              */}
              {SEGMENTS.map((s) => {

                const ativo = segmento === s.label;

                return (
                  <button
                    key={s.label}
                    onClick={() =>
                      setSegmento(ativo ? "" : s.label)
                    }
                    title={s.hint}
                    style={
                      ativo
                        ? {
                            color: s.color,
                            borderColor: s.color,
                            background: `${s.color}14`,
                          }
                        : undefined
                    }
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${ativo ? "font-semibold" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
                  >
                    <span
                      className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                      style={{ background: s.color }}
                    />
                    {plural(s.label)}
                    <span className="ml-1.5 tabular-nums opacity-60">
                      {porSegmento[s.label]?.total ?? 0}
                    </span>
                  </button>
                );
              })}

              <select
                value={comentario}
                onChange={(e) =>
                  setComentario(
                    e.target.value as typeof comentario
                  )
                }
                title="Mesmos recortes do Wootric: o que importa é separar quem escreveu de quem só deu nota."
                className="h-7 rounded-lg border border-zinc-200 px-2 text-xs outline-none focus:border-violet-400"
              >
                <option value="">Todos os comentários</option>
                <option value="com">Com comentário</option>
                <option value="sem">Sem comentário</option>
                <option value="com-sem-causa">
                  Com comentário, sem causa raiz
                </option>
                <option value="com-sem-tipo">
                  Com comentário, sem tipo
                </option>
              </select>

              <select
                value={kindFiltro}
                onChange={(e) =>
                  setKindFiltro(e.target.value)
                }
                className="h-7 rounded-lg border border-zinc-200 px-2 text-xs outline-none focus:border-violet-400"
              >
                <option value="">Todos os tipos</option>
                {kinds
                  .filter(
                    (k) => k.active || k.name === kindFiltro
                  )
                  .map((k) => (
                    <option key={k.id} value={k.name}>
                      {k.emoji} {k.name}
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

          ) : visao === "kanban" ? (

            <div className="p-3">
              <NpsKanban
                itens={visiveis}
                etapas={stages}
                tipos={kinds}
                onOpen={(item) => setAberto(item.id)}
                onMove={async (item, status) => {

                  // Otimista: o cartão muda de coluna na hora do solto.
                  aplicarLocal(item.id, { status });

                  await setNpsStatus(item.id, status);

                  startTransition(() => {
                    recarregar();
                  });
                }}
              />
            </div>

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
          rootCauses={rootCauses}
          tipos={kinds}
          onClose={() => {
            setFormOpen(false);
            setEditando(undefined);
          }}
          onSave={salvar}
          onManageCauses={() => setCausasOpen(true)}
        />
      )}

      {planilhaOpen && (
        <NpsSheetImport
          open={planilhaOpen}
          onClose={() => setPlanilhaOpen(false)}
          onDone={recarregar}
        />
      )}

      {etapasOpen && (
        <StageManager
          etapas={stages}
          tipos={kinds}
          onClose={() => setEtapasOpen(false)}
          onSaved={recarregarCadastro}
        />
      )}

      {causasOpen && (
        <RootCauseManager
          causas={rootCauses}
          onClose={() => setCausasOpen(false)}
          onSave={salvarCausa}
          onRemove={excluirCausa}
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
          etapas={stages}
          tipos={kinds}
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
          onPostContact={async (dados) => {

            const agora = new Date().toISOString();

            aplicarLocal(selecionado.id, {
              moodAfter: dados.mood ?? undefined,
              resolvedAfter:
                dados.resolved ?? undefined,
              postContactNote: dados.note,
              postContactAt: agora,
              postContactBy: session?.name,
              // Registrar o pós-contato é ter falado com o cliente.
              firstContactAt:
                selecionado.firstContactAt ?? agora,
              status: isEncerrado(selecionado.status)
                ? selecionado.status
                : STATUS_EM_TRATATIVA,
              confirmedAt:
                dados.resolved === true
                  ? agora
                  : undefined,
            });

            await registerPostContact({
              id: selecionado.id,
              mood: dados.mood,
              resolved: dados.resolved,
              note: dados.note,
              actor: session?.name ?? "",
            });

            startTransition(() => {
              recarregar();
            });

            notify({
              tone: "success",
              title: "Pós-contato registrado.",
              detail:
                dados.resolved === true
                  ? "Marcado como resolvido — o checklist já conta a confirmação."
                  : dados.resolved === false
                    ? "Marcado como não resolvido."
                    : selecionado.customer,
            });
          }}
        />
      )}

    </MainLayout>
  );
}
