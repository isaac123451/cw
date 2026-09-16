/**
 * Prova a leitura das conversas do WhatsApp.
 *
 *   npm run check:conversas
 *
 * O arquivo "Exportar conversa" tem dois formatos (Android e iPhone), com
 * mensagem de várias linhas, aviso do sistema e marcas invisíveis; o .zip
 * traz o texto comprimido. E o que se guarda não pode levar dado
 * bancário. Sem banco: arquivos montados aqui.
 */
import { deflateRawSync } from "node:zlib";

import {
  assinatura,
  chaveDoConteudo,
  contatoDoNomeDoArquivo,
  evidenciaDaConversa,
  instanteDoCarimbo,
  planilhaDaConversa,
  textoDaConversaExportada,
  lerExportDoWhatsApp,
  mensagensDoArquivo,
  omitirDadosBancarios,
  palpiteDoNosso,
  type ConversaView,
} from "../lib/models/conversa";
import { textoDoZip } from "../lib/models/zipDoWhatsApp";
import { paredeDe } from "../lib/services/horasUteis";

let falhas = 0;

function confere(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`${ok ? "ok  " : "FALHOU"}  ${nome}${ok ? "" : `\n        esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`}`);
}

/** A marca de direção invisível que o iPhone põe no começo das linhas. */
const LRM = String.fromCharCode(0x200e);

const brasilia = (iso: string) => {
  const { dia, min } = paredeDe(new Date(iso));
  return `${dia} ${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
};

(async () => {
  console.log("\n— Android —");
  const android = [
    "14/09/2026 10:30 - As mensagens e as ligações são protegidas com a criptografia de ponta a ponta.",
    "14/09/2026 10:32 - Reputação CW: Olá, Maria! Aqui é da Cardápio Web.",
    "14/09/2026 10:40 - Maria Silva: Oi! O cardápio não abre",
    "desde ontem à noite.",
    "Já tentei de tudo.",
    "14/09/2026 10:41 - Maria Silva: <Mídia oculta>",
    "14/09/2026 11:05 - Reputação CW: Resolvido: era o horário de funcionamento. Pode conferir?",
  ].join("\n");
  const a = lerExportDoWhatsApp(android, "Conversa do WhatsApp com Maria Silva.txt");
  confere("o contato sai do nome do arquivo", a.contato, "Maria Silva");
  confere("cinco mensagens (a de três linhas é uma só)", a.mensagens.length, 5);
  confere("o aviso de criptografia é do sistema", a.mensagens[0].autor, null);
  confere("mensagem com Enter guarda as linhas", a.mensagens[2].texto, "Oi! O cardápio não abre\ndesde ontem à noite.\nJá tentei de tudo.");
  confere("mídia vira marcador", a.mensagens[3].texto, "[mídia não incluída]");
  confere("a hora é de Brasília", brasilia(a.mensagens[1].em), "2026-09-14 10:32");
  confere("o nosso lado é quem não é o contato", palpiteDoNosso(a), "Reputação CW");
  const comuns = mensagensDoArquivo(a, "Reputação CW");
  confere("os lados", comuns.map((m) => m.de), ["sistema", "nos", "cliente", "cliente", "nos"]);

  console.log("\n— iPhone —");
  const iphone = [
    LRM + "[14/09/26, 10:32:15] Reputação CW: Bom dia, João",
    "[14/09/26, 10:35:02] João: bom dia. meu pedido não chegou no iFood: 3 vezes hoje",
    LRM + "[14/09/26, 10:36:00] João: " + LRM + "imagem anexada",
  ].join("\n");
  const i = lerExportDoWhatsApp(iphone, "WhatsApp Chat with João.txt");
  confere("três mensagens", i.mensagens.length, 3);
  confere("a marca invisível não entra no nome", i.mensagens[0].autor, "Reputação CW");
  confere("dois-pontos dentro do texto não viram autor", i.mensagens[1].texto, "bom dia. meu pedido não chegou no iFood: 3 vezes hoje");
  confere("ano de dois dígitos", brasilia(i.mensagens[1].em), "2026-09-14 10:35");
  confere("contato em inglês", contatoDoNomeDoArquivo("WhatsApp Chat with João.zip"), "João");

  console.log("\n— O .zip do WhatsApp —");
  const zipado = montarZip("Conversa do WhatsApp com Maria Silva.txt", android, true);
  const lido = await textoDoZip(zipado.buffer.slice(zipado.byteOffset, zipado.byteOffset + zipado.byteLength) as ArrayBuffer);
  confere("acha o .txt e descomprime", lido.texto, android);
  confere("o nome vem junto", lido.nome, "Conversa do WhatsApp com Maria Silva.txt");
  const guardado = montarZip("_chat.txt", iphone, false);
  confere("aceita sem compressão", (await textoDoZip(guardado.buffer.slice(guardado.byteOffset, guardado.byteOffset + guardado.byteLength) as ArrayBuffer)).texto, iphone);
  let erro = "";
  try {
    await textoDoZip(new TextEncoder().encode("não sou zip").buffer as ArrayBuffer);
  } catch (e) {
    erro = (e as Error).message;
  }
  confere("arquivo que não é zip explica", erro, "Este arquivo não é um .zip válido.");

  console.log("\n— Dados bancários não se guardam —");
  confere("cartão (Luhn)", omitirDadosBancarios("o cartão é 4111 1111 1111 1111 ok").texto, "o cartão é [dado bancário omitido] ok");
  confere("número comprido que não é cartão fica", omitirDadosBancarios("protocolo 1234567890123").texto, "protocolo 1234567890123");
  confere("chave pix", omitirDadosBancarios("minha chave pix: maria@email.com").texto, "minha chave pix: [dado bancário omitido]");
  confere("agência e conta", omitirDadosBancarios("ag 1234 cc 56789-0").texto, "ag [dado bancário omitido] cc [dado bancário omitido]");
  confere("conta sozinha", omitirDadosBancarios("conta 123456-7").texto, "conta [dado bancário omitido]");
  confere("cvv", omitirDadosBancarios("cvv 123").texto, "cvv [dado bancário omitido]");
  confere("conta quantos saíram", omitirDadosBancarios("pix: 11999998888 e cartão 4111111111111111").omitidos, 2);
  confere("texto normal passa intacto", omitirDadosBancarios("O pedido 4521 chegou às 12:30.").omitidos, 0);

  console.log("\n— Juntar sem repetir —");
  const daExtensao = { de: "nos" as const, texto: "Olá, Maria! Aqui é da Cardápio Web.", em: instanteDoCarimbo("10:32, 14/09/2026") };
  confere("o carimbo da extensão vira o mesmo minuto do arquivo", assinatura(daExtensao), assinatura(comuns[1]));
  confere("a chave do arquivo é estável", chaveDoConteudo(comuns[1]), chaveDoConteudo({ ...comuns[1] }));
  confere("outra mensagem, outra chave", chaveDoConteudo(comuns[1]) === chaveDoConteudo(comuns[4]), false);
  confere("carimbo inválido não inventa hora", instanteDoCarimbo("ontem"), null);
  confere("carimbo com a data antes da hora", instanteDoCarimbo("14/09/2026, 10:32"), instanteDoCarimbo("10:32, 14/09/2026"));

  console.log("\n— A conversa como evidência —");
  const lista = comuns.map((m, k) => ({ id: String(k), de: m.de, texto: m.texto, em: m.em ?? undefined, origem: "arquivo" as const }));
  const ev = evidenciaDaConversa(lista);
  confere("o 1º contato é a nossa mensagem que teve resposta", ev.primeiroContato?.texto, "Olá, Maria! Aqui é da Cardápio Web.");
  confere("sem confirmação clara, não sugere validação", ev.validacaoSugerida, null);
  const comConfirmacao = [...lista, { id: "9", de: "cliente" as const, texto: "Voltou sim, obrigada!", em: "2026-09-14T14:10:00.000Z", origem: "arquivo" as const }];
  confere("\"voltou, obrigada\" depois de nós é a validação provável", evidenciaDaConversa(comConfirmacao).validacaoSugerida?.id, "9");
  const soNos = lista.filter((m) => m.de !== "cliente");
  confere("mensagem nossa sem resposta é tentativa, não 1º contato", evidenciaDaConversa(soNos).primeiroContato, null);
  const clientePrimeiro = [{ id: "a", de: "cliente" as const, texto: "obrigado, funcionou", em: "2026-09-14T13:00:00.000Z", origem: "arquivo" as const }];
  confere("\"funcionou\" antes de qualquer mensagem nossa não é validação", evidenciaDaConversa(clientePrimeiro).validacaoSugerida, null);


  console.log("\n— Exportar a conversa —");
  const guardada: ConversaView = {
    id: "c1",
    contatoNome: "Maria Silva",
    telefone: "5527999996862",
    mensagens: 4,
    temResumo: true,
    guardadaPor: "Carlos Isaac",
    atualizadoEm: "2026-09-14T14:00:00.000Z",
    nosNome: "Reputação CW",
    resumo: "Cardápio não abria; era o horário de funcionamento.",
    caso: { id: "x", protocolo: "RA-123", frente: "Reclame Aqui" },
    lista: [
      { id: "1", de: "sistema", texto: "As mensagens são protegidas com a criptografia de ponta a ponta.", em: "2026-09-14T13:30:00.000Z", origem: "arquivo" },
      { id: "2", de: "nos", texto: "Olá, Maria! Aqui é da Cardápio Web.", em: "2026-09-14T13:32:00.000Z", origem: "arquivo" },
      { id: "3", de: "cliente", texto: "Oi! O cardápio não abre\ndesde ontem à noite.", em: "2026-09-14T13:40:00.000Z", origem: "extensao" },
      { id: "4", de: "nos", texto: "Resolvido: era o horário de funcionamento.", em: "2026-09-14T14:05:00.000Z", origem: "extensao" },
    ],
  };

  const exportado = textoDaConversaExportada(guardada, { exportadaPor: "Carlos Isaac", exportadaEm: "2026-09-15T12:00:00.000Z" });
  confere(
    "o cabeçalho diz de quem é e o que está ligado",
    exportado.split("\n").slice(0, 3).join(" | "),
    "Conversa do WhatsApp com Maria Silva (+5527999996862) | 4 mensagem(ns) · guardada no CW Reputação por Carlos Isaac | Caso: RA-123 (Reclame Aqui)"
  );
  confere(
    "a mensagem sai no formato do WhatsApp",
    exportado.split("\n").find((l) => l.includes("Olá, Maria")),
    "14/09/2026 10:32 - Reputação CW: Olá, Maria! Aqui é da Cardápio Web."
  );

  /* A prova que importa: o arquivo exportado volta pela importação. */
  const devolta = lerExportDoWhatsApp(exportado, "Conversa do WhatsApp com Maria Silva.txt");
  confere("a volta tem as mesmas quatro mensagens", devolta.mensagens.length, 4);
  confere("os lados voltam iguais", mensagensDoArquivo(devolta, "Reputação CW").map((m) => m.de), ["sistema", "nos", "cliente", "nos"]);
  confere("as horas voltam iguais", mensagensDoArquivo(devolta, "Reputação CW").map((m) => m.em), guardada.lista.map((m) => m.em));
  confere("a mensagem de duas linhas continua uma só", devolta.mensagens[2].texto, "Oi! O cardápio não abre\ndesde ontem à noite.");
  confere("o cabeçalho não vira mensagem", devolta.ignoradas >= 3, true);

  const planilha = planilhaDaConversa(guardada);
  confere(
    "a planilha separa data, hora, quem e de onde veio",
    [planilha[1].Data, planilha[1].Hora, planilha[1].Quem, planilha[1].Origem],
    ["14/09/2026", "10:32", "Nós", "Arquivo exportado"]
  );

  console.log(falhas ? `\n${falhas} conferência(s) falharam.\n` : "\nTudo certo.\n");
  process.exit(falhas ? 1 : 0);
})();

/** Um .zip de uma entrada, como o WhatsApp gera (deflate) ou guardado (sem compressão). */
function montarZip(nome: string, texto: string, comprimir: boolean) {
  const nomeB = Buffer.from(nome, "utf8");
  const dados = Buffer.from(texto, "utf8");
  const corpo = comprimir ? deflateRawSync(dados) : dados;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x800, 6);
  local.writeUInt16LE(comprimir ? 8 : 0, 8);
  local.writeUInt32LE(corpo.length, 18);
  local.writeUInt32LE(dados.length, 22);
  local.writeUInt16LE(nomeB.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x800, 8);
  central.writeUInt16LE(comprimir ? 8 : 0, 10);
  central.writeUInt32LE(corpo.length, 20);
  central.writeUInt32LE(dados.length, 24);
  central.writeUInt16LE(nomeB.length, 28);
  central.writeUInt32LE(0, 42);
  const inicioCentral = local.length + nomeB.length + corpo.length;
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(1, 8);
  fim.writeUInt16LE(1, 10);
  fim.writeUInt32LE(central.length + nomeB.length, 12);
  fim.writeUInt32LE(inicioCentral, 16);
  return Buffer.concat([local, nomeB, corpo, central, nomeB, fim]);
}
