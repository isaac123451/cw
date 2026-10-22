import { getPrisma } from "@/lib/prisma";
import { pedirEstruturado } from "@/lib/services/ia.service";
import { saberParaOPrompt } from "@/lib/services/aprendizados.service";

/**
 * A revisão da mensagem do WhatsApp pela IA (22/10/2026) — ver a rota
 * `/api/extensao/melhorar-mensagem` e as regras da extensão
 * (`extensao/conteudo/revisao-regras.js`).
 *
 * Medido no primeiro teste, com conversa real: o modelo rápido deu risco
 * "baixo" para "você deveria ter colocado o endereço certo, não é nossa
 * responsabilidade", manteve "pode cancelar pelo painel" com o cliente
 * falando em sair, e tirou a vírgula de "Oi, Suzana!" de uma mensagem que
 * estava boa. Por isso: o modelo completo, critérios de risco escritos, o
 * que as regras já acharam vai junto, e o risco nunca fica abaixo delas.
 */

const SISTEMA = `Você revisa a mensagem que um atendente da Cardápio Web (sistema para restaurantes: PDV, cardápio online, KDS, integrações de delivery, módulo fiscal, pagamento online) vai mandar pelo WhatsApp a um cliente — o dono do restaurante. Você pensa como analista de reputação: cada mensagem pode virar reclamação, avaliação ruim ou cancelamento.

Devolva a mesma mensagem, melhor:
- Português do Brasil correto (ortografia, acentos, concordância, pontuação), tom de WhatsApp: curto, cordial, direto, sem formalidade de e-mail, sem assinatura. A vírgula do vocativo ("Oi, Suzana!") está CERTA — não tire.
- Mantenha a intenção e os fatos do atendente. Não acrescente protocolo, valor, prazo ou promessa que não estejam no rascunho ou na conversa.
- NUNCA escreva que o atendente FEZ algo ("já ajustei", "desativei", "corrigi", "testei") se o rascunho não diz isso — afirmar ao cliente uma ação que não aconteceu é o pior erro possível. Proponha ("posso ajustar", "vou verificar") em vez de afirmar.
- Tire o que piora a relação: culpar o cliente ("você deveria", "você errou"), tirar o corpo fora ("não é nossa responsabilidade", "o sistema é assim"), impaciência ("conforme já informado", "como já disse"), fechar a porta ("não há o que fazer"), ironia, maiúsculas gritando, pontuação repetida, abreviação. No lugar, reconheça o que o cliente passou e diga o próximo passo concreto.
- Prazo: mantenha só se a conversa sustenta; senão troque por "assim que eu tiver o retorno do time, te aviso por aqui".
- Retenção: se o cliente falou em cancelar, trocar de sistema ou está muito insatisfeito, NÃO ofereça o caminho do cancelamento (link, "pode cancelar") — reconheça o problema com as palavras dele, diga o que muda e proponha um próximo passo (ligação, ajuste, acompanhamento). Sem pressionar e sem prometer o que não pode.
- Se o rascunho não tem erro de português e nada nele piora a relação, devolva EXATAMENTE o mesmo texto, com risco "baixo" e pontos vazios. Não troque palavra por gosto.

Risco do rascunho ORIGINAL:
- "alto": culpa o cliente, tira o corpo fora, é ríspido, ou facilita o cancelamento com o cliente querendo sair.
- "medio": promete prazo sem base, é frio ou seco com cliente insatisfeito, abreviação/maiúscula/pontuação que soa mal, erro de português visível.
- "baixo": está bom ou tem só detalhe.`;

const ESQUEMA = {
  type: "object",
  properties: {
    texto: { type: "string", description: "A mensagem revisada, pronta para enviar." },
    risco: { type: "string", enum: ["baixo", "medio", "alto"], description: "O quanto o rascunho ORIGINAL podia piorar a relação, pelos critérios." },
    pontos: {
      type: "array",
      description: "Até 4 mudanças, cada uma em uma frase curta: o que mudou e por quê. Vazio se devolveu igual.",
      items: { type: "string" },
    },
    retencao: { type: "string", description: "Se o cliente falou em cancelar ou está insatisfeito: uma dica curta do que fazer para reter. Senão, vazio." },
  },
  required: ["texto", "risco", "pontos", "retencao"],
};

export interface RevisaoDaMensagem {
  texto: string;
  igual: boolean;
  risco: "baixo" | "medio" | "alto";
  pontos: string[];
  retencao: string;
}

export interface AvisoDaRegra {
  tom: "perigo" | "atencao";
  texto: string;
}

const ORDEM = { baixo: 0, medio: 1, alto: 2 } as const;
const normal = (t: string) => t.replace(/\s+/g, " ").trim();

export async function revisarMensagemComIA(entrada: {
  rascunho: string;
  mensagens: { de: "nos" | "cliente"; texto: string }[];
  nome: string;
  /** O que as regras da extensão já acharam — vai para a IA, e o risco não fica abaixo disso. */
  avisos?: AvisoDaRegra[];
}): Promise<{ ok: true; revisao: RevisaoDaMensagem } | { ok: false; erro: string }> {
  const { rascunho, mensagens, nome } = entrada;
  const avisos = (entrada.avisos ?? []).slice(0, 6);
  /* O que o time já aprendeu sobre o assunto (22/10/2026). */
  const saber = await saberParaOPrompt(getPrisma(), [...mensagens.map((m) => m.texto), rascunho].join("\n")).catch(() => "");

  const prompt = [
    nome ? `Cliente: ${nome}.` : "",
    saber,
    mensagens.length ? "A conversa até agora (CLIENTE / NÓS):" : "Sem conversa na tela.",
    ...mensagens.map((m) => `${m.de === "nos" ? "NÓS" : "CLIENTE"}: ${m.texto}`),
    "",
    avisos.length ? `A conferência automática já apontou no rascunho:\n${avisos.map((a) => `- (${a.tom === "perigo" ? "grave" : "atenção"}) ${a.texto}`).join("\n")}` : "",
    "",
    "O rascunho que o atendente vai mandar agora:",
    rascunho,
  ]
    .filter(Boolean)
    .join("\n");

  const r = await pedirEstruturado({ sistema: SISTEMA, prompt, esquema: ESQUEMA });
  const d = r.dados ?? {};
  const texto = String(d.texto ?? "").trim().slice(0, 2500);
  if (r.erro || !texto) {
    return { ok: false, erro: r.erro ? "A IA não respondeu agora. As dicas acima continuam valendo." : "A IA não chegou a uma revisão." };
  }

  /* O piso do risco: o que as regras acharam é fato, não opinião do modelo. */
  const doModelo = (["baixo", "medio", "alto"].includes(String(d.risco)) ? String(d.risco) : "baixo") as RevisaoDaMensagem["risco"];
  const dasRegras: RevisaoDaMensagem["risco"] = avisos.some((a) => a.tom === "perigo") ? "alto" : avisos.length ? "medio" : "baixo";
  const risco = ORDEM[dasRegras] > ORDEM[doModelo] ? dasRegras : doModelo;
  const igual = normal(texto) === normal(rascunho);

  return {
    ok: true,
    revisao: {
      texto,
      igual,
      risco,
      pontos: igual ? [] : (Array.isArray(d.pontos) ? d.pontos : []).map((p) => String(p ?? "").trim()).filter(Boolean).slice(0, 4),
      retencao: String(d.retencao ?? "").trim().slice(0, 400),
    },
  };
}
