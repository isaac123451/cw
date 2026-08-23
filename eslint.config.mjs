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
  ]),
  {
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
    },
  },
  {
    /**
     * Scripts de linha de comando rodam em Node puro, fora do bundle.
     * O gerador de ícones da extensão é um deles — mora junto do que
     * ele produz, e não em `scripts/`, para a pasta `extensao/`
     * continuar sendo carregável no navegador por si só.
     */
    files: ["scripts/**/*.js", "extensao/icones/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
