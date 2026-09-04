/**
 * O banco responde, quanto demora, e onde ele quebra?
 *
 *   npm run check:banco
 *   npm run check:banco -- --carga 20   (quantas consultas simultâneas)
 *
 * **O sintoma que motivou isto.** "O banco ou demora para carregar ou
 * nem carrega. No painel do Supabase tudo carrega certinho; aqui nem
 * carrega ou demora muito." E não é impressão: durante um único dia de
 * trabalho, quatro execuções de scripts que estavam passando morreram
 * no meio com `DatabaseNotReachable` e `ECONNABORTED`.
 *
 * O painel do Supabase carregar bem não contradiz nada — ele fala com o
 * Postgres por outro caminho, de dentro da infraestrutura deles. O que
 * a aplicação atravessa é o **pooler**, e é lá que a fila se forma.
 *
 * **O que este script separa.** "Está lento" é diagnóstico de nada.
 * São perguntas diferentes, com consertos diferentes:
 *
 * 1. **Quanto custa a primeira conexão?** Se a primeira é muito mais
 *    lenta que as seguintes, o custo é de handshake e de acordar o
 *    projeto — não de consulta.
 * 2. **A latência é estável?** Uma mediana boa com cauda horrível é
 *    saturação intermitente, e é o que derruba tela no meio do uso.
 * 3. **Quantas simultâneas ele aguenta?** É a pergunta que importa:
 *    a aplicação abre várias consultas ao montar uma tela, e o plano
 *    gratuito tem teto baixo de conexões. Estourar o teto não devolve
 *    "lento" — devolve erro.
 * 4. **Os dois endereços têm o mesmo comportamento?** `DATABASE_URL` é
 *    o pooler de transação (6543) e `DIRECT_URL` o de sessão (5432).
 *    A aplicação usa o primeiro; os scripts, o segundo. Medir os dois
 *    diz de qual lado está o problema.
 */
import "dotenv/config";

import { Client, Pool } from "pg";

const carga = (() => {
  const i = process.argv.indexOf("--carga");
  return i >= 0 ? Number(process.argv[i + 1]) || 20 : 20;
})();

function esconder(url: string) {
  return url.replace(/:\/\/([^:]+):[^@]+@/, "://$1:***@");
}

function ms(valor: number) {
  return `${valor.toFixed(0)} ms`;
}

interface Amostra {
  ok: boolean;
  ms: number;
  erro?: string;
}

/** Uma conexão nova, uma consulta, e fecha. É o pior caso. */
async function umaConexao(url: string): Promise<Amostra> {

  const inicio = Date.now();

  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 20_000,
    query_timeout: 20_000,
  });

  try {
    await client.connect();
    await client.query("SELECT 1");
    return { ok: true, ms: Date.now() - inicio };
  } catch (erro) {
    return {
      ok: false,
      ms: Date.now() - inicio,
      erro:
        erro instanceof Error
          ? erro.message.split("\n")[0]
          : String(erro),
    };
  } finally {
    await client.end().catch(() => {});
  }
}

function resumir(nome: string, amostras: Amostra[]) {

  const boas = amostras.filter((a) => a.ok);
  const ruins = amostras.filter((a) => !a.ok);

  const tempos = boas
    .map((a) => a.ms)
    .sort((a, b) => a - b);

  const p = (q: number) =>
    tempos.length
      ? tempos[
          Math.min(
            tempos.length - 1,
            Math.floor(tempos.length * q)
          )
        ]
      : 0;

  console.log(
    `  ${nome.padEnd(26)} ${boas.length}/${amostras.length} ok · ` +
      (tempos.length
        ? `mediana ${ms(p(0.5))} · p90 ${ms(p(0.9))} · pior ${ms(tempos.at(-1)!)}`
        : "nenhuma resposta")
  );

  if (ruins.length) {

    const porErro = new Map<string, number>();

    for (const r of ruins) {
      const chave = (r.erro ?? "erro").slice(0, 70);
      porErro.set(chave, (porErro.get(chave) ?? 0) + 1);
    }

    for (const [erro, n] of porErro) {
      console.log(`       ${n}× ${erro}`);
    }
  }

  return { boas: boas.length, ruins: ruins.length, tempos };
}

async function medirEndereco(nome: string, url: string) {

  console.log(`\n  ${nome} — ${esconder(url)}\n`);

  /* 1. a primeira conexão, sozinha */

  const primeira = await umaConexao(url);

  console.log(
    `  primeira conexão           ${
      primeira.ok
        ? ms(primeira.ms)
        : `FALHOU — ${primeira.erro}`
    }`
  );

  /* 2. dez seguidas, uma de cada vez */

  const seguidas: Amostra[] = [];

  for (let i = 0; i < 10; i += 1) {
    seguidas.push(await umaConexao(url));
  }

  const s = resumir("dez, uma de cada vez", seguidas);

  if (primeira.ok && s.tempos.length) {
    const mediana = s.tempos[Math.floor(s.tempos.length / 2)];
    if (primeira.ms > mediana * 2) {
      console.log(
        `       a primeira custou ${(primeira.ms / mediana).toFixed(1)}× a mediana — é handshake e projeto acordando, não consulta`
      );
    }
  }

  /* 3. a carga simultânea */

  const inicio = Date.now();

  const juntas = await Promise.all(
    Array.from({ length: carga }, () => umaConexao(url))
  );

  const j = resumir(
    `${carga} ao mesmo tempo`,
    juntas
  );

  console.log(
    `       a rodada inteira levou ${ms(Date.now() - inicio)}`
  );

  /* 4. o mesmo pool, reaproveitando conexão */

  const pool = new Pool({
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: 20_000,
  });

  const doPool: Amostra[] = [];

  try {

    for (let i = 0; i < 20; i += 1) {
      const t = Date.now();
      try {
        await pool.query("SELECT 1");
        doPool.push({ ok: true, ms: Date.now() - t });
      } catch (erro) {
        doPool.push({
          ok: false,
          ms: Date.now() - t,
          erro:
            erro instanceof Error
              ? erro.message.split("\n")[0]
              : String(erro),
        });
      }
    }

    resumir("vinte, no mesmo pool", doPool);

  } finally {
    await pool.end().catch(() => {});
  }

  return { seguidas: s, juntas: j };
}

async function main() {

  console.log(
    "\n  BANCO — responde, e em quanto tempo?\n"
  );

  console.log(`  carga simultânea: ${carga}`);

  const transacao = process.env.DATABASE_URL;
  const sessao = process.env.DIRECT_URL;

  if (!transacao && !sessao) {
    console.error(
      "\n  Nem DATABASE_URL nem DIRECT_URL definidos.\n"
    );
    process.exit(1);
  }

  const resultados: Record<
    string,
    Awaited<ReturnType<typeof medirEndereco>>
  > = {};

  if (transacao) {
    resultados["transação (app)"] = await medirEndereco(
      "DATABASE_URL — pooler de transação, é o que a aplicação usa",
      transacao
    );
  }

  if (sessao && sessao !== transacao) {
    resultados["sessão (scripts)"] = await medirEndereco(
      "DIRECT_URL — pooler de sessão, é o que os scripts usam",
      sessao
    );
  }

  /* ---------------- a leitura ---------------- */

  console.log("\n  O QUE ISTO QUER DIZER\n");

  let falhou = false;

  for (const [nome, r] of Object.entries(resultados)) {

    if (r.juntas.ruins > 0) {
      falhou = true;
      console.log(
        `    ${nome}: ${r.juntas.ruins} de ${carga} conexões simultâneas falharam.`
      );
      console.log(
        "      É teto de conexão, não lentidão. A tela que abre várias consultas"
      );
      console.log(
        "      de uma vez cai aqui — e cai de vez em quando, que é o pior jeito."
      );
    }

    const t = r.seguidas.tempos;

    if (t.length >= 5) {

      const mediana = t[Math.floor(t.length / 2)];
      const pior = t.at(-1)!;

      if (pior > mediana * 4) {
        console.log(
          `    ${nome}: mediana ${ms(mediana)} e pior caso ${ms(pior)} — ${(pior / mediana).toFixed(1)}× de diferença.`
        );
        console.log(
          "      Cauda assim é saturação intermitente: quase sempre rápido, e de"
        );
        console.log(
          "      repente não. É exatamente a experiência de 'às vezes nem carrega'."
        );
      } else if (mediana > 1000) {
        console.log(
          `    ${nome}: mediana de ${ms(mediana)} por conexão. Cada tela que abre`
        );
        console.log(
          "      várias consultas paga isso multiplicado."
        );
      }
    }
  }

  if (!falhou) {
    console.log(
      "    Nenhuma conexão falhou nesta rodada. Se o sintoma aparece na"
    );
    console.log(
      "    aplicação e não aqui, rode de novo no momento em que ela travar —"
    );
    console.log(
      "    saturação intermitente não aparece quando se procura por ela."
    );
  }

  console.log("");
}

main().catch((erro) => {
  console.error("\n  Erro:", erro);
  process.exit(1);
});
