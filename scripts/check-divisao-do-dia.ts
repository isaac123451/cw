/**
 * O Meu dia de cada um divide sem sobrar nem repetir?
 *
 *   npm run check:divisao-do-dia
 *
 * Sem banco (05/11/2026). Com duas pessoas recebendo: todo item tem
 * exatamente um dono; o que tem responsável fica com ele; o resto divide
 * perto da metade e sempre igual; a frente que alguém não cobre vai para o
 * outro; ausente passa a fila; uma pessoa só não muda nada.
 */
import { divisaoAtiva, ehMeu, quemFaz, type DivisaoDoDia } from "../lib/models/divisaoDoDia";
import type { FrenteId } from "../lib/models/frentes";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 40)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)?.slice(0, 40)}`);
}

const TODAS: FrenteId[] = ["reclame-aqui", "redes", "nps", "google"];
const dupla = (eu: string, extra: Partial<Record<"c" | "t", Partial<DivisaoDoDia["pessoas"][number]>>> = {}): DivisaoDoDia => ({
  eu,
  pessoas: [
    { id: "c", nome: "Carlos Isaac", frentes: TODAS, ausente: false, ...extra.c },
    { id: "t", nome: "Thais Portela", frentes: TODAS, ausente: false, ...extra.t },
  ],
});

const itens = Array.from({ length: 1000 }, (_, i) => ({ chave: `caso-${i}`, frente: (["reclame-aqui", "redes", "nps"] as FrenteId[])[i % 3] }));

console.log("\n-- cada item tem um dono só");
const doCarlos = itens.filter((i) => ehMeu(i, dupla("c")));
const daThais = itens.filter((i) => ehMeu(i, dupla("t")));
conferir("nenhum item nos dois dias", doCarlos.filter((i) => daThais.includes(i)).length, 0);
conferir("nenhum item fora dos dois", doCarlos.length + daThais.length, 1000);
conferir("divide perto da metade (40–60%)", doCarlos.length > 400 && doCarlos.length < 600, true);
conferir("sempre a mesma metade", itens.filter((i) => ehMeu(i, dupla("c"))).length, doCarlos.length);

console.log("\n-- o responsável manda");
conferir("com o nome da Thais é da Thais", quemFaz({ chave: "caso-1", dono: "Thais Portela", frente: "reclame-aqui" }, dupla("c")), "t");
conferir("com o nome de quem saiu: entra na divisão", ["c", "t"].includes(quemFaz({ chave: "caso-1", dono: "Fulano Antigo", frente: "nps" }, dupla("c"))!), true);
conferir("responsável ausente: a fila dele passa", quemFaz({ chave: "caso-1", dono: "Thais Portela", frente: "nps" }, dupla("c", { t: { ausente: true } })), "c");

console.log("\n-- as frentes de cada um");
const soRa = dupla("c", { t: { frentes: ["reclame-aqui", "redes", "google"] } });
conferir("quem não cobre o NPS não recebe NPS sem dono", itens.filter((i) => i.frente === "nps").every((i) => quemFaz(i, soRa) === "c"), true);
conferir("e o RA continua dividido", itens.filter((i) => i.frente === "reclame-aqui").some((i) => quemFaz(i, soRa) === "t"), true);

console.log("\n-- quando não divide");
conferir("uma pessoa só: tudo é dela", divisaoAtiva({ eu: "c", pessoas: [dupla("c").pessoas[0]] }), false);
conferir("a outra ausente: não divide", divisaoAtiva(dupla("c", { t: { ausente: true } })), false);
conferir("quem abre não recebe (gestão): vê tudo", divisaoAtiva({ ...dupla("x") }), false);
conferir("sem divisão, ehMeu é sempre sim", ehMeu({ chave: "caso-9", frente: "nps" }, null), true);

console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
