import type { Case } from "@/lib/models/case";
import type { ContatoView, EstadoDaValidacao } from "@/lib/models/tratativa";
import type { AcaoDoPasso, PassoDaTrilha } from "@/lib/models/trilha";
import { JANELA_DA_CADENCIA_DIAS, TENTATIVAS_DA_CADENCIA } from "@/lib/models/cadencia";
import { descreverRegistro, paredeDe } from "@/lib/services/horasUteis";

/**
 * O que fazer com a reclamação agora, em uma frase.
 *
 * A trilha diz em que passo o caso está ("Persistência no contato"); a
 * pessoa precisa ouvir o que fazer: "várias tentativas sem sucesso: tente
 * por e-mail", "o objetivo foi cumprido: responda a reclamação". A frase
 * sai do passo e do que o banco sabe dele — tentativas, canais já
 * tentados, a pergunta de validação, a área com prazo vencido.
 *
 * Aparece no quadro, na lista e na ficha. Não decide nada que a trilha
 * não decida: só diz a mesma coisa do jeito que se faz.
 */
export interface Conselho {
  /** A frase, curta, sem ponto final: "Várias tentativas sem sucesso: tente por e-mail". */
  frase: string;
  /** O dado que levou a ela. */
  porque?: string;
  /** O diálogo que faz o que a frase diz. */
  acao?: AcaoDoPasso;
  /** O canal que a frase sugere — o diálogo de contato já abre nele. */
  canal?: string;
  /** Algo passou do ponto: pedir atenção, e não só lembrar. */
  urgente?: boolean;
}

export interface ContextoDoConselho {
  agora?: Date;
  /** Os canais das tentativas seguidas sem resposta. */
  canaisSemResposta?: string[];
  /** A cadência de 5 tentativas em 7 dias acabou (na ficha, que lê os contatos). */
  cadenciaEsgotada?: boolean;
  /** A área acionada e se o prazo dela já passou. */
  area?: { destino: string; vencida?: boolean };
  validacao?: EstadoDaValidacao;
}

const DIA = 86_400_000;

function diasDesde(iso: string | undefined, agora?: Date) {
  if (!iso || !agora) return 0;
  return Math.max(0, Math.floor((agora.getTime() - Date.parse(iso.length === 10 ? `${iso}T12:00:00Z` : iso)) / DIA));
}

const tem = (canais: string[], nome: string) => canais.some((c) => c.toLowerCase() === nome.toLowerCase());

function lista(canais: string[]) {
  if (canais.length <= 1) return canais[0] ?? "";
  return `${canais.slice(0, -1).join(", ")} e ${canais[canais.length - 1]}`;
}

export function oQueFazer(
  item: Case,
  passo: PassoDaTrilha | null | undefined,
  contexto: ContextoDoConselho = {}
): Conselho | null {

  if (!passo) return null;

  const { agora } = contexto;

  switch (passo.id) {

    case "triar": {
      const dias = diasDesde(item.createdAt, agora);
      return dias >= 1
        ? { frase: `Há ${dias} dia${dias > 1 ? "s" : ""} sem triagem: classifique a urgência`, porque: "Sem a urgência, ela não entra na fila certa nem ganha prazo.", acao: "triar", urgente: true }
        : { frase: "Classifique a urgência", porque: "Urgente, Alta ou Normal — é o que define o prazo e a fila.", acao: "triar" };
    }

    case "imersao":
      return {
        frase: "Leia a conta e o histórico antes do 1º contato",
        porque: "Fase do cliente, conversas anteriores e o que já foi tentado — antes de qualquer mensagem.",
        acao: "imersao",
      };

    case "contato": {
      const dias = diasDesde(item.createdAt, agora);
      return dias >= 2
        ? { frase: `${dias} dias sem contato: fale com o cliente hoje`, porque: "De preferência WhatsApp ou telefone, apresentando-se como responsável.", acao: "contato", urgente: true }
        : { frase: "Faça o 1º contato pelo WhatsApp ou telefone", porque: "Apresentando-se como responsável pelo caso.", acao: "contato" };
    }

    case "persistencia": {
      const t = item.tentativasSemResposta ?? 0;
      const canais = contexto.canaisSemResposta ?? [];
      const onde = canais.length ? ` por ${lista(canais)}` : "";

      /* A mesma conta de `persistencia`: 5 tentativas, ou a janela de 7 dias (em Brasília) passou. */
      const janelaPassou =
        Boolean(item.primeiraTentativaEm && agora) &&
        paredeDe(agora!).dia >
          new Date(Date.parse(`${paredeDe(new Date(item.primeiraTentativaEm!)).dia}T00:00:00Z`) + (JANELA_DA_CADENCIA_DIAS - 1) * DIA).toISOString().slice(0, 10);

      if (contexto.cadenciaEsgotada ?? (t >= TENTATIVAS_DA_CADENCIA || janelaPassou)) {
        return {
          frase: "Tentativas esgotadas: publique a mensagem transparente no portal",
          porque: `${t} tentativa${t > 1 ? "s" : ""} sem resposta${onde}. A cadência de 5 em 7 dias acabou; depois, follow-up a cada 2 dias.`,
          acao: "resposta",
          urgente: true,
        };
      }

      if (t >= 2) {
        const porque = `${t} tentativas seguidas sem resposta${onde}.`;
        if (!tem(canais, "E-mail")) {
          return { frase: "Várias tentativas sem sucesso: tente por e-mail", porque, acao: "tentativa", canal: "E-mail" };
        }
        if (!tem(canais, "Portal RA")) {
          return { frase: "Sem retorno nem por e-mail: mande mensagem pelo portal do RA", porque, acao: "tentativa", canal: "Portal RA" };
        }
        return { frase: "Várias tentativas sem sucesso: tente em outro horário", porque: `${porque} Manhã, tarde e fim da tarde — o horário menos tentado.`, acao: "tentativa" };
      }

      if (t === 1) {
        return { frase: "Sem resposta: tente de novo em outro horário", porque: `1 tentativa sem resposta${onde}. Até 5 em 7 dias, horários variados.`, acao: "tentativa" };
      }

      /* Contato feito, nenhuma tentativa sem resposta ainda: aguardando. */
      const dias = diasDesde(item.ultimoContatoEm, agora);
      return dias >= 1
        ? { frase: `Sem retorno desde ${descreverRegistro(item.ultimoContatoEm).split(" ")[0]}: tente de novo`, porque: "O cliente não respondeu ao último contato. Registre a tentativa — a cadência conta a partir dela.", acao: "tentativa" }
        : { frase: "Aguarde o retorno do cliente", porque: "Sem resposta até amanhã, tente de novo em outro horário." };
    }

    case "area": {
      const area = contexto.area;
      if (!area) return null;
      return area.vencida
        ? { frase: `O prazo de ${area.destino} passou: cobre a área e avise o cliente`, porque: "O cliente não pode ficar sem notícia enquanto a solução anda.", acao: "acionar-area", urgente: true }
        : { frase: `Com ${area.destino}: mantenha o cliente informado`, porque: "Atualize o cliente enquanto a área trabalha — sem deixá-lo no vácuo.", acao: "acionar-area" };
    }

    case "validacao": {
      const v = contexto.validacao;
      if (v?.pendencia && !v.pedidaEm) {
        return { frase: "O cliente apontou pendência: resolva e pergunte de novo", porque: v.pendencia.nota?.replace(/^O cliente: /, ""), acao: "validacao", urgente: true };
      }
      if (v?.pedidaEm) {
        const dias = diasDesde(v.pedidaEm, agora);
        return dias >= 2
          ? { frase: `Sem confirmação há ${dias} dias: pergunte de novo`, porque: `Pergunta feita ${descreverRegistro(v.pedidaEm)}.`, acao: "validacao" }
          : { frase: "Pergunta feita: aguarde o cliente confirmar", porque: `Perguntado ${descreverRegistro(v.pedidaEm)} se tudo voltou a funcionar.`, acao: "validacao" };
      }
      return item.ultimaRespostaEm
        ? { frase: "O cliente respondeu: confirme se tudo voltou a funcionar", porque: "A validação vem antes da resposta pública.", acao: "validacao" }
        : { frase: "Confirme com o cliente se tudo voltou a funcionar", porque: "A validação vem antes da resposta pública.", acao: "validacao" };
    }

    case "resposta": {
      if (/aguardando nossa r[ée]plica/i.test(item.status)) {
        return { frase: "O consumidor respondeu no portal: responda a réplica", porque: "A vez é nossa. Mesmas regras: texto do caso, sem dado pessoal.", acao: "resposta", urgente: true };
      }
      const dias = diasDesde(item.createdAt, agora);
      const noPortal = dias >= 2 ? ` O portal mostra "não respondida" há ${dias} dias.` : "";
      return item.validadoEm
        ? { frase: "O objetivo foi cumprido: responda a reclamação", porque: `Validado ${descreverRegistro(item.validadoEm)}. Texto do caso, agradecendo o diálogo e confirmando a resolução, sem dado pessoal.${noPortal}`, acao: "resposta", urgente: dias >= 10 }
        : { frase: "Publique a resposta no portal", porque: `O caso foi encerrado sem resposta pública.${noPortal}`, acao: "resposta" };
    }

    case "pedir-avaliacao":
      return {
        frase: (item.pedidosDeAvaliacao ?? 0) > 0 ? "Resposta publicada: lembre o cliente de avaliar" : "Resposta publicada: peça a avaliação",
        porque: (item.pedidosDeAvaliacao ?? 0) > 0 ? `${item.pedidosDeAvaliacao} pedido(s) feito(s).` : "Avise o cliente, com o link, e peça a avaliação.",
        acao: "pedir-avaliacao",
      };
  }

  return null;
}

/** Os canais das tentativas seguidas sem resposta — a mesma conta de `resumirContatos`. */
export function canaisSemResposta(
  contatos: Pick<ContatoView, "tipo" | "canal" | "resultado" | "em">[]
): string[] {
  const respostas = contatos.filter((c) => c.resultado === "respondeu" || c.resultado === "pendencia").map((c) => c.em).sort();
  const ultima = respostas[respostas.length - 1];
  const canais = contatos
    .filter((c) => c.tipo === "tentativa" && c.resultado !== "respondeu" && c.resultado !== "aguardando" && (!ultima || c.em > ultima))
    .map((c) => c.canal);
  return [...new Set(canais)];
}
