/**
 * A triagem das Redes pede o que cada saída exige, e nada além?
 *
 *   npm run check:triagem-redes
 *
 * **O pedido.** "A triagem de redes sociais é confusa e precisa colocar
 * algo como resolvido." A triagem virou cinco perguntas — quem é, rede,
 * o que aconteceu, gravidade e saída —, e a saída pode encerrar: resolvido,
 * sem contato, sem identificação ou encaminhado. O que este check segura:
 *
 * 1. **cada saída pede o seu**: resolvido pede cliente identificado,
 *    validação (ou a confirmação na hora), solução e causa; sem contato,
 *    as três tentativas; encaminhado, a área; seguir não pede final;
 * 2. **a gravidade sugerida** vem da menção de risco (Urgente) e do
 *    alcance (Alta), com o motivo;
 * 3. **encaminhado é final** e não conta como resolvido em lugar nenhum;
 * 4. **o servidor confere antes de escrever**: a mesma regra da tela roda
 *    antes da primeira gravação, para uma recusa não deixar o caso pela
 *    metade.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ETAPAS_DAS_REDES,
  FINAIS_DAS_REDES,
  faltaNaTriagem,
  gravidadeSugerida,
  textoDoEncaminhamento,
  type TriagemDasRedes,
} from "../lib/models/redes";
import { CLOSED_STATUS } from "../lib/services/case.service";

const RAIZ = resolve(__dirname, "..");

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)?.slice(0, 44)}`);
}

const ler = (arquivo: string) => readFileSync(resolve(RAIZ, arquivo), "utf8");

console.log("\n  TRIAGEM DAS REDES\n");

const base: TriagemDasRedes = {
  customer: "Maria",
  socialHandle: "maria",
  followers: 300,
  naoIdentificado: false,
  source: "Instagram",
  category: "Cobrança",
  relato: "",
  prioridade: "Normal",
  saida: "segue",
  solucao: "",
  causaRaiz: "",
  clienteConfirmou: false,
  area: "",
  chamado: "",
};
const caso = { validadoEm: null, tentativasSemResposta: 0 };
const com = (t: Partial<TriagemDasRedes>) => ({ ...base, ...t });

/* ---- 1. cada saída pede o seu ---- */

conferir("seguir em atendimento não pede final", faltaNaTriagem(base, caso), []);
conferir("sem nome, pede o nome", faltaNaTriagem(com({ customer: "" }), caso).length, 1);
conferir("…ou aceita 'não se identificou'", faltaNaTriagem(com({ customer: "", naoIdentificado: true }), caso), []);
conferir("rede fora do módulo é recusada", faltaNaTriagem(com({ source: "Reclame Aqui" }), caso).length, 1);
conferir("sem assunto, pede o assunto", faltaNaTriagem(com({ category: " " }), caso).length, 1);

conferir("resolvido vazio pede validação, solução e causa", faltaNaTriagem(com({ saida: "Resolvido" }), caso).length, 3);
conferir(
  "resolvido com a confirmação na hora passa",
  faltaNaTriagem(com({ saida: "Resolvido", clienteConfirmou: true, solucao: "Estorno feito no mesmo dia", causaRaiz: "Cobrança" }), caso),
  []
);
conferir(
  "validação já registrada dispensa a confirmação",
  faltaNaTriagem(com({ saida: "Resolvido", solucao: "Estorno feito no mesmo dia", causaRaiz: "Cobrança" }), { validadoEm: "2026-09-17T12:00:00Z", tentativasSemResposta: 0 }),
  []
);
conferir(
  "resolvido não aceita cliente não identificado",
  faltaNaTriagem(com({ saida: "Resolvido", naoIdentificado: true, customer: "", clienteConfirmou: true, solucao: "Estorno feito no mesmo dia", causaRaiz: "Cobrança" }), caso).length,
  1
);
conferir("sem contato com 1 tentativa pede mais 2", faltaNaTriagem(com({ saida: "Sem contato" }), { validadoEm: null, tentativasSemResposta: 1 })[0], "fazer mais 2 tentativa(s) de contato — hoje são 1");
conferir("sem contato com 3 tentativas passa", faltaNaTriagem(com({ saida: "Sem contato" }), { validadoEm: null, tentativasSemResposta: 3 }), []);
conferir("sem identificação não pede nada a mais", faltaNaTriagem(com({ saida: "Sem identificação", naoIdentificado: true, customer: "" }), caso), []);
conferir("encaminhado pede a área", faltaNaTriagem(com({ saida: "Encaminhado" }), caso), ["dizer para qual área foi"]);
conferir("o texto do encaminhamento", textoDoEncaminhamento("Financeiro", "1234", "estorno em análise"), "Encaminhado para Financeiro (chamado 1234). estorno em análise");

/* ---- 2. gravidade sugerida ---- */

conferir("menção a Procon sugere Urgente", gravidadeSugerida([{ motivo: "menciona órgão de defesa do consumidor" }], 200).nivel, "Urgente");
conferir("só o alcance sugere Alta", gravidadeSugerida([{ motivo: "perfil com 18.400 seguidores" }], 18400).nivel, "Alta");
conferir("sem sinal, Normal com o motivo", gravidadeSugerida([], 100), { nivel: "Normal", motivo: "sem sinal de crise nem perfil de grande alcance" });

/* ---- 3. encaminhado é final ---- */

conferir("Encaminhado é etapa final", FINAIS_DAS_REDES.includes("Encaminhado"), true);
conferir("e não conta como resolvido", ETAPAS_DAS_REDES.find((e) => e.nome === "Encaminhado")?.resolvido, undefined);
conferir("sai da fila aberta", CLOSED_STATUS.includes("Encaminhado"), true);
conferir("o encerramento pela janela também aceita", /resultado === "Encaminhado" && solucao\.length < 8/.test(ler("lib/actions/redes.ts")), true);

/* ---- 4. o servidor ---- */

const acao = ler("lib/actions/redes.ts");
const corpo = acao.slice(acao.indexOf("export async function triarAtendimento"));
conferir("confere a regra antes da primeira escrita", corpo.indexOf("faltaNaTriagem(") > 0 && corpo.indexOf("faltaNaTriagem(") < corpo.indexOf("prisma.case.update"), true);
conferir("recusa caso já encerrado", corpo.includes("Reabra antes de triar de novo"), true);
conferir("carimba quem triou pela mesma triagem do RA", corpo.includes("await triar("), true);
conferir("a tela só diz salvo com a resposta", /const r = await triarAtendimento[\s\S]{0,120}if \(!r\.ok\)/.test(ler("components/redes-sociais/TriagemDasRedes.tsx")), true);
conferir("sem triagem, a triagem ocupa o lugar dos passos", ler("components/redes-sociais/TrilhaDasRedes.tsx").includes("!final && (!data.triadaEm || refazendo)"), true);

console.log(falhas === 0 ? "\n  A triagem das Redes pede o que cada saída exige.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
