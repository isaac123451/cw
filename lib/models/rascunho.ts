import {
  dadosSensiveis,
  LIMITE_DE_REPETICAO,
  resumoDosAchados,
  semelhanca,
} from "@/lib/services/lgpd";

import { primeiroNome } from "@/lib/models/mensagens";

/**
 * Rascunho que segue as regras do documento (Fase 9.3).
 *
 * **O que o documento pede.** Chamar o cliente pelo nome, validar o que
 * ele sentiu, usar o que está no histórico — e, na resposta pública,
 * nada de dado pessoal e nada que soe como macro ("Regra de Ouro: sem
 * macros prontas ou textos robotizados").
 *
 * **Por que não basta pedir ao modelo.** Pedir no prompt melhora a
 * média e não garante nada: o texto sai bom nove vezes e na décima
 * chega com o CPF que estava no relato, ou igual ao que já foi
 * publicado em outro caso. Um rascunho é copiado e colado — o erro
 * atravessa direto para o ar.
 *
 * Então são duas camadas, e a segunda é a que segura: as regras entram
 * na instrução **e** o texto gerado passa pela mesma conferência que o
 * texto digitado à mão. O que ela acha vai junto do rascunho, para a
 * pessoa ver antes de copiar.
 */

/** As regras, como o modelo as recebe. É o texto do documento, resumido. */
export const REGRAS_DO_RASCUNHO = `Regras do rascunho (documento "Atendimento no Reclame Aqui", Diretrizes de Comunicação):
- Comece pelo primeiro nome de quem reclamou, quando ele for conhecido.
- Valide o que a pessoa sentiu antes de explicar qualquer coisa. Reconhecer o transtorno não é admitir culpa.
- Use o que está no histórico deste caso — o que foi pedido, o que já foi tentado, o que a área respondeu. Genérico é o que se quer evitar.
- Nada de texto que sirva para qualquer reclamação. Comece pelo que só este caso tem.
- Em resposta pública: nunca CPF, CNPJ, e-mail, telefone, endereço, valor de contrato, condição negociada ou política interna. Isso fica no canal privado.
- Não prometa prazo em número se o prazo não estiver no material. Diga que a equipe retorna com a apuração.
- Não invente protocolo, valor, data, nome ou fato que não esteja no material.`;

export type ProblemaDoRascunho =
  | "sem-nome"
  | "dado-pessoal"
  | "parece-macro"
  | "promete-prazo"
  | "sem-validacao";

export interface AchadoDoRascunho {
  tipo: ProblemaDoRascunho;
  /** O que dizer para quem vai copiar. */
  texto: string;
  /** "perigo" trava a cópia sem confirmar; "atencao" é conselho. */
  tom: "perigo" | "atencao";
}

/**
 * Palavras com que uma resposta reconhece o que a pessoa passou.
 *
 * É uma lista curta e de propósito: não mede empatia, mede se **existe
 * alguma** marca de acolhimento no texto. Um rascunho que abre com
 * "Segue o procedimento" não tem nenhuma delas.
 */
const VALIDACAO =
  /\b(sinto|lamento|entendo|compreendo|desculp|peço desculpas|pedimos desculpas|transtorno|inc[oô]modo|frustra|chatead|raz[ãa]o|obrigad)/i;

/**
 * Promessa de prazo em número.
 *
 * "retorno em 2 dias" e "resolvemos em 24 horas" são a promessa que o
 * documento manda não fazer sem apuração; "dentro do prazo" e "o quanto
 * antes" não são.
 */
const PRAZO_EM_NUMERO =
  /\b(em|dentro de|até|no prazo de)\s+(\d{1,3}|uma?|dois|duas|tr[êe]s|quatro|cinco)\s*(h|hs|horas?|dias? ?[úu]?t?e?i?s?|semanas?|meses?)\b/i;

export interface ContextoDoRascunho {
  /** O nome de quem reclamou, como está no caso. */
  nome?: string;
  /** Respostas já publicadas, para comparar — a regra de ouro. */
  publicadas?: string[];
  /** Resposta pública tem regra mais dura que mensagem privada. */
  publico?: boolean;
  /** O material permite citar prazo? (o caso tem prazo de área acordado) */
  prazoConhecido?: boolean;
}

/**
 * Confere o rascunho contra as regras. Vazio significa "pode copiar".
 *
 * A mesma função para o texto que o modelo escreveu e para o que uma
 * pessoa digitou: duas conferências para a mesma regra divergem no
 * primeiro ajuste.
 */
export function conferirRascunho(
  texto: string,
  contexto: ContextoDoRascunho = {}
): AchadoDoRascunho[] {

  const rascunho = String(texto ?? "").trim();

  if (rascunho.length < 20) return [];

  const achados: AchadoDoRascunho[] = [];

  /* ---------- o nome ---------- */

  const nome = primeiroNome(contexto.nome);

  if (nome && nome.length >= 3) {
    const semAcento = (s: string) =>
      s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

    if (!semAcento(rascunho).includes(semAcento(nome))) {
      achados.push({
        tipo: "sem-nome",
        tom: "atencao",
        texto: `O documento pede começar pelo nome: chame de "${nome}".`,
      });
    }
  }

  /* ---------- validar o que a pessoa sentiu ---------- */

  if (!VALIDACAO.test(rascunho)) {
    achados.push({
      tipo: "sem-validacao",
      tom: "atencao",
      texto:
        "Não há nenhuma frase que reconheça o transtorno. Validar o sentimento vem antes de explicar — e não é admitir culpa.",
    });
  }

  /* ---------- dado pessoal na resposta pública ---------- */

  if (contexto.publico) {
    const achadosLgpd = dadosSensiveis(rascunho);

    if (achadosLgpd.length > 0) {
      achados.push({
        tipo: "dado-pessoal",
        tom: "perigo",
        texto: `${resumoDosAchados(achadosLgpd)} — a resposta pública fica no ar e é indexada. Isso vai no canal privado.`,
      });
    }
  }

  /* ---------- soa como macro ---------- */

  const maior = (contexto.publicadas ?? []).reduce(
    (max, publicada) => Math.max(max, semelhanca(rascunho, publicada)),
    0
  );

  if (maior >= LIMITE_DE_REPETICAO) {
    achados.push({
      tipo: "parece-macro",
      tom: "perigo",
      texto: `${maior}% igual a uma resposta já publicada. A regra de ouro do documento é não usar texto pronto — comece pelo que só este caso tem.`,
    });
  }

  /* ---------- promessa de prazo ---------- */

  if (!contexto.prazoConhecido && PRAZO_EM_NUMERO.test(rascunho)) {
    achados.push({
      tipo: "promete-prazo",
      tom: "atencao",
      texto:
        "O rascunho promete um prazo em número que não está no material. Diga que a equipe retorna com a apuração.",
    });
  }

  return achados;
}

/** Uma frase com o que a conferência achou, para o painel e para a tela. */
export function resumoDoRascunho(achados: AchadoDoRascunho[]) {

  if (achados.length === 0) return "Segue as regras do documento.";

  const grave = achados.filter((a) => a.tom === "perigo").length;

  return grave > 0
    ? `${grave} ponto(s) que impedem publicar como está`
    : `${achados.length} ajuste(s) sugerido(s) pelo documento`;
}
