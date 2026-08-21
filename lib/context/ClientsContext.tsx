"use client";

import {
  createContext,
  useContext,
  useMemo,
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

import {
  removeManualClient as apagarManual,
  saveClientEnrichment as gravarEnriquecimento,
  saveManualClient as gravarManual,
} from "@/lib/actions/registry";

import { useWorkspaceSlice } from "@/lib/context/useWorkspace";
import { sincronizar } from "@/lib/context/sync";

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

  /**
   * Enriquecimento e cadastro manual saem da carga compartilhada.
   *
   * Até 21/08/2026 os dois viviam em `useState` e nada mais: cadastrar
   * um cliente à mão, vinculá-lo a um estabelecimento ou escrever uma
   * nota funcionava na tela e desaparecia no recarregamento — sem erro
   * nenhum, o que é a pior forma de perder dado.
   */
  const [enrichment, setEnrichment] = useWorkspaceSlice(
    (dados) => dados.clientEnrichment,
    {} as Record<string, ClientEnrichment>
  );

  const [manual, setManual] = useWorkspaceSlice(
    (dados) => dados.manualClients,
    [] as ManualClient[]
  );

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

        const completo = {
          ...enrichment[slug],
          ...patch,
        };

        setEnrichment((prev) => ({
          ...prev,
          [slug]: completo,
        }));

        // Quem foi cadastrado à mão guarda os campos no próprio
        // registro, senão a edição se perderia ao recarregar a lista.
        const doCadastro = manual.find(
          (item) => item.slug === slug
        );

        if (doCadastro) {

          const atualizado = {
            ...doCadastro,
            ...patch,
          };

          setManual((prev) =>
            prev.map((item) =>
              item.slug === slug ? atualizado : item
            )
          );

          /**
           * Cadastro manual grava pelo caminho do cadastro, não pelo do
           * enriquecimento: a linha é a mesma, mas só `saveManualClient`
           * escreve nome e contato — o outro os deixaria intactos e o
           * registro voltaria como "manual: false" na próxima carga.
           */
          sincronizar(() => gravarManual(atualizado));
          return;
        }

        sincronizar(() =>
          gravarEnriquecimento(slug, completo)
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

        sincronizar(() => gravarManual(created));

        return created;
      },

      updateManual: (slug, data) => {

        const atual = manual.find(
          (item) => item.slug === slug
        );

        if (!atual) return;

        const atualizado = { ...atual, ...data };

        setManual((prev) =>
          prev.map((item) =>
            item.slug === slug ? atualizado : item
          )
        );

        sincronizar(() => gravarManual(atualizado));
      },

      removeClient: (slug) => {
        setManual((prev) =>
          prev.filter((item) => item.slug !== slug)
        );
        sincronizar(() => apagarManual(slug));
      },

      isManual: (slug) =>
        manual.some((item) => item.slug === slug),
    }),
    [clients, manual, enrichment, setManual, setEnrichment]
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
