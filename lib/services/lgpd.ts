/**
 * O que não pode ir para a resposta pública.
 *
 * A documentação do Reclame Aqui, Passo 7: "Nunca inclua dados pessoais
 * (CPF, e-mail, telefone, valores exatos de contratos) na mensagem
 * pública, ou qualquer política interna e resolução repassada." A
 * resposta pública fica no ar para qualquer pessoa ler — e é indexada.
 *
 * Isto marca o trecho e diz o porquê; não bloqueia. Um "estorno" citado
 * para dizer que ele foi feito pode ser escolha consciente — mas tem de
 * ser consciente. A tela e a extensão pedem confirmação antes de copiar.
 *
 * Detector de padrões, não de sentido: prefere um alarme a mais a um
 * CPF publicado. `npm run check:lgpd` prova cada padrão.
 */

export type TipoDeAchado =
  | "cpf"
  | "cnpj"
  | "email"
  | "telefone"
  | "valor"
  | "condicao";

export interface AchadoLgpd {
  tipo: TipoDeAchado;
  trecho: string;
  inicio: number;
  fim: number;
  motivo: string;
}

const REGRAS: { tipo: TipoDeAchado; padrao: RegExp; motivo: string }[] = [
  {
    tipo: "email",
    padrao: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
    motivo: "E-mail é dado pessoal — fica só no canal privado.",
  },
  {
    tipo: "cnpj",
    padrao: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g,
    motivo: "CNPJ identifica o cliente — não vai para o público.",
  },
  {
    tipo: "cpf",
    padrao: /\b\d{3}\.?\d{3}\.?\d{3}-\d{2}\b|\b\d{11}\b/g,
    motivo: "CPF é dado pessoal sensível à exposição.",
  },
  {
    tipo: "telefone",
    padrao: /(?:\+?55\s?)?(?:\(\d{2}\)|\b\d{2})[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g,
    motivo: "Telefone é dado pessoal — convide para o canal privado sem citar o número.",
  },
  {
    tipo: "valor",
    padrao: /R\$\s?\d[\d.,]*|\b\d+(?:[.,]\d+)?\s?reais\b/gi,
    motivo: "Valor exato de contrato ou de acordo não vai para a resposta pública.",
  },
  {
    tipo: "condicao",
    /*
      Pelo radical, e não pela palavra: "estornamos", "reembolsado",
      "descontamos" dizem o mesmo que "estorno". "Descontente" não é
      desconto — e é justamente a palavra de quem reclama.
    */
    padrao: /\b(?:descont(?!ent)[a-zà-ú]*|estorn[a-zà-ú]*|reembols[a-zà-ú]*|isen[çc][ãa]o|isent[a-zà-ú]*|m[êe]s(?:es)? gr[áa]tis|gratuit[oa]s?|cortesia|b[ôo]nus|renegoci[a-zà-ú]*|pol[íi]tica interna|restitu[a-zà-ú]*)/gi,
    motivo: "Condição negociada ou política interna — a documentação pede para não repassar no público.",
  },
];

/** Os dois dígitos verificadores do CPF (módulo 11). */
export function cpfValido(digitos: string) {

  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;

  const d = digitos.split("").map(Number);

  const dv = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += d[i] * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return dv(9) === d[9] && dv(10) === d[10];
}

/** Os trechos a revisar, na ordem do texto, sem sobreposição. */
export function dadosSensiveis(texto: string): AchadoLgpd[] {

  const achados: AchadoLgpd[] = [];

  for (const regra of REGRAS) {
    for (const m of texto.matchAll(regra.padrao)) {

      const inicio = m.index ?? 0;
      const fim = inicio + m[0].length;

      /* Telefone curto demais é ano, número de pedido ou protocolo. */
      if (regra.tipo === "telefone" && m[0].replace(/\D/g, "").length < 10) continue;

      /*
        Onze dígitos corridos só são CPF se os dígitos verificadores
        batem — senão é celular com DDD, e a regra de telefone o pega.
      */
      if (regra.tipo === "cpf" && /^\d{11}$/.test(m[0]) && !cpfValido(m[0])) continue;

      /* O que outra regra já marcou por inteiro não é marcado de novo. */
      if (achados.some((a) => inicio >= a.inicio && fim <= a.fim)) continue;

      achados.push({ tipo: regra.tipo, trecho: m[0], inicio, fim, motivo: regra.motivo });
    }
  }

  return achados.sort((a, b) => a.inicio - b.inicio);
}

export const ROTULO_DO_ACHADO: Record<TipoDeAchado, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "e-mail",
  telefone: "telefone",
  valor: "valor",
  condicao: "condição negociada",
};

/** "2 telefones, 1 valor" — o resumo para o aviso. */
export function resumoDosAchados(achados: AchadoLgpd[]) {

  const conta = new Map<TipoDeAchado, number>();
  for (const a of achados) conta.set(a.tipo, (conta.get(a.tipo) ?? 0) + 1);

  return [...conta.entries()]
    .map(([tipo, n]) => `${n} ${ROTULO_DO_ACHADO[tipo]}${n > 1 && tipo !== "condicao" ? "s" : ""}`)
    .join(", ");
}

/* ============================================================
   TEXTO REPETIDO
============================================================ */

function palavras(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length > 2);
}

function trincas(texto: string) {
  const p = palavras(texto);
  const saida = new Set<string>();
  for (let i = 0; i + 2 < p.length; i++) saida.add(`${p[i]} ${p[i + 1]} ${p[i + 2]}`);
  return saida;
}

/**
 * Quanto um texto repete outro, de 0 a 100.
 *
 * Por trincas de palavras, e não palavra a palavra: "agradecemos o
 * contato" aparece em qualquer resposta educada e não faz um texto ser
 * cópia; frases inteiras repetidas fazem. Mede o quanto do texto **novo**
 * está no antigo — um texto curto copiado de um longo é cópia.
 */
export function semelhanca(novo: string, antigo: string) {

  const a = trincas(novo);
  const b = trincas(antigo);

  if (a.size < 4 || b.size === 0) return 0;

  let comuns = 0;
  for (const t of a) if (b.has(t)) comuns += 1;

  return Math.round((comuns / a.size) * 100);
}

/** A partir daqui o texto é tratado como macro repetida. */
export const LIMITE_DE_REPETICAO = 60;
