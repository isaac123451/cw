"use client";

import {
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  Star,
  XCircle,
} from "lucide-react";

import { Case } from "@/lib/models/case";

import { TagChips } from "@/components/shared/TagPicker";
import StatusPicker from "@/components/reclame-aqui/shared/StatusPicker";

import { useCases } from "@/lib/context/CaseContext";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";
import { idExterno } from "@/lib/services/case.service";

interface Props {
  data: Case;
  onClick: () => void;
}

const DIA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

/**
 * "há 3 dias", "hoje", "há 4 meses".
 *
 * A idade responde a pergunta que se faz olhando a lista; a data
 * absoluta responde a que se faz depois de escolher o caso, e por isso
 * ela fica no `title`.
 */
function idadeEmDias(iso: string) {

  const dias = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 86400000
  );

  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;

  const meses = Math.floor(dias / 30);

  return meses === 1 ? "há 1 mês" : `há ${meses} meses`;
}

export default function CaseRow({
  data,
  onClick,
}: Props) {

  const { moveCase } = useCases();
  const { findEstablishment } = useEstablishments();

  const estabelecimento = data.establishmentId
    ? findEstablishment(data.establishmentId)
    : undefined;

  // Telefone mascarado na importação não vira link de WhatsApp.
  const digits = (data.phone ?? "").replace(/\D/g, "");

  const whatsapp =
    digits.length >= 10 && !(data.phone ?? "").includes("•")
      ? digits
      : null;

  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b border-zinc-100 text-sm transition-colors last:border-0 hover:bg-violet-50/50"
    >

      <td className="px-5 py-3.5">

        <span className="font-mono text-xs font-semibold text-violet-700">
          {idExterno(data)}
        </span>

        <p className="mt-0.5 max-w-[220px] truncate text-xs text-zinc-500">
          {data.title}
        </p>

        {data.tags && data.tags.length > 0 && (
          <div className="mt-1.5">
            <TagChips tags={data.tags} limit={2} />
          </div>
        )}

      </td>

      {/*
        A data da reclamação.

        Dia e mês em cima, ano embaixo e a idade em dias ao lado: a
        pergunta na lista quase nunca é "que dia foi", é "há quanto
        tempo está aqui". A data completa fica no `title` para quem
        precisa do dado exato.
      */}
      <td className="whitespace-nowrap px-5 text-zinc-600">

        {data.createdAt ? (

          <span
            title={new Date(
              data.createdAt
            ).toLocaleString("pt-BR")}
          >

            <span className="block text-xs font-medium text-zinc-700 tabular-nums">
              {DIA.format(new Date(data.createdAt))}
            </span>

            <span className="mt-0.5 block text-[11px] text-zinc-400">
              {idadeEmDias(data.createdAt)}
            </span>

          </span>

        ) : (
          <span className="text-zinc-300">—</span>
        )}

      </td>

      <td className="px-5 text-zinc-700">
        {estabelecimento ? (
          estabelecimento.name
        ) : (
          <span
            className="text-zinc-300"
            title="Reclamação ainda não vinculada a um estabelecimento."
          >
            —
          </span>
        )}
      </td>

      <td className="px-5 text-zinc-700">
        {data.customer}
      </td>

      <td className="px-5 text-zinc-600">
        {data.category}
      </td>

      <td className="px-5">

        <div className="flex items-center gap-1 tabular-nums text-zinc-700">

          <Star
            size={13}
            className={
              data.evaluated
                ? "fill-amber-400 text-amber-400"
                : "text-zinc-300"
            }
          />

          {data.evaluated ? data.score ?? 0 : "—"}

        </div>

      </td>

      <td className="px-5">

        {data.resolved ? (
          <CheckCircle2
            size={17}
            className="text-emerald-600"
          />
        ) : (
          <XCircle size={17} className="text-zinc-300" />
        )}

      </td>

      <td className="px-5 text-zinc-600">
        {data.wouldDoBusiness ? "Sim" : "Não"}
      </td>

      <td className="px-5">

        <StatusPicker
          value={data.status}
          size="compact"
          onChange={(status) => moveCase(data.id, status)}
        />

      </td>

      <td className="px-5 text-zinc-600">
        {data.sla}
      </td>

      <td className="px-5 text-zinc-600">
        {data.owner ?? "—"}
      </td>

      <td className="px-5">

        {/* Só aparece o que existe de verdade neste caso. */}
        <div className="flex items-center gap-1">

          {whatsapp && (
            <a
              href={`https://wa.me/55${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              title={`Conversar com ${data.customer} no WhatsApp`}
              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
            >
              <MessageCircle size={15} />
            </a>
          )}

          {data.raUrl && (
            <a
              href={data.raUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              title="Abrir esta reclamação no Reclame Aqui"
              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-violet-50 hover:text-violet-700"
            >
              <ExternalLink size={15} />
            </a>
          )}

          {!whatsapp && !data.raUrl && (
            <span className="text-zinc-300">—</span>
          )}

        </div>

      </td>

    </tr>
  );
}
