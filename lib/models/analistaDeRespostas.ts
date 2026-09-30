import { conferirRascunho, type AchadoDoRascunho } from "@/lib/models/rascunho";
import { RESPOSTA_SINTETICA } from "@/lib/services/raMarcadores";

/**
 * O analista de respostas públicas (Fase 35, 1.94).
 *
 * "Quero um analista de respostas públicas: que aponte erros e o que dá
 * para melhorar." Antes de publicar (a ficha e a extensão na área da
 * empresa) e depois (a tela Respostas, com as publicadas do período).
 *
 * As regras do rascunho — nome, acolhimento, dado pessoal, texto
 * repetido, prazo prometido — valem aqui inteiras (`conferirRascunho`).
 * Por cima delas, o que só a resposta pública precisa ter: dizer por onde
 * o cliente segue, convidar a avaliar, assinar, ter o tamanho de quem lê
 * no portal, não soar defensiva, e não dizer "resolvido" antes de o
 * cliente confirmar.
 */

export type ProblemaDaResposta =
  | AchadoDoRascunho["tipo"]
  | "sem-caminho"
  | "sem-convite"
  | "sem-assinatura"
  | "curta"
  | "longa"
  | "defensiva"
  | "resolvido-sem-validar";

export interface AchadoDaResposta {
  tipo: ProblemaDaResposta;
  texto: string;
  /** "perigo" é erro (não publique assim); "atencao" é o que melhora. */
  tom: "perigo" | "atencao";
}

export interface AnaliseDaResposta {
  achados: AchadoDaResposta[];
  /** 0 a 100: começa em 100, erro tira 25, melhoria tira 8. */
  nota: number;
  resumo: string;
}

export interface ContextoDaAnalise {
  nome?: string;
  publicadas?: string[];
  prazoConhecido?: boolean;
  /** O cliente confirmou a solução (Passo 6)? `undefined` quando não se sabe. */
  validado?: boolean;
}

/** Por onde o cliente segue: o canal privado, o chat, o e-mail, a central. */
const CAMINHO = /\b(mensagem privada|privad[oa]|chat|e-?mail|whats ?app|central de ajuda|entr(aremos|amos) em contato|retorn(aremos|amos)|suporte@|ajuda\.cardapioweb)/i;

/** O convite a avaliar — é o que move solução e voltaria, 30% da nota cada. */
const CONVITE = /\bavali(e|ar|a[çc][ãa]o)\b/i;

/** Assinatura: o nome de quem atende ou a marca no fim. */
const ASSINATURA = /(\|\s*card[aá]pio web|equipe card[aá]pio web|card[aá]pio web\s*$|atenciosamente)/i;

/** Frases que põem a culpa no cliente ou soam como "já falei". */
const DEFENSIVA =
  /(conforme (j[aá] )?(informad|mencionad|explicad)|como (j[aá] )?(dito|informado|explicado)|o (sr\.?|senhor|sra\.?|senhora|cliente) (n[aã]o|deveria)|voc[eê] (n[aã]o (seguiu|leu|fez|configurou)|deveria)|por falta de aten[çc][ãa]o)/i;

/** A resposta afirma que já resolveu. */
const DIZ_RESOLVIDO = /\b(foi|est[aá]|j[aá] (foi|est[aá])|ficou)\s+(resolvid|solucionad|corrigid|normalizad)/i;

const TAMANHO_MINIMO = 200;
const TAMANHO_MAXIMO = 1600;

export function analisarResposta(texto: string, contexto: ContextoDaAnalise = {}): AnaliseDaResposta {
  const resposta = String(texto ?? "").trim();

  if (!resposta || resposta === RESPOSTA_SINTETICA) {
    return { achados: [], nota: 0, resumo: "Sem o texto da resposta — ele chega na próxima leitura do portal." };
  }

  const achados: AchadoDaResposta[] = conferirRascunho(resposta, {
    nome: contexto.nome,
    publicadas: contexto.publicadas,
    publico: true,
    prazoConhecido: contexto.prazoConhecido,
  }).map((a) => ({ tipo: a.tipo, texto: a.texto, tom: a.tom }));

  if (DEFENSIVA.test(resposta)) {
    achados.push({
      tipo: "defensiva",
      tom: "perigo",
      texto: "Soa defensiva (\"conforme informado\", \"o senhor não…\"). Em público, quem lê é o próximo cliente: explique o que foi feito, sem apontar o erro de quem reclamou.",
    });
  }

  if (DIZ_RESOLVIDO.test(resposta) && contexto.validado === false) {
    achados.push({
      tipo: "resolvido-sem-validar",
      tom: "perigo",
      texto: "Diz que está resolvido, mas o cliente ainda não confirmou (Passo 6). Se ele discordar na réplica, a resposta fica contra a empresa.",
    });
  }

  if (!CAMINHO.test(resposta)) {
    achados.push({
      tipo: "sem-caminho",
      tom: "atencao",
      texto: "Não diz por onde o cliente segue — mensagem privada, chat ou e-mail. Sem isso, a resposta parece encerrar a conversa.",
    });
  }

  if (!CONVITE.test(resposta)) {
    achados.push({
      tipo: "sem-convite",
      tom: "atencao",
      texto: "Não convida a avaliar. A avaliação é o que move a nota: solução e \"voltaria\" pesam 30% cada.",
    });
  }

  if (!ASSINATURA.test(resposta)) {
    achados.push({ tipo: "sem-assinatura", tom: "atencao", texto: "Sem assinatura: feche com o seu nome e \"| Cardápio Web\"." });
  }

  if (resposta.length < TAMANHO_MINIMO) {
    achados.push({ tipo: "curta", tom: "atencao", texto: `Curta demais (${resposta.length} caracteres): quem lê no portal não vê o que foi feito.` });
  } else if (resposta.length > TAMANHO_MAXIMO) {
    achados.push({ tipo: "longa", tom: "atencao", texto: `Longa demais (${resposta.length} caracteres): o detalhe vai no privado; em público, o que foi feito e o próximo passo.` });
  }

  const erros = achados.filter((a) => a.tom === "perigo").length;
  const melhorias = achados.length - erros;
  const nota = Math.max(0, 100 - erros * 25 - melhorias * 8);

  return {
    achados: achados.sort((a, b) => (a.tom === b.tom ? 0 : a.tom === "perigo" ? -1 : 1)),
    nota,
    resumo:
      achados.length === 0
        ? "Segue o documento: pode publicar."
        : erros > 0
          ? `${erros} erro(s) e ${melhorias} melhoria(s)`
          : `${melhorias} melhoria(s)`,
  };
}
