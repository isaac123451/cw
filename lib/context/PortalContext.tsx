"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useCases } from "@/lib/context/CaseContext";
import { useSession } from "@/lib/context/SessionContext";
import { useToast } from "@/lib/context/ToastContext";

import {
  type EstadoDoVigia,
  pedirAExtensao,
  versaoDaExtensao,
} from "@/lib/extensao/ponte";

/**
 * A leitura do Reclame Aqui, vista da plataforma.
 *
 * **O pedido.** "Preciso que você só verifique a página do Reclame Aqui
 * da Cardápio somente quando eu abra a plataforma, crie um botão de
 * atualizar/leitura." Duas portas, e só elas:
 *
 * 1. **Ao abrir a plataforma**, uma vez por carregamento. A extensão
 *    reaproveita a última leitura se ela tem menos de dez minutos — um
 *    F5 ou uma segunda aba não viram leitura nova.
 * 2. **O botão** "Ler o Reclame Aqui", na barra do quadro, que sempre lê.
 *
 * Quem lê é a extensão, pela ponte (`lib/extensao/ponte.ts`); aqui fica o
 * que a tela precisa: se a extensão está nesta página, o que aconteceu
 * na última leitura, e o aviso quando entram reclamações — que chegam
 * sem os dados do consumidor, e por isso o aviso já diz o que fazer.
 */

type Extensao = "procurando" | "ausente" | "presente";

interface PortalContextType {
  extensao: Extensao;
  versao: string | null;
  /** A última leitura, como a extensão guardou. */
  estado: EstadoDoVigia | null;
  lendo: boolean;
  /** Lê agora — o botão. */
  ler: () => Promise<void>;
}

const PortalContext = createContext<PortalContextType | null>(null);

export function PortalProvider({ children }: { children: ReactNode }) {

  const sessao = useSession();
  const { recarregar } = useCases();
  const { notify } = useToast();

  const [extensao, setExtensao] = useState<Extensao>("procurando");
  const [versao, setVersao] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoDoVigia | null>(null);
  const [lendo, setLendo] = useState(false);

  /* Uma leitura por vez, mesmo com dois cliques rápidos. */
  const emCurso = useRef(false);

  const lerPeloMotivo = useCallback(
    async (motivo: "plataforma" | "manual") => {

      if (emCurso.current) return;
      emCurso.current = true;
      setLendo(true);

      try {
        const resposta = await pedirAExtensao<EstadoDoVigia>(
          "vigiaAgora",
          { motivo }
        );

        if (!resposta) {
          setEstado({
            ok: false,
            codigo: "sem-resposta",
            erro: "A extensão não respondeu. Recarregue a extensão e atualize esta página.",
          });

          if (motivo === "manual") {
            notify({
              tone: "error",
              title: "A extensão não respondeu.",
              detail: "Recarregue a extensão em chrome://extensions e atualize esta página.",
            });
          }

          return;
        }

        const lido: EstadoDoVigia = resposta.ok
          ? (resposta.dados ?? {})
          : { ok: false, codigo: resposta.codigo, erro: resposta.erro };

        setEstado(lido);

        if (lido.ok === false) {
          /* Ao abrir, o problema fica no botão; no clique, vira aviso. */
          if (motivo === "manual") {
            notify({
              tone: "error",
              title: "Não deu para ler o Reclame Aqui.",
              detail: lido.erro,
            });
          }
          return;
        }

        const novas = lido.reaproveitada ? 0 : (lido.criadas?.length ?? 0);
        const completadas = lido.reaproveitada ? 0 : (lido.completadas ?? 0);

        if (novas > 0 || completadas > 0) {
          await recarregar();
        }

        if (novas > 0) {
          notify({
            tone: "success",
            title:
              novas === 1
                ? "1 reclamação nova do Reclame Aqui"
                : `${novas} reclamações novas do Reclame Aqui`,
            detail:
              "Entraram na coluna Novo sem os dados do consumidor — o portal não os mostra em público. Use “Completar” no quadro.",
            href: "/reclame-aqui",
            hrefLabel: "Ver no quadro",
          });
        } else if (motivo === "manual") {
          notify({
            tone: "info",
            title: "Nada novo no Reclame Aqui.",
            detail:
              completadas > 0
                ? `${completadas} reclamação(ões) completada(s) com o que o portal mostra.`
                : "Todas as reclamações do portal já estão no quadro.",
          });
        }
      } finally {
        emCurso.current = false;
        setLendo(false);
      }
    },
    [notify, recarregar]
  );

  const ler = useCallback(() => lerPeloMotivo("manual"), [lerPeloMotivo]);

  /**
   * Ao abrir a plataforma: acha a extensão e lê.
   *
   * Só com sessão — a tela de login também é "a plataforma aberta", e
   * ler dali gravaria em nome de ninguém (o servidor recusaria).
   */
  const iniciado = useRef(false);

  useEffect(() => {

    if (!sessao || iniciado.current) return;

    iniciado.current = true;

    let ativo = true;

    versaoDaExtensao().then((encontrada) => {

      if (!ativo) return;

      setVersao(encontrada);
      setExtensao(encontrada ? "presente" : "ausente");

      if (encontrada) lerPeloMotivo("plataforma");
    });

    return () => {
      ativo = false;
    };

  }, [sessao, lerPeloMotivo]);

  /*
    A extensão chegou depois da página — instalada ou recarregada com a
    plataforma aberta. A ponte avisa que está pronta, e a presença muda
    sem precisar de F5.
  */
  useEffect(() => {

    function pronta(evento: MessageEvent) {
      if (evento.source !== window || evento.origin !== window.location.origin) {
        return;
      }

      const mensagem = evento.data as { de?: string; tipo?: string; versao?: string } | null;

      if (mensagem?.de === "cw-extensao" && mensagem.tipo === "pronta") {
        setVersao(mensagem.versao ?? null);
        setExtensao("presente");
      }
    }

    window.addEventListener("message", pronta);

    return () => window.removeEventListener("message", pronta);

  }, []);

  return (
    <PortalContext.Provider
      value={{ extensao, versao, estado, lendo, ler }}
    >
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const contexto = useContext(PortalContext);

  if (!contexto) {
    throw new Error("usePortal precisa de PortalProvider.");
  }

  return contexto;
}
