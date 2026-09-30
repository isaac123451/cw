/**
 * Confere a comparação com o segmento (1.107): o leitor da barra lateral
 * contra amostras no formato medido em 30/09/2026 (Goomer, Cardápio Web),
 * a validação do servidor e a ordem da tabela. Sem banco.
 *
 *   npm run check:segmento
 */
import { enderecoDaEmpresa, lerEmpresa, lerPainel } from "../extensao/comum/portal-ra.js";

import { lugarDaCasa, ordenarSegmento, slugDoEndereco, type LinhaDoSegmento } from "@/lib/models/segmento";
import { validarLeitura } from "@/lib/services/segmento.service";

let falhas = 0;
function ok(nome: string, cond: boolean, extra = "") {
  if (!cond) falhas++;
  console.log(`${cond ? "ok " : "ERRO"} ${nome}${extra ? ` — ${extra}` : ""}`);
}

/* A serialização do Astro: todo valor vira [0, valor], lista vira [1, [...]], e [0] sozinho é "não tem". */
const v = (x: unknown): unknown => (Array.isArray(x) ? [1, x.map(v)] : x && typeof x === "object" ? [0, Object.fromEntries(Object.entries(x).map(([k, y]) => [k, v(y)]))] : x === undefined ? [0] : [0, x]);
const periodo = (type: string, finalScore: string, extra: Record<string, string> = {}) => ({
  main: type === "SIX_MONTHS",
  type,
  complaints: "41",
  answers: "41",
  awaiting: "0",
  start: "2026-03-01T00:00:00",
  end: "2026-08-31T23:59:59",
  ratings: "25",
  answeredRate: "100.0",
  solvedRate: "95.7",
  averageResponseTime: "14 dias e 17 horas",
  dealAgainRate: "95.7",
  consumerScore: "8.70",
  finalScore,
  status: "GREAT",
  ...extra,
});
function pagina(nome: string, periodos: object[], posicao?: object) {
  const props = Object.fromEntries(
    Object.entries({ companyName: nome, ravStatus: undefined, reputation: { currentReputation: periodos[0], reputation: periodos, isMock: false }, companyPosition: posicao }).map(([k, x]) => [k, v(x)])
  );
  const attr = JSON.stringify(props).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<html><body><astro-island uid="Z1" component-url="/_complaint/CompanySidebarIsland.BTPcbILA.js" component-export="default" props="${attr}" ssr client="load"></astro-island></body></html>`;
}

/* O leitor. */
const goomer = pagina("Goomer ", [periodo("SIX_MONTHS", "9.4"), periodo("TWELVE_MONTHS", "9.0"), periodo("LAST_THREE_YEARS", "8.8")]);
const empresa = lerEmpresa(goomer);
ok("nome sem o espaço do fim", empresa?.nome === "Goomer", JSON.stringify(empresa));
ok("fora do ranking do segmento, sem posição", empresa?.posicao === null);
const paineis = lerPainel(goomer);
ok("três períodos lidos", paineis?.length === 3, String(paineis?.length));
ok("nota e selo do semestre", paineis?.[0]?.nota === 9.4 && paineis?.[0]?.selo === "GREAT" && paineis?.[0]?.solucao === 95.7);

const casa = pagina("Cardápio Web", [periodo("SIX_MONTHS", "8.9", { status: "RA1000" })], { position: 3, type: "BEST", segmentName: "Softwares de Desenvolvimento e Design", mainSegmentShortname: "softwares" });
ok("posição no segmento", JSON.stringify(lerEmpresa(casa)?.posicao) === JSON.stringify({ posicao: 3, tipo: "BEST", segmento: "Softwares de Desenvolvimento e Design" }));

const semNota = pagina("Neemo", [periodo("SIX_MONTHS", "--", { status: "NO_INDEX" })]);
ok("nota \"--\" vira sem nota, não zero", lerPainel(semNota)?.[0]?.nota === null);
ok("página sem a barra lateral: null", lerEmpresa("<html>404</html>") === null && lerPainel("<html>404</html>") === null);
ok("endereço da lista pública", enderecoDaEmpresa("anota-ai") === "https://www.reclameaqui.com.br/empresa/anota-ai/lista-reclamacoes/");

/* O endereço que a pessoa cola. */
ok("link da página", slugDoEndereco("https://www.reclameaqui.com.br/empresa/anota-ai/") === "anota-ai");
ok("link de outra aba da empresa", slugDoEndereco("https://www.reclameaqui.com.br/empresa/saipos/lista-reclamacoes/?pagina=2") === "saipos");
ok("endereço curto", slugDoEndereco("  Goomer ") === "goomer");
ok("texto qualquer não passa", slugDoEndereco("a Anota AI") === null && slugDoEndereco("https://google.com/x") === null);

/* A validação do servidor. */
const lida = validarLeitura({ slug: "goomer", nome: "Goomer", paineis, posicao: null });
ok("leitura válida passa com os períodos", lida?.paineis.length === 3);
ok("slug estranho é recusado", validarLeitura({ slug: "../x", nome: "X", paineis }) === null);
ok("nota acima de 10 derruba o período", validarLeitura({ slug: "x-y", nome: "X", paineis: [{ ...paineis![0], nota: 94 }] })?.paineis.length === 0);
ok("posição sem número vira null", validarLeitura({ slug: "x-y", nome: "X", paineis, posicao: { posicao: "abc" } })?.posicao === null);

/* A tabela. */
const linha = (slug: string, nota: number | null, casa = false): LinhaDoSegmento => ({ slug, nome: slug, casa, nota, resposta: null, solucao: null, voltaria: null, notaConsumidor: null, recebidas: null, tempoMedio: "", selo: "", posicao: null, notaAntes: null, lidoEm: "" });
const linhas = [linha("saipos", 6.9), linha("cardapio", 8.9, true), linha("neemo", null), linha("goomer", 9.4), linha("anota", 5.7)];
ok("ordem pela nota, sem nota no fim", ordenarSegmento(linhas).map((l) => l.slug).join() === "goomer,cardapio,saipos,anota,neemo");
ok("lugar da casa entre as com nota", JSON.stringify(lugarDaCasa(linhas)) === JSON.stringify({ lugar: 2, de: 4 }));

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
