"use client";

import {
  createContext,
  useContext,
  ReactNode,
} from "react";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

const SessionContext =
  createContext<SessionUser | null>(null);

/**
 * A sessão é lida no layout raiz (servidor) e distribuída daqui, para
 * que as telas — quase todas client components — possam consumi-la sem
 * importar código de servidor.
 */
export function SessionProvider({
  value,
  children,
}: {
  value: SessionUser | null;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
