/**
 * As ferramentas e planilhas do documento "Ferramentas e Acessos", para
 * importar na página de atalhos.
 *
 * O endereço só vem preenchido quando o próprio documento o dá
 * (portal.cardapioweb.com/login, ajuda.cardapioweb.com,
 * reclameaqui.com.br) ou quando é o endereço público do serviço
 * (WhatsApp Web, Gmail, Meet, Slack). Os que o documento diz "link
 * fornecido pela gestão" — HugMe, Wootric — e as planilhas
 * chegam vazios, para a gestão preencher: inventar um endereço aqui
 * mandaria o time para o lugar errado.
 */

export interface AtalhoDoDocumento {
  chave: string;
  nome: string;
  url: string;
  grupo: "ferramenta" | "planilha";
  descricao: string;
  acesso: string;
}

const SEM_SENHA = "Não salvar a senha no navegador; acesso individual, não repassar.";

export const ATALHOS_DO_DOCUMENTO: AtalhoDoDocumento[] = [
  {
    chave: "whatsapp-web",
    nome: "WhatsApp Business",
    url: "https://web.whatsapp.com",
    grupo: "ferramenta",
    descricao: "Principal canal de contato com o cliente.",
    acesso: "Retirar o celular do Reclame Aqui com a gestão responsável, abrir o WhatsApp Web e ler o QR Code.",
  },
  {
    chave: "portal-cardapio-web",
    nome: "Portal Cardápio Web",
    url: "https://portal.cardapioweb.com/login",
    grupo: "ferramenta",
    descricao: "Consulta de dados do cliente.",
    acesso: "E-mail e senha cadastrados. Acesso pessoal e intransferível.",
  },
  {
    chave: "central-de-ajuda",
    nome: "Central de Ajuda",
    url: "https://ajuda.cardapioweb.com",
    grupo: "ferramenta",
    descricao: "Artigos e instruções.",
    acesso: "",
  },
  {
    chave: "reclame-aqui-empresa",
    nome: "Reclame Aqui — área da empresa",
    url: "https://www.reclameaqui.com.br",
    grupo: "ferramenta",
    descricao: "Reclamações: as não respondidas primeiro, depois as réplicas.",
    acesso: `Entrar → aba Empresa, com o usuário individual. ${SEM_SENHA}`,
  },
  {
    chave: "hugme",
    nome: "HugMe",
    url: "",
    grupo: "ferramenta",
    descricao: "Relatórios, métricas e projeções do Reclame Aqui.",
    acesso: `Link e login fornecidos pela gestão. ${SEM_SENHA}`,
  },
  {
    chave: "wootric",
    nome: "Wootric",
    url: "",
    grupo: "ferramenta",
    descricao: "Acompanhamento das respostas de NPS.",
    acesso: `Link e login fornecidos pela gestão. ${SEM_SENHA}`,
  },
  {
    chave: "slack",
    nome: "Slack",
    url: "https://app.slack.com",
    grupo: "ferramenta",
    descricao: "Alinhamento com Suporte, Financeiro e Comercial.",
    acesso: "Login Cardápio Web.",
  },
  {
    chave: "slack-incidentes",
    nome: "Slack — #incidentes",
    url: "",
    grupo: "ferramenta",
    descricao: "O canal em que se aciona a área interna, no modelo da tratativa.",
    acesso: "Login Cardápio Web. Cole aqui o link do canal (botão direito no canal → Copiar link).",
  },
  {
    chave: "gmail",
    nome: "E-mail institucional (Gmail)",
    url: "https://mail.google.com",
    grupo: "ferramenta",
    descricao: "Comunicações formais.",
    acesso: "Login Cardápio Web.",
  },
  {
    chave: "google-meet",
    nome: "Google Meet",
    url: "https://meet.google.com",
    grupo: "ferramenta",
    descricao: "Ligações para os clientes.",
    acesso: "Login Cardápio Web.",
  },
  {
    chave: "meetime",
    nome: "Meetime",
    url: "",
    grupo: "ferramenta",
    descricao: "Ligações para os clientes.",
    acesso: "Login fornecido pela gestão.",
  },
  {
    chave: "planilha-metricas-ra",
    nome: "Métricas do Reclame Aqui",
    url: "",
    grupo: "planilha",
    descricao: "Atualizada diariamente pelo agente de Reputação com os indicadores solicitados.",
    acesso: "",
  },
  {
    chave: "planilha-kpis",
    nome: "[LID][2026] Acompanhamento de KPIs",
    url: "",
    grupo: "planilha",
    descricao: "Os indicadores da planilha de métricas, no nível liderança e diretoria.",
    acesso: "",
  },
  {
    chave: "planilha-mkt-suporte",
    nome: "[MKT] Fluxo de Atendimento Suporte",
    url: "",
    grupo: "planilha",
    descricao: "Casos vindos do Marketing que precisam de atenção ou suporte, ou com risco de Reputação.",
    acesso: "",
  },
  {
    chave: "relatorio-do-ciclo",
    nome: "Relatório do ciclo",
    url: "/relatorio",
    grupo: "planilha",
    descricao: "O relatório enviado ao fim de cada ciclo — agora montado na própria plataforma.",
    acesso: "",
  },
];

/** Os lembretes de segurança do documento, na ordem dele. */
export const LEMBRETES_DE_SEGURANCA = [
  "Não salvar a senha no navegador — nem no Reclame Aqui, nem no Wootric, nem no HugMe.",
  "Acesso individual: cada pessoa entra com o próprio usuário, e ninguém repassa o seu.",
  "O acesso ao Portal Cardápio Web é pessoal e intransferível.",
  "O celular do WhatsApp Business é retirado com a gestão responsável.",
];
