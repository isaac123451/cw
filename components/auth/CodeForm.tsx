"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RotateCw,
} from "lucide-react";

import type { FormState } from "@/lib/auth/actions";

interface Props {
  verificar: (
    state: FormState,
    formData: FormData
  ) => Promise<FormState>;

  reenviar: (
    state: FormState,
    formData: FormData
  ) => Promise<FormState>;

  cancelar: () => Promise<void>;

  /** E-mail já mascarado pelo servidor. */
  destino: string;
}

function Enviar() {

  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-800 text-sm font-medium text-white transition-colors hover:bg-violet-900 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending && (
        <Loader2 size={15} className="animate-spin" />
      )}
      Confirmar e entrar
    </button>
  );
}

function Reenviar() {

  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1.5 text-xs font-medium text-violet-700 transition-colors hover:text-violet-900 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <RotateCw size={13} />
      )}
      Enviar outro código
    </button>
  );
}

export default function CodeForm({
  verificar,
  reenviar,
  cancelar,
  destino,
}: Props) {

  const [estado, conferir] = useActionState(
    verificar,
    {}
  );

  const [envio, mandarOutro] = useActionState(
    reenviar,
    {}
  );

  const campo = useRef<HTMLInputElement>(null);

  /**
   * O foco vai para o campo assim que a tela abre, e volta para ele
   * depois de um erro.
   *
   * Quem chega aqui tem o código na outra mão, muitas vezes no celular.
   * Ter de clicar no campo antes de digitar é atrito no meio de um
   * login — e depois de errar, o campo ainda guarda o palpite anterior,
   * que precisa sair.
   */
  useEffect(() => {
    campo.current?.focus();
    if (estado.error) campo.current?.select();
  }, [estado.error]);

  return (
    <div className="space-y-4">

      <p className="rounded-xl bg-zinc-50 px-3.5 py-3 text-sm text-zinc-600">
        Enviamos um código de seis dígitos para{" "}
        <strong className="font-semibold text-zinc-900">
          {destino}
        </strong>
        .
      </p>

      <form action={conferir} className="space-y-4">

        <div>

          <label
            htmlFor="code"
            className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
          >
            Código de verificação
          </label>

          <input
            ref={campo}
            id="code"
            name="code"
            /**
             * `text` com `inputMode="numeric"`, não `type="number"`.
             *
             * O campo numérico do navegador aceita sinal, expoente e
             * setas de incremento — nada disso faz sentido num código —
             * e come o zero à esquerda, que aqui é dígito significativo:
             * "042318" viraria "42318".
             */
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoComplete="one-time-code"
            placeholder="000000"
            className="mt-1.5 h-14 w-full rounded-xl border border-zinc-200 bg-white text-center font-mono text-2xl tracking-[0.5em] outline-none transition-colors placeholder:text-zinc-300 focus:border-violet-400"
          />

          <p className="mt-1.5 text-xs text-zinc-400">
            O código vale por alguns minutos e serve uma vez só.
          </p>

        </div>

        {estado.error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-100"
          >
            <AlertCircle
              size={15}
              className="mt-0.5 shrink-0"
            />
            {estado.error}
          </p>
        )}

        {envio.success && !estado.error && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-100"
          >
            <CheckCircle2
              size={15}
              className="mt-0.5 shrink-0"
            />
            {envio.success}
          </p>
        )}

        {envio.error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-700 ring-1 ring-inset ring-amber-100"
          >
            <AlertCircle
              size={15}
              className="mt-0.5 shrink-0"
            />
            {envio.error}
          </p>
        )}

        <Enviar />

      </form>

      <div className="flex items-center justify-between border-t border-zinc-100 pt-4">

        {/*
          Os dois formulários são separados de propósito. Um botão de
          reenviar dentro do formulário de conferência enviaria o campo
          do código junto e disputaria o mesmo estado — e um clique em
          "reenviar" apagaria o erro do palpite anterior, que é
          justamente o que a pessoa precisa continuar lendo.
        */}
        <form action={mandarOutro}>
          <Reenviar />
        </form>

        <form action={cancelar}>
          <button
            type="submit"
            className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-800"
          >
            Usar outra conta
          </button>
        </form>

      </div>

    </div>
  );
}
