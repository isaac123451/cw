"use client";

import { useState } from "react";

import { Share2 } from "lucide-react";

import Modal, {
  Field,
  GhostButton,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/shared/Modal";

import { useMovements } from "@/lib/context/MovementsContext";
import { useSession } from "@/lib/context/SessionContext";

import { formatHours } from "@/lib/models/sla";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

interface Props {
  caseId: string;
  onClose: () => void;
}

/**
 * Encaminha o caso para uma área ou para o cliente.
 *
 * Monta e desmonta junto com a abertura (o pai só renderiza quando
 * `open`), então o estado inicial vem direto do `useState` — sem o
 * efeito de reset que os formulários mais antigos usam.
 */
export default function MovementForm({
  caseId,
  onClose,
}: Props) {

  const { rules, createMovement } = useMovements();
  const session = useSession();

  const ativas = rules.filter((item) => item.active);

  const [destination, setDestination] = useState(
    ativas[0]?.destination ?? ""
  );

  const [hours, setHours] = useState(
    String(ativas[0]?.hours ?? 24)
  );

  const [reason, setReason] = useState("");

  const [startedAt, setStartedAt] =
    useState(hojeNaOperacao());

  const regra = ativas.find(
    (item) => item.destination === destination
  );

  const prazo = Number(hours);

  const valido =
    destination !== "" &&
    reason.trim() !== "" &&
    Number.isFinite(prazo) &&
    prazo > 0;

  function escolherDestino(valor: string) {
    setDestination(valor);

    // O prazo acompanha a regra do destino, mas segue editável: uma
    // tratativa pontual pode merecer mais ou menos tempo que o padrão.
    const nova = ativas.find(
      (item) => item.destination === valor
    );

    if (nova) setHours(String(nova.hours));
  }

  function salvar() {
    if (!valido) return;

    createMovement({
      caseId,
      destination,
      reason: reason.trim(),
      actor: session?.name ?? "Operação",
      startedAt,
      dueHours: prazo,
    });

    onClose();
  }

  return (
    <Modal
      open
      title="Encaminhar caso"
      description="Abre um prazo de retorno separado do prazo público do Reclame Aqui."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>
            Cancelar
          </GhostButton>

          <PrimaryButton
            onClick={salvar}
            disabled={!valido}
          >
            <Share2 size={16} />
            Encaminhar
          </PrimaryButton>
        </>
      }
    >

      <div className="space-y-4">

        <Field
          label="Destino"
          hint={regra?.note}
        >
          <select
            value={destination}
            onChange={(e) =>
              escolherDestino(e.target.value)
            }
            className={inputClass}
          >
            {ativas.map((item) => (
              <option
                key={item.id}
                value={item.destination}
              >
                {item.destination}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="O que está sendo pedido"
          hint="Aparece na linha do tempo do caso."
        >
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Ex.: confirmar a data real da implantação antes de responder o consumidor."
            className={textareaClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">

          <Field
            label="Prazo de retorno (horas)"
            hint={
              regra
                ? `Padrão do destino: ${formatHours(regra.hours)}`
                : undefined
            }
          >
            <input
              type="number"
              min={1}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Data do encaminhamento">
            <input
              type="date"
              value={startedAt}
              onChange={(e) =>
                setStartedAt(e.target.value)
              }
              className={inputClass}
            />
          </Field>

        </div>

      </div>

    </Modal>
  );
}
