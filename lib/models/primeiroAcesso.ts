import type { ChaveDoPorQue } from "@/lib/documentos/porques";

/**
 * O roteiro do primeiro acesso, para quem entra no time.
 *
 * Desde 12/11/2026, uma semana guiada em 5 dias: entrar, Reclame Aqui, NPS
 * e WhatsApp, Redes e Google, números. A tela mostra o dia de agora — o
 * primeiro com passo por fazer — e o próximo passo dele; os outros dias
 * ficam recolhidos. Os passos de leitura e de tela a pessoa marca; os de
 * "fazer" se marcam sozinhos pelo que o banco registra (`automaticos`).
 */

export type DiaDoGuia = 1 | 2 | 3 | 4 | 5;

export interface PassoDoGuia {
  id: string;
  dia: DiaDoGuia;
  titulo: string;
  texto: string;
  link: string;
  rotulo: string;
  /** Um segundo destino, quando o passo cobre duas telas. */
  link2?: { href: string; rotulo: string };
  /** O trecho do documento que explica o passo. */
  porque?: ChaveDoPorQue;
  /** Marca-se pelo que o banco sabe, não por clique. */
  automatico?: boolean;
}

export const DIAS: { dia: DiaDoGuia; nome: string; objetivo: string }[] = [
  { dia: 1, nome: "Entrar", objetivo: "Deixar tudo pronto para trabalhar." },
  { dia: 2, nome: "Reclame Aqui", objetivo: "O dia começa no Meu dia, e o caso se resolve na ficha." },
  { dia: 3, nome: "NPS e WhatsApp", objetivo: "Falar com quem respondeu a pesquisa." },
  { dia: 4, nome: "Redes e Google", objetivo: "As frentes públicas." },
  { dia: 5, nome: "Números", objetivo: "Saber como a operação está indo." },
];

export const ROTEIRO: PassoDoGuia[] = [
  {
    id: "reputacao",
    dia: 1,
    titulo: "O que é reputação — e o seu papel nela",
    texto: "Os quatro canais que formam a reputação e os valores por trás de cada atendimento. Uns dez minutos de leitura.",
    link: "/documentacao?doc=cintcw-entendendo-a-reputacao",
    rotulo: "Ler o documento",
  },
  {
    id: "rotina",
    dia: 1,
    titulo: "A rotina do agente",
    texto: "O que se faz todo dia, toda semana e conforme a demanda — e a ordem entre as frentes quando o volume aperta.",
    link: "/documentacao?doc=cintcw-rotina-do-agente",
    rotulo: "Ler a rotina",
    porque: "rotina.prioridade",
  },
  {
    id: "acessos",
    dia: 1,
    titulo: "Ferramentas e acessos",
    texto: "Confira se você entra em cada ferramenta com o seu próprio usuário, e leia os lembretes de segurança.",
    link: "/ferramentas",
    rotulo: "Abrir os acessos",
    porque: "ferramentas.acessos",
  },
  {
    id: "extensao",
    dia: 1,
    titulo: "A extensão no Chrome",
    texto: "Instale a extensão do CW no Chrome e entre com o seu usuário. É ela que mostra o cliente ao lado do WhatsApp e do Reclame Aqui e guarda as conversas.",
    link: "/primeiro-acesso?aba=onde-fica#ext-whatsapp",
    rotulo: "Ver o que ela faz",
  },
  {
    id: "recebe-atendimentos",
    dia: 1,
    titulo: "Receber atendimentos",
    texto: "Peça ao gestor a marca \"Recebe atendimentos\" em Configurações › Permissões. Com ela, o Meu dia divide a fila com você. Este passo se marca sozinho quando a marca existir.",
    link: "/configuracoes/permissoes",
    rotulo: "Abrir Permissões",
    automatico: true,
  },
  {
    id: "meu-dia",
    dia: 2,
    titulo: "Meu dia",
    texto: "A tela de entrada: a fila de hoje com o número de cada frente, o que vem primeiro e o plano que cabe no expediente.",
    link: "/meu-dia",
    rotulo: "Abrir o Meu dia",
  },
  {
    id: "reclame-aqui",
    dia: 2,
    titulo: "Reclame Aqui: o quadro e a ficha do caso",
    texto: "Abra um caso: a trilha no topo mostra o passo da vez e a ação dele, e o \"por quê?\" abre a regra no documento.",
    link: "/reclame-aqui",
    rotulo: "Abrir o quadro",
    porque: "ra.criticidade",
  },
  {
    id: "primeiro-caso",
    dia: 2,
    titulo: "O seu primeiro caso tratado",
    texto: "Pegue um caso da fila, faça a imersão e registre o 1º contato. Este passo se marca sozinho quando o registro existir.",
    link: "/meu-dia",
    rotulo: "Ir para a fila do dia",
    porque: "ra.primeiro-contato",
    automatico: true,
  },
  {
    id: "nps",
    dia: 3,
    titulo: "NPS: os ciclos e a ficha",
    texto: "Os ciclos por segmento e prazo de 1º contato. A ficha tem a trilha do guia, e o encerramento volta ao Wootric com a nota.",
    link: "/nps",
    rotulo: "Abrir o NPS",
    porque: "nps.segmentacao",
  },
  {
    id: "tentativa-nps",
    dia: 3,
    titulo: "A sua primeira tentativa no NPS",
    texto: "Registre uma tentativa de contato num ciclo do NPS, pela ficha ou pela extensão. Se marca sozinho.",
    link: "/nps",
    rotulo: "Ir aos ciclos",
    automatico: true,
  },
  {
    id: "conversa-guardada",
    dia: 3,
    titulo: "Uma conversa guardada",
    texto: "Abra a conversa de um cliente no WhatsApp Web com a extensão ligada: ela guarda sozinha. Depois, ache a conversa em Conversas do WhatsApp. Se marca sozinho.",
    link: "/conversas",
    rotulo: "Abrir as conversas",
    automatico: true,
  },
  {
    id: "redes-google",
    dia: 4,
    titulo: "Redes Sociais e Google",
    texto: "O fluxo das redes, com o 1º contato em até 4 horas úteis (1 hora para perfis grandes), e as avaliações do Google com a classificação da tabela.",
    link: "/redes-sociais",
    rotulo: "Abrir as redes",
    link2: { href: "/google", rotulo: "Abrir o Google" },
    porque: "redes.primeiro-contato",
  },
  {
    id: "contato-redes",
    dia: 4,
    titulo: "O seu primeiro contato nas Redes",
    texto: "Registre o 1º contato num atendimento das redes. Se marca sozinho.",
    link: "/redes-sociais",
    rotulo: "Ir às redes",
    automatico: true,
  },
  {
    id: "resposta-pronta",
    dia: 4,
    titulo: "Uma resposta pronta usada",
    texto: "Use uma resposta pronta num caso, pelo painel da extensão. A Base mostra depois a nota que cada resposta trouxe. Se marca sozinho.",
    link: "/base-conhecimento",
    rotulo: "Ver as respostas",
    automatico: true,
  },
  {
    id: "nota-e-metas",
    dia: 5,
    titulo: "Nota e metas do Reclame Aqui",
    texto: "A nota do mês, a meta e quanto falta. A simulação mostra o que cada resposta e avaliação mudam.",
    link: "/reclame-aqui/indice",
    rotulo: "Abrir Nota e metas",
  },
  {
    id: "okr",
    dia: 5,
    titulo: "O OKR do trimestre",
    texto: "Os objetivos do time com os números calculados pela plataforma.",
    link: "/okr",
    rotulo: "Abrir o OKR",
  },
  {
    id: "analise-nps",
    dia: 5,
    titulo: "Análise do NPS e Relatório do ciclo",
    texto: "A nota do NPS, os segmentos e a taxa de resposta no WhatsApp; e o resumo do período.",
    link: "/nps/analise",
    rotulo: "Abrir a análise",
    link2: { href: "/relatorio", rotulo: "Abrir o relatório" },
  },
  {
    id: "novidades",
    dia: 5,
    titulo: "Novidades",
    texto: "O que mudou na plataforma desde que você entrou. Volte aqui quando o menu acender.",
    link: "/novidades",
    rotulo: "Abrir as novidades",
  },
];

/** O registro que marcou um passo automático: quando e onde, se houver. */
export interface MarcaAutomatica {
  quando?: string;
  onde?: string;
  link?: string;
}

export interface EstadoDoGuia {
  /** Passo → quando foi marcado (ISO). */
  passos: Record<string, string>;
  dispensadoEm?: string;
  /** O primeiro registro de contato da pessoa, se existir. */
  primeiroCaso: { quando: string; onde: string; link: string } | null;
  /** Os passos automáticos já feitos, pelo id do passo (12/11/2026). */
  automaticos?: Record<string, MarcaAutomatica>;
}

/** O estado gravado, tolerante a lixo: JSON antigo ou mexido à mão não quebra a tela. */
export function lerEstadoGravado(valor: unknown): Pick<EstadoDoGuia, "passos" | "dispensadoEm"> {
  const v = (valor && typeof valor === "object" ? valor : {}) as { passos?: unknown; dispensadoEm?: unknown };
  const passos: Record<string, string> = {};
  if (v.passos && typeof v.passos === "object") {
    for (const [id, quando] of Object.entries(v.passos as Record<string, unknown>)) {
      if (ROTEIRO.some((p) => p.id === id && !p.automatico) && typeof quando === "string") passos[id] = quando;
    }
  }
  return { passos, dispensadoEm: typeof v.dispensadoEm === "string" ? v.dispensadoEm : undefined };
}

export function feitoNoGuia(passo: PassoDoGuia, estado: EstadoDoGuia) {
  if (!passo.automatico) return Boolean(estado.passos[passo.id]);
  if (passo.id === "primeiro-caso") return Boolean(estado.primeiroCaso);
  return Boolean(estado.automaticos?.[passo.id]);
}

export function progressoDoGuia(estado: EstadoDoGuia) {
  const feitos = ROTEIRO.filter((p) => feitoNoGuia(p, estado)).length;
  /* O dia de agora é o primeiro com passo por fazer; o próximo passo é o primeiro dele. */
  const diaAtual = DIAS.find((d) => ROTEIRO.some((p) => p.dia === d.dia && !feitoNoGuia(p, estado)))?.dia ?? null;
  const proximo = diaAtual ? ROTEIRO.find((p) => p.dia === diaAtual && !feitoNoGuia(p, estado)) ?? null : null;
  return { feitos, total: ROTEIRO.length, proximo, diaAtual, concluido: proximo === null };
}
