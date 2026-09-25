"use client";

import { useMemo, useState } from "react";

import { MessageCircle } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { marcarPedidos, type CampanhaView, type PedidoView } from "@/lib/actions/premio";
import { useToast } from "@/lib/context/ToastContext";
import { linkDoWhatsApp, mensagemDaVez, ORDEM_DA_SITUACAO, resumoDaCampanha, ROTULO_DA_SITUACAO, type SituacaoDoVoto } from "@/lib/models/premio";

/** O próximo passo de cada situação — o que o botão principal da linha faz. */
const PROXIMO: Record<SituacaoDoVoto, SituacaoDoVoto | null> = { exportado: "pedido", pedido: "lembrete", lembrete: "votou", votou: null };
const ROTULO_DO_PROXIMO: Record<SituacaoDoVoto, string> = { exportado: "Pedido feito", pedido: "Lembrete feito", lembrete: "Disse que votou", votou: "" };

/**
 * A campanha de votação (Fase 23): quem pedir, o pedido, o lembrete e
 * quem disse que votou.
 *
 * O painel conta cada passo. Cada pessoa tem a mensagem da vez aberta no
 * WhatsApp com um clique (o pedido, e depois o lembrete) e o botão que
 * registra o passo. A plataforma não envia nada: abre a conversa com o
 * texto escrito, e quem manda é você.
 */
export default function CampanhaDeVotacao({ campanha, pedidos, recarregar }: { campanha: CampanhaView; pedidos: PedidoView[]; recarregar: () => Promise<void> }) {

  const { notify } = useToast();
  const [ver, setVer] = useState<SituacaoDoVoto | "todos">("exportado");
  const [marcados, setMarcados] = useState<string[]>([]);
  const [gravando, setGravando] = useState(false);

  const resumo = resumoDaCampanha(pedidos);
  const visiveis = useMemo(() => (ver === "todos" ? pedidos : pedidos.filter((p) => p.situacao === ver)), [pedidos, ver]);

  async function marcar(ids: string[], situacao: SituacaoDoVoto) {
    setGravando(true);
    const r = await marcarPedidos(ids, situacao);
    setGravando(false);
    if (!r.ok) {
      notify({ tone: "error", title: "Não foi registrado.", detail: r.erro });
      return;
    }
    setMarcados([]);
    await recarregar();
  }

  if (pedidos.length === 0) {
    return (
      <SurfaceCard title="A campanha de votação" description="Quem já foi exportado aparece aqui, para registrar o pedido, o lembrete e quem votou.">
        <p className="text-sm text-zinc-500">Ninguém na campanha ainda — baixe a planilha acima e as pessoas entram aqui.</p>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard
      title="A campanha de votação"
      description="A mensagem da vez abre no WhatsApp já escrita; depois de mandar, registre o passo. Nada é enviado pela plataforma."
    >
      {/* O painel: cada passo, e a taxa de quem votou entre quem recebeu o pedido. */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 sm:grid-cols-5">
        {ORDEM_DA_SITUACAO.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setVer(s)}
            aria-pressed={ver === s}
            className={`bg-white px-3 py-2 text-left hover:bg-zinc-50 ${ver === s ? "ring-2 ring-inset ring-violet-300" : ""}`}
          >
            <p className="text-lg font-semibold tabular-nums text-zinc-900">{resumo[s]}</p>
            <p className="text-xs text-zinc-500">{ROTULO_DA_SITUACAO[s]}</p>
          </button>
        ))}
        <div className="bg-white px-3 py-2">
          <p className="text-lg font-semibold tabular-nums text-emerald-700">{Math.round(resumo.taxaDeVoto * 100)}%</p>
          <p className="text-xs text-zinc-500">votaram, de quem recebeu o pedido</p>
        </div>
      </div>

      <div className="mt-3 flex min-h-9 flex-wrap items-center gap-2 text-xs">
        <button type="button" onClick={() => setVer("todos")} aria-pressed={ver === "todos"} className={`rounded-md px-2 py-1 font-medium ${ver === "todos" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>
          Todos ({resumo.total})
        </button>
        {marcados.length > 0 && (
          <>
            <span className="ml-2 font-medium tabular-nums text-zinc-700">{marcados.length} marcado(s):</span>
            {(["pedido", "lembrete", "votou"] as const).map((s) => (
              <button key={s} type="button" disabled={gravando} onClick={() => marcar(marcados, s)} className="rounded-md px-2 py-1 font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50">
                {ROTULO_DA_SITUACAO[s]}
              </button>
            ))}
            <button type="button" disabled={gravando} onClick={() => marcar(marcados, "exportado")} className="rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50">
              voltar para a pedir
            </button>
          </>
        )}
      </div>

      <ul className="mt-2 divide-y divide-zinc-100">
        {visiveis.slice(0, 200).map((p) => {
          const texto = mensagemDaVez(p, campanha);
          const zap = linkDoWhatsApp(p.telefone, texto);
          const proximo = PROXIMO[p.situacao];
          return (
            <li key={p.id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <input
                id={`pedido-${p.id}`}
                type="checkbox"
                checked={marcados.includes(p.id)}
                onChange={(e) => setMarcados((m) => (e.target.checked ? [...m, p.id] : m.filter((x) => x !== p.id)))}
                aria-label={`Marcar ${p.nome}`}
                className="h-4 w-4 accent-violet-600"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-800">{p.nome}</p>
                <p className="truncate text-xs text-zinc-500">
                  {[p.telefone ?? "sem telefone", p.motivo, ROTULO_DA_SITUACAO[p.situacao]].filter(Boolean).join(" · ")}
                </p>
              </div>
              {zap ? (
                <a
                  href={zap}
                  target="_blank"
                  rel="noreferrer"
                  /* Abrir o WhatsApp já registra o passo (1.76): antes eram dois cliques, e o segundo se esquecia. */
                  onClick={() => proximo && proximo !== "votou" && void marcar([p.id], proximo)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                >
                  <MessageCircle size={13} /> {p.situacao === "exportado" ? "Pedir no WhatsApp" : "Lembrar no WhatsApp"}
                </a>
              ) : (
                p.situacao !== "votou" && <span className="text-xs text-zinc-400">{p.telefone ? "escreva a mensagem na campanha" : "sem telefone"}</span>
              )}
              {proximo && (
                <button type="button" disabled={gravando} onClick={() => marcar([p.id], proximo)} className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">
                  {ROTULO_DO_PROXIMO[p.situacao]}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {visiveis.length > 200 && <p className="mt-1 text-xs text-zinc-400">Mostrando 200 de {visiveis.length}: marque em lote pelos passos acima.</p>}
    </SurfaceCard>
  );
}
