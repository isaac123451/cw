/**
 * Falar com a extensão a partir da página da plataforma.
 *
 * A leitura do Reclame Aqui é da extensão — o Cloudflare do portal barra
 * o servidor —, e o Isaac quer que ela aconteça "somente quando eu abra
 * a plataforma", mais um botão para ler na hora. A página não chama a
 * extensão diretamente (não sabe o id dela); quem escuta é o script
 * `extensao/conteudo/ponte.js`, que a extensão injeta só nas páginas da
 * plataforma e que repassa dois pedidos: ler o portal, e dizer como foi
 * a última leitura.
 *
 * Mensagens por `window.postMessage`, com um id por pedido e restritas à
 * própria origem. Sem extensão, ninguém responde, e o prazo devolve
 * `null` — que a tela trata como "extensão ausente", não como erro.
 */

/** O que o service worker guarda da última leitura. */
export interface EstadoDoVigia {
  em?: number;
  ok?: boolean;
  codigo?: string;
  erro?: string;
  criadas?: { protocolo: string; titulo: string }[];
  completadas?: number;
  naFila?: number;
  ligado?: boolean;
  emCurso?: boolean;
  /** A plataforma abriu de novo dentro do intervalo: nada foi lido agora. */
  reaproveitada?: boolean;
}

export interface RespostaDaExtensao<T> {
  ok: boolean;
  dados?: T;
  erro?: string;
  codigo?: string;
}

let contador = 0;

export function pedirAExtensao<T>(
  tipo: string,
  extra: Record<string, unknown> = {},
  prazoMs = 120_000
): Promise<RespostaDaExtensao<T> | null> {

  if (typeof window === "undefined") return Promise.resolve(null);

  contador += 1;

  const id = `cw-${Date.now()}-${contador}`;

  return new Promise((resolver) => {

    function ouvir(evento: MessageEvent) {
      if (evento.source !== window || evento.origin !== window.location.origin) {
        return;
      }

      const mensagem = evento.data as {
        de?: string;
        id?: string;
        resposta?: RespostaDaExtensao<T>;
      } | null;

      if (mensagem?.de !== "cw-extensao" || mensagem.id !== id) return;

      window.clearTimeout(relogio);
      window.removeEventListener("message", ouvir);

      resolver(
        mensagem.resposta ?? { ok: false, erro: "A extensão respondeu vazio." }
      );
    }

    const relogio = window.setTimeout(() => {
      window.removeEventListener("message", ouvir);
      resolver(null);
    }, prazoMs);

    window.addEventListener("message", ouvir);

    window.postMessage(
      { para: "cw-extensao", id, tipo, ...extra },
      window.location.origin
    );
  });
}

/**
 * A versão da extensão nesta página, ou `null` se ela não está aqui.
 *
 * Um segundo e meio basta: a ponte roda antes da página
 * (`document_start`) e responde na hora. Mais que isso seria só atrasar
 * a leitura de quem tem a extensão.
 */
export async function versaoDaExtensao(prazoMs = 1500) {
  const resposta = await pedirAExtensao<{ versao: string }>(
    "ping",
    {},
    prazoMs
  );

  return resposta?.ok ? (resposta.dados?.versao ?? null) : null;
}

/**
 * A reclamação na área da empresa do Reclame Aqui.
 *
 * É lá — e só lá — que nome, telefone, e-mail e o CPF/CNPJ do RA Forms
 * aparecem. O endereço é o que a extensão grava ao capturar; conferido
 * nas reclamações da base.
 */
export function enderecoNaAreaDaEmpresa(protocolo: string) {
  const codigo = protocolo.replace(/^RA-/, "");

  return /^[A-Za-z0-9_-]{16}$/.test(codigo)
    ? `https://www.reclameaqui.com.br/area-da-empresa/reclamacoes/${codigo}/`
    : null;
}
