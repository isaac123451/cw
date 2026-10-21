/**
 * O que a IA aprende com as conversas do time (21/10/2026) — as regras
 * puras: o que é sensível e não sai daqui, a chave que junta o mesmo
 * aprendizado, e quais aprendizados servem para uma conversa.
 *
 * "Ela precisa sempre aprender mais e mais verificando as minhas conversas
 * no WhatsApp com os clientes como também no Slack, seja com o
 * desenvolvimento ou alguma conversa privada, desde que não tenha
 * informação sensível."
 */

const norma = (t: string) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

/**
 * Mensagem que nem vai para a IA: fala de senha, token, chave, cartão,
 * conta bancária, salário, saúde, demissão — o "privado" que não é
 * conhecimento de trabalho.
 */
const SENSIVEL =
  /\b(senha|password|token|api[ _-]?key|chave (de )?(api|acesso|secreta)|segredo|cartao de credito|numero do cartao|cvv|conta bancaria|agencia e conta|salario|holerite|atestado|exame medico|doenca|demissao|demitid|processo trabalhista|divorcio)\b/;

export function ehSensivel(texto: string) {
  return SENSIVEL.test(norma(texto));
}

/**
 * Tira o que identifica gente ou dá acesso: CPF, CNPJ, e-mail, telefone,
 * número de cartão, link com parâmetro, código longo.
 */
export function semDadoSensivel(texto: string) {
  return String(texto ?? "")
    /* O cartão primeiro: a regra do telefone pegava o meio dele ("41[telefone] 1111"). */
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[número]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[documento]")
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[documento]")
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[e-mail]")
    .replace(/(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, "[telefone]")
    .replace(/https?:\/\/\S+\?\S+/g, "[link]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[código]");
}

/** A chave do aprendizado: o assunto sem acento, sem pontuação e sem palavra vazia. */
const VAZIAS = new Set(["a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas", "para", "por", "com", "um", "uma", "que"]);
export function chaveDoAprendizado(assunto: string) {
  return norma(assunto)
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((p) => p && !VAZIAS.has(p))
    .slice(0, 8)
    .join("-")
    .slice(0, 120);
}

export interface Aprendizado {
  assunto: string;
  texto: string;
  vezes: number;
}

/**
 * Os aprendizados que servem para esta conversa: os que dividem palavras
 * com ela, os mais repetidos primeiro. Sem nada em comum, nenhum — a IA
 * não recebe conhecimento solto que a distrairia.
 */
export function relevantes(aprendizados: Aprendizado[], texto: string, maximo = 6): Aprendizado[] {
  const palavras = new Set(
    norma(texto)
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((p) => p.length > 3 && !VAZIAS.has(p))
  );
  return aprendizados
    .map((a) => {
      const deles = norma(`${a.assunto} ${a.texto}`).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((p) => p.length > 3);
      const comuns = new Set(deles.filter((p) => palavras.has(p))).size;
      return { a, comuns };
    })
    .filter((x) => x.comuns >= 2)
    .sort((x, y) => y.comuns - x.comuns || y.a.vezes - x.a.vezes)
    .slice(0, maximo)
    .map((x) => x.a);
}
