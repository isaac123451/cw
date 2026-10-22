/**
 * A revisão da mensagem no WhatsApp (22/10/2026) — as regras da extensão,
 * sem tela e sem IA.
 *
 *   npm run check:revisao-whatsapp
 */
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const janela: Record<string, unknown> = {};
runInNewContext(readFileSync("extensao/conteudo/revisao-regras.js", "utf8"), { window: janela });
const { revisar } = (janela.CWReputacao as { revisaoDaMensagem: { revisar: (t: string, m?: unknown[]) => { correcoes: { de: string; para: string }[]; corrigido: string; avisos: { tom: string; texto: string }[]; retencao: string } } }).revisaoDaMensagem;

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${JSON.stringify(obtido)?.slice(0, 60)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${JSON.stringify(esperado)?.slice(0, 60)}`);
}
const tons = (t: string, m?: unknown[]) => revisar(t, m).avisos.map((a) => a.tom);

conferir("corrige erro comum, com maiúscula preservada", revisar("Seje bem-vindo, concerteza agente vai resolver").corrigido, "Seja bem-vindo, com certeza a gente vai resolver");
conferir("texto certo não muda", revisar("Oi, Maria! Já estou verificando com o time.").corrigido, "Oi, Maria! Já estou verificando com o time.");
conferir("\"conforme já informado\" é perigo", tons("Conforme já informado, o prazo é esse."), ["perigo"]);
conferir("culpar o cliente é perigo", tons("Você deveria ter configurado antes."), ["perigo"]);
conferir("\"não é nossa responsabilidade\" é perigo", tons("Isso não é nossa responsabilidade."), ["perigo"]);
conferir("abreviação é atenção", tons("vc pode me mandar o print?"), ["atencao"]);
conferir("maiúsculas gritando", tons("ISSO NUNCA ACONTECEU ANTES"), ["atencao"]);
conferir("sigla em maiúscula não conta como grito", tons("O PDV e o KDS estão ok"), []);
conferir("prazo prometido avisa", tons("Vou resolver até amanhã"), ["atencao"]);
conferir("mensagem boa: nenhum aviso", tons("Oi, João! Entendi o problema, já acionei o time e te atualizo por aqui."), []);
const sair = [{ de: "cliente", texto: "Quero cancelar, não aguento mais" }];
conferir("cliente quer cancelar e rascunho não tenta reter: dica", revisar("Ok, vou ver aqui", sair).retencao !== "", true);
conferir("cliente quer cancelar e rascunho reconhece: sem dica", revisar("Entendo sua frustração, posso te ligar agora para resolver?", sair).retencao, "");
conferir("rascunho facilitando a saída é perigo, com dica", [tons("Pode cancelar pelo painel", sair), revisar("Pode cancelar pelo painel", sair).retencao !== ""], [["perigo"], true]);

console.log(falhas ? `\n  ${falhas} ponto(s) a corrigir.\n` : "\n  A revisão aponta o que piora a relação e não incomoda a mensagem boa.\n");
if (falhas) process.exitCode = 1;
