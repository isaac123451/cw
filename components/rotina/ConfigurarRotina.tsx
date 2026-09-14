"use client";

import { useState } from "react";

import { ArrowDown, ArrowUp, Clock, Loader2, Plus, Save, TriangleAlert } from "lucide-react";

import Modal, { GhostButton, inputClass } from "@/components/shared/Modal";

import { salvarRotina } from "@/lib/actions/rotina";
import { useToast } from "@/lib/context/ToastContext";

import {
  DIAS_DA_SEMANA,
  ROTULO_DA_FREQUENCIA,
  type AtividadeDaRotina,
  type CategoriaDaRotina,
  type ChaveDaRotina,
  type Frequencia,
} from "@/lib/models/rotina";

const CATEGORIAS: CategoriaDaRotina[] = ["Operacional", "Organização", "Demandas Internas", "Gestão"];
const FREQUENCIAS: Frequencia[] = ["diaria", "semanal", "continua"];

const GRUPOS: { f: Frequencia; titulo: string; dica: string }[] = [
  { f: "diaria", titulo: "Diárias", dica: "Todo dia útil" },
  { f: "semanal", titulo: "Semanais", dica: "Nos dias escolhidos" },
  { f: "continua", titulo: "Contínuas", dica: "Conforme a demanda" },
];

/** O que a plataforma conta sozinha para cada atividade — em português, e não o nome interno. */
const O_QUE_CONTA: Record<ChaveDaRotina, string> = {
  metricas: "Mostra os campos da planilha de métricas do dia que faltam.",
  pendencias: "Conta as tarefas da agenda para hoje e as atrasadas.",
  "em-aberto": "Conta os casos em andamento esperando o nosso retorno.",
  novos: "Conta os casos sem 1º contato nas quatro frentes.",
  fups: "Conta os clientes sem notícia há 2 dias úteis.",
  moderacoes: "Conta as moderações pedidas e as paradas há mais de 10 dias.",
  avaliacoes: "Conta os pedidos de avaliação que vencem hoje.",
  ligacoes: "Conta as ligações da cadência de persistência.",
  concluidos: "Conta os casos resolvidos que falta finalizar.",
  areas: "Conta as solicitações às áreas em aberto e as atrasadas.",
  checkpoint: "Monta o texto do checkpoint com a gestão.",
  indicadores: "Atalho para os indicadores.",
  relatorio: "Atalho para o relatório do ciclo.",
  processos: "Atalho para os processos do time.",
  sprint: "Atalho para o planejamento da sprint.",
};

interface Props {
  atividades: AtividadeDaRotina[];
  onClose: () => void;
  onSalvo: (atividades: AtividadeDaRotina[]) => void;
}

function resumo(a: AtividadeDaRotina) {
  return [
    a.frequencia === "semanal"
      ? DIAS_DA_SEMANA.filter((d) => a.diasDaSemana.includes(d.n))
          .map((d) => d.curto)
          .join(", ") || "sem dia"
      : null,
    a.horario ?? null,
    a.duracaoMin ? `${a.duracaoMin} min` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Configurar a rotina: uma linha por atividade, e os campos só da escolhida.
 *
 * Era um cartão por atividade com os seis campos abertos — dezoito
 * cartões para rolar e ler inteiros para mudar um horário. O Isaac:
 * "usabilidade 0". Agora a lista cabe na tela, agrupada como o documento
 * (diárias, semanais, contínuas), com o essencial de cada uma à vista; o
 * clique abre os campos daquela ao lado. Tirar da rotina é o botão da
 * própria linha — desativa, e as marcas antigas ficam.
 */
export default function ConfigurarRotina({ atividades, onClose, onSalvo }: Props) {

  const { notify } = useToast();

  const [lista, setLista] = useState<AtividadeDaRotina[]>(() => atividades.map((a) => ({ ...a })));
  const [selecionada, setSelecionada] = useState<string | null>(atividades[0]?.id ?? null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const original = new Map(atividades.map((a) => [a.id, JSON.stringify(a)]));
  const novas = lista.filter((a) => !original.has(a.id)).length;
  const alteradas = lista.filter((a) => original.has(a.id) && original.get(a.id) !== JSON.stringify(a)).length;
  const reordenou = lista.map((a) => a.id).join() !== atividades.map((a) => a.id).join();
  const mudou = novas + alteradas > 0 || reordenou;

  const atual = lista.find((a) => a.id === selecionada);

  function mudar(id: string, patch: Partial<AtividadeDaRotina>) {
    setLista((l) => l.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    setErro(null);
  }

  /* Sobe ou desce dentro do grupo: troca de lugar com a vizinha de mesma frequência. */
  function mover(id: string, delta: -1 | 1) {
    setLista((l) => {
      const i = l.findIndex((a) => a.id === id);
      if (i < 0) return l;
      let j = i + delta;
      while (j >= 0 && j < l.length && l[j].frequencia !== l[i].frequencia) j += delta;
      if (j < 0 || j >= l.length) return l;
      const nova = [...l];
      [nova[i], nova[j]] = [nova[j], nova[i]];
      return nova;
    });
  }

  function criar(f: Frequencia) {
    const id = `nova-${lista.length}-${f}`;
    setLista((l) => [
      ...l,
      {
        id,
        titulo: "",
        frequencia: f,
        diasDaSemana: f === "semanal" ? [1] : [],
        duracaoMin: 30,
        categoria: "Operacional",
        ordem: l.length,
        ativa: true,
      },
    ]);
    setSelecionada(id);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await salvarRotina(lista.map((a, i) => ({ ...a, ordem: i })));
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      onSalvo(r.atividades);
      notify({
        tone: "success",
        title: "Rotina salva.",
        detail:
          [
            r.criadas ? `${r.criadas} nova(s)` : null,
            r.alteradas ? `${r.alteradas} alterada(s)` : null,
            r.desativadas ? `${r.desativadas} desativada(s)` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Nada mudou.",
      });
      onClose();
    } catch {
      setErro("A rotina não foi salva. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  const campo = "text-[11px] font-semibold uppercase tracking-wide text-zinc-500";

  return (
    <Modal
      open
      porque="rotina.diaria"
      size="xl"
      title="Configurar a rotina"
      description="A rotina do documento é o ponto de partida. Escolha uma atividade para ajustar dia, horário e duração, ou crie as que o time tem."
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-xs text-zinc-500">
            {mudou
              ? [novas ? `${novas} nova(s)` : null, alteradas ? `${alteradas} alterada(s)` : null, reordenou ? "ordem mudou" : null]
                  .filter(Boolean)
                  .join(" · ") + " — por salvar"
              : "Nada mudou ainda."}
          </span>
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <button
            type="button"
            onClick={salvar}
            disabled={!mudou || salvando}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Salvar
          </button>
        </>
      }
    >

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">

        {/* A lista: uma linha por atividade, agrupada como o documento. */}
        <div className="space-y-4">
          {GRUPOS.map((g) => {
            const doGrupo = lista.filter((a) => a.frequencia === g.f);
            return (
              <section key={g.f}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className={campo}>
                    {g.titulo} <span className="font-normal normal-case tracking-normal text-zinc-400">· {g.dica} · {doGrupo.filter((a) => a.ativa).length} ativa(s)</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => criar(g.f)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50"
                  >
                    <Plus size={12} /> Nova
                  </button>
                </div>

                {doGrupo.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-3 text-xs text-zinc-400">Nenhuma atividade {g.titulo.toLowerCase().slice(0, -1)}.</p>
                ) : (
                  <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200">
                    {doGrupo.map((a, i) => {
                      const ativa = a.id === selecionada;
                      return (
                        <li
                          key={a.id}
                          className={`group flex items-center gap-2 px-2.5 py-2 transition-colors ${ativa ? "bg-violet-50/70" : "hover:bg-zinc-50"} ${a.ativa ? "" : "opacity-55"}`}
                        >
                          <span className="flex shrink-0 flex-col opacity-40 group-hover:opacity-100">
                            <button type="button" onClick={() => mover(a.id, -1)} disabled={i === 0} aria-label={`Subir ${a.titulo}`} className="rounded p-0.5 text-zinc-500 hover:text-zinc-800 disabled:invisible">
                              <ArrowUp size={12} />
                            </button>
                            <button type="button" onClick={() => mover(a.id, 1)} disabled={i === doGrupo.length - 1} aria-label={`Descer ${a.titulo}`} className="rounded p-0.5 text-zinc-500 hover:text-zinc-800 disabled:invisible">
                              <ArrowDown size={12} />
                            </button>
                          </span>

                          <button type="button" onClick={() => setSelecionada(a.id)} aria-pressed={ativa} className="min-w-0 flex-1 text-left">
                            <span className={`block truncate text-sm ${ativa ? "font-semibold text-violet-900" : "font-medium text-zinc-800"}`}>
                              {a.titulo || <em className="font-normal text-zinc-400">sem nome</em>}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                              {(a.horario || a.frequencia === "semanal") && <Clock size={10} className="shrink-0" />}
                              {resumo(a) || "sem horário"}
                            </span>
                          </button>

                          {/* Ligar e desligar sem abrir: é a mudança mais comum. */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={a.ativa}
                            aria-label={`${a.ativa ? "Tirar da" : "Pôr na"} rotina: ${a.titulo}`}
                            onClick={() => mudar(a.id, { ativa: !a.ativa })}
                            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${a.ativa ? "bg-violet-600" : "bg-zinc-300"}`}
                          >
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${a.ativa ? "left-[18px]" : "left-0.5"}`} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        {/* Os campos, só da escolhida. */}
        <div className="md:sticky md:top-0 md:self-start">
          {!atual ? (
            <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-400">Escolha uma atividade na lista.</p>
          ) : (
            <div className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/40 p-4">
              <label className="block">
                <span className={campo}>Atividade</span>
                <input
                  value={atual.titulo}
                  onChange={(e) => mudar(atual.id, { titulo: e.target.value })}
                  placeholder="O que fazer"
                  autoFocus={atual.titulo === ""}
                  className={`mt-1 ${inputClass} bg-white`}
                />
              </label>

              <div>
                <span className={campo}>Frequência</span>
                <div className="mt-1 grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1">
                  {FREQUENCIAS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => mudar(atual.id, { frequencia: f, diasDaSemana: f === "semanal" && atual.diasDaSemana.length === 0 ? [1] : atual.diasDaSemana })}
                      aria-pressed={atual.frequencia === f}
                      className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${atual.frequencia === f ? "bg-white text-violet-800 shadow-sm" : "text-zinc-600 hover:text-zinc-800"}`}
                    >
                      {ROTULO_DA_FREQUENCIA[f]}
                    </button>
                  ))}
                </div>
              </div>

              {atual.frequencia === "semanal" && (
                <div>
                  <span className={campo}>Dias</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {DIAS_DA_SEMANA.map((d) => {
                      const on = atual.diasDaSemana.includes(d.n);
                      return (
                        <button
                          key={d.n}
                          type="button"
                          onClick={() => mudar(atual.id, { diasDaSemana: on ? atual.diasDaSemana.filter((x) => x !== d.n) : [...atual.diasDaSemana, d.n].sort() })}
                          aria-pressed={on}
                          title={d.nome}
                          className={`h-8 w-10 rounded-lg text-xs font-medium ring-1 ring-inset transition-colors ${on ? "bg-violet-600 text-white ring-violet-600" : "bg-white text-zinc-500 ring-zinc-200 hover:bg-zinc-50"}`}
                        >
                          {d.curto}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {atual.frequencia !== "continua" && (
                  <label className="block">
                    <span className={campo}>Horário</span>
                    <input
                      type="time"
                      value={atual.horario ?? ""}
                      onChange={(e) => mudar(atual.id, { horario: e.target.value || undefined })}
                      className={`mt-1 ${inputClass} bg-white`}
                    />
                  </label>
                )}
                <label className="block">
                  <span className={campo}>Duração (min)</span>
                  <input
                    inputMode="numeric"
                    value={String(atual.duracaoMin)}
                    onChange={(e) => mudar(atual.id, { duracaoMin: Math.min(480, Number(e.target.value.replace(/\D/g, "") || 0)) })}
                    className={`mt-1 ${inputClass} bg-white`}
                  />
                </label>
              </div>

              <label className="block">
                <span className={campo}>Categoria</span>
                <select value={atual.categoria} onChange={(e) => mudar(atual.id, { categoria: e.target.value as CategoriaDaRotina })} className={`mt-1 ${inputClass} bg-white`}>
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <p className="rounded-xl bg-white px-3 py-2.5 text-xs leading-relaxed text-zinc-600 ring-1 ring-inset ring-zinc-200">
                {atual.chave
                  ? O_QUE_CONTA[atual.chave]
                  : "Atividade sem contagem automática: ela entra no checklist e no plano com a duração acima."}
                {atual.frequencia !== "continua" && " O plano do dia usa a duração para encaixar no expediente."}
              </p>

              {!atual.ativa && <p className="text-xs font-medium text-amber-800">Fora da rotina — ligue na lista para voltar. As marcas antigas continuam guardadas.</p>}
            </div>
          )}
        </div>
      </div>

      {erro && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-100">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}

    </Modal>
  );
}
