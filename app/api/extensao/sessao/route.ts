import {
  autenticar,
  cabecalhos,
  responder,
  responderPreVoo,
} from "@/lib/api/extensao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Quem sou eu, do ponto de vista da extensão.
 *
 * Existe para o painel dizer "conectado como Fulano" e para o botão
 * "testar conexão" da tela de opções ter o que testar. Responde 200
 * também quando não há sessão — o estado "não conectado" é uma resposta
 * legítima aqui, não um erro: a extensão precisa distinguir "endereço
 * errado" (falha de rede) de "endereço certo, falta entrar".
 */
export async function GET(request: Request) {

  const { usuario, demonstracao } =
    await autenticar(request);

  return responder(request, {
    conectado: Boolean(usuario) || demonstracao,
    demonstracao,
    usuario: usuario
      ? {
          nome: usuario.nome,
          email: usuario.email,
          papel: usuario.papel,
        }
      : null,
    aplicacao: new URL(request.url).origin,
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}

export function HEAD(request: Request) {
  return new Response(null, {
    status: 200,
    headers: cabecalhos(request),
  });
}
