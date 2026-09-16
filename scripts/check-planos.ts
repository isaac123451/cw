/**
 * O plano da conta segue a tabela configurada?
 *
 *   npm run check:planos
 *
 * **O relato.** "Os planos no Impacto no Negócio estão desatualizados e
 * não estão conforme as configurações."
 *
 * **O que havia de fato.** A tabela de Configurações → Planos (Mesas,
 * Delivery, Premium) é a mesma do Impacto — essa parte batia. O que não
 * batia eram três coisas em volta dela:
 *
 * 1. o **estabelecimento** tinha uma lista de planos fixa no código
 *    ("Essencial", "Premium", "Enterprise"), e as 239 contas importadas
 *    estavam como "Essencial" — um plano que a tabela não tem;
 * 2. a **receita recorrente** somava só a mensalidade informada, vazia em
 *    todas, e dizia R$ 0 com a tabela preenchida;
 * 3. o **lançamento de impacto** arredondava o preço do plano para reais
 *    inteiros: R$ 209,99 virava 210, e doze meses 2.520 em vez de
 *    2.519,88.
 *
 * Roda sem servidor e sem banco.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { mensalidadeDaConta, planoDaConta } from "../lib/models/establishment";
import { PLANOS_PADRAO } from "../lib/models/plan";

const RAIZ = resolve(__dirname, "..");

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${JSON.stringify(obtido)?.slice(0, 50)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${JSON.stringify(esperado)?.slice(0, 50)}`);
}

const ler = (arquivo: string) => readFileSync(resolve(RAIZ, arquivo), "utf8");

console.log("\n  PLANOS — a conta segue a tabela configurada\n");

const tabela = PLANOS_PADRAO;

console.log("— O plano da conta, contra a tabela —\n");

conferir("plano que está na tabela", planoDaConta("Delivery", tabela).situacao, "na-tabela");
conferir("e o preço vem da tabela", planoDaConta("Delivery", tabela).plano?.priceCents, 20999);
conferir("sem acento nem maiúscula ainda casa", planoDaConta("premium", tabela).rotulo, "Premium");
conferir('"Essencial" é marcado como fora da tabela', planoDaConta("Essencial", tabela).rotulo, "Essencial (fora da tabela)");
conferir("vazio é não informado", planoDaConta("", tabela).situacao, "nao-informado");
conferir(
  "módulo não serve de plano da conta",
  planoDaConta("Fiscal", tabela).situacao,
  "fora-da-tabela"
);

console.log("\n— A mensalidade: a da conta, ou a da tabela —\n");

conferir("mensalidade informada vale mais", mensalidadeDaConta({ plan: "Delivery", mrr: 180 }, tabela), { reais: 180, origem: "conta" });
conferir("sem ela, o preço do plano", mensalidadeDaConta({ plan: "Delivery" }, tabela), { reais: 209.99, origem: "tabela" });
conferir("plano fora da tabela e sem mensalidade: nada", mensalidadeDaConta({ plan: "Essencial", mrr: 0 }, tabela), null);

console.log("\n— As telas usam a tabela, e não uma lista própria —\n");

{
  const modelo = ler("lib/models/establishment.ts");
  conferir("não existe mais a lista fixa de planos", /ESTABLISHMENT_PLANS\s*[:=]/.test(modelo), false);

  const formulario = ler("components/estabelecimentos/EstablishmentForm.tsx");
  conferir("o formulário da conta lê a tabela de planos", /usePlans\(\)/.test(formulario), true);
  conferir("e conta nova nasce sem plano, não \"Essencial\"", /editing\?\.plan \?\? ""/.test(formulario), true);

  const lista = ler("app/estabelecimentos/page.tsx");
  conferir("a receita recorrente usa a mensalidade da tabela", /mensalidadeDaConta\(/.test(lista), true);

  const detalhe = ler("components/estabelecimentos/EstablishmentDetail.tsx");
  conferir("a ficha mostra o plano pela tabela", /planoDaConta\(/.test(detalhe), true);

  const impacto = ler("components/impacto/ImpactForm.tsx");
  conferir("o impacto não arredonda o valor para reais inteiros", /amount:\s*Math\.round\(valor\)/.test(impacto), false);
  conferir("os botões de preço põem os centavos", /priceCents \* 12 \/ 100\)\.toFixed\(2\)|\(item\.priceCents \/ 100\)\.toFixed\(2\)/.test(impacto), true);

  const importacao = ler("scripts/import-ra-completo.ts");
  conferir('a importação não cria mais o plano "Essencial"', /plan:\s*"Essencial"/.test(importacao), false);
}

console.log(
  falhas === 0
    ? "\n  A conta, o Impacto e a tabela de planos falam do mesmo plano.\n"
    : `\n  ${falhas} ponto(s) a corrigir.\n`
);

process.exit(falhas === 0 ? 0 : 1);
