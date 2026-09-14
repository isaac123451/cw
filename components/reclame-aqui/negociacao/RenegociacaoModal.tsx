"use client";

import { useEffect, useState } from "react";

import { Calculator, Loader2, ShieldAlert, TriangleAlert } from "lucide-react";

import Modal, { GhostButton, inputClass, textareaClass } from "@/components/shared/Modal";
import BotaoCopiar from "@/components/shared/BotaoCopiar";

import type { Case } from "@/lib/models/case";
import {
  calcularRenegociacao,
  centavosDoTexto,
  DESCONTO_DE_ENCARGOS,
  reais,
  textoDaProposta,
  type NegociacaoView,
} from "@/lib/models/negociacao";
import { paredeDe } from "@/lib/services/horasUteis";

import { registrarRenegociacao, resumoDoMes } from "@/lib/actions/negociacao";
import { useToast } from "@/lib/context/ToastContext";

interface Props {
  item: Case;
  onClose: () => void;
  onSalvo: (negociacao: NegociacaoView) => void;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function br(dia: string) {
  return dia.split("-").reverse().join("/");
}

/**
 * A renegociação do documento: exceção máxima, com a conta à vista.
 *
 * Os campos do modelo, o cálculo passo a passo com a fórmula — o
 * proporcional dos dias não utilizados, menos 30% de impostos e
 * encargos — e a proposta pronta com as condições. Salvar pede quem da
 * gestão autorizou. O contador do mês fica no topo: a partir da segunda,
 * o aviso do documento aparece antes de qualquer campo.
 */
export default function RenegociacaoModal({ item, onClose, onSalvo }: Props) {

  const { notify } = useToast();

  const [plano, setPlano] = useState("");
  const [pago, setPago] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [solicitacao, setSolicitacao] = useState("");
  const [validaAte, setValidaAte] = useState("");
  const [autorizadoPor, setAutorizadoPor] = useState("");

  const [doMes, setDoMes] = useState<{ mes: string; renegociacoes: number; aplicadas: number } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    resumoDoMes()
      .then((r) => ativo && setDoMes({ mes: r.mes, renegociacoes: r.renegociacoes, aplicadas: r.aplicadas }))
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, []);

  const pagoCents = centavosDoTexto(pago);

  const calculo =
    pagoCents !== null && inicio && fim && solicitacao
      ? calcularRenegociacao({ pagoCents, inicio, fim, solicitacao })
      : null;

  const valido = calculo && !("erro" in calculo) ? calculo : null;

  const validadeTexto = (() => {
    const m = validaAte.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    return m ? `${br(m[1])} às ${m[2]}` : "[data e hora limite]";
  })();

  const calculada = valido ? textoDaProposta({ nome: item.customer, plano, calculo: valido, validaAte: validadeTexto }) : "";

  /* A proposta calculada é o ponto de partida; o texto final é de quem manda ("se der para editar o texto, para digitar"). */
  const [editada, setEditada] = useState<string | null>(null);
  const proposta = editada ?? calculada;

  const nomeDoMes = doMes ? MESES[Number(doMes.mes.slice(5, 7)) - 1] : "";

  async function salvar() {

    if (pagoCents === null) {
      setErro("Informe o valor total pago na contratação.");
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      const r = await registrarRenegociacao({
        protocol: item.protocol,
        plano,
        pagoCents,
        inicio,
        fim,
        solicitacao,
        validaAte,
        autorizadoPor,
      });

      if (!r.ok) {
        setErro(r.erro);
        return;
      }

      onSalvo(r.negociacao);

      notify({
        tone: "success",
        title: `Renegociação registrada: ${reais(r.negociacao.valorCents)} a restituir.`,
        detail:
          r.doMes > 1
            ? `É a ${r.doMes}ª renegociação de ${nomeDoMes || "este mês"}. O documento: "se precisou aplicar mais de uma vez no mês, reveja o que está sendo feito".`
            : "O checklist do documento fica na lateral do caso, até o recebimento confirmado.",
      });

      onClose();
    } catch {
      setErro("A renegociação não foi gravada. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  const hoje = paredeDe(new Date()).dia;

  const linhas: [string, string][] = valido
    ? [
        ["Valor total pago", reais(valido.pagoCents)],
        ["Total de dias do plano", `${valido.diasDoPlano} dias (${br(valido.inicio)} a ${br(valido.fim)})`],
        ["Valor proporcional por dia", reais(valido.valorPorDiaCents)],
        ["Dias não utilizados", `${valido.diasNaoUtilizados} dias (desde ${br(valido.solicitacao)})`],
        ["Proporcional dos dias não utilizados", reais(valido.proporcionalCents)],
        [`Impostos e encargos (${Math.round(DESCONTO_DE_ENCARGOS * 100)}%)`, `− ${reais(valido.descontoCents)}`],
      ]
    : [];

  return (
    <Modal
      open
      size="wide"
      title={`Renegociação — ${item.protocol}`}
      description="Exceção máxima, sempre com autorização expressa da gestão. Trate como se esta opção não existisse na rotina."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <BotaoCopiar texto={proposta} rotulo="Copiar proposta" />
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !valido || autorizadoPor.trim().length < 3 || plano.trim().length < 3 || !validaAte}
            className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Calculator size={15} />}
            Registrar renegociação
          </button>
        </>
      }
    >

      {doMes && doMes.renegociacoes > 0 && (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-100">
          <ShieldAlert size={15} className="mt-0.5 shrink-0 text-amber-600" />
          <span>
            <strong>
              {doMes.renegociacoes} renegociação(ões) já registrada(s) em {nomeDoMes}
              {doMes.aplicadas > 0 ? `, ${doMes.aplicadas} aplicada(s)` : ""}.
            </strong>{" "}
            O documento: se precisou aplicar mais de uma vez no mês, reveja o que está sendo feito.
          </span>
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-2">

        <div className="space-y-3.5">

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Plano contratado</span>
            <input value={plano} onChange={(e) => setPlano(e.target.value)} placeholder="Ex.: Plano Anual Completo" className={`mt-1.5 ${inputClass}`} />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Início da vigência</span>
              <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={`mt-1.5 ${inputClass}`} />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Fim da vigência</span>
              <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={`mt-1.5 ${inputClass}`} />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Pedido de cancelamento</span>
              <input type="date" value={solicitacao} max={hoje} onChange={(e) => setSolicitacao(e.target.value)} className={`mt-1.5 ${inputClass}`} />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Valor total pago (R$)</span>
              <input value={pago} onChange={(e) => setPago(e.target.value)} inputMode="decimal" placeholder="0,00" className={`mt-1.5 ${inputClass} tabular-nums`} />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500" title="Hora de Brasília">Validade da proposta</span>
              <input type="datetime-local" value={validaAte} onChange={(e) => setValidaAte(e.target.value)} className={`mt-1.5 ${inputClass}`} />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Autorizado por</span>
              <input value={autorizadoPor} onChange={(e) => setAutorizadoPor(e.target.value)} placeholder="Quem da gestão autorizou" className={`mt-1.5 ${inputClass}`} />
            </label>
          </div>

          {calculo && "erro" in calculo && (
            <p className="flex items-start gap-2 text-xs text-amber-700">
              <TriangleAlert size={13} className="mt-0.5 shrink-0" />
              {calculo.erro}
            </p>
          )}

          {valido && (
            <div className="rounded-xl ring-1 ring-inset ring-zinc-200">
              <dl className="divide-y divide-zinc-100 text-sm">
                {linhas.map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3 px-3.5 py-2">
                    <dt className="text-zinc-500">{k}</dt>
                    <dd className="text-right tabular-nums text-zinc-800">{v}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3 bg-violet-50/60 px-3.5 py-2.5">
                  <dt className="font-semibold text-zinc-900">Valor final a restituir</dt>
                  <dd className="text-right text-base font-semibold tabular-nums text-violet-800">{reais(valido.finalCents)}</dd>
                </div>
              </dl>
              <p className="px-3.5 py-2 text-[11px] leading-relaxed text-zinc-400">
                Como o documento: valor por dia (em centavos) × dias não utilizados, menos 30%. Cada linha sai da
                de cima — o cliente refaz a conta e ela fecha.
              </p>
            </div>
          )}

        </div>

        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Proposta ao cliente</span>
          <textarea
            value={proposta}
            onChange={(e) => setEditada(e.target.value)}
            disabled={!calculada}
            placeholder="Preencha as datas e o valor pago: a proposta do documento se monta aqui, com o cálculo e as condições."
            rows={20}
            className={`mt-1.5 font-mono text-xs ${textareaClass}`}
          />
          {editada !== null && editada !== calculada && (
            <button type="button" onClick={() => setEditada(null)} className="mt-1 text-xs font-medium text-violet-700 hover:underline">
              Voltar à proposta calculada (se os valores mudaram ou a edição saiu errada)
            </button>
          )}
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
            Pix com os dados bancários que o cliente enviar — eles vão direto ao financeiro e não ficam na
            plataforma.
          </p>
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
