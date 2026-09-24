"use client";

import { useState } from "react";

import { Check, Loader2, TriangleAlert } from "lucide-react";

import Modal, { GhostButton, inputClass, textareaClass } from "@/components/shared/Modal";

import type { Case } from "@/lib/models/case";
import {
  CANAIS_DE_CONTATO,
  patchDoResumo,
  podeMarcarSemRetorno,
  quandoLiberaSemRetorno,
  RESULTADOS_SEM_RETORNO,
  ROTULO_DO_RESULTADO,
  TIPOS_DE_CONTATO,
  tipoDeContato,
  type ResultadoDoContato,
  type TipoDeContato,
} from "@/lib/models/tratativa";
import {
  descreverMinutosUteis,
  instanteDe,
  minutosUteisEntre,
  paredeDe,
} from "@/lib/services/horasUteis";
import { slaStatus } from "@/lib/services/sla.service";

import { registrarContato } from "@/lib/actions/tratativa";
import { useSla } from "@/lib/context/SlaContext";
import { useToast } from "@/lib/context/ToastContext";

import { porqueDoContato } from "@/lib/documentos/porques";
interface Props {
  item: Case;
  /** Abre já no tipo certo — "Fiz o 1º contato" chega como `contato`. */
  tipoInicial?: TipoDeContato;
  onClose: () => void;
  onSalvo: (patch: Partial<Case>) => void;
}

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
 * Registrar um contato com o cliente — feito ou tentado.
 *
 * É o registro que a documentação pede em todo passo: o 1º contato, cada
 * tentativa da cadência de persistência, cada atualização enquanto a
 * área interna trabalha. A hora é a de Brasília, e pode ser a de antes:
 * quem ligou às 10h e só registrou às 15h registra 10h.
 */
export default function ContatoModal({ item, tipoInicial, onClose, onSalvo }: Props) {

  const { notify } = useToast();
  const { rules, expediente } = useSla();

  const primeiro = !item.primeiroContatoEm;

  const [tipo, setTipo] = useState<TipoDeContato>(tipoInicial ?? "contato");
  /*
    O canal de cada frente, como a documentação diz: no Reclame Aqui o
    1º contato é "preferencialmente WhatsApp"; nas redes, a conversa
    continua "atualmente pelo Crisp".
  */
  const [canal, setCanal] = useState<string>(
    item.source === "Reclame Aqui" ? "WhatsApp" : "Crisp"
  );
  const [resultado, setResultado] = useState<ResultadoDoContato>(
    tipoDeContato(tipoInicial ?? "contato")!.resultadoPadrao
  );
  const [quando, setQuando] = useState(() => valorDoCampo(new Date()));
  const [nota, setNota] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const info = tipoDeContato(tipo)!;

  /*
    Sem retorno só 2 horas depois da tentativa. A hora do campo decide:
    quem ligou às 9h e registra às 14h já pode marcar "não atendeu".
  */
  const emDoCampo = instanteDoCampo(quando);
  const liberado = tipo !== "tentativa" || (emDoCampo ? podeMarcarSemRetorno(emDoCampo) : false);
  const resultadoEfetivo: ResultadoDoContato = !liberado && RESULTADOS_SEM_RETORNO.includes(resultado) ? "aguardando" : resultado;

  function escolherTipo(novo: TipoDeContato) {
    setTipo(novo);
    setResultado(tipoDeContato(novo)!.resultadoPadrao);
  }

  async function salvar() {

    const em = instanteDoCampo(quando);

    if (!em) {
      setErro("Preencha a data e a hora do contato.");
      return;
    }

    setSalvando(true);
    setErro(null);

    /* Como estava o relógio antes, para o aviso dizer se cumpriu a meta. */
    const antes = slaStatus(item, rules, { expediente, agora: em });

    try {
      const r = await registrarContato({
        protocol: item.protocol,
        tipo,
        canal,
        resultado: resultadoEfetivo,
        nota,
        em: em.toISOString(),
      });

      if (!r.ok) {
        setErro(r.erro);
        return;
      }

      onSalvo(patchDoResumo(r.resumo));

      /*
        O aviso diz o que o registro significou para o prazo.

        "Salvo" sozinho confirma o clique; "1º contato dentro do prazo,
        com 2h10 de folga" confirma o trabalho.
      */
      let detalhe = `${info.rotulo} por ${canal} — ${ROTULO_DO_RESULTADO[resultadoEfetivo].toLowerCase()}.`;

      if (primeiro && antes.fase === "contato" && antes.prazo && antes.situation !== "sem-registro") {
        const folga = minutosUteisEntre(em, new Date(antes.prazo), expediente);
        detalhe =
          folga >= 0
            ? `1º contato dentro do prazo, com ${descreverMinutosUteis(folga, expediente)} de folga.`
            : `1º contato registrado ${descreverMinutosUteis(folga, expediente)} depois do prazo.`;
      } else if (tipo === "tentativa" && resultadoEfetivo === "aguardando") {
        detalhe = `Aguardando retorno até ${quandoLiberaSemRetorno(em)}. Depois, marque sem retorno no bloco Criticidade e prazo — ou registre a resposta do cliente.`;
      } else if (tipo === "tentativa" && r.resumo.tentativasSemResposta > 0) {
        detalhe = `${r.resumo.tentativasSemResposta}ª tentativa seguida sem resposta. A documentação pede até 5, em horários variados, ao longo de 7 dias.`;
      }

      notify({
        tone: "success",
        title: `Contato registrado em ${item.protocol}.`,
        detail: detalhe,
      });

      onClose();
    } catch {
      setErro("O contato não foi gravado. Tente de novo; se repetir, atualize a página.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      porque={porqueDoContato(tipo, item.source === "Reclame Aqui" ? "ra" : "redes")}
      title={primeiro ? `Registrar o 1º contato — ${item.protocol}` : `Registrar contato — ${item.protocol}`}
      description={
        primeiro
          ? "O primeiro contato cumpre a meta da criticidade. Tentativa sem resposta também conta como contato feito."
          : "Cada interação registrada mantém o histórico do cliente e alimenta a cadência de persistência."
      }
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
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {salvando ? "Salvando…" : "Salvar contato"}
          </button>
        </>
      }
    >

      <div className="space-y-4">

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            O que aconteceu
          </p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {TIPOS_DE_CONTATO.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => escolherTipo(t.id)}
                aria-pressed={tipo === t.id}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                  tipo === t.id
                    ? "border-violet-300 bg-violet-50 font-semibold text-violet-800"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                }`}
              >
                {t.rotulo}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">{info.quando}</p>
          {tipo === "contato" && primeiro && (
            <p className="mt-1 text-xs text-amber-800">
              Só se o cliente respondeu. Mandou mensagem e ainda não teve resposta? Use &ldquo;Tentei contato&rdquo; — a trilha espera o retorno.
            </p>
          )}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Por onde</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CANAIS_DE_CONTATO.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCanal(c)}
                aria-pressed={canal === c}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  canal === c
                    ? "border-violet-300 bg-violet-50 text-violet-800"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {info.resultados.length > 1 && (
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Resultado
              </span>
              <select
                value={resultadoEfetivo}
                onChange={(e) => setResultado(e.target.value as ResultadoDoContato)}
                className={`mt-1.5 ${inputClass}`}
              >
                {info.resultados.map((r) => (
                  <option key={r} value={r} disabled={!liberado && RESULTADOS_SEM_RETORNO.includes(r)}>
                    {ROTULO_DO_RESULTADO[r]}
                    {!liberado && RESULTADOS_SEM_RETORNO.includes(r) ? " — depois de 2h" : ""}
                  </option>
                ))}
              </select>
              {!liberado && emDoCampo && (
                <span className="mt-1 block text-[11px] leading-snug text-zinc-500">
                  Sem retorno a partir das {quandoLiberaSemRetorno(emDoCampo)}: o cliente ainda pode responder.
                </span>
              )}
            </label>
          )}

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Quando (Brasília)
            </span>
            <input
              type="datetime-local"
              value={quando}
              max={valorDoCampo(new Date())}
              onChange={(e) => setQuando(e.target.value)}
              className={`mt-1.5 ${inputClass}`}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Anotação (opcional)
          </span>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            placeholder={
              tipo === "tentativa"
                ? "Ex.: liguei às 10h, caixa postal; mandei mensagem no WhatsApp."
                : "O essencial do que foi conversado — para quem abrir o caso depois."
            }
            className={`mt-1.5 ${textareaClass}`}
          />
        </label>

      </div>

      {erro && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-100">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}

    </Modal>
  );
}
