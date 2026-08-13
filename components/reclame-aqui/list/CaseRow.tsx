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

interface Props {
  data: Case;
  onClick: () => void;
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
          {data.protocol}
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
