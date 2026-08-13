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
       * Aviso, não erro.
       *
       * Os formulários da aplicação preenchem seus campos em um efeito
       * quando o modal abre — e os contextos de preferência leem o
       * localStorage na montagem, que é a única forma de não quebrar a
       * hidratação. São 13 ocorrências do mesmo padrão deliberado; como
       * erro, elas escondiam os problemas de verdade no `npm run lint`.
       *
       * A correção certa (remontar os formulários por `key`) está no
       * ROADMAP.md — até lá a dívida fica visível como aviso.
       */
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Scripts de linha de comando rodam em Node puro, fora do bundle.
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
