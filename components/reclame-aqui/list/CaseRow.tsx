"use client";

import {
  CheckCircle2,
  MessageCircle,
  Puzzle,
  Star,
  XCircle,
} from "lucide-react";

import { TAG_DA_EXTENSAO } from "@/lib/models/tag";

import { Case, faltaNoCadastro, ROTULO_DO_VOLTARIA, voltariaDoCaso } from "@/lib/models/case";

import { TagChips } from "@/components/shared/TagPicker";
import LinksDoRa from "@/components/shared/LinksDoRa";
import StatusPicker from "@/components/reclame-aqui/shared/StatusPicker";
import BotaoCompletar from "@/components/reclame-aqui/completar/BotaoCompletar";
import ChipPrioridade from "@/components/reclame-aqui/tratativa/ChipPrioridade";
import RelogioDoCaso from "@/components/reclame-aqui/tratativa/RelogioDoCaso";
import ProximoPasso from "@/components/reclame-aqui/tratativa/ProximoPasso";

import { useCases } from "@/lib/context/CaseContext";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";
import { idExterno } from "@/lib/services/case.service";
import {
  diaNaOperacao,
  hojeNaOperacao,
} from "@/lib/services/reputation.service";
import BotaoAbrirEmJanela from "@/components/janelas/BotaoAbrirEmJanela";

interface Props {
  data: Case;
  onClick: () => void;
}

/**
 * O dia da reclamação, em Brasília, sem passar pelo fuso do navegador.
 *
 * Era `Intl.DateTimeFormat("pt-BR")` sobre `new Date("2026-09-10")`: a
 * data sem hora é lida como meia-noite UTC, que em Brasília é 21h da
 * véspera — e a lista mostrava **toda** reclamação um dia antes do dia
 * em que ela entrou. A tela do caso, que corta o texto, mostrava o dia
 * certo; as duas discordavam sobre a mesma reclamação.
 */
function diaDaReclamacao(iso: string) {
  const [ano, mes, dia] = diaNaOperacao(iso).split("-");
  return { curto: `${dia}/${mes}/${ano.slice(2)}`, longo: `${dia}/${mes}/${ano}` };
}

/**
 * "há 3 dias", "hoje", "há 4 meses".
 *
 * A idade responde a pergunta que se faz olhando a lista; a data
 * absoluta responde a que se faz depois de escolher o caso, e por isso
 * ela fica no `title`. Contada entre dias de Brasília, e não entre
 * instantes: às 22h, a reclamação de hoje não pode virar "ontem".
 */
function idadeEmDias(iso: string) {

  const dias = Math.round(
    (Date.parse(`${hojeNaOperacao()}T00:00:00Z`) -
      Date.parse(`${diaNaOperacao(iso)}T00:00:00Z`)) /
      86400000
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

  const voltaria = voltariaDoCaso(data);

  /* A marca de origem vira ícone: como etiqueta, empurrava a linha de quase toda reclamação recente. */
  const daExtensao = (data.tags ?? []).includes(TAG_DA_EXTENSAO);
  const etiquetas = (data.tags ?? []).filter((t) => t !== TAG_DA_EXTENSAO);

  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b border-zinc-100 align-top text-sm transition-colors last:border-0 hover:bg-violet-50/50"
    >

      <td className="py-2.5 pl-5 pr-3">

        {/* O protocolo e as etiquetas na mesma linha: uma linha a menos por reclamação. */}
        <span className="flex flex-wrap items-center gap-1">
          <span className="font-mono text-xs font-semibold text-violet-700">
            {idExterno(data)}
          </span>
          <BotaoAbrirEmJanela
            frente="reclame-aqui"
            referencia={data.id}
            titulo={`${data.protocol} · ${data.customer}`}
            className="p-0.5"
          />
          {daExtensao && (
            <span title={TAG_DA_EXTENSAO} className="text-violet-400">
              <Puzzle size={12} />
            </span>
          )}
          {etiquetas.length > 0 && <TagChips tags={etiquetas} limit={2} />}
        </span>

        <p className="mt-0.5 line-clamp-2 max-w-[340px] text-xs leading-snug text-zinc-600" title={data.title}>
          {data.title}
        </p>

      </td>

      {/*
        A data da reclamação.

        Dia e mês em cima e a idade embaixo: a pergunta na lista quase
        nunca é "que dia foi", é "há quanto tempo está aqui". A data
        completa fica no `title` para quem precisa do dado exato.
      */}
      <td className="whitespace-nowrap px-3 py-2.5 text-zinc-600">

        {data.createdAt ? (

          <span title={diaDaReclamacao(data.createdAt).longo}>

            <span className="block text-xs font-medium text-zinc-700 tabular-nums">
              {diaDaReclamacao(data.createdAt).curto}
            </span>

            <span className="mt-0.5 block text-[11px] text-zinc-400">
              {idadeEmDias(data.createdAt)}
            </span>

          </span>

        ) : (
          <span className="text-zinc-300">—</span>
        )}

      </td>

      {/* O cliente e, embaixo, o restaurante dele — a mesma pessoa, duas colunas a menos de largura. */}
      <td className="px-3 py-2.5">
        <span className="block max-w-[150px] truncate font-medium text-zinc-800" title={data.customer}>
          {data.customer}
        </span>
        {/* Na segunda linha, o restaurante — ou o "Completar", quando falta o que o vincula. */}
        {!estabelecimento && faltaNoCadastro(data).length > 0 ? (
          <BotaoCompletar item={data} className="mt-0.5" />
        ) : (
          <span
            className={`mt-0.5 block max-w-[150px] truncate text-xs ${estabelecimento ? "text-zinc-500" : "text-zinc-300"}`}
            title={estabelecimento ? estabelecimento.name : "Reclamação ainda não vinculada a um estabelecimento."}
          >
            {estabelecimento ? estabelecimento.name : "sem estabelecimento"}
          </span>
        )}
      </td>

      <td className="px-3 py-2.5 text-xs text-zinc-600">
        <span className="line-clamp-2 max-w-[76px]" title={data.category}>{data.category}</span>
      </td>

      {/* Nota, resolvido e voltaria: a avaliação do portal numa linha só. */}
      <td className="whitespace-nowrap px-3 py-2.5">
        <span className="flex items-center gap-2 text-xs tabular-nums text-zinc-700">
          <span className="flex items-center gap-0.5" title={data.evaluated ? `Nota ${data.score ?? 0}` : "Ainda não avaliada"}>
            <Star size={13} className={data.evaluated ? "fill-amber-400 text-amber-400" : "text-zinc-300"} />
            {data.evaluated ? data.score ?? 0 : "—"}
          </span>
          <span title={data.resolved ? "Resolvido" : "Não resolvido (ou sem avaliação)"}>
            {data.resolved ? <CheckCircle2 size={15} className="text-emerald-600" /> : <XCircle size={15} className="text-zinc-300" />}
          </span>
        </span>
        {voltaria !== "indefinido" && (
          <span className="mt-0.5 block text-[11px] text-zinc-500" title="Voltaria a fazer negócio">
            {ROTULO_DO_VOLTARIA[voltaria]}
          </span>
        )}
      </td>

      {/* Onde está no quadro, o relógio que corre e o que fazer agora. */}
      <td className="px-3 py-2.5">
        <span className="flex max-w-[208px] flex-wrap items-center gap-1">
          <StatusPicker
            value={data.status}
            size="compact"
            onChange={(status) => moveCase(data.id, status)}
          />
          <ChipPrioridade item={data} />
          <RelogioDoCaso item={data} esconderSemRegra />
        </span>
        <ProximoPasso item={data} className="mt-1 max-w-[208px]" />
      </td>

      <td className="py-2.5 pl-3 pr-5">
        <span className="block max-w-[92px] truncate text-xs text-zinc-600" title={data.owner}>{data.owner ?? "—"}</span>

        {/* Só aparece o que existe de verdade neste caso. */}
        <div className="mt-1 flex flex-wrap items-center gap-0.5">
          {whatsapp && (
            <a
              href={`https://wa.me/55${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              title={`Conversar com ${data.customer} no WhatsApp`}
              className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
            >
              <MessageCircle size={14} />
            </a>
          )}
          <LinksDoRa caso={data} />
        </div>
      </td>

    </tr>
  );
}
