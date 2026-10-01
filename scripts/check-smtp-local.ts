/**
 * O envio por SMTP funciona com a versão instalada do nodemailer?
 *
 *   npm run check:smtp-local
 *
 * Sobe um servidor SMTP de mentira em 127.0.0.1, aponta o `enviarEmail` de
 * verdade para ele e confere o que chegou: autenticação, remetente,
 * destinatário, assunto e corpo. **Nenhum e-mail sai da máquina** — é o
 * teste de quando o nodemailer troca de versão (01/10/2026: 9 → 10, para
 * fechar os avisos de segurança), sem mandar código de acesso a ninguém.
 *
 * Também confere a recusa: destinatário recusado pelo servidor não pode
 * voltar como enviado — é o que ligaria as duas etapas de alguém que nunca
 * receberia o código.
 */
import { createServer, type Socket } from "node:net";

const PORTA = 2526;

process.env.EMAIL_PROVEDOR = "smtp";
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORTA = String(PORTA);
process.env.SMTP_USUARIO = "teste@exemplo.test";
process.env.SMTP_SENHA = "senha-de-mentira";
delete process.env.EMAIL_REMETENTE;
delete process.env.RESEND_API_KEY;

interface Recebido {
  auth: string;
  de: string;
  para: string[];
  dados: string;
}

const recebidos: Recebido[] = [];

function atender(socket: Socket) {
  const atual: Recebido = { auth: "", de: "", para: [], dados: "" };
  let emDados = false;
  let resto = "";
  let esperandoLogin = 0;
  const dizer = (linha: string) => socket.write(`${linha}\r\n`);
  dizer("220 smtp-de-mentira pronto");
  socket.on("data", (pedaco) => {
    resto += pedaco.toString("utf8");
    let fim: number;
    while ((fim = resto.indexOf("\r\n")) >= 0) {
      const linha = resto.slice(0, fim);
      resto = resto.slice(fim + 2);
      if (emDados) {
        if (linha === ".") {
          emDados = false;
          recebidos.push({ ...atual, para: [...atual.para] });
          dizer("250 recebido");
        } else atual.dados += `${linha}\n`;
        continue;
      }
      if (esperandoLogin) {
        atual.auth += Buffer.from(linha, "base64").toString("utf8") + " ";
        esperandoLogin -= 1;
        dizer(esperandoLogin ? "334 UGFzc3dvcmQ6" : "235 autenticado");
        continue;
      }
      const cmd = linha.toUpperCase();
      if (cmd.startsWith("EHLO")) {
        socket.write("250-smtp-de-mentira\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n");
      } else if (cmd.startsWith("AUTH PLAIN")) {
        atual.auth = Buffer.from(linha.split(" ")[2] ?? "", "base64").toString("utf8").replace(/\0/g, " ");
        dizer("235 autenticado");
      } else if (cmd.startsWith("AUTH LOGIN")) {
        esperandoLogin = 2;
        dizer("334 VXNlcm5hbWU6");
      } else if (cmd.startsWith("MAIL FROM")) {
        atual.de = linha.slice(10).trim();
        dizer("250 ok");
      } else if (cmd.startsWith("RCPT TO")) {
        const quem = linha.slice(8).trim();
        if (quem.includes("recusado")) dizer("550 caixa inexistente");
        else {
          atual.para.push(quem);
          dizer("250 ok");
        }
      } else if (cmd === "DATA") {
        emDados = true;
        dizer("354 manda");
      } else if (cmd === "QUIT") {
        dizer("221 tchau");
        socket.end();
      } else if (cmd === "RSET" || cmd === "NOOP") {
        dizer("250 ok");
      } else dizer("502 não sei");
    }
  });
}

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(52)} ${JSON.stringify(obtido)?.slice(0, 50)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(52)} ${JSON.stringify(esperado)?.slice(0, 50)}`);
}

async function main() {
  const servidor = createServer(atender);
  await new Promise<void>((ok) => servidor.listen(PORTA, "127.0.0.1", ok));

  const { enviarEmail } = await import("../lib/email/enviar");
  const { version } = (await import("nodemailer/package.json", { with: { type: "json" } })).default as { version: string };
  console.log(`\n  SMTP LOCAL — nodemailer ${version}, nada sai da máquina\n`);

  const envio = await enviarEmail({
    para: "pessoa@exemplo.test",
    assunto: "Seu código de acesso",
    texto: "Código: 123456",
    html: "<p>Código: <b>123456</b></p>",
  });
  conferir("o envio volta ok, pelo SMTP", [envio.ok, envio.provedor], [true, "smtp"]);
  const r = recebidos[0];
  conferir("autenticou com o usuário configurado", r?.auth.includes("teste@exemplo.test") && r.auth.includes("senha-de-mentira"), true);
  conferir("remetente é a conta do SMTP", r?.de.includes("teste@exemplo.test"), true);
  conferir("destinatário certo", r?.para, ["<pessoa@exemplo.test>"]);
  conferir("assunto chega", /Subject: Seu c/.test(r?.dados ?? "") || /Subject: =\?UTF-8\?/i.test(r?.dados ?? ""), true);
  conferir("vai com texto e HTML", /text\/plain/.test(r?.dados ?? "") && /text\/html/.test(r?.dados ?? ""), true);

  const recusa = await enviarEmail({ para: "recusado@exemplo.test", assunto: "x", texto: "x" });
  conferir("destinatário recusado não vira enviado", recusa.ok, false);

  servidor.close();
  console.log(falhas === 0 ? "\n  O e-mail sai como antes.\n" : `\n  ${falhas} falha(s).\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
