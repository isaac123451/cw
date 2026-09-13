/**
 * Prova da causa raiz somada nas quatro frentes — `lib/models/causaRaiz.ts`.
 *
 * Sem banco. A soma por frente, a janela, o nome com caixa e espaço
 * diferentes contando como a mesma causa, a reincidência de 3 em 30 dias
 * (somando canais, e não por canal) e a marca do item em Projetos, uma
 * por causa e por mês de Brasília.
 *
 *   npm run check:causa-raiz
 */
import {
  origemDaReincidencia,
  reincidenciasCruzadas,
  tendenciaCruzada,
  type RegistroDeCausa,
} from "../lib/models/causaRaiz";
import { instanteDe } from "../lib/services/horasUteis";

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

const r = (frente: RegistroDeCausa["frente"], causa: string, em: string): RegistroDeCausa => ({ frente, causa, em: br(em), rotulo: `${frente} ${causa}` });

const agora = new Date(br("2026-09-14 12:00"));

const registros = [
  r("Reclame Aqui", "Cobrança", "2026-09-10 10:00"),
  r("NPS", "cobrança ", "2026-09-11 10:00"),
  r("Google", "Cobrança", "2026-09-12 10:00"),
  r("Redes Sociais", "Bug", "2026-09-13 10:00"),
  r("Reclame Aqui", "Bug", "2026-07-01 10:00"),
  r("NPS", "Bug", "2026-03-01 10:00"),
  r("NPS", "Atendimento", "2026-09-20 10:00"),
];

console.log("\n— Tendência somada —");
const t90 = tendenciaCruzada(registros, { agora, dias: 90 });
confere("Cobrança soma as três frentes, com o nome normalizado", t90[0], {
  causa: "Cobrança",
  total: 3,
  porFrente: { "Reclame Aqui": 1, "Redes Sociais": 0, NPS: 1, Google: 1 },
  ultimos30: 3,
});
confere("Bug: o de março fica fora dos 90 dias; o de julho entra, mas não nos últimos 30", t90[1], {
  causa: "Bug",
  total: 2,
  porFrente: { "Reclame Aqui": 1, "Redes Sociais": 1, NPS: 0, Google: 0 },
  ultimos30: 1,
});
confere("registro no futuro não conta", t90.some((l) => l.causa === "Atendimento"), false);
confere("janela de 240 dias alcança março", tendenciaCruzada(registros, { agora, dias: 240 }).find((l) => l.causa === "Bug")?.total, 3);

console.log("\n— Reincidência: 3 em 30 dias, somando canais —");
const rein = reincidenciasCruzadas(registros, agora);
confere("só Cobrança passa (uma em cada canal, três no total)", rein.map((x) => [x.causa, x.registros.length, x.frentes]), [["Cobrança", 3, ["Reclame Aqui", "NPS", "Google"]]]);
confere("o mais recente primeiro na lista do item", rein[0].registros.map((x) => x.frente), ["Google", "NPS", "Reclame Aqui"]);
confere("duas não é reincidência", reincidenciasCruzadas(registros.slice(0, 2), agora), []);

console.log("\n— A marca do item em Projetos —");
confere("uma por causa e por mês", origemDaReincidencia("Expectativa não atendida", agora), "reincidencia:expectativa-nao-atendida:2026-09");
confere("o mês é o de Brasília: 30/09 às 22h ainda é setembro", origemDaReincidencia("Bug", new Date(br("2026-09-30 22:00"))), "reincidencia:bug:2026-09");
confere("caixa e espaço não criam outra marca", origemDaReincidencia(" COBRANÇA ", agora), origemDaReincidencia("Cobrança", agora));

console.log(falhas === 0 ? "\nTudo certo.\n" : `\n${falhas} falha(s).\n`);
process.exit(falhas === 0 ? 0 : 1);
