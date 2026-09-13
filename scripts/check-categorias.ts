/**
 * Prova da sugestão de unificação — `lib/models/categorias.ts`.
 *
 * Sem banco: os nomes e as contagens são os da base em 13/09/2026, que
 * é onde a ferramenta precisa acertar. Cada grupo esperado é o que uma
 * pessoa juntaria olhando a lista; e o que não pode juntar ("Cliente
 * Final" com "Atendimento", "Outros" com qualquer coisa) também é
 * conferido.
 *
 *   npm run check:categorias
 */
import {
  palavrasDaCategoria,
  previaDaUnificacao,
  sugerirGrupos,
  type CategoriaContada,
} from "../lib/models/categorias";

let falhas = 0;

function confere(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`${ok ? "ok  " : "FALHOU"}  ${nome}${ok ? "" : `\n        esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`}`);
}

const base: [string, number][] = [
  ["Atendimento", 150],
  ["Financeiro E Cobranças", 46],
  ["Financeiro", 35],
  ["Qualidade Do Atendimento", 31],
  ["Limitação No Sistema / Produto", 29],
  ["Sistema", 14],
  ["Implantação", 11],
  ["Configurações E Uso Do Sistema", 7],
  ["Confiabilidade Operacional", 6],
  ["Financeiro E Faturamento", 5],
  ["Outros", 4],
  ["Comercial", 4],
  ["Bug's Do Sistema", 4],
  ["Cardápio e pedidos", 4],
  ["Cancelamento", 3],
  ["Marketplace e integrações", 2],
  ["Limitação Do Sistema/sugestões", 2],
  ["Cliente Final", 1],
  ["Entrega", 0],
  ["Pagamento", 0],
  ["Marketplace", 0],
];

const categorias: CategoriaContada[] = base.map(([nome, casos], i) => ({
  id: `c${i}`,
  nome,
  ativa: true,
  casos,
  subcategorias: 0,
  macros: 0,
  regras: 0,
}));

const grupos = sugerirGrupos(categorias);
const membros = (chave: string) => grupos.find((g) => g.chave === chave)?.membros.map((m) => m.nome) ?? [];

console.log("\n— As palavras de um nome —");
confere("acento, 'e' e plural", palavrasDaCategoria("Financeiro E Cobranças"), ["financeiro"]);
confere("apóstrofo e 'do'", palavrasDaCategoria("Bug's Do Sistema"), ["sistema"]);
confere("barra separa", palavrasDaCategoria("Limitação Do Sistema/sugestões"), ["limitacao", "sistema"]);

console.log("\n— Os grupos da base real —");
confere("financeiro junta os três e o Pagamento", membros("financeiro"), ["Financeiro E Cobranças", "Financeiro", "Financeiro E Faturamento", "Pagamento"]);
confere("atendimento junta os dois", membros("atendimento"), ["Atendimento", "Qualidade Do Atendimento"]);
confere(
  "sistema junta os cinco",
  membros("sistema"),
  ["Limitação No Sistema / Produto", "Sistema", "Configurações E Uso Do Sistema", "Bug's Do Sistema", "Limitação Do Sistema/sugestões"]
);
confere("limitação é um grupo menor, à parte", membros("limitacao"), ["Limitação No Sistema / Produto", "Limitação Do Sistema/sugestões"]);
confere("marketplace junta os dois", membros("marketplace"), ["Marketplace e integrações", "Marketplace"]);
confere("destino sugerido é o de mais casos", grupos.find((g) => g.chave === "financeiro")?.destinoId, "c1");
confere("o maior grupo vem primeiro", grupos[0]?.chave, "atendimento");
confere("Cliente Final não entra em grupo nenhum", grupos.some((g) => g.membros.some((m) => m.nome === "Cliente Final")), false);
confere("Outros não entra em grupo nenhum", grupos.some((g) => g.membros.some((m) => m.nome === "Outros")), false);
confere("categoria desativada não entra", sugerirGrupos(categorias.map((c) => (c.nome === "Financeiro" ? { ...c, ativa: false } : c))).find((g) => g.chave === "financeiro")?.membros.length, 3);

console.log("\n— A prévia —");
const destino = categorias[1];
const origens = [categorias[2], { ...categorias[9], subcategorias: 2, macros: 1 }];
confere(
  "diz quantos casos mudam, as subcategorias, as respostas e o que fica desativado",
  previaDaUnificacao(destino, origens),
  [
    '40 caso(s) passam de "Financeiro", "Financeiro E Faturamento" para "Financeiro E Cobranças" — que fica com 86.',
    '2 subcategoria(s) vão para "Financeiro E Cobranças"; as de mesmo nome se juntam.',
    '1 resposta(s) pronta(s) passam a ser de "Financeiro E Cobranças".',
    '"Financeiro", "Financeiro E Faturamento" ficam desativadas, sem casos — dá para reativar ou excluir depois.',
  ]
);

console.log(falhas === 0 ? "\nTudo certo.\n" : `\n${falhas} falha(s).\n`);
process.exit(falhas === 0 ? 0 : 1);
