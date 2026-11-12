import { itemDeConfiguracoes, menuItems } from "@/core/navigation/menu";
import type { TelaDaBusca } from "@/lib/models/buscaGlobal";
import { funcoesParaABusca } from "@/lib/models/ondeFica";

/**
 * A busca da plataforma: Ctrl+K (ou Cmd+K, ou "/") de qualquer tela.
 *
 * O campo do topo era só desenho — não buscava nada. Agora abre esta
 * paleta, que acha casos, NPS, clientes, estabelecimentos, conversas e as
 * próprias telas, inclusive pelos nomes que as pessoas usam ("sla",
 * "planos", "permissões"). Enter abre; Shift+Enter abre o caso numa
 * mini-janela, sem sair de onde se está.
 */

const TELAS_EXTRAS: TelaDaBusca[] = [
  { titulo: "Novo caso no Reclame Aqui", href: "/reclame-aqui/novo", grupo: "Ação", sinonimos: ["criar caso", "nova reclamacao", "cadastrar reclamacao"] },
  { titulo: "Integrações", href: "/configuracoes/integracoes", grupo: "Configurações", sinonimos: ["wootric", "google", "webhook", "api", "extensao"] },
  { titulo: "Planos e módulos", href: "/configuracoes/planos", grupo: "Configurações", sinonimos: ["planos", "mensalidade", "precos"] },
  { titulo: "Permissões", href: "/configuracoes/permissoes", grupo: "Configurações", sinonimos: ["acesso", "papel", "usuarios"] },
  { titulo: "Segurança do acesso", href: "/configuracoes/seguranca", grupo: "Configurações", sinonimos: ["duas etapas", "2fa", "senha"] },
  { titulo: "Minha conta", href: "/conta", grupo: "Conta", sinonimos: ["perfil", "notificacoes", "preferencias"] },
  { titulo: "Times", href: "/times", grupo: "Configurações", sinonimos: ["equipe", "responsaveis"] },
];

const SINONIMOS: Record<string, string[]> = {
  "/processos": ["sla", "prazos", "expediente", "feriados", "areas", "movimentacoes"],
  "/reclame-aqui/avaliacoes": ["pedir avaliacao", "fila de avaliacao"],
  "/reclame-aqui/plano": ["plano de acao", "metas", "meta do mes", "previsao", "previsao de reclamacoes", "assuntos", "em alta", "o que mais chega", "ciclo"],
  "/reclame-aqui/categorias": ["categorias", "classificacao", "reclassificar", "subcategorias", "unificar categorias"],
  "/reclame-aqui/tempo-ideal": ["prazo ideal", "teto", "tempo de finalizacao", "tempo de resposta", "folga do indice"],
  "/relatorio": ["relatorio de reputacao", "ciclo", "gestao"],
  "/base-conhecimento": ["macros", "modelos de resposta", "respostas prontas"],
  "/meu-dia": ["rotina", "plano do dia", "hoje"],
  "/distribuicao": ["carga", "ausencia", "ferias", "redistribuir", "atribuir", "fila"],
  "/impacto": ["reembolso", "credito", "financeiro"],
  "/conversas": ["whatsapp", "mensagens"],
  "/documentacao": ["documentos", "guias", "manual"],
  "/reclame-aqui/calculadora": ["simulador", "nota", "ra1000"],
  "/configuracoes": ["categorias", "etiquetas", "tags", "configurar"],
};

/**
 * As telas da busca: o menu, as extras e as funções do mapa "Onde fica?"
 * (12/11/2026). A função que mora numa tela do menu soma o nome e os
 * apelidos a ela ("áudio" acha Conversas do WhatsApp); a que não tem tela
 * (a extensão, o sino) leva ao item no mapa. Uma tela, um resultado.
 */
export function telasDaBusca(): TelaDaBusca[] {
  const lista: TelaDaBusca[] = [
    ...[...menuItems, itemDeConfiguracoes].flatMap((m) => [
      { titulo: m.title, href: m.href, grupo: m.group, sinonimos: SINONIMOS[m.href] },
      ...(m.children ?? [])
        .filter((f) => f.href !== m.href)
        .map((f) => ({ titulo: `${m.title} · ${f.title}`, href: f.href, grupo: m.group, sinonimos: SINONIMOS[f.href] })),
    ]),
    ...TELAS_EXTRAS.map((t) => ({ ...t })),
  ];
  const porHref = new Map(lista.map((t) => [t.href, t]));
  for (const funcao of funcoesParaABusca()) {
    const tela = porHref.get(funcao.href);
    if (tela) tela.sinonimos = [...(tela.sinonimos ?? []), funcao.titulo.toLowerCase(), ...funcao.sinonimos];
    else {
      lista.push(funcao);
      porHref.set(funcao.href, funcao);
    }
  }
  return lista;
}
