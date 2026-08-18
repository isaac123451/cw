/**
 * Casamento por contato — telefone, e-mail e nome.
 *
 * É o que permite sair do WhatsApp e chegar no caso: a conversa dá um
 * telefone, a base dá reclamações, e o encontro entre os dois tem que
 * ser explícito sobre a própria confiança.
 *
 * **O detalhe que decide tudo:** o telefone gravado na base está
 * mascarado — `(27)•••••-4053`, apenas DDD e os quatro últimos dígitos.
 * Foi verificado nas 334 reclamações do banco: 100% nesse formato, seis
 * dígitos visíveis. Comparar número inteiro nunca vai casar, e fingir
 * que casou seria pior do que não achar nada.
 *
 * Então a chave real é **DDD + quatro últimos**. Medida na base: 291
 * chaves distintas, e apenas **uma** aponta para dois clientes
 * diferentes. É boa o bastante para usar, e frágil o bastante para
 * precisar ser rotulada — daí `Confianca`.
 */

/** Quão certo é o encontro. A tela mostra isto, não esconde. */
export type Confianca =
  | "exata"
  | "provavel"
  | "ambigua"
  | "nenhuma";

export interface TelefoneLido {
  /** Dígitos já sem DDI e sem pontuação. */
  digitos: string;

  ddd?: string;

  ultimos4?: string;

  /** true quando o número veio inteiro, e não mascarado. */
  completo: boolean;
}

export function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

/**
 * Interpreta um telefone vindo de qualquer lado — WhatsApp, cadastro ou
 * a base mascarada.
 *
 * O corte do DDI só acontece acima de 11 dígitos: um fixo de São Paulo
 * gravado como `5511...` tem 10 dígitos e cortar o "55" o transformaria
 * em outro número.
 */
export function lerTelefone(
  valor?: string | null
): TelefoneLido | null {

  const cru = somenteDigitos(String(valor ?? ""));

  if (cru.length < 6) return null;

  let digitos = cru;

  if (digitos.length > 11 && digitos.startsWith("55")) {
    digitos = digitos.slice(2);
  }

  // Sobrou DDI de outro país ou lixo à esquerda: fica com o final, que
  // é a parte que identifica a linha.
  if (digitos.length > 11) {
    digitos = digitos.slice(-11);
  }

  const ultimos4 = digitos.slice(-4);

  /**
   * O DDD só é conhecido em dois casos: número completo (10 ou 11
   * dígitos) ou o formato mascarado da base, que tem exatamente seis —
   * DDD mais os quatro finais. Um celular solto de nove dígitos não diz
   * de qual estado é.
   */
  const temDdd =
    digitos.length >= 10 || digitos.length === 6;

  return {
    digitos,
    ddd: temDdd ? digitos.slice(0, 2) : undefined,
    ultimos4,
    completo: digitos.length >= 10,
  };
}

/**
 * Compara dois telefones já lidos.
 *
 * `exata` só sai quando os dois números vieram inteiros e são iguais —
 * hoje isso não acontece com a base mascarada, mas passa a acontecer
 * sozinho no dia em que a importação rodar com `--pii`.
 */
export function compararTelefone(
  a: TelefoneLido | null,
  b: TelefoneLido | null
): "exata" | "parcial" | null {

  if (!a || !b) return null;

  if (a.completo && b.completo) {
    return a.digitos === b.digitos ? "exata" : null;
  }

  if (!a.ultimos4 || a.ultimos4 !== b.ultimos4) {
    return null;
  }

  // DDD desconhecido de um dos lados não invalida: só não confirma.
  if (a.ddd && b.ddd && a.ddd !== b.ddd) return null;

  return "parcial";
}

/**
 * Compara e-mails sabendo que um dos lados pode estar mascarado.
 *
 * A máscara preserva as duas primeiras letras, o domínio e — quando o
 * usuário tem mais de cinco caracteres — o próprio comprimento, porque
 * o número de bolinhas é `tamanho - 2`. Isso é fraco sozinho (dois
 * "ma••••••@gmail.com" existem), então serve de reforço, nunca de
 * única prova.
 */
export function compararEmail(
  a?: string | null,
  b?: string | null
): "exata" | "parcial" | null {

  const um = String(a ?? "").trim().toLowerCase();
  const dois = String(b ?? "").trim().toLowerCase();

  if (!um || !dois) return null;

  if (um === dois) return "exata";

  const [usuarioUm, dominioUm] = um.split("@");
  const [usuarioDois, dominioDois] = dois.split("@");

  if (!dominioUm || dominioUm !== dominioDois) return null;

  if (usuarioUm.slice(0, 2) !== usuarioDois.slice(0, 2)) {
    return null;
  }

  const mascarado = (v: string) => v.includes("•");

  if (!mascarado(usuarioUm) && !mascarado(usuarioDois)) {
    return null;
  }

  /** Comprimento confere quando a máscara não bateu no piso de três. */
  const cabe = (m: string, inteiro: string) =>
    m.length === inteiro.length || m.length === 5;

  return cabe(usuarioUm, usuarioDois) ||
    cabe(usuarioDois, usuarioUm)
    ? "parcial"
    : null;
}

/**
 * Nome sem acento, sem caixa e sem espaço duplicado.
 *
 * A faixa de marcas de acento vai escrita como \u0300-\u036f, e nao com os
 * caracteres combinantes soltos: eles sobrevivem mal a uma troca de
 * codificacao no Windows.
 */
export function normalizarNome(valor?: string | null) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compara nomes.
 *
 * O WhatsApp mostra o nome como está na agenda do celular — "João
 * Pizzaria", "Joao RA" —, quase nunca igual ao nome do cadastro. Então
 * vale também o encontro por primeiro + último nome, que sobrevive a
 * apelido no meio.
 */
export function compararNome(
  a?: string | null,
  b?: string | null
): "exata" | "parcial" | null {

  const um = normalizarNome(a);
  const dois = normalizarNome(b);

  if (!um || !dois) return null;

  if (um === dois) return "exata";

  const partesUm = um.split(" ").filter(Boolean);
  const partesDois = dois.split(" ").filter(Boolean);

  // Nome único ("Maria") casaria com meia base — exige dois pedaços.
  if (partesUm.length < 2 || partesDois.length < 2) {
    return null;
  }

  const chave = (p: string[]) =>
    `${p[0]} ${p[p.length - 1]}`;

  return chave(partesUm) === chave(partesDois)
    ? "parcial"
    : null;
}

/** Chave usada para agrupar e para diagnosticar colisão. */
export function chaveTelefone(
  telefone: TelefoneLido | null
) {
  if (!telefone?.ultimos4) return null;

  return `${telefone.ddd ?? "??"}-${telefone.ultimos4}`;
}
