"use client";

import { useState } from "react";

import { Check, Copy } from "lucide-react";

interface Props {
  texto: string;
  rotulo?: string;
  className?: string;
  /** Chamado depois de copiar — para registrar, avisar, fechar. */
  aoCopiar?: () => void;
}

/**
 * Copiar um texto pronto, com a confirmação no próprio botão.
 *
 * A plataforma monta mensagens (acionamento de área, pedido de
 * avaliação, atualização ao cliente) e nunca envia: quem envia é a
 * pessoa, no Slack ou no WhatsApp. Copiar é, então, a ação final — e
 * precisa dizer que funcionou.
 */
export default function BotaoCopiar({ texto, rotulo = "Copiar", className = "", aoCopiar }: Props) {

  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      disabled={!texto.trim()}
      onClick={() => {
        navigator.clipboard?.writeText(texto).then(() => {
          setCopiado(true);
          aoCopiar?.();
          setTimeout(() => setCopiado(false), 1800);
        });
      }}
      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {copiado ? <Check size={14} /> : <Copy size={14} />}
      {copiado ? "Copiado" : rotulo}
    </button>
  );
}
