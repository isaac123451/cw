import Link from "next/link";

import { Bot } from "lucide-react";

/**
 * Leva a pergunta pronta ao assistente (Fase 16, "o agente em mais
 * lugares").
 *
 * A pergunta vai no endereço (`/assistente?pergunta=...`) e o assistente
 * a faz sozinho ao abrir. Quando ela cita um protocolo, o caso inteiro
 * vai junto para o modelo — é o que torna "o que fazer no RA-x?" uma
 * pergunta que ele consegue responder.
 */
export default function PerguntarAoAssistente({
  pergunta,
  rotulo = "Perguntar ao assistente",
  className = "",
}: {
  pergunta: string;
  rotulo?: string;
  className?: string;
}) {
  return (
    <Link
      href={`/assistente?pergunta=${encodeURIComponent(pergunta.slice(0, 500))}`}
      title={`Abre o assistente já perguntando: "${pergunta}"`}
      className={`flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-violet-300 hover:text-violet-700 ${className}`}
    >
      <Bot size={15} />
      {rotulo}
    </Link>
  );
}
