"use client";

import { useState } from "react";

import { BookOpenCheck, Loader2, TriangleAlert } from "lucide-react";

import Modal, { GhostButton } from "@/components/shared/Modal";

import { mesmaRegra, PRAZOS_DA_DOCUMENTACAO } from "@/lib/models/sla";
import { descreverPrazo } from "@/lib/services/horasUteis";

import { aplicarPrazosDaDocumentacao } from "@/lib/actions/tratativa";
import { useSla } from "@/lib/context/SlaContext";
import { useToast } from "@/lib/context/ToastContext";

interface Props {
  onClose: () => void;
}

/**
 * "Usar os prazos da documentação" — com a tabela antes do clique.
 *
 * Processos e SLA foi zerado em 23/08 a pedido do Isaac, para começar
 * do vazio; a documentação de agosto trouxe os prazos que faltavam.
 * Gravar sem mostrar seria decidir por ele, então a tela mostra cada
 * linha, diz de onde saiu e se vai criar ou atualizar.
 */
export default function PrazosDaDocumentacaoModal({ onClose }: Props) {

  const { rules, setRules } = useSla();
  const { notify } = useToast();

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {

    setSalvando(true);
    setErro(null);

    try {
      const r = await aplicarPrazosDaDocumentacao();

      if (!r.ok) {
        setErro(r.erro);
        return;
      }

      setRules(r.regras);

      notify({
        tone: "success",
        title: "Prazos da documentação gravados.",
        detail: [
          r.criadas > 0 && `${r.criadas} regra(s) criada(s)`,
          r.atualizadas > 0 && `${r.atualizadas} atualizada(s)`,
        ]
          .filter(Boolean)
          .join(" · "),
      });

      onClose();
    } catch {
      setErro("Os prazos não foram gravados. Tente de novo; se repetir, atualize a página.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      size="wide"
      title="Usar os prazos da documentação"
      description="A tabela de criticidade do Reclame Aqui e o SLA das Redes Sociais, de agosto/2026. Revise antes de salvar — tudo continua editável depois."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <BookOpenCheck size={15} />}
            {salvando ? "Salvando…" : "Salvar os 5 prazos"}
          </button>
        </>
      }
    >

      <div className="overflow-x-auto rounded-xl border border-zinc-200">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50">
            <tr>
              {["Frente", "Aplica-se a", "1º contato", "Solução", ""].map((h, i) => (
                <th
                  key={h || i}
                  className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {PRAZOS_DA_DOCUMENTACAO.map((p, i) => {
              const existe = rules.some((r) => mesmaRegra(r, p));
              return (
                <tr key={i} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-800">{p.canal}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {p.priority ?? (p.seguidoresMin ? `Mais de ${p.seguidoresMin.toLocaleString("pt-BR")} seguidores` : "Qualquer caso")}
                    <p className="mt-0.5 max-w-xs text-xs leading-relaxed text-zinc-400">{p.note}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-zinc-800">
                    {descreverPrazo(p.responseHours)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-700">
                    {p.solutionHours > 0 ? descreverPrazo(p.solutionHours) : "sem prazo"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                        existe
                          ? "bg-sky-50 text-sky-700 ring-sky-100"
                          : "bg-emerald-50 text-emerald-700 ring-emerald-100"
                      }`}
                    >
                      {existe ? "atualiza" : "cria"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="mt-4 space-y-1.5 text-xs leading-relaxed text-zinc-500">
        <li>
          <strong className="font-semibold text-zinc-600">Leitura da tabela do Reclame Aqui.</strong> No PDF
          as colunas saem desalinhadas; foi lida como Urgente 4h úteis/48h, Alta 24h úteis/5 dias úteis,
          Normal 48h úteis/7 dias úteis — usando o teto das faixas (&ldquo;24h a 48h&rdquo;, &ldquo;3 a 5
          dias úteis&rdquo;). Vale confirmar com a Thais.
        </li>
        <li>
          <strong className="font-semibold text-zinc-600">Tempo útil.</strong> 24h úteis é um dia útil;
          prazo menor que um dia conta só dentro do expediente — ver o cartão Expediente, abaixo.
        </li>
        <li>
          Regra que você criou para uma categoria específica continua valendo e, por ser mais
          específica, passa na frente destas.
        </li>
      </ul>

      {erro && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-100">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}

    </Modal>
  );
}
