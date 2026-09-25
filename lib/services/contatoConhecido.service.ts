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

/* ============================================================
   PISTAS (1.83): o que a conversa, o Slack e o perfil dizem
============================================================ */

export interface PistasDeContato {
  /** CPF/CNPJ que o cliente escreveu — só os dígitos. */
  documentos?: string[];
  emails?: string[];
  /** O endereço do cardápio: "cardapioweb.com/pizzaria-do-ze" → "pizzaria-do-ze". */
  slugs?: string[];
  /** O @ do perfil nas redes — "pizzariadoze" casa com "Pizzaria do Zé" pelo nome colado. */
  perfil?: string;
  nome?: string;
}

/** As pistas que um texto tem, sem guardar o texto: documento, e-mail e endereço do cardápio. */
export function pistasDoTexto(texto: string): Required<Pick<PistasDeContato, "documentos" | "emails" | "slugs">> {
  const t = String(texto ?? "");
  const documentos = [...t.matchAll(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g)]
    .map((m) => m[0].replace(/\D/g, ""))
    .filter((d) => d.length === 11 || d.length === 14);
  const emails = [...t.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)].map((m) => m[0].toLowerCase());
  /* As duas formas do endereço: cardapioweb.com/loja e loja.cardapioweb.com. */
  const slugs = [
    ...[...t.matchAll(/cardapioweb\.com(?:\.br)?\/([a-z0-9][a-z0-9-]{2,60})/gi)].map((m) => m[1]),
    ...[...t.matchAll(/\b([a-z0-9][a-z0-9-]{2,60})\.cardapioweb\.com/gi)].map((m) => m[1]),
  ]
    .map((s) => s.toLowerCase())
    .filter((s) => !["www", "app", "api", "admin", "painel", "login", "loja"].includes(s));
  return { documentos: [...new Set(documentos)], emails: [...new Set(emails)], slugs: [...new Set(slugs)] };
}

/**
 * Candidatos pelas pistas, do mais certo para o mais provável.
 *
 * Documento e e-mail são identidade (semelhança 1): o CNPJ que o cliente
 * escreveu na conversa acha a conta e as reclamações dele mesmo com o
 * telefone e o nome sem casar. O endereço do cardápio acha a conta pelo
 * slug (0,95). O @ do perfil e o nome passam pela semelhança de nome.
 * Cada candidato diz **por que** está ali — a pessoa confirma no "É este".
 */
export async function candidatosPelasPistas(prisma: PrismaClient, pistas: PistasDeContato, limite = 6): Promise<(CandidatoDeContato & { motivo: string })[]> {
  const documentos = [...new Set((pistas.documentos ?? []).map((d) => d.replace(/\D/g, "")).filter((d) => d.length === 11 || d.length === 14))].slice(0, 5);
  const emails = [...new Set((pistas.emails ?? []).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")))].slice(0, 5);
  const slugs = [...new Set((pistas.slugs ?? []).map((s) => s.trim().toLowerCase()).filter((s) => s.length >= 3))].slice(0, 5);

  const lista = new Map<string, CandidatoDeContato & { motivo: string }>();
  const pôr = (c: CandidatoDeContato, motivo: string) => {
    const chave = `${c.tipo}:${c.ref}`;
    const ja = lista.get(chave);
    if (!ja || ja.semelhanca < c.semelhanca) lista.set(chave, { ...c, motivo });
  };

  const [contasPorDoc, casosPorDoc, npsPorEmail, casosPorEmail, contasPorSlug] = await Promise.all([
    documentos.length ? prisma.establishment.findMany({ where: { document: { in: documentos } }, select: { id: true, name: true, plan: true, status: true, city: true, document: true } }) : [],
    documentos.length
      ? prisma.case.findMany({ where: { document: { in: documentos } }, select: { protocol: true, customer: true, title: true, status: true }, orderBy: { createdAt: "desc" }, take: 5 })
      : [],
    emails.length
      ? prisma.npsResponse.findMany({ where: { email: { in: emails, mode: "insensitive" } }, select: { id: true, customer: true, customerName: true, email: true, score: true, respondedAt: true }, orderBy: { respondedAt: "desc" }, take: 5 })
      : [],
    emails.length
      ? prisma.case.findMany({ where: { email: { in: emails, mode: "insensitive" } }, select: { protocol: true, customer: true, title: true, status: true }, orderBy: { createdAt: "desc" }, take: 5 })
      : [],
    slugs.length
      ? prisma.establishment.findMany({
          where: { OR: slugs.flatMap((s) => [{ slug: s }, { portalUrl: { contains: s, mode: "insensitive" as const } }]) },
          select: { id: true, name: true, plan: true, status: true, city: true },
          take: 5,
        })
      : [],
  ]);

  const conta = (e: { id: string; name: string; plan: string; status: string; city: string | null }): CandidatoDeContato => ({
    tipo: "conta",
    ref: e.id,
    titulo: e.name,
    detalhe: ["conta", e.plan, e.status, e.city].filter(Boolean).join(" · "),
    semelhanca: 1,
  });
  for (const e of contasPorDoc) pôr(conta(e), "CPF/CNPJ citado");
  for (const c of casosPorDoc) pôr({ tipo: "caso", ref: c.protocol, titulo: c.customer, detalhe: `${c.protocol} · ${c.status} · ${c.title.slice(0, 60)}`, semelhanca: 1 }, "CPF/CNPJ citado");
  for (const r of npsPorEmail) {
    pôr(
      { tipo: "nps", ref: r.id, titulo: r.customerName || r.customer, detalhe: `NPS nota ${r.score} · ${r.email ?? r.customer}`, semelhanca: 1 },
      "e-mail citado"
    );
  }
  for (const c of casosPorEmail) pôr({ tipo: "caso", ref: c.protocol, titulo: c.customer, detalhe: `${c.protocol} · ${c.status} · ${c.title.slice(0, 60)}`, semelhanca: 1 }, "e-mail citado");
  for (const e of contasPorSlug) pôr({ ...conta(e), semelhanca: 0.95 }, "endereço do cardápio citado");

  /*
    O @ colado ("pizzariavirtual") contra o nome e o endereço de cada
    conta, também colados. A busca por palavra não acha: procura
    "pizzariavirtual" dentro de "Pizzaria Virtual". São poucas centenas de
    contas — comparar todas custa menos que errar.
  */
  const colar = (s: string) => normalizarNome(s).replace(/[^a-z0-9]/g, "");
  const perfilColado = colar((pistas.perfil ?? "").replace(/^@/, ""));
  if (perfilColado.length >= 6) {
    const contas = await prisma.establishment.findMany({ select: { id: true, name: true, plan: true, status: true, city: true, slug: true } });
    for (const e of contas) {
      const nome = colar(e.name);
      const slug = colar(e.slug);
      const s = perfilColado === nome || perfilColado === slug ? 0.9 : (nome.length >= 6 && perfilColado.includes(nome)) || (perfilColado.length >= 8 && nome.includes(perfilColado)) ? 0.75 : 0;
      if (s > 0) pôr({ ...conta(e), semelhanca: s }, "parecido com o perfil");
    }
  }

  /* O @ do perfil vira nome com espaço onde houver ponto, traço ou sublinhado. */
  const perfil = (pistas.perfil ?? "").replace(/^@/, "").replace(/[._-]+/g, " ").trim();
  for (const [texto, motivo] of [
    [perfil, "parecido com o perfil"],
    [pistas.nome ?? "", "parecido com o nome"],
  ] as const) {
    if (!texto) continue;
    for (const c of await candidatosPorNome(prisma, texto, limite)) pôr(c, motivo);
  }

  return [...lista.values()].sort((a, b) => b.semelhanca - a.semelhanca).slice(0, limite);
}

/** Quantas palavras que distinguem os dois nomes têm em comum — "Gomes" sozinho não liga pessoa a loja. */
export function palavrasEmComum(a?: string | null, b?: string | null) {
  const pb = new Set(palavrasQueDistinguem(b));
  return new Set(palavrasQueDistinguem(a).filter((p) => pb.has(p))).size;
}

/**
 * A sugestão pelo nome vale? Só quando as palavras em comum cobrem o
 * nome do contato — até duas. "Bella Napoli" casa com "Pizzaria Bella
 * Napoli"; o sobrenome de uma pessoa no nome de uma loja ("Marcia Gomes"
 * → "Lanche do Gomes", "Dilson Neto" → "Açaí do Neto") não é pista.
 * Medido em 25/09/2026: das 10 sugestões só pelo nome nos casos sem
 * vínculo, todas eram coincidência de uma palavra.
 */
export function nomeSustentaSugestao(nomeDoContato: string, nomeDaConta: string) {
  const exigidas = Math.min(2, palavrasQueDistinguem(nomeDoContato).length);
  return exigidas > 0 && palavrasEmComum(nomeDoContato, nomeDaConta) >= exigidas;
}
