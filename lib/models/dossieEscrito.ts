import { conferirDossie, type DossieMontado } from "@/lib/services/dossie.service";

/**
 * As partes escritas do dossiê (Fase 26) e a conferência antes de usar.
 *
 * "Dossiê deve ser feito pela plataforma e precisa levar a estrutura que
 * já te enviei." A identificação, as partes, a linha do tempo e os
 * anexos são montados do banco (`montarDossie`) — ninguém os escreve. O
 * que se escreve é o sumário, a apuração, o enquadramento, a conclusão e
 * o pedido; a IA dá o primeiro rascunho, e tudo é editável.
 */

export interface PartesEscritas {
  destinatario?: string;
  pedido?: string;
  sumario?: string;
  verificado: string[];
  sustentado: string[];
  alegado: string[];
  enquadramento?: string;
  conclusao?: string;
}

export const PARTES_VAZIAS: PartesEscritas = { verificado: [], sustentado: [], alegado: [] };

const dataCurta = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

/** O documento com as partes escritas no lugar — o que `renderizarDossie` desenha. */
export function aplicarPartes(d: DossieMontado, p: PartesEscritas): DossieMontado {
  const tem = p.verificado.length || p.sustentado.length || p.alegado.length;
  return {
    ...d,
    identificacao: {
      ...d.identificacao,
      destinatario: p.destinatario?.trim() || d.identificacao.destinatario,
      pedido: p.pedido?.trim() || d.identificacao.pedido,
    },
    sumario: p.sumario?.trim() || undefined,
    apuracao: tem ? { verificado: p.verificado, sustentadoPelaEvidencia: p.sustentado, alegacaoSemProva: p.alegado } : undefined,
    enquadramento: p.enquadramento?.trim() || undefined,
    conclusao: p.conclusao?.trim() || undefined,
  };
}

/**
 * O rascunho sem IA — só com o que a linha do tempo afirma.
 *
 * O sumário diz quem, quando e quantos registros; "verificado" é cada
 * fato que tem peça no sistema. O que depende de julgamento (o que a
 * evidência sustenta, o que é só alegação, o enquadramento) fica vazio
 * para quem conhece o caso escrever.
 */
export function rascunhoSemIA(d: DossieMontado): PartesEscritas {
  const eventos = d.linhaDoTempo;
  const primeiro = eventos[0];
  const ultimo = eventos[eventos.length - 1];
  const setores = d.partes.setoresAcionados.length ? ` Setores acionados: ${d.partes.setoresAcionados.join(", ")}.` : "";
  const sumario = primeiro
    ? `${d.partes.consumidor} abriu a reclamação ${d.identificacao.protocolo} (${d.identificacao.canal}) em ${dataCurta(d.identificacao.abertoEm)}. ` +
      `O sistema registra ${eventos.length} evento(s), de ${dataCurta(primeiro.quando)} a ${dataCurta(ultimo.quando)}, com ${d.anexos.filter((a) => a.noSistema).length} peça(s) no sistema.${setores}` +
      (d.lacunas.length ? ` Faltam ${d.lacunas.length} peça(s) de fora do sistema.` : "")
    : `${d.partes.consumidor} abriu a reclamação ${d.identificacao.protocolo} em ${dataCurta(d.identificacao.abertoEm)}. Ainda não há eventos registrados.`;
  const comPeca = new Set(d.anexos.filter((a) => a.noSistema).map((a) => `Anexo ${String(a.numero).padStart(2, "0")}`));
  return {
    ...PARTES_VAZIAS,
    sumario,
    verificado: eventos.filter((e) => e.evidencia && comPeca.has(e.evidencia)).map((e) => `${dataCurta(e.quando)}: ${e.evento} (${e.evidencia})`),
  };
}

/* O pedido de moderação se sustenta numa regra: do regulamento do Reclame Aqui, dos termos, de uma política. */
const CITA_REGRA = /regulamento|regra|termo|pol[ií]tica|item\s*\d|cl[aá]usula|art(\.|igo)\s*\d/i;

/**
 * O que falta para o dossiê se sustentar — antes de ir para fora.
 *
 * A conferência do documento (`conferirDossie`: cronologia em ordem,
 * anexo citado que existe) mais o que é da escrita: sumário e pedido
 * escritos, pedido apoiado numa regra, alegação sem prova, evidência sem
 * data e peça de fora do sistema ainda por anexar.
 */
export function conferenciaAntesDeUsar(d: DossieMontado, p: PartesEscritas): string[] {
  const problemas = conferirDossie(aplicarPartes(d, p));
  if (!p.sumario?.trim()) problemas.push("Falta o sumário executivo.");
  if (!p.pedido?.trim()) problemas.push("Falta o pedido: o que se quer do destinatário.");
  else if (!CITA_REGRA.test(`${p.pedido} ${p.enquadramento ?? ""}`)) problemas.push("O pedido não cita a regra (do regulamento, dos termos ou da política) que o sustenta.");
  if (p.alegado.length) problemas.push(`${p.alegado.length} alegação(ões) sem prova: junte a evidência ou tire do pedido.`);
  const semData = d.anexos.filter((a) => !/^\d{4}-\d{2}-\d{2}_/.test(a.nome));
  if (semData.length) problemas.push(`${semData.length} evidência(s) sem data no nome do arquivo.`);
  if (d.lacunas.length) problemas.push(`${d.lacunas.length} peça(s) de fora do sistema ainda por anexar.`);
  return problemas;
}

/**
 * O texto do pedido de moderação — curto, para o campo do Reclame Aqui.
 *
 * O pedido, o sumário, os fatos que têm peça e a regra. O dossiê inteiro
 * vai como arquivo anexo.
 */
export function textoParaModeracao(d: DossieMontado, p: PartesEscritas) {
  const l: string[] = [];
  if (p.pedido?.trim()) l.push(p.pedido.trim(), "");
  if (p.sumario?.trim()) l.push(p.sumario.trim(), "");
  const fatos = p.verificado.length ? p.verificado : d.linhaDoTempo.slice(0, 8).map((e) => `${dataCurta(e.quando)}: ${e.evento}`);
  if (fatos.length) l.push("Fatos registrados:", ...fatos.slice(0, 8).map((f) => `- ${f}`), "");
  if (p.enquadramento?.trim()) l.push(p.enquadramento.trim(), "");
  l.push(`Dossiê completo em anexo (${d.anexos.length} peça(s)). Protocolo ${d.identificacao.protocolo}.`);
  return l.join("\n").trim();
}
