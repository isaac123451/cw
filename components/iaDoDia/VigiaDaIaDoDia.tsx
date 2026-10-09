"use client";

import { useEffect, useRef } from "react";

import { useSession } from "@/lib/context/SessionContext";
import { useToast } from "@/lib/context/ToastContext";
import { desfazerAcaoDaIA, marcarAcoesVistas, rodarAIaDoDia } from "@/lib/actions/iaDoDia";
import { VERBO_DA_ACAO, type AcaoDaIAView } from "@/lib/models/iaDoDia";

/** Avisa as outras partes da tela (o "O que eu fiz hoje" do assistente) que a IA fez algo; `detail.novas` diz quantas. */
export const EVENTO_DA_IA_DO_DIA = "cw:ia-do-dia";

/** Abre o balão do assistente numa aba: `detail.aba` é "conversa" ou "eu-fiz". */
export const EVENTO_ABRIR_ASSISTENTE = "cw:assistente:abrir";

const INTERVALO_MS = 5 * 60_000;

const verOQueFiz = () => window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_ASSISTENTE, { detail: { aba: "eu-fiz" } }));

/**
 * A IA do dia trabalhando em qualquer tela (08/10/2026).
 *
 * Ao abrir a plataforma e a cada 5 minutos, pede ao servidor a rodada
 * (lembretes, o que já foi feito, anotações das conversas, depois das
 * reuniões) e avisa, discreto, que fez — o que foi feito fica no "O que eu
 * fiz hoje" do balão do assistente, com desfazer.
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
        window.dispatchEvent(new CustomEvent(EVENTO_DA_IA_DO_DIA, { detail: { novas: r.novas.length } }));
      } catch {
        /* Sem rede agora: tenta na próxima volta. */
      } finally {
        rodando.current = false;
      }
    }

    /*
      Um aviso por rodada, na voz do assistente (09/10/2026): o que foi feito
      mora no "O que eu fiz hoje" do balão — o aviso só diz que houve e leva
      até lá. Uma coisa só ainda dá para desfazer direto do aviso.
    */
    function mostrar(novas: AcaoDaIAView[]) {
      if (novas.length === 1) {
        const a = novas[0];
        notify({
          tone: "info",
          title: `${VERBO_DA_ACAO[a.tipo]}: ${a.titulo}`.slice(0, 120),
          detail: a.detalhe?.slice(0, 200),
          acao: a.desfazivel
            ? {
                rotulo: "Desfazer",
                executar: () => {
                  void desfazerAcaoDaIA(a.id).then((r) => {
                    notify(r.ok ? { tone: "success", title: "Desfeito.", detail: a.titulo } : { tone: "error", title: "Não deu para desfazer.", detail: r.erro });
                    window.dispatchEvent(new CustomEvent(EVENTO_DA_IA_DO_DIA, { detail: { novas: 0 } }));
                  });
                },
              }
            : { rotulo: "Ver", executar: verOQueFiz },
        });
        return;
      }
      notify({
        tone: "info",
        title: `Fiz ${novas.length} coisas por você`,
        detail: novas.slice(0, 2).map((a) => `${VERBO_DA_ACAO[a.tipo]}: ${a.titulo}`).join(" · ").slice(0, 220),
        acao: { rotulo: "Ver o que fiz", executar: verOQueFiz },
      });
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
