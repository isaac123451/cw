import { entenderLinha, type LinhaEntendida } from "@/lib/models/linhaDaAgenda";

/**
 * O que se pede à IA em palavras e vira ação (08/10/2026).
 *
 * "Ela marca lembrete, faz anotações, finaliza atividades." Três comandos,
 * reconhecidos antes de a pergunta ir para o modelo — porque são ação, e
 * ação não pode depender de o modelo entender do mesmo jeito toda vez:
 *
 * - "me lembra de ligar pro João amanhã às 10h" → atividade na agenda;
 * - "anota no RA-xyz que o cliente aceitou o desconto" → anotação na ficha;
 * - "concluí o retorno da Ana" / "marca como feito o relatório" → fecha a
 *   atividade aberta que bate com o texto.
 *
 * O resto continua sendo pergunta. Quem grava é `executarComandoDaIA`.
 */

export type ComandoDaIA =
  | { tipo: "lembrete"; linha: LinhaEntendida }
  | { tipo: "anotacao"; protocolo: string; texto: string }
  | { tipo: "feito"; busca: string };

const sem = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const LEMBRETE = /^(?:por favor,?\s+)?(?:me\s+)?(?:lembr(?:a|e|ar|ete)|cria(?:r)?\s+(?:um\s+)?(?:lembrete|atividade|tarefa)|crie\s+(?:um\s+)?(?:lembrete|atividade|tarefa)|agenda(?:r)?|marca(?:r)?\s+(?:um\s+)?(?:lembrete|atividade))\b(?:\s+(?:de|que|para|pra|:))?\s*/i;
const ANOTACAO = /^(?:por favor,?\s+)?(?:anot(?:a|e|ar)|registr(?:a|e|ar)|coloc(?:a|ar)\s+(?:uma\s+)?nota)\s+(?:(?:no|na|em|ao)\s+)?(?:caso\s+|ficha\s+(?:do\s+|da\s+)?)?([A-Z]{2}-[\w-]{4,})\s*(?::|,|-|que|\s)\s*([\s\S]+)$/i;
const FEITO = /^(?:ja\s+)?(?:conclui|concluido|fiz|terminei|finalizei|feito|marca(?:r)?\s+como\s+feit[oa]|fecha(?:r)?\s+a\s+atividade)\b\s*:?\s*(?:o|a|os|as)?\s*(.+)$/i;

/**
 * O comando da frase, ou `null` quando ela é pergunta.
 *
 * @param hoje AAAA-MM-DD em Brasília — "amanhã" conta daí.
 * @param protocolos os que existem: a anotação só vale para caso real.
 */
export function entenderComando(texto: string, hoje: string, protocolos: ReadonlySet<string> = new Set()): ComandoDaIA | null {
  const frase = texto.trim();
  if (frase.length < 6 || frase.endsWith("?")) return null;

  const anotacao = frase.match(ANOTACAO);
  if (anotacao) {
    const protocolo = anotacao[1].toUpperCase().startsWith("RA-") ? `RA-${anotacao[1].slice(3)}` : anotacao[1];
    const corpo = anotacao[2].trim();
    if (corpo.length >= 3 && (protocolos.size === 0 || protocolos.has(protocolo))) return { tipo: "anotacao", protocolo, texto: corpo };
  }

  const feito = sem(frase).match(FEITO);
  if (feito && feito[1].trim().length >= 3) return { tipo: "feito", busca: frase.slice(frase.length - feito[1].length).trim() };

  const lembrete = frase.match(LEMBRETE);
  if (lembrete) {
    const resto = frase.slice(lembrete[0].length).trim();
    const linha = resto.length >= 3 ? entenderLinha(resto, hoje, protocolos) : null;
    if (linha && linha.title.trim().length >= 3) return { tipo: "lembrete", linha };
  }

  return null;
}

/** As palavras que contam para achar a atividade: sem artigo, preposição nem palavra curta. */
function palavras(t: string) {
  const fora = new Set(["de", "da", "do", "das", "dos", "com", "para", "pra", "que", "uma", "um", "o", "a", "os", "as", "e", "no", "na", "em"]);
  return sem(t)
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length >= 3 && !fora.has(p));
}

/**
 * A atividade aberta que o "concluí …" quer dizer: a de mais palavras em
 * comum, se for uma só e tiver ao menos duas (ou uma, quando a busca tem
 * uma palavra só). Empate ou nada parecido → nenhuma, e a resposta lista
 * as candidatas — fechar a atividade errada é pior do que perguntar.
 */
export function atividadeDoFeito<T extends { id: string; title: string }>(busca: string, abertas: T[]): { escolhida: T | null; candidatas: T[] } {
  const procuradas = palavras(busca);
  if (!procuradas.length) return { escolhida: null, candidatas: [] };
  const pontuadas = abertas
    .map((t) => {
      const doTitulo = new Set(palavras(t.title));
      return { t, pontos: procuradas.filter((p) => doTitulo.has(p)).length };
    })
    .filter((x) => x.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos);
  const minimo = procuradas.length === 1 ? 1 : 2;
  const melhor = pontuadas[0];
  if (!melhor || melhor.pontos < minimo) return { escolhida: null, candidatas: pontuadas.slice(0, 3).map((x) => x.t) };
  if (pontuadas[1] && pontuadas[1].pontos === melhor.pontos) return { escolhida: null, candidatas: pontuadas.filter((x) => x.pontos === melhor.pontos).slice(0, 3).map((x) => x.t) };
  return { escolhida: melhor.t, candidatas: [] };
}
