/**
 * Conversas sem resposta (1.108): o retrato da lista do WhatsApp vira
 * aviso e item do Meu dia, na ordem da prioridade. Sem banco.
 *
 *   npm run check:conversas-sem-resposta
 */
import { avisosDeAbertura } from "../lib/models/aberturaDoAgente";
import { itensDaEspera, linkDaConversa, ordenarEspera, quantasEsperando, resumoDaEspera, retratoValido, rotuloDaEspera, validarConversas, type RetratoDaEspera } from "../lib/models/esperaNoWhatsapp";
import { contadoresDoMenu } from "../lib/models/contadoresDoMenu";
import { EXPEDIENTE_PADRAO } from "../lib/services/horasUteis";
import { contarRotina } from "../lib/models/meuDia";

let falhas = 0;
function ok(nome: string, cond: boolean, extra = "") {
  if (!cond) falhas++;
  console.log(`${cond ? "ok " : "ERRO"} ${nome}${extra ? ` — ${extra}` : ""}`);
}

const agora = new Date("2026-09-30T15:00:00-03:00");
const ha = (min: number) => new Date(agora.getTime() - min * 60_000).toISOString();

/* A validação do que a extensão manda. */
const validas = validarConversas([
  { chave: "tel:5511999990000", nome: "", telefone: "+55 11 99999-0000", minutos: 95, etiquetas: [] },
  { chave: "nome:ana pizzaria", nome: "Ana Pizzaria", minutos: 20, etiquetas: [{ rotulo: "Detrator · NPS 3", tom: "perigo" }] },
  { chave: "nome:bruno", nome: "Bruno", minutos: 200, etiquetas: [{ rotulo: "Redes sociais", tom: "atencao" }] },
  { chave: "nome:carla", nome: "Carla", minutos: 3 },
  { chave: "qualquer", nome: "X", minutos: 30 },
  { chave: "nome:ana pizzaria", nome: "Ana de novo", minutos: 40 },
  { chave: "nome:dora", nome: "Dora", minutos: 45, etiquetas: [{ rotulo: "<b>x</b>", tom: "vermelho" }] },
]);
ok("fica quem é válido: 4 de 7", validas.length === 4, validas.map((v) => v.chave).join(", "));
ok("menos de 5 min não é espera", !validas.some((v) => v.chave === "nome:carla"));
ok("chave repetida entra uma vez", validas.filter((v) => v.chave === "nome:ana pizzaria").length === 1);
ok("tom desconhecido vira neutro", validas.find((v) => v.chave === "nome:dora")?.etiquetas[0].tom === "neutro");
ok("telefone só com dígitos e +", validas[0].telefone === "+5511999990000");
ok("nada além de lista vira lista vazia", validarConversas("oi").length === 0 && validarConversas(null).length === 0);

/* A ordem: a etiqueta mais séria primeiro, depois quem espera há mais tempo. */
const ordem = ordenarEspera(validas).map((c) => c.chave);
ok("detrator na frente mesmo esperando menos", ordem[0] === "nome:ana pizzaria", ordem.join(" > "));
ok("depois reclamação de redes (atenção)", ordem[1] === "nome:bruno");
ok("sem etiqueta, pela espera", ordem[2] === "tel:5511999990000" && ordem[3] === "nome:dora");

/* O retrato velho não vale: o WhatsApp foi fechado. */
const fresco: RetratoDaEspera = { conversas: validas, lidoEm: ha(2) };
const velho: RetratoDaEspera = { conversas: validas, lidoEm: ha(40) };
ok("retrato de 2 min vale", retratoValido(fresco, agora));
ok("retrato de 40 min não vale", !retratoValido(velho, agora) && itensDaEspera(velho, agora).length === 0 && resumoDaEspera(velho, agora) === null);
ok("sem retrato, nada", itensDaEspera(null, agora).length === 0);

/* O aviso. */
const resumo = resumoDaEspera(fresco, agora)!;
ok("título conta quem espera há mais de 1 h", resumo.titulo === "2 clientes esperando há mais de 1 h no WhatsApp", resumo.titulo);
ok("detalhe diz quantos são sérios", resumo.detalhe.startsWith("1 com reclamação aberta ou detrator"), resumo.detalhe);
ok("itens na ordem, com a espera e a etiqueta", resumo.itens[0].titulo === "Ana Pizzaria" && resumo.itens[0].detalhe === "espera 20 min · Detrator · NPS 3");
ok("contato não salvo aparece pelo número", resumo.itens.some((i) => i.titulo === "+5511999990000"));
const soCurtas = resumoDaEspera({ conversas: validarConversas([{ chave: "nome:e", nome: "E", minutos: 12 }]), lidoEm: ha(1) }, agora)!;
ok("sem espera longa: título neutro", soCurtas.titulo === "1 cliente esperando resposta no WhatsApp" && soCurtas.tom === "neutro");
ok("rótulos da espera", rotuloDaEspera(95) === "espera 1 h e meia" && rotuloDaEspera(1500) === "espera desde ontem" && rotuloDaEspera(4400) === "espera há 3 dias");

const avisos = avisosDeAbertura({ casos: [], regras: [], nps: [], agora, espera: fresco });
const whats = avisos.find((a) => a.chave === "whatsapp");
ok("o aviso entra no Pede ação agora", !!whats && whats.quantidade === 4 && whats.href === "https://web.whatsapp.com/");
ok("sem retrato, sem aviso", !avisosDeAbertura({ casos: [], regras: [], nps: [], agora }).some((a) => a.chave === "whatsapp"));

/* O plano: entram nos casos em aberto, na ordem da prioridade. */
const contagens = contarRotina({ casos: [], nps: [], google: [], movimentos: [], tarefas: [], regrasSla: [], esperaNoWhatsapp: itensDaEspera(fresco, agora) }, agora);
const emAberto = contagens["em-aberto"];
ok("4 itens em 'casos em aberto'", emAberto.total === 4, emAberto.resumo);
ok("resumo diz quantos são do WhatsApp", emAberto.resumo.includes("(4 no WhatsApp)"), emAberto.resumo);
ok("o detrator é o primeiro e é crítico", emAberto.itens[0].id === "whatsapp:nome:ana pizzaria" && emAberto.itens[0].critico === true);
ok("espera de mais de 1 h conta como fora do prazo", emAberto.atrasados === 2, String(emAberto.atrasados));

/* 1.121: "não vi ainda como consigo visualizar as não respondidas" — a lista em Conversas e o número do menu. */
const comTelefone = { chave: "tel:5512982947571", nome: "", telefone: "+5512982947571", minutos: 90, etiquetas: [] };
const soNome = { chave: "nome:ana", nome: "Ana", telefone: "", minutos: 30, etiquetas: [] };
ok("com telefone, o link abre a conversa", linkDaConversa(comTelefone) === "https://web.whatsapp.com/send?phone=5512982947571", linkDaConversa(comTelefone));
ok("só com o nome, abre o WhatsApp Web", linkDaConversa(soNome) === "https://web.whatsapp.com/");
const retratoAgora: RetratoDaEspera = { conversas: [comTelefone, soNome], lidoEm: new Date(agora.getTime() - 60_000).toISOString() };
ok("o menu conta quem espera agora", quantasEsperando(retratoAgora, agora) === 2);
ok("e zera com o retrato vencido (WhatsApp fechado)", quantasEsperando({ ...retratoAgora, lidoEm: new Date(agora.getTime() - 60 * 60_000).toISOString() }, agora) === 0);
ok("o menu de Conversas mostra o número", contadoresDoMenu({ casos: [], nps: [], googleAbertas: 0, esperandoNoWhatsapp: 2, tarefas: [], regras: [], expediente: EXPEDIENTE_PADRAO, agora })["/conversas"].valor === 2);

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
