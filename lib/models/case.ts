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

  priority: "Crítica" | "Alta" | "Média" | "Baixa";

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
export function respondida(item: {
  respondida?: boolean;
  publicResponse?: string;
}) {
  return (
    item.respondida ??
    (item.publicResponse ?? "").trim() !== ""
  );
}
