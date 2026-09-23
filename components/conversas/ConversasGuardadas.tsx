"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { MessageCircle } from "lucide-react";

import { conversasGuardadasDe } from "@/lib/actions/conversas";
import type { ConversaDoRegistro } from "@/lib/services/conversas.service";
import { descreverRegistro } from "@/lib/services/horasUteis";

/** As conversas guardadas de um caso, de um ciclo de NPS ou de uma conta — carregadas uma vez por registro. */
export function useConversasGuardadas(alvo: { protocolo?: string; npsId?: string; estabelecimentoId?: string }) {
  const [conversas, setConversas] = useState<ConversaDoRegistro[]>([]);
  const chave = `${alvo.protocolo ?? ""}|${alvo.npsId ?? ""}|${alvo.estabelecimentoId ?? ""}`;
  useEffect(() => {
    const [protocolo, npsId, estabelecimentoId] = chave.split("|");
    if (!protocolo && !npsId && !estabelecimentoId) return;
    let vivo = true;
    conversasGuardadasDe({ protocolo: protocolo || undefined, npsId: npsId || undefined, estabelecimentoId: estabelecimentoId || undefined })
      .then((r) => vivo && r.ok && setConversas(r.conversas))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [chave]);
  return conversas;
}

/**
 * "Conversas do WhatsApp" na ficha do caso e do NPS.
 *
 * Some quando não há conversa guardada — um cartão vazio em cada ficha
 * avisaria de uma ausência que não é problema. Com conversa, mostra de
 * quem é, quantas mensagens, a última fala do cliente e o link para
 * abrir a conversa inteira.
 */
export default function ConversasGuardadas({
  protocolo,
  npsId,
  estabelecimentoId,
  className = "",
}: {
  protocolo?: string;
  npsId?: string;
  estabelecimentoId?: string;
  className?: string;
}) {
  const conversas = useConversasGuardadas({ protocolo, npsId, estabelecimentoId });
  if (conversas.length === 0) return null;

  return (
    <section aria-label="Conversas do WhatsApp guardadas" className={`rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        <MessageCircle size={13} className="text-emerald-600" /> Conversas do WhatsApp
      </p>
      <ul className="mt-2 space-y-2">
        {conversas.map((c) => (
          <li key={c.id}>
            <Link href={`/conversas?id=${encodeURIComponent(c.id)}`} className="block rounded-xl px-3 py-2 ring-1 ring-inset ring-zinc-100 transition-colors hover:bg-zinc-50">
              <span className="flex items-center justify-between gap-2 text-sm font-medium text-zinc-900">
                <span className="truncate">{c.contatoNome}</span>
                <span className="shrink-0 text-[11px] font-normal text-zinc-400">{c.mensagens} msg</span>
              </span>
              {c.ultimaDoCliente && (
                <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-500">
                  &ldquo;{c.ultimaDoCliente.texto}&rdquo; {c.ultimaDoCliente.em ? `· ${descreverRegistro(c.ultimaDoCliente.em)}` : ""}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
