"use client";

import { useState } from "react";

import {
  Check,
  CircleAlert,
  Megaphone,
  Phone,
  X,
} from "lucide-react";

import Modal, {
  Field,
  GhostButton,
  inputClass,
  PrimaryButton,
} from "@/components/shared/Modal";

import {
  CHANNELS,
  isEncerrado,
  kindRule,
  moodOf,
  MOODS,
  NpsResponseView,
  segmentOf,
} from "@/lib/models/nps";

import {
  checklist,
  deveEncerrarSemRetorno,
  podeEncerrar,
  slaState,
} from "@/lib/services/nps.service";

interface Props {
  item: NpsResponseView;
  onClose: () => void;
  onAttempt: (
    channel: string,
    note: string
  ) => Promise<void>;
  onConfirm: (valor: boolean) => Promise<void>;
  onStatus: (status: string) => Promise<void>;
  onAdvocacy: (
    campo: "review" | "testimonial" | "referral",
    valor: boolean
  ) => Promise<void>;
  onPostContact: (dados: {
    mood?: number | null;
    resolved?: boolean | null;
    note?: string;
  }) => Promise<void>;
}

function quando(iso?: string) {
  return iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}

/**
 * Tratativa de uma resposta: é onde o ciclo se fecha.
 *
 * A ordem segue o guia — contatar, registrar, confirmar, encerrar — e o
 * botão de encerrar só libera quando o checklist obrigatório está
 * cumprido. Sem isso "encerrado" vira um clique sem lastro.
 */
export default function NpsDrawer({
  item,
  onClose,
  onAttempt,
  onConfirm,
  onStatus,
  onAdvocacy,
  onPostContact,
}: Props) {

  const [channel, setChannel] = useState(CHANNELS[0]);
  const [note, setNote] = useState("");
  const [salvando, setSalvando] = useState(false);

  /** Rascunho do pós-contato — só vai ao banco quando registrar. */
  const [humor, setHumor] = useState<number | undefined>(
    item.moodAfter
  );

  const [resolveu, setResolveu] = useState<
    boolean | undefined
  >(item.resolvedAfter);

  const [notaContato, setNotaContato] = useState(
    item.postContactNote ?? ""
  );

  const [gravandoPos, setGravandoPos] = useState(false);

  const posAlterado =
    humor !== item.moodAfter ||
    resolveu !== item.resolvedAfter ||
    notaContato !== (item.postContactNote ?? "");

  async function registrarPosContato() {

    setGravandoPos(true);

    await onPostContact({
      mood: humor ?? null,
      resolved: resolveu ?? null,
      note: notaContato,
    });

    setGravandoPos(false);
  }

  const segmento = segmentOf(item.score);
  const regra = kindRule(item.kind);

  const itens = checklist(item);
  const liberado = podeEncerrar(item);
  const encerrado = isEncerrado(item.status);

  const sla = slaState(item);
  const abandono = deveEncerrarSemRetorno(item);

  async function registrar() {

    if (note.trim() === "") return;

    setSalvando(true);
    await onAttempt(channel, note.trim());
    setSalvando(false);
    setNote("");
  }

  return (
    <Modal
      open
      title={item.customer}
      description={[
        `Nota ${item.score}`,
        segmento.label,
        item.company,
        // O humor entra no cabeçalho porque é o dado que responde
        // "como está esse cliente agora", que é o motivo de abrir a ficha.
        moodOf(item.moodAfter) &&
          `${moodOf(item.moodAfter)?.emoji} ${moodOf(item.moodAfter)?.label} após contato`,
        item.source === "Wootric" && "via Wootric",
      ]
        .filter(Boolean)
        .join(" · ")}
      size="wide"
      onClose={onClose}
      footer={<GhostButton onClick={onClose}>Fechar</GhostButton>}
    >

      <div className="space-y-5">

        {/* Situação */}
        <div className="grid gap-2 sm:grid-cols-3">

          {[
            {
              label: "Status",
              valor: item.status,
            },
            {
              label: "Primeiro contato",
              valor: item.firstContactAt
                ? quando(item.firstContactAt)
                : `até ${quando(item.firstContactDueAt)}`,
            },
            {
              label: "Tipo",
              valor: item.kind ?? "Não classificado",
            },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-xl bg-zinc-50 px-3.5 py-2.5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                {c.label}
              </p>
              <p className="mt-0.5 truncate text-sm font-medium text-zinc-800">
                {c.valor}
              </p>
            </div>
          ))}

        </div>

        {sla === "estourado" && (
          <p className="flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 ring-1 ring-inset ring-rose-100">
            <CircleAlert size={14} />
            Primeiro contato fora do prazo — o SLA do
            segmento {segmento.label} é de{" "}
            {segmento.slaHoursUteis} h úteis.
          </p>
        )}

        {abandono.deve && !encerrado && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-3.5 py-2.5 ring-1 ring-inset ring-amber-100">

            <p className="text-xs text-amber-800">
              Critério de falta de retorno atingido:{" "}
              {abandono.motivo}
            </p>

            <button
              onClick={() =>
                onStatus("[Encerrado] Sem Retorno")
              }
              className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700"
            >
              Encerrar sem retorno
            </button>

          </div>
        )}

        {item.comment && (
          <div className="rounded-xl border border-zinc-200 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              O que o cliente escreveu
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-700">
              {item.comment}
            </p>
          </div>
        )}

        {regra && (
          <p className="rounded-xl bg-zinc-50 px-3.5 py-2.5 text-xs leading-relaxed text-zinc-600">
            <strong className="font-semibold text-zinc-800">
              {regra.emoji} {regra.label}:
            </strong>{" "}
            {regra.acao}
          </p>
        )}

        {/* Contato */}
        <div>

          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Tentativas de contato ({item.attempts.length})
          </p>

          {item.attempts.length > 0 && (
            <ul className="mb-3 space-y-1.5">
              {item.attempts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start gap-2.5 rounded-lg border border-zinc-100 px-3 py-2 text-xs"
                >
                  <Phone
                    size={12}
                    className="mt-0.5 shrink-0 text-zinc-300"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-zinc-700">
                      {a.channel}
                    </span>
                    {a.note && (
                      <span className="text-zinc-500">
                        {" "}
                        — {a.note}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-400">
                    {quando(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {!encerrado && (
            <div className="flex flex-wrap items-end gap-2">

              <Field label="Canal">
                <select
                  value={channel}
                  onChange={(e) =>
                    setChannel(e.target.value)
                  }
                  className={`${inputClass} w-36`}
                >
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="O que aconteceu"
                className="min-w-[220px] flex-1"
              >
                <input
                  value={note}
                  onChange={(e) =>
                    setNote(e.target.value)
                  }
                  placeholder="Ex.: ligou, caiu na caixa postal"
                  className={inputClass}
                />
              </Field>

              <PrimaryButton
                onClick={registrar}
                disabled={
                  salvando || note.trim() === ""
                }
              >
                Registrar
              </PrimaryButton>

            </div>
          )}

        </div>

        {/* Régua de humor — o depois */}
        <div className="rounded-xl border border-zinc-200 p-3.5">

          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Depois do contato
          </p>

          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            A nota {item.score} é de <strong className="font-semibold">antes</strong> — mede como o cliente estava ao responder a pesquisa, e não muda, porque é ela que compõe o NPS. A régua abaixo mede outra coisa: se o contato moveu a agulha.
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {MOODS.map((m) => {

              const ativo = humor === m.value;

              return (
                <button
                  key={m.value}
                  type="button"
                  title={m.hint}
                  onClick={() =>
                    setHumor(ativo ? undefined : m.value)
                  }
                  style={
                    ativo
                      ? {
                          borderColor: m.color,
                          background: `${m.color}14`,
                          color: m.color,
                        }
                      : undefined
                  }
                  className={`flex flex-1 min-w-[86px] flex-col items-center gap-0.5 rounded-xl border px-2 py-2 transition-colors ${ativo ? "font-semibold" : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50"}`}
                >
                  <span className="text-lg leading-none">
                    {m.emoji}
                  </span>
                  <span className="text-[10.5px] leading-tight">
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">

            <span className="text-xs font-medium text-zinc-600">
              A situação foi resolvida?
            </span>

            {(
              [
                [true, "Sim", "emerald"],
                [false, "Não", "rose"],
              ] as const
            ).map(([valor, label, cor]) => {

              const ativo = resolveu === valor;

              return (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    setResolveu(ativo ? undefined : valor)
                  }
                  className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${ativo ? (cor === "emerald" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-rose-300 bg-rose-50 text-rose-700") : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
                >
                  {label}
                </button>
              );
            })}

            {resolveu === true && (
              <span className="text-[11px] text-zinc-400">
                marca também a confirmação do checklist
              </span>
            )}

          </div>

          <input
            value={notaContato}
            onChange={(e) =>
              setNotaContato(e.target.value)
            }
            placeholder="O que ficou combinado (opcional)"
            className={`${inputClass} mt-3`}
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">

            <p className="text-[11px] text-zinc-400">
              {item.postContactAt
                ? `Registrado em ${quando(item.postContactAt)}${item.postContactBy ? ` por ${item.postContactBy}` : ""}.`
                : "Ainda não registrado."}
            </p>

            <PrimaryButton
              onClick={registrarPosContato}
              disabled={gravandoPos || !posAlterado}
            >
              {item.postContactAt
                ? "Atualizar"
                : "Registrar"}
            </PrimaryButton>

          </div>

        </div>

        {/* Elogio de promotor: o guia pede as três ações */}
        {item.kind === "Elogio" &&
          segmento.label === "Promotor" && (

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5">

              <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-800">
                <Megaphone size={14} />
                Aproveitar enquanto o sentimento está
                positivo
              </p>

              <div className="space-y-1.5">
                {(
                  [
                    ["review", "Direcionado para review pública (Google)", item.reviewAsked],
                    ["testimonial", "Perguntado se aceita ser case/depoimento", item.testimonialAsked],
                    ["referral", "Pedida indicação de outros clientes", item.referralAsked],
                  ] as const
                ).map(([campo, label, valor]) => (
                  <label
                    key={campo}
                    className="flex cursor-pointer items-center gap-2 text-sm text-emerald-900"
                  >
                    <input
                      type="checkbox"
                      checked={valor}
                      onChange={(e) =>
                        onAdvocacy(
                          campo,
                          e.target.checked
                        )
                      }
                      className="h-4 w-4 accent-emerald-600"
                    />
                    {label}
                  </label>
                ))}
              </div>

            </div>

          )}

        {/* Confirmação do cliente */}
        {regra?.exigeConfirmacao && !encerrado && (

          <div className="rounded-xl border border-zinc-200 p-3.5">

            <p className="text-xs leading-relaxed text-zinc-600">
              O guia exige a pergunta de reengajamento —
              &quot;isso resolveu sua questão?&quot; — antes
              de encerrar como resolvido. Sem a confirmação
              o loop fica em{" "}
              <strong className="font-semibold">
                [Aguardando Resposta]
              </strong>
              .
            </p>

            <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={Boolean(item.confirmedAt)}
                onChange={(e) =>
                  onConfirm(e.target.checked)
                }
                className="h-4 w-4 accent-violet-600"
              />
              O cliente confirmou que a questão foi
              resolvida
            </label>

          </div>

        )}

        {/* Checklist */}
        <div>

          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Checklist de encerramento
          </p>

          <ul className="space-y-1">
            {itens.map((c) => (
              <li
                key={c.label}
                className="flex items-center gap-2 text-sm"
              >
                {c.ok ? (
                  <Check
                    size={14}
                    className="shrink-0 text-emerald-600"
                  />
                ) : (
                  <X
                    size={14}
                    className={`shrink-0 ${c.obrigatorio ? "text-rose-500" : "text-zinc-300"}`}
                  />
                )}
                <span
                  className={
                    c.ok
                      ? "text-zinc-500"
                      : c.obrigatorio
                      ? "text-zinc-800"
                      : "text-zinc-400"
                  }
                >
                  {c.label}
                  {!c.obrigatorio && " (opcional)"}
                </span>
              </li>
            ))}
          </ul>

        </div>

        {/* Encerramento */}
        {!encerrado && regra && (

          <div>

            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Encerrar como
            </p>

            <div className="flex flex-wrap gap-2">
              {regra.finais.map((f) => {

                const bloqueado =
                  f.startsWith("[Encerrado] Resolvido") &&
                  !liberado;

                return (
                  <button
                    key={f}
                    onClick={() => onStatus(f)}
                    disabled={bloqueado}
                    title={
                      bloqueado
                        ? "Cumpra os itens obrigatórios do checklist primeiro."
                        : undefined
                    }
                    className="rounded-xl border border-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-200 disabled:hover:bg-transparent disabled:hover:text-zinc-700"
                  >
                    {f}
                  </button>
                );
              })}
            </div>

          </div>

        )}

        {encerrado && (
          <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800 ring-1 ring-inset ring-emerald-100">
            {item.status} em {quando(item.closedAt)}.
          </p>
        )}

      </div>

    </Modal>
  );
}
