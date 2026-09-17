import { normalizarTexto, REGRAS_DE_ASSUNTO } from "@/lib/models/sugestaoPorTexto";

/**
 * O motor próprio: lê e resume uma conversa sem nenhuma IA externa
 * (roadmap 2.0, Fase 16).
 *
 * **A decisão do Isaac.** "Quero algo gratuito, se o Anthropic for você
 * pode utilizar, caso contrário trabalhe no agente de IA que você fez
 * para eu utilizar na plataforma e melhorar." A chave da Anthropic é um
 * marcador do `.env.example`; a do Gemini é real, mas tem camada
 * gratuita — e camada gratuita congestiona (medido em 26/08/2026: 503
 * "Gemini congestionado", e o resumo simplesmente não saía). Enquanto o
 * Groq e o OpenRouter não têm chave, o resumo de conversa dependia de
 * um provedor só. Agora não depende de nenhum: quando todos falham (ou
 * nenhum está configurado), este arquivo entrega o mesmo retrato —
 * resumo, assunto, humor, pendência, próximo passo e três rascunhos —
 * por conta e sem inventar nada que não esteja na conversa.
 *
 * **O que é deliberadamente diferente de um modelo de linguagem.** Não
 * há geração livre — cada campo sai de uma regra que se explica sozinha
 * (o léxico de humor, os assuntos da documentação, o estado da última
 * mensagem). É mais raso que a IA nas conversas complexas, e é exatamente
 * tão confiável quanto a regra que o escreveu — nunca inventa protocolo,
 * nome ou prazo, porque não escreve fora do que a conversa e as regras
 * já sabem.
 *
 * Sem banco e sem rede: a conferência prova sem nenhum dos dois.
 */

export interface RespostaPronta {
  titulo: string;
  quando: string;
  texto: string;
}

export interface RetratoDaConversa {
  resumo: string;
  assunto: string;
  humor: 1 | 2 | 3 | 4 | 5;
  pendencia: string;
  proximoPasso: string;
  resposta: string;
  respostas: [RespostaPronta, RespostaPronta, RespostaPronta];
  resolvido: boolean;
}

export interface MensagemDaConversa {
  de: "cliente" | "nos";
  texto: string;
}

/* ============================================================
   HUMOR — léxico de tom, em português do Brasil
============================================================ */

const POSITIVAS = [
  /\botim[oa]\b/, /\bexcelente\b/, /\bperfeit[oa]\b/, /\bador(ei|o)\b/, /\bmaravilh/, /\bshow\b/,
  /\bfuncionou\b/, /\bresolv(id[oa]|eu|emos)\b/, /\bobrigad[oa]/, /\bvaleu\b/, /\bparab[ée]ns\b/, /\bgrat[ao]/,
  /\bajudou\b/, /\btudo certo\b/, /\bdeu certo\b/, /\bfoi [óo]timo\b/, /\bmelhor sistema\b/,
];

const NEGATIVAS_FORTES = [
  /\bp[ée]ssim[oa]\b/, /\bhorr[íi]vel\b/, /\babsurd[oa]\b/, /\brid[íi]cul[oa]\b/, /\binaceit[áa]vel\b/,
  /\bcancel(ar|amento)\b/, /\bprocon\b/, /\bprocess(ar|o)\b/, /\bnunca mais\b/, /\brevoltad[oa]\b/,
  /\bindignad[oa]\b/, /\bdecep[cç]ion/, /\bp[ée]ssimo atendimento\b/, /\bincompetente\b/,
];

const NEGATIVAS_LEVES = [
  /\bn[ãa]o funciona\b/, /\bainda n[ãa]o\b/, /\bdemor(a|ando|ou)\b/, /\bsem resposta\b/, /\bsem retorno\b/,
  /\bat[ée] agora nada\b/, /\bn[ãa]o resolvid[oa]\b/, /\burgente\b/, /\bdif[íi]cil\b/, /\bcomplicado\b/,
  /\bnenhuma novidade\b/, /\bnada foi feito\b/,
];

function pontuarTom(texto: string): number {
  const t = normalizarTexto(texto);
  let n = 0;
  for (const p of POSITIVAS) if (p.test(t)) n += 1;
  for (const p of NEGATIVAS_FORTES) if (p.test(t)) n -= 2;
  for (const p of NEGATIVAS_LEVES) if (p.test(t)) n -= 1;
  return n;
}

/**
 * O humor de agora — as últimas mensagens do cliente pesam mais que as
 * de trás, porque "como o cliente está agora" é o que a trilha usa para
 * decidir o próximo passo, não o tom do começo da conversa.
 */
export function humorDaConversa(mensagens: MensagemDaConversa[]): 1 | 2 | 3 | 4 | 5 {
  const doCliente = mensagens.filter((m) => m.de === "cliente");
  if (doCliente.length === 0) return 3;

  let pontos = 0;
  const n = doCliente.length;
  doCliente.forEach((m, i) => {
    /* A mais recente pesa 3×, a penúltima 2×, o resto 1×. */
    const peso = i >= n - 1 ? 3 : i >= n - 2 ? 2 : 1;
    pontos += pontuarTom(m.texto) * peso;
  });

  if (pontos <= -4) return 1;
  if (pontos <= -1) return 2;
  if (pontos === 0) return 3;
  if (pontos <= 2) return 4;
  return 5;
}

/* ============================================================
   ASSUNTO — as mesmas regras da triagem do Reclame Aqui
============================================================ */

export function assuntoDaConversa(mensagens: MensagemDaConversa[]): string {
  const texto = mensagens.map((m) => m.texto).join(" ");
  const normal = normalizarTexto(texto);
  const achado = REGRAS_DE_ASSUNTO.find((r) => r.padrao.test(normal));
  return achado?.rotulo ?? "Atendimento";
}

/* ============================================================
   RESUMO — extrativo: a primeira e a última fala do cliente
============================================================ */

function condensar(texto: string, limite = 160) {
  const t = texto.replace(/\s+/g, " ").trim();
  return t.length > limite ? `${t.slice(0, limite - 1).trimEnd()}…` : t;
}

export function resumirTexto(mensagens: MensagemDaConversa[]): string {
  const doCliente = mensagens.filter((m) => m.de === "cliente");
  if (doCliente.length === 0) return "O cliente ainda não escreveu nesta conversa.";

  const primeira = condensar(doCliente[0].texto);
  const ultima = condensar(doCliente[doCliente.length - 1].texto);

  if (doCliente.length === 1) return `O cliente relata: "${primeira}"`;
  if (primeira === ultima) return `O cliente insiste no mesmo ponto: "${primeira}"`;

  return `O cliente começou dizendo: "${primeira}" — e, mais recente, escreveu: "${ultima}"`;
}

/* ============================================================
   PENDÊNCIA E PRÓXIMO PASSO — pelo lado de quem falou por último
============================================================ */

const CONFIRMA_RESOLUCAO = [
  /\bresolvid[oa]\b/, /\bfuncionou\b/, /\bconsegui\b/, /\bdeu certo\b/, /\btudo certo\b/, /\bperfeit[oa],?\s*obrigad/,
  /\b[óo]timo,?\s*(valeu|obrigad)/,
];

function pareceResolucao(texto: string) {
  const t = normalizarTexto(texto);
  return CONFIRMA_RESOLUCAO.some((p) => p.test(t));
}

function pareceEncerramentoNosso(texto: string) {
  const t = normalizarTexto(texto);
  return /\bfoi resolvido\b|\bja est[áa] funcionando\b|\bja resolvemos\b|\bfica resolvido\b|\bqualquer coisa,? (é só |eh so )?chamar\b/.test(t);
}

export function estadoDaConversa(mensagens: MensagemDaConversa[]): {
  pendencia: string;
  proximoPasso: string;
  resolvido: boolean;
} {
  const ultima = mensagens[mensagens.length - 1];
  if (!ultima) return { pendencia: "Nada pendente.", proximoPasso: "Nenhuma ação — a conversa está vazia.", resolvido: false };

  const resolvido = pareceResolucao(ultima.texto) || (ultima.de === "nos" && pareceEncerramentoNosso(ultima.texto));

  if (resolvido) {
    return { pendencia: "Nada pendente — a última mensagem indica solução.", proximoPasso: "Confirmar com o cliente e encerrar, se ainda não encerrou.", resolvido: true };
  }

  if (ultima.de === "cliente") {
    const pergunta = /\?\s*$/.test(ultima.texto.trim());
    return {
      pendencia: pergunta ? "O cliente fez uma pergunta e aguarda a resposta." : "O cliente escreveu por último e aguarda retorno da operação.",
      proximoPasso: "Responder ao cliente.",
      resolvido: false,
    };
  }

  const pergunta = /\?\s*$/.test(ultima.texto.trim());
  return {
    pendencia: pergunta ? "A operação perguntou algo e aguarda a resposta do cliente." : "A operação falou por último; ainda sem confirmação do cliente.",
    proximoPasso: pergunta ? "Aguardar o retorno do cliente; cobrar se não vier em um dia útil." : "Acompanhar até o cliente confirmar que ficou resolvido.",
    resolvido: false,
  };
}

/* ============================================================
   RASCUNHOS — os três caminhos, sempre para revisar antes de enviar
============================================================ */

export function rascunhosDaConversa(entrada: {
  nome?: string;
  assunto: string;
  pendencia: string;
  ultimaDoCliente?: string;
}): [RespostaPronta, RespostaPronta, RespostaPronta] {
  const saudacao = entrada.nome ? `Oi, ${entrada.nome.split(/\s+/)[0]}!` : "Oi!";

  return [
    {
      titulo: "Responder agora",
      quando: "O que já se sabe é suficiente para dar uma notícia ao cliente.",
      texto: `${saudacao} Vi sua mensagem sobre ${entrada.assunto.toLowerCase()}. Já estou olhando com atenção e te retorno com uma posição em breve — obrigado pela paciência.`,
    },
    {
      titulo: "Pedir o que falta",
      quando: "Falta um dado do cliente para seguir — um print, um número de pedido, um horário.",
      texto: `${saudacao} Para eu conseguir resolver isso com você, preciso de mais uma informação: pode me confirmar o número do pedido (ou protocolo) e, se possível, um print do que está acontecendo?`,
    },
    {
      titulo: "Confirmar e encerrar",
      quando: "O assunto parece resolvido e falta só a confirmação do cliente.",
      texto: `${saudacao} Passando para confirmar: ficou tudo certo com o que combinamos? Se precisar de mais alguma coisa, é só me chamar por aqui.`,
    },
  ];
}

/* ============================================================
   O RETRATO INTEIRO
============================================================ */

export function retratarConversaSemIA(mensagens: MensagemDaConversa[], contato?: { nome?: string }): RetratoDaConversa {
  const assunto = assuntoDaConversa(mensagens);
  const { pendencia, proximoPasso, resolvido } = estadoDaConversa(mensagens);
  const doCliente = mensagens.filter((m) => m.de === "cliente");
  const respostas = rascunhosDaConversa({
    nome: contato?.nome,
    assunto,
    pendencia,
    ultimaDoCliente: doCliente[doCliente.length - 1]?.texto,
  });

  /* O rascunho principal é o primeiro caminho, salvo quando a conversa já indica que falta o cliente confirmar. */
  const principal = resolvido ? respostas[2] : mensagens[mensagens.length - 1]?.de === "nos" ? respostas[1] : respostas[0];

  return {
    resumo: resumirTexto(mensagens),
    assunto,
    humor: humorDaConversa(mensagens),
    pendencia,
    proximoPasso,
    resposta: principal.texto,
    respostas,
    resolvido,
  };
}
