"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

import {
  ClientEnrichment,
  ManualClient,
} from "@/lib/models/client";

import { useCases } from "@/lib/context/CaseContext";

import {
  buildClients,
  ClientProfile,
} from "@/lib/services/client.service";

import { slugify } from "@/lib/services/slug";

export type ManualClientDraft = Omit<
  ManualClient,
  "id" | "slug" | "createdAt"
>;

interface ClientsContextType {
  clients: ClientProfile[];

  findClient: (slug: string) => ClientProfile | undefined;

  /** Salva os campos que o export do RA não traz. */
  enrich: (
    slug: string,
    patch: ClientEnrichment
  ) => void;

  createClient: (
    data: ManualClientDraft
  ) => ManualClient;

  /** Reescreve um cadastro manual por completo (nome, contato, tudo). */
  updateManual: (
    slug: string,
    data: ManualClientDraft
  ) => void;

  /**
   * Só remove quem foi cadastrado à mão. Cliente que veio de uma
   * reclamação real não some da base — a reclamação existe.
   */
  removeClient: (slug: string) => void;

  isManual: (slug: string) => boolean;
}

const ClientsContext =
  createContext<ClientsContextType | null>(null);

export function ClientsProvider({
  children,
}: {
  children: ReactNode;
}) {

  const { cases } = useCases();

  const [enrichment, setEnrichment] = useState<
    Record<string, ClientEnrichment>
  >({});

  const [manual, setManual] = useState<ManualClient[]>([]);

  const clients = useMemo(
    () => buildClients(cases, enrichment, manual),
    [cases, enrichment, manual]
  );

  const value = useMemo<ClientsContextType>(
    () => ({
      clients,

      findClient: (slug) =>
        clients.find((item) => item.slug === slug),

      enrich: (slug, patch) => {

        setEnrichment((prev) => ({
          ...prev,
          [slug]: { ...prev[slug], ...patch },
        }));

        // Quem foi cadastrado à mão guarda os campos no próprio
        // registro, senão a edição se perderia ao recarregar a lista.
        setManual((prev) =>
          prev.map((item) =>
            item.slug === slug
              ? { ...item, ...patch }
              : item
          )
        );
      },

      createClient: (data) => {

        const base = slugify(data.name) || "cliente";

        const taken = new Set([
          ...clients.map((item) => item.slug),
        ]);

        let slug = base;
        let n = 2;

        while (taken.has(slug)) {
          slug = `${base}-${n}`;
          n += 1;
        }

        const created: ManualClient = {
          ...data,
          id: crypto.randomUUID(),
          slug,
          createdAt: new Date()
            .toISOString()
            .slice(0, 10),
        };

        setManual((prev) => [created, ...prev]);

        return created;
      },

      updateManual: (slug, data) =>
        setManual((prev) =>
          prev.map((item) =>
            item.slug === slug
              ? { ...item, ...data }
              : item
          )
        ),

      removeClient: (slug) =>
        setManual((prev) =>
          prev.filter((item) => item.slug !== slug)
        ),

      isManual: (slug) =>
        manual.some((item) => item.slug === slug),
    }),
    [clients, manual]
  );

  return (
    <ClientsContext.Provider value={value}>
      {children}
    </ClientsContext.Provider>
  );
}

export function useClients() {
  const context = useContext(ClientsContext);

  if (!context) {
    throw new Error(
      "useClients deve estar dentro de ClientsProvider."
    );
  }

  return context;
}
