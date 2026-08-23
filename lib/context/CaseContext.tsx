"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";

import { Case } from "@/lib/models/case";

import {
  deleteCase as removeCase,
  listCases,
  saveCase,
} from "@/lib/actions/cases";

import { REFERENCE_DATE } from "@/lib/services/reputation.service";
import { moverPara } from "@/lib/services/case.service";
import type { Gravacao } from "@/lib/context/sync";

const STORAGE_KEY = "cw:casos";

interface CaseDiff {
  /** Casos cadastrados na tela, que não existem na base importada. */
  criados: Case[];

  /** Casos da base que foram editados, pelo id. */
  alterados: Record<string, Case>;

  /** Ids da base que foram excluídos. */
  removidos: string[];
}

/**
 * Guarda só a diferença em relação à base importada.
 *
 * Salvar a base inteira seria meio megabyte a cada clique e, pior,
 * congelaria os dados: uma reimportação do Reclame Aqui seria
 * sobrescrita pela cópia velha do navegador. Com o diff, o que vem do
 * portal continua mandando e por cima fica o trabalho da operação.
 *
 * A comparação é por referência de objeto — as mutações abaixo sempre
 * criam objeto novo para o que muda, então não é preciso serializar
 * nada para descobrir a diferença.
 */
function derivarDiff(
  base: Case[],
  atual: Case[]
): CaseDiff {

  const indice = new Map(
    base.map((item) => [item.id, item])
  );

  const criados: Case[] = [];
  const alterados: Record<string, Case> = {};
  const presentes = new Set<string>();

  for (const item of atual) {

    presentes.add(item.id);

    const original = indice.get(item.id);

    if (!original) {
      criados.push(item);
      continue;
    }

    if (original !== item) {
      alterados[item.id] = item;
    }
  }

  const removidos = base
    .filter((item) => !presentes.has(item.id))
    .map((item) => item.id);

  return { criados, alterados, removidos };
}

/** Aplica o diff salvo sobre a base carregada. */
function aplicarDiff(
  base: Case[],
  diff: CaseDiff
): Case[] {

  const removidos = new Set(diff.removidos ?? []);

  const restante = base
    .filter((item) => !removidos.has(item.id))
    .map((item) => diff.alterados?.[item.id] ?? item);

  return [...(diff.criados ?? []), ...restante];
}

export interface CaseFilters {
  search: string;
  company: string;
  status: string;
  category: string;
  tag: string;
  /** Responsável atribuído — vem do cadastro de Times. */
  owner: string;
  /** Id do estabelecimento vinculado. */
  establishment: string;
}

export const emptyFilters: CaseFilters = {
  search: "",
  company: "",
  status: "",
  category: "",
  tag: "",
  owner: "",
  establishment: "",
};

interface CaseContextType {
  cases: Case[];

  /** Casos após aplicar busca e filtros da Toolbar. */
  filteredCases: Case[];

  filters: CaseFilters;

  setFilter: (
    field: keyof CaseFilters,
    value: string
  ) => void;

  /** Aplica um conjunto inteiro de uma vez — usado pelos filtros salvos. */
  applyFilters: (value: CaseFilters) => void;

  clearFilters: () => void;

  setCases: React.Dispatch<
    React.SetStateAction<Case[]>
  >;

  createCase: (data: Case) => void;

  /**
   * Devolve o resultado da gravação.
   *
   * A tela do caso passou a gravar por botão, e o rascunho precisa
   * saber se o servidor aceitou antes de dizer "salvo" — confirmar
   * antes da resposta confirma o clique, não a gravação.
   */
  updateCase: (data: Case) => Promise<Gravacao>;

  deleteCase: (id: string) => void;

  moveCase: (
    id: string,
    status: string
  ) => void;

  toggleTag: (id: string, tag: string) => void;

  /** Carga inicial ainda em andamento. */
  loading: boolean;

  /** Relê do banco — usado depois de importar uma planilha. */
  recarregar: () => Promise<void>;

  /** Os dados vêm do banco (e não da demonstração em memória). */
  hasDatabase: boolean;

  /** Última falha de leitura/gravação no banco, se houve. */
  syncError: string | null;
}

const CaseContext =
  createContext<CaseContextType | null>(
    null
  );

export function CaseProvider({
  children,
  hasDatabase = false,
}: {
  children: ReactNode;
  /**
   * Com banco, a fonte é o Postgres e cada mudança vai para lá. Sem
   * banco a aplicação segue em demonstração, e o navegador guarda o
   * diff — é o que mantém o `npm run dev` útil sem infraestrutura.
   */
  hasDatabase?: boolean;
}) {
  /**
   * Começa vazio de propósito.
   *
   * Antes o dataset era importado aqui para servir de estado inicial —
   * e, sendo isto um client component, as 334 reclamações com o texto
   * completo iam junto no pacote do navegador, mesmo com o banco
   * ligado. A carga agora vem de `listCases`, que roda no servidor e
   * decide entre Postgres e demonstração.
   */
  const [cases, setCases] = useState<Case[]>([]);

  /** Base carregada, para o diff do modo demonstração comparar contra. */
  const baseRef = useRef<Case[]>([]);

  const [loading, setLoading] = useState(true);

  const [filters, setFilters] =
    useState<CaseFilters>(emptyFilters);

  /**
   * Só depois de carregar é que se pode gravar — senão o primeiro
   * render (ainda com a base pura) apagaria o trabalho salvo.
   */
  const [restaurado, setRestaurado] = useState(false);

  /** Última falha de gravação, para a tela poder avisar. */
  const [syncError, setSyncError] = useState<
    string | null
  >(null);

  /** Relê do banco. Chamado depois de importar uma planilha. */
  async function recarregar() {

    if (!hasDatabase) return;

    try {
      const rows = await listCases();
      baseRef.current = rows;
      setCases(rows);
      setSyncError(null);
    } catch (error) {
      console.error("[casos] recarga falhou", error);
      setSyncError(
        "Não foi possível recarregar as reclamações."
      );
    }
  }

  /**
   * Dispara a gravação sem travar a interface, e registra a falha.
   *
   * **Devolve o resultado, e nunca rejeita.** A tela do caso passou a
   * gravar por botão, e o rascunho só limpa o que foi de fato aceito
   * pelo servidor — o que falhou continua na tela para dar para tentar
   * de novo em vez de redigitar.
   *
   * Sem banco (modo demonstração) conta como sucesso: a edição já está
   * no estado local, que é onde ela vive ali.
   */
  function sincronizar(
    executar: () => Promise<void>
  ): Promise<Gravacao> {

    if (!hasDatabase) {
      return Promise.resolve({ ok: true });
    }

    return executar().then(
      (): Gravacao => {
        setSyncError(null);
        return { ok: true };
      },
      (error: unknown): Gravacao => {

        const mensagem =
          error instanceof Error
            ? error.message
            : "Falha ao gravar no banco.";

        console.error("[casos] gravação falhou", error);
        setSyncError(mensagem);

        return { ok: false, erro: mensagem };
      }
    );
  }

  // A carga acontece após a montagem: no servidor não há localStorage,
  // e ler durante o render quebraria a hidratação.
  useEffect(() => {

    let ativo = true;

    listCases()
      .then((rows) => {

        if (!ativo) return;

        baseRef.current = rows;

        if (hasDatabase) {
          setCases(rows);
          return;
        }

        // Demonstração: o que foi editado fica no navegador, por cima
        // do que veio da carga.
        try {
          const salvo =
            localStorage.getItem(STORAGE_KEY);

          setCases(
            salvo
              ? aplicarDiff(
                  rows,
                  JSON.parse(salvo) as CaseDiff
                )
              : rows
          );
        } catch {
          setCases(rows);
        }
      })
      .catch((error: unknown) => {
        if (!ativo) return;

        console.error(
          "[casos] carga falhou",
          error
        );
        setSyncError(
          "Não foi possível carregar as reclamações."
        );
      })
      .finally(() => {
        if (!ativo) return;

        setRestaurado(true);
        setLoading(false);
      });

    return () => {
      ativo = false;
    };

  }, [hasDatabase]);

  useEffect(() => {

    // Com banco quem persiste são as ações, caso a caso.
    if (!restaurado || hasDatabase) return;

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          derivarDiff(baseRef.current, cases)
        )
      );
    } catch {
      // Cota estourada ou modo privado: segue só em memória.
    }

  }, [cases, restaurado, hasDatabase]);

  function setFilter(
    field: keyof CaseFilters,
    value: string
  ) {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  /** Campos ausentes viram vazio, para um filtro salvo antigo não herdar o estado atual. */
  function applyFilters(value: CaseFilters) {
    setFilters({ ...emptyFilters, ...value });
  }

  function clearFilters() {
    setFilters(emptyFilters);
  }

  function createCase(data: Case) {
    setCases((prev) => [data, ...prev]);
    sincronizar(() => saveCase(data));
  }

  function updateCase(data: Case) {
    setCases((prev) =>
      prev.map((item) =>
        item.id === data.id
          ? data
          : item
      )
    );

    return sincronizar(() => saveCase(data));
  }

  function deleteCase(id: string) {

    const alvo = cases.find((item) => item.id === id);

    setCases((prev) =>
      prev.filter(
        (item) => item.id !== id
      )
    );

    if (alvo) {
      sincronizar(() => removeCase(alvo.protocol));
    }
  }

  /**
   * Move o caso de status mantendo coerentes os campos que dependem dele.
   *
   * No ciclo real do Reclame Aqui só existem dois estados avaliados —
   * "Resolvido" e "Não resolvido". Mudar só o texto do status deixava os
   * indicadores divergentes do quadro (um caso podia aparecer como
   * resolvido no Kanban e em aberto nas métricas).
   */
  function moveCase(id: string, status: string) {

    const atual = cases.find((item) => item.id === id);

    if (!atual) return;

    /**
     * A regra vive em `case.service.ts` porque a extensão move caso
     * pela rota `/api/extensao/mover`, que não pode chamar server
     * action. Duas cópias divergiriam, e o sintoma seria nota fantasma.
     */
    const movido = moverPara(atual, status, REFERENCE_DATE);

    setCases((prev) =>
      prev.map((item) =>
        item.id === id ? movido : item
      )
    );

    // Mover não mexe em etiqueta: pular a sincronização deixa o arraste
    // com uma ida ao banco em vez de três.
    sincronizar(() =>
      saveCase(movido, { syncTags: false })
    );
  }

  /** Aplica ou remove uma etiqueta do caso. */
  function toggleTag(id: string, tag: string) {

    const atual = cases.find((item) => item.id === id);

    if (!atual) return;

    const current = atual.tags ?? [];

    const etiquetado: Case = {
      ...atual,
      tags: current.includes(tag)
        ? current.filter((value) => value !== tag)
        : [...current, tag],
    };

    setCases((prev) =>
      prev.map((item) =>
        item.id === id ? etiquetado : item
      )
    );

    sincronizar(() => saveCase(etiquetado));
  }

  const filteredCases = useMemo(() => {

    const term = filters.search
      .trim()
      .toLowerCase();

    return cases.filter((item) => {

      if (
        filters.company &&
        item.company !== filters.company
      ) {
        return false;
      }

      if (
        filters.status &&
        item.status !== filters.status
      ) {
        return false;
      }

      if (
        filters.category &&
        item.category !== filters.category
      ) {
        return false;
      }

      if (
        filters.tag &&
        !(item.tags ?? []).includes(filters.tag)
      ) {
        return false;
      }

      if (
        filters.owner &&
        (item.owner ?? "") !== filters.owner
      ) {
        return false;
      }

      if (
        filters.establishment &&
        (item.establishmentId ?? "") !==
          filters.establishment
      ) {
        return false;
      }

      if (!term) return true;

      return [
        item.protocol,
        item.title,
        item.company,
        item.customer,
        item.category,
        item.owner,
        item.city,
      ]
        .filter(Boolean)
        .some((field) =>
          String(field)
            .toLowerCase()
            .includes(term)
        );

    });

  }, [cases, filters]);

  const value = useMemo(
    () => ({
      cases,

      filteredCases,

      filters,

      setFilter,

      applyFilters,

      clearFilters,

      setCases,

      createCase,

      updateCase,

      deleteCase,

      moveCase,

      toggleTag,

      loading,

      recarregar,

      hasDatabase,

      syncError,
    }),
    [
      cases,
      filteredCases,
      filters,
      loading,
      hasDatabase,
      syncError,
    ]
  );

  return (
    <CaseContext.Provider value={value}>
      {children}
    </CaseContext.Provider>
  );
}

export function useCases() {
  const context =
    useContext(CaseContext);

  if (!context) {
    throw new Error(
      "useCases deve estar dentro de CaseProvider."
    );
  }

  return context;
}
