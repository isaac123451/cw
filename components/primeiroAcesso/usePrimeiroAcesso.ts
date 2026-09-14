"use client";

import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/lib/context/ToastContext";

import { dispensarGuia, lerPrimeiroAcesso, marcarPassoDoGuia } from "@/lib/actions/primeiroAcesso";
import type { EstadoDoGuia } from "@/lib/models/primeiroAcesso";

/**
 * O roteiro do primeiro acesso da pessoa, com as marcas gravando no
 * servidor. O aviso de "marcado" só sai com a resposta dele; o que ele
 * recusar volta como erro, e a marca não aparece.
 */
export function usePrimeiroAcesso() {
  const { notify } = useToast();
  const [estado, setEstado] = useState<EstadoDoGuia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, setGravando] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    lerPrimeiroAcesso()
      .then((r) => {
        if (!vivo) return;
        if (r.ok) setEstado(r.estado);
        else setErro(r.erro);
      })
      .catch(() => vivo && setErro("Não foi possível ler o seu roteiro agora."));
    return () => {
      vivo = false;
    };
  }, []);

  const marcar = useCallback(
    async (id: string, feito: boolean) => {
      setGravando(id);
      try {
        const r = await marcarPassoDoGuia(id, feito);
        if (!r.ok) return notify({ tone: "error", title: "O passo não foi marcado", detail: r.erro });
        setEstado(r.estado);
        notify({ tone: "success", title: feito ? "Passo marcado" : "Marca desfeita" });
      } catch {
        notify({ tone: "error", title: "Sem resposta do servidor", detail: "O passo não foi marcado." });
      } finally {
        setGravando(null);
      }
    },
    [notify]
  );

  const dispensar = useCallback(
    async (esconder: boolean) => {
      setGravando("dispensar");
      try {
        const r = await dispensarGuia(esconder);
        if (!r.ok) return notify({ tone: "error", title: "Não foi alterado", detail: r.erro });
        setEstado(r.estado);
        notify({
          tone: "success",
          title: esconder ? "Roteiro escondido do Meu dia" : "Roteiro de volta ao Meu dia",
          detail: esconder ? "Ele continua em Conhecimento → Primeiro acesso." : undefined,
        });
      } catch {
        notify({ tone: "error", title: "Sem resposta do servidor" });
      } finally {
        setGravando(null);
      }
    },
    [notify]
  );

  return { estado, erro, gravando, marcar, dispensar };
}
