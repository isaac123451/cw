"use client";

import { useEffect, useState, useTransition } from "react";

import {
  CircleAlert,
  KeyRound,
  Loader2,
  MailWarning,
  Save,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { useToast } from "@/lib/context/ToastContext";

import {
  definirSegundaEtapaPropria,
  lerSeguranca,
  salvarSeguranca,
  type RetratoDaSeguranca,
} from "@/lib/actions/seguranca";

const campo =
  "h-10 w-24 rounded-xl border border-zinc-200 px-3 text-sm tabular-nums outline-none transition-colors focus:border-violet-400";

/**
 * A verificação em duas etapas, pela tela.
 *
 * A senha prova o que a pessoa **sabe**. O código por e-mail prova que
 * ela tem a caixa de entrada. É a diferença entre uma senha vazada
 * virar invasão ou virar um e-mail estranho que alguém recebe e ignora
 * — e senha vaza por reuso em outro site, não por falha daqui.
 *
 * **Duas chaves, não uma.** A exigência para todo mundo é decisão de
 * quem administra; ligar para si mesmo é decisão de cada um, e não
 * precisa de permissão de ninguém. Misturar as duas obrigaria quem
 * quer se proteger a esperar uma decisão da empresa.
 *
 * **Sem provedor de e-mail, a exigência global não liga.** Nem aqui nem
 * no servidor. É a trava mais importante desta tela: exigir um código
 * que não tem como chegar tranca a equipe inteira do lado de fora, e o
 * conserto exigiria abrir o banco.
 */
export default function SegurancaCard() {

  const { notify } = useToast();

  const [retrato, setRetrato] =
    useState<RetratoDaSeguranca | null>(null);

  const [erro, setErro] = useState("");

  const [salvando, startSalvar] = useTransition();
  const [mudandoMinha, startMinha] = useTransition();

  /** O rascunho: só vai ao banco quando clicar em Salvar. */
  const [draft, setDraft] = useState<{
    exigirParaTodos: boolean;
    minutosDeValidade: number;
    tentativas: number;
  } | null>(null);

  useEffect(() => {

    let ativo = true;

    lerSeguranca().then((resposta) => {

      if (!ativo) return;

      if ("erro" in resposta) {
        setErro(resposta.erro);
        return;
      }

      setRetrato(resposta);

      setDraft({
        exigirParaTodos: resposta.exigirParaTodos,
        minutosDeValidade: resposta.minutosDeValidade,
        tentativas: resposta.tentativas,
      });
    });

    return () => {
      ativo = false;
    };
  }, []);

  if (erro) {
    return (
      <SurfaceCard
        title="Verificação em duas etapas"
        description="Um código por e-mail depois da senha."
      >
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-700 ring-1 ring-inset ring-amber-100">
          <CircleAlert size={15} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      </SurfaceCard>
    );
  }

  if (!retrato || !draft) {
    return (
      <SurfaceCard
        title="Verificação em duas etapas"
        description="Um código por e-mail depois da senha."
      >
        <p className="flex items-center gap-2 py-6 text-sm text-zinc-400">
          <Loader2 size={15} className="animate-spin" />
          Carregando…
        </p>
      </SurfaceCard>
    );
  }

  const sujo =
    draft.exigirParaTodos !== retrato.exigirParaTodos ||
    draft.minutosDeValidade !==
      retrato.minutosDeValidade ||
    draft.tentativas !== retrato.tentativas;

  function salvar() {
    if (!draft) return;

    startSalvar(async () => {

      const resposta = await salvarSeguranca(draft);

      if (resposta.erro) {
        notify({
          tone: "error",
          title: "Não foi possível salvar.",
          detail: resposta.erro,
        });
        return;
      }

      const fresco = await lerSeguranca();

      if (!("erro" in fresco)) {
        setRetrato(fresco);
        setDraft({
          exigirParaTodos: fresco.exigirParaTodos,
          minutosDeValidade: fresco.minutosDeValidade,
          tentativas: fresco.tentativas,
        });
      }

      notify({
        tone: "success",
        title: draft.exigirParaTodos
          ? "Verificação em duas etapas exigida."
          : "Configuração de segurança salva.",
        detail: draft.exigirParaTodos
          ? "Vale a partir do próximo login de cada pessoa."
          : "Cada pessoa segue com a própria escolha.",
      });
    });
  }

  function trocarMinha(ligar: boolean) {
    startMinha(async () => {

      const resposta =
        await definirSegundaEtapaPropria(ligar);

      if (resposta.erro) {
        notify({
          tone: "error",
          title: "Não consegui mudar.",
          detail: resposta.erro,
        });
        return;
      }

      setRetrato((atual) =>
        atual
          ? {
              ...atual,
              exigirParaMim: ligar,
              pessoasComSegundaEtapa:
                atual.pessoasComSegundaEtapa +
                (ligar ? 1 : -1),
            }
          : atual
      );

      notify({
        tone: "success",
        title: ligar
          ? "Verificação ligada na sua conta."
          : "Verificação desligada na sua conta.",
        detail: ligar
          ? "No próximo login você recebe um código por e-mail."
          : "O próximo login pede só e-mail e senha.",
      });
    });
  }

  return (
    <SurfaceCard
      title="Verificação em duas etapas"
      description="Depois da senha, um código de seis dígitos por e-mail. É o que sobra de proteção quando uma senha vaza."
    >

      <div className="space-y-6">

        {/*
          O estado do envio vem primeiro porque manda em tudo abaixo:
          sem provedor, a exigência global não liga, e dizer isso depois
          do botão desabilitado seria explicar o "não" tarde demais.
        */}
        {!retrato.podeEnviar ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-100">
            <MailWarning
              size={16}
              className="mt-0.5 shrink-0"
            />
            <span>
              <strong className="font-semibold">
                Não há como enviar e-mail neste ambiente.
              </strong>{" "}
              Defina <code>RESEND_API_KEY</code> nas
              variáveis da Vercel e refaça o deploy. Até lá
              a verificação fica indisponível — exigir um
              código que não chega trancaria todo mundo do
              lado de fora.
            </span>
          </div>
        ) : retrato.remetenteDeSandbox ? (
          /*
            Envio ativo, mas para uma pessoa só.

            O sandbox do Resend entrega exclusivamente ao dono da conta.
            Um "envio ativo" verde aqui seria verdade pela metade, e a
            metade que falta é justamente a que decide se a equipe pode
            ser obrigada ao 2FA. Dizer isso antes do clique evita
            descobrir pelo erro — ou, pior, pelo login de outra pessoa.
          */
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-100">
            <MailWarning
              size={16}
              className="mt-0.5 shrink-0"
            />
            <span>
              <strong className="font-semibold">
                Envio ativo, mas só para uma pessoa.
              </strong>{" "}
              O remetente atual é o de testes do Resend, que entrega
              apenas ao e-mail dono da conta. Dá para{" "}
              <strong className="font-semibold">
                ligar na sua conta
              </strong>{" "}
              — a confirmação por e-mail é enviada antes de gravar, e
              sem ela nada é ligado. Exigir de todos fica bloqueado até
              um domínio próprio ser verificado no Resend.
            </span>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-xs text-zinc-500">
            <ShieldCheck
              size={14}
              className="text-emerald-600"
            />
            Envio de e-mail ativo pelo provedor{" "}
            <strong className="font-semibold text-zinc-700">
              {retrato.provedor}
            </strong>
            .
          </p>
        )}

        {/* ---- A minha conta ---- */}

        <div className="rounded-2xl border border-zinc-200/80 p-4">

          <div className="flex flex-wrap items-start justify-between gap-4">

            <div className="flex items-start gap-3">

              <span className="rounded-xl bg-violet-50 p-2 text-violet-600 ring-1 ring-inset ring-violet-100">
                <UserCheck size={16} />
              </span>

              <div>
                <p className="text-sm font-semibold text-zinc-900">
                  Na minha conta
                </p>
                <p className="mt-1 max-w-md text-sm text-zinc-500">
                  Vale só para você, e não depende de
                  ninguém autorizar.
                </p>
              </div>

            </div>

            <button
              type="button"
              disabled={
                mudandoMinha ||
                (!retrato.podeEnviar &&
                  !retrato.exigirParaMim)
              }
              onClick={() =>
                trocarMinha(!retrato.exigirParaMim)
              }
              className={`flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                retrato.exigirParaMim
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100"
                  : "bg-violet-800 text-white hover:bg-violet-900"
              }`}
            >
              {mudandoMinha && (
                <Loader2
                  size={14}
                  className="animate-spin"
                />
              )}
              {retrato.exigirParaMim
                ? "Ligada — desligar"
                : "Ligar para mim"}
            </button>

          </div>

        </div>

        {/* ---- A equipe ---- */}

        <div className="rounded-2xl border border-zinc-200/80 p-4">

          <div className="flex items-start gap-3">

            <span className="rounded-xl bg-violet-50 p-2 text-violet-600 ring-1 ring-inset ring-violet-100">
              <KeyRound size={16} />
            </span>

            <div className="min-w-0 flex-1">

              <p className="text-sm font-semibold text-zinc-900">
                Exigir de toda a equipe
              </p>

              <p className="mt-1 text-sm text-zinc-500">
                Passa a valer no próximo login de cada
                pessoa. Hoje{" "}
                <strong className="font-semibold text-zinc-700">
                  {retrato.pessoasComSegundaEtapa} de{" "}
                  {retrato.totalDePessoas}
                </strong>{" "}
                já usam por escolha própria.
              </p>

              {/*
                Com o sandbox o campo fica bloqueado, e com o motivo à
                vista.

                O servidor já recusa — botão desabilitado se contorna, e
                a recusa de verdade mora lá. Aqui a questão é outra:
                deixar marcar, deixar salvar e só então dizer "não" faz
                a pessoa acreditar que configurou algo. Pior ainda numa
                trava cujo erro só apareceria no login da equipe.
              */}
              <label
                className={`mt-4 flex items-center gap-2.5 ${
                  retrato.remetenteDeSandbox
                    ? "cursor-not-allowed"
                    : "cursor-pointer"
                }`}
              >

                <input
                  type="checkbox"
                  checked={
                    draft.exigirParaTodos &&
                    !retrato.remetenteDeSandbox
                  }
                  disabled={
                    !retrato.podeEnviar ||
                    retrato.remetenteDeSandbox
                  }
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      exigirParaTodos: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-zinc-300 accent-violet-700 disabled:cursor-not-allowed"
                />

                <span
                  className={`text-sm ${
                    retrato.remetenteDeSandbox
                      ? "text-zinc-400"
                      : "text-zinc-700"
                  }`}
                >
                  Exigir código por e-mail de todo mundo
                </span>

              </label>

              {retrato.remetenteDeSandbox ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Indisponível enquanto o remetente for o de testes do
                  Resend: só uma pessoa receberia o código, e as demais
                  ficariam sem entrar.
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-6 border-t border-zinc-100 pt-4">

                <div>
                  <label
                    htmlFor="ttl"
                    className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400"
                  >
                    Validade do código
                  </label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      id="ttl"
                      type="number"
                      min={1}
                      max={60}
                      value={draft.minutosDeValidade}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          minutosDeValidade: Math.max(
                            Number(e.target.value) || 0,
                            0
                          ),
                        })
                      }
                      className={campo}
                    />
                    <span className="text-sm text-zinc-500">
                      minutos
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="tentativas"
                    className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400"
                  >
                    Palpites por código
                  </label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      id="tentativas"
                      type="number"
                      min={1}
                      max={10}
                      value={draft.tentativas}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          tentativas: Math.max(
                            Number(e.target.value) || 0,
                            0
                          ),
                        })
                      }
                      className={campo}
                    />
                    <span className="text-sm text-zinc-500">
                      antes de morrer
                    </span>
                  </div>
                </div>

              </div>

              {/*
                O que o limite protege, dito onde ele é escolhido: o
                código morre, não a conta. Um limite que bloqueasse a
                pessoa viraria arma — bastaria errar cinco vezes o
                código de alguém para trancá-la fora.
              */}
              <p className="mt-3 text-xs text-zinc-400">
                Esgotados os palpites, o código morre e é
                preciso pedir outro. A conta não é
                bloqueada.
              </p>

            </div>

          </div>

        </div>

        {sujo && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-violet-50/70 px-4 py-3 ring-1 ring-inset ring-violet-100">

            <p className="text-sm text-violet-900">
              Há alterações não salvas.
            </p>

            <div className="flex gap-2">

              <button
                type="button"
                onClick={() =>
                  setDraft({
                    exigirParaTodos:
                      retrato.exigirParaTodos,
                    minutosDeValidade:
                      retrato.minutosDeValidade,
                    tentativas: retrato.tentativas,
                  })
                }
                className="h-9 rounded-xl px-3 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
              >
                Descartar
              </button>

              <button
                type="button"
                onClick={salvar}
                disabled={salvando}
                className="flex h-9 items-center gap-2 rounded-xl bg-violet-800 px-4 text-sm font-medium text-white transition-colors hover:bg-violet-900 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {salvando ? (
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <Save size={14} />
                )}
                Salvar
              </button>

            </div>

          </div>
        )}

      </div>

    </SurfaceCard>
  );
}
