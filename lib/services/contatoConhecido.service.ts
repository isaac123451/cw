import type { PrismaClient } from "@prisma/client";

import { lerTelefone, normalizarNome, type TelefoneLido } from "@/lib/services/contato.service";
import { nomeDeContato, semNome } from "@/lib/models/case";

/**
 * Quem é este contato — quando o telefone não basta.
 *
 * O Isaac: "a identificação de contatos ainda está bem ruim". Medido em
 * 23/09/2026: os 239 estabelecimentos não têm telefone nem e-mail na
 * base, e só 108 das 1.724 respostas de NPS têm telefone. Pelo número do
 * WhatsApp, a extensão só achava reclamação.
 *
 * Duas saídas, as duas com a pessoa decidindo:
 * 1. **Candidatos pelo nome** do contato (o WhatsApp mostra o nome da
 *    loja ou da pessoa): clientes do NPS, reclamações e contas, com a
 *    semelhança medida por palavras que distinguem — "Pizzaria" sozinha
 *    não casa com metade da base.
 * 2. **"É este"**: confirmado uma vez, o telefone fica ligado à ficha
 *    (`ContatoConhecido`) e a próxima consulta já acha, em qualquer
 *    computador.
 */

/** Palavras que não distinguem ninguém: artigos, sufixos de empresa e o ramo. */
const GENERICAS = new Set([
  "de", "da", "do", "das", "dos", "e", "a", "o", "the", "and",
  "ltda", "me", "mei", "eireli", "sa", "epp", "cia", "comercio", "servicos",
  "pizzaria", "pizza", "pizzas", "restaurante", "lanchonete", "lanches", "lanche", "hamburgueria", "burger",
  "bar", "delivery", "cozinha", "food", "foods", "acai", "sorveteria", "padaria", "doceria", "cafe", "cafeteria",
  "espetinho", "pastelaria", "sushi", "temakeria", "marmitaria", "grill", "churrascaria", "bistro", "casa",
  "loja", "oficial", "cardapio", "web", "atendimento", "suporte", "financeiro", "gerente", "dono", "dona",
]);

export function palavrasQueDistinguem(nome?: string | null) {
  return normalizarNome(String(nome ?? "").replace(/[._-]+/g, " "))
    .split(" ")
    .filter((p) => p.length >= 3 && !GENERICAS.has(p));
}

/**
 * De 0 a 1: quanto os dois nomes são a mesma pessoa ou a mesma loja.
 *
 * Igual depois de normalizar é 1. Senão, a fração das palavras que
 * distinguem (do nome menor) que aparecem no outro — "Bella Napoli" e
 * "Pizzaria Bella Napoli Ltda" dão 1; "Pizzaria Central" e "Pizzaria
 * Bella" dão 0, porque "pizzaria" não conta.
 */
export function semelhancaDeNome(a?: string | null, b?: string | null) {
  const um = normalizarNome(a);
  const dois = normalizarNome(b);
  if (!um || !dois) return 0;
  if (um === dois) return 1;
  const pa = new Set(palavrasQueDistinguem(a));
  const pb = new Set(palavrasQueDistinguem(b));
  if (pa.size === 0 || pb.size === 0) return 0;
  const [menor, maior] = pa.size <= pb.size ? [pa, pb] : [pb, pa];
  let comuns = 0;
  for (const p of menor) if (maior.has(p)) comuns += 1;
  return Math.max(comuns / menor.size, juntos(a, b));
}

/**
 * O nome escrito junto: o cliente do NPS é o começo do e-mail
 * (`treduartepizzaria`), e o WhatsApp mostra "Tre Duarte Pizzaria". As
 * palavras que distinguem, coladas, dentro do outro nome colado — com
 * pelo menos 6 letras, para "ana" não casar com "mariana".
 */
function juntos(a?: string | null, b?: string | null) {
  const colar = (s?: string | null) => normalizarNome(String(s ?? "").replace(/[._-]+/g, " ")).replace(/ /g, "");
  const ja = palavrasQueDistinguem(a).join("");
  const jb = palavrasQueDistinguem(b).join("");
  const ca = colar(a);
  const cb = colar(b);
  if ((ja.length >= 6 && cb.includes(ja)) || (jb.length >= 6 && ca.includes(jb))) return 0.8;
  return 0;
}

export type TipoDeCandidato = "nps" | "caso" | "conta";

export interface CandidatoDeContato {
  tipo: TipoDeCandidato;
  /** O id do NPS, o protocolo do caso ou o id da conta. */
  ref: string;
  titulo: string;
  detalhe: string;
  semelhanca: number;
}

/** O limite de semelhança para sugerir: metade das palavras que distinguem. */
export const SEMELHANCA_MINIMA = 0.5;

export async function candidatosPorNome(prisma: PrismaClient, nome: string, limite = 6): Promise<CandidatoDeContato[]> {

  const palavras = palavrasQueDistinguem(nome).slice(0, 5);
  if (palavras.length === 0) return [];

  const contem = (campo: string) => palavras.map((p) => ({ [campo]: { contains: p, mode: "insensitive" as const } }));

  const [nps, casos, contas] = await Promise.all([
    prisma.npsResponse.findMany({
      where: { OR: [...contem("customerName"), ...contem("company"), ...contem("customer")] },
      select: { id: true, customer: true, customerName: true, company: true, email: true, score: true, respondedAt: true, status: true },
      orderBy: { respondedAt: "desc" },
      take: 200,
    }),
    prisma.case.findMany({
      where: { OR: [...contem("customer"), ...palavras.map((p) => ({ company: { name: { contains: p, mode: "insensitive" as const } } }))] },
      select: { protocol: true, customer: true, company: { select: { name: true } }, title: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.establishment.findMany({
      where: { OR: contem("name") },
      select: { id: true, name: true, plan: true, status: true, city: true },
      take: 50,
    }),
  ]);

  const lista: CandidatoDeContato[] = [];

  /* NPS: um por cliente (o e-mail), o ciclo mais recente. */
  const vistos = new Set<string>();
  for (const r of nps) {
    const quem = (r.email ?? r.customer).toLowerCase();
    if (vistos.has(quem)) continue;
    const s = Math.max(semelhancaDeNome(nome, r.customerName), semelhancaDeNome(nome, r.company), semelhancaDeNome(nome, r.customer));
    if (s < SEMELHANCA_MINIMA) continue;
    vistos.add(quem);
    lista.push({
      tipo: "nps",
      ref: r.id,
      titulo: r.customerName || r.company || r.customer,
      detalhe: `NPS nota ${r.score} · ${r.respondedAt.toISOString().slice(8, 10)}/${r.respondedAt.toISOString().slice(5, 7)} · ${r.email ?? r.customer}`,
      semelhanca: s,
    });
  }

  for (const c of casos) {
    const s = Math.max(semelhancaDeNome(nome, c.customer), semelhancaDeNome(nome, c.company?.name));
    if (s < SEMELHANCA_MINIMA) continue;
    lista.push({ tipo: "caso", ref: c.protocol, titulo: c.customer, detalhe: `${c.protocol} · ${c.status} · ${c.title.slice(0, 60)}`, semelhanca: s });
  }

  for (const e of contas) {
    const s = semelhancaDeNome(nome, e.name);
    if (s < SEMELHANCA_MINIMA) continue;
    lista.push({ tipo: "conta", ref: e.id, titulo: e.name, detalhe: ["conta", e.plan, e.status, e.city].filter(Boolean).join(" · "), semelhanca: s });
  }

  return lista.sort((a, b) => b.semelhanca - a.semelhanca).slice(0, limite);
}

/** A chave do telefone na tabela: os dígitos sem o 55. */
export function chaveDoContato(telefone: string | TelefoneLido | null | undefined) {
  const lido = typeof telefone === "string" ? lerTelefone(telefone) : telefone ?? null;
  return lido && lido.digitos.length >= 10 ? lido.digitos : null;
}

export async function lerContatoConhecido(prisma: PrismaClient, telefone: TelefoneLido | null) {
  const chave = chaveDoContato(telefone);
  if (!chave) return null;
  return prisma.contatoConhecido.findUnique({ where: { telefone: chave } }).catch(() => null);
}

/**
 * Liga o telefone à ficha escolhida. No NPS, guarda também o e-mail
 * (que acha todos os ciclos do cliente) e completa o telefone da
 * resposta se ela não tinha — só no vazio, nunca troca.
 */
export async function vincularContato(
  prisma: PrismaClient,
  entrada: { telefone: string; nome?: string; tipo: TipoDeCandidato; ref: string; por: string }
): Promise<{ ok: true } | { ok: false; erro: string }> {

  const chave = chaveDoContato(entrada.telefone);
  if (!chave) return { ok: false, erro: "Sem o telefone completo do contato não dá para lembrar — abra a conversa no WhatsApp." };

  const dados: { protocolo: string | null; npsResponseId: string | null; email: string | null; establishmentId: string | null } = {
    protocolo: null,
    npsResponseId: null,
    email: null,
    establishmentId: null,
  };

  if (entrada.tipo === "nps") {
    const r = await prisma.npsResponse.findUnique({ where: { id: entrada.ref }, select: { id: true, email: true, phone: true, establishmentId: true } });
    if (!r) return { ok: false, erro: "Essa resposta de NPS não existe mais." };
    dados.npsResponseId = r.id;
    dados.email = r.email ?? null;
    dados.establishmentId = r.establishmentId ?? null;
    if (!r.phone) await prisma.npsResponse.update({ where: { id: r.id }, data: { phone: chave } });
  } else if (entrada.tipo === "caso") {
    const c = await prisma.case.findUnique({ where: { protocol: entrada.ref }, select: { protocol: true, establishmentId: true, customer: true } });
    if (!c) return { ok: false, erro: "Esse caso não existe mais." };
    dados.protocolo = c.protocol;
    dados.establishmentId = c.establishmentId ?? null;
    /* Vinculou a pessoa: a reclamação que chegou sem nome ganha o do contato. Só no vazio, nunca troca. */
    const nomeDoContato = nomeDeContato(entrada.nome);
    if (nomeDoContato && semNome(c.customer)) {
      await prisma.case.update({ where: { protocol: c.protocol }, data: { customer: nomeDoContato } });
    }
  } else {
    const e = await prisma.establishment.findUnique({ where: { id: entrada.ref }, select: { id: true } });
    if (!e) return { ok: false, erro: "Essa conta não existe mais." };
    dados.establishmentId = e.id;
  }

  const nome = String(entrada.nome ?? "").trim().slice(0, 120);
  await prisma.contatoConhecido.upsert({
    where: { telefone: chave },
    create: { telefone: chave, nome, vinculadoPor: entrada.por, ...dados },
    update: { nome, vinculadoPor: entrada.por, vinculadoEm: new Date(), ...dados },
  });
  return { ok: true };
}
