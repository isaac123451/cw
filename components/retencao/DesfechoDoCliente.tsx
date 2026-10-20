"use client";

import { useState } from "react";

import { ChevronDown, Loader2 } from "lucide-react";

import { marcarDesfecho } from "@/lib/actions/retencao";
import { SETORES, type ClienteEmCancelamento, type DesfechoManual } from "@/lib/models/cancelamento";
import { useToast } from "@/lib/context/ToastContext";

import { CLASSE_DO_PAINEL, usePainelPreso } from "./usePainelPreso";

/** O desfecho do cliente, em palavras e cor. */
export function rotuloDoDesfecho(c: ClienteEmCancelamento) {
  if (c.desfecho === "retido") return { texto: "Retido", cor: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  if (c.canceladoPor === "outro-setor") return { texto: c.setor ? `Cancelou · ${c.setor}` : "Cancelou · outro setor", cor: "border-zinc-200 bg-zinc-100 text-zinc-700" };
  if (c.canceladoPor === "prazo") return { texto: "Cancelou no prazo", cor: "border-zinc-200 bg-zinc-100 text-zinc-700" };
  return { texto: "Cancelou", cor: "border-rose-200 bg-rose-50 text-rose-800" };
}

/**
 * O desfecho de um cliente na Retenção, num botão só (20/10/2026): o rótulo
 * diz como terminou; o clique abre as opções — retido, cancelou pelo
 * atendimento, cancelou por outro setor (qual), não pediu, ou voltar à
 * leitura automática.
 */
export default function DesfechoDoCliente({ cliente, onMudou }: { cliente: ClienteEmCancelamento; onMudou: () => void }) {
  const { notify } = useToast();
  const [gravando, setGravando] = useState(false);
  const { aberto, alternar, fechar, botao, painel, estilo } = usePainelPreso(240, 340);
  const { texto, cor } = rotuloDoDesfecho(cliente);

  async function marcar(desfecho: DesfechoManual | null, setor?: string) {
    setGravando(true);
    const r = await marcarDesfecho(cliente.chave, desfecho, setor, cliente.chaves);
    setGravando(false);
    if (!r.ok) {
      notify({ tone: "error", title: "Não foi gravado.", detail: r.erro });
      return;
    }
    fechar();
    notify({
      tone: "success",
      title:
        desfecho === null
          ? `${cliente.nome}: de volta à leitura automática.`
          : desfecho === "nao-e-cancelamento"
            ? `${cliente.nome} saiu da lista.`
            : `${cliente.nome}: ${desfecho === "retido" ? "retido" : desfecho === "cancelado" ? "cancelou pelo atendimento" : `cancelou · ${setor}`}.`,
    });
    onMudou();
  }

  const opcao = "w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-40";

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={alternar}
        aria-haspopup="menu"
        aria-expanded={aberto}
        title={cliente.manual ? "Marcado à mão — clique para mudar" : "Lido automaticamente — clique para corrigir"}
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${cor}`}
      >
        {texto}
        {cliente.manual && <span className="h-1 w-1 rounded-full bg-current opacity-60" aria-label="marcado à mão" />}
        {gravando ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} className="opacity-60" />}
      </button>

      {aberto && (
        <div ref={painel} role="menu" style={estilo} className={CLASSE_DO_PAINEL} onClick={(e) => e.stopPropagation()}>
          <p className="px-2.5 pb-1 pt-0.5 text-xs font-semibold text-zinc-800">Como terminou?</p>
          <button type="button" role="menuitem" disabled={gravando} onClick={() => void marcar("retido")} className={opcao}>
            Retido
          </button>
          <button type="button" role="menuitem" disabled={gravando} onClick={() => void marcar("cancelado")} className={opcao}>
            Cancelou · nosso (conta na taxa)
          </button>
          <p className="px-2.5 pb-0.5 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">Outro setor, dentro da SLA de 24h úteis</p>
          {SETORES.map((setor) => (
            <button key={setor} type="button" role="menuitem" disabled={gravando} onClick={() => void marcar("cancelado-outro-setor", setor)} className={opcao}>
              {setor}
            </button>
          ))}
          <div className="mt-1 border-t border-zinc-100 pt-1">
            <button type="button" role="menuitem" disabled={gravando} onClick={() => void marcar("nao-e-cancelamento")} className={`${opcao} text-zinc-500`}>
              Não pediu para cancelar
            </button>
            {cliente.manual && (
              <button type="button" role="menuitem" disabled={gravando} onClick={() => void marcar(null)} className={`${opcao} text-zinc-500`}>
                Voltar à leitura automática
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
