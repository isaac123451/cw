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
  /** whatsapp · slack · avaliacoes (o que separa a resposta pública boa da ruim). */
  fonte?: string;
}

/*
  Palavras que todo texto daqui tem (16/11/2026): "plataforma", "quando",
  "cliente", "sistema". Elas faziam um aprendizado sobre integração com a
  SAIPOS aparecer numa reclamação de falta de treinamento — as duas
  diziam "plataforma" e "quando". Não contam como palavra em comum.
*/
const COMUNS = new Set(
  "para mais como esta este essa esse isso pois mesmo pelo pela eles elas nada porem agora ainda depois antes tenho estou estava sobre quero seja sendo assim desde apenas porque tudo todos toda todo aqui alem qualquer sempre nunca quem entao deles disso outro outra ficar fica muito quando onde qual quais seus suas sua seu minha meus minhas nosso nossa voce voces cada pode podem deve devem fazer feito tive teve foram eram sera seria hoje vezes forma caso tambem vamos estao tinha cardapio plataforma sistema cliente clientes empresa problema problemas".split(" ")
);

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
      .filter((p) => p.length > 3 && !VAZIAS.has(p) && !COMUNS.has(p))
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

/*
  As dicas da resposta pública (16/11/2026): "a extensão entregou algumas
  informações coerentes com a reclamação e outras sem sentido". Na
  reclamação ID 262352671 (sem treinamento nem suporte), a dica era a
  integração de pedidos com SAIPOS e Foody — casou por "plataforma" e
  "quando". Agora a dica casa pelo ASSUNTO: o aprendizado fala de estorno,
  e a reclamação também; fala de impressão, e a reclamação também. Só os
  aprendizados tirados das respostas públicas avaliadas (fonte
  "avaliacoes"): os do WhatsApp ensinam o produto, não a escrever a
  resposta. Medido nas 394 reclamações: 370 recebem dica, nenhuma por
  palavra solta.
*/
const ASSUNTOS_DA_RECLAMACAO: [string, RegExp][] = [
  ["estorno", /estorn|reembols|devolu|dinheiro de volta|ressarc|devolv/],
  ["cobranca", /cobra|indevid|fatura|boleto|debit/],
  ["pagamento", /pagament|\bpix\b|repasse|boleto|cartao/],
  ["cancelamento", /cancel|rescis|encerr/],
  ["bloqueio", /bloque/],
  ["integracao", /ifood|integracao|integrad|99food|aiqfome|keeta/],
  ["pixel", /pixel|meta ads|facebook/],
  ["impressao", /impress|imprim/],
  ["privacidade", /privacid|lgpd|dados pessoais|expos|vaza/],
  ["reuniao", /reuni/],
  ["suporte", /suporte|atendiment|nao respond|sem resposta|sem retorno|ninguem|demora/],
  ["cashback", /cashback/],
  ["funcionalidade", /funcionalidade|recurso|sugest|melhoria|nao tem a opcao|gostaria que/],
  ["falha", /\bbug|falh|erro|trav|instab|nao funciona|fora do ar|parou/],
  ["pico", /pico|lentid|lento|demora para carregar/],
  ["entrega", /entreg|motoboy/],
  ["whatsapp", /whatsapp|robo|chatbot/],
];

const ASSUNTOS_DO_APRENDIZADO: [string, RegExp][] = [
  ["estorno", /estorno|devolucao|reembolso|dinheiro/],
  ["cobranca", /cobranca|indevida/],
  ["pagamento", /pagamento/],
  ["cancelamento", /cancelamento|encerrar/],
  ["bloqueio", /bloqueio|desbloque/],
  ["integracao", /ifood|integracao/],
  ["pixel", /pixel/],
  ["impressao", /impressao/],
  ["privacidade", /privacidade|dados/],
  ["reuniao", /reuniao/],
  ["suporte", /suporte|canal|canais|contato direto|responsavel|consultivo/],
  ["cashback", /cashback/],
  ["funcionalidade", /funcionalidade|feature|roadmap|melhorias|nova/],
  ["falha", /\bbug|falha|erro|correcao|estabilidade|diagnostico/],
  ["pico", /pico|demanda/],
  ["entrega", /entrega/],
  ["whatsapp", /whatsapp|robo/],
];

/** Os assuntos de que um texto trata. */
export function assuntosDaReclamacao(texto: string): string[] {
  const n = norma(texto);
  return ASSUNTOS_DA_RECLAMACAO.filter(([, re]) => re.test(n)).map(([k]) => k);
}

export function dicasParaAResposta(aprendizados: Aprendizado[], caso: { titulo: string; descricao?: string | null }, maximo = 3): Aprendizado[] {
  const tem = new Set(assuntosDaReclamacao(`${caso.titulo} ${caso.descricao ?? ""}`));
  if (!tem.size) return [];
  const candidatos = aprendizados
    .filter((a) => (a.fonte ?? "avaliacoes") === "avaliacoes")
    .map((a) => {
      const n = norma(a.assunto);
      const exige = ASSUNTOS_DO_APRENDIZADO.filter(([, re]) => re.test(n)).map(([k]) => k);
      const bate = exige.filter((k) => tem.has(k)).length;
      const so = exige.length === 1 && exige[0] === "suporte";
      return { a, bate, so, ok: exige.length > 0 && (bate === exige.length || bate >= 2) };
    })
    .filter((x) => x.ok)
    .sort((x, y) => y.bate - x.bate || Number(x.so) - Number(y.so) || y.a.vezes - x.a.vezes);

  /* O que fala do assunto vem antes; "dê o contato direto" entra uma vez só quando há assunto. */
  const doAssunto = candidatos.filter((x) => !x.so);
  const deSuporte = candidatos.filter((x) => x.so).slice(0, doAssunto.length ? 1 : maximo);
  const escolhidos = [...doAssunto.slice(0, doAssunto.length && deSuporte.length ? maximo - 1 : maximo), ...deSuporte].slice(0, maximo);
  return escolhidos.map((x) => x.a);
}
