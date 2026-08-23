/**
 * Permissão por **módulo**, e não por ação.
 *
 * A pergunta que estava aberta no roadmap era essa: papel por módulo ou
 * permissão fina por ação? Papel por módulo, por três motivos concretos:
 *
 * 1. **A operação é pequena.** Permissão fina compensa quando há dezenas
 *    de pessoas com recortes diferentes; aqui são três contas, e o
 *    recorte real é "quem mexe no NPS" contra "quem mexe no Reclame
 *    Aqui".
 * 2. **Permissão por ação apodrece.** Cada ação nova exige alguém
 *    decidir onde ela entra na matriz — e quem esquece cria um buraco
 *    que só aparece quando alguém faz algo que não devia.
 * 3. **O guard já fala em papéis.** `requireRole("AGENTE")` continua
 *    igual; o que muda é de onde o papel vem. Nenhuma action precisou
 *    aprender um vocabulário novo.
 *
 * **Só a exceção é gravada.** Quem não tem linha aqui segue o papel da
 * conta. É a mesma escolha das metas de reputação: guardar o padrão em
 * toda linha congelaria uma cópia dele, e mudar o papel da pessoa
 * deixaria de valer onde ninguém mexeu.
 */


/**
 * Papel de acesso. Mora aqui, e não no guard, por um motivo de bundle:
 * `lib/auth/guard.ts` é `server-only` e arrasta o Prisma junto. Uma tela
 * que só queria escrever "Administrador" puxava o driver do Postgres
 * para o navegador — e o build parava com `module not found: dns`.
 */
export type Role = "ADMIN" | "AGENTE" | "LEITURA";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  AGENTE: "Agente",
  LEITURA: "Somente leitura",
};

export const MODULES = [
  "reclame-aqui",
  "nps",
  "clientes",
  "estabelecimentos",
  "agenda",
  "impacto",
  "jornada",
  "projetos",
  "documentacao",
  "base-conhecimento",
  "configuracoes",
] as const;

export type Modulo = (typeof MODULES)[number];

export const MODULE_LABELS: Record<Modulo, string> = {
  "reclame-aqui": "Reclame Aqui",
  nps: "NPS",
  clientes: "Clientes",
  estabelecimentos: "Estabelecimentos",
  agenda: "Agenda",
  impacto: "Impacto financeiro",
  jornada: "Jornada",
  projetos: "Projetos e melhorias",
  documentacao: "Documentação",
  "base-conhecimento": "Respostas prontas",
  configuracoes: "Configurações",
};

export const MODULE_HINTS: Record<Modulo, string> = {
  "reclame-aqui":
    "Quadro, gaveta do caso, resposta pública e avaliação.",
  nps: "Ciclo de feedback, tratativa e o cadastro de etapas e tipos.",
  clientes: "Ficha do consumidor e o que a operação preenche por cima.",
  estabelecimentos:
    "Restaurantes que contratam, plano e situação da conta.",
  agenda: "Tarefas, prazos e a integração com o Google Agenda.",
  impacto: "Lançamentos de receita retida e custo evitado.",
  jornada: "Etapas do ciclo de vida e os registros por tópico.",
  projetos: "Melhorias e revisões de processo.",
  documentacao: "Playbooks da operação.",
  "base-conhecimento":
    "Respostas prontas do Reclame Aqui e do WhatsApp.",
  configuracoes:
    "Fluxo, categorias, times, integrações, IA e a tabela de planos.",
};

export function ehModulo(valor: string): valor is Modulo {
  return (MODULES as readonly string[]).includes(valor);
}
