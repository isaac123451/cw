import type { AgendaTask } from "@/lib/models/agenda";
import type { Case } from "@/lib/models/case";
import type { FrenteId } from "@/lib/models/frentes";
import type { ItemDaRotina } from "@/lib/models/meuDia";
import type { GoogleEvent } from "@/lib/models/google";
import type { CaseMovement } from "@/lib/models/movement";
import { nomeDoCliente, type NpsResponseView } from "@/lib/models/nps";
import type { SlaRule } from "@/lib/models/sla";

import { caseHref, isOpen, isSocial } from "@/lib/services/case.service";
import { EXPEDIENTE_PADRAO, paredeDe, type Expediente } from "@/lib/services/horasUteis";
import { movementStatus } from "@/lib/services/movement.service";
import { slaStatus } from "@/lib/services/sla.service";

/**
 * Tudo o que tem dia e hora, no mesmo lugar (Fase 25).
 *
 * O Isaac: "na parte da agenda, tudo está muito desorganizado, não dá
 * vontade de chegar lá e usar", e "os lembretes precisam aparecer por
 * lá". A Agenda mostrava só as atividades criadas à mão; os prazos que
 * de fato mandam no dia — o 1º contato de um caso, a solução, o retorno
 * de uma área, o 1º contato do NPS — viviam em outras telas.
 *
 * Aqui eles viram compromissos: a atividade e o evento do Google como
 * foram marcados, e os prazos calculados pelo mesmo relógio das telas
 * (`slaStatus`, `movementStatus`). Só entra o que ainda pode ser
 * cumprido; o que já estourou vira um número — são dezenas, e numa
 * linha do tempo esconderiam o resto.
 */

export type OrigemDoCompromisso = "atividade" | "google" | "prazo-caso" | "prazo-nps" | "area" | "ligacao";

export interface Compromisso {
  id: string;
  origem: OrigemDoCompromisso;
  titulo: string;
  detalhe?: string;
  /** AAAA-MM-DD em Brasília. */
  dia: string;
  /** Minutos desde a meia-noite em Brasília; ausente é "no dia, sem hora". */
  minuto?: number;
  href?: string;
  frente?: FrenteId;
  /** Atividade da agenda: o id, para concluir e passar de dia ali mesmo. */
  tarefaId?: string;
  /** Caso ligado, para abrir na mini-janela. */
  casoId?: string;
  feito: boolean;
}

export interface EntradaDosCompromissos {
  /** O intervalo, em dias de Brasília, inclusive. */
  de: string;
  ate: string;
  tarefas: AgendaTask[];
  eventos?: GoogleEvent[];
  casos?: Case[];
  regras?: SlaRule[];
  movimentos?: CaseMovement[];
  nps?: NpsResponseView[];
  /** As ligações da cadência de hoje, como o Meu dia conta — só existem para o dia de hoje. */
  ligacoes?: { dia: string; itens: ItemDaRotina[] };
  expediente?: Expediente;
  agora?: Date;
}

const minutoDoTexto = (hora?: string) => {
  const m = hora?.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
};

const dentro = (dia: string, de: string, ate: string) => dia >= de && dia <= ate;

export function compromissosEntre(e: EntradaDosCompromissos): Compromisso[] {

  const agora = e.agora ?? new Date();
  const expediente = e.expediente ?? EXPEDIENTE_PADRAO;
  const lista: Compromisso[] = [];

  for (const t of e.tarefas) {
    if (!dentro(t.dueDate, e.de, e.ate)) continue;
    const caso = t.relatedCase ? e.casos?.find((c) => c.protocol === t.relatedCase) : undefined;
    lista.push({
      id: `atividade:${t.id}`,
      origem: "atividade",
      titulo: t.title,
      detalhe: [t.type, t.relatedCompany, t.relatedCase].filter(Boolean).join(" · "),
      dia: t.dueDate,
      minuto: minutoDoTexto(t.time),
      tarefaId: t.id,
      casoId: caso?.id,
      feito: t.done,
    });
  }

  for (const g of e.eventos ?? []) {
    if (!dentro(g.date, e.de, e.ate)) continue;
    lista.push({
      id: `google:${g.id}`,
      origem: "google",
      titulo: g.title,
      detalhe: "Google Agenda",
      dia: g.date,
      minuto: g.allDay ? undefined : minutoDoTexto(g.time),
      href: g.link,
      feito: false,
    });
  }

  const regras = e.regras ?? [];
  for (const c of (e.casos ?? []).filter(isOpen)) {
    const s = slaStatus(c, regras, { expediente, agora });
    if (!s.prazo || s.situation === "estourado") continue;
    const p = paredeDe(new Date(s.prazo));
    if (!dentro(p.dia, e.de, e.ate)) continue;
    lista.push({
      id: `prazo:${c.id}`,
      origem: "prazo-caso",
      titulo: c.title,
      detalhe: `${s.fase === "contato" ? "1º contato" : "solução"} vence · ${c.protocol} · ${c.customer}`,
      dia: p.dia,
      minuto: p.min,
      href: caseHref(c),
      frente: isSocial(c) ? "redes" : "reclame-aqui",
      casoId: c.id,
      feito: false,
    });
  }

  for (const r of e.nps ?? []) {
    if (r.firstContactAt || r.closedAt || !r.firstContactDueAt) continue;
    const vence = new Date(r.firstContactDueAt);
    if (vence.getTime() < agora.getTime()) continue;
    const p = paredeDe(vence);
    if (!dentro(p.dia, e.de, e.ate)) continue;
    lista.push({
      id: `nps:${r.id}`,
      origem: "prazo-nps",
      titulo: `NPS ${r.score} · ${nomeDoCliente(r)}`,
      detalhe: "1º contato vence",
      dia: p.dia,
      minuto: p.min,
      href: `/nps/${r.id}`,
      frente: "nps",
      feito: false,
    });
  }

  const porCaso = new Map((e.casos ?? []).map((c) => [c.id, c]));
  for (const m of e.movimentos ?? []) {
    if (m.returnedAt) continue;
    const s = movementStatus(m, { agora, expediente });
    if (s.situation === "estourado") continue;
    const p = paredeDe(new Date(s.prazo));
    if (!dentro(p.dia, e.de, e.ate)) continue;
    const caso = porCaso.get(m.caseId);
    lista.push({
      id: `area:${m.id}`,
      origem: "area",
      titulo: `Retorno de ${m.destination}`,
      detalhe: [m.reason, caso?.protocol].filter(Boolean).join(" · "),
      dia: p.dia,
      minuto: p.min,
      href: caso ? caseHref(caso) : undefined,
      frente: caso ? (isSocial(caso) ? "redes" : "reclame-aqui") : undefined,
      casoId: caso?.id,
      feito: false,
    });
  }

  /* A cadência de ligações: o período do dia vem no detalhe, sem hora cravada. */
  if (e.ligacoes && dentro(e.ligacoes.dia, e.de, e.ate)) {
    for (const i of e.ligacoes.itens) {
      lista.push({
        id: `ligacao:${i.frente ?? "geral"}:${i.id}`,
        origem: "ligacao",
        titulo: i.titulo,
        detalhe: i.detalhe,
        dia: e.ligacoes.dia,
        href: i.href,
        frente: i.frente,
        casoId: i.frente === "reclame-aqui" || i.frente === "redes" ? i.id : undefined,
        feito: false,
      });
    }
  }

  /* No dia: o que tem hora, pela hora; o resto depois, na ordem em que entrou. */
  return lista.sort((a, b) => a.dia.localeCompare(b.dia) || (a.minuto ?? 24 * 60) - (b.minuto ?? 24 * 60));
}

/**
 * O que ficou para trás: as atividades vencidas (uma a uma, para adiar
 * ou concluir) e o número de prazos estourados, que moram no Meu dia.
 */
export function atrasadosDaAgenda(e: Omit<EntradaDosCompromissos, "de" | "ate"> & { hoje: string }) {
  const agora = e.agora ?? new Date();
  const expediente = e.expediente ?? EXPEDIENTE_PADRAO;
  const atividades = e.tarefas.filter((t) => !t.done && t.dueDate < e.hoje).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const regras = e.regras ?? [];
  const casos = (e.casos ?? []).filter(isOpen).filter((c) => slaStatus(c, regras, { expediente, agora }).situation === "estourado").length;
  const nps = (e.nps ?? []).filter((r) => !r.firstContactAt && !r.closedAt && r.firstContactDueAt && new Date(r.firstContactDueAt).getTime() < agora.getTime()).length;
  const areas = (e.movimentos ?? []).filter((m) => !m.returnedAt && movementStatus(m, { agora, expediente }).situation === "estourado").length;
  return { atividades, prazosEstourados: casos + nps + areas };
}
