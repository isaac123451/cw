"use client";

import { useEffect, useState } from "react";

import { Loader2, Trash2, TriangleAlert } from "lucide-react";

import Modal, { GhostButton, inputClass } from "@/components/shared/Modal";

import { useToast } from "@/lib/context/ToastContext";

import {
  excluirConta,
  previaExcluirConta,
} from "@/lib/auth/account";

import type { PreviaDaExclusao } from "@/lib/services/contas.service";

interface Pessoa {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

interface Props {
  alvo: Pessoa;
  /** Todas as contas — a lista de quem pode receber sai daqui. */
  pessoas: Pessoa[];
  onClose: () => void;
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

/**
 * Excluir uma conta, sabendo antes o que vai acontecer.
 *
 * **O pedido.** "Opções de excluir contas da plataforma é importante."
 *
 * A janela carrega a prévia do servidor — quantas reclamações, ciclos de
 * NPS e tarefas a pessoa tem em aberto — e pergunta para quem vão. Pede
 * o e-mail digitado para confirmar: excluir não tem volta, e um clique
 * no botão errado da lista não pode bastar.
 *
 * Lembra que **desativar** existe: para quem saiu mas tem histórico, é
 * o certo — o nome continua nos casos que tratou.
 */
export default function ExcluirConta({ alvo, pessoas, onClose }: Props) {

  const { notify } = useToast();

  const [previa, setPrevia] = useState<PreviaDaExclusao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [destino, setDestino] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {

    let ativo = true;

    previaExcluirConta(alvo.id).then((resposta) => {
      if (!ativo) return;
      if (resposta.erro) setErro(resposta.erro);
      else setPrevia(resposta.previa ?? null);
    });

    return () => {
      ativo = false;
    };

  }, [alvo.id]);

  /* Quem pode receber: conta ativa, que trabalha casos, e não a própria. */
  const candidatos = pessoas.filter(
    (p) => p.id !== alvo.id && p.active && p.role !== "LEITURA"
  );

  const emAberto = previa
    ? previa.reclamacoesAbertas + previa.npsEmTratativa + previa.tarefasPendentes
    : 0;

  const encerrados = previa
    ? previa.reclamacoesEncerradas + previa.npsEncerrados
    : 0;

  const confirmado =
    confirmacao.trim().toLowerCase() === alvo.email.trim().toLowerCase();

  async function excluir() {

    setExcluindo(true);
    setErro(null);

    /*
      A falha inesperada também precisa chegar à tela.

      O erro previsto volta como valor; o imprevisto (banco fora do ar,
      cliente do Prisma desatualizado) chega como exceção — e sem este
      try a janela ficava para sempre em "Excluindo…", sem dizer nada.
      A conta só é apagada no último passo, então quem vê este aviso
      pode tentar de novo.
    */
    try {
      const resposta = await excluirConta(alvo.id, destino || null);

      if (resposta.erro) {
        setErro(resposta.erro);
        return;
      }

      notify({ tone: "success", title: resposta.resumo ?? "Conta excluída." });
      onClose();
    } catch {
      setErro(
        "A exclusão não terminou e a conta continua na plataforma. Tente de novo; se repetir, atualize a página."
      );
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <Modal
      open
      title={`Excluir a conta de ${alvo.name}?`}
      description={`${alvo.email}. A conta some da plataforma e o e-mail deixa de estar liberado. Não tem volta.`}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancelar</GhostButton>

          <button
            type="button"
            onClick={excluir}
            disabled={!previa || previa.ultimoAdmin || !confirmado || excluindo}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {excluindo ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            {excluindo ? "Excluindo…" : "Excluir conta"}
          </button>
        </>
      }
    >

      {!previa && !erro && (
        <p className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 size={15} className="animate-spin" />
          Conferindo o que está com esta conta…
        </p>
      )}

      {previa && (
        <div className="space-y-4 text-sm text-zinc-700">

          <p className="rounded-xl bg-zinc-50 px-3.5 py-3 text-xs leading-relaxed text-zinc-600 ring-1 ring-inset ring-zinc-200">
            Se a pessoa saiu mas tem histórico, prefira <strong>desativar</strong>:
            ela perde o acesso e o nome continua nos casos que tratou.
            Excluir é para conta criada por engano, duplicada ou de teste.
          </p>

          {previa.ultimoAdmin && (
            <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-rose-800 ring-1 ring-inset ring-rose-100">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              É a única conta de administrador ativa. Dê o papel de
              administrador a outra pessoa antes de excluir.
            </p>
          )}

          {emAberto > 0 ? (
            <div>
              <p>
                Em aberto com {alvo.name}:{" "}
                <strong>
                  {[
                    previa.reclamacoesAbertas > 0 && plural(previa.reclamacoesAbertas, "reclamação", "reclamações"),
                    previa.npsEmTratativa > 0 && plural(previa.npsEmTratativa, "ciclo de NPS", "ciclos de NPS"),
                    previa.tarefasPendentes > 0 && plural(previa.tarefasPendentes, "tarefa", "tarefas"),
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </strong>
                .
              </p>

              <label className="mt-2 block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Passar para
                </span>
                <select
                  value={destino}
                  onChange={(e) => setDestino(e.target.value)}
                  className={`mt-1.5 ${inputClass}`}
                >
                  <option value="">Ninguém — ficam sem responsável</option>
                  {candidatos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <p>Nada em aberto com esta conta.</p>
          )}

          <ul className="space-y-1 text-xs text-zinc-500">
            {encerrados > 0 && (
              <li>
                {plural(encerrados, "caso encerrado fica", "casos encerrados ficam")} sem
                responsável — atribuir a outra pessoa um caso que ela não
                tratou mentiria nos números por responsável.
              </li>
            )}
            {previa.comentarios + previa.anotacoesNps > 0 && (
              <li>
                {plural(previa.comentarios + previa.anotacoesNps, "anotação mantém", "anotações mantêm")}{" "}
                o nome de {alvo.name} como autor.
              </li>
            )}
            {previa.filtrosPessoais > 0 && (
              <li>
                {plural(previa.filtrosPessoais, "filtro pessoal é apagado", "filtros pessoais são apagados")}.
              </li>
            )}
            {previa.googleConectado && <li>A conexão com o Google Agenda é desfeita.</li>}
          </ul>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Para confirmar, digite o e-mail da conta
            </span>
            <input
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder={alvo.email}
              autoComplete="off"
              className={`mt-1.5 ${inputClass}`}
            />
          </label>

        </div>
      )}

      {erro && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-100">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}

    </Modal>
  );
}
