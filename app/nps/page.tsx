"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import {
  CircleAlert,
  Columns3,
  Download,
  Gauge,
  LayoutGrid,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  ThumbsDown,
  Upload,
  Users,
  X,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";
import MenuMais from "@/components/shared/MenuMais";

import { ConfirmDelete } from "@/components/shared/Modal";

import NpsForm from "@/components/nps/NpsForm";
import NpsList from "@/components/nps/NpsList";
import NpsKanban from "@/components/nps/NpsKanban";
import RootCauseManager from "@/components/nps/RootCauseManager";
import StageManager from "@/components/nps/StageManager";
import TriagemNps from "@/components/nps/TriagemNps";
import NpsSheetImport from "@/components/nps/NpsSheetImport";
import WootricImport from "@/components/nps/WootricImport";

import { useNps } from "@/lib/context/NpsContext";
import { useProjects } from "@/lib/context/ProjectsContext";
import { useToast } from "@/lib/context/ToastContext";
import { useSession } from "@/lib/context/SessionContext";
import { sincronizar } from "@/lib/context/sync";

import {
  deleteNpsResponse,
  exportNps,
  NpsDraft,
  removeNpsRootCause,
  saveNpsResponse,
  saveNpsRootCause,
  setNpsStatus,
} from "@/lib/actions/nps";

import {
  isEncerrado,
  NpsResponseView,
  RootCauseOption,
  NpsSegment,
  segmentOf,
  SEGMENTS,
  STATUS_SEM_TRATATIVA,
} from "@/lib/models/nps";

import {
  bySegment,
  slaState,
  summarize,
} from "@/lib/services/nps.service";

import FiltroDePeriodo from "@/components/shared/FiltroDePeriodo";
import { diaNoIntervalo, intervaloDoAtalho, type AtalhoDoPeriodo, type Intervalo } from "@/lib/models/periodo";
import { diaNaOperacao, hojeNaOperacao } from "@/lib/services/reputation.service";
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

/**
 * Sem acento, minúsculo, espaços colapsados.
 *
 * A busca compara nome digitado com nome gravado, e "José" e "Jose"
 * precisam ser a mesma coisa — quem procura raramente digita o acento.
 */
function simplificar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Só os dígitos.
 *
 * O telefone é gravado como veio: "(11) 98765-4321" numa resposta,
 * "11987654321" noutra. Comparar texto puro acharia uma e não a outra,
 * e quem procura pelo número que apareceu no WhatsApp digita sem
 * máscara.
 */
function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

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
  const { recarregar: recarregarProjetos } = useProjects();
  const session = useSession();

  const [filtro, setFiltro] = useState<Filtro>("abertos");

  /**
   * A busca, por e-mail, telefone ou nome.
   *
   * **Por que os três juntos e não um campo por vez.** Quem atende chega
   * com uma coisa só na mão: o e-mail que o Wootric mostrou, o número
   * que apareceu no WhatsApp, ou o nome que a pessoa disse ao telefone.
   * Obrigar a escolher em qual campo procurar é obrigar a saber a
   * resposta antes de perguntar.
   *
   * O identificador do Wootric entra na busca junto — é o que aparece
   * na tela hoje, e quem já o conhece vai digitá-lo.
   */
  const [busca, setBusca] = useState("");

  /** O que foi digitado, pronto para comparar. */
  const termo = simplificar(busca);
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
  const router = useRouter();

  /** A ficha do ciclo tem endereço próprio — o cartão e a lista levam para lá. */
  const abrir = (id: string) => router.push(`/nps/${id}`);

  /*
    `?resposta=<id>` era o link da tratativa quando ela abria num modal
    por cima desta lista — Projetos, a extensão antiga e o que alguém
    guardou nos favoritos ainda apontam para ele. Leva à ficha.
  */
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("resposta");
    if (id) router.replace(`/nps/${id}`);
  }, [router]);

  const [salvando, setSalvando] = useState(false);

  const [exportando, setExportando] = useState(false);

  const [causasOpen, setCausasOpen] = useState(false);
  const [etapasOpen, setEtapasOpen] = useState(false);
  const [planilhaOpen, setPlanilhaOpen] =
    useState(false);

  const [excluindo, setExcluindo] =
    useState<NpsResponseView>();

  const [, startTransition] = useTransition();

  /*
    O período: vale para tudo o que a tela conta — o NPS do topo, os
    segmentos, a causa raiz, a triagem, a lista e a exportação. A data é
    a da resposta no Wootric, no dia de Brasília.
  */
  const [atalhoDoPeriodo, setAtalhoDoPeriodo] = useState<AtalhoDoPeriodo>("tudo");
  const [periodoPersonalizado, setPeriodoPersonalizado] = useState<Intervalo>({ de: null, ate: null });
  const intervalo = useMemo(
    () => intervaloDoAtalho(atalhoDoPeriodo, hojeNaOperacao(), periodoPersonalizado),
    [atalhoDoPeriodo, periodoPersonalizado]
  );
  const doPeriodo = useMemo(
    () => (intervalo.de || intervalo.ate ? responses.filter((r) => diaNoIntervalo(diaNaOperacao(r.respondedAt), intervalo)) : responses),
    [responses, intervalo]
  );

  const resumo = useMemo(
    () => summarize(doPeriodo),
    [doPeriodo]
  );

  const segmentos = useMemo(
    () => bySegment(doPeriodo),
    [doPeriodo]
  );

  /* O percentual de cada faixa vai no próprio indicador; o gráfico de
     distribuição e o de causa raiz ficam na Análise do NPS. */
  const pctDe = (faixa: NpsSegment) =>
    String(segmentos.find((s) => s.label === faixa)?.percent ?? 0).replace(".", ",");

  const visiveis = useMemo(() => {

    return doPeriodo.filter((item) => {

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

      /**
       * A busca corta antes dos recortes, e ignora acento e máscara.
       *
       * O telefone é gravado como veio — "(11) 98765-4321" numa
       * resposta, "11987654321" noutra — então comparar texto puro
       * acharia uma e não a outra. Só os dígitos são comparados quando
       * o que foi digitado é número.
       */
      if (termo) {

        const alvos = [
          item.customerName,
          item.customer,
          item.email,
          item.company,
        ]
          .filter(Boolean)
          .map((v) => simplificar(String(v)));

        const digitados = somenteDigitos(termo);

        const achouTexto = alvos.some((a) =>
          a.includes(termo)
        );

        const achouTelefone =
          digitados.length >= 4 &&
          somenteDigitos(item.phone ?? "").includes(
            digitados
          );

        if (!achouTexto && !achouTelefone) return false;
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

  }, [
    doPeriodo,
    filtro,
    kindFiltro,
    segmento,
    comentario,
    termo,
  ]);

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
      abertos: doPeriodo.filter(
        (item) => !isEncerrado(item.status)
      ).length,
      estourados: doPeriodo.filter(
        (item) => slaState(item) === "estourado"
      ).length,
      "sem-tratativa": doPeriodo.filter(
        (item) => item.status === STATUS_SEM_TRATATIVA
      ).length,
      todos: doPeriodo.length,
    }),
    [doPeriodo]
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

    for (const item of doPeriodo) {
      const alvo = mapa[segmentOf(item.score).label];
      alvo.total += 1;
      if (item.comment.trim() !== "") alvo.comentarios += 1;
    }

    return mapa;
  }, [doPeriodo]);

  async function salvar(dados: NpsDraft) {

    setSalvando(true);

    try {

      const r = await saveNpsResponse(dados);

      if (!r.ok) {
        notify({ tone: "error", title: "Não foi possível salvar.", detail: r.erro });
        return;
      }

      await recarregar();

      /**
       * Erro Processual abre um item em Projetos — na criação e, desde a
       * Fase 4, também na edição. O quadro de Projetos carrega uma vez;
       * sem reler, a revisão só apareceria depois de um F5.
       */
      if (dados.kind === "Erro Processual") {
        await recarregarProjetos();
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

            <MenuMais
              itens={[
                { rotulo: "Etapas e tipos", icone: Columns3, onClick: () => setEtapasOpen(true), dica: "As colunas por onde a tratativa caminha e os tipos que classificam cada resposta." },
                { rotulo: "Causas raiz", icone: SlidersHorizontal, onClick: () => setCausasOpen(true) },
                {
                  rotulo: exportando ? "Exportando…" : `Exportar o recorte (${visiveis.length})`,
                  icone: Download,
                  onClick: exportar,
                  desativado: exportando || visiveis.length === 0,
                  dica: "Gera um .xlsx com o recorte que está na tela.",
                },
                { rotulo: "Importar planilha", icone: Upload, onClick: () => setPlanilhaOpen(true), dica: "Um .xlsx ou .csv — o mesmo cabeçalho que a exportação gera." },
              ]}
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

        <FiltroDePeriodo
          atalho={atalhoDoPeriodo}
          personalizado={periodoPersonalizado}
          intervalo={intervalo}
          total={doPeriodo.length}
          rotuloDoTotal={["resposta", "respostas"]}
          onAtalho={setAtalhoDoPeriodo}
          onPersonalizado={(i) => {
            setPeriodoPersonalizado(i);
            setAtalhoDoPeriodo("personalizado");
          }}
        />

        <div data-tour="indicadores-nps" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">

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
            hint={`${pctDe("Promotor")}% · ${porSegmento.Promotor.comentarios} com comentário`}
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
            hint={`${pctDe("Passivo")}% · ${porSegmento.Passivo.comentarios} com comentário`}
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
            hint={`${pctDe("Detrator")}% · ${porSegmento.Detrator.comentarios} com comentário`}
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

        <TriagemNps
          itens={doPeriodo}
          tipos={kinds}
          onOpen={(item) => abrir(item.id)}
          onAplicado={async (abriuRevisao) => {
            await recarregar();
            if (abriuRevisao) await recarregarProjetos();
          }}
        />

        <SurfaceCard
          tour="respostas-nps"
          title="Respostas"
          description="Clique para abrir a tratativa e fechar o ciclo."
          bodyClassName="p-0"
          action={
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">

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

          {/*
            A busca fica acima das duas visões, e não dentro de uma.

            Ela filtra `visiveis`, que alimenta tanto o quadro quanto a
            lista — pôr o campo dentro de uma das duas faria o resultado
            mudar ao trocar de visão, sem ninguém entender por quê.
          */}
          <div className="border-b border-zinc-100 p-3">

            <div className="relative">

              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />

              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, e-mail ou telefone"
                className="h-10 w-full rounded-xl border border-zinc-200 pl-9 pr-9 text-sm outline-none transition-colors focus:border-violet-400"
              />

              {busca && (
                <button
                  onClick={() => setBusca("")}
                  title="Limpar a busca"
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {busca && (
              <p className="mt-2 text-xs text-zinc-500">
                {visiveis.length === 0
                  ? "Nenhum ciclo com esse nome, e-mail ou telefone. O telefone só existe em 77 das respostas — o Wootric não o envia."
                  : `${visiveis.length} ciclo(s) encontrado(s).`}
              </p>
            )}
          </div>

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
                onOpen={(item) => abrir(item.id)}
                onMove={async (item, status) => {

                  // Otimista: o cartão muda de coluna na hora do solto.
                  aplicarLocal(item.id, { status });

                  const r = await setNpsStatus(item.id, status);

                  /* Recusado, o cartão volta para onde estava — e a tela diz por quê. */
                  if (!r.ok) {
                    aplicarLocal(item.id, { status: item.status });
                    notify({ tone: "error", title: "O ciclo não mudou de etapa.", detail: r.erro });
                    return;
                  }

                  if (r.avisoDoWootric) {
                    notify({ tone: "error", title: "Reaberto aqui; no Wootric continua concluído.", detail: r.avisoDoWootric });
                  }

                  startTransition(() => {
                    recarregar();
                  });
                }}
              />
            </div>

          ) : (

            <NpsList
              itens={visiveis}
              onLimparRecorte={() => {
                setBusca("");
                setKindFiltro("");
                setSegmento("");
                setComentario("");
                setAtalhoDoPeriodo("tudo");
                setPeriodoPersonalizado({ de: null, ate: null });
              }}
              podeExcluir={session?.role === "ADMIN"}
              onOpen={(item) => abrir(item.id)}
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

            const r = await deleteNpsResponse(alvo.id);

            if (!r.ok) {
              notify({ tone: "error", title: "Não foi excluído.", detail: r.erro });
              return;
            }

            await recarregar();

            notify({
              tone: "success",
              title: "Registro excluído.",
              detail: `${alvo.customer} — a nota do período foi recalculada.`,
            });
          });
        }}
      />


    </MainLayout>
  );
}
