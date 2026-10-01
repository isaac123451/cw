"use client";

import { usePathname } from "next/navigation";

import { itemDeConfiguracoes, menuItems } from "@/core/navigation/menu";
import UserMenu from "./UserMenu";
import NotificationsMenu from "./NotificationsMenu";
import { useSession } from "@/lib/context/SessionContext";
import ThemeToggle from "@/components/shared/ThemeToggle";
import MobileNav from "./MobileNav";
import BuscaGlobal from "@/components/busca/BuscaGlobal";
import AtalhosDeTeclado from "@/components/busca/AtalhosDeTeclado";

export default function Topbar() {

  const pathname = usePathname();

  const user = useSession();

  const current = [...menuItems, itemDeConfiguracoes].find(
    (item) =>
      pathname === item.href ||
      pathname.startsWith(`${item.href}/`)
  );

  /*
    Fundo sólido, sem backdrop-blur (01/10/2026). Com backdrop-filter, o
    cabeçalho vira o bloco de referência de todo `position: fixed` dentro
    dele: a sombra da busca cobria só a barra, a gaveta do celular ficava
    presa nos 64 px do topo, e clicar na página não fechava o sino nem o
    menu do usuário — os véus de "clicar fora" não passavam da barra.
  */
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-zinc-200/80 bg-white px-4 sm:gap-6 sm:px-6 lg:px-8">

      <MobileNav />

      <div className="min-w-0 flex-1">

        <p className="truncate text-sm font-semibold text-zinc-900">
          {current?.title ?? "CW Reputação"}
        </p>

        <p className="truncate text-xs text-zinc-500">
          Cardápio Web · Experiência do Cliente
        </p>

      </div>

      <div className="flex items-center gap-3">

        <BuscaGlobal />
        <AtalhosDeTeclado />

        <ThemeToggle />

        <NotificationsMenu />

        <UserMenu
          name={user?.name ?? "Visitante"}
          email={user?.email ?? "modo demonstração"}
          authenticated={Boolean(user)}
          admin={user?.role === "ADMIN"}
        />

      </div>

    </header>
  );
}
