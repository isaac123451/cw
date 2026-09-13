/**
 * Prova do detector do Passo 7 — `lib/services/lgpd.ts`.
 *
 * "Nunca inclua dados pessoais (CPF, e-mail, telefone, valores exatos de
 * contratos) na mensagem pública." Cada padrão tem o caso que deve
 * acender e o que não pode acender — um detector que grita em toda
 * resposta educada é desligado por quem usa, e aí não protege nada.
 *
 * Também prova que os textos que a própria plataforma monta para o
 * cliente não carregam dado pessoal, e a medida de texto repetido.
 *
 *   npm run check:lgpd
 */
import {
  cpfValido,
  dadosSensiveis,
  resumoDosAchados,
  semelhanca,
  LIMITE_DE_REPETICAO,
} from "../lib/services/lgpd";
import {
  mensagemDeAtualizacao,
  mensagemDePedidoDeAvaliacao,
  mensagemPublicaTransparente,
} from "../lib/models/mensagens";

let falhas = 0;

function confere(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`${ok ? "ok  " : "FALHOU"}  ${nome}${ok ? "" : `\n        esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`}`);
}

/** Os tipos achados num texto, na ordem. */
const tipos = (texto: string) => dadosSensiveis(texto).map((a) => a.tipo);
const trechos = (texto: string) => dadosSensiveis(texto).map((a) => a.trecho);

console.log("\n— CPF e CNPJ —");
confere("CPF com pontuação", tipos("O CPF 529.982.247-25 consta no cadastro."), ["cpf"]);
confere("CPF só com traço", tipos("cpf 529982247-25"), ["cpf"]);
confere("CPF corrido e válido", tipos("documento 52998224725"), ["cpf"]);
confere("dígitos verificadores do CPF", [cpfValido("52998224725"), cpfValido("52998224724"), cpfValido("11111111111")], [true, false, false]);
confere("CNPJ com pontuação", tipos("CNPJ 12.345.678/0001-95"), ["cnpj"]);
confere("CNPJ corrido", tipos("cnpj 12345678000195"), ["cnpj"]);

console.log("\n— Contato —");
confere("e-mail", trechos("Escreva para joao.silva+ra@gmail.com hoje"), ["joao.silva+ra@gmail.com"]);
confere("celular com DDD entre parênteses", tipos("Ligue no (11) 98765-4321."), ["telefone"]);
confere("celular com DDD e espaço", tipos("11 98765-4321"), ["telefone"]);
confere("celular com +55", tipos("+55 11 98765-4321"), ["telefone"]);
confere("celular corrido (11 dígitos que não são CPF)", tipos("whats 11987654321"), ["telefone"]);
confere("fixo com DDD", tipos("(41) 3222-1100"), ["telefone"]);

console.log("\n— Valores e condições —");
confere("valor em reais com R$", trechos("o plano anual sai por R$ 1.250,00 no cartão"), ["R$ 1.250,00"]);
confere("valor sem espaço", tipos("R$150 de crédito"), ["valor"]);
confere("valor por extenso", tipos("foram 300 reais"), ["valor"]);
confere("condição: desconto", tipos("oferecemos um desconto"), ["condicao"]);
confere("condição: mês grátis", tipos("liberamos um mês grátis"), ["condicao"]);
confere("condição: estorno e reembolso", tipos("fizemos o estorno e o reembolso"), ["condicao", "condicao"]);
confere("condição conjugada: estornamos, reembolsado, descontamos", tipos("estornamos, foi reembolsado e descontamos"), ["condicao", "condicao", "condicao"]);
confere("condição com acento e maiúscula: Isenção", tipos("Isenção da mensalidade"), ["condicao"]);

console.log("\n— O que não pode acender —");
confere(
  "resposta educada sem dado nenhum",
  tipos("Olá, Maria! Sentimos muito pelo transtorno com o seu cardápio. Nosso time conversou com você e ajustou a integração — seguimos à disposição."),
  []
);
confere("ano e horário não são telefone", tipos("Em 2026, às 14:30, no dia 12/09"), []);
confere("número de pedido curto não é telefone", tipos("pedido 48213 entregue"), []);
confere("porcentagem não é valor", tipos("99% dos pedidos"), []);
confere("descontente não é desconto", tipos("Lamentamos que tenha ficado descontente com o atendimento."), []);

console.log("\n— Resumo e ordem —");
const misto = "CPF 529.982.247-25, fone (11) 98765-4321 e R$ 50,00 de desconto";
confere("ordem do texto", tipos(misto), ["cpf", "telefone", "valor", "condicao"]);
confere("resumo para o aviso", resumoDosAchados(dadosSensiveis(misto)), "1 CPF, 1 telefone, 1 valor, 1 condição negociada");
confere("plural", resumoDosAchados(dadosSensiveis("(11) 98765-4321 ou (11) 91234-5678")), "2 telefones");

console.log("\n— Os textos da própria plataforma —");
confere("mensagem pública transparente não tem dado pessoal", tipos(mensagemPublicaTransparente({ nome: "Maria Souza" })), []);
confere("aviso de atualização não tem dado pessoal", tipos(mensagemDeAtualizacao({ nome: "Maria", area: "Financeiro", retornoAte: "qua, 16/09 às 10:00" })), []);
confere(
  "o gancho entra já no 1º pedido de avaliação",
  mensagemDePedidoDeAvaliacao({ nome: "maria", numero: 1, gancho: "Vi que você ajustou o cardápio com o Suporte." }).includes("Vi que você ajustou o cardápio"),
  true
);
confere(
  "pedido de avaliação usa o primeiro nome, com maiúscula",
  mensagemDePedidoDeAvaliacao({ nome: "maria souza", numero: 2 }).startsWith("Oi, Maria!"),
  true
);

console.log("\n— Texto repetido —");
const base =
  "Olá! Lamentamos o ocorrido com a sua loja. Nosso time técnico analisou a integração com o iFood e corrigiu a sincronização dos pedidos. Seguimos acompanhando de perto e à disposição pelos nossos canais.";
confere("o mesmo texto é 100% repetido", semelhanca(base, base), 100);
confere("mesmo texto com outro nome continua acima do limite", semelhanca(base.replace("Olá!", "Olá, Carla!"), base) >= LIMITE_DE_REPETICAO, true);
confere(
  "texto próprio fica abaixo do limite",
  semelhanca(
    "Carla, a sua reclamação sobre a impressora da cozinha foi resolvida na terça com a troca do driver pelo Suporte N2, e você confirmou que os pedidos voltaram a sair.",
    base
  ) < LIMITE_DE_REPETICAO,
  true
);
confere("texto curto demais não é medido", semelhanca("Olá, tudo bem?", base), 0);

console.log(falhas === 0 ? "\nTudo certo.\n" : `\n${falhas} falha(s).\n`);
process.exit(falhas === 0 ? 0 : 1);
