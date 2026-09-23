"use client";

import Link from "next/link";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
import MiniKanban from "@/components/shared/MiniKanban";
import { ConfirmDelete } from "@/components/shared/Modal";

import SocialCaseForm from "@/components/redes-sociais/SocialCaseForm";
import EncerrarRedesModal from "@/components/redes-sociais/EncerrarRedesModal";
import SegmentosDasRedes from "@/components/redes-sociais/SegmentosDasRedes";

import { useScopedCases } from "@/lib/context/useScopedCases";
import { useCases } from "@/lib/context/CaseContext";
import { ETAPAS_DAS_REDES, eFinalDasRedes, etapaDasRedes } from "@/lib/models/redes";
import { isOpen } from "@/lib/services/case.service";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";
import {
  alternarFiltro,
  enderecoDosFiltros,
  filtrosAtivos,
  filtrosDoEndereco,
  segmentar,
  type DimensaoDasRedes,
} from "@/lib/models/segmentosDasRedes";

import { Case } from "@/lib/models/case";
import BotaoAbrirEmJanela from "@/components/janelas/BotaoAbrirEmJanela";
import { useJanelas } from "@/lib/context/JanelasContext";
import { idDaJanela } from "@/lib/models/janelas";

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

  const router = useRouter();
  const pathname = usePathname();
  const { establishments } = useEstablishments();

  const statusFiltrado = params.get("status") ?? "";

  /*
    Os segmentos moram no endereço: o recorte vira link, e o
    `?categoria=` que os gráficos de outras telas mandam continua
    chegando como filtro de assunto.
  */
  const filtros = useMemo(() => filtrosDoEndereco(new URLSearchParams(params.toString())), [params]);

  const nomes = useMemo(() => new Map(establishments.map((e) => [e.id, e.name])), [establishments]);

  const segmentado = useMemo(
    () => segmentar(todosOsSociais.filter((c) => !statusFiltrado || c.status === statusFiltrado), filtros, (id) => nomes.get(id)),
    [todosOsSociais, statusFiltrado, filtros, nomes]
  );

  const social = segmentado.casos;
  const ativos = filtrosAtivos(filtros) + (statusFiltrado ? 1 : 0);

  function trocarFiltros(novos: ReturnType<typeof filtrosDoEndereco>, manterStatus = true) {
    const p = new URLSearchParams(enderecoDosFiltros(novos));
    if (manterStatus && statusFiltrado) p.set("status", statusFiltrado);
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  const recorte = ativos > 0;

  const { setCases, loading } = useCases();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Case>();
  const [deleting, setDeleting] = useState<Case>();

  /*
    As etapas do documento das Redes, e não as do Reclame Aqui.

    O quadro usava o fluxo do portal: um direct do Instagram ia para
    "Aguardando avaliação". Agora são as seis do documento, com os três
    finais — e só "Resolvido" conta como resolvido.
  */
  const colunas = useMemo(
    () => ETAPAS_DAS_REDES.map((e) => ({ name: e.nome, color: e.cor })),
    []
  );

  const open = social.filter(isOpen).length;

  const resolved = social.filter(
    (item) => item.status === "Resolvido"
  ).length;

  const semSolucao = social.filter(
    (item) => item.status === "Sem contato" || item.status === "Sem identificação" || item.status === "Encaminhado"
  ).length;

  /* Os que chegaram e ninguém triou — o mais antigo primeiro. */
  const aTriar = useMemo(
    () =>
      todosOsSociais
        .filter((c) => !c.triadaEm && !eFinalDasRedes(c.status))
        .sort((a, b) => (a.recebidaEm ?? a.createdAt).localeCompare(b.recebidaEm ?? b.createdAt)),
    [todosOsSociais]
  );

  const { abrir, janelas, alternarCompleta } = useJanelas();

  function triarProximo() {
    const c = aTriar[0];
    if (!c) return;
    const id = idDaJanela("redes", c.id);
    abrir({ frente: "redes", ref: c.id, titulo: `${c.protocol} · ${c.customer}` });
    if (!janelas.find((j) => j.id === id)?.completa) alternarCompleta(id);
  }

  const [encerrando, setEncerrando] = useState<{ item: Case; status: string } | null>(null);

  function mover(id: string, status: string) {
    if (eFinalDasRedes(status)) {
      const item = todosOsSociais.find((c) => c.id === id);
      if (item) setEncerrando({ item, status });
      return;
    }
    moveCase(id, status);
  }

  async function salvar(data: Case) {

    /*
      O formulário fecha só se o servidor aceitou (Fase 10.4). Fechando
      antes, uma recusa jogava fora o que foi digitado — e o aviso de
      erro aparecia com o formulário já sumido.
    */
    const resultado = editing ? await updateCase(data) : await createCase(data);

    if (!resultado.ok) return;

    setFormOpen(false);
    setEditing(undefined);
  }

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Atendimento"
          title="Redes Sociais"
          description="Instagram, Facebook, WhatsApp e ManyChat, no fluxo do documento das Redes: 1º contato em 4 horas úteis (1 hora acima de 10 mil seguidores)."
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
        {statusFiltrado && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-violet-50/60 px-4 py-3 text-sm ring-1 ring-inset ring-violet-100">

            <Filter size={15} className="text-violet-600" />

            <span className="text-zinc-700">
              Mostrando{" "}
              <strong className="font-semibold">
                {social.length} de {todosOsSociais.length}
              </strong>{" "}
              atendimento(s){statusFiltrado ? ` na etapa ${statusFiltrado}` : ""}.
            </span>

            <button
              type="button"
              onClick={() => trocarFiltros({}, false)}
              className="ml-auto rounded-lg px-2.5 py-1 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100"
            >
              Ver todos
            </button>

          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">

          <StatTile
            label="Total de casos"
            description="Atendimentos registrados vindos do Instagram, Facebook, WhatsApp e ManyChat."
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
            description="Encerrados com a solução confirmada pelo cliente — o único final que conta como resolvido."
            value={resolved}
            hint="validados com o cliente"
            icon={CheckCircle2}
            tone="success"
          />

          <StatTile
            label="Encerrados sem solução"
            description="Sem contato (três tentativas sem resposta), sem identificação ou encaminhados para outra área. Não contam como resolvidos."
            value={semSolucao}
            hint="não contam como resolvidos"
            icon={Camera}
            tone="info"
          />

        </div>

        {/* Os segmentos ficam fora do vazio: um filtro que zerou a tela precisa continuar à mão para ser desfeito. */}
        {todosOsSociais.length > 0 && (
          <SegmentosDasRedes
            facetas={segmentado.facetas}
            total={todosOsSociais.length}
            filtrados={social.length}
            ativos={ativos}
            onAlternar={(dimensao: DimensaoDasRedes, valor: string) => trocarFiltros(alternarFiltro(filtros, dimensao, valor))}
            onLimpar={() => trocarFiltros({}, false)}
          />
        )}

        {loading && social.length === 0 ? (

          /* Sem isto, o quadro dizia "nenhum atendimento" enquanto a lista ainda chegava. */
          <SurfaceCard>
            <p className="py-14 text-center text-sm text-zinc-400">Carregando os atendimentos…</p>
          </SurfaceCard>

        ) : social.length === 0 ? (

          <SurfaceCard>

            <div className="flex flex-col items-center py-14 text-center">

              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-50 text-pink-600 ring-1 ring-inset ring-pink-100">
                <Camera size={24} />
              </span>

              <p className="mt-4 text-sm font-semibold text-zinc-800">
                {recorte ? "Nenhum atendimento neste recorte." : "Nenhum atendimento de rede social registrado."}
              </p>

              <p className="mt-1 max-w-sm text-sm text-zinc-500">
                {recorte
                  ? "Nenhum atendimento passa por todos os filtros escolhidos. Tire um segmento acima, ou limpe os filtros."
                  : "Registre aqui as conversas do Instagram, Facebook, WhatsApp e ManyChat: elas entram no fluxo do documento das Redes, com o relógio de 4 horas úteis."}
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
            {aTriar.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-zinc-200/80 bg-white px-5 py-3">
                <p className="text-sm text-zinc-700">
                  <strong className="font-semibold tabular-nums text-zinc-900">{aTriar.length}</strong> a triar
                  <span className="text-zinc-500"> · o mais antigo chegou {String(aTriar[0].createdAt).slice(0, 10).split("-").reverse().slice(0, 2).join("/")}</span>
                </p>
                <button
                  type="button"
                  onClick={triarProximo}
                  className="ml-auto flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  Triar o mais antigo
                </button>
              </div>
            )}

            <SurfaceCard
              tour="quadro-redes"
              title="Quadro de atendimento"
              description="Arraste um cartão para mover a conversa de etapa."
            >
              <MiniKanban
                cases={social}
                columns={colunas}
                onMove={mover}
                colunaDe={(c) => etapaDasRedes(c.status)?.nome ?? c.status}
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

                    <BotaoAbrirEmJanela
                      frente="redes"
                      referencia={item.id}
                      titulo={`${item.protocol} · ${item.customer}`}
                    />

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

      {encerrando && (
        <EncerrarRedesModal
          item={encerrando.item}
          resultadoInicial={encerrando.status}
          onClose={() => setEncerrando(null)}
          onSalvo={(patch) =>
            setCases((prev) =>
              prev.map((c) => (c.protocol === encerrando.item.protocol ? { ...c, ...patch } : c))
            )
          }
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
