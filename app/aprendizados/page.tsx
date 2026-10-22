"use client";

import { useEffect, useMemo, useState } from "react";

import { Hash, Loader2, MessageCircle, Search, Star, X } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";

import { esquecerAprendizado, lerAprendizados, type AprendizadoView } from "@/lib/actions/aprendizados";
import { useToast } from "@/lib/context/ToastContext";

const dia = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/**
 * O que a IA aprendeu (21/10/2026).
 *
 * A cada duas horas a IA lê as respostas do time aos clientes no WhatsApp
 * e as mensagens guardadas do Slack e guarda o que vale como conhecimento
 * geral — nunca dado de cliente nem nada sensível. Ao ler a próxima
 * conversa, ela recebe o que tem a ver com o assunto. Aqui a pessoa vê
 * tudo e esquece o que não quiser que ela use.
 */
export default function AprendizadosPage() {
  const { notify } = useToast();
  const [lista, setLista] = useState<AprendizadoView[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [fonte, setFonte] = useState<"todas" | "whatsapp" | "slack" | "avaliacoes">("todas");

  useEffect(() => {
    let vivo = true;
    lerAprendizados().then((r) => {
      if (!vivo) return;
      if (r.ok) setLista(r.lista);
      else setErro(r.erro);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (lista ?? []).filter((a) => (fonte === "todas" || a.fonte === fonte) && (!termo || `${a.assunto} ${a.texto}`.toLowerCase().includes(termo)));
  }, [lista, busca, fonte]);

  async function esquecer(a: AprendizadoView) {
    const r = await esquecerAprendizado(a.id);
    if (!r.ok) {
      notify({ tone: "error", title: "Não foi esquecido.", detail: r.erro });
      return;
    }
    setLista((l) => (l ?? []).filter((x) => x.id !== a.id));
    notify({ tone: "success", title: `Esquecido: ${a.assunto}.`, detail: "A IA não usa mais, nem se aparecer de novo." });
  }

  return (
    <MainLayout>
      <div className="space-y-5">
        <PageHeading
          eyebrow="Conhecimento"
          title="O que a IA aprendeu"
          description="Tirado das suas respostas no WhatsApp e das conversas do Slack (a cada duas horas) e do resultado das respostas públicas no Reclame Aqui (uma vez por dia: o que leva à avaliação boa e à ruim). Só conhecimento geral, sem dado de cliente. A IA usa isso para ler as conversas e escrever as sugestões de resposta."
        />

        {erro && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-100">{erro}</p>}

        <SurfaceCard bodyClassName="p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-5 py-3">
            <div className="inline-flex rounded-lg bg-zinc-100 p-0.5" role="tablist" aria-label="Fonte">
              {(
                [
                  ["todas", "Todas"],
                  ["whatsapp", "WhatsApp"],
                  ["slack", "Slack"],
                  ["avaliacoes", "Avaliações"],
                ] as const
              ).map(([id, nome]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={fonte === id}
                  onClick={() => setFonte(id)}
                  className={`rounded-md px-2.5 py-1 text-sm transition-colors ${fonte === id ? "bg-white font-medium text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}
                >
                  {nome}
                </button>
              ))}
            </div>
            <label className="ml-auto flex w-64 items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-1.5">
              <Search size={14} className="text-zinc-400" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar assunto" className="w-full bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400" />
            </label>
          </div>

          {!lista && !erro ? (
            <p className="flex items-center gap-2 px-5 py-10 text-sm text-zinc-500">
              <Loader2 size={15} className="animate-spin" /> Carregando…
            </p>
          ) : visiveis.length === 0 ? (
            <p className="px-5 py-10 text-sm text-zinc-500">
              {lista?.length ? "Nada com esse filtro." : "Ainda nada. A primeira leitura acontece nas próximas duas horas, com a plataforma aberta e a IA configurada."}
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {visiveis.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <span className="mt-0.5 text-zinc-400" title={a.fonte === "slack" ? "Do Slack" : a.fonte === "avaliacoes" ? "Do resultado das respostas no Reclame Aqui" : "Do WhatsApp"}>
                    {a.fonte === "slack" ? <Hash size={15} /> : a.fonte === "avaliacoes" ? <Star size={15} /> : <MessageCircle size={15} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900">{a.assunto}</p>
                    <p className="mt-0.5 text-sm text-zinc-600">{a.texto}</p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {a.vezes > 1 ? `visto ${a.vezes} vezes · ` : ""}atualizado em {dia(a.atualizadoEm)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void esquecer(a)}
                    title="Esquecer — a IA não usa mais"
                    aria-label={`Esquecer ${a.assunto}`}
                    className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>
    </MainLayout>
  );
}
