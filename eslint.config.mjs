import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // A build do servidor de conferência (porta 3201), a bancada do
    // painel e o pacote da extensão: código gerado. Varrer
    // `.next-conferencia` fazia o `npm run lint` passar de uma hora.
    ".next-conferencia/**",
    /* Qualquer outra pasta de build lado a lado (o build de conferência usa .next-build). */
    ".next-*/**",
    ".bancada/**",
    "dist/**",
  ]),
  {
    /*
      Só onde o plugin do React existe. Sem `files`, a regra valia também
      para os `.cjs` de `scripts/`, que o Next não cobre — e o
      `npm run lint` inteiro parava em "could not find plugin" (out/2026).
    */
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      /**
       * De volta a erro (22/08/2026).
       *
       * Ficou como aviso enquanto treze formulários preenchiam os
       * campos num efeito ao abrir o modal — a dívida precisava ficar
       * visível sem esconder problema de verdade no `npm run lint`.
       *
       * Os treze foram migrados: os campos nascem no `useState` e quem
       * abre passa `key`, então o formulário remonta a cada abertura.
       * Sobraram dois efeitos legítimos (ler `localStorage` na
       * montagem, que no servidor não existe), e esses estão marcados
       * um a um com o motivo escrito ao lado.
       *
       * Como erro, a regra volta a servir para o que existe: impedir a
       * próxima ocorrência de entrar sem alguém decidir que ela é a
       * exceção.
       */
      "react-hooks/set-state-in-effect": "error",

      /*
        O "_" na frente é o jeito de dizer "este parâmetro existe porque a
        assinatura pede" — a server action do `useActionState` recebe o
        estado anterior e o formulário mesmo quando não usa (out/2026).
      */
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    /**
     * Scripts de linha de comando rodam em Node puro, fora do bundle.
     * O gerador de ícones da extensão é um deles — mora junto do que
     * ele produz, e não em `scripts/`, para a pasta `extensao/`
     * continuar sendo carregável no navegador por si só.
     */
    files: ["scripts/**/*.js", "scripts/**/*.cjs", "extensao/icones/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
