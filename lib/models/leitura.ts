/**
 * Por que uma leitura não trouxe nada.
 *
 * **O defeito que este arquivo existe para acabar.** Até 09/09/2026 a
 * aplicação não sabia dizer a diferença entre *"não há reclamação
 * nenhuma"* e *"não consegui ler as reclamações"*. As duas chegavam à
 * tela do mesmo jeito: uma lista vazia, zero em todos os contadores, e
 * nenhuma palavra.
 *
 * O caminho tinha oito saídas mudas — quatro dentro de `tryRole`, duas
 * em `listCases`, uma em `getApiCases`, uma em `loadWorkspace` — e
 * todas devolviam vazio. O contexto até guardava o motivo numa variável
 * chamada `syncError`, mas **nenhum componente a lia**. O erro existia
 * e não tinha para onde ir.
 *
 * Foi por isso que "os dados não carregam" apareceu quatro vezes em
 * duas semanas, sempre igual e sempre por uma causa diferente: código
 * velho no ar, `vercel.json` inválido, rota não publicada. O sintoma
 * não distinguia nenhuma delas porque a tela era a mesma.
 *
 * Vazio é um resultado. Falha é outro. A partir daqui eles têm nomes
 * diferentes, e a tela mostra qual foi.
 */

export type MotivoDaFalha =
  /** Não há `DATABASE_URL`: modo demonstração, e isso é dito. */
  | "sem-banco"

  /** O banco existe e recusou, caiu ou demorou demais. */
  | "banco-recusou"

  /** A sessão expirou entre abrir a tela e a consulta sair. */
  | "sem-sessao"

  /** A conta foi desativada, ou perdeu acesso a este módulo. */
  | "sem-permissao";

/**
 * A frase que vai para a tela.
 *
 * Escrita para quem está trabalhando, não para quem escreveu o código:
 * diz o que aconteceu e o que fazer. Sem código de erro, sem "algo deu
 * errado".
 */
export const RECADO: Record<MotivoDaFalha, string> = {
  "sem-banco":
    "Esta instalação está sem banco de dados configurado — nada do que aparece aqui é real. Confira DATABASE_URL.",

  "banco-recusou":
    "Não consegui ler o banco agora. Os dados existem; a conexão é que não respondeu. Tente recarregar em alguns segundos.",

  "sem-sessao":
    "Sua sessão expirou enquanto a tela carregava. Entre de novo para ver as reclamações.",

  "sem-permissao":
    "Sua conta não tem acesso de leitura a este módulo. Fale com quem administra a plataforma.",
};

/**
 * O resultado de uma leitura que pode falhar.
 *
 * Devolvido, e não lançado. Erro atirado de dentro de uma server action
 * chega ao navegador **sanitizado** em produção — o Next troca a
 * mensagem por um texto genérico com um identificador, de propósito,
 * para não vazar detalhe de servidor. Ou seja: lançar aqui perderia
 * exatamente a informação que este arquivo existe para entregar.
 */
export type Leitura<T> =
  | { ok: true; dados: T }
  | { ok: false; motivo: MotivoDaFalha; recado: string };

export function falhou<T>(
  motivo: MotivoDaFalha
): Leitura<T> {
  return { ok: false, motivo, recado: RECADO[motivo] };
}

export function leu<T>(dados: T): Leitura<T> {
  return { ok: true, dados };
}
