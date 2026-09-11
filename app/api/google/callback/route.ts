import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/prisma";
import { getSessionViva } from "@/lib/auth/session";

import {
  exchangeCode,
  fetchGoogleEmail,
  hasGoogle,
  readState,
} from "@/lib/services/google.service";

export const runtime = "nodejs";

/**
 * Retorno do consentimento do Google.
 *
 * Vive em `/api` porque o Google exige uma URL fixa de redirecionamento,
 * e o middleware deixa `/api` passar. A autorização aqui **não** vem do
 * cookie: vem do `state` assinado que saiu daqui minutos antes e diz de
 * quem é o código. Sem essa verificação, um link montado por terceiro
 * conectaria a conta Google do atacante à sessão da vítima.
 */
export async function GET(request: Request) {

  const volta = (erro?: string) =>
    redirect(
      erro
        ? `/agenda?google=erro&motivo=${encodeURIComponent(
            erro
          )}`
        : "/agenda?google=conectado"
    );

  if (!hasGoogle()) {
    return volta("Integração não configurada.");
  }

  const url = new URL(request.url);

  // O Google devolve `error=access_denied` quando a pessoa recusa.
  const recusa = url.searchParams.get("error");
  if (recusa) {
    return volta(
      recusa === "access_denied"
        ? "Autorização recusada."
        : recusa
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return volta("Retorno incompleto do Google.");
  }

  const userId = await readState(state);

  if (!userId) {
    return volta(
      "Pedido expirado ou inválido. Tente conectar de novo."
    );
  }

  /**
   * Quem completa tem de ser quem começou.
   *
   * O `state` assinado prova quem **iniciou** a conexão — e só isso.
   * Sem esta conferência, o retorno gravava os tokens na conta do
   * `state`, fosse quem fosse que tivesse aprovado no Google. O ataque
   * era de vinculação de conta: alguém com acesso à plataforma clicava
   * em "Conectar Google", copiava a URL de consentimento (com o `state`
   * dele) e mandava para um colega. O colega via a tela legítima do
   * Google para o CW Reputação, aprovava — e a agenda dele ficava ligada
   * à conta de quem mandou o link. Na época o escopo incluía também
   * `gmail.readonly`; hoje é só `calendar.events`.
   *
   * O retorno do Google é uma navegação de primeiro nível, então o
   * cookie de sessão (SameSite=Lax) chega aqui. Sessão de outra pessoa,
   * ou nenhuma, recusa. `getSessionViva` também recusa conta desativada
   * entre o clique e a volta.
   */
  const sessao = await getSessionViva();

  if (!sessao || sessao.id !== userId) {
    return volta(
      "Este pedido de conexão foi iniciado por outra conta. Entre com a sua e conecte o Google de novo."
    );
  }

  const prisma = getPrisma();

  if (!prisma) return volta("Banco não configurado.");

  try {

    const tokens = await exchangeCode(code);

    if (!tokens.refresh_token) {
      return volta(
        "O Google não enviou o token de renovação. Remova o acesso em myaccount.google.com/permissions e conecte de novo."
      );
    }

    const email = await fetchGoogleEmail(
      tokens.access_token
    );

    const dados = {
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(
        Date.now() + tokens.expires_in * 1000
      ),
    };

    await prisma.googleAccount.upsert({
      where: { userId },
      update: dados,
      create: { userId, ...dados },
    });

  } catch (error) {
    return volta(
      error instanceof Error
        ? error.message
        : "Falha ao concluir a conexão."
    );
  }

  return volta();
}
