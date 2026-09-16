/**
 * Duas pessoas no mesmo caso, sem uma apagar a outra (Fase 10.1).
 *
 * **O que acontecia.** A tela mandava o caso inteiro em cada gravação.
 * Duas pessoas com o mesmo caso aberto: a primeira troca o responsável,
 * a segunda — que abriu antes — salva a categoria e manda junto o
 * responsável **antigo**. O trabalho da primeira desaparece sem
 * nenhum aviso, e ninguém descobre porque nada falhou.
 *
 * **O que passa a acontecer.** A tela manda também o retrato de quando
 * ela carregou o caso. Com ele dá para separar três coisas:
 *
 * - **meus**: o que eu mudei (novo ≠ o que eu tinha);
 * - **deles**: o que mudou no banco desde que eu carreguei (atual ≠ o
 *   que eu tinha);
 * - **conflito**: o que está nas duas listas com valores diferentes.
 *
 * Sem conflito, grava só os **meus** — o que a outra pessoa mudou fica
 * de pé, mesmo estando no mesmo caso. Com conflito, não grava nada e
 * diz quais campos e quando: apagar o trabalho de alguém em silêncio é
 * pior do que pedir para tentar de novo.
 *
 * **Por que comparar colunas e não campos da tela.** A comparação
 * acontece no formato que vai para o banco (`toCaseColumns`). Assim não
 * existe uma segunda tabela de "campo da tela → coluna" para ficar
 * desatualizada, e o que se compara é exatamente o que se grava.
 */

/**
 * Um valor de coluna, comparável por texto.
 *
 * Ausente e nulo ganham marcas próprias entre parênteses: sem elas, o
 * texto "null" digitado num campo seria igual ao campo vazio.
 */
function comoTexto(valor: unknown): string {
  if (valor === undefined) return "(vazio:undefined)";
  if (valor === null) return "(vazio:null)";
  if (valor instanceof Date) return valor.toISOString();
  if (Array.isArray(valor)) return JSON.stringify(valor);
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

export function igual(a: unknown, b: unknown) {
  return comoTexto(a) === comoTexto(b);
}

export interface ComparacaoDeEdicao {
  /** O que esta gravação muda em relação ao que a tela tinha. */
  meus: string[];
  /** O que mudou no banco desde que a tela carregou. */
  deles: string[];
  /** O que os dois mexeram, com valores diferentes. */
  conflito: string[];
}

/**
 * A comparação de três pontas.
 *
 * `undefined` do lado novo não conta como mudança: é o Prisma pulando o
 * campo de propósito (`recebidaEm`, `establishmentManual`), e tratá-lo
 * como alteração faria toda gravação parecer mexer em tudo.
 */
export function compararEdicao(
  anterior: Record<string, unknown>,
  novo: Record<string, unknown>,
  atual: Record<string, unknown>
): ComparacaoDeEdicao {

  const chaves = new Set([
    ...Object.keys(anterior),
    ...Object.keys(novo),
    ...Object.keys(atual),
  ]);

  const meus: string[] = [];
  const deles: string[] = [];
  const conflito: string[] = [];

  for (const chave of chaves) {

    const mudeiEu =
      novo[chave] !== undefined && !igual(novo[chave], anterior[chave]);

    const mudouLa = !igual(atual[chave], anterior[chave]);

    if (mudeiEu) meus.push(chave);
    if (mudouLa) deles.push(chave);

    /*
      Os dois mudando para o **mesmo** valor não é conflito: é duas
      pessoas concordando. Avisar aí seria ruído.
    */
    if (mudeiEu && mudouLa && !igual(novo[chave], atual[chave])) {
      conflito.push(chave);
    }
  }

  return { meus, deles, conflito };
}

/** O nome do campo em português, para o aviso na tela. */
export const ROTULO_DA_COLUNA: Record<string, string> = {
  status: "etapa",
  priority: "prioridade",
  category: "categoria",
  subcategory: "subcategoria",
  owner: "responsável",
  ownerId: "responsável",
  title: "título",
  description: "relato",
  publicResponse: "resposta pública",
  publicResponseAt: "data da resposta pública",
  draftResponse: "rascunho da resposta",
  causaRaiz: "causa raiz",
  customer: "nome do consumidor",
  companyName: "estabelecimento",
  establishmentId: "estabelecimento",
  document: "CPF/CNPJ",
  email: "e-mail",
  phone: "telefone",
  city: "cidade",
  state: "estado",
  score: "nota do consumidor",
  resolved: "resolvido",
  voltaria: "voltaria a fazer negócio",
  evaluated: "avaliada",
  churnRisk: "risco de cancelamento",
  tags: "etiquetas",
  department: "área",
  teamId: "área",
  recebidaEm: "data de recebimento",
  deadline: "prazo",
  followers: "seguidores",
  perfil: "perfil",
};

export function rotuloDaColuna(coluna: string) {
  return ROTULO_DA_COLUNA[coluna] ?? coluna;
}

export interface ConflitoDeEdicao {
  /** Os campos em português, sem repetir. */
  campos: string[];
  /** Quando o caso foi alterado do outro lado. */
  quando?: string;
}

/** A frase do aviso — a mesma na tela do caso e na do quadro. */
export function fraseDoConflito(conflito: ConflitoDeEdicao) {

  const lista =
    conflito.campos.length <= 1
      ? conflito.campos[0]
      : `${conflito.campos.slice(0, -1).join(", ")} e ${conflito.campos[conflito.campos.length - 1]}`;

  return `Outra pessoa mudou ${lista} enquanto você editava. Recarregue para ver o que ela fez — nada foi gravado, para não apagar o trabalho dela.`;
}
