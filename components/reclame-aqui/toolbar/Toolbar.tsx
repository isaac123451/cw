"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  BarChart3,
  LayoutGrid,
  Plus,
  Search,
  Settings2,
  Table,
  Upload,
  X,
} from "lucide-react";

import { useScopedCases } from "@/lib/context/useScopedCases";
import { useSettings } from "@/lib/context/SettingsContext";
import { useOwners } from "@/lib/hooks/useOwners";

import { countCriteria } from "@/lib/models/savedFilter";

import CreateCaseModal from "@/components/reclame-aqui/modals/CreateCaseModal";
import TransferModal from "@/components/reclame-aqui/toolbar/TransferModal";
import SavedFilters from "@/components/reclame-aqui/toolbar/SavedFilters";
import SearchSelect from "@/components/shared/SearchSelect";
import { hojeNaOperacao } from "@/lib/services/reputation.service";
import { ROTULO_DA_SITUACAO } from "@/lib/services/case.service";

interface Props {
  view: "kanban" | "list";
  onChangeView: (value: "kanban" | "list") => void;
}

const selectClass =
  "h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none transition-colors focus:border-violet-400";

/**
 * Os recortes de data que se pedem todo dia.
 *
 * "Este mês" e "30 dias" respondem coisas diferentes: o primeiro é o
 * fechamento que a operação persegue, o segundo é o movimento recente
 * independentemente da virada do mês. Os dois são pedidos, e nenhum
 * deles vale o trabalho de digitar duas datas.
 *
 * A janela é calculada na hora do clique, e não guardada: guardada, "30
 * dias" apontaria para trinta dias atrás de quando a tela abriu, e uma
 * aba deixada aberta desde ontem filtraria o intervalo errado.
 */
const ATALHOS: {
  rotulo: string;
  janela: () => [string, string];
}[] = [
  {
    rotulo: "Este mês",
    janela: () => {
      const hoje = hojeNaOperacao();
      return [`${hoje.slice(0, 7)}-01`, hoje];
    },
  },
  {
    rotulo: "30 dias",
    janela: () => {
      const hoje = hojeNaOperacao();
      const d = new Date(`${hoje}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 29);
      return [d.toISOString().slice(0, 10), hoje];
    },
  },
];

export default function Toolbar({
  view,
  onChangeView,
}: Props) {
  const {
    cases,
    filteredCases,
    filters,
    setFilter,
    applyFilters,
    clearFilters,
  } = useScopedCases("reclame-aqui");

  const { tags } = useSettings();

  const companies = useMemo(
    () =>
      [...new Set(cases.map((c) => c.company))].sort(),
    [cases]
  );

  const status = useMemo(
    () =>
      [...new Set(cases.map((c) => c.status))].sort(),
    [cases]
  );

  const categories = useMemo(
    () =>
      [...new Set(cases.map((c) => c.category))].sort(),
    [cases]
  );

  // A mesma lista que o cartão do Kanban usa para atribuir.
  const owners = useOwners();

  const [createOpen, setCreateOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  // Conta todos os campos, inclusive os que não têm select aqui
  // (estabelecimento vem da tela do estabelecimento).
  const hasFilters = countCriteria(filters) > 0;

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

      <div className="flex flex-wrap items-center justify-between gap-4">

        <div className="flex flex-wrap items-center gap-2.5">

          <div className="relative">

            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />

            <input
              value={filters.search}
              onChange={(e) =>
                setFilter("search", e.target.value)
              }
              placeholder="Buscar protocolo, cliente ou título..."
              className="h-10 w-72 rounded-xl border border-zinc-200 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400"
            />

          </div>

          <SearchSelect
            value={filters.company}
            onChange={(value) =>
              setFilter("company", value)
            }
            options={companies}
            allLabel="Todos os clientes"
            title="Filtrar por cliente que registrou a reclamação"
          />

          <select
            value={filters.status}
            onChange={(e) =>
              setFilter("status", e.target.value)
            }
            className={selectClass}
          >
            <option value="">Todos Status</option>

            {status.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={filters.category}
            onChange={(e) =>
              setFilter("category", e.target.value)
            }
            className={selectClass}
          >
            <option value="">Todas Categorias</option>

            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={filters.tag}
            onChange={(e) =>
              setFilter("tag", e.target.value)
            }
            title="Filtrar por etiqueta operacional"
            className={selectClass}
          >
            <option value="">Todas Etiquetas</option>

            {tags
              .filter((item) => item.active)
              .map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
          </select>

          <select
            value={filters.owner}
            onChange={(e) =>
              setFilter("owner", e.target.value)
            }
            title="Filtrar por responsável pelo atendimento"
            className={selectClass}
          >
            <option value="">Todos Responsáveis</option>

            {owners.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          {/*
            O recorte por data de abertura.

            Faltava, e sem ele não havia como responder a pergunta mais
            comum de uma revisão — "o que entrou este mês?". Os atalhos
            existem porque digitar duas datas para ver os últimos 30
            dias é trabalho demais para a pergunta mais frequente.
          */}
          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-zinc-200 px-1">

            <input
              type="date"
              value={filters.de}
              max={filters.ate || undefined}
              onChange={(e) =>
                setFilter("de", e.target.value)
              }
              title="Abertas a partir desta data"
              className="h-9 rounded-lg bg-transparent px-2 text-sm text-zinc-700 outline-none"
            />

            <span className="text-xs text-zinc-400">
              até
            </span>

            <input
              type="date"
              value={filters.ate}
              min={filters.de || undefined}
              onChange={(e) =>
                setFilter("ate", e.target.value)
              }
              title="Abertas até esta data"
              className="h-9 rounded-lg bg-transparent px-2 text-sm text-zinc-700 outline-none"
            />

          </div>

          {ATALHOS.map((atalho) => {

            const [de, ate] = atalho.janela();

            const ativo =
              filters.de === de && filters.ate === ate;

            return (
              <button
                key={atalho.rotulo}
                type="button"
                onClick={() => {
                  /* Clicar no atalho aceso desliga o recorte. */
                  setFilter("de", ativo ? "" : de);
                  setFilter("ate", ativo ? "" : ate);
                }}
                className={`h-10 rounded-xl px-3 text-sm font-medium transition-colors ${
                  ativo
                    ? "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {atalho.rotulo}
              </button>
            );
          })}

          {/*
            A situação, quando se chega por um cartão do painel.

            Não tem seletor próprio: ninguém escolhe "vencidas há +7
            dias" numa caixa de opções, chega-se aqui clicando no número
            que apontou para elas. O que faltava era o caminho de volta
            — sem esta etiqueta, a fila mostrava onze de trezentas e
            quarenta e uma sem dizer por quê, e parecia base sumida.
          */}
          {filters.situacao && (
            <button
              onClick={() => setFilter("situacao", "")}
              title="Remover o recorte por situação e ver a fila inteira"
              className="flex h-10 items-center gap-1.5 rounded-xl bg-violet-50 px-3 text-sm font-medium text-violet-700 ring-1 ring-inset ring-violet-200 transition-colors hover:bg-violet-100"
            >
              {ROTULO_DA_SITUACAO[filters.situacao]}
              <X size={14} />
            </button>
          )}

          <SavedFilters
            criteria={filters}
            onApply={applyFilters}
          />

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X size={15} />
              Limpar
            </button>
          )}

        </div>

        {/*
          O grupo da direita também quebra linha.

          Sem `flex-wrap`, num celular ele empurra a barra para 383 px
          numa tela de 375 e os botões de visão saem pela borda. Os
          filtros à esquerda já quebravam; este ficou de fora.
        */}
        <div className="flex flex-wrap items-center gap-2">

          <div className="flex items-center rounded-xl border border-zinc-200 p-1">

            <button
              onClick={() => onChangeView("kanban")}
              aria-label="Visualizar em Kanban"
              className={`rounded-lg p-2 transition-colors ${
                view === "kanban"
                  ? "bg-violet-600 text-white"
                  : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              <LayoutGrid size={17} />
            </button>

            <button
              onClick={() => onChangeView("list")}
              aria-label="Visualizar em lista"
              className={`rounded-lg p-2 transition-colors ${
                view === "list"
                  ? "bg-violet-600 text-white"
                  : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              <Table size={17} />
            </button>

          </div>

          <button
            onClick={() => setTransferOpen(true)}
            title="Importar a planilha do Reclame Aqui ou exportar a base atual"
            className="flex h-10 items-center gap-2 rounded-xl border border-zinc-200 px-3.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <Upload size={16} />
            <span className="hidden lg:inline">Importar</span>
          </button>

          <Link
            href="/reclame-aqui/analytics"
            className="flex h-10 items-center gap-2 rounded-xl border border-zinc-200 px-3.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <BarChart3 size={16} />
            <span className="hidden lg:inline">Analytics</span>
          </Link>

          <Link
            href="/reclame-aqui/configuracoes"
            className="flex h-10 items-center gap-2 rounded-xl border border-zinc-200 px-3.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <Settings2 size={16} />
            <span className="hidden lg:inline">Fluxo</span>
          </Link>

          <button
            onClick={() => setCreateOpen(true)}
            className="flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700"
          >
            <Plus size={16} />
            Nova Reclamação
          </button>

        </div>

      </div>

      {hasFilters && (
        <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
          Exibindo{" "}
          <strong className="font-semibold text-zinc-700">
            {filteredCases.length}
          </strong>{" "}
          de {cases.length} reclamações.
        </p>
      )}

      <CreateCaseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <TransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
      />

    </div>
  );
}
