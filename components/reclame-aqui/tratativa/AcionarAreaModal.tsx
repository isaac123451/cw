"use client";

import { useMemo, useState } from "react";

import { Loader2, Send, TriangleAlert } from "lucide-react";

import Modal, { GhostButton, inputClass, textareaClass } from "@/components/shared/Modal";
import BotaoCopiar from "@/components/shared/BotaoCopiar";

import type { Case } from "@/lib/models/case";
import type { CaseMovement } from "@/lib/models/movement";
import { linkDoPortal } from "@/lib/models/establishment";
import {
  AREAS_INTERNAS,
  CANAL_DE_INCIDENTES,
  mensagemDeAcionamento,
} from "@/lib/models/mensagens";
import { descreverPrazo, prazoUtil } from "@/lib/services/horasUteis";

import { acionarArea } from "@/lib/actions/tratativa";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";
import { useMovements } from "@/lib/context/MovementsContext";
import { useSla } from "@/lib/context/SlaContext";
import { useToast } from "@/lib/context/ToastContext";

import { quandoVence } from "./RelogioDoCaso";

interface Props {
  item: Case;
  onClose: () => void;
  onSalvo: (movimento: CaseMovement) => void;
}

const PAPEIS = ["Dono", "Gerente", "Funcionário"];

/**
 * Acionar uma área interna, do jeito da documentação.
 *
 * O documento pede quatro coisas em toda passagem para outra área — link
 * do RA, portal e nome; resumo e o que é preciso; prazo pela prioridade;
 * contato — num modelo fixo, no canal #incidentes-experiencia-do-cliente.
 * A plataforma monta o modelo com o caso, abre o relógio da área com o
 * prazo da criticidade e copia a mensagem. Quem cola no Slack é você.
 */
export default function AcionarAreaModal({ item, onClose, onSalvo }: Props) {

  const { notify } = useToast();
  const { expediente } = useSla();
  const { rules, prazosDeArea } = useMovements();
  const { establishments } = useEstablishments();

  const estabelecimento = establishments.find((e) => e.id === item.establishmentId);

  const destinos = useMemo(
    () => [
      ...AREAS_INTERNAS.map((a) => a.nome as string),
      ...rules
        .filter((r) => r.active && !AREAS_INTERNAS.some((a) => a.nome === r.destination))
        .map((r) => r.destination),
    ],
    [rules]
  );

  const [area, setArea] = useState<string>(destinos[0] ?? "Suporte N2");
  const [tratativa, setTratativa] = useState("");
  const [adicionais, setAdicionais] = useState("");
  const [papel, setPapel] = useState("");
  const [chamado, setChamado] = useState("");
  const [editada, setEditada] = useState<string | null>(null);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ehArea = AREAS_INTERNAS.some((a) => a.nome === area);
  const regra = rules.find((r) => r.active && r.destination === area);
  const horas = ehArea || !regra ? prazosDeArea[item.priority] : regra.hours;

  const [agora] = useState(() => new Date());
  const vence = prazoUtil(agora, horas, expediente);

  const prazoTexto = `até ${descreverPrazo(horas)} (${quandoVence(vence.toISOString())})`;

  const telefone = item.phone && !item.phone.includes("•") ? item.phone : "";

  const gerada = mensagemDeAcionamento({
    area,
    cliente: item.customer,
    estabelecimento: estabelecimento?.name ?? (item.company || undefined),
    assunto: item.title,
    tratativa,
    prioridade: item.priority,
    prazo: prazoTexto,
    adicionais,
    telefone,
    papel,
    raUrl: item.raUrl,
    portalUrl: estabelecimento ? linkDoPortal(estabelecimento) || undefined : undefined,
    agora,
  });

  const mensagem = editada ?? gerada;

  async function salvar() {

    setSalvando(true);
    setErro(null);

    try {
      const r = await acionarArea({ protocol: item.protocol, area, tratativa, chamado });

      if (!r.ok) {
        setErro(r.erro);
        return;
      }

      onSalvo(r.movimento);

      /* O clique de salvar já é o gesto que o navegador exige para copiar. */
      await navigator.clipboard?.writeText(mensagem).catch(() => undefined);

      notify({
        tone: "success",
        title: `${area} acionada em ${item.protocol}.`,
        detail: `Retorno ${prazoTexto}. A mensagem foi copiada — cole em ${CANAL_DE_INCIDENTES}.`,
      });

      onClose();
    } catch {
      setErro("O acionamento não foi gravado. Tente de novo; se repetir, atualize a página.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      porque="areas.prazos"
      size="wide"
      title={`Acionar área — ${item.protocol}`}
      description={`O modelo da documentação, pronto para ${CANAL_DE_INCIDENTES}. O relógio da área começa agora, com o prazo da criticidade do caso.`}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <BotaoCopiar texto={mensagem} rotulo="Só copiar" />
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || tratativa.trim().length < 8}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {salvando ? "Salvando…" : "Salvar e copiar"}
          </button>
        </>
      }
    >

      <div className="grid gap-5 md:grid-cols-2">

        <div className="space-y-4">

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Área</span>
            <select value={area} onChange={(e) => setArea(e.target.value)} className={`mt-1.5 ${inputClass}`}>
              {destinos.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>

          <p className="rounded-xl bg-violet-50/60 px-3.5 py-2.5 text-xs leading-relaxed text-violet-900 ring-1 ring-inset ring-violet-100">
            Caso <strong>{item.priority}</strong>: retorno da área <strong>{prazoTexto}</strong>.
            Se vencer, a plataforma avisa e monta a mensagem de escalonamento ao gestor da área.
          </p>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              O que a área precisa fazer
            </span>
            <textarea
              value={tratativa}
              onChange={(e) => setTratativa(e.target.value)}
              rows={3}
              placeholder="Ex.: estornar a cobrança duplicada de agosto e confirmar a data do crédito."
              className={`mt-1.5 ${textareaClass}`}
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Informações adicionais (opcional)
            </span>
            <textarea
              value={adicionais}
              onChange={(e) => setAdicionais(e.target.value)}
              rows={2}
              placeholder="O que a área precisa saber para não perguntar de novo ao cliente."
              className={`mt-1.5 ${textareaClass}`}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Quem é o contato
              </span>
              <select value={papel} onChange={(e) => setPapel(e.target.value)} className={`mt-1.5 ${inputClass}`}>
                <option value="">Não sei</option>
                {PAPEIS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Nº do chamado (se houver)
              </span>
              <input
                value={chamado}
                onChange={(e) => setChamado(e.target.value)}
                placeholder="Ex.: #48213"
                className={`mt-1.5 ${inputClass}`}
              />
            </label>
          </div>

          <p className="text-xs leading-relaxed text-zinc-500">
            A documentação também pede para acionar as lideranças e, se possível, o consultor de
            contas{estabelecimento?.owner ? ` — nesta conta, ${estabelecimento.owner}` : ""}.
          </p>

        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Mensagem para o Slack
            </span>
            {editada !== null && (
              <button
                type="button"
                onClick={() => setEditada(null)}
                className="text-xs font-medium text-violet-700 hover:underline"
              >
                Voltar ao modelo
              </button>
            )}
          </div>
          <textarea
            value={mensagem}
            onChange={(e) => setEditada(e.target.value)}
            rows={16}
            className={`mt-1.5 font-mono text-xs ${textareaClass}`}
          />
          {!telefone && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700">
              <TriangleAlert size={13} className="mt-0.5 shrink-0" />
              O caso não tem telefone — complete antes de acionar, para a área não precisar perguntar.
            </p>
          )}
        </div>

      </div>

      {erro && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-100">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}

    </Modal>
  );
}
