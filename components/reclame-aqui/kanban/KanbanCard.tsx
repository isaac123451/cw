"use client";

import Link from "next/link";

import { useState } from "react";

import { Star, Trash2, TriangleAlert } from "lucide-react";

import { Case } from "@/lib/models/case";
import { TagChips } from "@/components/shared/TagPicker";
import { ConfirmDelete } from "@/components/shared/Modal";
import LinksDoRa from "@/components/shared/LinksDoRa";
import BotaoCompletar from "@/components/reclame-aqui/completar/BotaoCompletar";
import ChipPrioridade from "@/components/reclame-aqui/tratativa/ChipPrioridade";
import RelogioDoCaso from "@/components/reclame-aqui/tratativa/RelogioDoCaso";
import ProximoPasso from "@/components/reclame-aqui/tratativa/ProximoPasso";

import { useCases } from "@/lib/context/CaseContext";
import { useOwners } from "@/lib/hooks/useOwners";
import { caseHref, isSocial } from "@/lib/services/case.service";
import { hojeNaOperacao } from "@/lib/services/reputation.service";
import BotaoAbrirEmJanela from "@/components/janelas/BotaoAbrirEmJanela";

interface Props {
  item: Case;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

/** A etiqueta automática da captura é origem, não assunto: fica na ficha. */
const ETIQUETA_DA_CAPTURA = "Capturada pela extensão";

/** "hoje", "ontem", "3d", "5 sem", "2 mês", "1 ano" — pela data de publicação, no dia de Brasília. */
export function idadeCurta(dia: string, hoje = hojeNaOperacao()) {
  const dias = Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${String(dia).slice(0, 10)}T12:00:00Z`)) / 86_400_000);
  if (!Number.isFinite(dias) || dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 14) return `${dias}d`;
  if (dias < 60) return `${Math.floor(dias / 7)} sem`;
  if (dias < 365) return `${Math.floor(dias / 30)} mês`;
  return `${Math.floor(dias / 365)} ano`;
}

/**
 * O cartão do quadro (repaginado na Fase 11 do roadmap 2.0).
 *
 * O Isaac: "a parte do reclame aqui do kanban ta meio bagunçado". O
 * cartão tinha onze elementos — protocolo, três ícones, "a triar",
 * título, empresa e cliente, "Completar", cidade, estrelas sempre (com
 * "-" quando não havia nota), a etiqueta da captura, o seletor de
 * responsável e "Em aberto". Ficou o que decide o próximo passo:
 *
 * - **topo:** criticidade, protocolo e a idade ("3d", "2 mês");
 * - **título** em até duas linhas e **quem** numa linha só;
 * - **chips só do que pede ação:** o relógio, o próximo passo, completar;
 * - **rodapé:** o responsável, e a nota ou o risco só quando existem.
 *
 * As ações (mini-janela, excluir) aparecem no hover, por cima do canto,
 * sem roubar espaço do texto. Cidade e etiqueta de captura continuam na
 * ficha e na mini-janela.
 */
export default function KanbanCard({
  item,
  onDragStart,
  onDragEnd,
}: Props) {

  const [dragging, setDragging] = useState(false);

  /** Diálogo de exclusão aberto. Apagar caso não tem desfazer. */
  const [confirmando, setConfirmando] = useState(false);

  const { updateCase, deleteCase } = useCases();
  const owners = useOwners();

  /**
   * Vazio é "sem responsável", não a string vazia: gravar `""` faria o
   * cartão mostrar um nome em branco e o filtro ganharia uma opção
   * invisível.
   */
  function atribuir(nome: string) {
    updateCase({
      ...item,
      owner: nome === "" ? undefined : nome,
    });
  }

  const etiquetas = (item.tags ?? []).filter((t) => t !== ETIQUETA_DA_CAPTURA);

  return (
    <>
      <Link
        href={caseHref(item)}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", item.id);
          event.dataTransfer.effectAllowed = "move";
          setDragging(true);
          onDragStart(item.id);
        }}
        onDragEnd={() => {
          setDragging(false);
          onDragEnd();
        }}
        data-tour="cartao-do-quadro"
        className={`group relative block cursor-grab rounded-lg border border-zinc-200 bg-white px-3 pb-2.5 pt-2 transition-[border-color,box-shadow] active:cursor-grabbing hover:border-zinc-300 hover:shadow-[0_2px_8px_-2px_rgba(16,24,40,0.12)] ${
          dragging ? "opacity-40" : ""
        }`}
      >
        <div className="flex items-center gap-1.5">
          <ChipPrioridade item={item} ocultarNormal />
          <span className="min-w-0 truncate font-mono text-[10.5px] text-zinc-400">{item.protocol}</span>
          <span
            className="ml-auto shrink-0 text-[11px] tabular-nums text-zinc-400"
            title={`Publicada em ${String(item.createdAt).slice(0, 10).split("-").reverse().join("/")}`}
          >
            {idadeCurta(item.createdAt)}
          </span>
        </div>

        {/*
          Ações no hover, por cima do canto. Excluir sempre pede
          confirmação: o cartão é arrastável, e apagar não tem desfazer.
        */}
        <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-md bg-white opacity-0 shadow-sm ring-1 ring-zinc-200 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <BotaoAbrirEmJanela
            frente={isSocial(item) ? "redes" : "reclame-aqui"}
            referencia={item.id}
            titulo={`${item.protocol} · ${item.customer}`}
            className="p-1"
          />
          {!isSocial(item) && <LinksDoRa caso={item} dentroDeLink className="[&>button]:rounded [&>button]:p-1" />}
          <button
            type="button"
            onClick={(e) => {
              /* O cartão é um link: sem isto, o clique abriria a ficha por baixo da confirmação. */
              e.preventDefault();
              e.stopPropagation();
              setConfirmando(true);
            }}
            title="Excluir esta reclamação"
            aria-label={`Excluir ${item.protocol}`}
            className="rounded p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 size={13} />
          </button>
        </div>

        <h3 className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug text-zinc-900">
          {item.title}
        </h3>

        <p className="mt-0.5 truncate text-xs text-zinc-500">
          {item.customer}
          {item.company && item.company !== item.customer ? ` · ${item.company}` : ""}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1 empty:hidden">
          <RelogioDoCaso item={item} esconderSemRegra />
          <ProximoPasso item={item} />
          <BotaoCompletar item={item} />
        </div>

        {etiquetas.length > 0 && (
          <div className="mt-1.5">
            <TagChips tags={etiquetas} limit={2} />
          </div>
        )}

        <div className="mt-2 flex items-center gap-2">
          {/*
            Atribuir responsável sem sair do quadro. As três travas —
            preventDefault, stopPropagation e draggable={false} — impedem
            que o seletor navegue, suba o clique ao link ou arraste o cartão.
          */}
          <span
            className="flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-500"
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
          >
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${item.owner ? "bg-violet-100 text-violet-700" : "bg-zinc-100 text-zinc-400"}`}>
              {(item.owner ?? "?").slice(0, 1).toUpperCase()}
            </span>
            <select
              value={item.owner ?? ""}
              aria-label={`Responsável por ${item.protocol}`}
              title="Atribuir responsável"
              draggable={false}
              onDragStart={(event) => event.preventDefault()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onChange={(event) => {
                event.preventDefault();
                event.stopPropagation();
                atribuir(event.target.value);
              }}
              className={`-ml-1 max-w-[140px] cursor-pointer appearance-none truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] outline-none transition-colors hover:border-zinc-200 hover:bg-zinc-50 focus:border-violet-400 ${item.owner ? "text-zinc-600" : "text-zinc-400"}`}
            >
              <option value="">Sem responsável</option>
              {owners.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
          </span>

          <span className="ml-auto flex shrink-0 items-center gap-2 text-[11px]">
            {item.evaluated && item.score != null && (
              <span className="flex items-center gap-0.5 tabular-nums text-zinc-500" title="Nota da avaliação">
                <Star size={11} className="fill-amber-400 text-amber-400" />
                {item.score}
              </span>
            )}
            {item.churnRisk && (
              <span className="flex items-center gap-1 font-medium text-rose-600" title="Risco de cancelamento">
                <TriangleAlert size={11} />
                Churn
              </span>
            )}
          </span>
        </div>
      </Link>

      <ConfirmDelete
        open={confirmando}
        label={`${item.protocol} — ${item.title}`}
        onCancel={() => setConfirmando(false)}
        onConfirm={() => {
          deleteCase(item.id);
          setConfirmando(false);
        }}
      />
    </>
  );
}
