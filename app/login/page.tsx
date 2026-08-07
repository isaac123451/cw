import Link from "next/link";
import { redirect } from "next/navigation";

import AuthShell from "@/components/auth/AuthShell";
import AuthForm from "@/components/auth/AuthForm";

import { signIn } from "@/lib/auth/actions";
import { getSession } from "@/lib/auth/session";

export const metadata = {
  title: "Entrar · CW Reputação",
};

export default async function LoginPage() {

  if (await getSession()) redirect("/dashboard");

  return (
    <AuthShell
      title="Entrar"
      description="Use seu e-mail corporativo Cardápio Web."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link
            href="/cadastro"
            className="font-medium text-violet-700 hover:underline"
          >
            Criar acesso
          </Link>
        </>
      }
    >

      <AuthForm
        action={signIn}
        submitLabel="Entrar"
        fields={[
          {
            name: "email",
            label: "E-mail corporativo",
            type: "email",
            placeholder: "nome@cardapioweb.com",
            autoComplete: "email",
          },
          {
            name: "password",
            label: "Senha",
            type: "password",
            placeholder: "••••••••",
            autoComplete: "current-password",
          },
        ]}
      />

    </AuthShell>
  );
}
