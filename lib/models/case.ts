/* ============================================================
   CRITICIDADE — a tabela da documentação do Reclame Aqui
============================================================ */

export type Prioridade = "Urgente" | "Alta" | "Normal";

export const PRIORIDADES: Prioridade[] = ["Urgente", "Alta", "Normal"];

/**
 * O nome de hoje para qualquer grafia que já circulou.
 *
 * Quatro níveis viraram três em 12/09/2026. A extensão antiga, uma
 * regra de SLA gravada antes e a planilha ainda falam "Crítica",
 * "Média" e "Baixa" — e todos continuam sendo entendidos.
 */
export function prioridadeNormalizada(valor?: string | null): Prioridade {

  const limpo = String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (["urgente", "critica", "critico"].includes(limpo)) return "Urgente";
  if (limpo === "alta") return "Alta";

  return "Normal";
}

export interface Criterio {
  id: string;
  texto: string;
  prioridade: Prioridade;
}

/**
 * Os critérios de criticidade — as duas tabelas da documentação do
 * Reclame Aqui, abertas nos temas que os 363 relatos mais trazem.
 *
 * A tabela de SLA dá os de cada nível; a de acionamento das áreas
 * acrescenta "clientes relatando prejuízos financeiros" (Urgente),
 * "falhas sem interromper totalmente a operação", "dificuldades
 * críticas na configuração" e "demora excessiva no atendimento" (Alta),
 * e as dúvidas, ajustes, erros pontuais e melhorias (Normal). Os de
 * Normal não sobem o nível: dizem por que o caso é Normal, e a triagem
 * deixa isso registrado.
 *
 * Marcar qualquer um de Urgente sugere Urgente; sem nenhum desses e com
 * algum de Alta, Alta; o resto, Normal. É sugestão: quem tria decide.
 */
export const CRITERIOS: Criterio[] = [
  { id: "juridico", texto: "Risco jurídico ou regulatório (Procon, advogado, ação, acusação de golpe)", prioridade: "Urgente" },
  { id: "exposicao", texto: "Grande exposição pública, imprensa ou influenciador", prioridade: "Urgente" },
  { id: "operacao-parada", texto: "Operação do cliente totalmente paralisada", prioridade: "Urgente" },
  { id: "prejuizo", texto: "Prejuízo financeiro do estabelecimento (repasse retido, dinheiro de vendas)", prioridade: "Urgente" },
  { id: "dados-pessoais", texto: "Dados pessoais expostos ou usados sem autorização (LGPD)", prioridade: "Urgente" },
  { id: "estrategico", texto: "Cliente estratégico ou de alto ticket", prioridade: "Urgente" },
  { id: "reincidencia", texto: "Reincidência de erro", prioridade: "Urgente" },
  { id: "cancelamento", texto: "Risco concreto de cancelamento", prioridade: "Urgente" },
  { id: "financeiro", texto: "Impacto financeiro direto (cobrança indevida, erro de valores)", prioridade: "Alta" },
  { id: "cobranca-pos-cancelamento", texto: "Cobrança depois do cancelamento ou renovação automática contestada", prioridade: "Alta" },
  { id: "funcionalidade", texto: "Funcionalidade crítica indisponível (pedidos, impressão, integração, pagamento)", prioridade: "Alta" },
  { id: "falha-parcial", texto: "Falha no sistema sem parar toda a operação (instabilidade, pico, lentidão)", prioridade: "Alta" },
  { id: "configuracao-critica", texto: "Implantação ou configuração crítica travada, já paga", prioridade: "Alta" },
  { id: "demora-excessiva", texto: "Demora excessiva ou falta de retorno do atendimento", prioridade: "Alta" },
  { id: "prazo-descumprido", texto: "Prazo combinado anteriormente não cumprido", prioridade: "Alta" },
  { id: "duvida", texto: "Dúvida sobre o uso de uma funcionalidade", prioridade: "Normal" },
  { id: "informacao", texto: "Pedido de informação ou documento (nota fiscal, contrato, segunda via)", prioridade: "Normal" },
  { id: "ajuste", texto: "Ajuste no sistema ou erro pontual, sem recorrência", prioridade: "Normal" },
  { id: "melhoria", texto: "Sugestão ou funcionalidade que o sistema não tem", prioridade: "Normal" },
  { id: "atendimento", texto: "Insatisfação com o atendimento, sem problema ativo", prioridade: "Normal" },
  { id: "expectativa", texto: "Expectativa da venda não atendida, sem impacto na operação", prioridade: "Normal" },
];

export function prioridadePelosCriterios(ids: string[]): Prioridade {

  const marcados = CRITERIOS.filter((c) => ids.includes(c.id));

  if (marcados.some((c) => c.prioridade === "Urgente")) return "Urgente";
  if (marcados.some((c) => c.prioridade === "Alta")) return "Alta";

  return "Normal";
}

/** A frase do documento para o nível sem critério nenhum. */
export const CRITERIO_NORMAL =
  "Dúvidas operacionais, solicitações de informação, reclamações sem impacto operacional imediato.";

export interface Case {
  id: string;

  protocol: string;

  company: string;

  /**
   * Documento de cadastro no portal — **CPF ou CNPJ**.
   *
   * A pergunta do RA Forms é literalmente "CPF ou CNPJ", e a Cardápio
   * Web cadastra estabelecimento das duas formas. É este campo que liga
   * a reclamação ao restaurante.
   */
  document?: string;

  /**
   * Estabelecimento vinculado.
   *
   * Normalmente ninguém escolhe: o CNPJ do RA Forms encontra o cadastro
   * e o vínculo se monta sozinho. A tela existe para os casos em que o
   * CNPJ falta ou está errado — ver lib/models/establishment.ts.
   */
  establishmentId?: string;

  /**
   * O vínculo foi decidido na mão, e nada automático mexe mais nele.
   *
   * "Sem vínculo" tem dois significados, e só esta marca os separa:
   * *ainda não foi ligado* e *foi desligado de propósito*.
   */
  establishmentManual?: boolean;

  customer: string;

  email?: string;

  phone?: string;

  city?: string;

  state?: string;

  /**
   * O @ do perfil, nas Redes Sociais.
   *
   * Campo próprio porque o formulário do Instagram guardava o @ em
   * `email` por falta de lugar — e um @ ali some do cruzamento por
   * e-mail entre canais e aparece como endereço inválido em toda tela
   * que lista contatos.
   */
  socialHandle?: string;

  /**
   * Seguidores do perfil quando o caso foi aberto.
   *
   * Guardado no caso e não no contato: é o alcance que a pessoa tinha
   * **ao reclamar** que decide a urgência, e esse número muda toda
   * semana.
   */
  followers?: number;

  source: string;

  category: string;

  subcategory?: string;

  /**
   * A criticidade, com os nomes da documentação: Urgente, Alta, Normal.
   *
   * Eram quatro — Crítica, Alta, Média e Baixa — contra as três do
   * documento. O banco guarda o enum antigo; a tradução mora em
   * `case.mapper`, e "Média" e "Baixa" chegam aqui como Normal.
   */
  priority: Prioridade;

  /** Quando alguém fez a triagem do Passo 1 — ver `CRITERIOS`. */
  triadaEm?: string;
  triadaPor?: string;
  /** Os critérios do documento marcados na triagem (ids de `CRITERIOS`). */
  criterios?: string[];

  /**
   * O instante da publicação, com hora, quando se sabe.
   *
   * `createdAt` é o dia; este é o que o relógio de horas úteis usa. Sem
   * ele, o prazo parte da abertura do dia útil — ver `inicioDoRelogio`.
   */
  recebidaEm?: string;

  /** A "meta de 1º contato" cumprida: quando, por onde, por quem. */
  primeiroContatoEm?: string;
  primeiroContatoCanal?: string;
  primeiroContatoPor?: string;

  /** O contato mais recente feito pela operação. */
  ultimoContatoEm?: string;
  /** A última vez que o cliente respondeu. */
  ultimaRespostaEm?: string;
  /** Tentativas seguidas sem resposta desde a última resposta. */
  tentativasSemResposta?: number;

  /** Passo 6: a validação do cliente, quando registrada. */
  validadoEm?: string;

  /** Passo 8: o último pedido de avaliação e quantos foram feitos. */
  ultimoPedidoAvaliacaoEm?: string;
  pedidosDeAvaliacao?: number;

  /** Alguém decidiu não pedir mais avaliação deste caso — sai da fila. */
  avaliacaoDispensadaEm?: string;
  avaliacaoDispensadaPor?: string;

  /** Passo 2: a imersão no histórico antes do 1º contato. */
  imersaoEm?: string;
  imersaoPor?: string;

  /** Rotina diária, item 6: o pedido de moderação ao Reclame Aqui. */
  moderacaoPedidaEm?: string;
  moderacaoMotivo?: string;
  moderacaoResultado?: "pendente" | "aceita" | "negada";
  moderacaoRespondidaEm?: string;

  /** A causa raiz, da lista única do NPS — ver `NpsRootCause`. */
  causaRaiz?: string;

  /** Redes Sociais: quando encerrou, a solução aplicada e as reaberturas. */
  encerradoEm?: string;
  solucaoAplicada?: string;
  reaberturas?: number;

  status: string;

  owner?: string;

  department?: string;

  request?: string;

  churnRisk?: boolean;

  title: string;

  description: string;

  publicResponse?: string;

  /**
   * Quando a resposta pública foi publicada no portal.
   *
   * **Existia no banco e ninguém gravava.** A planilha do Reclame Aqui
   * traz "Data de Resposta", e o leitor da importação já a lia — para
   * calcular o tempo de resposta e depois descartá-la. O resultado: 329
   * reclamações com resposta pública e **zero** com a data dela.
   *
   * Só apareceu quando o dossiê estruturado foi montar a linha do
   * tempo: o evento mais importante depois da abertura — "a empresa
   * respondeu" — não tinha onde entrar na cronologia. Num documento que
   * sustenta pedido de moderação, isso não é detalhe.
   */
  publicResponseAt?: string;

  /**
   * Esta reclamacao foi respondida publicamente?
   *
   * **O fato, separado do texto.** Cinquenta e quatro lugares
   * perguntavam isso escrevendo `(publicResponse ?? "").trim() !== ""`
   * — o que obriga a carregar o texto inteiro para responder um
   * booleano. Sao 250 kB de resposta publica na lista de reclamacoes,
   * que nenhuma tela da lista mostra, e a consulta caia de 119 ms para
   * 770 ms so por causa disso.
   *
   * Agora a lista traz o fato e nao o texto; a tela de detalhe, que e´
   * a unica que exibe a resposta, busca o texto quando abre. Quem tiver
   * o texto em maos continua podendo deriva-lo — ver `respondida()`
   * em case.service.
   */
  respondida?: boolean;

  /**
   * Rascunho da resposta, ainda não publicado no portal.
   *
   * Nunca conta para o índice de resposta — quem conta é a
   * `publicResponse`. Ver o comentário no schema.
   */
  draftResponse?: string;

  /**
   * O dossiê guardado pela extensão.
   *
   * Só o dossiê, e não a transcrição do Crisp: aquela é matéria-prima e
   * já vive no Crisp; este é a leitura ordenada, que é o trabalho.
   */
  dossier?: string;
  dossierAt?: string;
  dossierBy?: string;

  score?: number;

  /** Consumidor avaliou o atendimento no Reclame Aqui. */
  evaluated?: boolean;

  /**
   * Avaliação sinalizada como desconsiderada.
   *
   * Vem marcada assim no export quando o próprio Reclame Aqui invalida a
   * avaliação, e pode ser ligada/desligada na tela do caso. É **apenas
   * sinalização**: a nota continua contando nos indicadores e as telas
   * mostram um aviso — descontar do cálculo é decisão da operação.
   */
  scoreDisregarded?: boolean;

  /**
   * Data da avaliação, em ISO (YYYY-MM-DD). Só data: o Reclame Aqui
   * mostra o dia da avaliação, não a hora.
   */
  evaluatedAt?: string;

  /** Link público da reclamação no portal. Só existe se for preenchido. */
  raUrl?: string;

  resolved: boolean;

  wouldDoBusiness: boolean;

  responseTime?: string;

  solutionTime?: string;

  sla: string;

  createdAt: string;

  updatedAt?: string;

  lastInteraction?: string;

  tags?: string[];
}

/**
 * A reclamacao foi respondida publicamente?
 *
 * **Uma pergunta, um lugar.** Ela era feita em cinquenta e quatro
 * pontos como `(publicResponse ?? "").trim() !== ""`, e essa forma
 * obriga a ter o texto em maos para responder um booleano — 250 kB
 * atravessando a rede em toda abertura da aplicacao, para uma resposta
 * que a lista nem mostra.
 *
 * Agora a lista carrega `respondida` e nao o texto. O `??` no fim
 * mantem quem tem o texto — a tela de detalhe, a extensao, um script —
 * funcionando exatamente como antes, sem duas verdades sobre a mesma
 * coisa.
 */
/**
 * "Voltaria a fazer negócio" só existe depois que o consumidor avalia.
 *
 * O banco guarda `false` por padrão, e a ficha mostrava "Voltaria: Não"
 * em reclamação que nem tinha sido avaliada — o Isaac viu e estranhou.
 * Antes da avaliação, é "não definido". A conta da nota já usava só as
 * avaliadas; o erro era de quem mostrava.
 */
export type Voltaria = "sim" | "nao" | "indefinido";

export function voltariaDoCaso(item: { evaluated?: boolean; wouldDoBusiness?: boolean }): Voltaria {
  if (!item.evaluated) return "indefinido";
  return item.wouldDoBusiness ? "sim" : "nao";
}

export const ROTULO_DO_VOLTARIA: Record<Voltaria, string> = { sim: "Sim", nao: "Não", indefinido: "não definido" };

export function respondida(item: {
  respondida?: boolean;
  publicResponse?: string;
}) {
  return (
    item.respondida ??
    (item.publicResponse ?? "").trim() !== ""
  );
}

/* ============================================================
   DADOS DO CONSUMIDOR QUE FALTAM
============================================================ */

/**
 * O que falta para uma reclamação do Reclame Aqui ter o consumidor.
 *
 * **Por que existe.** O vigia da extensão cria a reclamação pela página
 * pública do portal, e lá o nome, o telefone, o e-mail e o CPF/CNPJ não
 * aparecem — só na área da empresa. Ela entra no quadro com "Não
 * informado" e sem contato, e sem esta regra ninguém saberia quais
 * precisam ser completadas.
 *
 * Três faltas, e não uma por campo: telefone **ou** e-mail basta para
 * falar com a pessoa, e cobrar os dois acenderia o aviso em reclamação
 * que já dá para tratar. O documento entra à parte porque é ele que
 * liga a reclamação ao estabelecimento.
 *
 * Medido em 11/09/2026, antes do vigia: das 349 reclamações da base,
 * nenhuma sem nome ou sem contato, e uma sem documento. O aviso nasce
 * quase apagado e acende só com o que o portal trouxer.
 *
 * Só vale para o Reclame Aqui. Nas conversas a identidade é outra — o
 * @ do perfil, o número do WhatsApp —, e cobrar CPF de um comentário no
 * Instagram seria aviso sem sentido.
 */
export type FaltaNoCadastro = "nome" | "contato" | "documento";

export const ROTULO_DA_FALTA: Record<FaltaNoCadastro, string> = {
  nome: "nome",
  contato: "telefone ou e-mail",
  documento: "CPF/CNPJ",
};

/** O que a planilha e o vigia gravam quando não sabem o nome. */
/**
 * O nome do contato como o WhatsApp mostra, se ele serve de nome.
 *
 * Número salvo sem nome ("+55 11 9…"), emoji sozinho ou uma letra não
 * são nome de gente: devolve `null` e nada é preenchido.
 */
export function nomeDeContato(valor?: string | null) {
  const nome = String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (nome.length < 2 || !/[A-Za-zÀ-ÿ]{2,}/.test(nome)) return null;
  if ((nome.match(/\d/g) ?? []).length >= 6) return null;
  return semNome(nome) ? null : nome;
}

export function semNome(valor?: string | null) {
  return ["", "não informado", "nao informado"].includes(
    String(valor ?? "").trim().toLowerCase()
  );
}

/** Vazio, ou mascarado na importação (`(11)•••••-1234`). */
export function semValor(valor?: string | null) {
  const limpo = String(valor ?? "").trim();
  return limpo === "" || limpo.includes("•");
}

export function faltaNoCadastro(
  item: Pick<Case, "source" | "customer" | "email" | "phone" | "document">
): FaltaNoCadastro[] {

  if (item.source !== "Reclame Aqui") return [];

  const faltas: FaltaNoCadastro[] = [];

  if (semNome(item.customer)) faltas.push("nome");
  if (semValor(item.email) && semValor(item.phone)) faltas.push("contato");
  if (semValor(item.document)) faltas.push("documento");

  return faltas;
}

/** "nome, telefone ou e-mail e CPF/CNPJ" — a lista em português. */
export function descreverFaltas(faltas: FaltaNoCadastro[]) {
  const nomes = faltas.map((falta) => ROTULO_DA_FALTA[falta]);

  return nomes.length <= 1
    ? nomes.join("")
    : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}
