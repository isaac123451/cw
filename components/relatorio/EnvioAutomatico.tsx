"use client";

import { useEffect, useState } from "react";

import { Loader2, Mail, Save } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { lerEnvioDoRelatorio, salvarEnvioDoRelatorio } from "@/lib/actions/relatorio";
import { useToast } from "@/lib/context/ToastContext";
import { pluralDe } from "@/lib/plural";

/**
 * O relatório que chega sozinho (Fase 30, 1.105): para quem a rotina da
 * madrugada manda o relatório do ciclo que acabou, no primeiro dia do ciclo
 * seguinte. Vazio, nada é enviado. Salvar só confirma depois do servidor.
 */
export default function EnvioAutomatico() {
  const { notify } = useToast();
  const [estado, setEstado] = useState<{ para: string[]; enviadoCiclo: string | null; sandbox: boolean; semProvedor: boolean } | null>(null);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    lerEnvioDoRelatorio().then((r) => {
      if (!vivo || !r.ok) return;
      setEstado(r);
      setTexto(r.para.join(", "));
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (!estado) return null;

  const mudou = texto.split(/[,;\s]+/).filter(Boolean).join(",") !== estado.para.join(",");

  async function salvar() {
    setSalvando(true);
    const r = await salvarEnvioDoRelatorio(texto.split(/[,;\s]+/).filter(Boolean));
    setSalvando(false);
    if (!r.ok) {
      notify({ tone: "error", title: "Não foi salvo.", detail: r.erro });
      return;
    }
    setEstado((e) => (e ? { ...e, para: r.para } : e));
    setTexto(r.para.join(", "));
    notify({
      tone: "success",
      title: r.para.length ? "Envio automático salvo." : "Envio automático desligado.",
      detail: r.para.length ? `O relatório de cada ciclo vai para ${r.para.length} ${pluralDe(r.para.length, "e-mail", "e-mails")} na madrugada do dia seguinte.` : "Nenhum relatório sai sozinho.",
    });
  }

  return (
    <div className="mx-auto mt-6 max-w-5xl">
      <SurfaceCard
        title="Envio automático"
        description="O relatório do ciclo que acabou chega sozinho por e-mail, na madrugada do primeiro dia do ciclo seguinte — o mesmo texto do Copiar para o Slack. Vazio, nada é enviado."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Mail size={15} className="text-zinc-400" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="gestao@cardapioweb.com, lider@cardapioweb.com"
            className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-violet-400"
            aria-label="E-mails que recebem o relatório"
          />
          <button
            type="button"
            onClick={salvar}
            disabled={!mudou || salvando}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-violet-700 px-3.5 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-40"
          >
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          {estado.semProvedor
            ? "Sem provedor de e-mail configurado: defina RESEND_API_KEY na Vercel para o envio funcionar."
            : estado.sandbox
              ? "O remetente de e-mail ainda é o de teste do Resend: ele só entrega para o dono da conta. Para a equipe receber, falta o domínio verificado (o mesmo DNS do código de duas etapas)."
              : estado.enviadoCiclo
                ? `Último ciclo enviado: ${estado.enviadoCiclo}.`
                : "Nenhum ciclo enviado ainda."}
        </p>
      </SurfaceCard>
    </div>
  );
}
