import { after } from "next/server";

import { getPrisma } from "@/lib/prisma";

/**
 * A saúde da IA: a última resposta boa e o último erro, por ambiente.
 *
 * O Isaac: "verifique se o Gemini está funcionando, já adicionei a
 * chave". A resposta não pode depender de alguém rodar `check:ia` na
 * máquina certa — a chave da produção mora na Vercel. Cada chamada real
 * deixa aqui o seu rastro, e Configurações → IA mostra.
 *
 * **Não atrasa ninguém.** Grava depois da resposta (`after`), no máximo
 * uma vez por minuto por instância para o sucesso e a cada 30 s para o
 * erro. Fora de uma requisição (os scripts), não grava: o `check:ia` mede
 * a chave da máquina local, e não é isso que a tela quer dizer.
 */

let ultimoOk = 0;
let ultimoErro = 0;

export interface RegistroDaIA {
  ok: boolean;
  provedor: string;
  modelo?: string;
  ms: number;
  erro?: string;
}

export function registrarSaudeDaIA(r: RegistroDaIA) {
  const agora = Date.now();
  if (r.ok ? agora - ultimoOk < 60_000 : agora - ultimoErro < 30_000) return;
  if (r.ok) ultimoOk = agora;
  else ultimoErro = agora;

  const ambiente = process.env.VERCEL_ENV ?? "local";
  const dados = r.ok
    ? { ultimoOkEm: new Date(agora), ultimoOkProvedor: r.provedor, ultimoOkModelo: r.modelo ?? null, ultimoOkMs: r.ms, ultimoOkAmbiente: ambiente }
    : { ultimoErroEm: new Date(agora), ultimoErro: (r.erro ?? "falha sem mensagem").slice(0, 300), ultimoErroProvedor: r.provedor, ultimoErroAmbiente: ambiente };

  const gravar = async () => {
    const prisma = getPrisma();
    if (!prisma) return;
    await prisma.saudeDaIA
      .upsert({ where: { id: "unico" }, create: { id: "unico", ...dados }, update: dados })
      .catch(() => undefined);
  };

  try {
    after(gravar);
  } catch {
    /* Fora de uma requisição (script): não registra. */
  }
}

export interface SaudeDaIAView {
  ok?: { em: string; provedor: string; modelo?: string; ms?: number; ambiente?: string };
  erro?: { em: string; texto: string; provedor?: string; ambiente?: string };
}

export async function lerSaudeDaIA(): Promise<SaudeDaIAView> {
  const prisma = getPrisma();
  if (!prisma) return {};
  const s = await prisma.saudeDaIA.findUnique({ where: { id: "unico" } }).catch(() => null);
  if (!s) return {};
  return {
    ok: s.ultimoOkEm
      ? { em: s.ultimoOkEm.toISOString(), provedor: s.ultimoOkProvedor ?? "", modelo: s.ultimoOkModelo ?? undefined, ms: s.ultimoOkMs ?? undefined, ambiente: s.ultimoOkAmbiente ?? undefined }
      : undefined,
    erro: s.ultimoErroEm
      ? { em: s.ultimoErroEm.toISOString(), texto: s.ultimoErro ?? "", provedor: s.ultimoErroProvedor ?? undefined, ambiente: s.ultimoErroAmbiente ?? undefined }
      : undefined,
  };
}
