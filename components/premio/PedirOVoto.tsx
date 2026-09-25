"use client";

import { useState } from "react";

import { BellRing, Loader2, MessageCircle } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { marcarPedidos, pedirVoto, type CampanhaView, type PedidoView } from "@/lib/actions/premio";
import { useToast } from "@/lib/context/ToastContext";
import { DIAS_PARA_LEMBRAR, lembretesDaVez, linkDoWhatsApp, mensagemDaVez, mensagemParaContato, type ContatoDoPremio } from "@/lib/models/premio";

const POR_VEZ = 15;
const br = (iso: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

/**
 * Pedir o voto como se pede avaliação (1.76).
 *
 * O Isaac: "casos indicados para pedir o voto (como o pedir avaliação)".
 * A lista do dia — os indicados com telefone, a melhor lembrança primeiro
 * — e a fila de lembrete. O clique abre o WhatsApp com a mensagem escrita
 * e registra o passo; a linha só sai da lista depois que o servidor
 * confirma. A plataforma não envia nada: quem manda é você.
 */
export default function PedirOVoto({
  campanha,
  indicados,
  pedidos,
  hoje,
  aoRegistrar,
}: {
  campanha: CampanhaView;
  indicados: ContatoDoPremio[];
  pedidos: PedidoView[];
  hoje: string;
  aoRegistrar: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [mostrar, setMostrar] = useState(POR_VEZ);
  const [gravando, setGravando] = useState<string | null>(null);

  const lembrar = lembretesDaVez(pedidos, hoje);
  const semMensagem = !campanha.mensagem?.trim();
  const semLink = !campanha.linkVotacao?.trim();

  async function pedir(c: ContatoDoPremio) {
    const chave = `${c.origem}:${c.ref}`;
    setGravando(chave);
    const r = await pedirVoto(campanha.id, c);
    setGravando(null);
    if (!r.ok) {
      notify({ tone: "error", title: "O pedido não foi registrado.", detail: r.erro });
      return;
    }
    notify({ tone: "success", title: `Pedido registrado: ${c.nome.split(/\s+/)[0]}.`, detail: `Lembrete em ${DIAS_PARA_LEMBRAR} dias, se não votar.` });
    await aoRegistrar();
  }

  async function lembrou(p: PedidoView) {
    setGravando(p.id);
    const r = await marcarPedidos([p.id], "lembrete");
    setGravando(null);
    if (!r.ok) {
      notify({ tone: "error", title: "O lembrete não foi registrado.", detail: r.erro });
      return;
    }
    await aoRegistrar();
  }

  return (
    <SurfaceCard
      title="Pedir o voto"
      description="Os indicados de hoje: quem foi bem atendido, com telefone, a melhor lembrança primeiro. O clique abre o WhatsApp com a mensagem e registra o pedido."
    >
      {(semMensagem || semLink) && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-100">
          {semMensagem ? "A campanha está sem mensagem" : "A campanha está sem o link da votação"} — complete na aba Campanha para o WhatsApp abrir com o texto certo.
        </p>
      )}

      {lembrar.length > 0 && (
        <div className="mb-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            <BellRing size={12} /> Lembrar ({lembrar.length}) · pedidos com {DIAS_PARA_LEMBRAR}+ dias
          </p>
          <ul className="mt-1 divide-y divide-zinc-100">
            {lembrar.slice(0, POR_VEZ).map((p) => {
              const zap = linkDoWhatsApp(p.telefone, mensagemDaVez({ ...p, situacao: "pedido" }, campanha));
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-zinc-800">{p.nome}</span>
                    <span className="text-xs text-zinc-500"> · pedido em {br(p.pedidoEm ?? "")}</span>
                  </span>
                  {zap && (
                    <a
                      href={zap}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => void lembrou(p)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-50"
                    >
                      {gravando === p.id ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />} Lembrar no WhatsApp
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {indicados.length === 0 ? (
        <p className="text-sm text-zinc-500">Ninguém indicado agora: todos os bem atendidos com telefone já estão na campanha.</p>
      ) : (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Indicados ({indicados.length})</p>
          <ul className="mt-1 divide-y divide-zinc-100">
            {indicados.slice(0, mostrar).map((c) => {
              const chave = `${c.origem}:${c.ref}`;
              const zap = linkDoWhatsApp(c.telefoneInternacional, mensagemParaContato(campanha.mensagem ?? "", c, campanha.linkVotacao ?? ""));
              return (
                <li key={chave} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-zinc-800">{c.nome}</span>
                    <span className="text-xs text-zinc-500">
                      {" "}
                      · {c.motivo}
                      {c.data ? ` · ${br(c.data)}` : ""}
                    </span>
                  </span>
                  {zap && (
                    <a
                      href={zap}
                      target="_blank"
                      rel="noreferrer"
                      aria-disabled={gravando === chave}
                      onClick={() => void pedir(c)}
                      className="flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
                    >
                      {gravando === chave ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />} Pedir no WhatsApp
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          {indicados.length > mostrar && (
            <button type="button" onClick={() => setMostrar((m) => m + POR_VEZ)} className="mt-2 text-xs font-medium text-violet-700 hover:underline">
              Mostrar mais {Math.min(POR_VEZ, indicados.length - mostrar)} de {indicados.length - mostrar}
            </button>
          )}
        </>
      )}
    </SurfaceCard>
  );
}
