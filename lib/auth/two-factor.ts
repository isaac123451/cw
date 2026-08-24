import "server-only";

import { randomInt } from "node:crypto";

import bcrypt from "bcryptjs";

import { getPrisma } from "@/lib/prisma";

import {
  enviarEmail,
  podeEnviarEmail,
} from "@/lib/email/enviar";

/**
 * A segunda etapa do login: um código de seis dígitos por e-mail.
 *
 * A senha prova o que a pessoa **sabe**; o código prova acesso à caixa
 * de e-mail dela. É o que sobra de proteção quando a senha vaza — e
 * senha vaza por reuso em outro site, não por falha daqui.
 *
 * O que este arquivo garante, e por quê:
 *
 * - **O código nunca é guardado em claro.** Um milhão de combinações é
 *   pouco; o hash bcrypt faz cada palpite custar caro mesmo com o
 *   banco na mão.
 * - **Uso único.** `consumedAt` fecha a porta. Sem isso, um código
 *   visto por cima do ombro serviria de novo até vencer.
 * - **Vencimento curto** e **limite de palpites**, os dois vindos da
 *   configuração — cinco erros matam o código, e não a conta, para que
 *   ninguém tranque outra pessoa de fora só chutando.
 * - **Desafio novo mata o anterior.** Pedir "reenviar" invalida o
 *   código antigo, senão o e-mail vira uma lista de códigos válidos.
 * - **Espera entre reenvios.** Sem ela, o botão de reenviar é uma
 *   máquina de encher a caixa de entrada de terceiros.
 */

/** Segundos que o botão "reenviar" fica travado. */
const ESPERA_PARA_REENVIAR = 60;

export interface ConfiguracaoDeSeguranca {
  twoFactorRequired: boolean;
  codeTtlMinutes: number;
  maxAttempts: number;
}

const PADRAO: ConfiguracaoDeSeguranca = {
  twoFactorRequired: false,
  codeTtlMinutes: 10,
  maxAttempts: 5,
};

/**
 * A configuração, com padrão seguro quando ela ainda não existe.
 *
 * Nunca lança: chamada no caminho do login, e uma exceção aqui
 * derrubaria a tela de entrada da plataforma inteira.
 */
export async function lerConfiguracao(): Promise<ConfiguracaoDeSeguranca> {

  const prisma = getPrisma();

  if (!prisma) return PADRAO;

  try {

    const linha =
      await prisma.securityConfig.findUnique({
        where: { id: "unico" },
      });

    if (!linha) return PADRAO;

    return {
      twoFactorRequired: linha.twoFactorRequired,
      codeTtlMinutes: Math.min(
        Math.max(linha.codeTtlMinutes, 1),
        60
      ),
      maxAttempts: Math.min(
        Math.max(linha.maxAttempts, 1),
        10
      ),
    };

  } catch {
    return PADRAO;
  }
}

/**
 * Esta pessoa precisa da segunda etapa?
 *
 * Exigência global **ou** escolha da própria pessoa. E, em qualquer
 * caso, só se houver como enviar o e-mail: exigir um código que não
 * tem como chegar é trancar a porta e jogar a chave fora.
 */
export async function exigeSegundaEtapa(usuario: {
  twoFactorEnabled: boolean;
}) {

  if (!podeEnviarEmail()) return false;

  const config = await lerConfiguracao();

  return (
    config.twoFactorRequired || usuario.twoFactorEnabled
  );
}

/**
 * Seis dígitos de fonte criptográfica.
 *
 * `randomInt` do `node:crypto`, não `Math.random()`: o segundo é
 * previsível a partir de saídas anteriores, o que num código de acesso
 * é o defeito inteiro.
 */
export function gerarCodigo() {

  /**
   * O `padStart` não é enfeite.
   *
   * Sem ele, um sorteio de 42.318 vira o código "42318" — cinco
   * dígitos, e a pessoa digita cinco num campo que espera seis. Um em
   * cada dez códigos cairia nessa faixa, e o defeito apareceria como
   * "às vezes o código não funciona", que é o tipo de relato que
   * ninguém consegue reproduzir.
   */
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export interface PedidoDeCodigo {
  ok: boolean;
  challengeId?: string;
  /** Quando falhou, o que dizer para a pessoa. */
  erro?: string;
  /** Segundos que faltam, quando a recusa foi por espera. */
  esperar?: number;
}

/**
 * Cria o desafio, guarda o hash e manda o e-mail.
 *
 * A ordem importa: **grava antes de enviar**. Enviar primeiro deixaria
 * a pessoa com um código na mão que o banco não conhece, se a gravação
 * falhar depois.
 */
export async function criarDesafio(
  usuario: { id: string; email: string; name: string },
  contexto: { ip?: string; userAgent?: string } = {}
): Promise<PedidoDeCodigo> {

  const prisma = getPrisma();

  if (!prisma) {
    return {
      ok: false,
      erro: "Banco de dados não configurado.",
    };
  }

  const config = await lerConfiguracao();

  /**
   * Espera entre reenvios, medida no desafio mais recente da pessoa.
   *
   * Vale mesmo para desafio já gasto: o que se está limitando é o
   * envio de e-mail, não a validade do código.
   */
  const ultimo = await prisma.loginChallenge.findFirst({
    where: { userId: usuario.id },
    orderBy: { createdAt: "desc" },
  });

  if (ultimo) {

    const segundos = Math.ceil(
      (ESPERA_PARA_REENVIAR * 1000 -
        (Date.now() - ultimo.createdAt.getTime())) /
        1000
    );

    if (segundos > 0) {
      return {
        ok: false,
        erro: `Aguarde ${segundos} segundo(s) para pedir outro código.`,
        esperar: segundos,
      };
    }
  }

  const codigo = gerarCodigo();

  /**
   * Os desafios anteriores morrem agora.
   *
   * Sem isto, cada "reenviar" deixaria mais um código válido vivo, e a
   * caixa de entrada viraria um chaveiro.
   */
  await prisma.loginChallenge.updateMany({
    where: {
      userId: usuario.id,
      consumedAt: null,
    },
    data: { consumedAt: new Date() },
  });

  const desafio = await prisma.loginChallenge.create({
    data: {
      userId: usuario.id,
      codeHash: await bcrypt.hash(codigo, 10),
      expiresAt: new Date(
        Date.now() + config.codeTtlMinutes * 60 * 1000
      ),
      ip: contexto.ip?.slice(0, 60),
      userAgent: contexto.userAgent?.slice(0, 300),
    },
  });

  const envio = await enviarEmail({
    para: usuario.email,
    assunto: `${codigo} é o seu código de acesso — CW Reputação`,
    texto: textoDoEmail(
      usuario.name,
      codigo,
      config.codeTtlMinutes,
      contexto
    ),
    html: htmlDoEmail(
      usuario.name,
      codigo,
      config.codeTtlMinutes,
      contexto
    ),
  });

  if (!envio.ok) {

    /**
     * E-mail que não saiu deixa um desafio órfão que ninguém pode
     * responder. Marcar como gasto na hora evita que ele conte contra
     * a espera do próximo pedido.
     */
    await prisma.loginChallenge.update({
      where: { id: desafio.id },
      data: { consumedAt: new Date() },
    });

    console.error(
      "[duas-etapas] falha ao enviar:",
      envio.erro
    );

    return {
      ok: false,
      erro: "Não consegui enviar o código por e-mail. Tente de novo em instantes.",
    };
  }

  return { ok: true, challengeId: desafio.id };
}

export interface Conferencia {
  ok: boolean;
  userId?: string;
  erro?: string;
  /** Verdadeiro quando o desafio morreu e é preciso pedir outro. */
  recomecar?: boolean;
}

/**
 * Confere o código.
 *
 * Toda recusa devolve a mesma frase para código errado e código
 * inexistente: distinguir os dois diria a quem tenta se o desafio
 * ainda vale, que é meia informação de graça.
 */
export async function conferirCodigo(
  challengeId: string,
  codigo: string
): Promise<Conferencia> {

  const prisma = getPrisma();

  if (!prisma) {
    return {
      ok: false,
      erro: "Banco de dados não configurado.",
    };
  }

  const limpo = codigo.replace(/\D/g, "");

  const desafio =
    await prisma.loginChallenge.findUnique({
      where: { id: challengeId },
    });

  const recusa = {
    ok: false,
    erro: "Código inválido ou expirado.",
  };

  if (!desafio) {
    return { ...recusa, recomecar: true };
  }

  if (desafio.consumedAt) {
    return { ...recusa, recomecar: true };
  }

  if (desafio.expiresAt.getTime() < Date.now()) {
    return { ...recusa, recomecar: true };
  }

  const config = await lerConfiguracao();

  if (desafio.attempts >= config.maxAttempts) {

    await prisma.loginChallenge.update({
      where: { id: desafio.id },
      data: { consumedAt: new Date() },
    });

    return {
      ok: false,
      erro: "Muitas tentativas. Peça um código novo.",
      recomecar: true,
    };
  }

  /**
   * O palpite é contado **antes** da comparação.
   *
   * Contar depois deixaria uma janela: quem derrubasse a conexão logo
   * após enviar o palpite teria tentado sem pagar por isso, e o limite
   * de cinco viraria decorativo.
   */
  await prisma.loginChallenge.update({
    where: { id: desafio.id },
    data: { attempts: { increment: 1 } },
  });

  const bate =
    limpo.length === 6 &&
    (await bcrypt.compare(limpo, desafio.codeHash));

  if (!bate) {

    const restantes =
      config.maxAttempts - (desafio.attempts + 1);

    return {
      ok: false,
      erro:
        restantes > 0
          ? `Código inválido. ${restantes} tentativa(s) restante(s).`
          : "Código inválido. Peça um código novo.",
      recomecar: restantes <= 0,
    };
  }

  await prisma.loginChallenge.update({
    where: { id: desafio.id },
    data: { consumedAt: new Date() },
  });

  return { ok: true, userId: desafio.userId };
}

/**
 * Faxina dos desafios vencidos.
 *
 * Chamada pela rotina agendada. Sem ela a tabela cresce para sempre
 * guardando hash de código que ninguém vai usar — e é dado de acesso,
 * que não deve ficar por perto mais do que precisa.
 */
export async function limparDesafiosVelhos(
  diasDeGuarda = 2
) {

  const prisma = getPrisma();

  if (!prisma) return 0;

  const corte = new Date(
    Date.now() - diasDeGuarda * 24 * 60 * 60 * 1000
  );

  const { count } =
    await prisma.loginChallenge.deleteMany({
      where: { createdAt: { lt: corte } },
    });

  return count;
}

function ondeVeio(contexto: {
  ip?: string;
  userAgent?: string;
}) {
  return contexto.ip
    ? `\nPedido feito a partir do endereço ${contexto.ip}.`
    : "";
}

function textoDoEmail(
  nome: string,
  codigo: string,
  minutos: number,
  contexto: { ip?: string; userAgent?: string }
) {
  return [
    `Olá, ${nome.split(" ")[0]}.`,
    "",
    "Seu código de acesso ao CW Reputação é:",
    "",
    `    ${codigo}`,
    "",
    `Ele vale por ${minutos} minutos e serve uma vez só.`,
    ondeVeio(contexto),
    "",
    "Se não foi você que tentou entrar, ignore este e-mail e troque",
    "sua senha — alguém acertou ela.",
    "",
    "— CW Reputação",
  ].join("\n");
}

function htmlDoEmail(
  nome: string,
  codigo: string,
  minutos: number,
  contexto: { ip?: string; userAgent?: string }
) {

  /**
   * O aviso de "não foi você" não é enfeite: é a única forma de a
   * pessoa descobrir que a senha dela vazou. Fica em destaque, não em
   * letra miúda de rodapé.
   */
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <p style="margin:0 0 20px;font-size:15px">Olá, ${escapar(nome.split(" ")[0])}.</p>
    <p style="margin:0 0 8px;font-size:14px;color:#52525b">Seu código de acesso ao CW Reputação:</p>
    <p style="margin:0 0 8px;font-size:38px;font-weight:700;letter-spacing:8px;font-family:ui-monospace,Menlo,monospace">${escapar(codigo)}</p>
    <p style="margin:0 0 24px;font-size:13px;color:#71717a">Vale por ${minutos} minutos e serve uma vez só.${contexto.ip ? ` Pedido a partir de ${escapar(contexto.ip)}.` : ""}</p>
    <p style="margin:0;padding:14px 16px;background:#fef2f2;border-radius:12px;font-size:13px;color:#991b1b">
      <strong>Não foi você?</strong> Alguém acertou sua senha. Ignore este código e troque a senha assim que puder.
    </p>
  </div>
</body></html>`;
}

/** O nome vem do cadastro, mas nada entra em HTML sem passar por aqui. */
function escapar(valor: string) {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
