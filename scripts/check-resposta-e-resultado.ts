/**
 * Resposta e resultado (1.109): os traços de cada resposta, o retorno por
 * padrão, os modelos e o "o que veio depois" do WhatsApp. Sem banco.
 *
 *   npm run check:resposta-e-resultado
 */
import {
  anonimizar,
  categoriasComBase,
  comResultado,
  melhoresRespostas,
  padroesNoWhatsapp,
  padroesQueFuncionam,
  respostasQueNaoFuncionaram,
  retornoDe,
  tracosDaResposta,
  vezesComResultado,
  type EntradaDaResposta,
} from "../lib/models/respostaEResultado";

let falhas = 0;
function ok(nome: string, cond: boolean, extra = "") {
  if (!cond) falhas++;
  console.log(`${cond ? "ok " : "ERRO"} ${nome}${extra ? ` — ${extra}` : ""}`);
}

/* Os traços. */
const t1 = tracosDaResposta("Olá, Ana! Entramos em contato por telefone e o acesso já está normalizado. Até sexta você recebe o estorno. Pedimos desculpas. Se puder, avalie o atendimento.");
ok("prazo concreto (até sexta)", t1.prazoConcreto);
ok("conta o contato feito", t1.contatoFeito);
ok("descreve a solução (já está normalizado)", t1.solucaoDescrita);
ok("pede desculpas", t1.desculpa);
ok("convida a avaliar", t1.conviteAvaliar);
ok("com prazo não é vago", !t1.vago);
const t2 = tracosDaResposta("Olá! Vamos verificar o ocorrido com a equipe e retornamos em breve.");
ok("\"vamos verificar\" sem prazo é vago", t2.vago && !t2.prazoConcreto);
ok("\"em 2 dias úteis\" é prazo", tracosDaResposta("Retornamos em 2 dias úteis.").prazoConcreto);
ok("\"em contato\" sozinho não é prazo", !tracosDaResposta("Estamos em contato com você.").prazoConcreto);
ok("tamanho pela régua (600/900)", tracosDaResposta("a".repeat(500)).tamanho === "curta" && tracosDaResposta("a".repeat(700)).tamanho === "media" && tracosDaResposta("a".repeat(1000)).tamanho === "longa");

/* O resultado. */
const base = (p: Partial<EntradaDaResposta>): EntradaDaResposta => ({
  id: Math.random().toString(36).slice(2),
  protocolo: "RA-x",
  cliente: "Bianca Souza",
  categoria: "Financeiro",
  texto: "Olá, Bianca! Resolvemos o seu caso. " + "x".repeat(150),
  reclamadaEm: "2026-09-01",
  respondidaEm: "2026-09-02T00:00:00.000Z",
  avaliada: true,
  resolvida: true,
  nota: 9,
  voltaria: true,
  avaliadaEm: "2026-09-05T00:00:00.000Z",
  ...p,
});
const r1 = comResultado(base({}));
ok("resolvida com nota 9 funcionou", r1.resultado === "funcionou");
ok("dias até responder e até avaliar", r1.diasAteResponder === 1 && r1.diasAteAvaliar === 3);
ok("não resolvida não funcionou", comResultado(base({ resolvida: false, nota: 6 })).resultado === "nao");
ok("resolvida com nota 3 não funcionou", comResultado(base({ nota: 3 })).resultado === "nao");
ok("resolvida com nota 5 funcionou em parte", comResultado(base({ nota: 5 })).resultado === "meio");
ok("sem avaliação", comResultado(base({ avaliada: false, nota: null })).resultado === "sem-avaliacao");

const ret = retornoDe([r1, comResultado(base({ resolvida: false, nota: 2, voltaria: false })), comResultado(base({ avaliada: false, nota: null }))]);
ok("retorno: 3 respostas, 2 avaliadas, 50% resolvido, nota 5,5", ret.respostas === 3 && ret.avaliadas === 2 && ret.resolvidoPct === 50 && ret.notaMedia === 5.5, JSON.stringify(ret));

/* Os padrões, por tipo de problema. */
const muitas = [
  ...Array.from({ length: 12 }, () => comResultado(base({ texto: "Olá, Bianca! Resolvemos. Avalie o atendimento. " + "x".repeat(100) }))),
  ...Array.from({ length: 12 }, () => comResultado(base({ texto: "Olá, Bianca! Vamos verificar. " + "x".repeat(100), resolvida: false, nota: 3 }))),
  ...Array.from({ length: 3 }, () => comResultado(base({ categoria: "Sistema" }))),
];
const convite = padroesQueFuncionam(muitas, "Financeiro").find((p) => p.chave === "convite")!;
ok("convite: 100% × 0% com base", convite.grupos[0].retorno.resolvidoPct === 100 && convite.grupos[1].retorno.resolvidoPct === 0 && convite.temBase && convite.diferenca === 100, JSON.stringify(convite.grupos.map((g) => g.retorno.avaliadas)));
const soSistema = padroesQueFuncionam(muitas, "Sistema").find((p) => p.chave === "convite")!;
ok("recorte por tipo de problema tem pouca base", !soSistema.temBase && soSistema.grupos[0].retorno.respostas + soSistema.grupos[1].retorno.respostas === 3);
ok("tipos com base (5 ou mais avaliadas)", JSON.stringify(categoriasComBase(muitas)) === JSON.stringify([{ categoria: "Financeiro", avaliadas: 24 }]));

/* Os modelos. */
const melhores = melhoresRespostas([comResultado(base({ nota: 8 })), comResultado(base({ nota: 10, texto: "Olá, Bianca! " + "y".repeat(200) })), comResultado(base({ nota: 10, texto: "curta" })), comResultado(base({ resolvida: false, nota: 9 }))]);
ok("modelos: só resolvidas com nota 8+, texto com corpo, a maior nota primeiro", melhores.length === 2 && melhores[0].nota === 10 && melhores[1].nota === 8);
ok("não funcionaram", respostasQueNaoFuncionaram(muitas).length === 12);
ok("anonimiza o nome do cliente", anonimizar("Olá, Bianca! Bianca Souza, obrigado.", "Bianca Souza") === "Olá, {nome}! {nome}, obrigado.", anonimizar("Olá, Bianca! Bianca Souza, obrigado.", "Bianca Souza"));
ok("não troca quem assina", anonimizar("Sou o Wesley, do atendimento. Wesley, obrigado.", "Wesley Costa") === "Sou o Wesley, do atendimento. {nome}, obrigado.");
ok("não troca pedaço de palavra", anonimizar("Anabela e Ana", "Ana Lima") === "Anabela e {nome}");

/* O WhatsApp. */
const m = (de: string, texto: string, hora: string) => ({ de, texto, em: `2026-09-30T${hora}:00-03:00` });
const vezes = vezesComResultado([
  {
    id: "c1",
    contato: "Loja X",
    mensagens: [
      m("cliente", "Oi, obrigado pela ajuda", "09:00"),
      m("nos", "Bom dia! Verifiquei aqui", "09:05"),
      m("nos", "Transcrição do áudio (0:30): já está resolvido", "09:06"),
      m("cliente", "Isso é um absurdo, continua errado, péssimo", "09:30"),
      m("nos", "Vou conferir", "15:00"),
    ],
  },
]);
ok("mensagens seguidas nossas viram uma vez só", vezes.length === 2, String(vezes.length));
const primeira = vezes.find((v) => v.texto.startsWith("Bom dia"))!;
ok("a vez com áudio é marcada como áudio", primeira.audio);
ok("respondeu em 24 min", primeira.respondeuEmMin === 24, String(primeira.respondeuEmMin));
ok("humor piorou depois", primeira.mudou === "piorou");
ok("de manhã", primeira.periodo === "manha");
const ultima = vezes.find((v) => v.texto === "Vou conferir")!;
ok("sem resposta do cliente: nada a medir", ultima.respondeuEmMin === null && ultima.mudou === null && ultima.periodo === "tarde");
const audio = padroesNoWhatsapp(vezes).find((p) => p.chave === "audio")!;
ok("áudio × texto separa as vezes", audio.grupos[0].retorno.vezes === 1 && audio.grupos[1].retorno.vezes === 1 && audio.grupos[0].retorno.respondeuPct === 100 && audio.grupos[1].retorno.respondeuPct === 0);

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
