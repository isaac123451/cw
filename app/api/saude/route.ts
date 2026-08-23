import { checkToken } from "@/lib/api/auth";
import { getPrisma } from "@/lib/prisma";
import { provedorDeIA } from "@/lib/services/ia.service";
import { lerConfigDeIA } from "@/lib/services/iaConfig.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O que **este** ambiente tem configurado.
 *
 * Existe por um problema concreto e repetido: uma variável presente no
 * `.env` da máquina e ausente na Vercel produz um recurso que "funciona
 * aqui e não lá", e descobrir isso exigia entrar na aplicação, abrir a
 * extensão e clicar no botão que falha. Uma pergunta direta responde em
 * um segundo, de qualquer lugar.
 *
 * **Nenhum segredo sai daqui** — só booleanos e nomes. Saber que existe
 * chave do Gemini não é o mesmo que ter a chave, e é justamente isso
 * que se precisa saber para diagnosticar.
 *
 * Protegida pelo `API_TOKEN`, o mesmo da API pública: é informação de
 * infraestrutura, e infraestrutura não se publica sem porteiro.
 */
export async function GET(request: Request) {

  const barrado = checkToken(request);

  if (barrado) return barrado;

  const prisma = getPrisma();

  /**
   * Uma consulta trivial em vez de só checar a variável.
   *
   * `DATABASE_URL` definida não quer dizer banco alcançável — o projeto
   * do Supabase hiberna no plano gratuito depois de uma semana parada, e
   * o sintoma disso é idêntico ao de não ter configurado nada.
   */
  let banco: "ok" | "inalcancavel" | "sem-configuracao" =
    "sem-configuracao";

  if (prisma) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      banco = "ok";
    } catch {
      banco = "inalcancavel";
    }
  }

  const configDeIa = await lerConfigDeIA();

  return Response.json(
    {
      versao: process.env.npm_package_version ?? null,
      ambiente: process.env.VERCEL_ENV ?? "local",

      banco,

      /**
       * A IA como está **valendo**, não como o `.env` sugere.
       *
       * A escolha de provedor e de velocidade virou configuração de
       * tela, gravada no banco. Reportar aqui a variável de ambiente
       * passaria a mentir no dia em que alguém trocasse o perfil — e
       * esta rota existe justamente para não haver esse tipo de
       * discordância entre ambientes.
       */
      ia: {
        provedor: provedorDeIA(
          configDeIa.provedorPreferido
        ),
        perfil: configDeIa.perfil,
        origem: configDeIa.origem,
        modelo: configDeIa.modelo,
        modeloRapido: configDeIa.modeloRapido,
        corridaSegundos: Math.round(
          configDeIa.hedgeMs / 1000
        ),
        prazoSegundos: Math.round(
          configDeIa.prazoMs / 1000
        ),
        anthropic: (process.env.ANTHROPIC_API_KEY ?? "")
          .trim()
          .startsWith("sk-ant-"),
        gemini:
          (process.env.GEMINI_API_KEY ?? "").trim() !== "",
      },

      google: Boolean(
        (process.env.GOOGLE_CLIENT_ID ?? "").trim()
      ),
      wootric: Boolean(
        (process.env.WOOTRIC_CLIENT_ID ?? "").trim()
      ),

      /** Sem ela o retorno do OAuth do Google monta o localhost. */
      urlPublica:
        process.env.NEXT_PUBLIC_APP_URL ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
