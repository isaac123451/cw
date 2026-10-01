"use client";

import { ExternalLink, MessageCircleWarning } from "lucide-react";

import { useAgora } from "@/lib/hooks/useAgora";
import { useEsperaNoWhatsapp } from "@/lib/hooks/useEsperaNoWhatsapp";
import {
  linkDaConversa,
  nomeDe,
  ordenarEspera,
  retratoValido,
  rotuloDaEspera,
  ESPERA_LONGA_MIN,
  type TomDaEtiqueta,
} from "@/lib/models/esperaNoWhatsapp";

const COR_DO_TOM: Record<TomDaEtiqueta, string> = {
  perigo: "bg-rose-50 text-rose-700 ring-rose-200",
  atencao: "bg-amber-50 text-amber-800 ring-amber-200",
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  neutro: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/**
 * Quem está esperando resposta no WhatsApp (1.121).
 *
 * "Não vi ainda como consigo visualizar as não respondidas" (01/10/2026):
 * a lista que a extensão lê do WhatsApp Web a cada minuto (1.108) só
 * aparecia misturada nos itens do Meu dia. Aqui ela é a lista, na ordem da
 * prioridade — reclamação aberta ou detrator primeiro, depois quem espera
 * há mais tempo —, e cada uma abre direto a conversa.
 */
export default function EsperandoResposta() {
  const retrato = useEsperaNoWhatsapp();
  const agora = useAgora();

  if (!agora) return null;

  const lidoEm = retrato?.lidoEm;
  const valido = retratoValido(retrato, agora);
  const conversas = valido ? ordenarEspera(retrato.conversas) : [];

  return (
    <section className="rounded-3xl border border-zinc-200/80 bg-white p-4" aria-label="Esperando resposta no WhatsApp">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <MessageCircleWarning size={16} className="text-amber-600" />
          Esperando resposta
          {conversas.length > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">{conversas.length}</span>}
        </h2>
        <p className="text-xs text-zinc-500">
          {retrato ? `Lido do WhatsApp Web às ${hora(retrato.lidoEm)} pela extensão` : "Lido do WhatsApp Web pela extensão, a cada minuto"}
        </p>
      </div>

      {!retrato ? (
        <p className="mt-2 text-sm text-zinc-500">
          A extensão ainda não mandou a lista. Com o WhatsApp Web aberto e a extensão ligada, quem está esperando resposta aparece aqui.
        </p>
      ) : !valido ? (
        <p className="mt-2 text-sm text-zinc-500">
          A última leitura é das {lidoEm ? hora(lidoEm) : "—"} — o WhatsApp Web parece fechado. Abra-o com a extensão ligada para atualizar.
        </p>
      ) : conversas.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">Ninguém esperando resposta agora.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100">
          {conversas.map((c) => (
            <li key={c.chave} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900">
                  {nomeDe(c)}
                  {c.nome && c.telefone && <span className="ml-2 text-xs font-normal tabular-nums text-zinc-400">{c.telefone}</span>}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className={c.minutos >= ESPERA_LONGA_MIN ? "font-medium text-amber-800" : "text-zinc-500"}>{rotuloDaEspera(c.minutos)}</span>
                  {c.etiquetas.map((e) => (
                    <span key={e.rotulo} className={`rounded-full px-1.5 py-0.5 text-[11px] ring-1 ring-inset ${COR_DO_TOM[e.tom]}`}>
                      {e.rotulo}
                    </span>
                  ))}
                </p>
              </div>
              <a
                href={linkDaConversa(c)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 transition-colors hover:bg-violet-50"
              >
                Abrir a conversa <ExternalLink size={12} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
