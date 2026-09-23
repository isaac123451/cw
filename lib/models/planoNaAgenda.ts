import type { Contagem, ItemDaRotina, PlanoDoDia } from "@/lib/models/meuDia";
import type { AtividadeDaRotina, ChaveDaRotina } from "@/lib/models/rotina";
import { frente } from "@/lib/models/frentes";

/**
 * O plano do dia na Google Agenda.
 *
 * O Isaac: "preciso que você crie algo para a minha agenda no Google
 * quando montar uma lista de coisas do dia". Cada bloco do plano vira um
 * evento, no horário do bloco, com o motivo e os itens na descrição.
 *
 * **Sem duplicar.** Os eventos levam uma marca privada (o dia e o bloco),
 * que só a plataforma lê. Mandar o plano de novo depois de mexer no dia
 * atualiza os mesmos eventos, cria os blocos novos e tira os que saíram
 * do plano. O que já terminou fica como está — é o registro do que foi
 * o dia —, e evento sem a marca (os seus) nunca é tocado.
 *
 * **Sem dado pessoal a mais.** A descrição leva o título de cada item e
 * o link para a plataforma; o nome do cliente e o comentário do NPS
 * ficam de fora — a agenda é compartilhável, a plataforma não.
 */

/** A marca privada do evento: o dia do plano. */
export const MARCA_DO_PLANO = "cwPlano";
/** E o bloco: a atividade e a frente. */
export const MARCA_DO_BLOCO = "cwBloco";

/** Quantos itens a descrição lista antes do "e mais". */
const ITENS_NA_DESCRICAO = 10;

export interface EventoDoPlano {
  /** `atividadeId:frente` — o bloco, para achar o mesmo evento depois. */
  chave: string;
  titulo: string;
  /** "09:10", em Brasília. */
  inicio: string;
  fim: string;
  descricao: string;
}

export interface EventoExistente {
  id: string;
  /** A marca do bloco; vazia em evento que não é do plano. */
  bloco?: string;
  /** ISO. */
  inicio: string;
  fim: string;
}

/** O título que pode sair da plataforma: no NPS, só a nota (o comentário é do cliente). */
function tituloPublico(i: ItemDaRotina) {
  return i.frente === "nps" ? i.titulo.split(" — ")[0] : i.titulo;
}

export function eventosDoPlano(entrada: {
  plano: Pick<PlanoDoDia, "blocos">;
  atividades: Pick<AtividadeDaRotina, "id" | "titulo" | "chave" | "link">[];
  contagens: Partial<Record<ChaveDaRotina, Pick<Contagem, "itens">>>;
  /** A origem da plataforma, para os links ("https://…"). */
  origem: string;
}): EventoDoPlano[] {

  const { plano, atividades, contagens, origem } = entrada;

  return plano.blocos.map((b) => {

    const a = atividades.find((x) => x.id === b.atividadeId);
    const c = a?.chave ? contagens[a.chave] : undefined;

    /* Os itens deste pedaço: a frente dele, na ordem da contagem — e, quando não coube tudo, só os que couberam. */
    const daFrente = (c?.itens ?? []).filter((i) => (b.frente ? i.frente === b.frente : !i.frente));
    const doBloco = b.itens > 0 ? daFrente.slice(0, b.itens) : daFrente;

    const linhas = [
      b.motivo,
      b.atrasados > 0 ? `${b.atrasados} fora do prazo.` : null,
      doBloco.length ? "" : null,
      ...doBloco.slice(0, ITENS_NA_DESCRICAO).map((i) => `• ${tituloPublico(i)}${i.atrasado ? " (fora do prazo)" : ""} — ${origem}${i.href}`),
      doBloco.length > ITENS_NA_DESCRICAO ? `e mais ${doBloco.length - ITENS_NA_DESCRICAO} — ${origem}/meu-dia` : null,
      !doBloco.length && a?.link ? `${origem}${a.link}` : null,
      "",
      "Montado pelo Meu dia da CW Reputação. Mandar o plano de novo atualiza estes blocos.",
    ].filter((l): l is string => l !== null);

    return {
      chave: `${b.atividadeId}:${b.frente ?? "geral"}`,
      titulo: `${b.titulo}${b.frente ? ` · ${frente(b.frente).curto}` : ""}${b.itens > 0 ? ` (${b.itens})` : ""}`,
      inicio: b.inicio,
      fim: b.fim,
      descricao: linhas.join("\n"),
    };
  });
}

/**
 * O que fazer na agenda para ela ficar igual ao plano.
 *
 * Só entram na conta os eventos do plano que ainda não terminaram: o bloco
 * em andamento é atualizado (e não duplicado), o que já passou fica.
 */
export function sincronizacao(existentes: EventoExistente[], novos: EventoDoPlano[], agora: Date) {

  const vivos = existentes.filter((e) => e.bloco && Date.parse(e.fim) > agora.getTime());
  const usados = new Set<string>();

  const criar: EventoDoPlano[] = [];
  const atualizar: { id: string; evento: EventoDoPlano }[] = [];

  for (const n of novos) {
    const mesmo = vivos.find((e) => e.bloco === n.chave && !usados.has(e.id));
    if (mesmo) {
      usados.add(mesmo.id);
      atualizar.push({ id: mesmo.id, evento: n });
    } else {
      criar.push(n);
    }
  }

  const apagar = vivos.filter((e) => !usados.has(e.id)).map((e) => e.id);

  return { criar, atualizar, apagar };
}

/** O endereço do dia na Google Agenda. */
export function linkDoDia(dia: string) {
  const [a, m, d] = dia.split("-").map(Number);
  return `https://calendar.google.com/calendar/r/day/${a}/${m}/${d}`;
}
