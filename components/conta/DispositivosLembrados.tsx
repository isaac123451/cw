"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { Loader2, Monitor } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import { useToast } from "@/lib/context/ToastContext";
import {
  esquecerDispositivo,
  esquecerTodosOsDispositivos,
  listarMeusDispositivos,
  type DispositivoLembrado,
} from "@/lib/actions/dispositivos";

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

/**
 * Os navegadores que dispensam o código (1.120), em Minha conta → Senha.
 *
 * Lista curta, uma linha por dispositivo; esquecer pede confirmação na
 * própria linha e só avisa depois de o servidor gravar.
 */
export default function DispositivosLembrados({ hasDatabase }: { hasDatabase: boolean }) {
  const { notify } = useToast();
  const [lista, setLista] = useState<DispositivoLembrado[] | null>(null);
  const [erro, setErro] = useState("");
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [gravando, startGravar] = useTransition();

  const ler = useCallback(async () => {
    const r = await listarMeusDispositivos();
    if (r.ok) {
      setLista(r.dispositivos);
      setErro("");
    } else setErro(r.erro);
  }, []);

  useEffect(() => {
    if (!hasDatabase) return;
    let vivo = true;
    listarMeusDispositivos().then((r) => {
      if (!vivo) return;
      if (r.ok) setLista(r.dispositivos);
      else setErro(r.erro);
    });
    return () => {
      vivo = false;
    };
  }, [hasDatabase]);

  const esquecer = (id: string) =>
    startGravar(async () => {
      const r = id === "todos" ? await esquecerTodosOsDispositivos() : await esquecerDispositivo(id);
      setConfirmando(null);
      if (r.erro) {
        notify({ tone: "error", title: "Não foi possível esquecer.", detail: r.erro });
        return;
      }
      notify({
        tone: "success",
        title: id === "todos" ? "Dispositivos esquecidos." : "Dispositivo esquecido.",
        detail: "O próximo login neles volta a pedir o código.",
      });
      await ler();
    });

  return (
    <SurfaceCard
      title="Dispositivos lembrados"
      description="Navegadores em que você marcou “lembrar este dispositivo”: neles o login pede só a senha, sem o código."
      hint="Trocar a senha esquece todos. Esqueça um dispositivo que não é mais seu ou que você não reconhece."
    >
      {!hasDatabase ? (
        <p className="text-sm text-zinc-500">Sem banco configurado.</p>
      ) : erro ? (
        <p className="text-sm text-amber-700">{erro}</p>
      ) : lista === null ? (
        <p className="flex items-center gap-2 py-3 text-sm text-zinc-400">
          <Loader2 size={14} className="animate-spin" />
          Carregando…
        </p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Nenhum dispositivo lembrado. Na próxima vez que digitar o código, marque &ldquo;lembrar este dispositivo&rdquo; para não precisar dele nesse navegador.
        </p>
      ) : (
        <div className="space-y-3">
          <ul className="divide-y divide-zinc-100 rounded-xl ring-1 ring-inset ring-zinc-200">
            {lista.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Monitor size={16} className="shrink-0 text-zinc-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900">
                      {d.nome}
                      {d.este && <span className="ml-2 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">este navegador</span>}
                    </p>
                    <p className="text-xs tabular-nums text-zinc-500">
                      Último uso {quando(d.ultimoUsoEm)} · vale até {dia(d.validoAte)}
                    </p>
                  </div>
                </div>
                {confirmando === d.id ? (
                  <span className="flex items-center gap-2 text-sm">
                    <span className="text-zinc-600">Esquecer?</span>
                    <button
                      type="button"
                      disabled={gravando}
                      onClick={() => esquecer(d.id)}
                      className="flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                      {gravando && <Loader2 size={12} className="animate-spin" />}
                      Sim
                    </button>
                    <button type="button" onClick={() => setConfirmando(null)} className="text-xs text-zinc-500 hover:text-zinc-800">
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmando(d.id)}
                    className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-900"
                  >
                    Esquecer
                  </button>
                )}
              </li>
            ))}
          </ul>
          {lista.length > 1 && (
            <div className="flex justify-end">
              {confirmando === "todos" ? (
                <span className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-600">Esquecer os {lista.length}?</span>
                  <button
                    type="button"
                    disabled={gravando}
                    onClick={() => esquecer("todos")}
                    className="flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    {gravando && <Loader2 size={12} className="animate-spin" />}
                    Sim
                  </button>
                  <button type="button" onClick={() => setConfirmando(null)} className="text-xs text-zinc-500 hover:text-zinc-800">
                    Cancelar
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmando("todos")} className="text-xs font-medium text-rose-700 hover:text-rose-800">
                  Esquecer todos
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </SurfaceCard>
  );
}
