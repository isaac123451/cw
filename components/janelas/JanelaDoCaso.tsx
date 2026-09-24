"use client";

import { useMemo, useState } from "react";

import { useRascunhoNaJanela } from "@/lib/context/rascunhosDasJanelas";

import { Loader2, Save, ShieldAlert, StickyNote } from "lucide-react";

import Combobox from "@/components/shared/Combobox";
import DonoDaCausa from "@/components/causas/DonoDaCausa";
import CausaSugerida from "@/components/causas/CausaSugerida";
import { useTratativa } from "@/components/reclame-aqui/tratativa/TratativaProvider";

import { useCases } from "@/lib/context/CaseContext";
import { useWorkflow } from "@/lib/context/WorkflowContext";
import { useSettings } from "@/lib/context/SettingsContext";
import { useTeams } from "@/lib/context/TeamsContext";
import { useNps } from "@/lib/context/NpsContext";
import { useToast } from "@/lib/context/ToastContext";

import { addCaseNote } from "@/lib/actions/notes";

import { PRIORIDADES, type Case, type Prioridade } from "@/lib/models/case";
import { ETAPAS_DAS_REDES, eFinalDasRedes } from "@/lib/models/redes";
import { moverPara } from "@/lib/services/case.service";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

/**
 * A reclamação (ou o atendimento das redes) numa mini-janela.
 *
 * **O que cabe aqui é o que se muda no meio do dia**: etapa, prioridade,
 * responsável, categoria, causa raiz, a marca de retenção e uma anotação.
 * O resto — relato inteiro, trilha, resposta pública, encerramento com
 * validação — continua na ficha, a um clique no cabeçalho. Um formulário
 * comprido dentro de uma janela pequena é o que o Isaac pediu para não
 * existir.
 *
 * **Salvar grava só o que mudou**, pelo mesmo caminho da ficha
 * (\`updateCase\`) — então vale a proteção da Fase 10.1: se outra pessoa
 * mexeu no mesmo campo enquanto a janela estava aberta, nada é gravado e
 * a janela diz qual campo. O "salvo" só aparece com a resposta do
 * servidor.
 */

type Rascunho = Partial<Pick<Case, "status" | "priority" | "owner" | "category" | "causaRaiz" | "churnRisk">>;

const rotulo = "text-[10px] font-semibold uppercase tracking-wide text-zinc-400";
const campo =
  "h-8 w-full rounded-lg border border-zinc-200 bg-white px-2 text-[13px] text-zinc-800 outline-none transition-colors focus:border-violet-400";

export default function JanelaDoCaso({
  id,
  frente,
}: {
  id: string;
  frente: "reclame-aqui" | "redes";
}) {

  const { cases, updateCase, loading } = useCases();
  const { workflow } = useWorkflow();
  const { categories } = useSettings();
  const { people } = useTeams();
  const { rootCauses } = useNps();
  const { abrirArea } = useTratativa();
  const { notify } = useToast();

  const caso = cases.find((item) => item.id === id);

  const [rascunho, setRascunho] = useState<Rascunho>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nota, setNota] = useState("");
  const [anotando, setAnotando] = useState(false);

  /* Algo digitado e não salvo: a moldura pede confirmação para fechar. */
  useRascunhoNaJanela(
    nota.trim() !== "" ||
      (Object.keys(rascunho) as (keyof Rascunho)[]).some((k) => (rascunho[k] ?? "") !== (caso?.[k] ?? ""))
  );

  const etapas = useMemo(() => {
    if (frente === "redes") {
      return ETAPAS_DAS_REDES.filter((e) => !e.final).map((e) => e.nome);
    }
    return workflow
      .filter((s) => s.active)
      .sort((a, b) => a.order - b.order)
      .map((s) => s.name);
  }, [frente, workflow]);

  if (!caso) {
    return (
      <p className="px-4 py-6 text-sm text-zinc-500">
        {loading
          ? "Carregando o caso…"
          : "Este caso não está mais na base — pode ter sido excluído. Feche a janela."}
      </p>
    );
  }

  const valor = <K extends keyof Rascunho>(k: K): Case[K] =>
    (k in rascunho ? rascunho[k] : caso[k]) as Case[K];

  const mudou = (Object.keys(rascunho) as (keyof Rascunho)[]).filter(
    (k) => (rascunho[k] ?? "") !== (caso[k] ?? "")
  );

  const encerrado = frente === "redes" && eFinalDasRedes(caso.status);

  function alterar(mudanca: Rascunho) {
    setErro(null);
    setRascunho((atual) => ({ ...atual, ...mudanca }));
  }

  async function salvar() {
    if (!caso || mudou.length === 0) return;

    setSalvando(true);
    setErro(null);

    /*
      Trocar a etapa passa por `moverPara`, a mesma regra do arrasto no
      quadro: "Resolvido" e "Não resolvido" mexem em campos que dependem
      da etapa, e trocar só o texto deixaria o indicador divergente do
      quadro.
    */
    const base =
      "status" in rascunho && rascunho.status && rascunho.status !== caso.status
        ? moverPara(caso, rascunho.status, hojeNaOperacao())
        : caso;

    const resultado = await updateCase({ ...base, ...rascunho, status: base.status });

    setSalvando(false);

    if (!resultado.ok) {
      setErro(resultado.erro ?? "A alteração não foi salva.");
      return;
    }

    setRascunho({});
    notify({ tone: "success", title: `${caso.protocol} salvo.`, detail: `${mudou.length} campo(s) gravado(s).` });
  }

  async function anotar() {
    if (!caso || !nota.trim()) return;
    setAnotando(true);
    try {
      const criada = await addCaseNote(caso.protocol, nota);
      if (!criada) throw new Error("O servidor não aceitou a anotação.");
      setNota("");
      notify({ tone: "success", title: "Anotação gravada.", detail: caso.protocol });
    } catch (e) {
      notify({
        tone: "error",
        title: "A anotação não foi gravada.",
        detail: e instanceof Error ? e.message : "Tente de novo.",
      });
    } finally {
      setAnotando(false);
    }
  }

  const responsaveis = [...new Set([...(caso.owner ? [caso.owner] : []), ...people.map((p) => p.name)])].sort();
  const categorias = [...new Set([...categories.filter((c) => c.active).map((c) => c.name), caso.category].filter(Boolean))];
  const causas = [...new Set([...rootCauses.filter((c) => c.active).map((c) => c.name), ...(caso.causaRaiz ? [caso.causaRaiz] : [])])];

  return (
    <div className="space-y-3 px-4 py-3">

      <div>
        <p className="text-[11px] text-zinc-400">
          {caso.protocol} · {caso.customer}
          {caso.company && caso.company !== caso.customer ? ` · ${caso.company}` : ""}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug text-zinc-800">{caso.title}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 block">
          <span className={rotulo}>Etapa</span>
          {encerrado ? (
            <p className="mt-1 text-[13px] text-zinc-600">
              {caso.status} — reabrir pela ficha (o encerramento guarda a validação).
            </p>
          ) : (
            <select
              value={valor("status")}
              onChange={(e) => alterar({ status: e.target.value })}
              className={`${campo} mt-1`}
            >
              {[...new Set([caso.status, ...etapas])].map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
          )}
          {frente === "redes" && !encerrado && (
            <span className="mt-1 block text-[11px] text-zinc-400">
              Resolvido, sem contato e sem identificação se encerram pela ficha: pedem a validação do documento.
            </span>
          )}
        </label>

        <label className="block">
          <span className={rotulo}>Prioridade</span>
          <select
            value={valor("priority")}
            onChange={(e) => alterar({ priority: e.target.value as Prioridade })}
            className={`${campo} mt-1`}
          >
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={rotulo}>Responsável</span>
          <select
            value={valor("owner") ?? ""}
            onChange={(e) => alterar({ owner: e.target.value || undefined })}
            className={`${campo} mt-1`}
          >
            <option value="">Sem responsável</option>
            {responsaveis.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={rotulo}>Categoria</span>
          <select
            value={valor("category")}
            onChange={(e) => alterar({ category: e.target.value })}
            className={`${campo} mt-1`}
          >
            {categorias.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </select>
        </label>

        <div className="block">
          <span className={rotulo}>Causa raiz</span>
          <div className="mt-1">
            <Combobox
              value={valor("causaRaiz") ?? ""}
              onChange={(causaRaiz) => alterar({ causaRaiz: causaRaiz || undefined })}
              emptyLabel="Não definida"
              placeholder="Não definida"
              options={causas}
            />
            <DonoDaCausa causa={valor("causaRaiz")} onAcionar={(area) => abrirArea(caso, { area, causa: valor("causaRaiz") })} />
            <CausaSugerida texto={`${caso.title}\n${caso.description ?? ""}`} atual={valor("causaRaiz")} onUsar={(causaRaiz) => alterar({ causaRaiz })} />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => alterar({ churnRisk: !valor("churnRisk") })}
        className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition-colors ${
          valor("churnRisk")
            ? "bg-rose-50 text-rose-700 ring-rose-100 hover:bg-rose-100"
            : "text-zinc-500 ring-zinc-200 hover:bg-zinc-50"
        }`}
      >
        <ShieldAlert size={12} />
        {valor("churnRisk") ? "Risco de cancelamento (clique para tirar)" : "Marcar risco de cancelamento"}
      </button>

      {mudou.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 ring-1 ring-violet-100">
          <span className="flex-1 text-xs text-violet-800">{mudou.length} alteração(ões) por salvar</span>
          <button
            type="button"
            onClick={() => {
              setRascunho({});
              setErro(null);
            }}
            disabled={salvando}
            className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-white"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-1.5 rounded-lg bg-violet-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-60"
          >
            {salvando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Salvar
          </button>
        </div>
      )}

      {erro && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">{erro}</p>}

      <div className="border-t border-zinc-100 pt-3">
        <span className={rotulo}>Anotação</span>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          placeholder="O que aconteceu, o que falta — fica no histórico do caso."
          className="mt-1 w-full resize-y rounded-lg border border-zinc-200 px-2 py-1.5 text-[13px] outline-none focus:border-violet-400"
        />
        <button
          type="button"
          onClick={anotar}
          disabled={anotando || !nota.trim()}
          className="mt-1 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 hover:bg-violet-50 disabled:opacity-50"
        >
          {anotando ? <Loader2 size={12} className="animate-spin" /> : <StickyNote size={12} />}
          Anotar
        </button>
      </div>

    </div>
  );
}
