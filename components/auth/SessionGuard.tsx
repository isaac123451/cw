"use client";

import { useEffect, useRef } from "react";

import { usePathname } from "next/navigation";

import { useSession } from "@/lib/context/SessionContext";
import { signOut } from "@/lib/auth/actions";

/** Onde não ter sessão é o estado normal. */
const PUBLICAS = ["/login", "/cadastro"];

/**
 * Sessão órfã não abre a casa vazia — encerra e volta para o login.
 *
 * O middleware roda no Edge e só sabe conferir a **assinatura** do
 * token; ele não alcança o Postgres. Uma conta apagada ou desativada
 * continuava navegando até o token vencer — e como toda leitura de
 * dados passa por `tryRole`, que confere no banco e recusa, a aplicação
 * aparecia inteira e vazia. Menu, cabeçalhos, cartões, tudo no lugar,
 * todos os números em zero.
 *
 * Numa conferência aqui a tela do NPS dizia "0 respostas" com **959 no
 * banco**. A leitura óbvia de quem vê isso — e foi a que o Isaac fez —
 * é "não está salvando". Não era: era uma sessão órfã mostrando a casa
 * vazia. Um zero que mente sobre o próprio motivo custa mais caro do
 * que uma porta fechada, porque manda procurar o defeito onde ele não
 * está.
 *
 * **Encerrar, e não só redirecionar.** Foi a primeira tentativa e ela
 * entra em laço: o middleware vê a assinatura válida, manda `/login` de
 * volta para `/dashboard`, e a guarda manda de novo para `/login`. O
 * cookie é que precisa sair — sem ele os dois lados passam a concordar.
 *
 * **Por que aqui e não no `MainLayout`.** Aquele é importado por telas
 * que declaram `"use client"`, e puxar `server-only` para dentro dele
 * derruba o build inteiro. Quem confirma a sessão contra o banco é o
 * layout raiz, com `getSessionViva`; este componente só reage ao `null`.
 */
export default function SessionGuard() {

  const sessao = useSession();
  const pathname = usePathname();

  /** Encerrar duas vezes seria uma corrida de dois `redirect`. */
  const encerrando = useRef(false);

  useEffect(() => {

    if (sessao || encerrando.current) return;

    const publica = PUBLICAS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );

    if (publica) return;

    encerrando.current = true;

    /*
      `signOut` apaga o cookie e redireciona do servidor.

      O `catch` existe porque `redirect()` do Next é lançado como
      exceção de controle: sem ele, o console acusaria um erro que não
      é erro.
    */
    signOut().catch(() => {});

  }, [sessao, pathname]);

  return null;
}
