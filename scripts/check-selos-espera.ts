/**
 * Selos na lista de conversas — a espera, as etiquetas e o que sai da página.
 *
 *   npm run check:selos-espera
 *
 * Sem navegador: roda `extensao/conteudo/selos-espera.js` numa caixa sem
 * página (só as funções puras) e confere a regra das etiquetas.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

import { chaveDoNome, chaveDoTelefone, etiquetasDasFichas } from "../lib/models/etiquetasDaLista";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(58)} ${String(JSON.stringify(obtido)).slice(0, 40)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(58)} ${String(JSON.stringify(esperado)).slice(0, 40)}`);
}

console.log("\n  SELOS NA LISTA DE CONVERSAS\n");

const codigo = readFileSync(resolve(__dirname, "../extensao/conteudo/selos-espera.js"), "utf8");
const caixa: Record<string, unknown> = { window: {}, Date };
vm.createContext(caixa);
vm.runInContext(codigo, caixa);
const s = ((caixa.window as Record<string, unknown>).CWReputacao as { selosEspera: Record<string, (...a: unknown[]) => unknown> }).selosEspera;

/* Sexta, 25/09/2026, 15:00 no relógio local da caixa. */
const agora = new Date(2026, 8, 25, 15, 0, 0);
conferir("hora de hoje: minutos exatos", s.minutosDesde("14:32", agora), 28);
conferir("hora \"depois de agora\" é de ontem", s.minutosDesde("16:10", agora), 1370);
conferir("Ontem: pelo menos um dia", s.minutosDesde("Ontem", agora), 1440);
conferir("dia da semana: segunda foi há 4 dias", s.minutosDesde("segunda-feira", agora), 4 * 1440);
conferir("data completa", s.minutosDesde("20/09/2026", agora), 5 * 1440 + 15 * 60);
conferir("texto que não é hora: nada", s.minutosDesde("digitando…", agora), null);

conferir("menos de 5 min: sem selo (conversa acontecendo)", s.seloDaEspera(3), null);
conferir("28 min: leve", s.seloDaEspera(28), { rotulo: "espera 28 min", nivel: "leve" });
conferir("1 h e meia: atenção", s.seloDaEspera(95), { rotulo: "espera 1 h e meia", nivel: "atencao" });
conferir("desde ontem", s.seloDaEspera(1440), { rotulo: "espera desde ontem", nivel: "atrasado" });

/* 1.84: só de quem não respondemos. */
conferir("\"Você: foto\" é nossa", s.previaNossa("Você: 📷 Foto"), true);
conferir("\"Você reagiu com 👍\" é nossa", s.previaNossa("Você reagiu com 👍 a \"ok\""), true);
conferir("a prévia do cliente não é nossa", s.previaNossa("Vocês abrem amanhã?"), false);
conferir("\"ok\", \"Obrigado!\", \"👍\" encerram", [s.encerrou("ok"), s.encerrou("Obrigado!"), s.encerrou("👍👍"), s.encerrou("muito obrigada :)")], [true, true, true, true]);
conferir("pergunta não encerra", s.encerrou("ok, mas e o repasse?"), false);

/* O que sai da página: só o nome e o número da lista. */
conferir("a pergunta das etiquetas leva só chave, nome e telefone", /faltam\.push\(\{ chave, nome: [^}]*telefone: [^}]*\}\)/.test(codigo), true);
conferir("a prévia não vai na pergunta", /enviar\(\{[^)]*previa/.test(codigo), false);
conferir("as etiquetas entram como texto, não HTML", [codigo.includes("pilula.textContent"), /innerHTML/.test(codigo)], [true, false]);

/* 1.84: as etiquetas. */
const q = "2026-09-20T12:00:00Z";
conferir(
  "RA Urgente + Redes + detrator",
  etiquetasDasFichas([{ tipo: "ra", prioridade: "Urgente", quando: q }, { tipo: "redes", quando: q }, { tipo: "nps", nota: 3, quando: q }]),
  [{ rotulo: "Reclame Aqui", tom: "perigo" }, { rotulo: "Redes sociais", tom: "atencao" }, { rotulo: "Detrator · NPS 3", tom: "perigo" }]
);
conferir("vale a nota mais recente do NPS", etiquetasDasFichas([{ tipo: "nps", nota: 3, quando: "2026-01-01" }, { tipo: "nps", nota: 10, quando: "2026-09-01" }]), [{ rotulo: "Promotor · NPS 10", tom: "ok" }]);
conferir("telefone: os 8 últimos dígitos; mascarado não", [chaveDoTelefone("+55 (48) 99664-0777"), chaveDoTelefone("(48) 9••••-0777")], ["96640777", null]);
conferir("nome de uma palavra não etiqueta ninguém", [chaveDoNome("João"), chaveDoNome("João da Silva")], [null, "joao da silva"]);

console.log(`\n  ${falhas === 0 ? "Tudo certo." : `${falhas} falha(s).`}\n`);
process.exit(falhas === 0 ? 0 : 1);
