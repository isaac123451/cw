"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";

import type { CaseFilters } from "@/lib/context/CaseContext";

import {
  BUILT_IN_FILTERS,
  countCriteria,
  emptyCriteria,
  SavedFilter,
} from "@/lib/models/savedFilter";

import {
  deleteSavedFilter,
  listSavedFilters,
  saveSavedFilter,
} from "@/lib/actions/savedFilters";

const STORAGE_KEY = "cw:filtros-salvos";

interface SavedFiltersContextType {
  /** Pré-definidos primeiro, depois os que a pessoa criou. */
  filters: SavedFilter[];

  /** Guarda o critério atual. Nome repetido sobrescreve o anterior. */
  /**
   * Guarda a combinação e **diz o que aconteceu**.
   *
   * Devolvia `void`, e o silêncio escondia três desfechos diferentes:
   * criou, sobrescreveu um filtro de mesmo nome, ou não fez nada por
   * faltar nome ou critério. Os três davam na mesma tela.
   */
  saveFilter: (
    name: string,
    criteria: CaseFilters
  ) => "criado" | "atualizado" | "vazio";

  removeFilter: (id: string) => void;
}

const SavedFiltersContext =
  createContext<SavedFiltersContextType | null>(null);

/** Completa critério antigo que não tem os campos mais novos. */
function normalizar(
  item: Pick<SavedFilter, "id" | "name" | "order"> & {
    criteria: Partial<CaseFilters>;
  }
): SavedFilter {
  return {
    id: item.id,
    name: item.name,
    order: item.order,
    criteria: { ...emptyCriteria, ...item.criteria },
    builtIn: false,
  };
}

/**
 * Filtros salvos do usuário.
 *
 * **Com banco, vão para o Postgres** e seguem a conta: quem salvou um
 * recorte no desktop encontra no notebook. Antes viviam só no
 * `localStorage` e eram por dispositivo.
 *
 * Sem banco (modo demonstração) o `localStorage` continua valendo, para
 * a tela não perder o que foi criado no reload.
 */
export function SavedFiltersProvider({
  children,
  hasDatabase = false,
}: {
  children: ReactNode;
  /**
   * Vem do layout, como no `CaseProvider`: este provider fica **fora**
   * do `CaseProvider`, então não dá para ler pelo `useCases()`.
   */
  hasDatabase?: boolean;
}) {

  const [mine, setMine] = useState<SavedFilter[]>([]);

  // Só depois da montagem: no servidor não existe localStorage e ler no
  // primeiro render causaria divergência de hidratação.
  useEffect(() => {

    let ativo = true;

    if (hasDatabase) {

      listSavedFilters()
        .then((linhas) => {
          if (ativo) setMine(linhas.map(normalizar));
        })
        .catch((erro: unknown) => {
          console.error(
            "[filtros] carga falhou",
            erro
          );
        });

      return () => {
        ativo = false;
      };
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved) as SavedFilter[];

      if (!Array.isArray(parsed)) return;

      /**
       * Ler o `localStorage` **precisa** ser efeito.
       *
       * No servidor ele não existe, então inicializar o estado com ele
       * produziria um HTML diferente do que o navegador desenha — e a
       * hidratação quebra. É o caso que a própria regra descreve como
       * legítimo: sincronizar com um sistema externo. Os formulários,
       * que eram o abuso de verdade, já saíram daqui.
       */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMine(parsed.map(normalizar));
    } catch {
      // Filtro corrompido não pode derrubar a aplicação.
    }

    return () => {
      ativo = false;
    };

  }, [hasDatabase]);

  /**
   * Atualiza a tela na hora e manda para o destino certo.
   *
   * A gravação não bloqueia a interface: o critério já está montado, e
   * esperar a ida ao banco para o filtro aparecer na lista deixaria o
   * clique lento sem motivo.
   */
  const persist = useCallback(
    (
      next: SavedFilter[],
      gravar?: () => Promise<unknown>
    ) => {
      setMine(next);

      if (hasDatabase) {
        gravar?.().catch((erro: unknown) => {
          console.error(
            "[filtros] gravação falhou",
            erro
          );
        });
        return;
      }

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(next)
        );
      } catch {
        // Modo privado pode bloquear a escrita — segue em memória.
      }
    },
    [hasDatabase]
  );

  const value = useMemo<SavedFiltersContextType>(
    () => ({
      filters: [...BUILT_IN_FILTERS, ...mine],

      saveFilter: (name, criteria) => {

        const nome = name.trim();

        // Sem nome ou sem critério não há o que guardar — e um filtro
        // vazio aplicado depois pareceria um bug ("não filtrou nada").
        if (nome === "" || countCriteria(criteria) === 0) {
          return "vazio" as const;
        }

        const existente = mine.find(
          (item) =>
            item.name.toLowerCase() ===
            nome.toLowerCase()
        );

        if (existente) {
          persist(
            mine.map((item) =>
              item.id === existente.id
                ? { ...item, criteria }
                : item
            ),
            () => saveSavedFilter({ name: nome, criteria })
          );

          return "atualizado" as const;
        }

        /**
         * Id provisório: o banco devolve o definitivo, e trocar depois
         * evita que excluir logo após criar mande um id que não existe
         * lá.
         */
        const provisorio = crypto.randomUUID();

        persist(
          [
            ...mine,
            {
              id: provisorio,
              name: nome,
              criteria,
              builtIn: false,
              order: mine.length,
            },
          ],
          async () => {

            const id = await saveSavedFilter({
              name: nome,
              criteria,
            });

            if (id) {
              setMine((atual) =>
                atual.map((item) =>
                  item.id === provisorio
                    ? { ...item, id }
                    : item
                )
              );
            }
          }
        );

        return "criado" as const;
      },

      removeFilter: (id) =>
        persist(
          mine.filter((item) => item.id !== id),
          () => deleteSavedFilter(id)
        ),
    }),
    [mine, persist]
  );

  return (
    <SavedFiltersContext.Provider value={value}>
      {children}
    </SavedFiltersContext.Provider>
  );
}

export function useSavedFilters() {
  const context = useContext(SavedFiltersContext);

  if (!context) {
    throw new Error(
      "useSavedFilters deve estar dentro de SavedFiltersProvider."
    );
  }

  return context;
}
