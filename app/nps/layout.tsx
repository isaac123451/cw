/**
 * Só existe para dar mais relógio às server actions desta tela.
 *
 * A importação do Wootric é a chamada mais longa da aplicação: ela lê da
 * API deles de 50 em 50 e grava no Supabase, e o padrão da plataforma
 * (dez segundos no plano gratuito) corta isso no meio. O sintoma não
 * dizia nada disso — a requisição era cortada e o botão devolvia um erro
 * de rede genérico, que parecia integração quebrada quando era só
 * trabalho demais para uma requisição.
 *
 * A outra metade da correção está em `importWootric`, que agora processa
 * um punhado por rodada e diz de onde continuar. As duas juntas: cada
 * rodada é curta, e o teto aqui é a folga para nenhuma delas encostar no
 * limite.
 *
 * Sessenta segundos é o teto do plano gratuito da Vercel. Em plano pago
 * dá para subir; o valor não muda o comportamento local, onde não há
 * limite nenhum.
 */
export const maxDuration = 60;

export default function NpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
