"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import { ArrowRight, Check, CheckCircle2, Copy, Download, Loader2, RefreshCw, TriangleAlert, Unplug } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { minhaExtensao } from "@/lib/actions/minhaExtensao";
import { pedirAExtensao, versaoDaExtensao } from "@/lib/extensao/ponte";
import { compararVersoes } from "@/lib/models/versaoDaExtensao";
import { descreverRegistro } from "@/lib/services/horasUteis";

/**
 * A extensão na plataforma (13/11/2026): "preciso que você deixe disponível
 * na plataforma a extensão e que trabalhe junto de uma forma melhor. outro
 * ponto, ela precisa sempre atualizar certinho".
 *
 * Uma coisa por vez: o estado da extensão neste navegador numa linha, o que
 * fazer a seguir no mesmo lugar (baixar, atualizar agora), e o passo a passo
 * recolhido embaixo. O estado vem da ponte (a extensão responde na hora) e,
 * quando não há ponte, da última versão que o servidor viu.
 */

type Estado =
  | { tipo: "lendo" }
  | { tipo: "em-dia"; versao: string }
  | { tipo: "atras"; versao: string }
  | { tipo: "sem-ponte"; vista: { versao: string; vistaEm: string } | null };

const PLATAFORMA = process.env.NEXT_PUBLIC_VERSAO ?? "";

const semAssinatura = () => () => {};

/**
 * O comando de instalar (16/11/2026): "tem que ser algo automático sem ter
 * que ficar baixando nada". Cola no PowerShell uma vez; o instalador põe a
 * extensão numa pasta fixa e deixa o Windows atualizando essa pasta sozinho.
 */
function ComandoDeInstalar() {
  const origem = useSyncExternalStore(semAssinatura, () => window.location.origin, () => "");
  const [copiado, setCopiado] = useState(false);
  const comando = `$CWOrigem='${origem}'; irm "$CWOrigem/extensao/instalar.txt" | iex`;
  return (
    <span className="mt-2 flex items-center gap-2">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-100">{origem ? comando : "…"}</code>
      <button
        type="button"
        disabled={!origem}
        onClick={() => {
          void navigator.clipboard.writeText(comando).then(() => {
            setCopiado(true);
            window.setTimeout(() => setCopiado(false), 2000);
          });
        }}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-60"
      >
        {copiado ? <Check size={13} /> : <Copy size={13} />}
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </span>
  );
}

export default function PaginaDaExtensao() {
  const [estado, setEstado] = useState<Estado>({ tipo: "lendo" });
  const [doZip, setDoZip] = useState<{ versao: string; bytes: number } | null>(null);
  const [atualizando, setAtualizando] = useState<null | "pedindo" | "recarregando" | "pasta-velha">(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([versaoDaExtensao(1500), minhaExtensao().catch(() => null)]).then(([aqui, vista]) => {
      if (!vivo) return;
      if (aqui) setEstado(compararVersoes(aqui, PLATAFORMA) < 0 ? { tipo: "atras", versao: aqui } : { tipo: "em-dia", versao: aqui });
      else setEstado({ tipo: "sem-ponte", vista });
    });
    fetch("/extensao/versao.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => vivo && d && setDoZip(d))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  async function atualizarAgora() {
    setAtualizando("pedindo");
    const r = await pedirAExtensao<{ rodando: string; disco: string | null; atualizando: boolean }>("atualizarAgora", {}, 8000);
    if (r?.ok && r.dados?.atualizando) {
      setAtualizando("recarregando");
      /* A extensão recarrega e volta às abas; esta página pega a ponte nova no F5. */
      window.setTimeout(() => window.location.reload(), 3500);
    } else {
      setAtualizando("pasta-velha");
    }
  }

  return (
    <div className="space-y-5">
      <SurfaceCard>
        <div className="flex flex-wrap items-center gap-4">
          {estado.tipo === "lendo" && (
            <p className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 size={16} className="animate-spin" /> Procurando a extensão neste navegador…
            </p>
          )}

          {estado.tipo === "em-dia" && (
            <p className="flex min-w-0 flex-1 items-center gap-2 text-sm text-emerald-800">
              <CheckCircle2 size={18} className="shrink-0" />
              <span>
                <strong>Extensão em dia</strong> neste navegador: versão {estado.versao}. Ela se atualiza sozinha quando a pasta muda.
              </span>
            </p>
          )}

          {estado.tipo === "atras" && (
            <>
              <p className="flex min-w-0 flex-1 items-center gap-2 text-sm text-amber-800">
                <TriangleAlert size={18} className="shrink-0" />
                <span>
                  <strong>Extensão desatualizada</strong>: está na {estado.versao}, a plataforma na {PLATAFORMA}.
                </span>
              </p>
              <button
                type="button"
                onClick={() => void atualizarAgora()}
                disabled={atualizando === "pedindo" || atualizando === "recarregando"}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-60"
              >
                <RefreshCw size={13} className={atualizando === "pedindo" || atualizando === "recarregando" ? "animate-spin" : ""} />
                {atualizando === "recarregando" ? "Atualizando…" : "Atualizar agora"}
              </button>
            </>
          )}

          {estado.tipo === "sem-ponte" && (
            <p className="flex min-w-0 flex-1 items-center gap-2 text-sm text-zinc-600">
              <Unplug size={18} className="shrink-0 text-zinc-400" />
              <span>
                <strong className="text-zinc-800">A extensão não respondeu neste navegador.</strong>{" "}
                {estado.vista
                  ? `A última vez que ela falou com a plataforma foi ${descreverRegistro(estado.vista.vistaEm)}, na versão ${estado.vista.versao}.`
                  : "Ainda não está instalada, ou está sem o endereço da plataforma nas Opções."}
              </span>
            </p>
          )}

          <a
            href="/extensao/cw-reputacao-extensao.zip"
            download
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-200 hover:bg-violet-50"
          >
            <Download size={13} /> Baixar a extensão{doZip ? ` · ${doZip.versao}` : ""}
          </a>
        </div>

        {atualizando === "pasta-velha" && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
            A pasta da extensão ainda tem a versão antiga. Com a atualização automática instalada, ela chega em até 10 minutos; sem ela, use o comando de instalar abaixo (uma vez só).
          </p>
        )}
        {atualizando === "recarregando" && (
          <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-900">
            A extensão está se recarregando e voltando às abas abertas. Esta página atualiza em instantes.
          </p>
        )}
      </SurfaceCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <SurfaceCard title="Instalar com atualização automática" description="Uma vez só por computador. Depois disso, nada para baixar.">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-700">
            <li>
              Abra o <strong>PowerShell</strong> (tecla Windows, digite PowerShell, Enter), cole o comando abaixo e aperte Enter.
              <ComandoDeInstalar />
            </li>
            <li>No Chrome, abra <code className="rounded bg-zinc-100 px-1">chrome://extensions</code> e ligue o <strong>Modo do desenvolvedor</strong>. Se houver um CW Reputação antigo, clique em <strong>Remover</strong>.</li>
            <li>Clique em <strong>Carregar sem compactação</strong> e cole o caminho que o PowerShell mostrou (ele já fica copiado).</li>
            <li>Nas <strong>Opções</strong> da extensão, confira o endereço da plataforma. Volte a esta página: o estado acima fica verde.</li>
          </ol>
        </SurfaceCard>

        <SurfaceCard title="Como ela se mantém atualizada" description="Sem baixar, sem recarregar, sem F5.">
          <ul className="space-y-2 text-sm text-zinc-700">
            <li>A cada 10 minutos o Windows confere, escondido, se saiu versão nova na plataforma. Se saiu, troca os arquivos da extensão sozinho.</li>
            <li>A extensão confere a própria pasta a cada 5 minutos. Quando ela muda, a extensão se recarrega e volta às abas abertas do WhatsApp e do Reclame Aqui.</li>
            <li>Ou seja: uma versão nova chega em até 15 minutos, sem ninguém fazer nada. O sino da plataforma avisa se alguma ficar para trás.</li>
          </ul>
        </SurfaceCard>
      </div>

      <Link
        href="/primeiro-acesso?aba=onde-fica#ext-whatsapp"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:underline"
      >
        O que a extensão faz em cada site <ArrowRight size={14} />
      </Link>
    </div>
  );
}
