import type { NextConfig } from "next";

import pacote from "./package.json";

/**
 * A versão exibida sai do `package.json`.
 *
 * Estava escrita à mão na barra lateral e na tela de configurações —
 * "1.0.0" — enquanto o `package.json` já ia em 0.7.0. Número de versão
 * que não acompanha o que está no ar é pior do que nenhum: alguém olha,
 * acredita, e conclui a coisa errada sobre o que a instalação tem.
 *
 * `NEXT_PUBLIC_` porque quem mostra é componente de cliente, e a
 * substituição acontece no build — é o mesmo número do pacote que a
 * Vercel empacotou.
 */
const nextConfig: NextConfig = {
  reactCompiler: true,

  /*
    Uma segunda pasta de build, só quando pedida.

    O `next dev` recusa subir se outro já está rodando na mesma pasta
    `.next` — e conferir uma mudança de banco (cliente do Prisma novo)
    exigia derrubar o servidor de quem estava trabalhando. Com
    `CW_DIST_DIR=.next-conferencia`, sobe um segundo, lado a lado. Sem
    a variável, nada muda.
  */
  distDir: process.env.CW_DIST_DIR || ".next",

  env: {
    NEXT_PUBLIC_VERSAO: pacote.version,
  },
};

export default nextConfig;
