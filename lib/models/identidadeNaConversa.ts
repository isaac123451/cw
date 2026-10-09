import { nomeDeContatoValido } from "@/lib/models/conversa";

/**
 * De quem é a conversa — e o que nela não é (09/10/2026).
 *
 * **O defeito.** "A IA fez anotações para um cliente errado." Ao trocar de
 * conversa no WhatsApp Web, a tela ainda mostrava as mensagens da conversa
 * anterior quando a extensão já tinha passado para o contato novo — e a
 * gravação automática guardou as mensagens do Fabiano (maquininha Point
 * Smart) na conversa do Eduardo (bloqueio do WhatsApp). A IA resumiu e
 * anotou na ficha do Eduardo. Na base, 5 das 32 conversas tinham mensagens
 * de outra (36 do cliente, mais as nossas gravadas no mesmo lote).
 *
 * **O sinal.** O carimbo de cada mensagem do WhatsApp traz o autor:
 * "[20:24, 08/10/2026] +55 66 9925-6119: ". Na conversa do Eduardo, as
 * mensagens intrusas vinham com o número do Fabiano. Num 1:1, toda
 * mensagem do cliente tem o autor do próprio contato — o número, ou o
 * nome dele na agenda.
 *
 * **O nome.** Contato fora da agenda mostra o número no lugar do nome; o
 * cabeçalho às vezes mostra "clique para mostrar os dados do contato".
 * Nada disso é nome de pessoa — e a IA chegou a gravar "+55 83 9394-3375"
 * como nome e empresa de quatro reclamações. O nome que a conversa dá é o
 * que nós usamos com ele: "Boa tarde, Eduardo!".
 */

const digitos = (s: string | null | undefined) => String(s ?? "").replace(/\D/g, "");

/** "+55 66 9925-6119", "(66) 99925-6119", "5566992561 19": só número e pontuação. */
export function pareceTelefone(texto: string | null | undefined) {
  const t = String(texto ?? "").trim();
  return /^[\s+\d().-]+$/.test(t) && digitos(t).length >= 8;
}

/** O mesmo número, com ou sem DDI e com ou sem o nono dígito: os 8 finais. */
export function mesmoTelefone(a: string | null | undefined, b: string | null | undefined) {
  const x = digitos(a);
  const y = digitos(b);
  return x.length >= 8 && y.length >= 8 && x.slice(-8) === y.slice(-8);
}

/** Nome de gente: sem número no lugar, sem texto da tela do WhatsApp, com letras. */
export function nomeDePessoa(nome: string | null | undefined) {
  const t = nomeDeContatoValido(nome);
  if (!t || pareceTelefone(t) || /@|https?:|\d{4,}/.test(t)) return "";
  return /\p{L}{2,}/u.test(t) ? t : "";
}

const semAcento = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Dois nomes falam da mesma pessoa? Um contém o outro, ou dividem uma palavra de 3+ letras. */
function mesmoNome(a: string, b: string) {
  const x = semAcento(a);
  const y = semAcento(b);
  if (x.includes(y) || y.includes(x)) return true;
  const palavras = new Set(x.split(/[^a-z]+/).filter((p) => p.length >= 3));
  return y.split(/[^a-z]+/).some((p) => p.length >= 3 && palavras.has(p));
}

export interface MensagemComAutor {
  de: string;
  autor?: string | null;
  chave?: string | null;
}

/**
 * O autor de uma mensagem do cliente que não é o contato desta conversa —
 * ou null quando todas batem.
 *
 * Telefone contra telefone é certeza. Nome contra nome só acusa quando os
 * dois são nomes de gente e não têm nada em comum: o cabeçalho e o carimbo
 * mostram o mesmo nome da agenda, então "Ana Paula" e "Ana" são a mesma
 * pessoa, e na dúvida a mensagem fica.
 */
export function autorDeOutraConversa(
  contato: { telefone?: string | null; nome?: string | null },
  mensagens: MensagemComAutor[]
): string | null {
  const nomeDoContato = nomeDePessoa(contato.nome);
  for (const m of mensagens) {
    if (m.de !== "cliente" || !m.autor) continue;
    if (m.chave && !m.chave.startsWith("wa:")) continue;
    const autor = m.autor.trim();
    if (pareceTelefone(autor)) {
      if (digitos(contato.telefone).length >= 8 && !mesmoTelefone(autor, contato.telefone)) return autor;
      continue;
    }
    const nomeDoAutor = nomeDePessoa(autor);
    if (nomeDoAutor && nomeDoContato && !mesmoNome(nomeDoAutor, nomeDoContato)) return autor;
  }
  return null;
}

/**
 * A conversa sem o que veio de outra — para quem lê o que já foi gravado.
 *
 * O lote inteiro sai: quando a tela era a da conversa anterior, as nossas
 * mensagens daquele lote ("Fabiano, é exatamente como ela explicou") também
 * eram de lá. O lote é o instante da gravação (`criadoEm`).
 */
export function semMensagensDeOutraConversa<T extends MensagemComAutor & { criadoEm?: Date | string | null }>(
  contato: { telefone?: string | null; nome?: string | null },
  mensagens: T[]
): T[] {
  const lotesAlheios = new Set<string>();
  for (const m of mensagens) {
    if (autorDeOutraConversa(contato, [m])) lotesAlheios.add(m.criadoEm ? new Date(m.criadoEm).toISOString() : `sem-lote:${m.chave}`);
  }
  if (lotesAlheios.size === 0) return mensagens;
  return mensagens.filter((m) => {
    const lote = m.criadoEm ? new Date(m.criadoEm).toISOString() : `sem-lote:${m.chave}`;
    return !lotesAlheios.has(lote);
  });
}

/* Palavras que abrem frase e não são nome: "Perfeito, ...", "Entendi, ...". */
const NAO_E_NOME_PROPRIO = new Set(
  [
    "oi", "oii", "oiii", "opa", "eai", "salve", "ei", "ola", "bom", "boa", "dia", "tarde", "noite", "tudo", "bem", "certo", "perfeito", "entendi", "entendo", "obrigado",
    "obrigada", "claro", "pode", "posso", "vou", "estou", "estamos", "vamos", "ok", "okay", "sim", "nao", "beleza", "show",
    "otimo", "excelente", "desculpe", "desculpa", "agora", "aqui", "pronto", "certinho", "olha", "veja", "entao", "senhor",
    "senhora", "prezado", "prezada", "cliente", "pessoal", "gente", "amigo", "amiga", "querido", "querida", "cardapio", "web",
    "suporte", "equipe", "time", "parabens", "infelizmente", "felizmente", "conforme", "segue", "seguem", "lembrando", "atenciosamente",
    "isso", "esse", "essa", "este", "esta", "voce", "voces", "seu", "sua", "nosso", "nossa", "mas", "porem", "inclusive", "alias",
  ].map(semAcento)
);

/** "Boa tarde, Eduardo!", "Oi Ana, tudo bem?", "Fabiano, você está com o caixa aberto?" */
const SAUDACAO = /^(?:[Oo]i+|[Oo]l[aá]+|[Oo]pa|[Bb]om dia|[Bb]oa tarde|[Bb]oa noite|[Tt]udo bem|[Ee] a[ií])[\s,!.]+(\p{Lu}\p{Ll}{2,})(?=[\s,!.?]|$)/u;
const VOCATIVO = /^(\p{Lu}\p{Ll}{2,}),\s/u;

/**
 * O nome que nós usamos com o cliente — só quando é um só.
 *
 * Dois nomes diferentes chamados na mesma conversa (o Eduardo e o
 * Fabiano) querem dizer que algo está misturado: aí não há nome.
 */
export function nomeDaConversa(mensagens: { de: string; texto: string }[]) {
  const vistos = new Map<string, string>();
  for (const m of mensagens) {
    if (m.de !== "nos") continue;
    const t = m.texto.trim();
    const achado = t.match(SAUDACAO)?.[1] ?? t.match(VOCATIVO)?.[1];
    if (!achado || NAO_E_NOME_PROPRIO.has(semAcento(achado))) continue;
    vistos.set(semAcento(achado), achado);
  }
  return vistos.size === 1 ? [...vistos.values()][0] : "";
}

/**
 * Como chamar o cliente: o nome da agenda, o da ficha, o que nós usamos na
 * conversa — nessa ordem —, e o número só no fim, para leitura.
 */
export function nomeDoCliente(
  contato: { contatoNome?: string | null; telefone?: string | null },
  ficha: string | null | undefined,
  mensagens: { de: string; texto: string }[]
) {
  const daFicha = /^n[aã]o informado$/i.test(String(ficha ?? "").trim()) ? "" : nomeDePessoa(ficha);
  return nomeDePessoa(contato.contatoNome) || daFicha || nomeDaConversa(mensagens);
}
