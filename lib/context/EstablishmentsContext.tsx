"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

import { Establishment } from "@/lib/models/establishment";
import { mockEstablishments } from "@/lib/data/mockEstablishments";
import { slugify } from "@/lib/services/slug";

export type EstablishmentDraft = Omit<
  Establishment,
  "id" | "slug"
>;

interface EstablishmentsContextType {
  establishments: Establishment[];

  createEstablishment: (
    data: EstablishmentDraft
  ) => Establishment;

  updateEstablishment: (data: Establishment) => void;

  removeEstablishment: (id: string) => void;

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

  const [establishments, setEstablishments] = useState<
    Establishment[]
  >(
    [...mockEstablishments].sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  );

  const value = useMemo<EstablishmentsContextType>(
    () => ({
      establishments,

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

        return created;
      },

      updateEstablishment: (data) =>
        setEstablishments((prev) =>
          prev
            .map((item) =>
              item.id === data.id ? data : item
            )
            .sort((a, b) =>
              a.name.localeCompare(b.name)
            )
        ),

      removeEstablishment: (id) =>
        setEstablishments((prev) =>
          prev.filter((item) => item.id !== id)
        ),

      findEstablishment: (key) =>
        establishments.find(
          (item) => item.id === key || item.slug === key
        ),
    }),
    [establishments]
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
