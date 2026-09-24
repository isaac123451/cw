import { paredeDe } from "@/lib/services/horasUteis";

/**
 * Os textos que a documentação traz prontos — montados com o caso.
 *
 * **Não são macros.** A regra de ouro do documento é "sem macros prontas
 * ou textos robotizados" para o cliente; estes são pontos de partida,
 * sempre editáveis antes de copiar, e todos começam pelo que só este
 * caso tem: o nome, o problema, o prazo. O modelo de acionamento das
 * áreas internas, esse sim, a documentação quer padronizado — é o que
 * faz a área achar a informação sempre no mesmo lugar.
 *
 * Nada aqui é enviado: a plataforma monta e copia; quem envia é você.
 */

export function saudacao(agora = new Date()) {
  const h = Math.floor(paredeDe(agora).min / 60);
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function primeiroNome(nome?: string) {
  const limpo = String(nome ?? "").trim();
  if (!limpo || /^n[ãa]o informado$/i.test(limpo)) return "";
  return limpo.split(/\s+/)[0].replace(/^./, (c) => c.toUpperCase());
}

/* ============================================================
   ÁREAS INTERNAS
============================================================ */

export const AREAS_INTERNAS = [
  { nome: "Suporte N2", marca: "@suporte-n2" },
  { nome: "Financeiro", marca: "@financeiro" },
  { nome: "Comercial", marca: "@comercial" },
  { nome: "Desenvolvimento", marca: "@desenvolvimento" },
  { nome: "Implantação", marca: "@implantacao" },
] as const;

export const CANAL_DE_INCIDENTES = "#incidentes-experiencia-do-cliente";

export function marcaDaArea(area: string) {
  return (
    AREAS_INTERNAS.find((a) => a.nome === area)?.marca ??
    `@${area
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`
  );
}

export interface DadosDoAcionamento {
  area: string;
  cliente: string;
  estabelecimento?: string;
  assunto: string;
  tratativa: string;
  prioridade: string;
  /** "até 4h úteis (qua, 16/09 às 10:00)". */
  prazo: string;
  adicionais?: string;
  telefone?: string;
  papel?: string;
  raUrl?: string;
  portalUrl?: string;
  agora?: Date;
}

/**
 * O modelo de acionamento da documentação, preenchido.
 *
 * Mesma ordem e mesmos rótulos do documento — "Contato:", "Conta do
 * cliente:" — para a área achar a informação onde sempre acha. Os quatro
 * itens que o documento exige estão todos aqui: link do RA, portal e
 * nome; resumo e o que é preciso; prazo pela prioridade; contato.
 */
export function mensagemDeAcionamento(d: DadosDoAcionamento) {

  const cliente = d.estabelecimento ? `${d.cliente} (${d.estabelecimento})` : d.cliente;

  return [
    marcaDaArea(d.area),
    `${saudacao(d.agora)}! O cliente ${cliente}, do Reclame Aqui, está com problema: ${d.assunto.trim()}. Precisa ser realizado um contato para ${d.tratativa.trim() || "[tratativa]"}.`,
    "",
    `É um cliente ${d.prioridade}, retorno ${d.prazo}.`,
    "",
    `Informações adicionais: ${d.adicionais?.trim() || "—"}`,
    "",
    `Contato: ${d.telefone?.trim() || "[telefone]"} - ${primeiroNome(d.cliente) || d.cliente}${d.papel ? ` (${d.papel})` : ""}`,
    `Link do RA: ${d.raUrl || "[link da reclamação]"}`,
    `Conta do cliente: ${d.portalUrl || "Portal do parceiro"}`,
  ].join("\n");
}

/**
 * O escalonamento do atraso ao gestor da área.
 *
 * A documentação diz o quê ("o não cumprimento do prazo deve ser
 * escalonado para o gestor da respectiva área"), não como. Curto,
 * factual e sem acusação: prazo, atraso e o que o cliente está sentindo.
 */
export function mensagemDeEscalonamento(d: {
  area: string;
  protocolo: string;
  assunto: string;
  acionadoEm: string;
  vencidoHa: string;
  raUrl?: string;
  agora?: Date;
}) {
  return [
    `${saudacao(d.agora)}! Escalonando, como pede o nosso processo: o caso ${d.protocolo} do Reclame Aqui foi acionado para ${d.area} em ${d.acionadoEm} e o retorno está vencido há ${d.vencidoHa}.`,
    "",
    `Assunto: ${d.assunto.trim()}.`,
    "O cliente segue aguardando e o caso pesa na reputação pública. Consegue priorizar um retorno?",
    d.raUrl ? `\nLink do RA: ${d.raUrl}` : "",
  ]
    .join("\n")
    .trim();
}

/* ============================================================
   PARA O CLIENTE
============================================================ */

/** "Oi, [Nome], estou passando para te avisar…" — Passo 5. */
export function mensagemDeAtualizacao(d: { nome?: string; area?: string; retornoAte?: string }) {
  const nome = primeiroNome(d.nome);
  return `Oi${nome ? `, ${nome}` : ""}! Estou passando para te avisar que ${d.area ? `o time de ${d.area}` : "o time responsável"} já está analisando o seu caso${d.retornoAte ? ` e volto a te chamar até ${d.retornoAte}` : " e te dou notícia assim que tiver novidade"}. Sigo acompanhando de perto.`;
}

/**
 * A pergunta do Passo 6: "confirmar se tudo voltou a funcionar
 * perfeitamente e se não restaram dúvidas ou pendências".
 */
export function mensagemDeValidacao(d: { nome?: string; agente?: string }) {
  const nome = primeiroNome(d.nome);
  const quem = d.agente ? ` Aqui é ${primeiroNome(d.agente)}, da Cardápio Web.` : "";
  return `Oi${nome ? `, ${nome}` : ""}! Tudo bem?${quem} Passando para confirmar se está tudo funcionando direitinho por aí depois do que resolvemos. Ficou alguma dúvida ou pendência? Se tiver qualquer coisa, me conta que eu cuido.`;
}

/**
 * A mensagem pública transparente do Passo 4.
 *
 * Sem dado pessoal nenhum — é pública. Diz que tentamos por telefone e
 * pelos canais privados e que seguimos prontos para ajudar.
 */
export function mensagemPublicaTransparente(d: { nome?: string }) {
  const nome = primeiroNome(d.nome);
  return `Olá${nome ? `, ${nome}` : ""}! Tentamos falar com você por telefone e pelos nossos canais privados para cuidar pessoalmente da sua solicitação, mas ainda não conseguimos contato. Seguimos à disposição e prontos para ajudar assim que você puder retornar — é só nos chamar pelos nossos canais de atendimento.`;
}

/**
 * O pedido de avaliação, que muda de tom a cada lembrete.
 *
 * O documento pede "tom gentil e de proximidade, perguntando se o
 * sistema continua rodando bem e relembrando carinhosamente a
 * importância da nota" — e usar o histórico como gancho. O gancho entra
 * quando existe; sem ele, a pergunta sobre o sistema faz o papel.
 */
export function mensagemDePedidoDeAvaliacao(d: {
  nome?: string;
  numero: number;
  raUrl?: string;
  gancho?: string;
  agente?: string;
}) {

  const nome = primeiroNome(d.nome);
  const oi = `Oi${nome ? `, ${nome}` : ""}! Tudo bem?`;
  const link = d.raUrl ? `\n\nO link da reclamação é este: ${d.raUrl}` : "";
  const quem = d.agente ? ` Aqui é ${primeiroNome(d.agente)}, da Cardápio Web.` : "";

  if (d.numero <= 1) {
    return `${oi}${quem} ${d.gancho ? `${d.gancho.trim()} ` : ""}Fico feliz que a gente conseguiu resolver a sua situação. Se puder, deixa a sua avaliação lá no Reclame Aqui — ela é muito importante para o meu trabalho e para a Cardápio Web continuar melhorando.${link}`;
  }

  if (d.numero <= 3) {
    return `${oi} ${d.gancho ? `${d.gancho.trim()} ` : ""}Passando para saber se o sistema continua rodando bem por aí. E, quando tiver um minutinho, sua avaliação no Reclame Aqui faz muita diferença para a gente.${link}`;
  }

  return `${oi} ${d.gancho ? `${d.gancho.trim()} ` : ""}Só queria saber como estão as coisas com o sistema — se precisar de qualquer coisa, estou por aqui. Se ainda der, a sua avaliação no Reclame Aqui continua sendo muito importante para nós.${link}`;
}
