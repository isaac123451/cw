"use client";

import { useState, type MouseEvent } from "react";

import { Check, Loader2, Send } from "lucide-react";

import { respondida, type Case } from "@/lib/models/case";
import { isSocial } from "@/lib/services/case.service";
import { RESPOSTA_SINTETICA } from "@/lib/services/raMarcadores";

import { useCases } from "@/lib/context/CaseContext";

/**
 * Respondida no Reclame Aqui, num clique (Fase 35, 1.87).
 *
 * "Não tem como somente sinalizar que foi respondido no RA." Respondida:
 * o selo verde, com a data. Sem resposta: o mesmo lugar vira o botão que
 * marca — grava o marcador de resposta com a data de agora, o índice de
 * resposta passa a contar, e o vigia troca o marcador pelo texto de
 * verdade na próxima leitura do portal. A data se ajusta na aba
 * Avaliação da ficha.
 *
 * Só diz "respondida" depois que o servidor aceitou.
 */
/**
 * `discreto` (o cartão do quadro, out/2026): respondida vira texto miúdo,
 * sem pílula verde — quase todo caso depois do Novo está respondido, e o
 * selo em todos virava ruído —, e "Marcar respondida" só aparece ao passar
 * o mouse (no toque, sempre).
 */
export default function SeloRespondida({ item, className = "", discreto = false }: { item: Case; className?: string; discreto?: boolean }) {
  const { updateCase } = useCases();
  const [estado, setEstado] = useState<"parado" | "gravando" | "erro">("parado");

  if (isSocial(item) || !item.protocol?.startsWith("RA-")) return null;

  const parar = (e: MouseEvent) => {
    /* O cartão é um link arrastável: o clique não pode abrir a ficha. */
    e.preventDefault();
    e.stopPropagation();
  };

  if (respondida(item)) {
    const quando = item.publicResponseAt
      ? new Date(item.publicResponseAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })
      : "";
    if (discreto) {
      return (
        <span className={`inline-flex items-center gap-0.5 text-[11px] text-emerald-700 ${className}`} title={quando ? `Respondida no Reclame Aqui em ${quando}` : "Respondida no Reclame Aqui"}>
          <Check size={11} />
          {quando || "respondida"}
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-100 ${className}`}
        title={quando ? `Respondida no Reclame Aqui em ${quando}` : "Respondida no Reclame Aqui"}
      >
        <Check size={11} />
        Respondida{quando ? ` ${quando}` : ""}
      </span>
    );
  }

  async function marcar(e: MouseEvent) {
    parar(e);
    if (estado === "gravando") return;
    setEstado("gravando");
    const r = await updateCase({
      ...item,
      respondida: true,
      publicResponse: RESPOSTA_SINTETICA,
      publicResponseAt: new Date().toISOString(),
    });
    setEstado(r.ok ? "parado" : "erro");
  }

  return (
    <button
      type="button"
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onClick={marcar}
      title={estado === "erro" ? "Não gravou — clique para tentar de novo" : "Já respondi no portal: marcar como respondida, com a data de agora"}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset transition-colors ${
        estado === "erro" ? "text-rose-700 ring-rose-200 hover:bg-rose-50" : "text-zinc-500 ring-zinc-200 hover:bg-emerald-50 hover:text-emerald-700 hover:ring-emerald-200"
      } ${discreto && estado !== "erro" ? "opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100" : ""} ${className}`}
    >
      {estado === "gravando" ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
      {estado === "erro" ? "Tentar de novo" : "Marcar respondida"}
    </button>
  );
}
