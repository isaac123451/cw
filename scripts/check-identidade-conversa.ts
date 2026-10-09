/**
 * De quem é a conversa? — `lib/models/identidadeNaConversa.ts` (09/10/2026).
 *
 *   npm run check:identidade-conversa
 *
 * Sem banco. Os casos são os de verdade: as mensagens do Fabiano gravadas
 * na conversa do Eduardo ao trocar de conversa no WhatsApp, e o telefone
 * gravado como nome e empresa de quatro reclamações.
 */
import { autorDeOutraConversa, mesmoTelefone, nomeDaConversa, nomeDePessoa, nomeDoCliente, semMensagensDeOutraConversa } from "../lib/models/identidadeNaConversa";

let falhas = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${nome.padEnd(70)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(70)} ${JSON.stringify(esperado)}`);
}

console.log("\n  NOME DE PESSOA\n");
conferir("telefone não é nome", nomeDePessoa("+55 83 9394-3375"), "");
conferir("texto da tela do WhatsApp não é nome", nomeDePessoa("clique para mostrar os dados do contato"), "");
conferir("ícone não é nome", nomeDePessoa("ic-person-filled"), "");
conferir("nome da agenda é nome", nomeDePessoa("Márcio - Kantinho Burger"), "Márcio - Kantinho Burger");
conferir("mesmo número com e sem DDI e nono dígito", [mesmoTelefone("+55 85 99901-1757", "558599011757"), mesmoTelefone("85 9901-1757", "5585999011757")], [true, true]);

console.log("\n  MENSAGEM DE OUTRA CONVERSA\n");
const eduardo = { telefone: "558599011757", nome: "+55 85 9901-1757" };
conferir("autor com o número de outro contato é de outra conversa", autorDeOutraConversa(eduardo, [{ de: "cliente", autor: "+55 66 9925-6119", chave: "wa:A57" }]), "+55 66 9925-6119");
conferir("autor com o número do contato é desta", autorDeOutraConversa(eduardo, [{ de: "cliente", autor: "+55 85 99901-1757", chave: "wa:A58" }]), null);
conferir("as nossas não acusam (o autor somos nós)", autorDeOutraConversa(eduardo, [{ de: "nos", autor: "Cardápio Web (Reputação)", chave: "wa:3EB" }]), null);
conferir("nome da agenda igual ao do cabeçalho é desta", autorDeOutraConversa({ telefone: "", nome: "Ana Paula" }, [{ de: "cliente", autor: "Ana", chave: "wa:1" }]), null);
conferir("dois nomes sem nada em comum: de outra", autorDeOutraConversa({ telefone: "", nome: "Ana Paula" }, [{ de: "cliente", autor: "Rogério Lima", chave: "wa:1" }]), "Rogério Lima");
conferir("cabeçalho sem nome de verdade: na dúvida, fica", autorDeOutraConversa({ telefone: "", nome: "clique para mostrar os dados do contato" }, [{ de: "cliente", autor: "Rogério", chave: "wa:1" }]), null);
conferir("Crisp não passa pela regra do WhatsApp", autorDeOutraConversa(eduardo, [{ de: "cliente", autor: "+55 66 9925-6119", chave: "crisp:1" }]), null);

const lote = new Date("2026-10-08T20:38:02.000Z");
const gravadas = [
  { de: "cliente", autor: "+55 85 9901-1757", chave: "wa:1", texto: "Meu WhatsApp está bloqueado", criadoEm: new Date("2026-10-08T20:20:00Z") },
  { de: "cliente", autor: "+55 66 9925-6119", chave: "wa:2", texto: "Amanda S.: Na Point Smart 2…", criadoEm: lote },
  { de: "nos", autor: "Cardápio Web (Reputação)", chave: "wa:3", texto: "Fabiano, é exatamente como ela explicou", criadoEm: lote },
  { de: "nos", autor: "Cardápio Web (Reputação)", chave: "wa:4", texto: "Boa tarde, Eduardo!", criadoEm: new Date("2026-10-08T20:32:02Z") },
];
const limpas = semMensagensDeOutraConversa(eduardo, gravadas);
conferir("o lote intruso sai inteiro, inclusive a nossa mensagem dele", limpas.map((m) => m.chave), ["wa:1", "wa:4"]);

console.log("\n  O NOME QUE A CONVERSA DÁ\n");
conferir("“Boa tarde, Eduardo!”", nomeDaConversa([{ de: "nos", texto: "Boa tarde, Eduardo!" }]), "Eduardo");
conferir("“Oii, Ana”", nomeDaConversa([{ de: "nos", texto: "Oii, Ana" }]), "Ana");
conferir("“Fabiano, você está com o caixa aberto?”", nomeDaConversa([{ de: "nos", texto: "Fabiano, você está com o caixa aberto?" }]), "Fabiano");
conferir("“Oii, estou entrando em contato” não tem nome", nomeDaConversa([{ de: "nos", texto: "Oii, estou entrando em contato" }]), "");
conferir("“Perfeito, vou verificar” não tem nome", nomeDaConversa([{ de: "nos", texto: "Perfeito, vou verificar" }]), "");
conferir("dois nomes chamados: misturado, sem nome", nomeDaConversa(gravadas), "");
conferir("sem o lote intruso, o nome volta", nomeDaConversa(limpas), "Eduardo");
conferir("o nome que o cliente escreve não conta (só o que nós usamos)", nomeDaConversa([{ de: "cliente", texto: "Boa tarde, Carlos" }]), "");

console.log("\n  COMO CHAMAR O CLIENTE\n");
conferir("contato sem nome e ficha “Não informado”: o da conversa", nomeDoCliente({ contatoNome: "+55 85 9901-1757" }, "Não informado", limpas), "Eduardo");
conferir("ficha com nome vale mais que a conversa", nomeDoCliente({ contatoNome: "+55 34 9820-0379" }, "Jair Faustino", [{ de: "nos", texto: "Oi, Jair" }]), "Jair Faustino");
conferir("ficha com o telefone gravado como nome não vale", nomeDoCliente({ contatoNome: "+55 83 9394-3375" }, "+55 83 9394-3375", [{ de: "nos", texto: "Bom dia, Thales!" }]), "Thales");

console.log(falhas === 0 ? "\n  A conversa sabe de quem é.\n" : `\n  ${falhas} falha(s).\n`);
process.exit(falhas === 0 ? 0 : 1);
