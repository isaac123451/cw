"use client";

import {
  createContext,
  useContext,
  useMemo,
  ReactNode,
} from "react";

import { Establishment } from "@/lib/models/establishment";
import { slugify } from "@/lib/services/slug";

import {
  removeEstablishment,
  saveEstablishment,
} from "@/lib/actions/registry";

import { useWorkspaceSlice } from "@/lib/context/useWorkspace";
import { sincronizar } from "@/lib/context/sync";

export type EstablishmentDraft = Omit<
  Establishment,
  "id" | "slug"
>;

interface EstablishmentsContextType {
  establishments: Establishment[];

  /** Carga inicial ainda em andamento. */
  loading: boolean;

  createEstablishment: (
    data: EstablishmentDraft
  ) => Establishment;

  updateEstablishment: (data: Establishment) => void;

  removeEstablishment: (id: string) => void;

  /**
   * Criar e renomear dos campos de escolha: só aparecem na lista depois
   * de o servidor gravar. `null`/`false` é recusa — o aviso já saiu.
   */
  criarEstabelecimento: (nome: string) => Promise<Establishment | null>;
  renomearEstabelecimento: (id: string, nome: string) => Promise<boolean>;

  /**
   * O que o servidor já gravou, só na tela — sem gravar de novo.
   *
   * A imersão cria a conta e salva o link do Crisp por ações próprias,
   * que respondem só depois de gravar; a lista acompanha com isto.
   */
  aplicarDoServidor: (item: Pick<Establishment, "id"> & Partial<Establishment>) => void;

  /** Busca por id ou por slug — a rota usa slug, os vínculos usam id. */
  findEstablishment: (
    key: string
  ) => Establishment | undefined;
}

const EstablishmentsContext =
  createContext<EstablishmentsContextType | null>(null);

export function EstablishmentsProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [establishments, setEstablishments, loading] =
    useWorkspaceSlice(
      (dados) =>
        [...dados.establishments].sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
      [] as Establishment[]
    );

  const value = useMemo<EstablishmentsContextType>(
    () => ({
      establishments,
      loading,

      createEstablishment: (data) => {

        const base = slugify(data.name) || "estabelecimento";

        // Dois estabelecimentos podem ter o mesmo nome (filiais);
        // o slug precisa continuar único para a rota funcionar.
        const taken = new Set(
          establishments.map((item) => item.slug)
        );

        let slug = base;
        let n = 2;

        while (taken.has(slug)) {
          slug = `${base}-${n}`;
          n += 1;
        }

        const created: Establishment = {
          ...data,
          id: crypto.randomUUID(),
          slug,
        };

        setEstablishments((prev) =>
          [...prev, created].sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        );

        sincronizar(() => saveEstablishment(created));

        return created;
      },

      updateEstablishment: (data) => {
        setEstablishments((prev) =>
          prev
            .map((item) =>
              item.id === data.id ? data : item
            )
            .sort((a, b) =>
              a.name.localeCompare(b.name)
            )
        );
        sincronizar(() => saveEstablishment(data));
      },

      criarEstabelecimento: async (nome) => {
        const base = slugify(nome) || "estabelecimento";
        const taken = new Set(establishments.map((item) => item.slug));
        let slug = base;
        for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;

        const novo: Establishment = { id: crypto.randomUUID(), slug, name: nome, plan: "", status: "Ativo" };
        const r = await sincronizar(() => saveEstablishment(novo));
        if (!r.ok) return null;

        setEstablishments((prev) => [...prev, novo].sort((a, b) => a.name.localeCompare(b.name)));
        return novo;
      },

      renomearEstabelecimento: async (id, nome) => {
        const atual = establishments.find((item) => item.id === id);
        if (!atual) return false;
        const r = await sincronizar(() => saveEstablishment({ ...atual, name: nome }));
        if (!r.ok) return false;

        setEstablishments((prev) =>
          prev.map((item) => (item.id === id ? { ...item, name: nome } : item)).sort((a, b) => a.name.localeCompare(b.name))
        );
        return true;
      },

      removeEstablishment: (id) => {
        setEstablishments((prev) =>
          prev.filter((item) => item.id !== id)
        );
        sincronizar(() => removeEstablishment(id));
      },

      aplicarDoServidor: (item) =>
        setEstablishments((prev) => {
          const existe = prev.some((e) => e.id === item.id);
          const lista = existe
            ? prev.map((e) => (e.id === item.id ? { ...e, ...item } : e))
            : [...prev, item as Establishment];
          return lista.sort((a, b) => a.name.localeCompare(b.name));
        }),

      findEstablishment: (key) =>
        establishments.find(
          (item) => item.id === key || item.slug === key
        ),
    }),
    [establishments, loading, setEstablishments]
  );

  return (
    <EstablishmentsContext.Provider value={value}>
      {children}
    </EstablishmentsContext.Provider>
  );
}

export function useEstablishments() {
  const context = useContext(EstablishmentsContext);

  if (!context) {
    throw new Error(
      "useEstablishments deve estar dentro de EstablishmentsProvider."
    );
  }

  return context;
}
