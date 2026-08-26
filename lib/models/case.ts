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