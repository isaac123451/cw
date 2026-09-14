import type { ChaveDoPorQue } from "@/lib/documentos/porques";

/**
 * O roteiro do primeiro acesso, para quem entra no time.
 *
 * "Um roteiro curto pela rotina e pelas telas, que termina com o
 * primeiro caso tratado de verdade." Três partes: entender (os
 * documentos que dizem o porquê), conhecer as telas (onde cada coisa
 * se faz) e fazer de verdade. Os passos de leitura e de tela a pessoa
 * marca; o último se marca sozinho, pelo registro do primeiro contato.
 */

export type ParteDoGuia = "Entender" | "Conhecer as telas" | "Fazer de verdade";

export interface PassoDoGuia {
  id: string;
  parte: ParteDoGuia;
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

export const ROTEIRO: PassoDoGuia[] = [
  {
    id: "reputacao",
    parte: "Entender",
    titulo: "O que é reputação — e o seu papel nela",
    texto: "Os quatro canais que formam a reputação e os valores por trás de cada atendimento. Uns dez minutos de leitura.",
    link: "/documentacao?doc=cintcw-entendendo-a-reputacao",
    rotulo: "Ler o documento",
  },
  {
    id: "rotina",
    parte: "Entender",
    titulo: "A rotina do agente",
    texto: "O que se faz todo dia, toda semana e conforme a demanda — e a ordem entre as frentes quando o volume aperta.",
    link: "/documentacao?doc=cintcw-rotina-do-agente",
    rotulo: "Ler a rotina",
    porque: "rotina.prioridade",
  },
  {
    id: "acessos",
    parte: "Entender",
    titulo: "Ferramentas e acessos",
    texto: "Confira se você entra em cada ferramenta com o seu próprio usuário, e leia os lembretes de segurança.",
    link: "/ferramentas",
    rotulo: "Abrir os acessos",
    porque: "ferramentas.acessos",
  },
  {
    id: "meu-dia",
    parte: "Conhecer as telas",
    titulo: "Meu dia",
    texto: "A tela de entrada: a rotina de hoje com o número de cada frente, o plano que cabe no expediente e o checkpoint para o Slack.",
    link: "/meu-dia",
    rotulo: "Abrir o Meu dia",
  },
  {
    id: "reclame-aqui",
    parte: "Conhecer as telas",
    titulo: "Reclame Aqui: o quadro e a ficha do caso",
    texto: "Abra um caso: a trilha no topo mostra o passo da vez e a ação dele, e o \"por quê?\" abre a regra no documento.",
    link: "/reclame-aqui",
    rotulo: "Abrir o quadro",
    porque: "ra.criticidade",
  },
  {
    id: "nps",
    parte: "Conhecer as telas",
    titulo: "NPS",
    texto: "Os ciclos por segmento e prazo de 1º contato; a ficha tem a trilha do guia, e o encerramento volta ao Wootric com a nota.",
    link: "/nps",
    rotulo: "Abrir o NPS",
    porque: "nps.segmentacao",
  },
  {
    id: "redes-google",
    parte: "Conhecer as telas",
    titulo: "Redes Sociais e Google",
    texto: "O fluxo das redes, com o 1º contato em até 4 horas úteis (1 hora para perfis grandes), e as avaliações do Google com a classificação da tabela.",
    link: "/redes-sociais",
    rotulo: "Abrir as redes",
    link2: { href: "/google", rotulo: "Abrir o Google" },
    porque: "redes.primeiro-contato",
  },
  {
    id: "primeiro-caso",
    parte: "Fazer de verdade",
    titulo: "O seu primeiro caso tratado",
    texto: "Pegue um caso da fila, faça a imersão e registre o 1º contato — no Reclame Aqui, nas redes ou no NPS. Este passo se marca sozinho quando o registro existir.",
    link: "/meu-dia",
    rotulo: "Ir para a fila do dia",
    porque: "ra.primeiro-contato",
    automatico: true,
  },
];

export const PARTES: ParteDoGuia[] = ["Entender", "Conhecer as telas", "Fazer de verdade"];

export interface EstadoDoGuia {
  /** Passo → quando foi marcado (ISO). */
  passos: Record<string, string>;
  dispensadoEm?: string;
  /** O primeiro registro de contato da pessoa, se existir. */
  primeiroCaso: { quando: string; onde: string; link: string } | null;
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
  return passo.automatico ? Boolean(estado.primeiroCaso) : Boolean(estado.passos[passo.id]);
}

export function progressoDoGuia(estado: EstadoDoGuia) {
  const feitos = ROTEIRO.filter((p) => feitoNoGuia(p, estado)).length;
  const proximo = ROTEIRO.find((p) => !feitoNoGuia(p, estado)) ?? null;
  return { feitos, total: ROTEIRO.length, proximo, concluido: proximo === null };
}
