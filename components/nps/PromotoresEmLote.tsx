"use client";

import { useMemo, useState } from "react";

import DispararEmLote, { type CandidatoAoDisparo } from "@/components/disparos/DispararEmLote";

import { useMacros } from "@/lib/context/MacrosContext";
import { useSession } from "@/lib/context/SessionContext";
import { pedidoDoModelo, telefoneDoDisparo } from "@/lib/models/disparos";
import { isEncerrado, nomeDoCliente, type NpsResponseView } from "@/lib/models/nps";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

/**
 * O 1º contato com os promotores, em lote (04/11/2026).
 *
 * Em novembro eram 681 promotores abertos sem 1º contato, todos com
 * telefone e nenhum com tentativa: no ritmo do plano de recuperação, um
 * mês de fila. Aqui a fila vira lista de disparo pelo WhatsApp Web, com
 * um dos modelos de promotor (depoimento, indicação…) já preenchido com o
 * nome e a nota de cada um. É o mesmo disparo seguro do pedir avaliação:
 * lotes de 10, uma conversa a cada ~40 s, quem aperta Enter é você. Cada
 * envio vira a tentativa do ciclo e marca o que o modelo pediu.
 */
export default function PromotoresEmLote({ respostas }: { respostas: NpsResponseView[] }) {
  const { macros } = useMacros();
  const session = useSession();

  /* Os modelos de promotor que existem em Respostas prontas. */
  const modelos = useMemo(
    () => macros.filter((m) => /promotor/i.test(m.title) && m.channel !== "Reclame Aqui"),
    [macros]
  );
  const [escolhido, setEscolhido] = useState<string>("");
  const modelo = modelos.find((m) => m.id === escolhido) ?? modelos[0];

  /* Abertos, sem 1º contato, com telefone; os mais antigos primeiro — são os que já passaram do prazo. */
  const fila = useMemo(
    () =>
      respostas
        .filter((r) => r.score >= 9 && !r.firstContactAt && !r.closedAt && !isEncerrado(r.status) && telefoneDoDisparo(r.phone ?? ""))
        .sort((a, b) => a.respondedAt.localeCompare(b.respondedAt)),
    [respostas]
  );

  if (fila.length === 0) return null;

  const primeiroNome = (texto: string) => {
    const t = texto.trim();
    /* Nome de verdade, e não o pedaço do e-mail ("joao.silva"). */
    if (!t || /[@._0-9]/.test(t)) return "";
    return t.split(/\s+/)[0];
  };
  const preencher = (corpo: string, r: NpsResponseView) => {
    const nome = primeiroNome(r.customerName ?? "");
    return corpo
      .replace(/,?\s*\[NOME\]/g, nome ? `, ${nome}` : "")
      .replace(/\{\{cliente\}\}/g, nome || "tudo bem")
      .replace(/\[NOTA\]/g, String(r.score))
      .replace(/\[SEU NOME\]/g, session?.name?.split(" ")[0] ?? "a equipe")
      .replace(/\{\{agente\}\}/g, session?.name?.split(" ")[0] ?? "a equipe")
      .trim();
  };

  const pedido = modelo ? pedidoDoModelo(modelo.title) : "contato";
  const candidatos: CandidatoAoDisparo[] = modelo
    ? fila.map((r) => ({
        chave: r.id,
        nome: nomeDoCliente(r),
        telefone: telefoneDoDisparo(r.phone ?? "")!,
        mensagem: preencher(modelo.body, r),
        ref: `nps:${r.id}:${pedido}`,
        motivo: `nota ${r.score}${r.comment.trim() ? " · com comentário" : ""}`,
      }))
    : [];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
        <span>
          <strong className="font-semibold text-zinc-800">{fila.length} promotores</strong> esperando o 1º contato. Modelo:
        </span>
        {modelos.length > 0 ? (
          <select
            value={modelo?.id ?? ""}
            onChange={(e) => setEscolhido(e.target.value)}
            aria-label="Modelo da mensagem para os promotores"
            className="h-7 rounded-lg border border-zinc-200 bg-white px-2 text-xs outline-none focus:border-violet-400"
          >
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title.replace(/^NPS\s*[—-]\s*/i, "")}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-amber-700">nenhum modelo de promotor em Respostas prontas — crie um com &ldquo;promotor&rdquo; no título.</span>
        )}
      </div>
      {modelo && (
        <DispararEmLote
          key={modelo.id}
          nome={`NPS · promotores · ${hojeNaOperacao().split("-").reverse().join("/")}`}
          origem="nps"
          candidatos={candidatos}
        />
      )}
    </div>
  );
}
