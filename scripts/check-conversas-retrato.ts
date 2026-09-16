/**
 * As Conversas do WhatsApp dizem quem espera, acham o vínculo e
 * consertam o lado?
 *
 *   npm run check:conversas-retrato
 *
 * **O pedido.** "Conversas no WhatsApp eu gostei mas também vejo margem
 * pra melhoria." Quatro melhorias, e a conta de cada uma sem servidor:
 *
 * 1. **o retrato** — quem falou por último, desde quando o cliente espera
 *    e quanto a gente demora, em minutos de expediente;
 * 2. **o telefone** — a chave que acha o mesmo número em outro cadastro
 *    sem confundir DDDs;
 * 3. **os lados** — a conversa com dois autores e um lado só é leitura
 *    errada, e a tela oferece a correção;
 * 4. **a fiação** — filtros, busca navegável e sugestões na tela.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { chaveDoTelefone, ladosDaConversa, retratoDaConversa, type MensagemView } from "../lib/models/conversa";

const RAIZ = resolve(__dirname, "..");

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)?.slice(0, 44)}`);
}

const ler = (arquivo: string) => readFileSync(resolve(RAIZ, arquivo), "utf8");

const msg = (de: MensagemView["de"], em?: string, autor?: string): MensagemView => ({ id: `${de}${em}${autor}`, de, em, autor, texto: "x", origem: "extensao" });

console.log("\n  CONVERSAS DO WHATSAPP — retrato, telefone e lados\n");
console.log("— O retrato —\n");

{
  /* Terça, 15/09/2026. 10h e 10h20 em Brasília = 13h e 13h20 UTC. */
  const r = retratoDaConversa(
    [msg("cliente", "2026-09-15T13:00:00Z"), msg("cliente", "2026-09-15T13:10:00Z"), msg("nos", "2026-09-15T13:20:00Z"), msg("sistema"), msg("cliente", "2026-09-15T14:00:00Z")],
    new Date("2026-09-15T14:45:00Z")
  );
  conferir("a espera conta da 1ª fala sem resposta", [r.ultimaDe, r.esperandoDesde, r.minutosEsperando], ["cliente", "2026-09-15T14:00:00Z", 45]);
  conferir("a resposta conta do começo do bloco do cliente", [r.respostas, r.respostaMediaMin], [1, 20]);
  conferir("aviso do sistema não é fala", [r.doCliente, r.nossas], [3, 1]);

  /* Sábado 12/09 às 15h; resposta segunda 14/09 às 8h05. */
  const fimDeSemana = retratoDaConversa([msg("cliente", "2026-09-12T18:00:00Z"), msg("nos", "2026-09-14T11:05:00Z")], new Date("2026-09-14T12:00:00Z"));
  conferir("sábado respondido segunda 8h05 são 5 minutos úteis", fimDeSemana.respostaMediaMin, 5);
  conferir("a última palavra nossa não espera nada", [fimDeSemana.ultimaDe, fimDeSemana.esperandoDesde], ["nos", undefined]);

  const semHora = retratoDaConversa([msg("cliente"), msg("nos", "2026-09-15T13:00:00Z")], new Date("2026-09-15T14:00:00Z"));
  conferir("sem hora de um lado, a resposta não entra na média", [semHora.respostas, semHora.respostaMediaMin], [0, undefined]);
}

console.log("\n— O telefone —\n");

conferir("com e sem 55, com e sem o 9: a mesma chave", [chaveDoTelefone("+55 48 9909-5712"), chaveDoTelefone("(48) 99909-5712"), chaveDoTelefone("4899095712")], ["4899095712", "4899095712", "4899095712"]);
conferir("mesmo final em DDD diferente é outra pessoa", chaveDoTelefone("11 99909-5712") === chaveDoTelefone("48 99909-5712"), false);
conferir("sem DDD não há chave (não sugere por chute)", chaveDoTelefone("9909-5712"), null);

console.log("\n— Os lados —\n");

{
  const errada = ladosDaConversa([msg("cliente", undefined), msg("cliente", "2026-09-09T20:00:00Z", "Cardápio Web (Reputação)"), msg("cliente", "2026-09-09T20:30:00Z", "+55 48 9909-5712"), msg("cliente", "2026-09-09T20:31:00Z", "+55 48 9909-5712")]);
  conferir("dois autores e um lado só: suspeita", errada.suspeita, true);
  conferir("autores do que mais escreveu ao que menos", errada.autores.map((a) => a.nome), ["+55 48 9909-5712", "Cardápio Web (Reputação)"]);
  conferir("a linha sem autor e sem hora é contada para virar aviso", errada.semAutorESemHora, 1);

  const certa = ladosDaConversa([msg("nos", "2026-09-09T20:00:00Z", "Nós"), msg("cliente", "2026-09-09T20:30:00Z", "Ele")]);
  conferir("com os dois lados, nada a suspeitar", [certa.suspeita, certa.autores.map((a) => a.lado)], [false, ["nos", "cliente"]]);
}

console.log("\n— A fiação —\n");

{
  const tela = ler("components/conversas/Conversas.tsx");
  conferir("filtro 'Esperando a gente' na lista", /chave: "esperando"/.test(tela), true);
  conferir("busca dentro da conversa anda entre as ocorrências", /function andar\(/.test(tela) && /foco=\{foco\}/.test(tela), true);
  conferir("sugestão de vínculo pelo mesmo telefone", /sugestoesDeVinculo\(c\.id\)/.test(tela), true);
  conferir("corrigir os lados só avisa salvo depois do servidor", tela.indexOf("await corrigirLadosDaConversa(") < tela.indexOf('title: "Lados corrigidos"'), true);

  const servico = ler("lib/services/conversas.service.ts");
  conferir("a sugestão compara pela chave, não pelo nome", /chaveDoTelefone\(c\.phone\) === chave/.test(servico), true);
  conferir("corrigir não apaga mensagem nenhuma", /corrigirLados[\s\S]*?deleteMany/.test(servico.slice(servico.indexOf("export async function corrigirLados"))), false);

  const leitor = ler("extensao/conteudo/whatsapp.js");
  conferir("a extensão concilia o lado pelo autor do carimbo", /function conciliarLados\(/.test(leitor) && /msg-dblcheck/.test(leitor), true);
}

console.log(
  falhas === 0
    ? "\n  As conversas dizem quem espera, acham o vínculo e consertam o lado.\n"
    : `\n  ${falhas} ponto(s) a corrigir.\n`
);

process.exit(falhas === 0 ? 0 : 1);
