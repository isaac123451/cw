import Link from "next/link";
import { redirect } from "next/navigation";

import AuthShell from "@/components/auth/AuthShell";
import AuthForm from "@/components/auth/AuthForm";

import { signUp } from "@/lib/auth/actions";
import { getSession } from "@/lib/auth/session";

export const metadata = {
  title: "Criar acesso · CW Reputação",
};

export default async function CadastroPage() {

  if (await getSession()) redirect("/dashboard");

  return (
    <AuthShell
      title="Criar acesso"
      description="Cadastro liberado para e-mails @cardapioweb.com autorizados."
      footer={
        <>
          Já tem conta?{" "}
          <Link
            href="/login"
            className="font-medium text-violet-700 hover:underline"
          >
            Entrar
          </Link>
        </>
      }
    >

      <AuthForm
        action={signUp}
        submitLabel="Criar acesso"
        fields={[
          {
            name: "name",
            label: "Nome completo",
            type: "text",
            placeholder: "Seu nome",
            autoComplete: "name",
          },
          {
            name: "email",
            label: "E-mail corporativo",
            type: "email",
            placeholder: "nome@cardapioweb.com",
            autoComplete: "email",
            hint: "Precisa estar na lista de e-mails liberados.",
          },
          {
            name: "password",
            label: "Senha",
            type: "password",
            placeholder: "Mínimo de 8 caracteres",
            autoComplete: "new-password",
          },
        ]}
      />

    </AuthShell>
  );
}
