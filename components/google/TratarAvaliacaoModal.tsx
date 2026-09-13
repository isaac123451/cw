"use client";

import { useEffect, useState } from "react";

import {
  ExternalLink,
  Flag,
  Loader2,
  Save,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import Modal, { ConfirmDelete, GhostButton, inputClass, textareaClass } from "@/components/shared/Modal";
import BotaoCopiar from "@/components/shared/BotaoCopiar";
import Combobox from "@/components/shared/Combobox";

import {
  conferirResposta,
  EXCECOES_GOOGLE,
  prazoDeResposta,
  ROTULO_DA_URGENCIA,
  ROTULO_DO_STATUS_GOOGLE,
} from "@/lib/models/avaliacoesGoogle";
import { CANAIS_DE_CONTATO } from "@/lib/models/tratativa";
import { descreverPrazo, descreverRegistro } from "@/lib/services/horasUteis";
import { dadosSensiveis, resumoDosAchados } from "@/lib/services/lgpd";

import {
  apagarAvaliacaoGoogle,
  denunciarAvaliacaoGoogle,
  registrarTratativaGoogle,
  responderAvaliacaoGoogle,
  semelhancaComPublicadas,
  vincularCasoGoogle,
  type AvaliacaoGoogleView,
} from "@/lib/actions/avaliacoesGoogle";
import { useNps } from "@/lib/context/NpsContext";
import { useToast } from "@/lib/context/ToastContext";

interface Props {
  avaliacao: AvaliacaoGoogleView;
  onClose: () => void;
  onSalvo: (avaliacao: AvaliacaoGoogleView) => void;
  onApagado: (id: string) => void;
}

const DIRETRIZ: Record<string, string> = {
  positiva: "Agradecer nominalmente, reforçar o que foi elogiado e convidar para conhecer outros diferenciais.",
  neutra: "Agradecer, reconhecer a ressalva apontada e indicar o que está sendo feito a respeito.",
  negativa: "Reconhecer o problema sem se justificar demais, oferecer canal privado para a resolução e nunca discutir o mérito em público.",
};

const RESULTADOS = [
  { id: "em-andamento", texto: "Em andamento" },
  { id: "resolvido", texto: "Resolvido com o cliente" },
  { id: "sem-retorno", texto: "Sem retorno do cliente" },
  { id: "sem-identificacao", texto: "Não foi possível identificar" },
];

/**
 * Tratar uma avaliação: resposta pública, tratativa privada, registro.
 *
 * Cada seção grava por si, com o botão dela — a resposta pública é
 * publicada no Google pela pessoa e registrada aqui; a tratativa privada
 * tem canal, resultado e a nota atualizada, se o cliente atualizou.
 */
export default function TratarAvaliacaoModal({ avaliacao: a, onClose, onSalvo, onApagado }: Props) {

  const { notify } = useToast();
  const { rootCauses } = useNps();

  const [resposta, setResposta] = useState(a.resposta ?? "");
  const [semelhanca, setSemelhanca] = useState(0);
  const [canal, setCanal] = useState(a.tratativaCanal ?? "WhatsApp");
  const [resultado, setResultado] = useState(a.tratativaResultado ?? "em-andamento");
  const [notaAtualizada, setNotaAtualizada] = useState<number | null>(a.notaAtualizada ?? null);
  const [causa, setCausa] = useState(a.causaRaiz ?? "");
  const [protocolo, setProtocolo] = useState(a.caso?.protocolo ?? "");
  const [excecao, setExcecao] = useState("");
  const [print, setPrint] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [apagando, setApagando] = useState(false);

  /* A resposta parecida com alguma já publicada — quando a digitação para. */
  useEffect(() => {
    if (resposta.trim().length < 60) return;
    let ativo = true;
    const espera = setTimeout(() => {
      semelhancaComPublicadas({ id: a.id, texto: resposta })
        .then((p) => ativo && setSemelhanca(p))
        .catch(() => undefined);
    }, 900);
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [resposta, a.id]);

  const avisos = conferirResposta({
    resposta,
    autor: a.autor,
    classificacao: a.classificacao,
    semelhancaMaxima: resposta.trim().length >= 60 ? semelhanca : 0,
  });

  const achados = dadosSensiveis(resposta);

  async function executar<T extends { ok: true; avaliacao: AvaliacaoGoogleView } | { ok: false; erro: string }>(
    qual: string,
    acao: () => Promise<T>,
    titulo: string
  ) {
    setOcupado(qual);
    setErro(null);
    try {
      const r = await acao();
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      onSalvo(r.avaliacao);
      notify({ tone: "success", title: titulo, detail: `Situação: ${ROTULO_DO_STATUS_GOOGLE[r.avaliacao.status]}.` });
    } catch {
      setErro("Não foi gravado. Tente de novo.");
    } finally {
      setOcupado(null);
    }
  }

  async function apagar() {
    setApagando(false);
    setOcupado("apagar");
    try {
      const r = await apagarAvaliacaoGoogle(a.id);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      onApagado(a.id);
      notify({ tone: "success", title: "Registro apagado." });
      onClose();
    } finally {
      setOcupado(null);
    }
  }

  const botao = "flex items-center gap-2 rounded-xl bg-violet-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400";
  const titulo = "text-[11px] font-semibold uppercase tracking-wide text-zinc-500";

  return (
    <Modal
      open
      size="wide"
      title={`Avaliação de ${a.autor}`}
      description={`${ROTULO_DO_STATUS_GOOGLE[a.status]} · publicada em ${descreverRegistro(a.publicadaEm)} · registrada por ${a.registradaPor}`}
      onClose={onClose}
      footer={
        <>
          {!a.respondidaEm && (
            <button type="button" onClick={() => setApagando(true)} className="mr-auto flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100">
              <Trash2 size={14} /> Apagar registro
            </button>
          )}
          <GhostButton onClick={onClose}>Fechar</GhostButton>
        </>
      }
    >

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">

        {/* A avaliação e a resposta pública */}
        <div className="space-y-4">

          <div className="rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-inset ring-zinc-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={15} className={n <= a.estrelas ? "fill-amber-400 text-amber-400" : "text-zinc-300"} />
                ))}
              </span>
              {a.notaAtualizada && a.notaAtualizada !== a.estrelas && (
                <span className="text-xs font-medium text-emerald-700">→ atualizada para {a.notaAtualizada}</span>
              )}
              <span className="text-xs font-semibold text-zinc-700">{a.classificacao} · {a.criticidade}</span>
              {a.link && (
                <a href={a.link} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline">
                  <ExternalLink size={12} /> Abrir no Google
                </a>
              )}
            </div>
            {a.motivosDeUrgencia.length > 0 && (
              <p className="mt-1.5 text-xs font-medium text-rose-700">Urgente: {a.motivosDeUrgencia.map((m) => ROTULO_DA_URGENCIA[m]).join(", ")}.</p>
            )}
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{a.texto || "Sem comentário — só a nota."}</p>
            {a.promotorNps && <p className="mt-2 text-xs text-emerald-700">Promotor do NPS convidado a avaliar: {a.promotorNps.nome}.</p>}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <span className={titulo}>Resposta pública</span>
              <span className="text-xs text-zinc-500">até {descreverPrazo(prazoDeResposta(a.criticidade))}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{DIRETRIZ[a.classificacao]}</p>
            <textarea
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              rows={6}
              placeholder={a.classificacao === "negativa" ? `Olá, ${a.autor.split(" ")[0]}. …  Vamos continuar pelo WhatsApp…` : `Obrigado, ${a.autor.split(" ")[0]}! …`}
              className={`mt-1.5 ${textareaClass}`}
            />

            {(avisos.length > 0 || achados.length > 0) && (
              <ul className="mt-2 space-y-1 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-100">
                {achados.length > 0 && <li>• Dado pessoal ou condição na resposta pública: {resumoDosAchados(achados)}.</li>}
                {avisos.map((v) => (
                  <li key={v.aviso}>• {v.aviso}</li>
                ))}
              </ul>
            )}

            <div className="mt-2 flex flex-wrap gap-2">
              <BotaoCopiar texto={resposta} rotulo="Copiar" />
              <button
                type="button"
                disabled={ocupado !== null || resposta.trim().length < 20}
                onClick={() => executar("resposta", () => responderAvaliacaoGoogle({ id: a.id, resposta }), a.respondidaEm ? "Resposta atualizada." : "Resposta registrada como publicada.")}
                className={botao}
              >
                {ocupado === "resposta" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {a.respondidaEm ? "Salvar correção" : "Já publiquei no Google"}
              </button>
            </div>
            {a.respondidaEm && <p className="mt-1.5 text-xs text-zinc-500">Publicada em {descreverRegistro(a.respondidaEm)}.</p>}
          </div>

        </div>

        {/* Tratativa privada e registro */}
        <div className="space-y-5">

          <div className={a.identificado ? "" : "opacity-60"}>
            <p className={titulo}>Tratativa privada</p>
            {!a.identificado && (
              <p className="mt-1 text-xs text-zinc-500">Perfil sem nome real: o documento pede registrar &ldquo;sem identificação&rdquo; e manter só a resposta pública.</p>
            )}
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs text-zinc-500">Canal</span>
                <select value={canal} onChange={(e) => setCanal(e.target.value)} className={`mt-1 ${inputClass}`}>
                  {CANAIS_DE_CONTATO.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">Resultado</span>
                <select value={resultado} onChange={(e) => setResultado(e.target.value)} className={`mt-1 ${inputClass}`}>
                  {RESULTADOS.map((r) => (
                    <option key={r.id} value={r.id}>{r.texto}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-3">
              <span className="text-xs text-zinc-500">A nota foi atualizada?</span>
              <div className="mt-1 flex gap-1">
                <button
                  type="button"
                  onClick={() => setNotaAtualizada(null)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${notaAtualizada === null ? "bg-violet-50 text-violet-800 ring-violet-300" : "text-zinc-600 ring-zinc-200"}`}
                >
                  Não
                </button>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNotaAtualizada(n)}
                    className={`h-7 w-7 rounded-lg text-xs font-semibold ring-1 ring-inset ${notaAtualizada === n ? "bg-violet-50 text-violet-800 ring-violet-300" : "text-zinc-600 ring-zinc-200"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-zinc-400">Resolvido e com o cliente de acordo, pedir a atualização da nota com educação, sem pressionar.</p>
            </div>

            <div className="mt-3">
              <span className="text-xs text-zinc-500">Causa raiz</span>
              <div className="mt-1">
                <Combobox
                  value={causa}
                  onChange={setCausa}
                  emptyLabel="Não definida"
                  placeholder="Não definida"
                  options={[...new Set([...rootCauses.filter((c) => c.active).map((c) => c.name), ...(causa ? [causa] : [])])]}
                />
              </div>
            </div>

            <button
              type="button"
              disabled={ocupado !== null}
              onClick={() =>
                executar(
                  "tratativa",
                  () => registrarTratativaGoogle({ id: a.id, canal, resultado, notaAtualizada, causaRaiz: causa }),
                  "Tratativa registrada."
                )
              }
              className={`mt-3 ${botao}`}
            >
              {ocupado === "tratativa" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar tratativa
            </button>
          </div>

          <div className="border-t border-zinc-100 pt-4">
            <p className={titulo}>Caso em outro canal</p>
            <p className="mt-1 text-xs text-zinc-500">Quando a avaliação revela problema não resolvido, o caso é aberto ou vinculado no canal de tratativa.</p>
            <div className="mt-2 flex gap-2">
              <input value={protocolo} onChange={(e) => setProtocolo(e.target.value)} placeholder="Protocolo do caso" className={inputClass} />
              <button
                type="button"
                disabled={ocupado !== null}
                onClick={() => executar("caso", () => vincularCasoGoogle({ id: a.id, protocolo }), protocolo ? "Caso vinculado." : "Vínculo removido.")}
                className="shrink-0 rounded-xl px-3.5 py-2 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
              >
                {ocupado === "caso" ? <Loader2 size={14} className="animate-spin" /> : "Salvar"}
              </button>
            </div>
            {a.caso && <p className="mt-1.5 text-xs text-zinc-600">Vinculada a {a.caso.protocolo} — {a.caso.titulo}</p>}
          </div>

          {a.status !== "denunciada" ? (
            <div className="border-t border-zinc-100 pt-4">
              <p className={titulo}>Avaliação imprópria</p>
              <p className="mt-1 text-xs text-zinc-500">
                Ofensiva, falsa ou de quem não é cliente: não responder no mérito, guardar o print, avisar a liderança e
                seguir o fluxo de denúncia do Google.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <select value={excecao} onChange={(e) => setExcecao(e.target.value)} className={inputClass}>
                  <option value="">Motivo…</option>
                  {EXCECOES_GOOGLE.map((e) => (
                    <option key={e.id} value={e.id}>{e.texto}</option>
                  ))}
                </select>
                <input value={print} onChange={(e) => setPrint(e.target.value)} placeholder="Link do print (Drive, Slack…)" className={inputClass} />
              </div>
              <button
                type="button"
                disabled={!excecao || !print.trim() || ocupado !== null}
                onClick={() => executar("denuncia", () => denunciarAvaliacaoGoogle({ id: a.id, excecao, print }), "Marcada como denunciada.")}
                className="mt-2 flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-50 disabled:opacity-40"
              >
                {ocupado === "denuncia" ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />} Denunciei ao Google
              </button>
            </div>
          ) : (
            <p className="border-t border-zinc-100 pt-4 text-xs text-zinc-600">
              Denunciada ao Google ({EXCECOES_GOOGLE.find((e) => e.id === a.excecao)?.texto.toLowerCase() ?? a.excecao}). Fica fora dos indicadores.
              {a.printDaDenuncia && (
                <a href={a.printDaDenuncia} target="_blank" rel="noopener noreferrer" className="ml-1 font-medium text-violet-700 hover:underline">
                  Ver o print
                </a>
              )}
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

      <ConfirmDelete open={apagando} label={`a avaliação de ${a.autor}`} onCancel={() => setApagando(false)} onConfirm={apagar} />

    </Modal>
  );
}
