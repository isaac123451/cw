"use client";

import type { MouseEvent } from "react";

import { ArrowRight, MessageSquareWarning, Star } from "lucide-react";

import type { Case } from "@/lib/models/case";
import { pedidoDeAvaliacao, semNoticia } from "@/lib/models/cadencia";
import { proximoPasso, type AcaoDoPasso } from "@/lib/models/trilha";
import { isSocial } from "@/lib/services/case.service";
import { openMovementOf } from "@/lib/services/movement.service";

import { useMovements } from "@/lib/context/MovementsContext";
import { useSla } from "@/lib/context/SlaContext";
import { useAgora } from "@/lib/hooks/useAgora";

import { useTratativa } from "./TratativaProvider";

interface Props {
  item: Case;
  className?: string;
}

/**
 * O próximo passo do caso, no cartão do quadro.
 *
 * O quadro dizia em que coluna o caso estava; não dizia o que fazer com
 * ele. Aqui aparece o passo da trilha que falta — "fazer a imersão",
 * "validar com o cliente", "pedir a avaliação hoje" — e clicar abre o
 * diálogo dele sem sair do quadro.
 *
 * A triagem e o 1º contato ficam de fora: o chip de prioridade e o
 * relógio do cartão já são o botão desses dois.
 */
export default function ProximoPasso({ item, className = "" }: Props) {

  const { movements } = useMovements();
  const { expediente } = useSla();
  const agora = useAgora();
  const t = useTratativa();

  if (!agora || isSocial(item)) return null;

  const aberta = openMovementOf(item.id, movements);

  const passo = proximoPasso(item, {
    areaAberta: aberta ? { destino: aberta.destination } : undefined,
    agora,
  });

  const vacuo = semNoticia(item, agora, expediente);

  const avaliacao = passo?.id === "pedir-avaliacao" ? pedidoDeAvaliacao(item, agora) : null;

  const mostrarPasso = passo && passo.id !== "triar" && passo.id !== "contato";

  if (!mostrarPasso && !vacuo?.atrasado) return null;

  function abrir(e: MouseEvent, acao?: AcaoDoPasso) {

    /* Sem ação própria (a resposta, a área), o clique segue o link e abre o caso. */
    const dialogos: Partial<Record<AcaoDoPasso, () => void>> = {
      imersao: () => t.abrirImersao(item),
      tentativa: () => t.abrirContato(item, "tentativa"),
      validacao: () => t.abrirContato(item, "validacao"),
      "pedir-avaliacao": () => t.abrirPedidoAvaliacao(item),
      "cw-engine": () => t.abrirFinalizacao(item),
    };

    const dialogo = acao ? dialogos[acao] : undefined;

    if (!dialogo) return;

    e.preventDefault();
    e.stopPropagation();
    dialogo();
  }

  const chip =
    "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset transition-shadow hover:shadow-sm";

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>

      {mostrarPasso && passo && (
        passo.id === "pedir-avaliacao" && avaliacao ? (
          <button
            type="button"
            onClick={(e) => abrir(e, "pedir-avaliacao")}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            title={`${avaliacao.resumo} Clique para montar a mensagem.`}
            className={`${chip} ${
              avaliacao.vencido
                ? "bg-violet-700 text-white ring-violet-700"
                : "bg-white text-zinc-500 ring-zinc-200"
            }`}
          >
            <Star size={10} className={avaliacao.vencido ? "fill-white" : ""} />
            <span className="truncate">
              {avaliacao.vencido
                ? `Pedir avaliação${avaliacao.numero > 1 ? ` (${avaliacao.numero}º)` : ""}`
                : `Lembrete ${avaliacao.proximoDia?.split("-").reverse().slice(0, 2).join("/")}`}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => abrir(e, passo.acao)}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            title={`Passo ${passo.numero} da documentação: ${passo.titulo}. ${passo.detalhe ?? ""}`}
            className={`${chip} bg-violet-50 text-violet-800 ring-violet-200`}
          >
            <ArrowRight size={10} />
            <span className="truncate">{passo.curto.replace(/^./, (c) => c.toUpperCase())}</span>
          </button>
        )
      )}

      {vacuo?.atrasado && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            t.abrirContato(item, "atualizacao");
          }}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          title="O documento pede para não deixar o cliente no vácuo enquanto a solução anda. Clique para registrar a atualização."
          className={`${chip} bg-orange-50 text-orange-800 ring-orange-200`}
        >
          <MessageSquareWarning size={10} />
          <span className="truncate">{vacuo.dias} dias sem notícia</span>
        </button>
      )}

    </div>
  );
}
