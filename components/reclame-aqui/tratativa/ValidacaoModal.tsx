"use client";

import { useEffect, useState } from "react";

import { Check, Loader2, MessageCircle, Send, TriangleAlert } from "lucide-react";

import Modal, { GhostButton, inputClass, textareaClass } from "@/components/shared/Modal";
import BotaoCopiar from "@/components/shared/BotaoCopiar";
import { useConversasGuardadas } from "@/components/conversas/ConversasGuardadas";

import type { Case } from "@/lib/models/case";
import { mensagemDeValidacao } from "@/lib/models/mensagens";
import { estadoDaValidacao, patchDoResumo, type EstadoDaValidacao } from "@/lib/models/tratativa";
import { descreverRegistro, instanteDe, paredeDe } from "@/lib/services/horasUteis";

import { listarContatos, registrarContato } from "@/lib/actions/tratativa";
import { useSession } from "@/lib/context/SessionContext";
import { useToast } from "@/lib/context/ToastContext";

interface Props {
  item: Case;
  onClose: () => void;
  onSalvo: (patch: Partial<Case>) => void;
}

const CANAIS = ["WhatsApp", "Telefone", "E-mail", "Crisp"] as const;

/** "2026-09-15T16:20" em Brasília, para o campo de data e hora. */
function valorDoCampo(d: Date) {
  const { dia, min } = paredeDe(d);
  return `${dia}T${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function instanteDoCampo(valor: string) {
  const m = valor.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  return m ? instanteDe(m[1], Number(m[2]) * 60 + Number(m[3])) : null;
}

/**
 * O Passo 6 com cara de Passo 6.
 *
 * O Isaac: "a parte da validação é a mesma parte de registrar contato".
 * Era o formulário genérico de contato com o tipo trocado — sem a
 * pergunta, sem lugar para o que o cliente respondeu e sem o outro
 * lado da validação: o cliente que diz "ainda falta uma coisa". Aqui:
 *
 * 1. **a pergunta** pronta ("tudo funcionando? ficou pendência?"),
 *    editável, para copiar ou abrir no WhatsApp — e registrar que foi
 *    feita, para a trilha dizer "aguardando o cliente desde 14:10";
 * 2. **a resposta**: confirmou (valida o caso) ou apontou pendência (não
 *    valida, e a pendência fica na trilha). A última fala do cliente na
 *    conversa guardada entra com um clique, com a hora dela;
 * 3. **o compromisso** que o documento pede na mesma conversa: reforçar
 *    a parceria e combinar a avaliação — registrado junto.
 */
export default function ValidacaoModal({ item, onClose, onSalvo }: Props) {

  const { notify } = useToast();
  const sessao = useSession();
  const ra = item.source === "Reclame Aqui";

  const gerada = mensagemDeValidacao({ nome: item.customer, agente: sessao?.name });
  const [pergunta, setPergunta] = useState<string | null>(null);
  const textoDaPergunta = pergunta ?? gerada;

  const [estado, setEstado] = useState<EstadoDaValidacao | null>(null);
  const [resultado, setResultado] = useState<"respondeu" | "pendencia">("respondeu");
  const [resposta, setResposta] = useState("");
  const [compromisso, setCompromisso] = useState(false);
  const [canal, setCanal] = useState<string>(ra ? "WhatsApp" : "Crisp");
  const [quando, setQuando] = useState(() => valorDoCampo(new Date()));

  const [gravando, setGravando] = useState<"pergunta" | "resposta" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    listarContatos(item.protocol)
      .then((contatos) => vivo && setEstado(estadoDaValidacao(contatos)))
      .catch(() => vivo && setEstado({}));
    return () => {
      vivo = false;
    };
  }, [item.protocol]);

  /* A fala do cliente na conversa guardada — só a que veio depois da pergunta, quando houve pergunta. */
  const conversas = useConversasGuardadas({ protocolo: item.protocol });
  const fala = conversas.find((c) => c.ultimaDoCliente)?.ultimaDoCliente;
  const falaServe = fala && (!estado?.pedidaEm || !fala.em || fala.em >= estado.pedidaEm) ? fala : null;

  const digitos = (item.phone ?? "").replace(/\D/g, "");
  const whatsapp =
    digitos.length >= 10 && !(item.phone ?? "").includes("•")
      ? `https://wa.me/${digitos.length <= 11 ? `55${digitos}` : digitos}?text=${encodeURIComponent(textoDaPergunta)}`
      : null;

  async function gravar(tipo: "pergunta" | "resposta") {

    const em = tipo === "pergunta" ? new Date() : instanteDoCampo(quando);
    if (!em) {
      setErro("Preencha quando o cliente respondeu.");
      return;
    }
    if (tipo === "resposta" && resultado === "pendencia" && !resposta.trim()) {
      setErro("Diga qual é a pendência — é ela que a trilha mostra até a próxima validação.");
      return;
    }

    setGravando(tipo);
    setErro(null);

    const nota =
      tipo === "pergunta"
        ? `Perguntei: "${textoDaPergunta.trim()}"`
        : [
            resposta.trim() ? `O cliente: "${resposta.trim()}"` : "",
            resultado === "respondeu" && compromisso ? "Compromisso: reforcei a parceria e combinei a avaliação no Reclame Aqui." : "",
          ]
            .filter(Boolean)
            .join(" · ");

    try {
      const r = await registrarContato({
        protocol: item.protocol,
        tipo: "validacao",
        canal,
        resultado: tipo === "pergunta" ? "aguardando" : resultado,
        nota: nota.slice(0, 2000),
        em: em.toISOString(),
      });

      if (!r.ok) {
        setErro(r.erro);
        return;
      }

      onSalvo(patchDoResumo(r.resumo));

      notify(
        tipo === "pergunta"
          ? { tone: "success", title: `Pergunta de validação registrada em ${item.protocol}.`, detail: "A trilha mostra que o caso aguarda o cliente. Quando ele responder, registre aqui mesmo." }
          : resultado === "pendencia"
            ? { tone: "info", title: `Pendência registrada em ${item.protocol}.`, detail: "O caso ainda não está validado. Resolva — com a área, se precisar — e pergunte de novo." }
            : {
                tone: "success",
                title: `Solução validada em ${item.protocol}.`,
                detail: ra
                  ? "Próximo: a resposta pública — agradecer o diálogo e confirmar a resolução, sem dado pessoal. Depois de publicar, avise o cliente com o link para avaliar."
                  : "Próximo: encerrar o caso com a solução aplicada.",
              }
      );

      onClose();
    } catch {
      setErro("Não foi gravado. Tente de novo; se repetir, atualize a página.");
    } finally {
      setGravando(null);
    }
  }

  const titulo = "text-[11px] font-semibold uppercase tracking-wide text-zinc-500";

  return (
    <Modal
      open
      porque={ra ? "ra.validacao" : "redes.validacao"}
      title={`Validar a solução — ${item.protocol}`}
      description={
        ra
          ? "Passo 6: confirmar com o cliente que tudo voltou a funcionar antes da resposta pública."
          : "Confirmar com o cliente que tudo voltou a funcionar antes de encerrar."
      }
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <button
            type="button"
            onClick={() => gravar("resposta")}
            disabled={gravando !== null}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 ${
              resultado === "pendencia" ? "bg-amber-600 hover:bg-amber-700" : "bg-violet-700 hover:bg-violet-800"
            }`}
          >
            {gravando === "resposta" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {resultado === "pendencia" ? "Registrar a pendência" : "Registrar a confirmação"}
          </button>
        </>
      }
    >

      {estado?.pedidaEm && (
        <p className="mb-4 rounded-xl bg-violet-50 px-3.5 py-2.5 text-xs leading-relaxed text-violet-900 ring-1 ring-inset ring-violet-100">
          Pergunta feita em {descreverRegistro(estado.pedidaEm)}{estado.pedidaPor ? ` por ${estado.pedidaPor}` : ""}. Aguardando o cliente.
        </p>
      )}
      {estado?.pendencia && (
        <p className="mb-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-100">
          <strong>Pendência apontada em {descreverRegistro(estado.pendencia.em)}.</strong> {estado.pendencia.nota ?? ""}
        </p>
      )}

      <section>
        <p className={titulo}>1. A pergunta</p>
        <textarea
          value={textoDaPergunta}
          onChange={(e) => setPergunta(e.target.value)}
          rows={3}
          aria-label="A pergunta de validação"
          className={`mt-1.5 ${textareaClass}`}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <BotaoCopiar texto={textoDaPergunta} />
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 transition-colors hover:bg-emerald-50"
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
          <button
            type="button"
            onClick={() => gravar("pergunta")}
            disabled={gravando !== null}
            title="Registra que a pergunta foi feita agora: a trilha passa a mostrar que o caso aguarda o cliente"
            className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-violet-700 ring-1 ring-inset ring-violet-200 transition-colors hover:bg-violet-50 disabled:opacity-60"
          >
            {gravando === "pergunta" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Perguntei
          </button>
        </div>
      </section>

      <section className="mt-5 border-t border-zinc-100 pt-4">
        <p className={titulo}>2. O que o cliente respondeu</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {(
            [
              ["respondeu", "Confirmou: tudo resolvido"],
              ["pendencia", "Apontou pendência"],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              onClick={() => setResultado(id)}
              aria-pressed={resultado === id}
              className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                resultado === id
                  ? id === "pendencia"
                    ? "border-amber-300 bg-amber-50 font-semibold text-amber-900"
                    : "border-violet-300 bg-violet-50 font-semibold text-violet-800"
                  : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {falaServe && (
          <button
            type="button"
            onClick={() => {
              setResposta(falaServe.texto);
              if (falaServe.em) setQuando(valorDoCampo(new Date(falaServe.em)));
              setCanal("WhatsApp");
            }}
            className="mt-2 block w-full rounded-xl bg-zinc-50 px-3 py-2 text-left text-xs leading-relaxed text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-100"
          >
            <span className="font-semibold text-zinc-800">Usar a fala da conversa guardada</span>
            {falaServe.em ? ` · ${descreverRegistro(falaServe.em)}` : ""}: &ldquo;{falaServe.texto.slice(0, 160)}{falaServe.texto.length > 160 ? "…" : ""}&rdquo;
          </button>
        )}

        <textarea
          value={resposta}
          onChange={(e) => setResposta(e.target.value)}
          rows={2}
          placeholder={resultado === "pendencia" ? "Qual é a pendência? Ex.: a impressora da cozinha ainda não imprime." : "O que o cliente disse (opcional) — colado ou resumido."}
          aria-label="A resposta do cliente"
          className={`mt-2 ${textareaClass}`}
        />

        {resultado === "respondeu" && ra && (
          <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-zinc-700">
            <input type="checkbox" checked={compromisso} onChange={(e) => setCompromisso(e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-700" />
            Reforcei a parceria e combinei a avaliação no Reclame Aqui — o compromisso do Passo 6.
          </label>
        )}

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Por onde">
            {CANAIS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCanal(c)}
                aria-pressed={canal === c}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  canal === c ? "border-violet-300 bg-violet-50 text-violet-800" : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <label className="ml-auto block">
            <span className="sr-only">Quando o cliente respondeu (Brasília)</span>
            <input
              type="datetime-local"
              value={quando}
              max={valorDoCampo(new Date())}
              onChange={(e) => setQuando(e.target.value)}
              className={`h-9 ${inputClass} w-auto py-1 text-xs`}
            />
          </label>
        </div>
      </section>

      {erro && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-100">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}

    </Modal>
  );
}
