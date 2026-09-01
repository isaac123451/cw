"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/guard";
import type { Modulo } from "@/lib/auth/modules";

import { getSession } from "@/lib/auth/session";

import {
  enviarEmail,
  podeEnviarEmail,
  provedorAtivo,
  remetenteEhSandbox,
} from "@/lib/email/enviar";

import { lerConfiguracao } from "@/lib/auth/two-factor";

/** O módulo a que estas ações pertencem — ver lib/auth/modules.ts. */
const MODULO: Modulo = "configuracoes";

export interface RetratoDaSeguranca {
  /** Exigência para todo mundo. */
  exigirParaTodos: boolean;
  /** A escolha de quem está olhando a tela. */
  exigirParaMim: boolean;

  minutosDeValidade: number;
  tentativas: number;

  /** Dá para enviar e-mail neste ambiente? */
  podeEnviar: boolean;
  provedor: string;

  /**
   * O remetente é o de sandbox do Resend?
   *
   * Muda o que a tela pode oferecer: com ele o envio funciona, mas só
   * para uma pessoa — o dono da conta do Resend. Ligar para si é
   * legítimo; exigir de todos trancaria a equipe para fora, e o
   * servidor recusa. A tela precisa saber para dizer isso antes, e não
   * depois do erro.
   */
  remetenteDeSandbox: boolean;

  /** Quantas pessoas já pediram a segunda etapa para si. */
  pessoasComSegundaEtapa: number;
  totalDePessoas: number;
}

export async function lerSeguranca(): Promise<
  RetratoDaSeguranca | { erro: string }
> {

  const ctx = await requireRole("ADMIN", MODULO);

  if (!ctx) {
    return {
      erro: "Sem banco configurado — não há o que ler.",
    };
  }

  const config = await lerConfiguracao();

  const [comSegundaEtapa, total, eu] = await Promise.all([
    ctx.prisma.user.count({
      where: { twoFactorEnabled: true },
    }),
    ctx.prisma.user.count(),
    ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { twoFactorEnabled: true },
    }),
  ]);

  return {
    exigirParaTodos: config.twoFactorRequired,
    exigirParaMim: eu?.twoFactorEnabled ?? false,
    minutosDeValidade: config.codeTtlMinutes,
    tentativas: config.maxAttempts,
    podeEnviar: podeEnviarEmail(),
    provedor: provedorAtivo(),
    remetenteDeSandbox: remetenteEhSandbox(),
    pessoasComSegundaEtapa: comSegundaEtapa,
    totalDePessoas: total,
  };
}

export interface EntradaDeSeguranca {
  exigirParaTodos: boolean;
  minutosDeValidade: number;
  tentativas: number;
}

export async function salvarSeguranca(
  entrada: EntradaDeSeguranca
): Promise<{ erro?: string }> {

  const ctx = await requireRole("ADMIN", MODULO);

  if (!ctx) {
    return {
      erro: "Sem banco configurado — a escolha precisa de onde ser gravada.",
    };
  }

  /**
   * A trava que impede trancar a equipe para fora.
   *
   * Exigir código por e-mail sem provedor de e-mail configurado
   * significa que, na próxima expiração de sessão, **ninguém** entra —
   * inclusive quem acabou de ligar a opção. O conserto exigiria acesso
   * direto ao banco. Por isso a recusa é aqui, no servidor, e não só um
   * botão desabilitado na tela: botão desabilitado se contorna.
   */
  if (entrada.exigirParaTodos && !podeEnviarEmail()) {
    return {
      erro: "Configure o envio de e-mail (RESEND_API_KEY) antes de exigir a verificação em duas etapas — sem ele ninguém receberia o código.",
    };
  }

  /**
   * A mesma trava, para um caso que passa pela anterior.
   *
   * Com o remetente de sandbox do Resend o envio **funciona** — só que
   * exclusivamente para o e-mail dono da conta do Resend. Ou seja,
   * `podeEnviarEmail()` responde que sim e a exigência global trancaria
   * a equipe inteira para fora, menos uma pessoa.
   *
   * O sandbox é uma ponte legítima enquanto o domínio não é verificado:
   * dá para ligar a verificação **para si**, e a ação de ligar prova o
   * envio antes de gravar. O que ele não sustenta é a exigência para
   * todos, e é exatamente isso que esta recusa separa.
   */
  if (entrada.exigirParaTodos && remetenteEhSandbox()) {
    return {
      erro: "O remetente atual é o de sandbox do Resend, que só entrega para o e-mail dono da conta — exigir de todos trancaria a equipe para fora. Verifique um domínio próprio no Resend e aponte EMAIL_REMETENTE para ele. Enquanto isso, cada pessoa que receber e-mail pode ligar a verificação na própria conta.",
    };
  }

  /**
   * A última trava, e a que custa mais caro se faltar.
   *
   * As duas acima olham a **configuração**. Nenhuma olha se o envio
   * de fato acontece: credencial recusada, senha de app revogada,
   * porta bloqueada pela hospedagem — tudo isso passa por elas
   * intacto, porque as variáveis continuam lá.
   *
   * E este é o único botão do sistema capaz de trancar **todo mundo**
   * ao mesmo tempo. A partir daqui, ninguém entra sem receber um
   * e-mail; se o envio estiver quebrado, não há tela que conserte —
   * o conserto é no banco.
   *
   * Então o envio é exercido agora, de verdade, para quem está
   * ligando. Não é uma amostra: é o mesmo caminho, o mesmo provedor e
   * as mesmas credenciais que o login vai usar daqui a um minuto — e
   * roda no ambiente onde elas existem, que é o servidor, não a
   * máquina de quem programou.
   *
   * Um envio bem-sucedido para uma pessoa prova a entrega para as
   * demais **neste provedor**: o SMTP da empresa não tem restrição de
   * destinatário. A exceção conhecida é o sandbox do Resend, e ela já
   * foi recusada logo acima.
   */
  /*
    Só ao **ligar**, não a cada salvamento.

    Esta tela também guarda validade do código e número de palpites.
    Sem esta comparação, mexer em qualquer um desses campos com a
    exigência já ligada dispararia mais um e-mail — e a caixa de
    entrada de quem administra viraria um contador de cliques.
  */
  const jaExigia = (await lerConfiguracao())
    .twoFactorRequired;

  if (entrada.exigirParaTodos && !jaExigia) {

    const quemLiga = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { email: true, name: true },
    });

    if (!quemLiga) {
      return { erro: "Conta não encontrada." };
    }

    const ativas = await ctx.prisma.user.count({
      where: { active: true },
    });

    const teste = await enviarEmail({
      para: quemLiga.email,
      assunto:
        "CW Reputação — verificação em duas etapas exigida de todos",
      texto: [
        `${quemLiga.name || "Olá"},`,
        "",
        `A verificação em duas etapas passou a ser exigida das ${ativas} contas ativas do CW Reputação.`,
        "",
        "Este e-mail foi enviado antes de a mudança ser gravada, para provar",
        "que o envio funciona. Se ele não tivesse saído, nada teria mudado —",
        "exigir um código que não chega trancaria a equipe inteira do lado de fora.",
        "",
        "A partir do próximo login, cada pessoa recebe o próprio código de seis dígitos.",
      ].join("\n"),
    });

    if (!teste.ok) {
      return {
        erro: `Não exigi de todos: o envio de teste falhou. ${teste.erro ?? ""} Se eu tivesse gravado, as ${ativas} contas ativas ficariam sem entrar no próximo login, e o conserto seria no banco.`,
      };
    }
  }

  const dentro = (
    valor: number,
    padrao: number,
    minimo: number,
    maximo: number
  ) =>
    Number.isFinite(valor)
      ? Math.min(Math.max(Math.round(valor), minimo), maximo)
      : padrao;

  const dados = {
    twoFactorRequired: entrada.exigirParaTodos,
    codeTtlMinutes: dentro(
      entrada.minutosDeValidade,
      10,
      1,
      60
    ),
    maxAttempts: dentro(entrada.tentativas, 5, 1, 10),
    updatedBy: ctx.userId,
  };

  await ctx.prisma.securityConfig.upsert({
    where: { id: "unico" },
    update: dados,
    create: { id: "unico", ...dados },
  });

  revalidatePath("/configuracoes");

  return {};
}

/**
 * A escolha de cada pessoa para a própria conta.
 *
 * Não exige ADMIN — exige **estar logado**, e só mexe na própria linha.
 * Deixar alguém ligar a segunda etapa para si é o oposto de um risco;
 * o que não pode é mexer na de outra pessoa, e é por isso que o id vem
 * da sessão e nunca do formulário.
 */
export async function definirSegundaEtapaPropria(
  ligar: boolean
): Promise<{ erro?: string }> {

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx) {
    return { erro: "Sem banco configurado." };
  }

  const sessao = await getSession();

  if (!sessao) {
    return { erro: "Sessão expirada. Entre novamente." };
  }

  if (ligar && !podeEnviarEmail()) {
    return {
      erro: "Configure o envio de e-mail antes de ligar a verificação em duas etapas.",
    };
  }

  /**
   * Ligar só depois de **provar** que o código chega neste endereço.
   *
   * Ter provedor configurado não é a mesma coisa que conseguir entregar
   * para esta pessoa, e a diferença aparece no pior momento possível —
   * no próximo login dela, com a senha já digitada e nenhum código na
   * caixa de entrada. O conserto exigiria abrir o banco na mão.
   *
   * O caso concreto que motivou isto: com o remetente de sandbox do
   * Resend, o envio funciona, `podeEnviarEmail()` diz que sim, e mesmo
   * assim **só uma pessoa** recebe — o dono da conta do Resend. Quem
   * ligasse a verificação para si seria trancado para fora sem nenhum
   * aviso.
   *
   * Em vez de uma regra especial para o sandbox, a ação passou a
   * exercer o caminho de verdade: manda um e-mail agora, para este
   * endereço, e só grava se ele saiu. Isso cobre o sandbox e também
   * todo mau ajuste futuro — domínio que caiu, chave revogada,
   * endereço recusado.
   */
  if (ligar) {

    const pessoa = await ctx.prisma.user.findUnique({
      where: { id: sessao.id },
      select: { email: true, name: true },
    });

    if (!pessoa) {
      return { erro: "Conta não encontrada." };
    }

    const teste = await enviarEmail({
      para: pessoa.email,
      assunto:
        "CW Reputação — verificação em duas etapas ligada",
      texto: [
        `${pessoa.name || "Olá"},`,
        "",
        "A verificação em duas etapas foi ligada na sua conta do CW Reputação.",
        "",
        "Este e-mail existe para provar que o código de seis dígitos consegue",
        "chegar até você. Se ele chegou, o próximo login vai funcionar.",
        "",
        "Se você não fez isso, entre em contato com quem administra o sistema.",
      ].join("\n"),
    });

    if (!teste.ok) {
      return {
        erro: `Não liguei a verificação: o e-mail de confirmação não chegou a sair para ${pessoa.email}. ${teste.erro ?? ""} Ligar assim trancaria você para fora no próximo login.`,
      };
    }
  }

  await ctx.prisma.user.update({
    where: { id: sessao.id },
    data: { twoFactorEnabled: ligar },
  });

  revalidatePath("/configuracoes");

  return {};
}
