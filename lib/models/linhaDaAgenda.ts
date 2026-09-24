import type { AgendaTask, TaskType } from "@/lib/models/agenda";

/**
 * Criar uma atividade escrevendo uma linha (Fase 25).
 *
 * "amanhã 10h ligar RA-123" vira: amanhã, 10:00, "Ligar", Follow-up,
 * ligada à RA-123. O que a linha não diz fica com o padrão: hoje, sem
 * hora, Pendência, prioridade Média. Nada é adivinhado além disso — a
 * prévia mostra o que foi entendido antes de criar.
 */

const DIAS: Record<string, number> = {
  domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
  dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6,
};

const TIPOS: { tipo: TaskType; padrao: RegExp }[] = [
  { tipo: "Solicitação de avaliação", padrao: /\bavalia(c|ç)(a|ã)o\b|\bpedir avalia/ },
  { tipo: "Cobrança interna", padrao: /\bcobrar\b|\bcobran(c|ç)a\b|\bescalonar\b/ },
  { tipo: "Follow-up", padrao: /\bligar\b|\bretornar\b|\bretorno\b|\bfollow|\bfup\b|\bfalar com\b|\bmandar mensagem\b/ },
];

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function somarDias(dia: string, n: number) {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

export interface LinhaEntendida {
  title: string;
  dueDate: string;
  time?: string;
  type: TaskType;
  relatedCase?: string;
  /** Os pedaços reconhecidos, para a prévia mostrar o que foi entendido. */
  entendido: string[];
}

/**
 * @param hoje AAAA-MM-DD em Brasília.
 * @param protocolos os protocolos que existem — "RA-123" só liga se o caso existir.
 */
export function entenderLinha(texto: string, hoje: string, protocolos: ReadonlySet<string> = new Set()): LinhaEntendida | null {

  let resto = ` ${texto.trim()} `;
  const entendido: string[] = [];
  let dueDate = hoje;
  let time: string | undefined;
  let relatedCase: string | undefined;

  const tirar = (re: RegExp) => {
    resto = resto.replace(re, " ");
  };

  /* Protocolo: RA-xxxx, ou o código do Reclame Aqui colado sozinho. */
  const prot = resto.match(/\s((?:RA|RS|IG|FB|TT|YT|LI|TK)-[A-Za-z0-9_-]+)(?=[\s,.;]|$)/i);
  if (prot) {
    const achado = [...protocolos].find((p) => p.toLowerCase() === prot[1].toLowerCase()) ?? prot[1].toUpperCase();
    if (protocolos.size === 0 || protocolos.has(achado)) {
      relatedCase = achado;
      entendido.push(achado);
      tirar(new RegExp(`\\s${prot[1].replace(/[-\\/\\\\^$*+?.()|[\]{}]/g, "\\$&")}(?=[\\s,.;]|$)`, "i"));
    }
  }

  const n = sem(resto);

  /* Dia: hoje, amanhã, depois de amanhã, dia da semana, dd/mm. */
  let m: RegExpMatchArray | null;
  if ((m = n.match(/\sdepois de amanha(?=[\s,.;!?])/))) {
    dueDate = somarDias(hoje, 2);
    entendido.push("depois de amanhã");
    resto = resto.slice(0, m.index!) + " " + resto.slice(m.index! + m[0].length);
  } else if ((m = n.match(/\samanha(?=[\s,.;!?])/))) {
    dueDate = somarDias(hoje, 1);
    entendido.push("amanhã");
    resto = resto.slice(0, m.index!) + " " + resto.slice(m.index! + m[0].length);
  } else if ((m = n.match(/\shoje(?=[\s,.;!?])/))) {
    entendido.push("hoje");
    resto = resto.slice(0, m.index!) + " " + resto.slice(m.index! + m[0].length);
  } else if ((m = n.match(/\s(?:(?:na|no|nesta|neste|proxima|proximo)\s)?(domingo|segunda|terca|quarta|quinta|sexta|sabado|dom|seg|ter|qua|qui|sex|sab)(?:-feira)?(?=[\s,.;!?])/))) {
    const alvo = DIAS[m[1]];
    const atual = new Date(`${hoje}T12:00:00Z`).getUTCDay();
    const faltam = ((alvo - atual + 7) % 7) || 7;
    dueDate = somarDias(hoje, faltam);
    entendido.push(`${m[1]} ${dueDate.slice(8, 10)}/${dueDate.slice(5, 7)}`);
    resto = resto.slice(0, m.index!) + " " + resto.slice(m.index! + m[0].length);
  } else if ((m = n.match(/\s(?:dia\s)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=[\s,.;!?])/))) {
    const [, d, mes, a] = m;
    let ano = a ? Number(a.length === 2 ? `20${a}` : a) : Number(hoje.slice(0, 4));
    let candidato = `${ano}-${mes.padStart(2, "0")}-${d.padStart(2, "0")}`;
    if (!a && candidato < hoje) candidato = `${++ano}-${mes.padStart(2, "0")}-${d.padStart(2, "0")}`;
    const t = Date.parse(`${candidato}T00:00:00Z`);
    if (!Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === candidato) {
      dueDate = candidato;
      entendido.push(`${d.padStart(2, "0")}/${mes.padStart(2, "0")}`);
      resto = resto.slice(0, m.index!) + " " + resto.slice(m.index! + m[0].length);
    }
  }

  /* Hora: 10h, 10h30, 10:30, às 14, as 9. */
  const n2 = sem(resto);
  const h = n2.match(/\s(?:as\s)?(\d{1,2})(?:h(\d{2})?|:(\d{2}))(?=[\s,.;!?])/) ?? n2.match(/\sas\s(\d{1,2})(?=[\s,.;!?])/);
  if (h) {
    const hora = Number(h[1]);
    const min = Number(h[2] ?? h[3] ?? 0);
    if (hora < 24 && min < 60) {
      time = `${String(hora).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      entendido.push(time);
      resto = resto.slice(0, h.index!) + " " + resto.slice(h.index! + h[0].length);
    }
  }

  const titulo = resto.replace(/\s+/g, " ").replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, "").trim();
  if (!titulo) return null;

  const type = TIPOS.find((t) => t.padrao.test(sem(titulo)))?.tipo ?? "Pendência";

  return {
    title: titulo.charAt(0).toUpperCase() + titulo.slice(1),
    dueDate,
    time,
    type,
    relatedCase,
    entendido,
  };
}

/** A atividade pronta para criar, com o que a linha não diz. */
export function atividadeDaLinha(l: LinhaEntendida, dono: string): Omit<AgendaTask, "id"> {
  return {
    title: l.title,
    type: l.type,
    owner: dono,
    dueDate: l.dueDate,
    ...(l.time ? { time: l.time } : {}),
    priority: "Média",
    done: false,
    ...(l.relatedCase ? { relatedCase: l.relatedCase } : {}),
  };
}
