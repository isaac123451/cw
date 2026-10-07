/**
 * A saúde dos dados aponta o que está errado — e só isso.
 *
 *   npm run check:saude-dos-dados
 *
 * Só leitura. (1) Casos montados à mão: cada regra acende com o defeito e
 * fica apagada com o dado certo. (2) Contra o banco: lista o que a tela
 * vai mostrar hoje — os achados da revisão de out/2026 têm de aparecer.
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { achadosDaBase, type EntradaDaSaude } from "../lib/models/saudeDosDados";
import { lerEntradaDaSaude } from "../lib/services/saudeDosDados.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(60)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(60)} ${JSON.stringify(esperado)}`);
}

const limpa: EntradaDaSaude = {
  estabelecimentos: [{ nome: "Pizzaria Boa", slug: "pizzaria-boa", plano: "Delivery", mensalidadeCentavos: 20999 }],
  planos: [
    { nome: "Delivery", precoCentavos: 20999, ativo: true, tipo: "plano" },
    { nome: "Premium", precoCentavos: 26999, ativo: true, tipo: "plano" },
  ],
  casos: [
    { id: "1", protocolo: "RA-a", canal: "RECLAME_AQUI", cliente: "Ana", titulo: "Cobrança", status: "Novo", aberto: true, dono: "Carlos Isaac", temResposta: false, respostaEm: null },
    { id: "2", protocolo: "IG-b", canal: "SOCIAL", cliente: "Janaina", titulo: "Cliente Janaina entrou em contato", status: "Recebido", aberto: true, dono: null, temResposta: false, respostaEm: null },
  ],
  etapasQueContamComoAbertas: [{ nome: "Em tratativa", casos: 4 }],
  causas: [{ nome: "Cobrança e mensalidade" }],
  tarefas: [{ id: "t", titulo: "Retorno combinado com Ana", feita: false }],
};

const chaves = (e: EntradaDaSaude) => achadosDaBase(e).map((a) => a.chave);

async function main() {
  console.log("\n  SAÚDE DOS DADOS\n");

  conferir("base limpa: nada a apontar", chaves(limpa), []);
  conferir("mensalidade ×100 acende", chaves({ ...limpa, estabelecimentos: [{ ...limpa.estabelecimentos[0], mensalidadeCentavos: 2099900 }] }), ["mensalidade"]);
  conferir("plano fora da tabela acende", chaves({ ...limpa, estabelecimentos: [{ ...limpa.estabelecimentos[0], plano: "Essencial" }] }), ["plano"]);
  conferir("plano com acento diferente não acende", chaves({ ...limpa, estabelecimentos: [{ ...limpa.estabelecimentos[0], plano: "delivery" }] }), []);
  conferir("dono de teste num caso aberto acende", chaves({ ...limpa, casos: [{ ...limpa.casos[0], dono: "Conferência" }] }), ["dono-de-teste"]);
  conferir("dono de teste num caso fechado não acende", chaves({ ...limpa, casos: [{ ...limpa.casos[0], dono: "Conferência", aberto: false }] }), []);
  conferir("menção do Slack no cliente acende", chaves({ ...limpa, casos: [{ ...limpa.casos[1], cliente: "@Carlos", titulo: "Olá @Carlos Isaac Cliente Janaina…" }] }), ["mencao"]);
  conferir("link do perfil do Slack de quem foi mencionado acende, mesmo com o título certo", chaves({ ...limpa, casos: [{ ...limpa.casos[1], link: "https://cardpioweb.slack.com/team/U07KTLG1EKB" }] }), ["mencao"]);
  conferir("link do Instagram não acende", chaves({ ...limpa, casos: [{ ...limpa.casos[1], link: "https://instagram.com/maria.doces" }] }), []);
  conferir("resposta sem data acende", chaves({ ...limpa, casos: [{ ...limpa.casos[0], temResposta: true, respostaEm: null }] }), ["resposta-sem-data"]);
  conferir("etapa \"Finalizado\" com casos acende", chaves({ ...limpa, etapasQueContamComoAbertas: [{ nome: "Finalizado", casos: 4 }] }), ["etapa-fim"]);
  conferir("etapa \"Finalizado\" vazia não acende", chaves({ ...limpa, etapasQueContamComoAbertas: [{ nome: "Finalizado", casos: 0 }] }), []);
  conferir("causa \"a\" acende", chaves({ ...limpa, causas: [{ nome: "a" }] }), ["causa-curta"]);
  conferir("tarefa com o texto do WhatsApp acende", chaves({ ...limpa, tarefas: [{ id: "t", titulo: "Retorno combinado com clique para mostrar os dados do contato", feita: false }] }), ["tarefa-texto-da-tela"]);
  const agrupado = achadosDaBase({ ...limpa, estabelecimentos: Array.from({ length: 9 }, (_, i) => ({ ...limpa.estabelecimentos[0], slug: `x${i}`, plano: "Essencial" })) })[0];
  conferir("plano agrupa: 9 contas, 1 item, nada sobrando", [agrupado.total, agrupado.itens.length, agrupado.restantes], [9, 1, 0]);

  const prisma = getPrisma();
  if (prisma) {
    console.log("\n  Na base de hoje:\n");
    const achados = achadosDaBase(await lerEntradaDaSaude(prisma));
    for (const a of achados) console.log(`  --    ${a.titulo}`);
    if (achados.length === 0) console.log("  --    nada a apontar");
  }

  console.log(falhas === 0 ? "\n  Cada regra acende com o defeito e só com ele.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
