"use client";

import { useState } from "react";

import Modal, {
  Field,
  GhostButton,
  inputClass,
  PrimaryButton,
  textareaClass,
} from "@/components/shared/Modal";

import {
  KINDS,
  NpsResponseView,
  RootCauseOption,
  segmentOf,
} from "@/lib/models/nps";

import { NpsDraft } from "@/lib/actions/nps";

import { prazoPrimeiroContato } from "@/lib/services/nps.service";

interface Props {
  open: boolean;
  editing?: NpsResponseView;
  saving: boolean;
  /** Vem do cadastro (`NpsRootCause`), não mais de uma lista fixa. */
  rootCauses: RootCauseOption[];
  onClose: () => void;
  onSave: (data: NpsDraft) => void;
  onManageCauses?: () => void;
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Registro de uma resposta da pesquisa.
 *
 * Monta e desmonta com a abertura (`key` em quem abre), então os campos
 * nascem no `useState` — sem `setState` em efeito.
 */
export default function NpsForm({
  open,
  editing,
  saving,
  rootCauses,
  onClose,
  onSave,
  onManageCauses,
}: Props) {

  const [score, setScore] = useState<number>(
    editing?.score ?? 10
  );

  const [comment, setComment] = useState(
    editing?.comment ?? ""
  );

  const [respondedAt, setRespondedAt] = useState(
    editing?.respondedAt?.slice(0, 10) ?? hojeIso()
  );

  const [customer, setCustomer] = useState(
    editing?.customer ?? ""
  );

  const [email, setEmail] = useState(
    editing?.email ?? ""
  );

  const [phone, setPhone] = useState(
    editing?.phone ?? ""
  );

  const [company, setCompany] = useState(
    editing?.company ?? ""
  );

  const [kind, setKind] = useState(editing?.kind ?? "");

  const [rootCause, setRootCause] = useState(
    editing?.rootCause ?? ""
  );

  const segmento = segmentOf(score);

  const podeSalvar =
    customer.trim() !== "" && !saving;

  /** Mostrado antes de salvar: o prazo é consequência da nota. */
  const prazo = prazoPrimeiroContato(
    new Date(`${respondedAt}T12:00:00Z`),
    score,
    kind || undefined
  );

  return (
    <Modal
      open={open}
      title={
        editing
          ? "Editar resposta"
          : "Registrar resposta do NPS"
      }
      description="A nota define o segmento e o prazo do primeiro contato."
      size="wide"
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>
            Cancelar
          </GhostButton>

          <PrimaryButton
            onClick={() =>
              onSave({
                id: editing?.id,
                score,
                comment: comment.trim(),
                respondedAt: `${respondedAt}T12:00:00.000Z`,
                customer: customer.trim(),
                email: email.trim() || undefined,
                phone: phone.trim() || undefined,
                company: company.trim() || undefined,
                kind: kind || undefined,
                rootCause: rootCause || undefined,
              })
            }
            disabled={!podeSalvar}
          >
            {saving ? "Salvando..." : "Salvar"}
          </PrimaryButton>
        </>
      }
    >

      <div className="space-y-4">

        {/* Nota */}
        <div>

          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Nota dada pelo cliente
          </p>

          <div className="grid grid-cols-11 gap-1">

            {Array.from({ length: 11 }, (_, i) => i).map(
              (n) => {

                const seg = segmentOf(n);
                const ativo = score === n;

                return (
                  <button
                    key={n}
                    onClick={() => setScore(n)}
                    title={`${seg.label} — ${seg.hint}`}
                    className={`h-10 rounded-lg text-sm font-semibold transition-colors ring-1 ring-inset ${ativo ? "text-white" : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"}`}
                    style={
                      ativo
                        ? {
                            background: seg.color,
                            borderColor: seg.color,
                          }
                        : undefined
                    }
                  >
                    {n}
                  </button>
                );
              }
            )}

          </div>

          <p
            className="mt-2 flex flex-wrap items-center gap-2 text-xs"
            style={{ color: segmento.color }}
          >
            <strong className="font-semibold">
              {segmento.label}
            </strong>
            <span className="text-zinc-500">
              {segmento.hint}
            </span>
          </p>

        </div>

        <div className="grid gap-3 sm:grid-cols-2">

          <Field label="Cliente">
            <input
              value={customer}
              onChange={(e) =>
                setCustomer(e.target.value)
              }
              placeholder="Quem respondeu"
              className={inputClass}
            />
          </Field>

          <Field label="Estabelecimento">
            <input
              value={company}
              onChange={(e) =>
                setCompany(e.target.value)
              }
              placeholder="Opcional"
              className={inputClass}
            />
          </Field>

          <Field label="E-mail">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Para o contato de retorno"
              className={inputClass}
            />
          </Field>

          <Field label="Telefone">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Respondido em">
            <input
              type="date"
              value={respondedAt}
              onChange={(e) =>
                setRespondedAt(e.target.value)
              }
              className={inputClass}
            />
          </Field>

          <Field
            label="Tipo de tratativa"
            hint="Pode classificar depois."
          >
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className={inputClass}
            >
              <option value="">
                Não classificado
              </option>
              {KINDS.map((k) => (
                <option key={k.label} value={k.label}>
                  {k.emoji} {k.label}
                </option>
              ))}
            </select>
          </Field>

        </div>

        <Field
          label="Causa raiz"
          hint="Obrigatória para encerrar Reclamação, Erro no Sistema e Erro Processual."
        >
          <div className="flex gap-2">

            <select
              value={rootCause}
              onChange={(e) =>
                setRootCause(e.target.value)
              }
              className={inputClass}
            >
              <option value="">Não definida</option>

              {rootCauses
                .filter(
                  (c) =>
                    /**
                     * Causa desativada some da lista, mas continua
                     * aparecendo no registro que já a usava — senão
                     * abrir uma ficha antiga apagaria a causa dela sem
                     * ninguém pedir.
                     */
                    c.active || c.name === rootCause
                )
                .map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                    {c.active ? "" : " (desativada)"}
                  </option>
                ))}
            </select>

            {onManageCauses && (
              <button
                type="button"
                onClick={onManageCauses}
                className="shrink-0 rounded-xl border border-zinc-200 px-3 text-xs font-medium text-zinc-600 transition-colors hover:border-violet-300 hover:text-violet-700"
              >
                Gerenciar
              </button>
            )}

          </div>
        </Field>

        <Field label="Comentário do cliente">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="O que ele escreveu na pesquisa"
            className={textareaClass}
          />
        </Field>

        {!editing && (
          <p className="rounded-xl bg-violet-50/60 px-3.5 py-2.5 text-xs text-violet-800 ring-1 ring-inset ring-violet-100">
            Primeiro contato até{" "}
            <strong className="font-semibold">
              {prazo.toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </strong>{" "}
            — {segmento.slaHoursUteis} h úteis, contando só
            dias de semana. O prazo fica congelado no
            registro.
          </p>
        )}

        {kind === "Erro Processual" && !editing && (
          <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700 ring-1 ring-inset ring-amber-100">
            Vai abrir automaticamente um item de revisão em
            Projetos e Melhorias — falha de processo precisa
            de correção na origem.
          </p>
        )}

      </div>

    </Modal>
  );
}
