import "./globals.css";

import type { Metadata } from "next";
import { SpeedInsights } from '@vercel/speed-insights/next';

import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { WorkflowProvider } from "@/lib/context/WorkflowContext";
import { CaseProvider } from "@/lib/context/CaseContext";
import { SettingsProvider } from "@/lib/context/SettingsContext";
import { SessionProvider } from "@/lib/context/SessionContext";
import { JourneyProvider } from "@/lib/context/JourneyContext";
import { GoalsProvider } from "@/lib/context/GoalsContext";
import { ImpactProvider } from "@/lib/context/ImpactContext";
import { AgendaProvider } from "@/lib/context/AgendaContext";
import { ProjectsProvider } from "@/lib/context/ProjectsContext";
import { DocsProvider } from "@/lib/context/DocsContext";
import { TeamsProvider } from "@/lib/context/TeamsContext";
import { EstablishmentsProvider } from "@/lib/context/EstablishmentsContext";
import { ClientsProvider } from "@/lib/context/ClientsContext";
import { PreferencesProvider } from "@/lib/context/PreferencesContext";
import { SavedFiltersProvider } from "@/lib/context/SavedFiltersContext";
import { SlaProvider } from "@/lib/context/SlaContext";
import { MovementsProvider } from "@/lib/context/MovementsContext";
import { MacrosProvider } from "@/lib/context/MacrosContext";

import { ToastProvider } from "@/lib/context/ToastContext";
import { GoogleEventsProvider } from "@/lib/context/GoogleEventsContext";
import { NpsProvider } from "@/lib/context/NpsContext";
import ToastHost from "@/components/shared/ToastHost";

import { getSession } from "@/lib/auth/session";
import { hasDatabase } from "@/lib/prisma";
import { hasGoogle } from "@/lib/services/google.service";

export const metadata: Metadata = {
  title: "CW Reputação",
  description:
    "Plataforma de Gestão da Experiência do Cliente da Cardápio Web.",
};

/**
 * A ordem importa: ClientsProvider deriva os clientes dos casos, então
 * precisa ficar dentro de CaseProvider. O resto é independente.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const session = await getSession();

  return (
    <html
      lang="pt-BR"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >

      <body>

        <SessionProvider value={session}>
          <ToastProvider>
          <PreferencesProvider hasDatabase={hasDatabase()}>
            <SavedFiltersProvider hasDatabase={hasDatabase()}>
            <WorkflowProvider>
              <SettingsProvider>
                <CaseProvider hasDatabase={hasDatabase()}>
                  <SlaProvider>
                  <MovementsProvider>
                  <MacrosProvider>
                  <EstablishmentsProvider>
                    <ClientsProvider>
                      <JourneyProvider>
                        <GoalsProvider>
                          <ImpactProvider>
                            <AgendaProvider>
                              <ProjectsProvider>
                                <TeamsProvider>
                                  <DocsProvider>
                                  <GoogleEventsProvider
                                    enabled={hasDatabase() && hasGoogle()}
                                  >
                                  <NpsProvider enabled={hasDatabase()}>

                                    {children}

                                  </NpsProvider>
                                  </GoogleEventsProvider>
                                  </DocsProvider>
                                </TeamsProvider>
                              </ProjectsProvider>
                            </AgendaProvider>
                          </ImpactProvider>
                        </GoalsProvider>
                      </JourneyProvider>
                    </ClientsProvider>
                  </EstablishmentsProvider>
                  </MacrosProvider>
                  </MovementsProvider>
                  </SlaProvider>
                </CaseProvider>
              </SettingsProvider>
            </WorkflowProvider>
            </SavedFiltersProvider>
          </PreferencesProvider>

          <ToastHost />
          <SpeedInsights />
          </ToastProvider>
        </SessionProvider>

      </body>

    </html>
  );
}
