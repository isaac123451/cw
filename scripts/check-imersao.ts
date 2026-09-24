/**
 * O resumo da imersão — o que ler antes da 1ª mensagem.
 *
 *   npm run check:imersao
 *
 * Sem banco. O resumo sai do retrato (conta, outras reclamações, NPS,
 * Google, redes, conversa guardada) e não afirma o que a base não sabe.
 */
import type { RetratoDoCliente } from "../lib/actions/tratativa";
import { resumoDoCliente } from "../lib/models/resumoDoCliente";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${String(JSON.stringify(obtido)).slice(0, 40)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${String(JSON.stringify(esperado)).slice(0, 40)}`);
}

console.log("\n  RESUMO DA IMERSÃO\n");

const vazio: RetratoDoCliente = { outrasReclamacoes: [], redes: [], nps: [], google: [], conversas: { total: 0 }, faseSemCadastro: "Sem cadastro vinculado" };
const soVazio = resumoDoCliente(vazio, { createdAt: "2026-09-20" });
conferir("sem conta: pede para achar ou criar antes do contato", soVazio[0].startsWith("Sem estabelecimento vinculado"), true);
conferir("sem histórico: diz que é a primeira, e só isso", soVazio, [soVazio[0], "Primeira reclamação deste cliente na base."]);

const cheio: RetratoDoCliente = {
  estabelecimento: { id: "e1", nome: "Pizzaria Bella", slug: "pizzaria-bella", plano: "Pro", fase: "Risco de cancelamento", mrr: 249.9, desde: "2024-03-10" },
  outrasReclamacoes: [
    { protocolo: "RA-1", titulo: "Impressora não imprime pedidos no sábado à noite", status: "Resolvido", dia: "2026-08-01", nota: 8 },
    { protocolo: "RA-0", titulo: "Cobrança duplicada", status: "Resolvido", dia: "2025-11-02" },
  ],
  redes: [{ protocolo: "IG-1", titulo: "Comentário", status: "Encerrado", dia: "2026-07-01", canal: "INSTAGRAM" }],
  nps: [{ nota: 3, status: "Aberto", dia: "2026-09-12", comentario: "Suporte demora demais" }],
  google: [
    { id: "g2", estrelas: 5, status: "ok", dia: "2026-09-01", texto: "Ótimo" },
    { id: "g1", estrelas: 2, status: "ok", dia: "2026-08-20", texto: "Sistema caiu no fim de semana" },
  ],
  conversas: { total: 1, ultimaFala: { texto: "Vou cancelar se não resolverem até sexta", em: "2026-09-19T15:00:00.000Z" } },
};
const linhas = resumoDoCliente(cheio, { createdAt: "2026-09-20" });
conferir("a conta, com plano, mensalidade e desde quando", linhas[0].replace(/\s/g, " "), "Pizzaria Bella: plano Pro, R$ 249,90/mês, cliente desde 03/2024 — risco de cancelamento.");
conferir("3ª reclamação, com a reincidência nos 90 dias", linhas[1].startsWith("3ª reclamação na base (1 nos 90 dias antes desta — reincidência)"), true);
conferir("o último NPS com o comentário", linhas.includes('Último NPS: nota 3 em 12/09/2026 — "Suporte demora demais".'), true);
conferir("no Google, a avaliação ruim vem antes da boa", linhas.some((l) => l.startsWith("Google: 2★ em 20/08/2026")), true);
conferir("a última fala da conversa guardada", linhas.some((l) => l.includes('"Vou cancelar se não resolverem até sexta"')), true);
conferir("o alerta de retenção no fim", linhas[linhas.length - 1], "Atenção: risco de cancelamento — o contato é de retenção.");

console.log(falhas === 0 ? "\n  O resumo diz o que a base sabe, e nada além.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exitCode = falhas === 0 ? 0 : 1;
