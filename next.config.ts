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

  env: {
    NEXT_PUBLIC_VERSAO: pacote.version,
  },
};

export default nextConfig;
