"use client";

import { AtSign, ExternalLink, Users } from "lucide-react";

import { Case } from "@/lib/models/case";

/**
 * O que só as Redes Sociais têm.
 *
 * Ocupa o lugar de "Avaliação RA", que não faz sentido aqui: um
 * atendimento do Instagram não recebe nota do portal, não tem índice de
 * solução e nunca vai ter réplica. Pedir esses três a ele era o que
 * fazia o caso social parecer uma reclamação do Reclame Aqui.
 *
 * O que ele tem, e o Reclame Aqui não, é alcance. Um perfil de 200 mil
 * seguidores reclamando publicamente é outro problema — de outra
 * urgência e outra resposta — do que um de 200, e essa diferença não
 * cabe em nenhum campo que a tela do RA oferecia.
 */

interface Props {
  data: Case;
  onChange: (changes: Partial<Case>) => void;
}

/** "@fulano", "fulano" e a URL toda chegam ao mesmo lugar. */
function arrobaLimpa(valor: string) {
  return valor
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/+$/, "")
    .replace(/^@/, "");
}

/** Milhares com ponto, como se lê em português. */
function comSeparador(n: number) {
  return n.toLocaleString("pt-BR");
}

/**
 * A faixa de alcance, em palavras.
 *
 * O número sozinho não decide nada para quem lê rápido: "18.400" exige
 * comparar de cabeça com os outros casos da fila. A faixa responde a
 * pergunta que a pessoa realmente tem — isso aqui é grande?
 */
function faixaDeAlcance(n: number) {
  if (n >= 100_000) {
    return {
      texto: "Alcance muito alto",
      classe:
        "bg-rose-50 text-rose-700 ring-rose-100",
      nota: "Reclamação pública deste tamanho costuma sair do Instagram. Trate como prioridade.",
    };
  }

  if (n >= 10_000) {
    return {
      texto: "Alcance alto",
      classe:
        "bg-amber-50 text-amber-700 ring-amber-100",
      nota: "Perfil com público próprio — a resposta é lida por muita gente além do cliente.",
    };
  }

  if (n >= 1_000) {
    return {
      texto: "Alcance médio",
      classe:
        "bg-sky-50 text-sky-700 ring-sky-100",
      nota: "",
    };
  }

  return {
    texto: "Alcance pequeno",
    classe: "bg-zinc-100 text-zinc-600 ring-zinc-200",
    nota: "",
  };
}

export default function SocialTab({
  data,
  onChange,
}: Props) {

  const arroba = data.socialHandle ?? "";

  const seguidores =
    typeof data.followers === "number"
      ? data.followers
      : null;

  const faixa =
    seguidores !== null && seguidores > 0
      ? faixaDeAlcance(seguidores)
      : null;

  return (
    <div className="space-y-5">

      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">

        <h2 className="text-sm font-semibold text-zinc-900">
          Perfil que procurou
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          De onde veio a mensagem, e que alcance essa
          pessoa tinha quando escreveu.
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">

          <div>

            <label
              htmlFor="social-handle"
              className="block text-xs font-semibold uppercase tracking-wide text-zinc-500"
            >
              @ do perfil
            </label>

            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100">

              <AtSign
                size={15}
                className="shrink-0 text-zinc-400"
              />

              <input
                id="social-handle"
                value={arroba}
                onChange={(e) =>
                  onChange({
                    socialHandle: arrobaLimpa(
                      e.target.value
                    ),
                  })
                }
                placeholder="pizzariadobeto"
                className="w-full border-0 bg-transparent py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              />

              {arroba && (
                <a
                  href={`https://instagram.com/${encodeURIComponent(arroba)}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir o perfil no Instagram"
                  className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-violet-700"
                >
                  <ExternalLink size={14} />
                </a>
              )}

            </div>

            <p className="mt-1.5 text-xs text-zinc-500">
              Cole o @ ou o link do perfil — os dois
              chegam ao mesmo lugar.
            </p>

          </div>

          <div>

            <label
              htmlFor="social-followers"
              className="block text-xs font-semibold uppercase tracking-wide text-zinc-500"
            >
              Seguidores
            </label>

            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100">

              <Users
                size={15}
                className="shrink-0 text-zinc-400"
              />

              <input
                id="social-followers"
                inputMode="numeric"
                value={
                  seguidores === null
                    ? ""
                    : String(seguidores)
                }
                onChange={(e) => {

                  const limpo = e.target.value.replace(
                    /\D/g,
                    ""
                  );

                  onChange({
                    followers:
                      limpo === ""
                        ? undefined
                        : Number(limpo),
                  });
                }}
                placeholder="18400"
                className="w-full border-0 bg-transparent py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              />

            </div>

            {faixa ? (

              <div className="mt-2 flex flex-wrap items-center gap-2">

                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${faixa.classe}`}
                >
                  {faixa.texto}
                </span>

                <span className="text-xs text-zinc-500">
                  {comSeparador(seguidores!)} seguidores
                </span>

              </div>

            ) : (

              <p className="mt-1.5 text-xs text-zinc-500">
                Em branco enquanto ninguém consultar — o
                número não é buscado sozinho.
              </p>

            )}

            {faixa?.nota && (
              <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                {faixa.nota}
              </p>
            )}

          </div>

        </div>

      </section>

      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">

        <h2 className="text-sm font-semibold text-zinc-900">
          Por que esta aba não pede nota
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          Um atendimento de rede social não recebe
          avaliação do portal, não entra no índice de
          solução e não tem réplica — os três campos que
          a aba <strong>Avaliação RA</strong> pede. Ela
          existe só no Reclame Aqui, e este caso não é de
          lá.
        </p>

        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          O que decide a urgência aqui é o alcance de
          quem escreveu, e é isso que fica registrado
          acima.
        </p>

      </section>

    </div>
  );
}
