"use client";

import { useState } from "react";

import { Loader2, Megaphone, Save, Star } from "lucide-react";

import type { NpsResponseView } from "@/lib/models/nps";
import { descreverRegistro } from "@/lib/services/horasUteis";

import { salvarAcoesDoPromotor, type AcoesDoPromotor as Acoes } from "@/lib/actions/nps";
import { useToast } from "@/lib/context/ToastContext";

interface Props {
  item: NpsResponseView;
  /** A tela aplica o que o servidor devolveu, sem recarregar a lista. */
  onSalvo: (acoes: Acoes) => void;
}

type Talvez = boolean | null;

function rascunhoDe(item: NpsResponseView) {
  return {
    reviewAsked: item.reviewAsked,
    testimonialAsked: item.testimonialAsked,
    referralAsked: item.referralAsked,
    reviewFeita: (item.reviewFeita ?? null) as Talvez,
    aceitaCase: (item.aceitaCase ?? null) as Talvez,
    indicacoes: item.indicacoes === undefined ? "" : String(item.indicacoes),
  };
}

function Escolha({ valor, onChange, rotulos }: { valor: Talvez; onChange: (v: Talvez) => void; rotulos: [string, string, string] }) {
  const opcoes: [Talvez, string][] = [
    [null, rotulos[0]],
    [true, rotulos[1]],
    [false, rotulos[2]],
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {opcoes.map(([v, r]) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
            valor === v
              ? v === true
                ? "bg-emerald-50 text-emerald-800 ring-emerald-300"
                : v === false
                  ? "bg-zinc-100 text-zinc-800 ring-zinc-300"
                  : "bg-white text-zinc-800 ring-zinc-400"
              : "text-zinc-500 ring-zinc-200 hover:bg-zinc-50"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

/**
 * As três ações do promotor, com o resultado de cada uma.
 *
 * "Direcionar ativamente para uma review pública (Google) enquanto o
 * sentimento está positivo. Perguntar se aceita ser case. Pedir
 * indicação." O guia mede o que volta — indicações e avaliações no
 * Google —, então o resultado é gravado junto do pedido.
 *
 * Era uma fileira de caixas que gravava no clique, sem aviso de que
 * gravou. Agora é rascunho e Salvar, com o aviso depois da resposta.
 */
export default function AcoesDoPromotor({ item, onSalvo }: Props) {

  const { notify } = useToast();

  const [r, setR] = useState(() => rascunhoDe(item));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const original = rascunhoDe(item);
  const alterado = JSON.stringify(r) !== JSON.stringify(original);

  const indicacoes = r.indicacoes.trim() === "" ? null : Number(r.indicacoes);
  const indicacoesValidas = indicacoes === null || (Number.isInteger(indicacoes) && indicacoes >= 0 && indicacoes <= 500);

  /*
    O resultado marca o pedido junto, já no rascunho: quem publicou a
    review foi convidado. O servidor faz o mesmo; aqui é para a caixa não
    ficar desmarcada até o Salvar e parecer que o pedido não aconteceu.
  */
  function mudar<K extends keyof typeof r>(campo: K, valor: (typeof r)[K]) {
    setR((atual) => {
      const novo = { ...atual, [campo]: valor };
      if (campo === "reviewFeita" && valor !== null) novo.reviewAsked = true;
      if (campo === "aceitaCase" && valor !== null) novo.testimonialAsked = true;
      if (campo === "indicacoes" && Number(valor) > 0) novo.referralAsked = true;
      return novo;
    });
    setErro(null);
  }

  async function salvar() {

    setSalvando(true);
    setErro(null);

    try {
      const resposta = await salvarAcoesDoPromotor({
        id: item.id,
        reviewAsked: r.reviewAsked,
        testimonialAsked: r.testimonialAsked,
        referralAsked: r.referralAsked,
        reviewFeita: r.reviewFeita,
        aceitaCase: r.aceitaCase,
        indicacoes,
      });

      if (!resposta.ok) {
        setErro(resposta.erro);
        return;
      }

      onSalvo(resposta.acoes);

      const a = resposta.acoes;

      notify({
        tone: "success",
        title: "Ações do promotor salvas.",
        detail: [
          a.reviewFeita === true ? "review publicada no Google" : a.reviewAsked ? "review pedida" : null,
          a.aceitaCase === true ? "aceitou ser case" : a.aceitaCase === false ? "não quis ser case" : a.testimonialAsked ? "case perguntado" : null,
          a.indicacoes ? `${a.indicacoes} indicação(ões)` : a.referralAsked ? "indicação pedida" : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });

      setR({
        reviewAsked: a.reviewAsked,
        testimonialAsked: a.testimonialAsked,
        referralAsked: a.referralAsked,
        reviewFeita: a.reviewFeita,
        aceitaCase: a.aceitaCase,
        indicacoes: a.indicacoes === null ? "" : String(a.indicacoes),
      });
    } catch {
      setErro("Não foi gravado. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  const caixa = "h-4 w-4 accent-emerald-600";

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5">

      <p className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
        <Megaphone size={14} />
        Aproveitar enquanto o sentimento está positivo
      </p>
      <p className="mt-1 text-xs leading-relaxed text-emerald-900/80">
        O guia pede as três no elogio de promotor. É daqui que saem &quot;Nº de indicações&quot; e &quot;Nº de avaliações no Google&quot;.
      </p>

      <div className="mt-3 space-y-3">

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-emerald-900">
            <input type="checkbox" checked={r.reviewAsked} onChange={(e) => mudar("reviewAsked", e.target.checked)} className={caixa} />
            Pedi a review pública no Google
          </label>
          <Escolha valor={r.reviewFeita} onChange={(v) => mudar("reviewFeita", v)} rotulos={["Ainda não sei", "Publicou", "Não publicou"]} />
        </div>

        {item.avaliacaoGoogle && (
          <p className="flex items-center gap-1.5 pl-6 text-xs text-emerald-800">
            <span className="flex">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={11} className={n <= item.avaliacaoGoogle!.estrelas ? "fill-amber-400 text-amber-400" : "text-emerald-200"} />
              ))}
            </span>
            Registrada em Google Avaliações, publicada em {descreverRegistro(item.avaliacaoGoogle.publicadaEm)}.
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-emerald-900">
            <input type="checkbox" checked={r.testimonialAsked} onChange={(e) => mudar("testimonialAsked", e.target.checked)} className={caixa} />
            Perguntei se aceita ser case ou depoimento
          </label>
          <Escolha valor={r.aceitaCase} onChange={(v) => mudar("aceitaCase", v)} rotulos={["Sem resposta", "Aceitou", "Não aceitou"]} />
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-emerald-900">
            <input type="checkbox" checked={r.referralAsked} onChange={(e) => mudar("referralAsked", e.target.checked)} className={caixa} />
            Pedi indicação de outros clientes
          </label>
          <label className="flex items-center gap-2 text-xs text-emerald-900">
            Indicações recebidas
            <input
              inputMode="numeric"
              value={r.indicacoes}
              onChange={(e) => mudar("indicacoes", e.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder="—"
              className={`h-8 w-16 rounded-lg border bg-white px-2 text-center text-sm tabular-nums outline-none focus:border-emerald-500 ${indicacoesValidas ? "border-emerald-200" : "border-rose-400"}`}
            />
          </label>
        </div>

      </div>

      {erro && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 ring-1 ring-inset ring-rose-100">{erro}</p>}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={salvar}
          disabled={!alterado || !indicacoesValidas || salvando}
          className="flex items-center gap-2 rounded-xl bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
        >
          {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar
        </button>
      </div>

    </div>
  );
}
