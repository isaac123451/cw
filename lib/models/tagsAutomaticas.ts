/**
 * As tags que a IA põe e tira sozinha (21/10/2026).
 *
 * "Preciso que as tags a IA consiga adicionar corretamente." Medido no
 * mesmo dia: em 14 dias a IA não pôs nenhuma tag; "Possível avaliação
 * positiva" estava em 108 reclamações — todas já avaliadas e fechadas,
 * postas na importação de 23/08 e nunca tiradas —, "Risco de nota baixa"
 * em 28, também todas avaliadas; "Reincidente" vazia, com clientes
 * reincidentes na base.
 *
 * As regras são poucas e explicáveis — cada tag posta ou tirada leva o
 * motivo para o histórico do caso:
 *
 * - **Cancelamento de plano**: o cliente está na conta da Retenção (pediu
 *   para cancelar, por qualquer canal). Fato — não sai.
 * - **Reincidente**: mesmo CPF/CNPJ ou mesmo restaurante com outra
 *   reclamação nos 90 dias antes desta. Fato — não sai.
 * - **Risco de nota baixa**: sem avaliação, aberta, e a chance de cancelar
 *   é alta ou o termômetro prevê nota até 6.
 * - **Possível avaliação positiva**: respondida, sem avaliação, aberta, e
 *   o termômetro prevê nota 8+ com chance de "resolvido" de 60%+.
 *
 * E a faxina do que perdeu o sentido: as tags de previsão saem quando a
 * avaliação chega (ou o caso fecha); "Aguardando área interna" sai quando
 * o caso fecha; "Resposta até o dia 30" sai quando há resposta.
 */

export const TAG_CANCELAMENTO = "Cancelamento de plano";
export const TAG_REINCIDENTE = "Reincidente";
export const TAG_RISCO = "Risco de nota baixa";
export const TAG_POSITIVA = "Possível avaliação positiva";
export const TAG_FAVORAVEL = "Favorável a avaliação";
export const TAG_AREA_INTERNA = "Aguardando área interna";
export const TAG_RESPOSTA_ATE_30 = "Resposta até o dia 30";

const FINAIS = new Set(["Resolvido", "Não resolvido", "Finalizado"]);
const NOVENTA_DIAS = 90 * 86_400_000;

export interface CasoParaTags {
  id: string;
  protocolo: string;
  status: string;
  avaliado: boolean;
  respondido: boolean;
  /** AAAA-MM-DD da reclamação. */
  criadoEm: string;
  documento?: string | null;
  contaId?: string | null;
  tags: string[];
}

export interface ContextoDasTags {
  /** Protocolos na conta da Retenção. */
  naRetencao: Set<string>;
  /** Protocolos com chance alta de cancelar (régua da Retenção). */
  riscoAlto: Set<string>;
  /** O último termômetro de cada caso (por id). */
  termometro: Map<string, { satisfacao: number; notaPrevista: number | null; chanceResolvido: number | null }>;
}

export interface MudancaDeTag {
  caseId: string;
  protocolo: string;
  tag: string;
  acao: "por" | "tirar";
  motivo: string;
}

const digitos = (v?: string | null) => String(v ?? "").replace(/\D/g, "");

/** Outras reclamações do mesmo cliente nos 90 dias antes desta. */
function reincidencias(casos: CasoParaTags[]) {
  const porChave = new Map<string, CasoParaTags[]>();
  for (const c of casos) {
    const d = digitos(c.documento);
    const chaves = [d.length === 11 || d.length === 14 ? `doc:${d}` : "", c.contaId ? `conta:${c.contaId}` : ""].filter(Boolean);
    for (const k of chaves) porChave.set(k, [...(porChave.get(k) ?? []), c]);
  }
  const saida = new Map<string, CasoParaTags>();
  for (const lista of porChave.values()) {
    for (const c of lista) {
      const t = Date.parse(`${c.criadoEm}T00:00:00Z`);
      const anterior = lista.find((o) => o.id !== c.id && Date.parse(`${o.criadoEm}T00:00:00Z`) < t && t - Date.parse(`${o.criadoEm}T00:00:00Z`) <= NOVENTA_DIAS);
      if (anterior && !saida.has(c.id)) saida.set(c.id, anterior);
    }
  }
  return saida;
}

/** O que pôr e o que tirar — só as tags que estas regras conhecem. */
export function mudancasDeTags(casos: CasoParaTags[], ctx: ContextoDasTags): MudancaDeTag[] {
  const saida: MudancaDeTag[] = [];
  const reinc = reincidencias(casos);

  for (const c of casos) {
    const tem = new Set(c.tags);
    const por = (tag: string, motivo: string) => {
      if (!tem.has(tag)) {
        saida.push({ caseId: c.id, protocolo: c.protocolo, tag, acao: "por", motivo });
        tem.add(tag);
      }
    };
    const tirar = (tag: string, motivo: string) => {
      if (tem.has(tag)) {
        saida.push({ caseId: c.id, protocolo: c.protocolo, tag, acao: "tirar", motivo });
        tem.delete(tag);
      }
    };
    const fechado = c.avaliado || FINAIS.has(c.status);

    /* Fatos: entram e ficam. */
    if (ctx.naRetencao.has(c.protocolo)) por(TAG_CANCELAMENTO, "o cliente pediu para cancelar (está na Retenção)");
    const anterior = reinc.get(c.id);
    if (anterior) por(TAG_REINCIDENTE, `o mesmo cliente reclamou em ${anterior.criadoEm.split("-").reverse().join("/")} (${anterior.protocolo})`);

    /* Previsões: só enquanto não há avaliação. */
    if (fechado) {
      const porque = c.avaliado ? "a avaliação chegou" : "o caso fechou";
      tirar(TAG_POSITIVA, porque);
      tirar(TAG_RISCO, porque);
      tirar(TAG_FAVORAVEL, porque);
      tirar(TAG_AREA_INTERNA, "o caso fechou");
    } else {
      const termo = ctx.termometro.get(c.id);
      const riscoPeloTermometro = termo && ((termo.notaPrevista ?? 10) <= 6 || termo.satisfacao <= 6);
      const positivaPeloTermometro = termo && (termo.notaPrevista ?? 0) >= 8 && (termo.chanceResolvido ?? 0) >= 60;
      if (ctx.riscoAlto.has(c.protocolo) || riscoPeloTermometro) {
        por(TAG_RISCO, ctx.riscoAlto.has(c.protocolo) ? "chance alta de cancelar" : `o termômetro prevê nota ${termo?.notaPrevista ?? termo?.satisfacao}`);
        tirar(TAG_POSITIVA, "agora há risco de nota baixa");
      } else if (c.respondido && positivaPeloTermometro) {
        por(TAG_POSITIVA, `o termômetro prevê nota ${termo?.notaPrevista} e ${termo?.chanceResolvido}% de chance de "resolvido"`);
        tirar(TAG_RISCO, "o termômetro agora é favorável");
      }
    }

    if (c.respondido || FINAIS.has(c.status)) tirar(TAG_RESPOSTA_ATE_30, c.respondido ? "a reclamação foi respondida" : "o caso fechou");
  }
  return saida;
}
