/**
 * O catálogo de causas raiz tirado da base (Fase 27).
 *
 *   npm run check:causas
 *
 * Sem banco. Cada relato cai na família certa — a mais específica
 * primeiro —, a proposta conta por frente com dois exemplos de frentes
 * diferentes, o que não coube vira lista de palavras, a causa já
 * cadastrada é reconhecida e as regras de texto servem às causas novas.
 */
import {
  acharCausa,
  causaDaLinha,
  medirRegua,
  motorDaCausa,
  prazoComCausa,
  familiaDaCausa,
  familiaDoTexto,
  propostaDoCatalogo,
  regrasDoCatalogo,
  rotuloDoPrazo,
  type TextoDaBase,
} from "../lib/models/catalogoDeCausas";
import { normalizarTexto, sugerir } from "../lib/models/sugestaoPorTexto";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(72)} ${JSON.stringify(obtido)?.slice(0, 50)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(72)} ${JSON.stringify(esperado)?.slice(0, 50)}`);
}

const fam = (texto: string) => familiaDoTexto(texto)?.id;

console.log("\n  Cada relato na família certa\n");
conferir("impressora que não imprime", fam("Desde ontem a impressora não imprime os pedidos, perdi vendas"), "impressao");
conferir("pedido de pizza que não imprime é impressão, não consumidor", fam("Os pedidos de pizza não imprimem na cozinha"), "impressao");
conferir("iFood que não integra", fam("Os pedidos do iFood não entram no sistema desde sexta"), "integracao");
conferir("repasse retido", fam("O repasse das vendas no Pix não caiu há 5 dias, dinheiro retido"), "repasse");
conferir("cobrado depois de cancelar (não é cancelamento)", fam("Cancelei o plano em agosto e continuam cobrando a mensalidade no cartão"), "cobranca-pos-cancelamento");
conferir("quer cancelar o plano", fam("Quero cancelar o contrato, o sistema não atende a minha loja"), "cancelamento");
conferir("cupom fiscal é nota fiscal, não cupom", fam("Não consigo emitir o cupom fiscal das vendas"), "fiscal");
conferir("cupom de desconto", fam("O cupom de desconto de 10% não aplica no carrinho"), "cupom");
conferir("mensalidade cobrada a mais", fam("A mensalidade veio com valor a mais, cobrança indevida"), "cobranca");
conferir("consumidor: meu pedido não chegou", fam("Meu pedido não chegou e o restaurante não responde"), "consumidor-final");
conferir("consumidor: pedi uma pizza", fam("Pedi uma pizza pelo link e cobraram duas vezes"), "consumidor-final");
conferir("Cardápio Web no nome não é problema de cardápio", fam("A Cardápio Web é uma empresa que não cumpre o que promete, o vendedor disse outra coisa"), "venda");
conferir("produto sumiu do cardápio", fam("Os produtos sumiram do meu cardápio e os adicionais estão errados"), "cardapio");
conferir("taxa de entrega errada", fam("A taxa de entrega está calculando errado para o bairro Centro"), "entrega");
conferir("implantação parada", fam("Paguei a implantação e até hoje não foi liberado o acesso"), "implantacao");
conferir("robô do WhatsApp", fam("O robô do WhatsApp parou de responder meus clientes"), "whatsapp");
conferir("sistema lento no pico", fam("Sistema lento e travando no horário de pico de sexta"), "fora-do-ar");
conferir("sem retorno do suporte", fam("Abri chamado há 3 dias e ninguém responde, sem retorno nenhum"), "demora");
conferir("atendente grosseiro", fam("A atendente foi grosseira e desligou na minha cara"), "postura");
conferir("dúvida sobre promoção: o assunto vence a dúvida", fam("Não sei como configurar o horário das promoções? Complicado"), "cupom");
conferir("dúvida sem outro assunto", fam("Não sei como mexer no painel, muito complicado"), "uso");
conferir("sugestão", fam("Seria ótimo se tivesse relatório por garçom"), "funcao-que-falta");
conferir("elogio não cai em família nenhuma", fam("Excelente plataforma, recomendo muito, equipe nota dez"), undefined);

console.log("\n  A proposta\n");
const r = (frente: TextoDaBase["frente"], texto: string, ref: string): TextoDaBase => ({ frente, texto, ref });
const base: TextoDaBase[] = [
  r("reclame-aqui", "Impressora não imprime os pedidos do delivery desde ontem", "RA 1"),
  r("reclame-aqui", "A comanda sai duplicada na impressora da cozinha", "RA 2"),
  r("nps", "A impressão dos pedidos falha toda sexta", "NPS — Pizzaria Boa, nota 4"),
  r("google", "Sistema bom, mas a impressora trava direto", "Google — Ana, 3★"),
  r("reclame-aqui", "Os pedidos do iFood não entram desde sexta", "RA 3"),
  r("nps", "Integração com o iFood caiu de novo", "NPS — Lanches, nota 2"),
  r("reclame-aqui", "O repasse das vendas online não caiu na conta", "RA 4"),
  r("nps", "Excelente plataforma, recomendo muito, equipe nota dez", "NPS — Açaí, nota 10"),
  r("google", "Excelente atendimento da equipe, recomendo", "Google — Bia, 5★"),
  r("redes", "Treinamento remoto nota dez, equipe excelente", "instagram 9"),
  r("nps", "ok", "NPS — curto, nota 8"),
];
const p = propostaDoCatalogo(base, ["Bug", "Cobrança", "Atendimento", "Impressão de pedidos"]);
conferir("texto curto demais fica fora da base", p.base, 10);
conferir("base por frente", p.basePorFrente, { "reclame-aqui": 4, redes: 1, nps: 3, google: 2 });
conferir("famílias por total, da maior para a menor", p.linhas.map((l) => [l.familia.id, l.total]), [["impressao", 4], ["integracao", 2], ["repasse", 1], ["implantacao", 1]]);
const imp = p.linhas[0];
conferir("contagem por frente da impressão", imp.porFrente, { "reclame-aqui": 2, redes: 0, nps: 1, google: 1 });
conferir("dois exemplos, de frentes diferentes", imp.exemplos.map((e) => e.frente), ["reclame-aqui", "nps"]);
conferir("o exemplo traz o trecho que casou", imp.exemplos[0].trecho.toLowerCase().includes("impressora"), true);
conferir("a causa que já existe com o mesmo nome é reconhecida", imp.jaNoCatalogo, "Impressão de pedidos");
conferir("detalha a causa genérica que existe no catálogo", imp.detalhaAtuais, ["Bug"]);
conferir("repasse detalha Cobrança e Bug", p.linhas.find((l) => l.familia.id === "repasse")?.detalhaAtuais, ["Cobrança", "Bug"]);
conferir("o que não coube: os 2 elogios (treinamento é implantação)", p.semFamilia.total, 2);
conferir("as palavras que se repetem no que não coube", p.semFamilia.palavras.slice(0, 3).map((x) => x.palavra), ["equipe", "excelente", "recomendo"]);
conferir("exemplos do que não coube, de frentes diferentes", p.semFamilia.exemplos.map((e) => e.frente), ["nps", "google"]);

console.log("\n  Aprovar e sugerir\n");
const aprovada = causaDaLinha(p.linhas[1], { area: "Desenvolvimento" });
conferir("a escolha da pessoa vence a área sugerida", [aprovada.nome, aprovada.area, aprovada.prazoHoras], ["Integração com iFood e marketplaces", "Desenvolvimento", 24]);
conferir("sem escolha, vale a sugestão da família", causaDaLinha(p.linhas[2]).area, "Financeiro");
conferir("família reconhecida pelo nome, sem caixa nem acento", familiaDaCausa("impressao de PEDIDOS")?.id, "impressao");
conferir("prazo em dias úteis", [rotuloDoPrazo(4), rotuloDoPrazo(24), rotuloDoPrazo(72), rotuloDoPrazo(undefined)], ["4 h úteis", "1 dia útil", "3 dias úteis", "sem prazo"]);

const regras = regrasDoCatalogo([{ name: "Impressão de pedidos" }, { name: "Maquininha", palavras: ["maquininha", "stone"] }, { name: "Bug" }, { name: "Nome Sem Palavra" }]);
conferir("uma regra por causa que tem como ser lida", regras.map((x) => x.rotulo), ["Impressão de pedidos", "Maquininha", "Bug"]);
conferir("a causa feita à mão casa pelas palavras guardadas", regras[1].padrao.test(normalizarTexto("A maquininha da Stone não passa")), true);
const s = sugerir("a impressora parou de imprimir", { regras, valoresValidos: ["Impressão de pedidos", "Maquininha", "Bug"] });
conferir("sugestão pelo texto com o catálogo novo", s?.valor, "Impressão de pedidos");

console.log("\n  O dono da causa\n");
const catalogo = [{ name: "Sistema fora do ar ou lento", area: "Desenvolvimento", prazoHoras: 4 }, { name: "Implantação e ativação", area: "Implantação", prazoHoras: 72 }];
conferir("acha a causa sem diferença de caixa e espaço", acharCausa(" sistema FORA do ar ou lento ", catalogo)?.area, "Desenvolvimento");
conferir("sem causa, sem dono", acharCausa(undefined, catalogo), undefined);
conferir("causa da área acionada e mais curta: vale o prazo da causa", prazoComCausa(24, "Desenvolvimento", catalogo[0]), { horas: 4, pelaCausa: true });
conferir("prazo da causa mais longo: vale o da prioridade", prazoComCausa(24, "Implantação", catalogo[1]), { horas: 24, pelaCausa: false });
conferir("acionar outra área que não a dona: a causa não muda nada", prazoComCausa(24, "Financeiro", catalogo[0]), { horas: 24, pelaCausa: false });
conferir("causa sem dono (antes do db:push): só a prioridade", prazoComCausa(8, "Financeiro", { area: null, prazoHoras: null }), { horas: 8, pelaCausa: false });

console.log("\n  A mesma régua\n");
const cat = [
  { name: "Impressão de pedidos", active: true },
  { name: "Cobrança", active: true },
  { name: "Bug", active: false },
];
const regs = [
  { id: "r1", frente: "reclame-aqui" as const, texto: "A impressora não imprime os pedidos da cozinha", causa: "Impressão de pedidos" },
  { id: "r2", frente: "reclame-aqui" as const, texto: "Comanda não sai na impressora térmica", causa: "Impressão de pedidos" },
  { id: "n1", frente: "nps" as const, texto: "A impressora da cozinha falha toda noite", causa: "Impressão de pedidos" },
  { id: "n2", frente: "nps" as const, texto: "Cobraram a mensalidade duas vezes", causa: "cobranca" },
  { id: "n3", frente: "nps" as const, texto: "Sistema travou no sábado", causa: "Bug" },
  { id: "g1", frente: "google" as const, texto: "Boleto veio com valor errado", causa: null },
  { id: "g2", frente: "google" as const, texto: "ok", causa: "Cobrança" },
];
const m = motorDaCausa(regs, cat);
conferir("exemplos: só os com causa ativa do catálogo (grafia diferente conta)", m.exemplos.map((e) => [e.id, e.rotulo]), [["r1", "Impressão de pedidos"], ["r2", "Impressão de pedidos"], ["n1", "Impressão de pedidos"], ["n2", "Cobrança"]]);
conferir("o Reclame Aqui ensina o Google: impressora no Google vira impressão", sugerir("minha impressora parou", { indice: m.indice, regras: m.regras, valoresValidos: m.validos })?.valor, "Impressão de pedidos");
conferir("causa desativada não é sugerida", m.validos.includes("Bug"), false);
const rg = medirRegua(regs, cat);
conferir("NPS: 3 com texto, 3 com causa, 1 fora (\"cobranca\")", [rg.porFrente.nps.total, rg.porFrente.nps.comCausa, rg.porFrente.nps.foraDoCatalogo], [3, 3, 1]);
conferir("desativada não conta como fora; texto curto não conta", [rg.porFrente.google.total, rg.porFrente.google.comCausa], [1, 0]);
conferir("fora do catálogo diz qual é a certa", rg.foraDoCatalogo, [{ causa: "cobranca", registros: 1, noCatalogo: "Cobrança" }]);
conferir("acerto medido tirando o registro: RA 2 de 2", [rg.porFrente["reclame-aqui"].sugeridos, rg.porFrente["reclame-aqui"].acertos], [2, 2]);

console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo certo.\n");
process.exit(falhas ? 1 : 0);
