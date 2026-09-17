/**
 * Mede a sugestão de assunto do Reclame Aqui nos relatos reais.
 *
 *   npm run medir:sugestao
 *
 * Só lê. Tira cada caso da base e sugere pelos outros — a mesma conta
 * que a tela mostra como taxa de acerto. Rodar de novo depois de mexer em
 * `lib/models/sugestaoPorTexto.ts` ou em `lib/models/assuntos.ts`: a
 * taxa tem de ficar acima do chute pela maioria, senão a sugestão só
 * atrapalha.
 */
import "dotenv/config";
import { Client } from "pg";

import { familiaDoAssunto } from "../lib/models/assuntos";
import { REGRAS_DE_ASSUNTO, criarIndice, medirAcerto, sugerir, type Exemplo } from "../lib/models/sugestaoPorTexto";

(async () => {
  const c = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  await c.connect();
  const { rows } = await c.query(
    `select c.id, c.protocol, c.title, coalesce(c.description,'') description, cat.name categoria
       from "Case" c join "Category" cat on cat.id = c."categoryId"
      where c.channel = 'RECLAME_AQUI' order by c."publishedAt" desc`
  );
  await c.end();

  const exemplos: Exemplo[] = rows.map((r) => ({ id: r.id, referencia: r.protocol, texto: `${r.title}\n${r.description}`, rotulo: familiaDoAssunto(r.categoria) }));
  const contagem = [...exemplos.reduce((m, e) => m.set(e.rotulo, (m.get(e.rotulo) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const chute = contagem[0][1] / exemplos.length;

  const t0 = performance.now();
  const m = medirAcerto(exemplos, { ultimos: exemplos.length, regras: REGRAS_DE_ASSUNTO });
  console.log(`\n  ${exemplos.length} relatos · chute pela maioria (${contagem[0][0]}): ${(chute * 100).toFixed(1)}%`);
  console.log(`  sugestão: ${((m.taxa ?? 0) * 100).toFixed(1)}% de acerto, cobrindo ${((m.cobertura ?? 0) * 100).toFixed(1)}% · ${Math.round(performance.now() - t0)} ms para medir tudo`);

  const indice = criarIndice(exemplos);
  const t1 = performance.now();
  for (let i = 0; i < 50; i++) sugerir(exemplos[i].texto, { indice, excluirId: exemplos[i].id, regras: REGRAS_DE_ASSUNTO });
  console.log(`  uma sugestão: ${((performance.now() - t1) / 50).toFixed(2)} ms\n`);
  process.exit((m.taxa ?? 0) > chute ? 0 : 1);
})();
