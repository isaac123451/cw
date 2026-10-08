"use client";

import { useEffect, useRef } from "react";

import { useSession } from "@/lib/context/SessionContext";
import { useToast } from "@/lib/context/ToastContext";
import { desfazerAcaoDaIA, marcarAcoesVistas, rodarAIaDoDia } from "@/lib/actions/iaDoDia";
import { ROTULO_DA_ACAO, type AcaoDaIAView } from "@/lib/models/iaDoDia";

/** Avisa as outras partes da tela (a lista do Meu dia) que a IA fez algo. */
export const EVENTO_DA_IA_DO_DIA = "cw:ia-do-dia";

const INTERVALO_MS = 5 * 60_000;
/** Mais que isso de uma vez vira um aviso só, para não cobrir a tela. */
const AVISOS_SOLTOS = 3;

/**
 * A IA do dia trabalhando em qualquer tela (08/10/2026).
 *
 * Ao abrir a plataforma e a cada 5 minutos, pede ao servidor a rodada
 * (lembretes, o que já foi feito, anotações das conversas, depois das
 * reuniões) e mostra o que ela fez — cada coisa num aviso discreto com
 * "Desfazer", como ele pediu: "age e avisa, com desfazer".
 */
export default function VigiaDaIaDoDia() {
  const sessao = useSession();
  const { notify } = useToast();
  const rodando = useRef(false);

  useEffect(() => {
    if (!sessao) return;
    let ativo = true;

    async function rodar() {
      if (rodando.current || document.visibilityState !== "visible") return;
      rodando.current = true;
      try {
        const r = await rodarAIaDoDia();
        if (!ativo || !r.ok || !r.novas.length) return;
        mostrar(r.novas);
        await marcarAcoesVistas(r.novas.map((a) => a.id));
        window.dispatchEvent(new Event(EVENTO_DA_IA_DO_DIA));
      } catch {
        /* Sem rede agora: tenta na próxima volta. */
      } finally {
        rodando.current = false;
      }
    }

    function mostrar(novas: AcaoDaIAView[]) {
      if (novas.length > AVISOS_SOLTOS) {
        notify({
          tone: "info",
          title: `A IA fez ${novas.length} coisas por você`,
          detail: novas.slice(0, 3).map((a) => `${ROTULO_DA_ACAO[a.tipo]}: ${a.titulo}`).join(" · "),
          href: "/meu-dia#ia-do-dia",
          hrefLabel: "Ver e desfazer no Meu dia",
        });
        return;
      }
      for (const a of novas) {
        notify({
          tone: "info",
          title: `${ROTULO_DA_ACAO[a.tipo]} pela IA`,
          detail: [a.titulo, a.detalhe].filter(Boolean).join(" — ").slice(0, 220),
          href: a.href,
          hrefLabel: "Abrir",
          acao: a.desfazivel
            ? {
                rotulo: "Desfazer",
                executar: () => {
                  void desfazerAcaoDaIA(a.id).then((r) => {
                    notify(r.ok ? { tone: "success", title: "Desfeito.", detail: a.titulo } : { tone: "error", title: "Não deu para desfazer.", detail: r.erro });
                    window.dispatchEvent(new Event(EVENTO_DA_IA_DO_DIA));
                  });
                },
              }
            : undefined,
        });
      }
    }

    /* Um instante depois de abrir: a tela carrega primeiro. */
    const primeira = window.setTimeout(rodar, 8_000);
    const relogio = window.setInterval(rodar, INTERVALO_MS);
    const aoVoltar = () => document.visibilityState === "visible" && void rodar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      ativo = false;
      window.clearTimeout(primeira);
      window.clearInterval(relogio);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [sessao, notify]);

  return null;
}
