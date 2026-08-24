import { redirect } from "next/navigation";

import AuthShell from "@/components/auth/AuthShell";
import CodeForm from "@/components/auth/CodeForm";

import {
  cancelPendingLogin,
  resendCode,
  verifyCode,
} from "@/lib/auth/actions";

import {
  getPendingLogin,
  getSession,
} from "@/lib/auth/session";

export const metadata = {
  title: "Verificação em duas etapas · CW Reputação",
};

/**
 * Mostra a caixa de e-mail sem revelá-la inteira.
 *
 * "carlos.isaac@cardapioweb.com" vira "ca••••••••@cardapioweb.com". A
 * pessoa reconhece a própria conta; quem chegou aqui por outro caminho
 * não ganha um endereço de e-mail de graça.
 */
function mascarar(email: string) {

  const [nome, dominio] = email.split("@");

  if (!dominio) return "seu e-mail";

  const visivel = nome.slice(0, 2);

  return `${visivel}${"•".repeat(Math.max(nome.length - 2, 3))}@${dominio}`;
}

export default async function CodigoPage() {

  if (await getSession()) redirect("/dashboard");

  const pendente = await getPendingLogin();

  /**
   * Sem etapa pendente não há o que verificar.
   *
   * É esta linha que impede alguém de abrir /login/codigo direto e
   * começar a chutar: sem o cookie assinado, não existe desafio para
   * responder, e a tela nem chega a aparecer.
   */
  if (!pendente) redirect("/login");

  return (
    <AuthShell
      title="Verificação em duas etapas"
      description="Só falta confirmar que a caixa de e-mail é sua."
      footer="Não achou o e-mail? Confira o spam antes de pedir outro código."
    >

      <CodeForm
        verificar={verifyCode}
        reenviar={resendCode}
        cancelar={cancelPendingLogin}
        destino={mascarar(pendente.email)}
      />

    </AuthShell>
  );
}
