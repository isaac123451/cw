/**
 * A busca global acha o que as pessoas digitam — e rápido?
 *
 *   npm run check:busca-global
 *
 * O campo "Buscar na plataforma..." do topo era só desenho. Agora é a
 * paleta do Ctrl+K. Este check prova a regra com dados montados e mede o
 * tempo contra um volume maior que a base real (2.000 NPS, 500 casos).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Case } from "../lib/models/case";
import type { NpsResponseView } from "../lib/models/nps";
import { buscarNaPlataforma, comoPergunta, normalizar } from "../lib/models/buscaGlobal";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)?.slice(0, 44)}`);
}

const caso = (c: Partial<Case>) => ({ id: "c", protocol: "RA-1", customer: "", source: "Reclame Aqui", status: "Novo", title: "", ...c }) as Case;
const nps = (r: Partial<NpsResponseView>) => ({ id: "n", score: 5, customer: "", status: "Novo", ...r }) as NpsResponseView;

const casos = [
  caso({ id: "a", protocol: "RA-pzSS-V59", customer: "João da Silva", company: "Pizzaria Bella", document: "123.456.789-09", phone: "(48) 99909-5712" }),
  caso({ id: "b", protocol: "RA-XY12", customer: "Maria Souza", title: "Cobrança indevida" }),
  caso({ id: "c", protocol: "SOC-1", customer: "Pedro", source: "Instagram" }),
];
const telas = [{ titulo: "Processos e SLA", href: "/processos", sinonimos: ["sla", "prazos"] }, { titulo: "Relatório do ciclo", href: "/relatorio" }];
const npsLista = [nps({ id: "n1", customer: "burguerotreslagoas" }), nps({ id: "n2", customerName: "José Prado", customer: "jprado", phone: "11987654321" })];

console.log("\n  BUSCA GLOBAL\n");

const ids = (termo: string) => buscarNaPlataforma({ termo, telas, casos, nps: npsLista }).map((r) => `${r.tipo}:${r.id}`);

conferir("acento e maiúscula não importam", ids("joao"), ["caso:a"]);
conferir("protocolo exato", ids("ra-xy12")[0], "caso:b");
conferir("CPF com ou sem pontuação", ids("12345678909"), ["caso:a"]);
conferir("final do telefone", ids("9909-5712"), ["caso:a"]);
conferir("duas palavras em campos diferentes", ids("joao bella"), ["caso:a"]);
conferir("tela pelo sinônimo", ids("sla")[0], "tela:/processos");
conferir("termo curto não acha pedaço do meio de palavra", ids("sla").includes("nps:n1"), false);
conferir("termo longo acha o meio", ids("lagoas"), ["nps:n1"]);
conferir("NPS pelo nome digitado", ids("jose"), ["nps:n2"]);
conferir("rede social vai para a ficha das Redes", buscarNaPlataforma({ termo: "pedro", casos })[0]?.href, "/redes-sociais/c");
conferir("rede social é um grupo à parte do Reclame Aqui", buscarNaPlataforma({ termo: "pedro", casos })[0]?.tipo, "rede");
conferir("caso abre em mini-janela", buscarNaPlataforma({ termo: "maria", casos })[0]?.janela?.frente, "reclame-aqui");

/* A tela desenha etiqueta e código: o modelo entrega separado, não concatenado. */
const maria = buscarNaPlataforma({ termo: "maria", casos })[0];
conferir("o nome fica sozinho no título", maria?.titulo, "Maria Souza");
conferir("o protocolo vem como marca", maria?.marca, "RA-XY12");
conferir("o status vem como etiqueta", maria?.etiqueta, "Novo");
conferir("o título da reclamação vem como detalhe", maria?.detalhe, "Cobrança indevida");
conferir("o subtítulo de uma linha continua, para os recentes já guardados", maria?.subtitulo, "Reclame Aqui · Novo · Cobrança indevida");

const jose = buscarNaPlataforma({ termo: "jose", nps: npsLista })[0];
conferir("NPS: o nome no título e a nota na marca", [jose?.titulo, jose?.marca], ["José Prado", "NPS 5"]);
conferir("nota de detrator sai em tom ruim", jose?.tom, "ruim");
conferir("nota de promotor sai em tom bom", buscarNaPlataforma({ termo: "prado", nps: [nps({ id: "n9", customerName: "Prado", score: 10 })] })[0]?.tom, "bom");
conferir("nota de passivo sai em tom de atenção", buscarNaPlataforma({ termo: "prado", nps: [nps({ id: "n8", customerName: "Prado", score: 8 })] })[0]?.tom, "atencao");
conferir("sem termo, sem resultado", ids("   "), []);
conferir("normalizar tira acento pelo \\p{M}", normalizar("Ação Técnica"), "acao tecnica");

/* "Pergunte à plataforma": o que parece pergunta leva ao assistente. */
const perg = (t: string) => comoPergunta(t);
conferir("com interrogação, vira o primeiro resultado", [perg("quantos casos estão fora do prazo?")?.pontos, perg("quantos casos estão fora do prazo?")?.href], [1000, "/assistente?pergunta=quantos%20casos%20est%C3%A3o%20fora%20do%20prazo%3F"]);
conferir("começo de pergunta também conta", perg("como está o NPS este mês")?.pontos, 1000);
conferir("três palavras sem cara de pergunta: vai para o fim", perg("joao pizzaria bella")?.pontos, 1);
conferir("nome curto não vira pergunta", perg("maria"), null);
conferir("o item diz o que vai ser perguntado", perg("qual o prazo do RA-1?")?.detalhe, '"qual o prazo do RA-1?"');

/* O tempo: acima da base real, várias teclas seguidas. */
const muitosCasos = Array.from({ length: 500 }, (_, i) => caso({ id: `m${i}`, protocol: `RA-${i}`, customer: `Cliente Número ${i}`, title: "Pedido atrasado e sem resposta", phone: `4899${String(i).padStart(7, "0")}` }));
const muitosNps = Array.from({ length: 2000 }, (_, i) => nps({ id: `p${i}`, customer: `loja${i}`, email: `loja${i}@exemplo.com`, company: `Restaurante ${i}` }));
const inicio = performance.now();
for (const t of ["c", "cl", "cli", "clie", "clien", "client", "cliente", "cliente 4", "cliente 42"]) {
  buscarNaPlataforma({ termo: t, telas, casos: muitosCasos, nps: muitosNps });
}
const porTecla = (performance.now() - inicio) / 9;
console.log(`  ${porTecla.toFixed(1)} ms por tecla com 500 casos e 2.000 NPS`);
conferir("cada tecla responde em menos de 25 ms", porTecla < 25, true);

const topo = readFileSync(resolve(__dirname, "../components/layout/Topbar.tsx"), "utf8");
conferir("o topo usa a busca (e não o campo decorativo)", /<BuscaGlobal \/>/.test(topo) && !/placeholder="Buscar na plataforma\.\.\."/.test(topo), true);

console.log(falhas === 0 ? "\n  A busca acha o que se digita, e rápido.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
