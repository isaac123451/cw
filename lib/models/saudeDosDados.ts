/**
 * Saúde dos dados: o que na base parece errado e distorce as contas.
 *
 * Nasceu da revisão de out/2026. Cada achado abaixo foi encontrado na base
 * real a olho, numa varredura — e todos mexiam em algum número de tela: a
 * mensalidade multiplicada por 100 virava sozinha toda a "receita em risco";
 * o plano que não existe na tabela deixava 238 contas "sem plano nem
 * mensalidade"; o cliente "@Carlos" era a menção do Slack. Achar de novo
 * dependia de alguém procurar. Agora a regra procura.
 *
 * **Só aponta.** Nada aqui corrige: cada achado diz o porquê e leva ao
 * registro, e quem decide é quem administra — às vezes o dado está certo e
 * a regra é que não conhecia o caso.
 */

export interface ItemDoAchado {
  rotulo: string;
  href: string;
}

export interface AchadoDaBase {
  chave: string;
  titulo: string;
  porque: string;
  /** O que fazer, em uma frase. */
  acao: string;
  total: number;
  /** Os primeiros, para abrir direto. */
  itens: ItemDoAchado[];
  /** Quantos da lista ficaram sem aparecer. */
  restantes: number;
}

export interface EntradaDaSaude {
  estabelecimentos: { nome: string; slug: string; plano: string | null; mensalidadeCentavos: number | null }[];
  planos: { nome: string; precoCentavos: number; ativo: boolean; tipo: string }[];
  casos: {
    id: string;
    protocolo: string;
    canal: "RECLAME_AQUI" | "SOCIAL";
    cliente: string;
    titulo: string;
    /** O link guardado na captura — a menção do Slack é o perfil de quem foi mencionado. */
    link?: string;
    status: string;
    aberto: boolean;
    dono: string | null;
    temResposta: boolean;
    respostaEm: string | null;
  }[];
  etapasQueContamComoAbertas: { nome: string; casos: number }[];
  causas: { nome: string }[];
  tarefas: { id: string; titulo: string; feita: boolean }[];
}

const MOSTRAR = 6;

/** Nome de etapa que soa como fim — a mesma régua do Configurar fluxo. */
export const PARECE_FIM = /finaliz|encerr|conclu|fechad|cancelad|arquivad/i;

/** Conta usada pelas conferências automáticas e pela bancada. */
const PARECE_TESTE = /confer[eê]ncia|\bteste?\b|\btest\b/i;

/**
 * O que o WhatsApp Web escreve no cabeçalho quando não há nome — e que já
 * entrou em título de tarefa como se fosse o cliente.
 */
const TEXTO_DA_TELA = /clique para mostrar os dados do contato|clique aqui para dados do contato|online|digitando…|visto por último/i;

export function achadosDaBase(e: EntradaDaSaude): AchadoDaBase[] {
  const achados: AchadoDaBase[] = [];

  /* ---------- mensalidade fora de escala ---------- */
  const precos = e.planos.filter((p) => p.ativo && p.precoCentavos > 0).map((p) => p.precoCentavos);
  const teto = precos.length ? Math.max(...precos) * 5 : null;
  if (teto) {
    const fora = e.estabelecimentos.filter((x) => (x.mensalidadeCentavos ?? 0) > teto);
    if (fora.length) {
      achados.push({
        chave: "mensalidade",
        titulo: `${fora.length} ${fora.length === 1 ? "mensalidade" : "mensalidades"} fora de escala`,
        porque: `Mais de 5 vezes o plano mais caro. É a marca do valor que foi multiplicado por 100 ao salvar (corrigido em out/2026) — e uma conta assim vira sozinha toda a receita recorrente e a receita em risco.`,
        acao: "Abra o estabelecimento, confira o valor e salve o certo.",
        total: fora.length,
        restantes: Math.max(0, fora.length - MOSTRAR),
        itens: fora.slice(0, MOSTRAR).map((x) => ({ rotulo: `${x.nome} · ${reais(x.mensalidadeCentavos ?? 0)}/mês`, href: `/estabelecimentos/${x.slug}` })),
      });
    }
  }

  /* ---------- plano que não está na tabela ---------- */
  const nomesDosPlanos = new Set(e.planos.map((p) => chave(p.nome)));
  const semTabela = new Map<string, number>();
  for (const x of e.estabelecimentos) {
    if (!x.plano?.trim() || nomesDosPlanos.has(chave(x.plano))) continue;
    semTabela.set(x.plano.trim(), (semTabela.get(x.plano.trim()) ?? 0) + 1);
  }
  if (semTabela.size) {
    const total = [...semTabela.values()].reduce((a, b) => a + b, 0);
    achados.push({
      chave: "plano",
      titulo: `${total} ${total === 1 ? "conta" : "contas"} com plano que não existe na tabela`,
      porque: "Sem o plano na tabela, a conta fica sem preço: entra como \"sem plano nem mensalidade\" na receita e as respostas prontas não sabem o valor.",
      acao: "Cadastre o plano em Planos e módulos, ou corrija o nome nas contas.",
      total,
      restantes: Math.max(0, semTabela.size - MOSTRAR),
      itens: [...semTabela.entries()].sort((a, b) => b[1] - a[1]).slice(0, MOSTRAR).map(([nome, n]) => ({ rotulo: `"${nome}" · ${n} ${n === 1 ? "conta" : "contas"}`, href: "/configuracoes/planos" })),
    });
  }

  /* ---------- caso com dono de teste ---------- */
  const deTeste = e.casos.filter((c) => c.aberto && c.dono && PARECE_TESTE.test(c.dono));
  if (deTeste.length) {
    achados.push({
      chave: "dono-de-teste",
      titulo: `${deTeste.length} ${deTeste.length === 1 ? "caso aberto" : "casos abertos"} com responsável de teste`,
      porque: "O responsável é a conta usada pelas conferências automáticas. Esse caso some da carga de quem atende de verdade e da distribuição.",
      acao: "Passe para uma pessoa do time.",
      total: deTeste.length,
      restantes: Math.max(0, deTeste.length - MOSTRAR),
        itens: deTeste.slice(0, MOSTRAR).map((c) => ({ rotulo: `${c.protocolo} · ${c.dono}`, href: c.canal === "SOCIAL" ? `/redes-sociais/${c.id}` : `/reclame-aqui/${c.id}` })),
    });
  }

  /* ---------- menção do Slack no lugar do cliente ---------- */
  /*
    Pelo título ("Olá @Fulano…") ou pelo link do perfil do Slack de quem foi
    mencionado (out/2026): consertado o título, o "@Carlos" seguia no quadro
    pela empresa, e a regra já não via.
  */
  const mencao = e.casos.filter(
    (c) => c.canal === "SOCIAL" && ((/^@\S+$/.test(c.cliente.trim()) && /^ol[áa]\s+@/i.test(c.titulo.trim())) || /slack\.com\/team\//i.test(c.link ?? ""))
  );
  if (mencao.length) {
    achados.push({
      chave: "mencao",
      titulo: `${mencao.length} ${mencao.length === 1 ? "atendimento" : "atendimentos"} das Redes com a menção do Slack no lugar do cliente`,
      porque: "A automação escreve \"Olá @Fulano Cliente Janaina entrou em contato…\". Antes de out/2026 a captura tomava a menção pelo perfil do cliente.",
      acao: "Abra e troque o cliente pelo nome que está no texto.",
      total: mencao.length,
      restantes: Math.max(0, mencao.length - MOSTRAR),
        itens: mencao.slice(0, MOSTRAR).map((c) => ({ rotulo: `${c.protocolo} · ${c.cliente}`, href: `/redes-sociais/${c.id}` })),
    });
  }

  /* ---------- resposta pública sem data ---------- */
  const semData = e.casos.filter((c) => c.canal === "RECLAME_AQUI" && c.temResposta && !c.respostaEm);
  if (semData.length) {
    achados.push({
      chave: "resposta-sem-data",
      titulo: `${semData.length} ${semData.length === 1 ? "resposta pública" : "respostas públicas"} sem a data`,
      porque: "Sem a data, a resposta não entra no ciclo nem no tempo até a 1ª resposta — conta como respondida, mas em dia nenhum.",
      acao: "Na aba Avaliação do caso, informe quando foi publicada e salve.",
      total: semData.length,
      restantes: Math.max(0, semData.length - MOSTRAR),
        itens: semData.slice(0, MOSTRAR).map((c) => ({ rotulo: `${c.protocolo} · ${c.status}`, href: `/reclame-aqui/${c.id}` })),
    });
  }

  /* ---------- etapa que soa como fim e conta como aberta ---------- */
  const fins = e.etapasQueContamComoAbertas.filter((x) => x.casos > 0 && PARECE_FIM.test(x.nome));
  if (fins.length) {
    const total = fins.reduce((a, b) => a + b.casos, 0);
    achados.push({
      chave: "etapa-fim",
      titulo: `${total} ${total === 1 ? "caso" : "casos"} numa etapa que soa como fim, mas conta como aberta`,
      porque: "Só Aguardando avaliação, Resolvido e Não resolvido tiram o caso da fila. Uma etapa criada no fluxo com nome de fim continua na fila, nos prazos e no \"sem resposta\".",
      acao: "Mova os casos para a etapa final certa, ou renomeie a etapa.",
      total,
      restantes: 0,
      itens: fins.map((x) => ({ rotulo: `"${x.nome}" · ${x.casos} ${x.casos === 1 ? "caso" : "casos"}`, href: "/reclame-aqui/configuracoes?tab=status" })),
    });
  }

  /* ---------- causa raiz sem nome ---------- */
  const curtas = e.causas.filter((c) => c.nome.trim().length < 3);
  if (curtas.length) {
    achados.push({
      chave: "causa-curta",
      titulo: `${curtas.length} ${curtas.length === 1 ? "causa raiz" : "causas raiz"} sem nome de verdade`,
      porque: "Uma causa de uma ou duas letras aparece nas listas de classificar e nos relatórios como se fosse um assunto.",
      acao: "Apague ou renomeie no catálogo de causas.",
      total: curtas.length,
      restantes: Math.max(0, curtas.length - MOSTRAR),
        itens: curtas.slice(0, MOSTRAR).map((c) => ({ rotulo: `"${c.nome}"`, href: "/causas-raiz" })),
    });
  }

  /* ---------- tarefa com o texto da tela do WhatsApp ---------- */
  const lixo = e.tarefas.filter((t) => !t.feita && TEXTO_DA_TELA.test(t.titulo));
  if (lixo.length) {
    achados.push({
      chave: "tarefa-texto-da-tela",
      titulo: `${lixo.length} ${lixo.length === 1 ? "atividade" : "atividades"} com o texto do WhatsApp no lugar do nome`,
      porque: "O lembrete nasceu de uma conversa cujo nome era o aviso do cabeçalho do WhatsApp (corrigido em out/2026).",
      acao: "Abra na Agenda e troque pelo nome do cliente.",
      total: lixo.length,
      restantes: Math.max(0, lixo.length - MOSTRAR),
        itens: lixo.slice(0, MOSTRAR).map((t) => ({ rotulo: t.titulo.slice(0, 80), href: "/agenda" })),
    });
  }

  return achados;
}

function chave(nome: string) {
  return nome.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
}

function reais(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\s/g, " ");
}
