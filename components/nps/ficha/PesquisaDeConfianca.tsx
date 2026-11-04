"use client";

import { useEffect, useState } from "react";

import { Check, Copy, Loader2, Undo2 } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { lerConfianca, registrarConfianca, type ConfiancaView } from "@/lib/actions/okr";
import { useToast } from "@/lib/context/ToastContext";
import { PERGUNTA_DE_CONFIANCA, RESPOSTAS_DE_CONFIANCA, type RespostaDeConfianca } from "@/lib/models/okr";
import type { NpsResponseView } from "@/lib/models/nps";
import { descreverRegistro } from "@/lib/services/horasUteis";
import { cn } from "@/lib/utils";

const primeiroNome = (item: NpsResponseView) => (item.customerName ?? "").trim().split(/\s+/)[0] ?? "";

/**
 * A pesquisa de confiança do detrator (04/11/2026) — o KR1 do OKR.
 *
 * Três passos, nesta ordem, e só o próximo fica em destaque: a solução
 * confirmada pelo cliente, a pergunta enviada, a resposta. Sem a
 * confirmação a pergunta fica travada, como o OKR manda ("somente após a
 * confirmação da solução").
 */
export default function PesquisaDeConfianca({ item, confirmar }: { item: NpsResponseView; confirmar: () => void }) {
  const { notify } = useToast();
  const [confianca, setConfianca] = useState<ConfiancaView | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [semTabela, setSemTabela] = useState(false);
  const [gravando, setGravando] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    lerConfianca(item.id).then((r) => {
      if (!vivo) return;
      if (r.ok) {
        setConfianca(r.confianca);
        setSemTabela(Boolean(r.semTabela));
      }
      setCarregado(true);
    });
    return () => {
      vivo = false;
    };
  }, [item.id]);

  const confirmado = Boolean(item.confirmedAt);
  const enviada = Boolean(confianca?.enviadaEm);
  const resposta = confianca?.resposta ?? null;
  const nome = primeiroNome(item);
  const texto = `${nome ? `Olá, ${nome}! ` : "Olá! "}${PERGUNTA_DE_CONFIANCA} Pode responder com Sim, Parcialmente ou Não.`;

  async function gravar(acao: Parameters<typeof registrarConfianca>[1], rotulo: string) {
    setGravando(rotulo);
    try {
      const r = await registrarConfianca(item.id, acao);
      if (!r.ok) {
        notify({ tone: "error", title: "Não foi gravado.", detail: r.erro });
        return;
      }
      setConfianca(r.confianca);
      notify({
        tone: "success",
        title:
          acao.tipo === "desfazer"
            ? "Pesquisa desfeita."
            : acao.tipo === "enviada"
              ? "Pesquisa marcada como enviada."
              : acao.resposta === "sim"
                ? "Confiança recuperada: conta no OKR."
                : "Resposta registrada.",
      });
    } catch {
      notify({ tone: "error", title: "Não deu para falar com o servidor." });
    } finally {
      setGravando(null);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      notify({ tone: "success", title: "Pergunta copiada.", detail: "Cole no WhatsApp e, depois de enviar, marque aqui." });
    } catch {
      notify({ tone: "error", title: "Não deu para copiar. Selecione o texto e copie à mão." });
    }
  }

  const passo = (n: number, feito: boolean, ativo: boolean, titulo: string, detalhe: React.ReactNode, acao?: React.ReactNode) => (
    <li className={cn("flex gap-3 py-2.5", !ativo && !feito && "opacity-55")}>
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
          feito ? "bg-emerald-600 text-white" : ativo ? "bg-violet-700 text-white" : "bg-zinc-200 text-zinc-500"
        )}
      >
        {feito ? <Check size={12} /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900">{titulo}</p>
        <div className="text-xs text-zinc-500">{detalhe}</div>
        {acao && <div className="mt-2">{acao}</div>}
      </div>
    </li>
  );

  const botao = "rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors disabled:opacity-50";

  return (
    <SurfaceCard
      title="Confiança recuperada"
      hint={"KR1 do OKR: conta como sucesso a solução confirmada pelo cliente e o \"Sim\" nesta pesquisa."}
      action={
        confianca && (
          <button type="button" onClick={() => gravar({ tipo: "desfazer" }, "desfazer")} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800" title="Apagar o registro da pesquisa">
            <Undo2 size={13} /> Desfazer
          </button>
        )
      }
    >
      {!carregado ? (
        <p className="text-sm text-zinc-400">Carregando…</p>
      ) : semTabela ? (
        <p className="text-sm text-amber-800">Falta rodar o npm run db:push para guardar a pesquisa de confiança.</p>
      ) : (
        <ol className="divide-y divide-zinc-100">
          {passo(
            1,
            confirmado,
            !confirmado,
            "O cliente confirmou que resolveu",
            confirmado ? descreverRegistro(item.confirmedAt!) : "A pesquisa só vai depois da solução confirmada.",
            !confirmado && (
              <button type="button" onClick={confirmar} className={cn(botao, "bg-violet-700 text-white ring-violet-700 hover:bg-violet-800")}>
                Registrar a confirmação
              </button>
            )
          )}
          {passo(
            2,
            enviada,
            confirmado && !enviada,
            "Pergunta enviada",
            enviada ? `${descreverRegistro(confianca!.enviadaEm!)}${confianca?.por ? ` · ${confianca.por}` : ""}${confianca?.origem === "ia" ? " · pela IA, na conversa" : ""}` : <span className="italic">&ldquo;{texto}&rdquo;</span>,
            confirmado && !enviada && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={copiar} className={cn(botao, "flex items-center gap-1.5 text-zinc-700 ring-zinc-200 hover:bg-zinc-50")}>
                  <Copy size={13} /> Copiar a pergunta
                </button>
                <button type="button" disabled={Boolean(gravando)} onClick={() => gravar({ tipo: "enviada" }, "enviada")} className={cn(botao, "bg-violet-700 text-white ring-violet-700 hover:bg-violet-800")}>
                  {gravando === "enviada" ? <Loader2 size={13} className="animate-spin" /> : "Enviei"}
                </button>
              </div>
            )
          )}
          {passo(
            3,
            Boolean(resposta),
            confirmado && enviada && !resposta,
            resposta ? `Respondeu: ${RESPOSTAS_DE_CONFIANCA.find((r) => r.id === resposta)?.nome}` : "A resposta do cliente",
            resposta
              ? `${descreverRegistro(confianca!.respondidaEm ?? confianca!.enviadaEm!)}${resposta === "sim" ? " · conta no OKR" : " · não conta como recuperada"}`
              : enviada
                ? "Sem resposta até 31/12, fica como recuperação não comprovada."
                : "Depois de enviar a pergunta.",
            confirmado && enviada && !resposta && (
              <div className="flex flex-wrap gap-2">
                {RESPOSTAS_DE_CONFIANCA.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    disabled={Boolean(gravando)}
                    onClick={() => gravar({ tipo: "resposta", resposta: r.id as RespostaDeConfianca }, r.id)}
                    className={cn(
                      botao,
                      r.id === "sim" ? "text-emerald-700 ring-emerald-200 hover:bg-emerald-50" : r.id === "nao" ? "text-rose-700 ring-rose-200 hover:bg-rose-50" : "text-amber-700 ring-amber-200 hover:bg-amber-50"
                    )}
                  >
                    {gravando === r.id ? <Loader2 size={13} className="animate-spin" /> : r.nome}
                  </button>
                ))}
              </div>
            )
          )}
        </ol>
      )}
    </SurfaceCard>
  );
}
