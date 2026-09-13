/**
 * Prova das regras das Redes Sociais — `lib/models/redes.ts`.
 *
 * Sem banco. A cadência das três tentativas com datas reais (e fim de
 * semana no meio), os sinais de crise do documento, e as etapas: o que
 * conta como aberto, o que conta como resolvido, e o "Novo" antigo lido
 * como "Recebido".
 *
 *   npm run check:redes
 */
import type { Case } from "../lib/models/case";
import type { ContatoView } from "../lib/models/tratativa";
import {
  cadenciaDasRedes,
  eFinalDasRedes,
  etapaDasRedes,
  sinaisDeCrise,
} from "../lib/models/redes";
import { isOpen } from "../lib/services/case.service";
import { descreverRegistro, instanteDe } from "../lib/services/horasUteis";

let falhas = 0;

function confere(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`${ok ? "ok  " : "FALHOU"}  ${nome}${ok ? "" : `\n        esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`}`);
}

function br(texto: string) {
  const [dia, hora] = texto.split(" ");
  const [h, m] = hora.split(":").map(Number);
  return instanteDe(dia, h * 60 + m).toISOString();
}

const t = (em: string, resultado: ContatoView["resultado"] = "nao-atendeu"): Pick<ContatoView, "tipo" | "resultado" | "em"> => ({
  tipo: "tentativa",
  resultado,
  em: br(em),
});

console.log("\n— As três tentativas —");
confere("sem tentativa, nada a fazer", cadenciaDasRedes([]).tentativas, 0);
const uma = cadenciaDasRedes([t("2026-09-14 10:00")]);
confere("a 1ª no 1º contato: a 2ª vence em 24h úteis", [uma.tentativas, uma.proxima?.numero, descreverRegistro(uma.proxima?.ate)], [1, 2, "15/09 10:00"]);
const sexta = cadenciaDasRedes([t("2026-09-18 16:00")]);
confere("1ª na sexta à tarde: a 2ª vence na segunda, mesma hora", descreverRegistro(sexta.proxima?.ate), "21/09 16:00");
const duas = cadenciaDasRedes([t("2026-09-14 10:00"), t("2026-09-15 09:00")]);
confere("depois da 2ª, a 3ª vence 48h úteis depois da 1ª, por canal alternativo", [duas.proxima?.numero, descreverRegistro(duas.proxima?.ate), duas.proxima?.canal.startsWith("canal alternativo")], [3, "16/09 10:00", true]);
confere("três sem resposta: esgotada", cadenciaDasRedes([t("2026-09-14 10:00"), t("2026-09-15 09:00"), t("2026-09-16 09:00")]).esgotada, true);
confere(
  "a resposta do cliente zera a contagem",
  cadenciaDasRedes([t("2026-09-14 10:00"), t("2026-09-14 15:00", "respondeu"), t("2026-09-15 09:00")]).tentativas,
  1
);

console.log("\n— Sinais de crise —");
const base: Case = {
  id: "s1", protocol: "s1", company: "", customer: "Ana", source: "Instagram", category: "Pagamento", priority: "Alta",
  status: "Recebido", title: "Não consigo receber pelo Pix", description: "", resolved: false, wouldDoBusiness: false, sla: "",
  createdAt: "2026-09-14", recebidaEm: br("2026-09-14 09:00"),
};
const agora = new Date(br("2026-09-14 12:00"));
confere("caso comum: nenhum sinal", sinaisDeCrise(base, [], agora), []);
confere("perfil grande", sinaisDeCrise({ ...base, followers: 25000 }, [], agora).map((s) => s.motivo), ["perfil com 25.000 seguidores"]);
confere("menção ao Procon", sinaisDeCrise({ ...base, description: "vou no PROCON amanhã" }, [], agora).map((s) => s.motivo), ["menciona órgão de defesa do consumidor"]);
confere("menção a processo", sinaisDeCrise({ ...base, description: "meu advogado vai entrar com processo" }, [], agora).map((s) => s.motivo), ["menciona ação judicial"]);
confere("menção à imprensa", sinaisDeCrise({ ...base, title: "Vou mandar para a imprensa" }, [], agora).map((s) => s.motivo), ["menciona imprensa"]);
const outros = [
  { id: "a", category: "Pagamento", createdAt: "2026-09-13", recebidaEm: br("2026-09-13 15:00") },
  { id: "b", category: "Pagamento", createdAt: "2026-09-14", recebidaEm: br("2026-09-14 08:00") },
  { id: "c", category: "Pagamento", createdAt: "2026-09-01", recebidaEm: br("2026-09-01 08:00") },
  { id: "d", category: "Entrega", createdAt: "2026-09-14", recebidaEm: br("2026-09-14 08:00") },
];
confere("três da mesma falha em 48h", sinaisDeCrise(base, outros, agora).map((s) => s.motivo), ['3 casos de "Pagamento" nas últimas 48h']);
confere("a antiga e a de outra categoria não contam", sinaisDeCrise(base, outros.filter((o) => o.id !== "b"), agora), []);

console.log("\n— As etapas —");
confere("Novo das etapas antigas é Recebido", etapaDasRedes("Novo")?.nome, "Recebido");
confere("os três finais", ["Resolvido", "Sem contato", "Sem identificação", "Validação"].map(eFinalDasRedes), [true, true, true, false]);
confere(
  "sem contato e sem identificação fecham o caso, validação não",
  ["Sem contato", "Sem identificação", "Validação", "Em tratativa"].map((status) => isOpen({ ...base, status })),
  [false, false, true, true]
);

console.log(falhas === 0 ? "\nTudo certo.\n" : `\n${falhas} falha(s).\n`);
process.exit(falhas === 0 ? 0 : 1);
