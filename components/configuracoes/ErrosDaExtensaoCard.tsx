"use client";

import { useEffect, useState } from "react";

import { Check, ChevronRight } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import { lerErrosDaExtensao, resolverErroDaExtensao, type ErroDaExtensaoView } from "@/lib/actions/errosDaExtensao";
import { useToast } from "@/lib/context/ToastContext";

const quando = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`;

/**
 * Os erros que a extensão relatou (21/10/2026) — onde, quantas vezes, a
 * última vez e a pilha ao abrir. "Resolvido" tira da lista; se voltar a
 * acontecer, ele reaparece.
 */
export default function ErrosDaExtensaoCard() {
  const { notify } = useToast();
  const [lista, setLista] = useState<ErroDaExtensaoView[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    lerErrosDaExtensao().then((r) => vivo && setLista(r.ok ? r.lista : []));
    return () => {
      vivo = false;
    };
  }, []);

  async function resolver(e: ErroDaExtensaoView) {
    const r = await resolverErroDaExtensao(e.id);
    if (!r.ok) {
      notify({ tone: "error", title: "Não foi possível.", detail: r.erro });
      return;
    }
    setLista((l) => (l ?? []).filter((x) => x.id !== e.id));
  }

  return (
    <SurfaceCard
      title="Erros da extensão"
      description="O que quebrou na extensão nos últimos 30 dias — no WhatsApp, no Reclame Aqui, no Slack ou no fundo. Sem dado de cliente."
    >
      {lista === null ? (
        <p className="text-sm text-zinc-500">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhum erro relatado.</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {lista.map((e) => (
            <li key={e.id} className="py-2.5">
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => setAberto(aberto === e.id ? null : e.id)}
                  className="mt-0.5 rounded p-0.5 text-zinc-400 hover:bg-zinc-100"
                  aria-label={aberto === e.id ? "Esconder a pilha" : "Ver a pilha"}
                >
                  <ChevronRight size={14} className={`transition-transform ${aberto === e.id ? "rotate-90" : ""}`} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-800" title={e.mensagem}>
                    {e.mensagem}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {e.onde} · {e.vezes}× · última {quando(e.ultimaEm)} · versão {e.versao}
                    {e.quem ? ` · ${e.quem}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void resolver(e)}
                  title="Resolvido — sai da lista; volta se acontecer de novo"
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
                >
                  <Check size={12} /> Resolvido
                </button>
              </div>
              {aberto === e.id && e.pilha && <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-zinc-50 p-2.5 text-[11px] leading-relaxed text-zinc-600">{e.pilha}</pre>}
            </li>
          ))}
        </ul>
      )}
    </SurfaceCard>
  );
}
