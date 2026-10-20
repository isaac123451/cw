/**
 * Por que o cliente quer cancelar (20/10/2026).
 *
 * "E a parte de analisar os cancelamentos?" A causa raiz dos casos de
 * cancelamento está vazia, e a subcategoria do portal diz o assunto da
 * reclamação ("Não consigo cancelar"), não o motivo de sair. Aqui o motivo
 * sai do que o cliente escreveu — o relato, o comentário do NPS, a
 * conversa —, e um cliente pode ter mais de um: quem sai porque o sistema
 * não imprime e ninguém do suporte responde tem os dois.
 *
 * As regras foram escritas lendo os relatos reais de quem pediu para
 * cancelar; a ordem é só a de exibição.
 */

export interface MotivoDeCancelamento {
  id: string;
  nome: string;
  padrao: RegExp;
}

const norma = (t: string) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

export const MOTIVOS_DE_CANCELAMENTO: MotivoDeCancelamento[] = [
  {
    id: "suporte",
    nome: "Suporte não resolve ou não responde",
    padrao:
      /suporte (pessimo|lento|demorad|ruim|horrivel|inexistente|nao (resolve|responde|atende|ajuda|tem))|sem (suporte|retorno|resposta|atendimento)|nao (tenho|tive|obtive|recebo|recebi) (nenhum |nenhuma |qualquer )?(retorno|resposta|suporte|ajuda)|ninguem (responde|resolve|atende|me (responde|ajuda|retorna))|(so|apenas) (robo|bot|ia\b)|atendid[oa] por (ia|robo|bot)|descaso|abandon(am|aram|ado|ada)|mau atendimento|atendimento (pessimo|ruim|horrivel|precario)|demora (no|para|pra) (atendimento|responder|resolver)|suporte (algum|nenhum)|nenhum suporte|nao me deram suporte|suporte nao foi|retorno (deles )?(foi )?(pessimo|horrivel|ruim)|(falar com|sem) (um )?(humano|atendente)/,
  },
  {
    id: "sistema",
    nome: "Sistema com falha",
    padrao:
      /nao imprime|impress(ao|ora)|instabil|fora do ar|(sistema|app|aplicativo|cardapio) (caiu|travou|trava|nao funciona|parou)|bug|erro (no|do) sistema|falha (no|do|na|de) (sistema|integracao|impressao)|bloqueio|bloquead|whatsapp.{0,30}(bloque|banid|caiu)|integracao.{0,40}(nao funciona|falh|erro|parou)|ifood.{0,40}(nao integra|falh|cancelad|nao (chega|aparece))|robo.{0,40}(nao funciona|nao responde|problema|errad)|pedidos? (nao (chega|aparece|entra)|perdid|sumi)/,
  },
  {
    id: "promessa",
    nome: "Faltou o que foi prometido na venda",
    padrao:
      /promet|na (hora da )?(venda|contratacao)|vendedor (disse|falou|garantiu|informou)|me (garantiram|disseram|informaram|venderam)|nao (tem|possui|oferece|faz) (a |o )?(funcao|funcionalidade|recurso|integracao)|funcionalidade.{0,30}(nao existe|ausente|limitad|falt)|propaganda enganosa|nao era (o que|como)|esperava/,
  },
  {
    id: "preco",
    nome: "Preço, cobrança ou reajuste",
    padrao:
      /(muito |bem )?caro|alto custo|custo (alto|elevado)|valor (alto|abusivo|elevado)|preco (alto|abusivo)|reajuste|aumento (do|de|no) (valor|preco|plano)|taxa(s)? (extra|adiciona|abusiva|escondid)|cobranc(a|as) (extra|adiciona|indevida|abusiva|por (km|pedido|excedente))|excedente|cobra(m|ram)? por (varias|tudo|cada)|custos? (extra|adiciona|ocult)/,
  },
  {
    id: "nao-usou",
    nome: "Não usou, desistiu ou se arrependeu",
    padrao:
      /nunca (usei|utilizei|usamos)|nao (cheguei a |chegamos a )?(usar|utilizar)|sem (uso|usar|utilizar)|(periodo|prazo) de (teste|garantia|arrependimento|satisfacao)|arrepend|desisti|desistencia|dentro do prazo de (7|sete|30|trinta) dias|7 dias|nao me adaptei|nao (se )?adapt/,
  },
  {
    id: "implantacao",
    nome: "Implantação ou ativação travada",
    padrao: /implantac|ativac|onboarding|configurac(ao|oes) (nao|travad|pendente|incomplet)|ainda nao (consegui|foi) (ativ|configur|implant)|nao consegui (comecar|ativar|configurar)/,
  },
  {
    id: "fechou",
    nome: "Fechou ou mudou o negócio",
    padrao: /fech(ei|amos|amento) (a |o |da |do |minha |meu |nossa |nosso )?(loja|negocio|empresa|estabelecimento|restaurante|delivery)|encerr(ei|amos|ando) (as atividades|a loja|o negocio)|vendi (a|o) (loja|negocio|ponto)/,
  },
  {
    id: "processo",
    nome: "Dificuldade para cancelar ou estorno",
    padrao:
      /(nao consigo|nao consegui|dificuldade (para|pra|de|no)|impossivel) cancel|cancelamento (nao (foi )?(efetivado|feito|processado|atendido|realizado)|ignorad|pendente)|(cobranc|cobrad|debit|fatura|boleto).{0,60}(apos|depois d[oe]) (o |a )?(solicitacao de |pedido de )?cancel|estorno|reembolso|devolu(cao|cam|am) (do|o|meu) (valor|dinheiro)|renovac(ao|ou) automatic|prorrogac|contrato automatic|multa|fidelidade/,
  },
];

/** Os motivos que o texto do cliente traz; nenhum quando não diz. */
export function motivosDoCancelamento(texto: string): string[] {
  const n = norma(texto);
  return MOTIVOS_DE_CANCELAMENTO.filter((m) => m.padrao.test(n)).map((m) => m.id);
}

export const NOME_DO_MOTIVO: Record<string, string> = Object.fromEntries(MOTIVOS_DE_CANCELAMENTO.map((m) => [m.id, m.nome]));
