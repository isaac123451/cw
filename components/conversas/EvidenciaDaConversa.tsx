"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { BadgeCheck, Loader2, MessageSquareReply } from "lucide-react";

import PorQue from "@/components/shared/PorQue";

import { useToast } from "@/lib/context/ToastContext";

import { evidenciaDoCaso, registrarEvidencia } from "@/lib/actions/conversas";
import { evidenciaDaConversa, type ConversaView, type MensagemView } from "@/lib/models/conversa";
import { descreverRegistro } from "@/lib/services/horasUteis";

type CasoDaEvidencia = { protocolo: string; frente: string; primeiroContatoEm?: string; validadoEm?: string };

/**
 * A conversa como evidência do processo.
 *
 * Com a conversa ligada a um caso, ela prova passos da trilha: a nossa
 * primeira mensagem que teve resposta é o 1º contato; a mensagem do
 * cliente que diz "voltou, obrigado" é a validação. A tela oferece só o
 * que o caso ainda não tem, com a hora da própria mensagem — um clique
 * grava pelo mesmo caminho do "Registrar contato" da ficha. A validação
 * sugerida é sugestão: qualquer mensagem do cliente pode ser marcada
 * como a confirmação (o botão aparece ao passar o mouse no balão).
 */
export function useEvidencia(conversa: ConversaView) {
  const { notify } = useToast();
  const [caso, setCaso] = useState<CasoDaEvidencia | null>(null);
  const [gravando, setGravando] = useState<string | null>(null);
  const chaveDoCaso = conversa.caso?.id ?? "";

  useEffect(() => {
    if (!chaveDoCaso) return;
    let vivo = true;
    evidenciaDoCaso(conversa.id).then((r) => vivo && r.ok && setCaso(r.caso));
    return () => {
      vivo = false;
    };
  }, [conversa.id, chaveDoCaso]);

  async function marcar(m: MensagemView, tipo: "contato" | "validacao") {
    setGravando(m.id);
    try {
      const r = await registrarEvidencia({ conversaId: conversa.id, mensagemId: m.id, tipo });
      if (!r.ok) return notify({ tone: "error", title: "O passo não foi registrado", detail: r.erro });
      const agora = await evidenciaDoCaso(conversa.id);
      if (agora.ok) setCaso(agora.caso);
      notify({
        tone: "success",
        title: tipo === "contato" ? `1º contato registrado em ${r.protocolo}` : `Validação registrada em ${r.protocolo}`,
        detail: `Com a hora da mensagem: ${descreverRegistro(m.em)}.`,
      });
    } catch {
      notify({ tone: "error", title: "Sem resposta do servidor", detail: "O passo não foi registrado." });
    } finally {
      setGravando(null);
    }
  }

  const ligado = conversa.caso && caso && caso.protocolo === conversa.caso.protocolo ? caso : null;
  return { caso: ligado, gravando, marcar };
}

export default function EvidenciaDaConversa({
  conversa,
  caso,
  gravando,
  marcar,
}: {
  conversa: ConversaView;
  caso: CasoDaEvidencia | null;
  gravando: string | null;
  marcar: (m: MensagemView, tipo: "contato" | "validacao") => void;
}) {
  if (!conversa.caso) return null;
  if (!caso) {
    return (
      <p className="flex items-center gap-2 border-b border-zinc-100 px-5 py-2.5 text-xs text-zinc-400">
        <Loader2 size={12} className="animate-spin" /> Conferindo o que a conversa prova no caso…
      </p>
    );
  }

  const { primeiroContato, validacaoSugerida } = evidenciaDaConversa(conversa.lista);
  const faltaContato = !caso.primeiroContatoEm && primeiroContato;
  const faltaValidacao = !caso.validadoEm && validacaoSugerida;
  const link = `/${caso.frente === "Reclame Aqui" ? "reclame-aqui" : "redes-sociais"}/${encodeURIComponent(caso.protocolo)}`;

  return (
    <section aria-label="Evidência" className="space-y-2 border-b border-zinc-100 px-5 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">O que esta conversa prova em {caso.protocolo}</p>
        <PorQue chave={caso.frente === "Reclame Aqui" ? "ra.primeiro-contato" : "redes.primeiro-contato"} />
      </div>
      <ul className="space-y-1.5 text-sm">
        <li className="flex flex-wrap items-center gap-2">
          <MessageSquareReply size={14} className="text-violet-500" />
          {caso.primeiroContatoEm ? (
            <span className="text-zinc-600">
              1º contato já registrado: <strong>{descreverRegistro(caso.primeiroContatoEm)}</strong>
            </span>
          ) : faltaContato ? (
            <>
              <span className="text-zinc-700">
                1º contato: a nossa mensagem de <strong>{descreverRegistro(primeiroContato!.em)}</strong>, que teve resposta.
              </span>
              <button
                type="button"
                disabled={gravando === primeiroContato!.id}
                onClick={() => marcar(primeiroContato!, "contato")}
                className="rounded-lg bg-violet-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
              >
                Registrar no caso
              </button>
            </>
          ) : (
            <span className="text-zinc-500">Nenhuma mensagem nossa com resposta do cliente ainda — seria tentativa, não 1º contato.</span>
          )}
        </li>
        <li className="flex flex-wrap items-center gap-2">
          <BadgeCheck size={14} className="text-emerald-600" />
          {caso.validadoEm ? (
            <span className="text-zinc-600">
              Validação já registrada: <strong>{descreverRegistro(caso.validadoEm)}</strong>
            </span>
          ) : faltaValidacao ? (
            <>
              <span className="text-zinc-700">
                Validação provável: &ldquo;{validacaoSugerida!.texto.slice(0, 80)}&rdquo; ({descreverRegistro(validacaoSugerida!.em)}).
              </span>
              <button
                type="button"
                disabled={gravando === validacaoSugerida!.id}
                onClick={() => marcar(validacaoSugerida!, "validacao")}
                className="rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                É a confirmação
              </button>
            </>
          ) : (
            <span className="text-zinc-500">Sem confirmação clara do cliente. Se uma mensagem dele for a confirmação, marque no balão.</span>
          )}
        </li>
      </ul>
      <p className="text-[11px] text-zinc-400">
        Grava na{" "}
        <Link href={link} className="underline underline-offset-2 hover:text-zinc-600">
          ficha do caso
        </Link>{" "}
        como contato por WhatsApp, com a hora da mensagem e o trecho citado.
      </p>
    </section>
  );
}
