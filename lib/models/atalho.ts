/**
 * Um atalho de Ferramentas e Acessos.
 *
 * A página e o popup da extensão leem a mesma lista. O endereço pode
 * ficar vazio — o documento diz "link fornecido pela gestão" para o
 * HugMe, o Wootric e o CW Engine — e a tela oferece configurar.
 */
export interface Atalho {
  id: string;
  chave: string;
  nome: string;
  url: string;
  grupo: "ferramenta" | "planilha";
  descricao: string;
  acesso: string;
  ordem: number;
  ativo: boolean;
  atualizadoPor?: string;
  atualizadoEm: string;
}

/**
 * O endereço aceito: http(s) ou um caminho da própria plataforma
 * ("/relatorio"). Nada de `javascript:` ou `data:` — o link vira `href`
 * aqui e no popup da extensão.
 */
export function enderecoValido(url: string) {
  const u = url.trim();
  if (!u) return true;
  if (/^\/(?!\/)/.test(u)) return true;
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:";
  } catch {
    return false;
  }
}

/** "www.hugme.com.br" vira "https://www.hugme.com.br" — ninguém cola o esquema. */
export function normalizarEndereco(url: string) {
  const u = url.trim();
  if (!u || u.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(u)) return u;
  return `https://${u}`;
}

/** O domínio, para o cartão: "portal.cardapioweb.com". */
export function dominioDe(url: string) {
  if (!url) return "";
  if (url.startsWith("/")) return "nesta plataforma";
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** A chave de um atalho criado à mão: do nome, sem acento. */
export function chaveDoNome(nome: string) {
  return (
    nome
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "atalho"
  );
}
