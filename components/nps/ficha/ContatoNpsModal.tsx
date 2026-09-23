"use client";

import { useState } from "react";

import Modal, { inputClass, textareaClass } from "@/components/shared/Modal";

import { registerNpsAttempt, registerPostContact } from "@/lib/actions/nps";
import { useNps } from "@/lib/context/NpsContext";
import { useSla } from "@/lib/context/SlaContext";
import { useToast } from "@/lib/context/ToastContext";
import { useAgora } from "@/lib/hooks/useAgora";
import {
  CHANNELS,
  JANELA_TENTATIVAS_DIAS,
  MOODS,
  nomeDoCliente,
  segmentOf,
  tentativasMinimas,
  type NpsResponseView,
} from "@/lib/models/nps";
import { tentativasNaJanela } from "@/lib/services/nps.service";
import { descreverMinutosUteis, instanteDe, minutosUteisEntre, paredeDe } from "@/lib/services/horasUteis";
import { podeMarcarSemRetorno, quandoLiberaSemRetorno } from "@/lib/models/tratativa";

import { ErroDoServidor, RodapeDeSalvar, Rotulo } from "@/components/shared/Rodape";

export type ModoDoContato = "contato" | "tentativa";

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
 * O contato com o cliente, feito ou tentado.
 *
 * "Falei com o cliente" é o retorno do guia: o que foi feito, se
 * resolveu e como a pessoa ficou (a régua de humor, que é o indicador
 * "humor do detrator após resolução"). "Tentei contato" é a
 * cadência: cada tentativa conta para o encerramento sem retorno —
 * depois de 2 horas sem resposta. Antes disso ela fica "aguardando
 * retorno", porque o cliente ainda pode responder à mensagem.
 *
 * As duas contam como 1º contato — o prazo do segmento para no
 * primeiro registro, como a operação sempre mediu.
 */
export default function ContatoNpsModal({
  item,
  modoInicial,
  onClose,
}: {
  item: NpsResponseView;
  modoInicial: ModoDoContato;
  onClose: () => void;
}) {

  const { recarregar } = useNps();
  const { expediente } = useSla();
  const { notify } = useToast();
  const agora = useAgora();

  const [modo, setModo] = useState<ModoDoContato>(modoInicial);

  const [humor, setHumor] = useState<number | undefined>(item.moodAfter);
  const [resolveu, setResolveu] = useState<boolean | undefined>(item.resolvedAfter);
  const [combinado, setCombinado] = useState(item.postContactNote ?? "");

  const [canal, setCanal] = useState(item.phone ? "WhatsApp" : CHANNELS[0]);
  const [aconteceu, setAconteceu] = useState("");
  const [quando, setQuando] = useState(() => valorDoCampo(new Date()));
  const [semRetorno, setSemRetorno] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const primeiro = !item.firstContactAt;
  const segmento = segmentOf(item.score);
  const minimas = tentativasMinimas(item.kind);
  const naJanela = agora ? tentativasNaJanela(item, agora).length : item.attempts.length;

  /* Quem tentou às 9h e registra às 14h já pode marcar sem retorno; quem tentou agora, espera 2 horas. */
  const emDoCampo = instanteDoCampo(quando);
  const liberado = Boolean(emDoCampo && agora && podeMarcarSemRetorno(emDoCampo, agora));

  /* O que o registro significa para o prazo, dito antes de salvar. */
  const prazo = new Date(item.firstContactDueAt);
  const avisoDoPrazo = primeiro && agora
    ? agora <= prazo
      ? `Registrar agora cumpre o 1º contato com ${descreverMinutosUteis(minutosUteisEntre(agora, prazo, expediente), expediente)} de folga.`
      : `O 1º contato já passou do prazo em ${descreverMinutosUteis(minutosUteisEntre(prazo, agora, expediente), expediente)}. Registre mesmo assim — o atraso fica medido.`
    : null;

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      if (modo === "contato") {
        const r = await registerPostContact({ id: item.id, mood: humor ?? null, resolved: resolveu ?? null, note: combinado });
        if (!r.ok) {
          setErro(r.erro);
          return;
        }
        await recarregar();
        const h = MOODS.find((m) => m.value === humor);
        notify({
          tone: "success",
          title: primeiro ? "1º contato e retorno registrados." : "Retorno registrado.",
          detail: [
            h ? `${h.emoji} ${h.label}.` : null,
            resolveu === true ? "Resolveu — a confirmação do cliente já conta." : resolveu === false ? "Não resolveu ainda." : null,
          ]
            .filter(Boolean)
            .join(" ") || nomeDoCliente(item),
        });
      } else {
        if (!emDoCampo) {
          setErro("Preencha a data e a hora da tentativa.");
          return;
        }
        const comoSemRetorno = semRetorno && liberado;
        const r = await registerNpsAttempt({ responseId: item.id, channel: canal, note: aconteceu, em: emDoCampo.toISOString(), semRetorno: comoSemRetorno });
        if (!r.ok) {
          setErro(r.erro);
          return;
        }
        await recarregar();
        const n = naJanela + 1;
        notify({
          tone: "success",
          title: `Tentativa por ${canal} registrada.`,
          detail: !comoSemRetorno
            ? `Aguardando retorno até ${quandoLiberaSemRetorno(emDoCampo)}. Depois, marque sem retorno em Contatos — ou registre a conversa.`
            : n >= minimas
              ? `${n} tentativas em ${JANELA_TENTATIVAS_DIAS} dias: o guia já permite encerrar sem retorno.`
              : `${n} de ${minimas} tentativas em ${JANELA_TENTATIVAS_DIAS} dias — varie o canal e o horário.`,
        });
      }
      onClose();
    } catch {
      setErro("O registro não foi gravado. Tente de novo; se repetir, atualize a página.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      porque="nps.segmentacao"
      title={modo === "contato" ? (primeiro ? "Registrar o 1º contato" : "Registrar o retorno") : "Registrar tentativa de contato"}
      description={`${nomeDoCliente(item)} · ${segmento.label}, nota ${item.score}`}
      onClose={onClose}
      footer={
        <RodapeDeSalvar
          salvando={salvando}
          desabilitado={modo === "tentativa" && !aconteceu.trim()}
          rotulo={modo === "contato" ? "Salvar o contato" : "Salvar a tentativa"}
          onSalvar={salvar}
          onCancelar={onClose}
        />
      }
    >
      <div className="space-y-5">

        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-zinc-100 p-1">
          {(
            [
              ["contato", "Falei com o cliente"],
              ["tentativa", "Tentei contato"],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              onClick={() => setModo(id)}
              aria-pressed={modo === id}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${modo === id ? "bg-white text-violet-800 shadow-sm" : "text-zinc-600 hover:text-zinc-800"}`}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {avisoDoPrazo && <p className="text-xs leading-relaxed text-zinc-500">{avisoDoPrazo}</p>}

        {modo === "contato" ? (
          <>
            <div>
              <Rotulo>Como o cliente ficou depois do contato</Rotulo>
              <p className="mt-1 text-xs text-zinc-500">
                A nota {item.score} é de antes e não muda. A régua mede se o contato moveu a agulha.
              </p>
              <div className="mt-2 grid grid-cols-5 gap-1.5">
                {MOODS.map((m) => {
                  const ativo = humor === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      title={m.hint}
                      onClick={() => setHumor(ativo ? undefined : m.value)}
                      aria-pressed={ativo}
                      style={ativo ? { borderColor: m.color, background: `${m.color}14`, color: m.color } : undefined}
                      className={`flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2 transition-colors ${ativo ? "font-semibold" : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50"}`}
                    >
                      <span className="text-lg leading-none">{m.emoji}</span>
                      <span className="text-[10.5px] leading-tight">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Rotulo>A questão foi resolvida?</Rotulo>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(
                  [
                    [true, "Sim, o cliente confirmou"],
                    [false, "Ainda não"],
                    [undefined, "Não perguntei"],
                  ] as const
                ).map(([valor, rotulo]) => {
                  const ativo = resolveu === valor;
                  return (
                    <button
                      key={rotulo}
                      type="button"
                      onClick={() => setResolveu(valor)}
                      aria-pressed={ativo}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        ativo
                          ? valor === true
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : valor === false
                              ? "border-rose-300 bg-rose-50 text-rose-800"
                              : "border-violet-300 bg-violet-50 text-violet-800"
                          : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                      }`}
                    >
                      {rotulo}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block">
              <Rotulo>O que foi feito ou combinado</Rotulo>
              <textarea
                value={combinado}
                onChange={(e) => setCombinado(e.target.value)}
                rows={3}
                placeholder="A solução, os próximos passos ou o link de acompanhamento enviado — para quem abrir o ciclo depois."
                className={`mt-1.5 ${textareaClass}`}
              />
            </label>
          </>
        ) : (
          <>
            <div>
              <Rotulo>Por onde</Rotulo>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CHANNELS.map((c) => (
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
            </div>

            <label className="block">
              <Rotulo>O que aconteceu</Rotulo>
              <textarea
                value={aconteceu}
                onChange={(e) => setAconteceu(e.target.value)}
                rows={2}
                placeholder="Ex.: liguei às 10h, caixa postal; mandei mensagem no WhatsApp."
                className={`mt-1.5 ${textareaClass}`}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <Rotulo>Quando (Brasília)</Rotulo>
                <input
                  type="datetime-local"
                  value={quando}
                  max={valorDoCampo(new Date())}
                  onChange={(e) => setQuando(e.target.value)}
                  className={`mt-1.5 ${inputClass}`}
                />
              </label>
              <div>
                <Rotulo>O cliente respondeu?</Rotulo>
                <label className={`mt-2.5 flex items-start gap-2 text-sm ${liberado ? "text-zinc-700" : "text-zinc-400"}`}>
                  <input
                    type="checkbox"
                    checked={semRetorno && liberado}
                    disabled={!liberado}
                    onChange={(e) => setSemRetorno(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-violet-700"
                  />
                  <span>
                    Não — sem retorno
                    {!liberado && emDoCampo && (
                      <span className="block text-[11px] leading-snug text-zinc-500">
                        Só a partir das {quandoLiberaSemRetorno(emDoCampo)}. Até lá, fica aguardando retorno.
                      </span>
                    )}
                  </span>
                </label>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-zinc-500">
              {naJanela} de {minimas} tentativas sem retorno nos últimos {JANELA_TENTATIVAS_DIAS} dias. O guia pede {minimas} em {JANELA_TENTATIVAS_DIAS} dias
              (e-mail, telefone, WhatsApp) antes de encerrar sem retorno; a tentativa conta depois de 2 horas sem resposta.
            </p>
          </>
        )}
      </div>

      <ErroDoServidor erro={erro} />
    </Modal>
  );
}
