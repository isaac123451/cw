"use client";

import { ScanSearch } from "lucide-react";

import { usePortal } from "@/lib/context/PortalContext";
import { useToast } from "@/lib/context/ToastContext";

/**
 * "Ler o Reclame Aqui": a leitura do portal na hora.
 *
 * **O pedido.** "Só verifique a página do Reclame Aqui da Cardápio
 * somente quando eu abra a plataforma, crie um botão de
 * atualizar/leitura." A leitura ao abrir é do `PortalProvider`; este é o
 * botão.
 *
 * Diferente do "Atualizar" ao lado, que relê o **banco**: este vai ao
 * **portal**, pela extensão, e traz o que ainda não está no quadro. A
 * hora ao lado é a da última leitura do portal — e quando ela falhou
 * (verificação do Cloudflare, extensão sem sessão), o botão fica âmbar e
 * o motivo está no `title`.
 */
export default function LerPortalButton() {

  const { extensao, estado, lendo, ler } = usePortal();
  const { notify } = useToast();

  const ausente = extensao === "ausente";
  const problema = !lendo && estado?.ok === false;

  const hora = estado?.em
    ? new Date(estado.em).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : "";

  const titulo = ausente
    ? "A extensão CW Reputação não está nesta página — sem ela, o portal não é lido."
    : problema
      ? estado?.erro ?? "A última leitura falhou."
      : hora
        ? `Última leitura do Reclame Aqui às ${hora}. Clique para ler de novo.`
        : "Ler agora a lista pública da Cardápio Web no Reclame Aqui.";

  function clicar() {

    if (ausente) {
      notify({
        tone: "info",
        title: "A leitura do Reclame Aqui é feita pela extensão.",
        detail:
          "O portal bloqueia o servidor; quem lê é a extensão CW Reputação, neste Chrome. Instale ou recarregue a extensão e atualize esta página.",
      });
      return;
    }

    ler();
  }

  return (
    <button
      type="button"
      onClick={clicar}
      disabled={lendo || extensao === "procurando"}
      title={titulo}
      className={`flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors disabled:opacity-60 ${
        problema
          ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
          : ausente
            ? "border-zinc-200 text-zinc-400 hover:bg-zinc-50"
            : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      <ScanSearch size={16} className={lendo ? "animate-pulse" : ""} />

      <span className="hidden lg:inline">
        {lendo
          ? "Lendo o portal…"
          : `Ler o Reclame Aqui${hora ? ` · ${hora}` : ""}`}
      </span>
    </button>
  );
}
